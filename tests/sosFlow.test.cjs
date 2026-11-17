const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTsModule(relativePath, mocks = {}) {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;
  const mod = { exports: {} };
  const req = (id) => {
    if (Object.prototype.hasOwnProperty.call(mocks, id)) {
      return mocks[id];
    }
    throw new Error(`Unexpected runtime require("${id}") in ${relativePath}`);
  };
  new Function('module', 'exports', 'require', transpiled)(mod, mod.exports, req);
  return mod.exports;
}

const sosDecision = loadTsModule('src/screens/main/sosDecision.ts');
const sosRoute = loadTsModule('src/components/map/sosResponseRoute.ts');

function loadMediaCallModalModule() {
  const noop = () => null;
  const reactStub = {
    __esModule: true,
    default: { createElement: noop },
    createElement: noop,
    useCallback: (fn) => fn,
    useEffect: () => {},
    useRef: (v) => ({ current: v }),
    useState: (v) => [v, () => {}],
  };
  const rnStub = {
    ActivityIndicator: noop,
    Alert: { alert: () => {} },
    Animated: { Value: function Value() {}, View: noop, loop: () => ({ start: () => {}, stop: () => {} }), sequence: () => ({}), timing: () => ({}) },
    Dimensions: { get: () => ({ width: 400, height: 800 }) },
    Modal: noop,
    StyleSheet: { create: (s) => s },
    Text: noop,
    TouchableOpacity: noop,
    View: noop,
  };
  const iconsProxy = new Proxy({}, { get: () => noop });
  return loadTsModule('src/components/media/MediaCallModal.tsx', {
    react: reactStub,
    'react-native': rnStub,
    'lucide-react-native': iconsProxy,
    'react-native-webview': { default: noop },
    '../../constants/theme': { Colors: { primary: '#0284C7' } },
    '../../api/client': { apiClient: { getBaseUrl: () => 'https://example.test/api/v1', getToken: () => '' } },
    '../../api/modules/mediaSession.api': { mediaSessionApi: {} },
  });
}

function readWorkspaceFile(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relativePath), 'utf8');
}

test('SOS and AI auto-alert classification strictly distinguishes Fall, Gesture SOS, Button SOS, and others', () => {
  assert.equal(
    sosDecision.classifyEmergencyAlertKind({ notificationType: 'AI_SUSPECTED_FALL' }, { incidentType: 'SUSPECTED_FALL' }),
    'AUTO_FALL'
  );
  assert.equal(
    sosDecision.isFallIncident({ notificationType: 'AI_SUSPECTED_FALL' }, { incidentType: 'SUSPECTED_FALL' }),
    true
  );
  assert.equal(
    sosDecision.isSosButtonIncident({ notificationType: 'AI_SUSPECTED_FALL' }, { incidentType: 'SUSPECTED_FALL' }),
    false
  );

  // Backend EmergencyFlowService uses notificationType: "SOS" for VISION_AI alerts too
  const aiFallViaSosNotif = {
    notificationType: 'SOS',
    dataJson: {
      source: 'VISION_AI',
      source_event_type: 'SUSPECTED_FALL',
      detection_event_id: 'det-fall-1',
    },
  };
  assert.equal(
    sosDecision.classifyEmergencyAlertKind(aiFallViaSosNotif, { incidentType: 'AI_SUSPECTED_FALL' }),
    'AUTO_FALL'
  );
  assert.equal(sosDecision.isCameraViewOnlyEmergency(aiFallViaSosNotif, { incidentType: 'AI_SUSPECTED_FALL' }), true);
  assert.equal(sosDecision.isSosButtonIncident(aiFallViaSosNotif, { incidentType: 'AI_SUSPECTED_FALL' }), false);

  // Auto-detected Gesture SOS via direct GESTURE_SOS OR notificationType: "SOS" + VISION_AI/incidentType AI_GESTURE_SOS
  const gestureLegacyAlert = { notificationType: 'GESTURE_SOS', dataJson: { event_type: 'GESTURE_SOS' } };
  assert.equal(sosDecision.classifyEmergencyAlertKind(gestureLegacyAlert, { incidentType: 'GESTURE_SOS' }), 'AUTO_GESTURE_SOS');
  assert.equal(sosDecision.isAutoGestureSosIncident(gestureLegacyAlert, { incidentType: 'GESTURE_SOS' }), true);
  assert.equal(sosDecision.isSosButtonIncident(gestureLegacyAlert, { incidentType: 'GESTURE_SOS' }), false);

  const gestureVisionViaSosNotif = {
    notificationType: 'SOS',
    dataJson: {
      source: 'VISION_AI',
      source_event_type: 'GESTURE_SOS',
      detection_event_id: 'det-gest-1',
    },
  };
  assert.equal(
    sosDecision.classifyEmergencyAlertKind(gestureVisionViaSosNotif, { incidentType: 'AI_GESTURE_SOS' }),
    'AUTO_GESTURE_SOS'
  );
  assert.equal(sosDecision.isSosButtonIncident(gestureVisionViaSosNotif, { incidentType: 'AI_GESTURE_SOS' }), false);
  assert.equal(sosDecision.isCameraViewOnlyEmergency(gestureVisionViaSosNotif, null), true);

  // Unloaded incident with generic notificationType: "SOS" (no source_payload_hash) requests incident lookup before opening ASSIST
  assert.equal(
    sosDecision.needsIncidentLookupForSosClassification({ notificationType: 'SOS', incidentId: 'inc-1', dataJson: {} }, null),
    true
  );
  assert.equal(
    sosDecision.needsIncidentLookupForSosClassification({ notificationType: 'SOS', incidentId: 'inc-2', dataJson: { source_payload_hash: 'h1' } }, null),
    false
  );

  // Patient self-pressed SOS button stays BUTTON_SOS -> two-way ASSIST
  assert.equal(
    sosDecision.isSosButtonIncident({ notificationType: 'SOS' }, { incidentType: 'PATIENT_SOS' }),
    true
  );
  assert.equal(
    sosDecision.isSosButtonIncident({ notificationType: 'EMERGENCY_SOS' }, { incidentType: 'SOS' }),
    true
  );
  assert.equal(
    sosDecision.classifyEmergencyAlertKind(
      { notificationType: 'SOS', dataJson: { source_payload_hash: 'sha256-btn' } },
      { incidentType: 'SOS' }
    ),
    'BUTTON_SOS'
  );

  // Seizure remains OTHER
  assert.equal(
    sosDecision.classifyEmergencyAlertKind({ notificationType: 'SOS' }, { incidentType: 'AI_SUSPECTED_SEIZURE' }),
    'OTHER'
  );

  // Viewer policies
  const fallPolicy = sosDecision.getMediaViewerPolicyForAlertKind('AUTO_FALL');
  const gesturePolicy = sosDecision.getMediaViewerPolicyForAlertKind('AUTO_GESTURE_SOS');
  const btnPolicy = sosDecision.getMediaViewerPolicyForAlertKind('BUTTON_SOS');
  assert.deepEqual(fallPolicy, gesturePolicy);
  assert.equal(fallPolicy.mode, 'MONITOR');
  assert.equal(fallPolicy.autoSubscribe, false);
  assert.equal(fallPolicy.allowAudioSubscribe, false);
  assert.equal(fallPolicy.allowMicPublish, false);
  assert.equal(fallPolicy.requestMicPermission, false);
  assert.equal(fallPolicy.renderAudioControls, false);
  assert.equal(fallPolicy.endActionLabel, 'Kết thúc xem');
  assert.equal(btnPolicy.mode, 'ASSIST');
  assert.equal(btnPolicy.autoSubscribe, true);
  assert.equal(btnPolicy.allowMicPublish, true);
});

