const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(name, imports = {}) {
  const filename = path.resolve(__dirname, '../src/screens/main/' + name + '.ts');
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(key => imports[key] ?? require(key), module, module.exports);
  return module.exports;
}
const h = load('deliveryHandoff');
const cancellation = load('deliveryCancellation');
const { robotDeliveryProof } = load('robotDeliveryProof', { './deliveryHandoff': h });
const jobId = '11111111-1111-4111-8111-111111111111', stepId = '22222222-2222-4222-8222-222222222222';
const actor = '33333333-3333-4333-8333-333333333333', other = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const step = () => ({ jobStepId: stepId, stepCodeSnapshot: 'AUTH_SENDER', stepTypeSnapshot: 'AUTHENTICATE', status: 'RUNNING', resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_SENDER' } });
const job = () => ({ jobId, status: 'RUNNING', selectedJobStepId: stepId, schemaVersion: 3, beOrchestrated: true, serviceRequestId: requestId, inputJson: { expected_sender_account_id: actor }, steps: [step()] });
const context = { jobId, stepId, purpose: 'DELIVERY_SENDER', accountId: actor };
const proof = (parts = {}) => {
  const claims = [other, parts.jobId ?? jobId, stepId, parts.purpose ?? 'DELIVERY_SENDER', parts.expires ?? '2100000000'].join('|');
  return 'MARQR1.' + Buffer.from(claims).toString('base64url') + '.' + 'A'.repeat(43);
};
test('only the selected RUNNING, uninterrupted step enables scan', () => {
  assert.deepEqual(h.scanContext(job(), actor), context);
  for (const status of ['PENDING','RETRYING','SUCCEEDED']) {
    const value = job(); value.steps[0].status = status; assert.equal(h.scanContext(value, actor), undefined);
  }
  const value = job(); value.steps[0].interruptionRequestedAt = new Date().toISOString(); assert.equal(h.scanContext(value, actor), undefined);
});
test('cancel, other actor, conflicting assignment and unsupported workflow fail closed', () => {
  assert.equal(h.scanContext({ ...job(), cancelRequestedAt: 'now' }, actor), undefined);
  assert.equal(h.scanContext(job(), other), undefined);
  assert.equal(h.scanContext({ ...job(), beOrchestrated: false }, actor), undefined);
  assert.equal(h.scanContext(job(), actor, { request: { serviceRequestId: requestId }, expectedSenderAccountId: other }), undefined);
});
test('backend purpose works without hard-coded step names', () => {
  const value = job(); value.steps[0].stepCodeSnapshot = 'HOSPITAL_CHECK_PICKUP'; assert.deepEqual(h.scanContext(value, actor), context);
});
test('signed QR parser binds to job, phase and expiration; BE still verifies signature', () => {
  assert.equal(robotDeliveryProof(proof(), context, 1900000000000), proof());
  assert.throws(() => robotDeliveryProof(proof({ jobId: other }), context));
  assert.throws(() => robotDeliveryProof(proof({ purpose: 'DELIVERY_RECEIVER' }), context));
  assert.throws(() => robotDeliveryProof(proof({ expires: '1' }), context));
  for (const raw of ['https://bad.invalid/?proof=x', 'MARSTAFF1.a', jobId, '', '{}']) assert.throws(() => robotDeliveryProof(raw, context));
});
test('a verification for another actor/step is not success', () => {
  const value = { method: 'QR_CODE', jobId, authJobStepId: stepId, purpose: context.purpose, actorAccountId: actor };
  assert.equal(h.verificationMatches(value, context), true);
  assert.equal(h.verificationMatches({ ...value, actorAccountId: other }, context), false);
});
test('payload confirmation uses resolved items, close and lock are separate responses', () => {
  const items = [{ item_code: 'REAL-ITEM', quantity: 2 }];
  assert.deepEqual(h.handoffResponse({ ...step(), stepTypeSnapshot: 'HANDLE_PAYLOAD', resolvedInputsJson: { action: 'LOAD', items } }), { responseType: 'PAYLOAD_CONFIRMED', data: { confirmed: true, items } });
  assert.equal(h.handoffResponse({ ...step(), stepTypeSnapshot: 'HANDLE_PAYLOAD', resolvedInputsJson: { action: 'LOAD' } }), undefined);
  assert.equal(h.handoffResponse({ ...step(), stepTypeSnapshot: 'INTERACT', resolvedInputsJson: { prompt_key: 'CLOSE_SENDER' } }).responseType, 'DOOR_CLOSED');
  assert.equal(h.handoffResponse({ ...step(), stepTypeSnapshot: 'INTERACT', resolvedInputsJson: { prompt_key: 'VERIFY_SENDER' } }).responseType, 'LOCK_CHECKED');
  assert.equal(h.handoffResponseKey(stepId, actor, 'DOOR_CLOSED'), h.handoffResponseKey(stepId, actor, 'DOOR_CLOSED'));
});
test('generic BE prompts work for the selected delivery leg but completed steps do not', () => {
  const value = { ...step(), stepCodeSnapshot: 'CLOSE_RECEIVER', stepTypeSnapshot: 'INTERACT', resolvedInputsJson: { prompt_key: 'STAFF_CLOSE_DOOR_AND_CLEAR_MECHANISM' } };
  assert.equal(h.handoffResponse(value).responseType, 'DOOR_CLOSED');
  assert.equal(h.handoffResponse({ ...value, status: 'SUCCEEDED' }), undefined);
  assert.equal(h.handoffResponse({ ...value, interruptionRequestedAt: 'now' }), undefined);
  assert.equal(h.handoffResponse({ ...value, stepCodeSnapshot: 'VERIFY_RECEIVER', resolvedInputsJson: { prompt_key: 'STAFF_PHYSICALLY_VERIFY_LOCK' } }).responseType, 'LOCK_CHECKED');
});
test('lost create response retries the same payload/key', async () => {
  const attempt = { key: 'stable-key', payload: { mapId: other, items: [] } }, calls = [];
  const api = { create: async (payload,key) => { calls.push({payload,key}); if (calls.length === 1) throw Error('network'); return { request: { serviceRequestId: requestId } }; }, submit: async () => ({}), getRequest: async () => ({}), findJob: async () => job() };
  await assert.rejects(h.continueDeliverySubmission(attempt,api,()=>true));
  await h.continueDeliverySubmission(attempt,api,()=>true);
  assert.deepEqual(calls[0], calls[1]);
});
test('lost submit response recovers existing job and never creates twice', async () => {
  const attempt = { key: 'key', payload: {} }; let creates=0, submits=0, saves=0;
  const api = { create: async () => { creates++; return { request: { serviceRequestId: requestId } }; }, submit: async () => { submits++; throw Error('lost'); }, getRequest: async () => ({}), findJob: async () => job() };
  assert.equal((await h.continueDeliverySubmission(attempt,api,()=>true,async()=>{saves++;})).jobId,jobId);
  await h.continueDeliverySubmission(attempt,api,()=>true);
  assert.equal(creates,1); assert.equal(submits,1); assert.equal(attempt.submitted,true); assert.ok(saves>=2);
});
test('switching account prevents submit after create resolves', async () => {
  let current=true, submitted=false;
  const api={ create:async()=>{current=false;return {request:{serviceRequestId:requestId}};},submit:async()=>{submitted=true;},getRequest:async()=>({}),findJob:async()=>job() };
  await h.continueDeliverySubmission({key:'k',payload:{}},api,()=>current);
  assert.equal(submitted,false);
});
test('pending operation survives remount in its own server/account namespace', async () => {
  const data=new Map(); const storage={ getItem:async k=>data.get(k)??null,setItem:async(k,v)=>data.set(k,v),removeItem:async k=>data.delete(k) };
  const s=load('deliveryAttemptStorage',{'./deliveryHandoff':h,'@react-native-async-storage/async-storage':{__esModule:true,default:storage}});
  const attempt={key:'same',payload:{mapId:other,items:[]},requestId,submitted:true};
  await s.saveDeliveryAttempt('server:sender',attempt);
  assert.deepEqual(await s.loadDeliveryAttempt('server:sender'),attempt);
  assert.equal(await s.loadDeliveryAttempt('server:receiver'),null);
  await s.saveDeliveryAttempt('server:sender',null); assert.equal(await s.loadDeliveryAttempt('server:sender'),null);
});

const cancelSnapshot = () => ({ job: job(), delivery: {
  request: { serviceRequestId: requestId, requestType: 'DELIVERY', status: 'IN_PROGRESS', requestedByAccountId: other },
  expectedSenderAccountId: actor, expectedReceiverAccountId: requestId,
} });
test('cancellation is offered to creator or sender, not a receiver or unrelated account', () => {
  assert.equal(cancellation.canCancelDelivery(cancelSnapshot(), actor), true);
  assert.equal(cancellation.canCancelDelivery(cancelSnapshot(), other), true);
  assert.equal(cancellation.canCancelDelivery(cancelSnapshot(), requestId), false);
  const wrong = cancelSnapshot(); wrong.delivery.request.serviceRequestId = other;
  assert.equal(cancellation.canCancelDelivery(wrong, actor), false);
  for (const status of ['CANCELLED', 'SUCCEEDED', 'FAILED', 'RECOVERY_REQUIRED']) {
    const snapshot = cancelSnapshot(); snapshot.job.status = status;
    assert.equal(cancellation.canCancelDelivery(snapshot, actor), false);
  }
});
test('cancellation validates reason and submits the selected job ID with trimmed reason', async () => {
  assert.throws(() => cancellation.cancellationReason('   '));
  assert.throws(() => cancellation.cancellationReason('x'.repeat(1001)));
  const calls = [];
  const result = await cancellation.requestDeliveryCancellation({ jobId, accountId: actor, reason: '  Gửi nhầm hàng  ',
    stillCurrent: () => true, loadLatest: async () => cancelSnapshot(),
    cancelJob: async (id, reason) => { calls.push([id, reason]); return { ...job(), cancelRequestedAt: 'now' }; },
  });
  assert.deepEqual(calls, [[jobId, 'Gửi nhầm hàng']]);
  assert.equal(result.status, 'RUNNING'); // acceptance is not physical stop
  assert.match(cancellation.cancellationMessage({ ...cancelSnapshot(), job: result }), /chưa xác nhận robot đã dừng/);
});
test('fresh ownership or terminal state wins over stale screen before cancellation', async () => {
  let sent = 0;
  for (const latest of [
    { ...cancelSnapshot(), job: { ...job(), status: 'SUCCEEDED' } },
    { ...cancelSnapshot(), delivery: { ...cancelSnapshot().delivery, expectedSenderAccountId: other } },
  ]) {
    await assert.rejects(cancellation.requestDeliveryCancellation({ jobId, accountId: actor, reason: 'Hủy',
      stillCurrent: () => true, loadLatest: async () => latest, cancelJob: async () => { sent++; return job(); },
    }));
  }
  assert.equal(sent, 0);
});
test('pending cancellation is reconciled without sending a duplicate POST', async () => {
  let sent = 0;
  const latest = cancelSnapshot(); latest.job.cancelRequestedAt = '2026-11-11T01:00:00Z';
  const result = await cancellation.requestDeliveryCancellation({ jobId, accountId: actor, reason: 'Thử lại',
    stillCurrent: () => true, loadLatest: async () => latest, cancelJob: async () => { sent++; return job(); },
  });
  assert.equal(sent, 0); assert.equal(result.cancelRequestedAt, latest.job.cancelRequestedAt);
});
test('changing account during cancellation refresh prevents POST', async () => {
  let current = true, sent = 0;
  await assert.rejects(cancellation.requestDeliveryCancellation({ jobId, accountId: actor, reason: 'Hủy',
    stillCurrent: () => current, loadLatest: async () => { current = false; return cancelSnapshot(); },
    cancelJob: async () => { sent++; return job(); },
  }));
  assert.equal(sent, 0);
});
test('transport error remains an unknown result; retry reads pending intent before POST', async () => {
  let sent = 0;
  const latest = cancelSnapshot();
  const options = { jobId, accountId: actor, reason: 'Hủy', stillCurrent: () => true, loadLatest: async () => latest,
    cancelJob: async () => { sent++; latest.job.cancelRequestedAt = 'now'; throw Error('response lost'); },
  };
  await assert.rejects(cancellation.requestDeliveryCancellation(options), /response lost/);
  await cancellation.requestDeliveryCancellation(options);
  assert.equal(sent, 1);
  latest.job.status = 'RECOVERY_REQUIRED';
  assert.match(cancellation.cancellationMessage(latest), /Chưa xác nhận robot đã dừng an toàn/);
});

test('D1: scanContext strictly differentiates sender and receiver assignments and rejects unassigned accounts', () => {
  const receiverActor = '66666666-6666-4666-8666-666666666666';
  const receiverStepId = '77777777-7777-4777-8777-777777777777';
  const receiverStep = {
    jobStepId: receiverStepId,
    stepCodeSnapshot: 'AUTH_RECEIVER',
    stepTypeSnapshot: 'AUTHENTICATE',
    status: 'RUNNING',
    resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_RECEIVER' },
  };
  const deliveryJob = {
    jobId,
    status: 'RUNNING',
    selectedJobStepId: receiverStepId,
    schemaVersion: 3,
    beOrchestrated: true,
    serviceRequestId: requestId,
    inputJson: {
      expected_sender_account_id: actor,
      expected_receiver_account_id: receiverActor,
    },
    steps: [receiverStep],
  };

  // Sender trying to access receiver step must fail
  assert.equal(h.scanContext(deliveryJob, actor), undefined);

  // Receiver accessing receiver step must succeed with DELIVERY_RECEIVER
  assert.deepEqual(h.scanContext(deliveryJob, receiverActor), {
    jobId,
    stepId: receiverStepId,
    purpose: 'DELIVERY_RECEIVER',
    accountId: receiverActor,
  });

  // Third party account must fail
  assert.equal(h.scanContext(deliveryJob, other), undefined);

  // Empty or invalid stepId must fail
  assert.equal(h.scanContext({ ...deliveryJob, selectedJobStepId: '' }, receiverActor), undefined);
});

test('D2: cancelled or interrupted job fails closed for running steps, preventing unsafe compartment responses', () => {
  const runningJob = job();
  assert.ok(h.selectedRunningStep(runningJob));

  // Job cancelled immediately by BE 4d2b29a
  const cancelledJob = { ...runningJob, status: 'CANCELLED' };
  assert.equal(h.selectedRunningStep(cancelledJob), undefined);
  assert.equal(h.handoffResponse(h.selectedRunningStep(cancelledJob)), undefined);

  // Job interrupted by SOS/emergency
  const interruptedJob = { ...runningJob, cancelRequestedAt: '2026-11-15T00:00:00Z' };
  assert.equal(h.selectedRunningStep(interruptedJob), undefined);

  // Cancellation message explains coordinator / physical safety requirement
  const cancelledSnapshot = { job: cancelledJob, delivery: { request: { serviceRequestId: requestId, requestType: 'DELIVERY' } } };
  assert.match(cancellation.cancellationMessage(cancelledSnapshot), /Nếu còn hàng trong thùng, liên hệ người điều phối để thu hồi/);
});

test('D3: DELIVERY_CREATED notification shows only to assigned expectedReceiverAccountId with matching recipients, dedupes alertId, opens via dataJson.jobId, and excludes coworkers/sender/drafts/failures', () => {
  const notifMod = load('deliveryNotifications', { './deliveryHandoff': h });
  const senderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const receiverId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const coworkerSameRoomId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const validJobId = '11111111-1111-4111-8111-111111111111';
  const reqId = '22222222-2222-4222-8222-222222222222';
  const alertId1 = '99999999-9999-4999-8999-999999999991';
  const alertId2 = '99999999-9999-4999-8999-999999999992';

  const queuedJob = {
    jobId: validJobId,
    serviceRequestId: reqId,
    status: 'QUEUED',
    inputJson: { expected_receiver_account_id: receiverId },
  };
  const validDelivery = {
    request: { serviceRequestId: reqId, requestType: 'DELIVERY', status: 'QUEUED' },
    pickupRoomId: 'room-a',
    deliveryRoomId: 'room-b',
    expectedSenderAccountId: senderId,
    expectedReceiverAccountId: receiverId,
    items: [{ itemName: 'Kháng sinh Ampicillin' }],
  };
  const jobsById = { [validJobId]: queuedJob };
  const deliveriesByRequestId = { [reqId]: validDelivery };
  const roomsById = {
    'room-a': { roomId: 'room-a', roomName: 'Kho Dược' },
    'room-b': { roomId: 'room-b', roomName: 'Phòng Nội 1' },
  };

  // Receiver account gets alert with own recipient entry -> sees notification (deduped by alertId!)
  const receiverAlerts = [
    {
      alertId: alertId1,
      serviceRequestId: reqId,
      notificationType: 'DELIVERY_CREATED',
      status: 'OPEN',
      message: 'Có đơn giao hàng mới dành cho bạn.',
      dataJson: { jobId: validJobId },
      createdAt: '2026-11-17T10:00:00Z',
      recipients: [{ accountId: receiverId, channel: 'WEB', deliveryStatus: 'DELIVERED' }],
    },
    // Duplicate alertId must collapse
    {
      alertId: alertId1,
      serviceRequestId: reqId,
      notificationType: 'DELIVERY_CREATED',
      status: 'OPEN',
      message: 'Có đơn giao hàng mới dành cho bạn.',
      dataJson: { jobId: validJobId },
      createdAt: '2026-11-17T10:00:00Z',
      recipients: [{ accountId: receiverId, channel: 'WEB', deliveryStatus: 'DELIVERED' }],
    },
  ];

  const receiverResult = notifMod.verifyAndDedupeDeliveryAlerts({
    alerts: receiverAlerts,
    currentAccountId: receiverId,
    jobsById,
    deliveriesByRequestId,
    roomsById,
  });
  assert.equal(receiverResult.length, 1);
  assert.equal(receiverResult[0].alertId, alertId1);
  assert.equal(receiverResult[0].jobId, validJobId);
  assert.equal(receiverResult[0].title, 'Kháng sinh Ampicillin');
  assert.equal(receiverResult[0].routeSummary, 'Kho Dược → Phòng Nội 1');

  // Staff #2: Sender (even though in same ServiceRequest scope, BE returns recipients: []) MUST NOT see notification
  const senderViewAlerts = [{ ...receiverAlerts[0], recipients: [] }];
  assert.equal(
    notifMod.verifyAndDedupeDeliveryAlerts({
      alerts: senderViewAlerts,
      currentAccountId: senderId,
      jobsById,
      deliveriesByRequestId,
    }).length,
    0
  );

  // Staff #2b: Coworker on duty in same destination room (even if recipients were falsely present, expectedReceiverAccountId != coworker!) MUST NOT see notification
  assert.equal(
    notifMod.verifyAndDedupeDeliveryAlerts({
      alerts: [{ ...receiverAlerts[0], recipients: [{ accountId: coworkerSameRoomId }] }],
      currentAccountId: coworkerSameRoomId,
      jobsById,
      deliveriesByRequestId,
    }).length,
    0
  );

  // Draft, failed request, cancelled job, or missing job detail fail closed (0 notifications)
  const draftReqId = '33333333-3333-4333-8333-333333333333';
  const draftJobId = '44444444-4444-4444-8444-444444444444';
  assert.equal(
    notifMod.verifyAndDedupeDeliveryAlerts({
      alerts: [{ ...receiverAlerts[0], alertId: alertId2, serviceRequestId: draftReqId, dataJson: { jobId: draftJobId } }],
      currentAccountId: receiverId,
      jobsById: { [draftJobId]: { ...queuedJob, jobId: draftJobId, serviceRequestId: draftReqId } },
      deliveriesByRequestId: {
        [draftReqId]: { ...validDelivery, request: { serviceRequestId: draftReqId, requestType: 'DELIVERY', status: 'DRAFT' } },
      },
    }).length,
    0
  );
  assert.equal(
    notifMod.verifyAndDedupeDeliveryAlerts({
      alerts: [{ ...receiverAlerts[0], alertId: alertId2 }],
      currentAccountId: receiverId,
      jobsById: { [validJobId]: { ...queuedJob, status: 'CANCELLED' } },
      deliveriesByRequestId,
    }).length,
    0
  );
  assert.equal(
    notifMod.verifyAndDedupeDeliveryAlerts({
      alerts: [{ ...receiverAlerts[0], alertId: alertId2 }],
      currentAccountId: receiverId,
      jobsById: {},
      deliveriesByRequestId,
    }).length,
    0
  );

  // Verify MissionScreen wiring uses exact UI copy, focus/AppState refresh, alertApi.getDeliveryCreatedAlerts, and followJob(notif.jobId)
  const missionSrc = fs.readFileSync(path.resolve(__dirname, '../src/screens/main/MissionScreen.tsx'), 'utf8');
  assert.match(missionSrc, /Bạn có đơn giao hàng cần theo dõi/);
  assert.match(missionSrc, /getDeliveryCreatedAlerts/);
  assert.match(missionSrc, /alertRecipientsIncludesAccount/);
  assert.match(missionSrc, /verifyAndDedupeDeliveryAlerts/);
  assert.match(missionSrc, /followJob\(notif\.jobId\)/);
  assert.match(missionSrc, /getDeliveryNotificationPollingPlan/);
});

function loadApiWithClientMock(relPath, clientMock) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  const js = ts.transpileModule(fs.readFileSync(fullPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  const endpointsJs = ts.transpileModule(
    fs.readFileSync(path.resolve(__dirname, '../src/api/endpoints.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const endpointsMod = { exports: {} };
  new Function('require', 'module', 'exports', endpointsJs)(require, endpointsMod, endpointsMod.exports);
  new Function('require', 'module', 'exports', js)(
    key => {
      if (key === '../client') return { apiClient: clientMock };
      if (key === '../endpoints') return endpointsMod.exports;
      return require(key);
    },
    mod,
    mod.exports,
  );
  return mod.exports;
}

test('F1: Delivery payload, Idempotency retry, method change discard, and BE method display preserve authenticationMethod', async () => {
  const receiverId = '66666666-6666-4666-8666-666666666666';
  assert.equal(h.resolveAuthenticationMethod('face'), 'FACE_VERIFICATION');
  assert.equal(h.resolveAuthenticationMethod('FACE_VERIFICATION'), 'FACE_VERIFICATION');
  assert.equal(h.resolveAuthenticationMethod('qr'), 'QR_CODE');
  assert.equal(h.resolveAuthenticationMethod('no_auth'), 'QR_CODE');
  assert.equal(h.resolveAuthenticationMethod(undefined), 'QR_CODE');

  // deliveryApi.createDeliveryRequest forwards authenticationMethod: FACE_VERIFICATION to POST /delivery-requests
  const posted = [];
  const { deliveryApi } = loadApiWithClientMock('src/api/modules/delivery.api.ts', {
    post: async (url, payload, headers) => {
      posted.push({ url, payload, headers });
      return { request: { serviceRequestId: requestId, requestType: 'DELIVERY', status: 'DRAFT' }, authenticationMethod: payload.authenticationMethod };
    },
    get: async () => ({}),
  });
  const basePayload = {
    mapId: other,
    targetMode: 'ENDPOINT',
    pickupEndpointId: stepId,
    deliveryEndpointId: requestId,
    expectedSenderAccountId: actor,
    expectedReceiverAccountId: receiverId,
    recipientName: 'BS. Nguyễn Văn A',
    requiresConfirmation: true,
    priority: 80,
    authenticationMethod: 'FACE_VERIFICATION',
    items: [{ itemCode: 'ITEM-01', itemName: 'Máu', itemCategory: 'BLOOD_SAMPLE', quantity: 1, unit: 'túi', sensitive: true }],
  };
  await deliveryApi.createDeliveryRequest(basePayload, 'key-face-1');
  assert.equal(posted.length, 1);
  assert.equal(posted[0].url, '/delivery-requests');
  assert.equal(posted[0].payload.authenticationMethod, 'FACE_VERIFICATION');
  assert.equal(posted[0].headers['Idempotency-Key'], 'key-face-1');

  // Retry preserves FACE_VERIFICATION & same Idempotency-Key
  const faceAttempt = h.prepareDeliveryAttempt(null, basePayload, () => 'key-face-retry');
  assert.equal(faceAttempt.key, 'key-face-retry');
  assert.equal(faceAttempt.payload.authenticationMethod, 'FACE_VERIFICATION');

  const retryPayloads = [];
  const faceJob = { ...job(), inputJson: { authentication_method: 'FACE_VERIFICATION', expected_sender_account_id: actor } };
  const retryApi = {
    create: async (payload, key) => {
      retryPayloads.push({ payload, key });
      if (retryPayloads.length === 1) throw new Error('network lost');
      return { request: { serviceRequestId: requestId, status: 'DRAFT' }, authenticationMethod: 'FACE_VERIFICATION' };
    },
    submit: async () => ({ serviceRequestId: requestId, status: 'QUEUED' }),
    getRequest: async () => ({ serviceRequestId: requestId, status: 'QUEUED' }),
    findJob: async () => faceJob,
  };
  await assert.rejects(h.continueDeliverySubmission(faceAttempt, retryApi, () => true));
  const recoveredJob = await h.continueDeliverySubmission(faceAttempt, retryApi, () => true);
  assert.equal(recoveredJob.jobId, jobId);
  assert.equal(retryPayloads.length, 2);
  assert.deepEqual(retryPayloads[0], retryPayloads[1]);
  assert.equal(retryPayloads[1].payload.authenticationMethod, 'FACE_VERIFICATION');

  // Switching from an earlier created QR attempt to FACE_VERIFICATION MUST discard old QR requestId/key
  const oldQrAttempt = {
    key: 'old-qr-key',
    requestId: '99999999-9999-4999-8999-999999999999',
    submitted: false,
    payload: { ...basePayload, authenticationMethod: 'QR_CODE' },
  };
  assert.equal(h.shouldDiscardAttemptForMethodChange(oldQrAttempt, 'FACE_VERIFICATION'), true);
  assert.equal(h.shouldDiscardAttemptForMethodChange(oldQrAttempt, 'QR_CODE'), false);
  const switchedAttempt = h.prepareDeliveryAttempt(oldQrAttempt, basePayload, () => 'fresh-face-key');
  assert.equal(switchedAttempt.key, 'fresh-face-key');
  assert.equal(switchedAttempt.requestId, undefined);
  assert.equal(switchedAttempt.submitted, undefined);
  assert.equal(switchedAttempt.payload.authenticationMethod, 'FACE_VERIFICATION');

  // Storage round-trip retains FACE_VERIFICATION and rejects invalid methods
  const storageMap = new Map();
  const mockStorage = {
    getItem: async k => storageMap.get(k) ?? null,
    setItem: async (k, v) => storageMap.set(k, v),
    removeItem: async k => storageMap.delete(k),
  };
  const attemptStore = load('deliveryAttemptStorage', {
    './deliveryHandoff': h,
    '@react-native-async-storage/async-storage': { __esModule: true, default: mockStorage },
  });
  await attemptStore.saveDeliveryAttempt('server:face', switchedAttempt);
  const restored = await attemptStore.loadDeliveryAttempt('server:face');
  assert.equal(restored.payload.authenticationMethod, 'FACE_VERIFICATION');

  // Existing job method display inspects delivery.authenticationMethod / inputJson / step method & defaults legacy to QR_CODE
  assert.equal(
    h.jobAuthenticationMethod(faceJob, { request: { serviceRequestId: requestId }, authenticationMethod: 'FACE_VERIFICATION' }),
    'FACE_VERIFICATION',
  );
  assert.equal(
    h.jobAuthenticationMethod({ ...job(), inputJson: {} }, { request: { serviceRequestId: requestId } }),
    'QR_CODE',
  );
});

test('F2: Staff face-status uses accountId, reflects READY/PENDING/MISSING/INVALID/REJECTED, and updates when receiver or avatar changes', async () => {
  const receiverA = '66666666-6666-4666-8666-666666666666';
  const receiverB = '77777777-7777-4777-8777-777777777777';
  const calledPaths = [];
  const { staffApi } = loadApiWithClientMock('src/api/modules/staff.api.ts', {
    get: async (url) => {
      calledPaths.push(url);
      return {
        accountId: receiverA,
        avatarVersion: 'aaaa1111-1111-4111-8111-111111111111',
        status: 'READY',
        avatarUrl: 'https://cdn.example/a.jpg',
        enabled: true,
      };
    },
    post: async () => ({}),
  });
  const faceRes = await staffApi.getFaceStatus(receiverA);
  assert.deepEqual(calledPaths, [`/staff/${receiverA}/face-status`]);
  assert.equal(faceRes.status, 'READY');

  const senderReady = {
    accountId: actor,
    avatarVersion: '1111aaaa-1111-4111-8111-111111111111',
    status: 'READY',
    avatarUrl: 'https://cdn.example/sender.jpg',
    enabled: true,
  };
  const receiverReady = {
    accountId: receiverA,
    avatarVersion: '2222bbbb-2222-4222-8222-222222222222',
    status: 'READY',
    avatarUrl: 'https://cdn.example/receiverA.jpg',
    enabled: true,
  };

  // Receiver READY + enabled -> ready: true EVEN WHEN sender has no READY face (sender uses QR at Point A)
  const senderMissing = {
    accountId: actor,
    avatarVersion: null,
    status: 'MISSING',
    avatarUrl: null,
    enabled: true,
  };
  const receiverOnlyReady = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverA,
    senderStatus: senderMissing,
    receiverStatus: receiverReady,
  });
  assert.equal(receiverOnlyReady.ready, true);
  assert.equal(receiverOnlyReady.blockingReason, null);

  // Without sender status at all -> still ready: true
  assert.equal(
    h.evaluateDeliveryFaceReadiness({
      senderAccountId: actor,
      receiverAccountId: receiverA,
      receiverStatus: receiverReady,
    }).ready,
    true,
  );

  // Switch receiver to B with PENDING / MISSING / INVALID / REJECTED -> ready: false with BE-accurate reason
  for (const [status, regex] of [
    ['PENDING', /Chờ Admin duyệt/],
    ['MISSING', /Chưa có ảnh đại diện/],
    ['INVALID', /không đạt chuẩn/],
    ['REJECTED', /từ chối/],
  ]) {
    const evalRes = h.evaluateDeliveryFaceReadiness({
      senderAccountId: actor,
      receiverAccountId: receiverB,
      senderStatus: senderReady,
      receiverStatus: {
        accountId: receiverB,
        avatarVersion: '3333cccc-3333-4333-8333-333333333333',
        status,
        avatarUrl: status === 'MISSING' ? null : 'https://cdn.example/b.jpg',
        enabled: true,
        reason: status === 'INVALID' ? 'FACE_TOO_SMALL' : null,
      },
    });
    assert.equal(evalRes.ready, false);
    assert.match(evalRes.receiver.statusLabel, regex);
    if (status === 'INVALID') {
      assert.match(evalRes.receiver.guidance, /Khuôn mặt trong ảnh quá nhỏ/);
    }
  }

  // Receiver avatar change -> PENDING immediately invalidates readiness; sender change -> PENDING does NOT block
  const afterSenderAvatarUpload = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverA,
    senderStatus: {
      ...senderReady,
      avatarVersion: '9999ffff-9999-4999-8999-999999999999',
      status: 'PENDING',
    },
    receiverStatus: receiverReady,
  });
  assert.equal(afterSenderAvatarUpload.ready, true);

  const afterReceiverAvatarUpload = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverA,
    senderStatus: senderReady,
    receiverStatus: {
      ...receiverReady,
      avatarVersion: '9999ffff-9999-4999-8999-999999999999',
      status: 'PENDING',
    },
  });
  assert.equal(afterReceiverAvatarUpload.ready, false);
  assert.equal(afterReceiverAvatarUpload.receiver.status, 'PENDING');

  // FACE_ENABLED=false on receiver blocks face delivery
  const featureDisabled = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverA,
    senderStatus: senderReady,
    receiverStatus: { ...receiverReady, enabled: false },
  });
  assert.equal(featureDisabled.enabled, false);
  assert.equal(featureDisabled.ready, false);
  assert.match(featureDisabled.blockingReason, /FACE_ENABLED=false/);

  // Stale response for old receiverAccountId must fail closed
  const mismatchedAccount = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverB,
    senderStatus: senderReady,
    receiverStatus: receiverReady, // belongs to receiverA!
  });
  assert.equal(mismatchedAccount.ready, false);
  assert.equal(mismatchedAccount.receiver.status, 'ACCOUNT_MISMATCH');

  // Concurrent loadPairFaceReadiness ONLY fetches receiver face-status and detects stale caller state
  let current = true;
  const fetchedIds = [];
  const stalePair = await h.loadPairFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: receiverA,
    fetchFaceStatus: async (id) => {
      fetchedIds.push(id);
      if (id === receiverA) current = false;
      return receiverReady;
    },
    stillCurrent: () => current,
  });
  assert.deepEqual(fetchedIds, [receiverA]);
  assert.equal(stalePair.stale, true);
});

