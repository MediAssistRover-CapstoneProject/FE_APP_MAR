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