test('AlertScreen, FallDetectionModal, BackendRobotMonitorModal, and MediaCallModal never auto-confirm or open ASSIST/mic for auto alerts', () => {
  const alertSrc = readWorkspaceFile('src/screens/main/AlertScreen.tsx');
  const callSrc = readWorkspaceFile('src/components/media/MediaCallModal.tsx');
  const fallSrc = readWorkspaceFile('src/components/sos/FallDetectionModal.tsx');
  const monSrc = readWorkspaceFile('src/components/map/BackendRobotMonitorModal.tsx');

  // No automatic startIncident anywhere in AlertScreen or FallDetectionModal or MediaCallModal
  assert.equal(alertSrc.includes('startIncident('), false);
  assert.equal(fallSrc.includes('startIncident('), false);
  assert.equal(callSrc.includes('confirmIncident'), false);
  assert.equal(callSrc.includes('startIncident'), false);

  // MONITOR view denies WebView mic/capture permissions and hides audio/mic buttons
  assert.equal(callSrc.includes("mediaCapturePermissionGrantType={isAssist ? 'grant' : 'deny'}"), true);
  assert.equal(monSrc.includes('mediaCapturePermissionGrantType="deny"'), true);
  assert.equal(callSrc.includes("status: isDuplicate ? 'CAMERA_LOST' : 'DISCONNECTED'"), true);

  // FallDetectionModal no longer displays talk/mic/speaker labels or calls 2-way talk
  assert.equal(fallSrc.includes('Mic/Loa'), false);
  assert.equal(fallSrc.includes('Gọi trực tiếp'), false);
  assert.equal(fallSrc.includes('Xem camera robot'), true);
});

test('Accept, modal close, minimize, timeout, error, and transient disconnect do not confirm SOS', async () => {
  const handled = new Set();
  const activeContext = {
    incidentId: 'inc-sos-1',
    robotId: 'robot-1',
    sessionId: 'sess-1',
    alertId: 'alert-1',
    mode: 'ASSIST',
    accountId: 'staff-1',
    serverUrl: 'https://mediassistrover.duckdns.org/api/v1',
  };

  for (const ev of [
    { source: 'MODAL_CLOSE', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'CONNECTING' },
    { source: 'MODAL_CLOSE', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'MINIMIZED' },
    { source: 'WEBVIEW_STATUS', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'ERROR', error: 'WebRTC fail' },
    { source: 'WEBVIEW_STATUS', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'TIMEOUT', error: 'No frames' },
    { source: 'WEBVIEW_STATUS', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'EXPIRED' },
    { source: 'WEBVIEW_STATUS', sessionId: 'sess-1', incidentId: 'inc-sos-1', robotId: 'robot-1', uiStatus: 'FAILED' },
  ]) {
    const res = await sosDecision.reconcileMediaSessionEnd({
      event: ev,
      activeContext,
      handledSessionIds: handled,
      fetchSession: async () => ({ sessionId: 'sess-1', robotId: 'robot-1', incidentId: 'inc-sos-1', mode: 'ASSIST', state: 'ACTIVE' }),
    });
    assert.notEqual(res.kind, 'SESSION_ENDED');
    assert.equal(res.confirmCalled, false);
  }

  // Transient disconnect where server still says ACTIVE must stay non-ended
  const dropRes = await sosDecision.reconcileMediaSessionEnd({
    event: {
      source: 'WEBVIEW_STATUS',
      sessionId: 'sess-1',
      incidentId: 'inc-sos-1',
      robotId: 'robot-1',
      uiStatus: 'ENDED',
      endReason: 'CONNECTION_ERROR',
    },
    activeContext,
    handledSessionIds: handled,
    fetchSession: async () => ({
      sessionId: 'sess-1',
      robotId: 'robot-1',
      incidentId: 'inc-sos-1',
      mode: 'ASSIST',
      state: 'ACTIVE',
    }),
  });
  assert.equal(dropRes.kind, 'CONNECTION_ERROR');
  assert.equal(dropRes.confirmCalled, false);

  // Real hangup / BE ENDED marks session ended ONCE with bound ids, still never auto-confirming
  const ended1 = await sosDecision.reconcileMediaSessionEnd({
    event: {
      source: 'UI_END_BUTTON',
      sessionId: 'sess-1',
      incidentId: 'inc-sos-1',
      robotId: 'robot-1',
      uiStatus: 'ENDED',
      endReason: 'STAFF_ENDED',
      backendSession: {
        sessionId: 'sess-1',
        robotId: 'robot-1',
        incidentId: 'inc-sos-1',
        mode: 'ASSIST',
        state: 'ENDED',
        endReason: 'STAFF_ENDED',
        endedAt: '2026-11-15T10:05:00Z',
      },
    },
    activeContext,
    handledSessionIds: handled,
  });
  assert.equal(ended1.kind, 'SESSION_ENDED');
  assert.equal(ended1.duplicate, false);
  assert.equal(ended1.confirmCalled, false);
  assert.equal(ended1.record.incidentId, 'inc-sos-1');
  assert.equal(ended1.record.robotId, 'robot-1');
  assert.equal(ended1.record.sessionId, 'sess-1');

  // Duplicate UI/poll callback for same session is safely deduplicated
  const endedDup = await sosDecision.reconcileMediaSessionEnd({
    event: {
      source: 'WEBVIEW_STATUS',
      sessionId: 'sess-1',
      incidentId: 'inc-sos-1',
      robotId: 'robot-1',
      uiStatus: 'ENDED',
    },
    activeContext,
    handledSessionIds: handled,
    fetchSession: async () => ({
      sessionId: 'sess-1',
      robotId: 'robot-1',
      incidentId: 'inc-sos-1',
      mode: 'ASSIST',
      state: 'ENDED',
    }),
  });
  assert.equal(endedDup.kind, 'SESSION_ENDED');
  assert.equal(endedDup.duplicate, true);
  assert.equal(endedDup.confirmCalled, false);
});