test('F3 & F4: Sender shows QR on Face deliveries while Receiver strictly uses Face with BE-only verification', () => {
  const receiverId = '66666666-6666-4666-8666-666666666666';
  const authReceiverStepId = '77777777-7777-4777-8777-777777777777';
  const authSenderStep = {
    jobStepId: stepId,
    stepCodeSnapshot: 'AUTH_SENDER',
    stepTypeSnapshot: 'AUTHENTICATE',
    status: 'RUNNING',
    resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_SENDER' },
    resultJson: {
      action: 'AWAIT_STAFF_VERIFICATION',
      job_step_id: stepId,
      expires_at: '2026-11-19T12:02:00Z',
    },
  };
  const authReceiverStep = {
    jobStepId: authReceiverStepId,
    stepCodeSnapshot: 'AUTH_RECEIVER',
    stepTypeSnapshot: 'AUTHENTICATE',
    status: 'PENDING',
    resolvedInputsJson: { method: 'FACE_VERIFICATION', purpose: 'DELIVERY_RECEIVER' },
    resultJson: {
      action: 'AWAIT_FACE_VERIFICATION',
      job_step_id: authReceiverStepId,
      expires_at: '2026-11-19T12:02:00Z',
    },
  };
  const senderLegFaceJob = {
    jobId,
    status: 'RUNNING',
    selectedJobStepId: stepId,
    schemaVersion: 3,
    beOrchestrated: true,
    serviceRequestId: requestId,
    inputJson: {
      authentication_method: 'FACE_VERIFICATION',
      expected_sender_account_id: actor,
      expected_receiver_account_id: receiverId,
    },
    steps: [authSenderStep, authReceiverStep],
  };
  const receiverLegFaceJob = {
    jobId,
    status: 'RUNNING',
    selectedJobStepId: authReceiverStepId,
    schemaVersion: 3,
    beOrchestrated: true,
    serviceRequestId: requestId,
    inputJson: {
      authentication_method: 'FACE_VERIFICATION',
      expected_sender_account_id: actor,
      expected_receiver_account_id: receiverId,
    },
    steps: [
      {
        ...authSenderStep,
        status: 'SUCCEEDED',
        resultJson: { verified: true, purpose: 'DELIVERY_SENDER', actor_account_id: actor },
      },
      { ...authReceiverStep, status: 'RUNNING' },
    ],
  };
  const faceDelivery = {
    request: { serviceRequestId: requestId, requestType: 'DELIVERY', status: 'RUNNING' },
    expectedSenderAccountId: actor,
    expectedReceiverAccountId: receiverId,
    recipientName: 'ĐD. Lê Thị B',
    authenticationMethod: 'FACE_VERIFICATION',
  };

  // Hybrid step inference without inputJson/delivery still recognizes FACE_VERIFICATION job
  assert.equal(
    h.jobAuthenticationMethod({
      ...senderLegFaceJob,
      inputJson: { expected_sender_account_id: actor, expected_receiver_account_id: receiverId },
    }),
    'FACE_VERIFICATION',
  );

  // At AUTH_SENDER on a Face job: Sender gets QR scanContext, NOT Face context
  assert.deepEqual(h.scanContext(senderLegFaceJob, actor, faceDelivery), {
    jobId,
    stepId,
    purpose: 'DELIVERY_SENDER',
    accountId: actor,
  });
  assert.equal(h.scanContext(senderLegFaceJob, receiverId, faceDelivery), undefined);
  assert.equal(h.faceAuthContext(senderLegFaceJob, actor, faceDelivery), undefined);
  assert.equal(h.isCurrentStepFaceStage(senderLegFaceJob, faceDelivery), false);
  assert.equal(
    h.evaluateFaceAuthRuntimeState({
      job: senderLegFaceJob,
      delivery: faceDelivery,
      currentAccountId: actor,
    }).stage,
    'NOT_FACE_JOB',
  );

  // F3: At AUTH_RECEIVER on a Face job: scanContext MUST stay undefined (zero QR fallback); faceAuthContext binds strictly to receiver
  assert.equal(h.scanContext(receiverLegFaceJob, receiverId, faceDelivery), undefined);
  assert.equal(h.scanContext(receiverLegFaceJob, actor, faceDelivery), undefined);
  assert.equal(h.faceAuthContext(receiverLegFaceJob, actor, faceDelivery), undefined);
  assert.equal(h.isCurrentStepFaceStage(receiverLegFaceJob, faceDelivery), true);
  assert.deepEqual(h.faceAuthContext(receiverLegFaceJob, receiverId, faceDelivery), {
    jobId,
    stepId: authReceiverStepId,
    purpose: 'DELIVERY_RECEIVER',
    phase: 'receiver',
    accountId: receiverId,
    expiresAt: '2026-11-19T12:02:00Z',
  });

  // F4: While RUNNING or NO_MATCH at receiver leg, isAuthStepCompleted MUST remain false
  assert.equal(
    h.isAuthStepCompleted(receiverLegFaceJob, authReceiverStepId, 'DELIVERY_RECEIVER', 'FACE_VERIFICATION', receiverId),
    false,
  );
  const awaiting = h.evaluateFaceAuthRuntimeState({
    job: receiverLegFaceJob,
    delivery: faceDelivery,
    currentAccountId: receiverId,
    trackedAuthStepId: authReceiverStepId,
    trackedPurpose: 'DELIVERY_RECEIVER',
    nowMs: Date.parse('2026-11-19T12:00:30Z'),
  });
  assert.equal(awaiting.stage, 'AWAITING_CAMERA_SCAN');
  assert.equal(awaiting.remainingSeconds, 90);
  assert.equal(h.scanContext(receiverLegFaceJob, receiverId, faceDelivery), undefined);

  // Mismatch (NO_MATCH) stays FACE_VERIFICATION with clear message & zero QR fallback
  const mismatchJob = {
    ...receiverLegFaceJob,
    steps: [
      receiverLegFaceJob.steps[0],
      {
        ...authReceiverStep,
        status: 'RUNNING',
        resultJson: { ...authReceiverStep.resultJson, verified: false, reason: 'NO_MATCH' },
      },
    ],
  };
  const mismatchState = h.evaluateFaceAuthRuntimeState({
    job: mismatchJob,
    delivery: faceDelivery,
    currentAccountId: receiverId,
    nowMs: Date.parse('2026-11-19T12:00:40Z'),
  });
  assert.equal(mismatchState.stage, 'MISMATCH');
  assert.match(mismatchState.message, /không tự chuyển sang QR/);
  assert.equal(h.scanContext(mismatchJob, receiverId, faceDelivery), undefined);

  // Expired window stays non-verified and keeps Face method for receiver
  const expiredState = h.evaluateFaceAuthRuntimeState({
    job: {
      ...receiverLegFaceJob,
      status: 'FAILED',
      errorCode: 'FACE_SESSION_EXPIRED_OR_CHANGED',
      steps: [receiverLegFaceJob.steps[0], { ...authReceiverStep, status: 'FAILED' }],
    },
    delivery: faceDelivery,
    currentAccountId: receiverId,
    nowMs: Date.parse('2026-11-19T12:03:00Z'),
  });
  assert.equal(expiredState.stage, 'EXPIRED');
  assert.equal(
    h.isAuthStepCompleted(
      { ...receiverLegFaceJob, steps: [receiverLegFaceJob.steps[0], { ...authReceiverStep, status: 'FAILED' }] },
      authReceiverStepId,
      'DELIVERY_RECEIVER',
      'FACE_VERIFICATION',
      receiverId,
    ),
    false,
  );

  // Only BE SUCCEEDED result on receiver grants VERIFIED
  const succeededJob = {
    ...receiverLegFaceJob,
    selectedJobStepId: 'unlock-receiver-step',
    steps: [
      receiverLegFaceJob.steps[0],
      {
        ...authReceiverStep,
        status: 'SUCCEEDED',
        resultJson: {
          verified: true,
          purpose: 'DELIVERY_RECEIVER',
          actor_account_id: receiverId,
        },
      },
      { jobStepId: 'unlock-receiver-step', stepCodeSnapshot: 'UNLOCK_RECEIVER', stepTypeSnapshot: 'CONTROL_HARDWARE', status: 'RUNNING' },
    ],
  };
  assert.equal(
    h.isAuthStepCompleted(succeededJob, authReceiverStepId, 'DELIVERY_RECEIVER', 'FACE_VERIFICATION', receiverId),
    true,
  );
  assert.equal(
    h.evaluateFaceAuthRuntimeState({
      job: succeededJob,
      delivery: faceDelivery,
      currentAccountId: receiverId,
      trackedAuthStepId: authReceiverStepId,
      trackedPurpose: 'DELIVERY_RECEIVER',
    }).stage,
    'VERIFIED',
  );

  // UI & Modal static guards: FaceScanModal has no 2200ms timer or confirm simulation; MissionScreen enforces policy & hybrid sender QR / receiver Face
  const faceModalSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/scanning/FaceScanModal.tsx'), 'utf8');
  assert.equal(faceModalSrc.includes('2200'), false);
  assert.equal(faceModalSrc.includes('useCameraPermissions'), false);
  assert.equal(faceModalSrc.includes('dispatchApi.getJobDetail'), true);
  assert.equal(faceModalSrc.includes('isAuthStepCompleted'), true);
  assert.equal(faceModalSrc.includes('evaluateFaceAuthRuntimeState'), true);

  const missionSrc = fs.readFileSync(path.resolve(__dirname, '../src/screens/main/MissionScreen.tsx'), 'utf8');
  assert.equal(missionSrc.includes('setFaceVerified'), false);
  assert.equal(/const\s+\[\s*faceVerified\b/.test(missionSrc), false);
  assert.equal(missionSrc.includes('staffApi.getFaceStatus'), true);
  assert.equal(missionSrc.includes('authenticationMethod: targetMethod'), true);
  assert.equal(missionSrc.includes("sensitive: targetMethod === 'FACE_VERIFICATION'"), true);
  assert.equal(missionSrc.includes('isCurrentStepFaceStage'), true);
  assert.equal(missionSrc.includes('{scan && ('), true);
  assert.equal(missionSrc.includes('{qrContext && ('), true);
});

test('F5 & F6: Sender face auth never unlocks Receiver step, and PAYLOAD -> DOOR_CLOSED -> LOCK_CHECKED run in strict order', () => {
  const receiverId = '66666666-6666-4666-8666-666666666666';
  const authSenderStepId = '10000000-0000-4000-8000-000000000001';
  const payloadSenderStepId = '10000000-0000-4000-8000-000000000002';
  const closeSenderStepId = '10000000-0000-4000-8000-000000000003';
  const verifySenderStepId = '10000000-0000-4000-8000-000000000004';
  const authReceiverStepId = '10000000-0000-4000-8000-000000000005';
  const payloadReceiverStepId = '10000000-0000-4000-8000-000000000006';
  const closeReceiverStepId = '10000000-0000-4000-8000-000000000007';
  const verifyReceiverStepId = '10000000-0000-4000-8000-000000000008';
  const items = [{ item_code: 'ITEM-01', quantity: 2 }];

  const delivery = {
    request: { serviceRequestId: requestId, requestType: 'DELIVERY', status: 'IN_PROGRESS' },
    expectedSenderAccountId: actor,
    expectedReceiverAccountId: receiverId,
    recipientName: 'ĐD. Trần Văn Nhận',
    authenticationMethod: 'FACE_VERIFICATION',
  };

  const makeSteps = (selectedStepId, overrides = {}) => [
    {
      jobStepId: authSenderStepId,
      stepCodeSnapshot: 'AUTH_SENDER',
      stepTypeSnapshot: 'AUTHENTICATE',
      status: 'SUCCEEDED',
      resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_SENDER' },
      resultJson: { verified: true, purpose: 'DELIVERY_SENDER', actor_account_id: actor },
      ...overrides[authSenderStepId],
    },
    {
      jobStepId: payloadSenderStepId,
      stepCodeSnapshot: 'PAYLOAD_SENDER',
      stepTypeSnapshot: 'HANDLE_PAYLOAD',
      status: 'PENDING',
      resolvedInputsJson: { action: 'LOAD', items },
      ...overrides[payloadSenderStepId],
    },
    {
      jobStepId: closeSenderStepId,
      stepCodeSnapshot: 'CLOSE_SENDER',
      stepTypeSnapshot: 'INTERACT',
      status: 'PENDING',
      resolvedInputsJson: { prompt_key: 'CLOSE_SENDER' },
      ...overrides[closeSenderStepId],
    },
    {
      jobStepId: verifySenderStepId,
      stepCodeSnapshot: 'VERIFY_SENDER',
      stepTypeSnapshot: 'INTERACT',
      status: 'PENDING',
      resolvedInputsJson: { prompt_key: 'VERIFY_SENDER' },
      ...overrides[verifySenderStepId],
    },
    {
      jobStepId: authReceiverStepId,
      stepCodeSnapshot: 'AUTH_RECEIVER',
      stepTypeSnapshot: 'AUTHENTICATE',
      status: 'PENDING',
      resolvedInputsJson: { method: 'FACE_VERIFICATION', purpose: 'DELIVERY_RECEIVER' },
      ...overrides[authReceiverStepId],
    },
    {
      jobStepId: payloadReceiverStepId,
      stepCodeSnapshot: 'PAYLOAD_RECEIVER',
      stepTypeSnapshot: 'HANDLE_PAYLOAD',
      status: 'PENDING',
      resolvedInputsJson: { action: 'UNLOAD', items },
      ...overrides[payloadReceiverStepId],
    },
    {
      jobStepId: closeReceiverStepId,
      stepCodeSnapshot: 'CLOSE_RECEIVER',
      stepTypeSnapshot: 'INTERACT',
      status: 'PENDING',
      resolvedInputsJson: { prompt_key: 'CLOSE_RECEIVER' },
      ...overrides[closeReceiverStepId],
    },
    {
      jobStepId: verifyReceiverStepId,
      stepCodeSnapshot: 'VERIFY_RECEIVER',
      stepTypeSnapshot: 'INTERACT',
      status: 'PENDING',
      resolvedInputsJson: { prompt_key: 'VERIFY_RECEIVER' },
      ...overrides[verifyReceiverStepId],
    },
  ];

  const baseFaceJob = (selectedStepId, overrides) => ({
    jobId,
    status: 'RUNNING',
    selectedJobStepId: selectedStepId,
    schemaVersion: 3,
    beOrchestrated: true,
    serviceRequestId: requestId,
    inputJson: {
      authentication_method: 'FACE_VERIFICATION',
      expected_sender_account_id: actor,
      expected_receiver_account_id: receiverId,
    },
    steps: makeSteps(selectedStepId, overrides),
  });

  // F5: Completed AUTH_SENDER NEVER satisfies AUTH_RECEIVER; at AUTH_RECEIVER only receiver can auth
  const atReceiverAuth = baseFaceJob(authReceiverStepId, {
    [authReceiverStepId]: { status: 'RUNNING' },
  });
  assert.equal(h.isAuthStepCompleted(atReceiverAuth, authSenderStepId, 'DELIVERY_RECEIVER', 'FACE_VERIFICATION', actor), false);
  assert.equal(h.isAuthStepCompleted(atReceiverAuth, authReceiverStepId, 'DELIVERY_RECEIVER', 'FACE_VERIFICATION', actor), false);
  assert.equal(h.faceAuthContext(atReceiverAuth, actor, delivery), undefined);
  assert.equal(h.scanContext(atReceiverAuth, receiverId, delivery), undefined);
  assert.deepEqual(h.faceAuthContext(atReceiverAuth, receiverId, delivery), {
    jobId,
    stepId: authReceiverStepId,
    purpose: 'DELIVERY_RECEIVER',
    phase: 'receiver',
    accountId: receiverId,
    expiresAt: undefined,
  });
  const senderViewingReceiverStep = h.evaluateFaceAuthRuntimeState({
    job: atReceiverAuth,
    delivery,
    currentAccountId: actor,
  });
  assert.equal(senderViewingReceiverStep.stage, 'WAITING_OTHER_STAFF');
  assert.equal(senderViewingReceiverStep.myTurn, false);

  // F6: Both sender and receiver handoff steps produce exact sequential PAYLOAD_CONFIRMED -> DOOR_CLOSED -> LOCK_CHECKED responses with deterministic Idempotency-Keys
  for (const [stepKey, expectedAccount, otherAccount, expectedType] of [
    [payloadSenderStepId, actor, receiverId, 'PAYLOAD_CONFIRMED'],
    [closeSenderStepId, actor, receiverId, 'DOOR_CLOSED'],
    [verifySenderStepId, actor, receiverId, 'LOCK_CHECKED'],
    [payloadReceiverStepId, receiverId, actor, 'PAYLOAD_CONFIRMED'],
    [closeReceiverStepId, receiverId, actor, 'DOOR_CLOSED'],
    [verifyReceiverStepId, receiverId, actor, 'LOCK_CHECKED'],
  ]) {
    const currentJob = baseFaceJob(stepKey, {
      [stepKey]: { status: 'RUNNING' },
      [authReceiverStepId]: stepKey.endsWith('5') ? { status: 'RUNNING' } : { status: 'SUCCEEDED', resultJson: { verified: true, purpose: 'DELIVERY_RECEIVER', actor_account_id: receiverId } },
    });
    const running = h.selectedRunningStep(currentJob);
    assert.ok(running);
    assert.equal(h.expectedDeliveryAccount(currentJob, h.deliveryPhase(running), delivery), expectedAccount);
    assert.notEqual(h.expectedDeliveryAccount(currentJob, h.deliveryPhase(running), delivery), otherAccount);
    const resp = h.handoffResponse(running);
    assert.equal(resp?.responseType, expectedType);
    const idemKey = h.handoffResponseKey(running.jobStepId, expectedAccount, expectedType);
    assert.equal(idemKey, `delivery:${stepKey}:${expectedAccount}:${expectedType}`);
  }
});

// =====================================================================
// Staff Avatar Upload for Face Verification Delivery (A1 - A5)
// =====================================================================

function loadSrc(relPath, imports = {}) {
  const filename = path.resolve(__dirname, '..', relPath);
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', js)(
    (key) => imports[key] ?? require(key),
    module,
    module.exports
  );
  return module.exports;
}