test('Role authorization, terminal hiding, duplicate submit guard, repeat confirm, and error refresh', async () => {
  const assignedIncident = {
    incidentId: 'inc-sos-2',
    status: 'ACKNOWLEDGED',
    sosResponderAccountId: 'staff-assigned',
    sosRoutingStatus: 'ASSIGNED',
  };

  assert.equal(sosDecision.canActOnSosDecision(assignedIncident, { accountId: 'admin-1', role: 'ADMIN' }).allowed, true);
  assert.equal(sosDecision.canActOnSosDecision(assignedIncident, { accountId: 'staff-assigned', role: 'STAFF' }).allowed, true);

  const otherStaffPerm = sosDecision.canActOnSosDecision(assignedIncident, { accountId: 'staff-other', role: 'STAFF' });
  assert.equal(otherStaffPerm.allowed, false);
  assert.equal(otherStaffPerm.isTerminal, false);

  for (const termStatus of ['RESOLVED', 'CLOSED', 'FALSE_ALARM']) {
    const termPerm = sosDecision.canActOnSosDecision(
      { ...assignedIncident, status: termStatus },
      { accountId: 'admin-1', role: 'ADMIN' }
    );
    assert.equal(termPerm.allowed, false);
    assert.equal(termPerm.isTerminal, true);
  }

  // Concurrent double submit lock & repeated confirm consistency
  const inFlight = new Set();
  let confirmCalls = 0;
  let resolveApi;
  const confirmPromise = sosDecision.submitSosConfirmDecision({
    incidentId: 'inc-sos-2',
    inFlightIncidentIds: inFlight,
    confirmIncident: () =>
      new Promise((resolve) => {
        confirmCalls += 1;
        resolveApi = () =>
          resolve({
            incidentId: 'inc-sos-2',
            status: 'IN_PROGRESS',
            sosResponderAccountId: 'staff-assigned',
            confirmedByAccountId: 'staff-assigned',
            confirmedAt: '2026-11-15T10:06:00Z',
          });
      }),
    refreshIncident: async () => null,
  });

  const duplicateClick = await sosDecision.submitSosConfirmDecision({
    incidentId: 'inc-sos-2',
    inFlightIncidentIds: inFlight,
    confirmIncident: async () => {
      confirmCalls += 1;
      return assignedIncident;
    },
    refreshIncident: async () => null,
  });
  assert.equal(duplicateClick.ok, false);
  assert.equal(confirmCalls, 1);

  resolveApi();
  const firstConfirm = await confirmPromise;
  assert.equal(firstConfirm.ok, true);
  assert.equal(firstConfirm.incident.status, 'IN_PROGRESS');
  assert.equal(firstConfirm.incident.confirmedByAccountId, 'staff-assigned');

  // Repeat confirm returns BE IN_PROGRESS consistently
  const repeatConfirm = await sosDecision.submitSosConfirmDecision({
    incidentId: 'inc-sos-2',
    inFlightIncidentIds: inFlight,
    confirmIncident: async () => ({
      incidentId: 'inc-sos-2',
      status: 'IN_PROGRESS',
      confirmedByAccountId: 'staff-assigned',
      confirmedAt: '2026-11-15T10:06:00Z',
    }),
    refreshIncident: async () => null,
  });
  assert.equal(repeatConfirm.ok, true);
  assert.equal(repeatConfirm.incident.status, 'IN_PROGRESS');

  // 403 / 408 / 409 errors refresh incident before retry
  for (const errObj of [
    { status: 403, message: 'Forbidden' },
    { status: 408, message: 'Request timeout' },
    { status: 409, message: 'Already closed' },
  ]) {
    let refreshedCount = 0;
    const errRes = await sosDecision.submitSosConfirmDecision({
      incidentId: 'inc-sos-2',
      inFlightIncidentIds: inFlight,
      confirmIncident: async () => {
        throw errObj;
      },
      refreshIncident: async () => {
        refreshedCount += 1;
        return { incidentId: 'inc-sos-2', status: 'CLOSED' };
      },
    });
    assert.equal(errRes.ok, false);
    assert.equal(refreshedCount, 1);
    assert.equal(errRes.error.shouldRefreshIncident, true);
    assert.equal(errRes.incident.status, 'CLOSED');
  }

  // False alarm requires non-empty resolutionNote and clears cached route
  let clearedId = null;
  const emptyFalse = await sosDecision.submitSosFalseAlarmDecision({
    incidentId: 'inc-sos-2',
    resolutionNote: '   ',
    inFlightIncidentIds: inFlight,
    markFalseAlarm: async () => ({ incidentId: 'inc-sos-2', status: 'FALSE_ALARM' }),
    refreshIncident: async () => null,
    clearRouteForIncident: (id) => {
      clearedId = id;
    },
  });
  assert.equal(emptyFalse.ok, false);
  assert.equal(clearedId, null);

  let sentNote = null;
  const validFalse = await sosDecision.submitSosFalseAlarmDecision({
    incidentId: 'inc-sos-2',
    resolutionNote: '  Benh nhan bam nham khi lau giuong  ',
    inFlightIncidentIds: inFlight,
    markFalseAlarm: async (_id, note) => {
      sentNote = note;
      return { incidentId: 'inc-sos-2', status: 'FALSE_ALARM', resolutionNote: note };
    },
    refreshIncident: async () => null,
    clearRouteForIncident: (id) => {
      clearedId = id;
    },
  });
  assert.equal(validFalse.ok, true);
  assert.equal(sentNote, 'Benh nhan bam nham khi lau giuong');
  assert.equal(validFalse.incident.status, 'FALSE_ALARM');
  assert.equal(clearedId, 'inc-sos-2');
});

test('SOS response route converts cm -> m once, supports 0 & negatives, preserves rotation alignment, and handles hash/no-route/race', () => {
  const activeMap = {
    mapId: 'map-1',
    assetHash: 'hash-v2',
  };
  const presentation = {
    source: {
      mapId: 'map-1',
      assetHash: 'hash-v2',
    },
  };

  // Normal route + negative & zero coordinates + 0-preserved distance
  const routeRes = {
    status: 'AVAILABLE',
    mapId: 'map-1',
    mapAssetHash: 'hash-v2',
    unit: 'cm',
    origin: { xCm: 0, yCm: -250, label: 'Phòng trực SOS 1' },
    destination: { xCm: 450, yCm: 120, label: 'Vị trí SOS hành lang B' },
    points: [
      { xCm: 0, yCm: -250 },
      { xCm: 200, yCm: -250 },
      { xCm: 450, yCm: 120 },
    ],
    distanceCm: 620,
  };

  const evaluated = sosRoute.evaluateSosRouteAgainstMap({
    incidentId: 'inc-sos-3',
    response: routeRes,
    activeMap,
    presentation,
  });
  assert.equal(evaluated.kind, 'AVAILABLE');
  assert.equal(evaluated.route.origin.x, 0);
  assert.equal(evaluated.route.origin.y, -2.5);
  assert.equal(evaluated.route.destination.x, 4.5);
  assert.equal(evaluated.route.destination.y, 1.2);
  assert.equal(evaluated.route.points[1].x, 2);
  assert.equal(evaluated.route.points[1].y, -2.5);
  assert.equal(evaluated.route.distanceCm, 620);

  // Swagger collided { x, y } point shape & zero-length route (0 cm at (0, 0))
  const zeroRoute = sosRoute.evaluateSosRouteAgainstMap({
    incidentId: 'inc-sos-zero',
    response: {
      status: 'AVAILABLE',
      mapId: 'map-1',
      mapAssetHash: 'hash-v2',
      unit: 'cm',
      origin: { x: 0, y: 0 },
      destination: { x: 0, y: 0 },
      points: [{ x: 0, y: 0 }],
      distanceCm: 0,
    },
    activeMap,
    presentation,
  });
  assert.equal(zeroRoute.kind, 'AVAILABLE');
  assert.equal(zeroRoute.route.distanceCm, 0);
  assert.equal(zeroRoute.route.points.length, 1);
  assert.equal(zeroRoute.route.points[0].x, 0);
  assert.equal(zeroRoute.route.points[0].y, 0);
  assert.equal(sosRoute.formatDistanceFromCm(0), '0 cm (0 m)');

  // Reject non-cm unit (prevent double scaling)
  const wrongUnit = sosRoute.evaluateSosRouteAgainstMap({
    incidentId: 'inc-bad-unit',
    response: { ...routeRes, unit: 'm' },
    activeMap,
    presentation,
  });
  assert.equal(wrongUnit.kind, 'UNAVAILABLE');

  // Verify shared BackendHospitalMap rotation projection math preserves rotated distance/order
  const resolution = 0.05;
  const pixelWidth = 400;
  const pixelHeight = 400;
  const rotationDeg = -18;
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const cosR = Math.cos(rotationRad);
  const sinR = Math.sin(rotationRad);
  const worldToRotated = (pt) => {
    const u = pt.x / resolution;
    const v = pixelHeight - pt.y / resolution;
    const relU = u - pixelWidth / 2;
    const relV = v - pixelHeight / 2;
    return {
      rx: cosR * relU - sinR * relV,
      ry: sinR * relU + cosR * relV,
    };
  };
  const p0 = worldToRotated(evaluated.route.points[0]);
  const p1 = worldToRotated(evaluated.route.points[1]);
  const dxPx = p1.rx - p0.rx;
  const dyPx = p1.ry - p0.ry;
  const rotatedDistMeters = Math.hypot(dxPx, dyPx) * resolution;
  assert.ok(Math.abs(rotatedDistMeters - 2.0) < 1e-6);

  // Map hash mismatch blocks drawing
  const hashMismatch = sosRoute.evaluateSosRouteAgainstMap({
    incidentId: 'inc-sos-3',
    response: { ...routeRes, mapAssetHash: 'hash-v3-newer' },
    activeMap,
    presentation,
  });
  assert.equal(hashMismatch.kind, 'HASH_MISMATCH');

  // No route states display BE reason and never synthesize a straight line
  for (const noRouteCase of [
    { status: 'NO_PATH', reason: 'Cửa hành lang B đang khóa trên lưới A*', mapId: 'map-1', origin: { xCm: 0, yCm: 0 }, destination: { xCm: 500, yCm: 500 }, points: [] },
    { status: 'UNWALKABLE', reason: 'Tọa độ SOS nằm trong vùng tường', mapId: 'map-1', points: [] },
    { status: 'NO_COORDINATES', reason: 'Chưa có tọa độ phòng trực', points: [] },
    { status: 'AVAILABLE', unit: 'cm', mapId: 'map-1', mapAssetHash: 'hash-v2', origin: { xCm: 0, yCm: 0 }, destination: { xCm: 500, yCm: 500 }, points: [], distanceCm: 500 },
  ]) {
    const res = sosRoute.evaluateSosRouteAgainstMap({
      incidentId: 'inc-sos-3',
      response: noRouteCase,
      activeMap,
      presentation,
    });
    assert.equal(res.kind, 'UNAVAILABLE');
    assert.equal(res.route, undefined);
    assert.ok(res.reason.length > 0);
  }

  // Request guard rejects late responses after switching incident, account, server, or map
  const guard = new sosRoute.SosRouteRequestGuard();
  const t1 = guard.begin({
    serverUrl: 'https://server-a/api/v1',
    accountId: 'staff-1',
    incidentId: 'inc-sos-3',
    mapId: 'map-1',
  });
  assert.equal(
    guard.isCurrent(t1, {
      serverUrl: 'https://server-a/api/v1',
      accountId: 'staff-1',
      incidentId: 'inc-sos-3',
      mapId: 'map-1',
    }),
    true
  );

  // Switching incident invalidates t1
  const t2 = guard.begin({
    serverUrl: 'https://server-a/api/v1',
    accountId: 'staff-1',
    incidentId: 'inc-sos-4',
    mapId: 'map-1',
  });
  assert.equal(guard.isCurrent(t1), false);
  assert.equal(guard.isCurrent(t2), true);

  // Switching account or server rejects t2 too
  assert.equal(
    guard.isCurrent(t2, {
      serverUrl: 'https://server-a/api/v1',
      accountId: 'staff-2',
      incidentId: 'inc-sos-4',
      mapId: 'map-1',
    }),
    false
  );
  assert.equal(
    guard.isCurrent(t2, {
      serverUrl: 'https://server-b/api/v1',
      accountId: 'staff-1',
      incidentId: 'inc-sos-4',
      mapId: 'map-1',
    }),
    false
  );
  assert.equal(
    guard.isCurrent(t2, {
      serverUrl: 'https://server-a/api/v1',
      accountId: 'staff-1',
      incidentId: 'inc-sos-4',
      mapId: 'map-2',
    }),
    false
  );
});