const avatar = loadSrc('src/components/common/staffAvatarUpload.ts');
const endpointsMod = loadSrc('src/api/endpoints.ts');

test('A1: ApiClient sends multipart FormData without Content-Type JSON override, keeps Bearer + 401 refresh, and appends field `file`', async () => {
  class MockFormData {
    constructor() {
      this._parts = [];
    }
    append(name, value, fileName) {
      this._parts.push([name, value, fileName]);
    }
  }

  const { ApiClient, isMultipartFormData } = loadSrc('src/api/client.ts', {
    './config': { API_CONFIG: { BASE_URL: 'https://api.example.test/api/v1', TIMEOUT_MS: 5000 } },
  });
  const staffApiCalls = [];
  const { staffApi } = loadSrc('src/api/modules/staff.api.ts', {
    '../client': {
      apiClient: {
        get: (ep) => { staffApiCalls.push(['GET', ep]); return Promise.resolve({}); },
        post: (ep, body) => { staffApiCalls.push(['POST', ep, body]); return Promise.resolve({}); },
        postMultipart: (ep, fd) => { staffApiCalls.push(['POST_MULTIPART', ep, fd]); return Promise.resolve({ staffProfile: { url: 'https://s3.test/a.jpg', faceStatus: 'PENDING' } }); },
        delete: (ep) => { staffApiCalls.push(['DELETE', ep]); return Promise.resolve({}); },
      },
    },
    '../endpoints': endpointsMod,
  });

  // buildAvatarUploadFormData appends under `file` for both RN asset and Web File
  const rnFd = avatar.buildAvatarUploadFormData(
    {
      uri: 'file:///tmp/face_photo.jpeg',
      fileName: 'face_photo.png',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      headerBytes: [0xff, 0xd8, 0xff, 0xe0],
    },
    MockFormData
  );
  assert.equal(rnFd.validation.valid, true);
  assert.equal(rnFd.validation.normalizedMimeType, 'image/jpeg');
  assert.equal(rnFd.validation.normalizedFileName, 'face_photo.jpg');
  assert.equal(rnFd.formData._parts.length, 1);
  assert.equal(rnFd.formData._parts[0][0], 'file');
  assert.deepEqual(rnFd.formData._parts[0][1], {
    uri: 'file:///tmp/face_photo.jpeg',
    name: 'face_photo.jpg',
    type: 'image/jpeg',
  });
  assert.equal(isMultipartFormData(rnFd.formData), true);

  const webFileObj = { name: 'raw.webp', type: 'image/webp', size: 2048, slice: () => webFileObj };
  const webFd = avatar.buildAvatarUploadFormData(
    {
      uri: 'blob:http://localhost/1',
      fileName: 'raw.webp',
      mimeType: 'image/webp',
      fileSize: 2048,
      headerBytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      webFile: webFileObj,
    },
    MockFormData
  );
  assert.equal(webFd.formData._parts[0][0], 'file');
  assert.equal(webFd.formData._parts[0][1], webFileObj);
  assert.equal(webFd.formData._parts[0][2], 'raw.webp');

  await staffApi.uploadMyAvatar(rnFd.formData);
  assert.equal(staffApiCalls[0][0], 'POST_MULTIPART');
  assert.equal(staffApiCalls[0][1], '/staff/me/avatar');
  assert.equal(staffApiCalls[0][2], rnFd.formData);

  const client = new ApiClient();
  client.setSession('jwt-access-1', 'jwt-refresh-1');
  const seenRequests = [];
  const origFetch = globalThis.fetch;
  try {
    let uploadAttempt = 0;
    globalThis.fetch = async (url, init) => {
      seenRequests.push({ url, method: init.method, headers: init.headers, body: init.body });
      if (url.endsWith('/auth/refresh')) {
        return { ok: true, status: 200, json: async () => ({ accessToken: 'jwt-access-2', refreshToken: 'jwt-refresh-2' }) };
      }
      if (url.endsWith('/staff/me/avatar')) {
        uploadAttempt += 1;
        if (uploadAttempt === 1) {
          return { ok: false, status: 401, json: async () => ({ message: 'Token expired' }) };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ account: { accountId: actor }, staffProfile: { url: 'https://cdn.example/new.jpg', faceStatus: 'PENDING', faceAvatarVersion: 'rev-1' } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ ok: true }) };
    };

    const res = await client.postMultipart('/staff/me/avatar', rnFd.formData, {
      'Content-Type': 'multipart/form-data; should-be-stripped',
      'X-Client': 'StaffApp',
    });
    assert.equal(res.staffProfile.faceAvatarVersion, 'rev-1');

    // Also test generic post(url, FormData) + normal JSON post(url, object)
    await client.post('/staff/me/avatar', rnFd.formData);
    await client.post('/delivery-requests', { authenticationMethod: 'FACE_VERIFICATION' });

    const multipartAttempt1 = seenRequests[0];
    const refreshCall = seenRequests[1];
    const multipartAttempt2 = seenRequests[2];
    const genericMultipartCall = seenRequests[3];
    const jsonCall = seenRequests[4];

    assert.equal(multipartAttempt1.headers['Content-Type'], undefined);
    assert.equal(multipartAttempt1.headers['content-type'], undefined);
    assert.equal(multipartAttempt1.headers['Authorization'], 'Bearer jwt-access-1');
    assert.equal(multipartAttempt1.headers['X-Client'], 'StaffApp');
    assert.equal(multipartAttempt1.body, rnFd.formData);

    assert.equal(refreshCall.headers['Content-Type'], 'application/json');
    assert.equal(multipartAttempt2.headers['Authorization'], 'Bearer jwt-access-2');
    assert.equal(multipartAttempt2.headers['Content-Type'], undefined);
    assert.equal(multipartAttempt2.body, rnFd.formData);

    assert.equal(genericMultipartCall.headers['Content-Type'], undefined);
    assert.equal(genericMultipartCall.body, rnFd.formData);

    assert.equal(jsonCall.headers['Content-Type'], 'application/json');
    assert.equal(jsonCall.body, JSON.stringify({ authenticationMethod: 'FACE_VERIFICATION' }));
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('A2: Avatar validation checks JPG/PNG/WebP magic bytes, 2 MiB max size, 0-byte, and aspect-preserving dimensions', () => {
  const jpegBytes = [0xff, 0xd8, 0xff, 0xe1];
  const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const webpBytes = [0x52, 0x49, 0x46, 0x46, 0x12, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
  const gifBytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a

  // Exact 2 MiB boundary passes
  assert.equal(
    avatar.validateSelectedAvatarAsset({
      uri: 'file:///tmp/ok.png',
      fileName: 'ok.png',
      mimeType: 'image/png',
      fileSize: avatar.FACE_AVATAR_MAX_BYTES,
      headerBytes: pngBytes,
      width: 1000,
      height: 1200,
    }).valid,
    true
  );

  // WebP passes & extension normalized when missing
  const webpOk = avatar.validateSelectedAvatarAsset({
    uri: 'file:///tmp/avatar',
    mimeType: 'image/webp',
    fileSize: 500_000,
    headerBytes: webpBytes,
  });
  assert.equal(webpOk.valid, true);
  assert.equal(webpOk.normalizedFileName, 'avatar.webp');

  // > 2 MiB rejected with compression hint
  const tooLarge = avatar.validateSelectedAvatarAsset({
    uri: 'file:///tmp/big.jpg',
    fileName: 'big.jpg',
    mimeType: 'image/jpeg',
    fileSize: avatar.FACE_AVATAR_MAX_BYTES + 1,
    headerBytes: jpegBytes,
  });
  assert.equal(tooLarge.valid, false);
  assert.equal(tooLarge.errorCode, 'FILE_TOO_LARGE');
  assert.equal(tooLarge.needsCompression, true);

  // 0-byte and empty URI rejected
  assert.equal(avatar.validateSelectedAvatarAsset({ uri: 'file:///tmp/empty.jpg', fileSize: 0 }).errorCode, 'EMPTY_FILE');
  assert.equal(avatar.validateSelectedAvatarAsset({ uri: '' }).errorCode, 'EMPTY_FILE');

  // Unsupported MIME / extension rejected
  assert.equal(avatar.validateSelectedAvatarAsset({ uri: 'file:///tmp/a.gif', fileName: 'a.gif', mimeType: 'image/gif', fileSize: 100 }).errorCode, 'UNSUPPORTED_FORMAT');
  assert.equal(avatar.validateSelectedAvatarAsset({ uri: 'file:///tmp/a.heic', fileName: 'a.heic', mimeType: 'image/heic', fileSize: 100 }).errorCode, 'UNSUPPORTED_FORMAT');
  assert.equal(avatar.validateSelectedAvatarAsset({ uri: 'file:///tmp/doc.pdf', fileName: 'doc.pdf', mimeType: 'application/pdf', fileSize: 100 }).errorCode, 'UNSUPPORTED_FORMAT');

  // Magic-byte spoofing / mismatch rejected
  assert.equal(
    avatar.validateSelectedAvatarAsset({
      uri: 'file:///tmp/fake.jpg',
      fileName: 'fake.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      headerBytes: pngBytes,
    }).errorCode,
    'UNSUPPORTED_FORMAT'
  );
  assert.equal(
    avatar.validateSelectedAvatarAsset({
      uri: 'file:///tmp/gif_as_jpg.jpg',
      fileName: 'gif_as_jpg.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
      headerBytes: gifBytes,
    }).errorCode,
    'UNSUPPORTED_FORMAT'
  );

  // Aspect-preserving resize math
  const landscape = avatar.computeAspectPreservingDimensions(4000, 3000, 1280);
  assert.equal(landscape.width, 1280);
  assert.equal(landscape.height, 960);
  assert.ok(Math.abs(landscape.width / landscape.height - 4000 / 3000) < 0.01);

  const portrait = avatar.computeAspectPreservingDimensions(1500, 3000, 1280);
  assert.equal(portrait.width, 640);
  assert.equal(portrait.height, 1280);

  const small = avatar.computeAspectPreservingDimensions(800, 600, 1280);
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);
  assert.equal(small.scale, 1);
});

test('A3: Duplicate upload lock, cancel without API call, network error, and lost-response recovery via /staff/me', async () => {
  class FakeFormData {
    constructor() { this._parts = []; }
    append(k, v) { this._parts.push([k, v]); }
  }
  const validCandidate = {
    uri: 'file:///tmp/selfie.jpg',
    fileName: 'selfie.jpg',
    mimeType: 'image/jpeg',
    fileSize: 150_000,
    headerBytes: [0xff, 0xd8, 0xff],
  };

  // Duplicate tap blocked cleanly
  let uploadCalls = 0;
  const locked = await avatar.executeStaffAvatarUpload({
    candidate: validCandidate,
    inFlightLock: { current: true },
    uploadAvatar: async () => { uploadCalls += 1; return {}; },
    refreshStaffMe: async () => null,
    fetchFaceStatus: async () => null,
    isCurrentScope: () => true,
    FormDataCtor: FakeFormData,
  });
  assert.equal(locked.ok, false);
  assert.equal(locked.kind, 'IN_FLIGHT');
  assert.equal(uploadCalls, 0);

  // Cancelled / empty candidate never hits BE
  const empty = await avatar.executeStaffAvatarUpload({
    candidate: null,
    inFlightLock: { current: false },
    uploadAvatar: async () => { uploadCalls += 1; return {}; },
    refreshStaffMe: async () => null,
    fetchFaceStatus: async () => null,
    isCurrentScope: () => true,
    FormDataCtor: FakeFormData,
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.kind, 'VALIDATION_ERROR');
  assert.equal(uploadCalls, 0);

  // Timeout with unchanged profile returns TIMEOUT and releases lock
  const lock1 = { current: false };
  const timeoutOutcome = await avatar.executeStaffAvatarUpload({
    candidate: validCandidate,
    previousProfile: { url: 'https://s3/old.jpg', faceAvatarVersion: 'ver-old', faceStatus: 'READY' },
    inFlightLock: lock1,
    uploadAvatar: async () => { throw { status: 408, message: 'Timeout' }; },
    refreshStaffMe: async () => ({
      account: { accountId: actor },
      staffProfile: { url: 'https://s3/old.jpg', faceAvatarVersion: 'ver-old', faceStatus: 'READY' },
    }),
    fetchFaceStatus: async () => null,
    isCurrentScope: () => true,
    FormDataCtor: FakeFormData,
  });
  assert.equal(timeoutOutcome.ok, false);
  assert.equal(timeoutOutcome.kind, 'TIMEOUT');
  assert.equal(lock1.current, false);

  // Lost-response recovery: POST threw status 0, but /staff/me shows new faceAvatarVersion + /face-status confirms PENDING
  const lock2 = { current: false };
  const recovered = await avatar.executeStaffAvatarUpload({
    candidate: validCandidate,
    previousProfile: { url: 'https://s3/old.jpg', faceAvatarVersion: 'ver-old', faceStatus: 'READY' },
    inFlightLock: lock2,
    uploadAvatar: async () => { throw { status: 0, message: 'Connection reset' }; },
    refreshStaffMe: async () => ({
      account: { accountId: actor },
      staffProfile: { url: 'https://s3/new.jpg', faceAvatarVersion: 'ver-new-uuid', faceStatus: 'PENDING' },
    }),
    fetchFaceStatus: async () => ({
      accountId: actor,
      avatarUrl: 'https://s3/new.jpg',
      avatarVersion: 'ver-new-uuid',
      status: 'PENDING',
      enabled: true,
      ready: false,
      templatePresent: false,
    }),
    isCurrentScope: () => true,
    FormDataCtor: FakeFormData,
  });
  assert.equal(recovered.ok, true);
  assert.equal(recovered.kind, 'UPLOADED');
  assert.equal(recovered.recoveredFromLostResponse, true);
  assert.equal(recovered.statusDisplay?.badgeLabel, 'Chờ duyệt');
  assert.equal(lock2.current, false);

  // 403 forbidden
  const lock3 = { current: false };
  const forbidden = await avatar.executeStaffAvatarUpload({
    candidate: validCandidate,
    inFlightLock: lock3,
    uploadAvatar: async () => { throw { status: 403, message: 'Forbidden' }; },
    refreshStaffMe: async () => null,
    fetchFaceStatus: async () => null,
    isCurrentScope: () => true,
    FormDataCtor: FakeFormData,
  });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.kind, 'FORBIDDEN');
  assert.equal(lock3.current, false);
});

test('A4: Stale scope (account or server change mid-upload/refresh) ignores late responses safely', async () => {
  class FakeFormData {
    constructor() { this._parts = []; }
    append(k, v) { this._parts.push([k, v]); }
  }
  const candidate = {
    uri: 'file:///tmp/face.png',
    fileName: 'face.png',
    mimeType: 'image/png',
    fileSize: 80_000,
    headerBytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  };

  let active = true;
  let refreshCalled = false;
  const lock1 = { current: false };
  const midUploadStale = await avatar.executeStaffAvatarUpload({
    candidate,
    inFlightLock: lock1,
    uploadAvatar: async () => {
      active = false; // User logged out or switched server while uploading
      return { account: { accountId: actor }, staffProfile: { url: 'https://s3/x.png', faceStatus: 'PENDING' } };
    },
    refreshStaffMe: async () => { refreshCalled = true; return null; },
    fetchFaceStatus: async () => null,
    isCurrentScope: () => active,
    FormDataCtor: FakeFormData,
  });
  assert.equal(midUploadStale.ok, false);
  assert.equal(midUploadStale.kind, 'STALE_SCOPE');
  assert.equal(midUploadStale.ignored, true);
  assert.equal(refreshCalled, false);
  assert.equal(lock1.current, false);

  // Store-level stale scope check in useStaffProfileStore.refreshFaceStatus
  const authState = { user: { accountId: actor }, token: 'tok-user-A' };
  const storeAuth = {
    getState: () => authState,
    setState: (patch) => Object.assign(authState, patch),
  };
  let resolveSlowFaceStatus;
  const slowFacePromise = new Promise((res) => { resolveSlowFaceStatus = res; });
  const zustandPkg = require('zustand');
  const { useStaffProfileStore } = loadSrc('src/store/useStaffProfileStore.ts', {
    zustand: zustandPkg,
    '../api/client': { apiClient: { getBaseUrl: () => 'https://prod.example/api/v1' } },
    '../api/modules/staff.api': {
      staffApi: {
        getStaffMe: async () => ({ account: authState.user, staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/a.png', faceStatus: 'PENDING' } }),
        getAllStaffShifts: async () => [],
        getFaceStatus: async () => slowFacePromise,
      },
    },
    './useAuthStore': { useAuthStore: storeAuth },
  });

  useStaffProfileStore.setState({
    scopeKey: 'https://prod.example/api/v1::' + actor + '::tok-user-A',
    staffMe: { account: { accountId: actor }, staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/a.png', faceStatus: 'PENDING' } },
    faceStatus: null,
  });
  const pendingRefresh = useStaffProfileStore.getState().refreshFaceStatus();
  // Switch account before server replies
  authState.user = { accountId: other };
  authState.token = 'tok-user-B';
  resolveSlowFaceStatus({ accountId: actor, status: 'READY', enabled: true, ready: true, avatarVersion: 'v-old', avatarUrl: 'https://s3/a.png' });
  const staleStoreResult = await pendingRefresh;
  assert.equal(staleStoreResult, null);
  assert.equal(useStaffProfileStore.getState().faceStatus, null);
});

test('A5: Post-upload BE status rendering, cache sync with MissionScreen readiness, and StaffHeader wiring invariants', () => {
  const missing = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    staffProfile: { staffProfileId: 'sp-1', url: null, faceStatus: 'MISSING', faceAvatarVersion: null },
    faceStatus: { accountId: actor, status: 'MISSING', enabled: true, ready: false, avatarUrl: null, avatarVersion: null },
  });
  assert.equal(missing.badgeLabel, 'Chưa có ảnh');
  assert.equal(missing.isReadyForFaceDelivery, false);

  const pending = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/a.jpg', faceStatus: 'PENDING', faceAvatarVersion: 'rev-1111' },
    faceStatus: { accountId: actor, status: 'PENDING', enabled: true, ready: false, avatarUrl: 'https://s3/a.jpg', avatarVersion: 'rev-1111' },
  });
  assert.equal(pending.badgeLabel, 'Chờ duyệt');
  assert.equal(pending.needsAdminReview, true);
  assert.equal(pending.isReadyForFaceDelivery, false);
  assert.match(pending.adminReviewGuidance, /quản trị viên.*ADMIN.*face-review/i);

  const ready = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/a.jpg', faceStatus: 'READY', faceAvatarVersion: 'rev-2222' },
    faceStatus: { accountId: actor, status: 'READY', enabled: true, ready: true, avatarUrl: 'https://s3/a.jpg', avatarVersion: 'rev-2222' },
  });
  assert.equal(ready.badgeLabel, 'Sẵn sàng');
  assert.equal(ready.isReadyForFaceDelivery, true);

  const verifyingLocalOnly = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/a.jpg', faceStatus: 'READY', faceAvatarVersion: 'rev-2222' },
    faceStatus: null,
  });
  assert.equal(verifyingLocalOnly.badgeLabel, 'Đang xác minh');
  assert.equal(verifyingLocalOnly.isReadyForFaceDelivery, false);

  const invalid = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    faceStatus: { accountId: actor, status: 'INVALID', enabled: true, ready: false, avatarUrl: 'https://s3/bad.jpg', avatarVersion: 'rev-3' },
  });
  assert.equal(invalid.badgeLabel, 'Ảnh không đạt');
  assert.equal(invalid.isReadyForFaceDelivery, false);

  const rejected = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    faceStatus: { accountId: actor, status: 'REJECTED', enabled: true, ready: false, avatarUrl: 'https://s3/rej.jpg', avatarVersion: 'rev-4' },
  });
  assert.equal(rejected.badgeLabel, 'Bị từ chối');
  assert.equal(rejected.isReadyForFaceDelivery, false);

  const disabled = avatar.formatOwnFaceEnrollmentStatus({
    accountId: actor,
    faceStatus: { accountId: actor, status: 'READY', enabled: false, ready: false, avatarUrl: 'https://s3/a.jpg', avatarVersion: 'rev-2' },
  });
  assert.equal(disabled.badgeLabel, 'Dịch vụ chưa bật');
  assert.equal(disabled.isReadyForFaceDelivery, false);

  // useStaffProfileStore cache sync + MissionScreen evaluateDeliveryFaceReadiness after upload resets READY -> PENDING
  const authState = { user: { accountId: actor, fullName: 'ĐD. Minh' }, token: 'tok-sync' };
  const { useStaffProfileStore } = loadSrc('src/store/useStaffProfileStore.ts', {
    zustand: require('zustand'),
    '../api/client': { apiClient: { getBaseUrl: () => 'https://prod.example/api/v1' } },
    '../api/modules/staff.api': { staffApi: {} },
    './useAuthStore': { useAuthStore: { getState: () => authState, setState: (p) => Object.assign(authState, p) } },
  });
  const pendingAfterUpload = {
    accountId: actor,
    avatarUrl: 'https://s3/v2.jpg',
    avatarVersion: 'rev-new-002',
    status: 'PENDING',
    enabled: true,
    ready: false,
    templatePresent: false,
  };
  useStaffProfileStore.getState().applyStaffMeUpdate(
    {
      account: { accountId: actor, fullName: 'ĐD. Minh' },
      staffProfile: { staffProfileId: 'sp-1', url: 'https://s3/v2.jpg', faceStatus: 'PENDING', faceAvatarVersion: 'rev-new-002' },
    },
    pendingAfterUpload
  );
  const storeSnap = useStaffProfileStore.getState();
  assert.equal(storeSnap.staffMe?.staffProfile?.faceAvatarVersion, 'rev-new-002');
  assert.equal(storeSnap.faceStatus?.status, 'PENDING');

  // When uploaded staff (`actor`) is RECEIVER, PENDING blocks readiness until Admin approves -> READY;
  // when `actor` (`PENDING`) is SENDER and receiver (`other`) is READY, readiness is true (sender uses QR).
  const senderReady = {
    accountId: other,
    avatarVersion: 'rev-sender-1',
    status: 'MISSING',
    enabled: true,
    ready: false,
    templatePresent: false,
  };
  const receiverReadyOther = {
    accountId: other,
    avatarUrl: 'https://s3/rx.jpg',
    avatarVersion: 'rev-rx-1',
    status: 'READY',
    enabled: true,
    ready: true,
    templatePresent: true,
  };
  const blockedAsReceiver = h.evaluateDeliveryFaceReadiness({
    senderAccountId: other,
    receiverAccountId: actor,
    senderStatus: senderReady,
    receiverStatus: storeSnap.faceStatus,
  });
  assert.equal(blockedAsReceiver.ready, false);

  const readyAsReceiver = h.evaluateDeliveryFaceReadiness({
    senderAccountId: other,
    receiverAccountId: actor,
    senderStatus: senderReady,
    receiverStatus: { ...pendingAfterUpload, status: 'READY', ready: true, templatePresent: true },
  });
  assert.equal(readyAsReceiver.ready, true);

  const readyWhenSenderPending = h.evaluateDeliveryFaceReadiness({
    senderAccountId: actor,
    receiverAccountId: other,
    senderStatus: storeSnap.faceStatus,
    receiverStatus: receiverReadyOther,
  });
  assert.equal(readyWhenSenderPending.ready, true);

  // StaffHeader.tsx wiring invariants: camera permissions, ExpoFile.pickFileAsync, executeStaffAvatarUpload, uploadMyAvatar, NO admin face-review call
  const headerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/common/StaffHeader.tsx'), 'utf8');
  assert.equal(headerSrc.includes('ExpoCamera.requestCameraPermissionsAsync'), true);
  assert.equal(headerSrc.includes('ExpoFile.pickFileAsync'), true);
  assert.equal(headerSrc.includes('executeStaffAvatarUpload'), true);
  assert.equal(headerSrc.includes('staffApi.uploadMyAvatar'), true);
  assert.equal(headerSrc.includes('picked.canceled'), true);
  assert.equal(headerSrc.includes('ADMIN_FACE_REVIEW'), false);
  assert.equal(headerSrc.includes('/face-review'), false);
});