function extractInlineWebViewScript(html) {
  const matches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(matches.length > 0, 'Expected inline script inside WebView HTML');
  return matches[matches.length - 1][1];
}

async function runWebViewMediaSimulation({ mode, robotId }) {
  const { buildMediaCallHtml } = loadMediaCallModalModule();
  const html = buildMediaCallHtml({
    baseUrl: 'https://example.test/api/v1',
    livekitUrl: 'wss://lk.example.test',
    livekitToken: 'lk-jwt-1',
    robotId,
    mode,
    incidentId: 'inc-cam-1',
    existingSessionId: 'sess-cam-1',
  });

  const scriptCode = extractInlineWebViewScript(html);
  const postedMessages = [];
  const connectCalls = [];
  const micCalls = [];
  let startAudioCalls = 0;
  let videoAttachCount = 0;
  let audioAttachCount = 0;

  const targetPubVideoInitial = { kind: 'video', isSubscribed: false, setSubscribed(v) { this.isSubscribed = v; } };
  const targetPubAudioInitial = { kind: 'audio', isSubscribed: false, setSubscribed(v) { this.isSubscribed = v; } };
  const wrongRobotPubVideo = { kind: 'video', isSubscribed: false, setSubscribed(v) { this.isSubscribed = v; } };
  const lateTargetPubVideo = { kind: 'video', isSubscribed: false, setSubscribed(v) { this.isSubscribed = v; } };
  const lateTargetPubAudio = { kind: 'audio', isSubscribed: false, setSubscribed(v) { this.isSubscribed = v; } };

  const targetParticipant = {
    identity: `robot-${robotId}`,
    trackPublications: new Map([
      ['v1', targetPubVideoInitial],
      ['a1', targetPubAudioInitial],
    ]),
  };
  const wrongParticipant = {
    identity: 'robot-other-999',
    trackPublications: new Map([['v-other', wrongRobotPubVideo]]),
  };

  let createdRoom = null;
  const listeners = {};
  const emitRoom = (ev, ...args) => {
    for (const fn of listeners[ev] || []) {
      fn(...args);
    }
  };

  class FakeRoom {
    constructor() {
      createdRoom = this;
      this.remoteParticipants = new Map([
        ['target', targetParticipant],
        ['other', wrongParticipant],
      ]);
      this.localParticipant = {
        setMicrophoneEnabled: async (enabled, opts) => {
          micCalls.push({ enabled, opts });
        },
      };
    }
    on(ev, fn) {
      if (!listeners[ev]) listeners[ev] = [];
      listeners[ev].push(fn);
    }
    async connect(url, token, opts) {
      connectCalls.push({ url, token, opts });
      emitRoom('connected');
    }
    async startAudio() {
      startAudioCalls += 1;
    }
    disconnect() {}
  }

  const videoEl = {
    muted: true,
    listeners: {},
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    },
    play: async () => {
      if (videoEl.listeners.playing) videoEl.listeners.playing();
    },
  };
  const audioEl = { muted: false, autoplay: true };
  const statusOverlay = { classList: { add() {}, remove() {} } };
  const statusText = { textContent: '' };
  const liveBadge = { classList: { add() {}, remove() {} } };
  const windowListeners = {};

  const sandbox = {
    console,
    setTimeout,
    clearTimeout,
    setInterval: () => 1,
    clearInterval: () => {},
    MessageEvent: function MessageEvent(_type, init) {
      this.data = init.data;
    },
    document: {
      getElementById(id) {
        if (id === 'remote-video') return videoEl;
        if (id === 'remote-audio') return html.includes('<audio id="remote-audio"') ? audioEl : null;
        if (id === 'status-overlay') return statusOverlay;
        if (id === 'status-text') return statusText;
        if (id === 'live-badge') return liveBadge;
        return null;
      },
      createElement: () => ({}),
      body: { appendChild: () => {} },
      head: { appendChild: () => {} },
      addEventListener: () => {},
    },
    window: {
      ReactNativeWebView: {
        postMessage: (raw) => postedMessages.push(JSON.parse(raw)),
      },
      LivekitClient: null,
      addEventListener: (type, fn) => {
        if (!windowListeners[type]) windowListeners[type] = [];
        windowListeners[type].push(fn);
      },
    },
    LivekitClient: {
      Room: FakeRoom,
      RoomEvent: {
        Connected: 'connected',
        Reconnecting: 'reconnecting',
        Reconnected: 'reconnected',
        Disconnected: 'disconnected',
        ParticipantConnected: 'participantConnected',
        TrackPublished: 'trackPublished',
        TrackSubscribed: 'trackSubscribed',
        TrackUnsubscribed: 'trackUnsubscribed',
      },
      Track: { Kind: { Video: 'video', Audio: 'audio' } },
      VideoPresets: { h720: { resolution: {} } },
      DisconnectReason: { DUPLICATE_IDENTITY: 'duplicate_identity' },
    },
  };
  sandbox.window.LivekitClient = sandbox.LivekitClient;

  vm.runInNewContext(scriptCode, sandbox);
  await new Promise((r) => setTimeout(r, 20));

  // Simulate late track publications (both video and audio) + another robot + reconnect + defensive audio TrackSubscribed
  emitRoom('trackPublished', lateTargetPubAudio, targetParticipant);
  emitRoom('trackPublished', lateTargetPubVideo, targetParticipant);
  emitRoom('trackPublished', wrongRobotPubVideo, wrongParticipant);

  emitRoom('trackSubscribed', { kind: 'video', attach: () => { videoAttachCount += 1; }, detach: () => {} }, wrongRobotPubVideo, wrongParticipant);
  emitRoom('trackSubscribed', { kind: 'audio', attach: () => { audioAttachCount += 1; return {}; }, detach: () => {} }, targetPubAudioInitial, targetParticipant);
  emitRoom('trackSubscribed', { kind: 'video', attach: () => { videoAttachCount += 1; }, detach: () => {} }, targetPubVideoInitial, targetParticipant);

  emitRoom('reconnecting');
  emitRoom('reconnected');

  for (const fn of windowListeners.message || []) {
    fn({ data: JSON.stringify({ type: 'toggleMic' }) });
    fn({ data: JSON.stringify({ type: 'toggleAudio' }) });
  }

  return {
    html,
    createdRoom,
    connectCalls,
    micCalls,
    startAudioCalls,
    videoAttachCount,
    audioAttachCount,
    targetPubVideoInitial,
    targetPubAudioInitial,
    wrongRobotPubVideo,
    lateTargetPubVideo,
    lateTargetPubAudio,
    videoEl,
    postedMessages,
  };
}

test('LiveKit MONITOR view-only WebView strictly disables autoSubscribe, blocks audio DOM/tracks, ignores other robots, handles late/reconnected video, and keeps ASSIST working', async () => {
  const monitor = await runWebViewMediaSimulation({ mode: 'MONITOR', robotId: 'robot-A' });

  // No <audio> element at all in MONITOR mode
  assert.equal(monitor.html.includes('<audio'), false);
  assert.equal(monitor.connectCalls.length, 1);
  assert.equal(monitor.connectCalls[0].opts.autoSubscribe, false);

  // Never enables local mic, never calls room.startAudio(), never toggles mic/audio even if messaged
  assert.equal(monitor.micCalls.length, 0);
  assert.equal(monitor.startAudioCalls, 0);
  assert.equal(monitor.audioAttachCount, 0);

  // Only target robot-robot-A video publications (initial + late) are subscribed; audio & other robots are NOT subscribed
  assert.equal(monitor.targetPubVideoInitial.isSubscribed, true);
  assert.equal(monitor.lateTargetPubVideo.isSubscribed, true);
  assert.equal(monitor.targetPubAudioInitial.isSubscribed, false);
  assert.equal(monitor.lateTargetPubAudio.isSubscribed, false);
  assert.equal(monitor.wrongRobotPubVideo.isSubscribed, false);

  // Video frames attached only from target robot and video element stays muted; CONNECTED emitted
  assert.equal(monitor.videoAttachCount, 1);
  assert.equal(monitor.videoEl.muted, true);
  assert.ok(monitor.postedMessages.some((m) => m.type === 'status' && m.status === 'CONNECTED'));

  // Regression: Button SOS ASSIST mode STILL keeps autoSubscribe: true, <audio>, mic publish, and startAudio()
  const assist = await runWebViewMediaSimulation({ mode: 'ASSIST', robotId: 'robot-A' });
  assert.equal(assist.html.includes('<audio id="remote-audio"'), true);
  assert.equal(assist.connectCalls.length, 1);
  assert.equal(assist.connectCalls[0].opts.autoSubscribe, true);
  assert.equal(assist.micCalls.length, 2); // 1 initial enable + 1 toggleMic
  assert.equal(assist.startAudioCalls, 1);
  assert.equal(assist.audioAttachCount, 1);
});

test('Auto Fall & Auto Gesture SOS full flow: MONITOR error/retry, explicit Kết thúc xem, /confirm, /false-alarm, and Map route without auto-confirm', async () => {
  // 1. Verify BE 409 conflict explanation when RINGING ASSIST session blocks MONITOR
  const conflictMsg = sosDecision.classifyCameraMonitorOpenError(
    { status: 409, message: 'ROBOT_MEDIA_SESSION_ALREADY_OPEN' },
    [{ sessionId: 'sess-ring', robotId: 'robot-1', mode: 'ASSIST', state: 'RINGING' }],
    'robot-1'
  );
  assert.match(conflictMsg, /MONITOR/i);
  assert.match(conflictMsg, /409/);

  const offlineMsg = sosDecision.classifyCameraMonitorOpenError(
    { status: 422, message: 'MEDIA_DEVICE_NOT_CONNECTED' },
    [],
    'robot-1'
  );
  assert.match(offlineMsg, /Thử lại/);

  // 2. Camera view-only session end reconciliation for AUTO_FALL & AUTO_GESTURE_SOS
  for (const kindCase of [
    { incidentId: 'inc-fall-1', robotId: 'robot-fall', sessionId: 'sess-mon-fall', alertId: 'alt-fall' },
    { incidentId: 'inc-gest-1', robotId: 'robot-gest', sessionId: 'sess-mon-gest', alertId: 'alt-gest' },
  ]) {
    const handled = new Set();
    const ctx = {
      ...kindCase,
      mode: 'MONITOR',
      accountId: 'staff-sos-1',
      serverUrl: 'https://mediassistrover.duckdns.org/api/v1',
    };

    // Modal dismiss, camera error, timeout, wrong robot, or BE preemption NEVER end/confirm
    for (const badEv of [
      { source: 'MODAL_CLOSE', ...kindCase, uiStatus: 'CONNECTING' },
      { source: 'WEBVIEW_STATUS', ...kindCase, uiStatus: 'TIMEOUT', error: 'No frames' },
      { source: 'WEBVIEW_STATUS', ...kindCase, uiStatus: 'CAMERA_LOST', error: 'Lost stream' },
      { source: 'WEBVIEW_STATUS', ...kindCase, robotId: 'robot-WRONG', uiStatus: 'ENDED' },
      {
        source: 'WEBVIEW_STATUS',
        ...kindCase,
        uiStatus: 'ENDED',
        endReason: 'SOS_PREEMPTED_MONITOR',
        backendSession: { ...kindCase, mode: 'MONITOR', state: 'ENDED', endReason: 'SOS_PREEMPTED_MONITOR' },
      },
    ]) {
      const outcome = await sosDecision.reconcileMediaSessionEnd({
        event: badEv,
        activeContext: ctx,
        handledSessionIds: handled,
        fetchSession: async () => ({ ...kindCase, mode: 'MONITOR', state: 'ACTIVE' }),
      });
      assert.notEqual(outcome.kind, 'SESSION_ENDED');
      assert.equal(outcome.confirmCalled, false);
    }

    // Explicit "Kết thúc xem" -> SESSION_ENDED (never auto-confirming) -> staff chooses /confirm -> IN_PROGRESS -> Map route
    const endOutcome = await sosDecision.reconcileMediaSessionEnd({
      event: {
        source: 'UI_END_BUTTON',
        ...kindCase,
        uiStatus: 'ENDED',
        endReason: 'STAFF_ENDED_VIEW',
        backendSession: { ...kindCase, mode: 'MONITOR', state: 'ENDED', endReason: 'STAFF_ENDED_VIEW' },
      },
      activeContext: ctx,
      handledSessionIds: handled,
    });
    assert.equal(endOutcome.kind, 'SESSION_ENDED');
    assert.equal(endOutcome.record.mode, 'MONITOR');
    assert.equal(endOutcome.record.robotId, kindCase.robotId);
    assert.equal(endOutcome.record.incidentId, kindCase.incidentId);
    assert.equal(endOutcome.confirmCalled, false);

    // Assigned Staff calls /confirm -> IN_PROGRESS -> route fits map
    const inFlight = new Set();
    const confirmRes = await sosDecision.submitSosConfirmDecision({
      incidentId: kindCase.incidentId,
      inFlightIncidentIds: inFlight,
      confirmIncident: async (id) => ({
        incidentId: id,
        status: 'IN_PROGRESS',
        sosResponderAccountId: 'staff-sos-1',
        confirmedByAccountId: 'staff-sos-1',
        confirmedAt: '2026-11-15T12:00:00Z',
      }),
      refreshIncident: async () => null,
    });
    assert.equal(confirmRes.ok, true);
    assert.equal(confirmRes.incident.status, 'IN_PROGRESS');

    const routeEval = sosRoute.evaluateSosRouteAgainstMap({
      incidentId: kindCase.incidentId,
      response: {
        status: 'AVAILABLE',
        mapId: 'map-1',
        mapAssetHash: 'hash-v2',
        unit: 'cm',
        origin: { xCm: 100, yCm: 100, label: 'Phòng trực SOS' },
        destination: { xCm: 400, yCm: 250, label: 'Vị trí cảnh báo AI' },
        points: [{ xCm: 100, yCm: 100 }, { xCm: 400, yCm: 250 }],
        distanceCm: 335,
      },
      activeMap: { mapId: 'map-1', assetHash: 'hash-v2' },
    });
    assert.equal(routeEval.kind, 'AVAILABLE');
    assert.equal(routeEval.route.destination.x, 4);
    assert.equal(routeEval.route.destination.y, 2.5);
  }
});