test('A6: Native FormData attaches non-enumerable bytes() for Expo SDK 58 expo/fetch, and ApiClient classifies client/abort errors accurately', async () => {
  class MockExpoFormData {
    constructor() {
      this._parts = [];
    }
    append(name, value, fileName) {
      this._parts.push([name, value, fileName]);
    }
    *entries() {
      for (const pair of this._parts) {
        yield [pair[0], pair[1]];
      }
    }
  }

  const { convertFormDataAsync } = loadSrc('node_modules/expo/build/winter/fetch/convertFormData.js', {
    '../../utils/blobUtils': {
      blobToArrayBufferAsync: async (blob) => blob.arrayBuffer(),
    },
  });

  // 1. Reproduce iOS bug: legacy { uri, name, type } without readBytes throws Unsupported FormDataPart implementation
  const legacyFd = avatar.buildAvatarUploadFormData(
    {
      uri: 'file:///var/mobile/Containers/Data/Application/123/tmp/staff-camera.jpg',
      fileName: 'staff-camera.jpg',
      mimeType: 'image/jpeg',
      fileSize: 10,
      headerBytes: [0xff, 0xd8, 0xff, 0xe0],
    },
    MockExpoFormData
  );
  await assert.rejects(
    () => convertFormDataAsync(legacyFd.formData),
    /Unsupported FormDataPart implementation/
  );

  // 2. With readBytes, Expo convertFormDataAsync succeeds cleanly (including repeated read on 401 retry) and keeps spread clean
  const jpegPayload = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  let bytesReads = 0;
  const fixedFd = avatar.buildAvatarUploadFormData(
    {
      uri: 'file:///var/mobile/Containers/Data/Application/123/tmp/staff-camera.jpg',
      fileName: 'staff-camera.jpg',
      mimeType: 'image/jpeg',
      fileSize: jpegPayload.length,
      headerBytes: jpegPayload.slice(0, 4),
      readBytes: async () => {
        bytesReads += 1;
        return bytesReads === 1 ? jpegPayload : jpegPayload.buffer.slice(0);
      },
    },
    MockExpoFormData
  );

  const part = fixedFd.formData._parts[0][1];
  assert.deepEqual(Object.keys({ ...part }), ['uri', 'name', 'type']);
  assert.equal('bytes' in part, true);

  const encoded1 = await convertFormDataAsync(fixedFd.formData, 'TestBoundary123');
  const encoded2 = await convertFormDataAsync(fixedFd.formData, 'TestBoundary123');
  assert.equal(bytesReads, 2);
  assert.deepEqual(Array.from(encoded1.body), Array.from(encoded2.body));

  const bodyText = Buffer.from(encoded1.body).toString('latin1');
  assert.match(bodyText, /content-disposition: form-data; name="file"; filename="staff-camera\.jpg"/i);
  assert.match(bodyText, /content-type: image\/jpeg/i);
  assert.ok(encoded1.body.length > jpegPayload.length);
  const tailIndex = bodyText.indexOf('\r\n\r\n') + 4;
  assert.deepEqual(Array.from(encoded1.body.slice(tailIndex, tailIndex + jpegPayload.length)), Array.from(jpegPayload));

  // 3. ApiClient maps FormData packaging error -> CLIENT_REQUEST_ERROR and AbortController abort (FetchError name='Error') -> 408
  const { ApiClient } = loadSrc('src/api/client.ts', {
    './config': { API_CONFIG: { BASE_URL: 'https://api.example.test/api/v1', TIMEOUT_MS: 20 } },
  });
  const client = new ApiClient();
  client.setSession('jwt-1', 'ref-1');
  const origFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => {
      throw new Error('Unsupported FormDataPart implementation');
    };
    await assert.rejects(
      () => client.postMultipart('/staff/me/avatar', fixedFd.formData),
      (err) => err && err.status === 0 && err.code === 'CLIENT_REQUEST_ERROR' && /đọc hoặc đóng gói tệp ảnh/.test(err.message)
    );

    globalThis.fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          reject(new Error('fetch failed: The operation was aborted.'));
        });
      });
    await assert.rejects(
      () => client.get('/staff/me'),
      (err) => err && err.status === 408
    );
  } finally {
    globalThis.fetch = origFetch;
  }

  // 4. executeStaffAvatarUpload handles CLIENT_REQUEST_ERROR as VALIDATION_ERROR without claiming network loss or hitting /staff/me
  let refreshCalls = 0;
  const lock = { current: false };
  const clientErrOutcome = await avatar.executeStaffAvatarUpload({
    candidate: {
      uri: 'file:///tmp/photo.jpg',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 10,
      headerBytes: [0xff, 0xd8, 0xff, 0xe0],
      readBytes: async () => jpegPayload,
    },
    inFlightLock: lock,
    uploadAvatar: async () => {
      throw {
        status: 0,
        code: 'CLIENT_REQUEST_ERROR',
        message: 'Không thể đọc hoặc đóng gói tệp ảnh trên thiết bị.',
      };
    },
    refreshStaffMe: async () => {
      refreshCalls += 1;
      return null;
    },
    fetchFaceStatus: async () => null,
    isCurrentScope: () => true,
    FormDataCtor: MockExpoFormData,
  });
  assert.equal(clientErrOutcome.ok, false);
  assert.equal(clientErrOutcome.kind, 'VALIDATION_ERROR');
  assert.equal(refreshCalls, 0);
  assert.equal(lock.current, false);

  // 5. StaffHeader wires readNativeFileBytes / readBytes in both library pick and camera capture
  const headerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/common/StaffHeader.tsx'), 'utf8');
  assert.equal(headerSrc.includes('readNativeFileBytes(pickedFile.uri, pickedFile)'), true);
  assert.equal(headerSrc.includes('readNativeFileBytes(photo.uri)'), true);
});