test('SOS completion works for both BUTTON_SOS and AUTO_FALL/GESTURE_SOS (/confirm -> /resolve -> /close), retries ONLY /close when resolve succeeds, blocks duplicates & unauthorized actors, and refuses still-ACTIVE hangup', async () => {
  const alertSrc = readWorkspaceFile('src/screens/main/AlertScreen.tsx');
  const fallSrc = readWorkspaceFile('src/components/sos/FallDetectionModal.tsx');
  const callSrc = readWorkspaceFile('src/components/media/MediaCallModal.tsx');

  // UI labels & centralized completion handlers (FallDetectionModal no longer swallows resolve directly)
  assert.equal(alertSrc.includes('Xác nhận kết thúc SOS'), true);
  assert.equal(alertSrc.includes('submitSosCompleteDecision'), true);
  assert.equal(alertSrc.includes('submitSosCloseRetry'), true);
  assert.equal(fallSrc.includes('Xác nhận kết thúc SOS'), true);
  assert.equal(fallSrc.includes('incidentApi.resolveIncident'), false);
  assert.equal(callSrc.includes('Kết thúc cuộc gọi'), true);

  // 1. UI_END_BUTTON fails if BE session stays ACTIVE after /end error
  const activeEndFail = await sosDecision.reconcileMediaSessionEnd({
    event: {
      source: 'UI_END_BUTTON',
      sessionId: 'sess-active-fail',
      incidentId: 'inc-active-fail',
      robotId: 'robot-1',
      uiStatus: 'ENDED',
      backendSession: {
        sessionId: 'sess-active-fail',
        robotId: 'robot-1',
        incidentId: 'inc-active-fail',
        mode: 'ASSIST',
        state: 'ACTIVE',
      },
    },
    activeContext: {
      incidentId: 'inc-active-fail',
      robotId: 'robot-1',
      sessionId: 'sess-active-fail',
      mode: 'ASSIST',
    },
    handledSessionIds: new Set(),
  });
  assert.equal(activeEndFail.kind, 'CONNECTION_ERROR');
  assert.equal(activeEndFail.confirmCalled, false);

  // 2. Permission checks across statuses
  const openInc = { incidentId: 'inc-1', status: 'OPEN', sosResponderAccountId: 'staff-sos' };
  const ackInc = { incidentId: 'inc-1', status: 'ACKNOWLEDGED', sosResponderAccountId: 'staff-sos', acknowledgedByAccountId: 'staff-sos' };
  const inProgInc = { incidentId: 'inc-1', status: 'IN_PROGRESS', sosResponderAccountId: 'staff-sos', acknowledgedByAccountId: 'staff-sos' };
  const resolvedInc = { incidentId: 'inc-1', status: 'RESOLVED', sosResponderAccountId: 'staff-sos', acknowledgedByAccountId: 'staff-sos' };
  const closedInc = { incidentId: 'inc-1', status: 'CLOSED', sosResponderAccountId: 'staff-sos' };

  assert.equal(sosDecision.canActOnSosCompletion(openInc, { accountId: 'staff-sos', role: 'STAFF' }).stage, 'NEED_CONFIRM_FIRST');
  assert.equal(sosDecision.canActOnSosCompletion(ackInc, { accountId: 'staff-sos', role: 'STAFF' }).stage, 'NEED_CONFIRM_FIRST');
  assert.equal(sosDecision.canActOnSosCompletion(inProgInc, { accountId: 'staff-sos', role: 'STAFF' }).allowed, true);
  assert.equal(sosDecision.canActOnSosCompletion(inProgInc, { accountId: 'staff-other', role: 'STAFF' }).allowed, false);
  assert.equal(sosDecision.canActOnSosCompletion(inProgInc, { accountId: 'admin-1', role: 'ADMIN' }).allowed, true);
  assert.equal(sosDecision.canActOnSosCompletion(resolvedInc, { accountId: 'staff-sos', role: 'STAFF' }).stage, 'RETRY_CLOSE_ONLY');
  assert.equal(sosDecision.canActOnSosCompletion(closedInc, { accountId: 'staff-sos', role: 'STAFF' }).stage, 'ALREADY_CLOSED');
  assert.equal(sosDecision.canActOnSosCompletion(closedInc, { accountId: 'admin-1', role: 'ADMIN' }).allowed, false);

  // Validation blocks empty or >4000 char resolutionNote
  assert.equal(sosDecision.validateResolutionNote('   ').valid, false);
  assert.equal(sosDecision.validateResolutionNote('x'.repeat(4001)).valid, false);
  assert.equal(sosDecision.validateResolutionNote('  Đã hỗ trợ xong  ').cleaned, 'Đã hỗ trợ xong');

  // 3. Happy path completion for BOTH Button SOS (ASSIST -> confirm -> resolve -> close) AND Auto Fall (MONITOR -> confirm -> resolve -> close)
  for (const flow of [
    { incidentId: 'inc-btn-done', kind: 'BUTTON_SOS' },
    { incidentId: 'inc-fall-done', kind: 'AUTO_FALL' },
  ]) {
    const trace = [];
    const clearedRoutes = [];
    const clearedCalls = [];
    const inFlight = new Set();

    let slowResolve;
    const p1 = sosDecision.submitSosCompleteDecision({
      incidentId: flow.incidentId,
      currentIncident: { incidentId: flow.incidentId, status: 'IN_PROGRESS' },
      resolutionNote: '  Đã hỗ trợ bệnh nhân tại hiện trường  ',
      inFlightIncidentIds: inFlight,
      resolveIncident: (id, note) => {
        trace.push(['resolve', id, note]);
        return new Promise((r) => {
          slowResolve = () => r({ incidentId: id, status: 'RESOLVED', resolutionNote: note });
        });
      },
      closeIncident: async (id) => {
        trace.push(['close', id]);
        return { incidentId: id, status: 'CLOSED', closedAt: '2026-11-17T12:00:00Z' };
      },
      refreshIncident: async () => null,
      clearRouteForIncident: (id) => clearedRoutes.push(id),
      clearCompletedCall: (id) => clearedCalls.push(id),
    });

    // Duplicate click while in flight is blocked
    const dup = await sosDecision.submitSosCompleteDecision({
      incidentId: flow.incidentId,
      currentIncident: { incidentId: flow.incidentId, status: 'IN_PROGRESS' },
      resolutionNote: 'Duplicate click',
      inFlightIncidentIds: inFlight,
      resolveIncident: async () => {
        trace.push(['dup-resolve']);
        return { incidentId: flow.incidentId, status: 'RESOLVED' };
      },
      closeIncident: async () => ({ incidentId: flow.incidentId, status: 'CLOSED' }),
      refreshIncident: async () => null,
    });
    assert.equal(dup.ok, false);
    assert.equal(dup.outcomeKind, 'IN_FLIGHT');

    slowResolve();
    const res1 = await p1;
    assert.equal(res1.ok, true);
    assert.equal(res1.outcomeKind, 'CLOSED');
    assert.equal(res1.closed, true);
    assert.equal(res1.resolveSucceeded, true);
    assert.equal(res1.incident.status, 'CLOSED');
    assert.deepEqual(trace, [
      ['resolve', flow.incidentId, 'Đã hỗ trợ bệnh nhân tại hiện trường'],
      ['close', flow.incidentId],
    ]);
    assert.deepEqual(clearedRoutes, [flow.incidentId]);
    assert.deepEqual(clearedCalls, [flow.incidentId]);
  }

  // 4. Partial failure: /resolve succeeds (RESOLVED), /close fails -> re-reads incident, keeps RESOLVED, then retries ONLY /close
  const partialInFlight = new Set();
  const partialCalls = [];
  let refreshedOnError = 0;
  let clearedRouteCount = 0;

  const partialRes = await sosDecision.submitSosCompleteDecision({
    incidentId: 'inc-partial-1',
    currentIncident: { incidentId: 'inc-partial-1', status: 'IN_PROGRESS', sosResponderAccountId: 'staff-sos' },
    resolutionNote: 'Đã xử lý xong té ngã',
    inFlightIncidentIds: partialInFlight,
    resolveIncident: async (id, note) => {
      partialCalls.push(['resolve', id, note]);
      return { incidentId: id, status: 'RESOLVED', resolutionNote: note, sosResponderAccountId: 'staff-sos' };
    },
    closeIncident: async (id) => {
      partialCalls.push(['close', id]);
      throw { status: 500, message: 'Internal Server Error during close' };
    },
    refreshIncident: async (id) => {
      refreshedOnError += 1;
      partialCalls.push(['refresh', id]);
      return { incidentId: id, status: 'RESOLVED', resolutionNote: 'Đã xử lý xong té ngã', sosResponderAccountId: 'staff-sos' };
    },
    clearRouteForIncident: () => {
      clearedRouteCount += 1;
    },
  });

  assert.equal(partialRes.ok, false);
  assert.equal(partialRes.outcomeKind, 'RESOLVED_CLOSE_FAILED');
  assert.equal(partialRes.resolveSucceeded, true);
  assert.equal(partialRes.closed, false);
  assert.equal(partialRes.incident.status, 'RESOLVED');
  assert.equal(refreshedOnError, 1);
  assert.equal(clearedRouteCount, 1);

  // Retry completion now calls ONLY /close (never calls /resolve again!)
  const retryCalls = [];
  const retryRes = await sosDecision.submitSosCompleteDecision({
    incidentId: 'inc-partial-1',
    currentIncident: partialRes.incident,
    resolutionNote: 'Should not re-send resolve',
    inFlightIncidentIds: partialInFlight,
    resolveIncident: async () => {
      retryCalls.push('unexpected-resolve');
      throw new Error('resolve MUST NOT be called when status is RESOLVED');
    },
    closeIncident: async (id) => {
      retryCalls.push(['close', id]);
      return { incidentId: id, status: 'CLOSED', closedAt: '2026-11-17T12:05:00Z' };
    },
    refreshIncident: async (id) => {
      retryCalls.push(['refresh', id]);
      return { incidentId: id, status: 'RESOLVED' };
    },
  });
  assert.equal(retryRes.ok, true);
  assert.equal(retryRes.outcomeKind, 'CLOSED');
  assert.equal(retryRes.resolveCalled, false);
  assert.equal(retryRes.closeCalled, true);
  assert.equal(retryRes.incident.status, 'CLOSED');
  assert.deepEqual(retryCalls, [
    ['refresh', 'inc-partial-1'],
    ['close', 'inc-partial-1'],
  ]);

  // 5. Already closed incident does not call /resolve or /close redundantly
  const alreadyCalls = [];
  const alreadyRes = await sosDecision.submitSosCompleteDecision({
    incidentId: 'inc-closed-already',
    currentIncident: { incidentId: 'inc-closed-already', status: 'CLOSED' },
    resolutionNote: 'Test note',
    inFlightIncidentIds: new Set(),
    resolveIncident: async () => {
      alreadyCalls.push('resolve');
      return { incidentId: 'inc-closed-already', status: 'CLOSED' };
    },
    closeIncident: async () => {
      alreadyCalls.push('close');
      return { incidentId: 'inc-closed-already', status: 'CLOSED' };
    },
    refreshIncident: async () => null,
  });
  assert.equal(alreadyRes.ok, true);
  assert.equal(alreadyRes.outcomeKind, 'ALREADY_CLOSED');
  assert.deepEqual(alreadyCalls, []);
});
