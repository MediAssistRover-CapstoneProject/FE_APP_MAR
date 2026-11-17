const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTs(relPath) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  return mod.exports;
}

const policy = loadTs('src/api/pollingPolicy.ts');

test('MapScreen polling pauses when unfocused/backgrounded, keeps 3s when BUSY/monitored, relaxes to 6s when IDLE', () => {
  assert.deepEqual(
    policy.getMapPollingPlan({
      isFocused: false,
      isMonitorOpen: false,
      appState: 'active',
      robotStatus: 'BUSY',
      hasActiveJob: true,
    }),
    { active: false, intervalMs: 0 }
  );

  assert.deepEqual(
    policy.getMapPollingPlan({
      isFocused: true,
      isMonitorOpen: false,
      appState: 'background',
      robotStatus: 'BUSY',
      hasActiveJob: true,
    }),
    { active: false, intervalMs: 0 }
  );

  assert.deepEqual(
    policy.getMapPollingPlan({
      isFocused: true,
      isMonitorOpen: false,
      appState: 'active',
      robotStatus: 'BUSY',
      hasActiveJob: false,
    }),
    { active: true, intervalMs: 3000 }
  );

  assert.deepEqual(
    policy.getMapPollingPlan({
      isFocused: false,
      isMonitorOpen: true,
      appState: 'active',
      robotStatus: 'IDLE',
      hasActiveJob: false,
    }),
    { active: true, intervalMs: 3000 }
  );

  assert.deepEqual(
    policy.getMapPollingPlan({
      isFocused: true,
      isMonitorOpen: false,
      appState: 'active',
      robotStatus: 'IDLE',
      hasActiveJob: false,
    }),
    { active: true, intervalMs: 6000 }
  );
});

test('Battery and location-history fallback respect 15s throttle unless forced or snapshot failed', () => {
  assert.equal(policy.shouldFetchBatteryTelemetry(null, 10_000, false), true);
  assert.equal(policy.shouldFetchBatteryTelemetry(10_000, 13_000, false), false);
  assert.equal(policy.shouldFetchBatteryTelemetry(10_000, 13_000, true), true);
  assert.equal(policy.shouldFetchBatteryTelemetry(10_000, 25_000, false), true);

  assert.equal(policy.shouldFetchLocationHistoryFallback(false, 10_000, 12_000), true);
  assert.equal(policy.shouldFetchLocationHistoryFallback(true, 10_000, 13_000), false);
  assert.equal(policy.shouldFetchLocationHistoryFallback(true, 10_000, 25_000), true);
});

test('AlertScreen uses lightweight OPEN-only watchdog when unfocused and focused page-0 when open', () => {
  assert.equal(
    policy.getAlertPollingPlan({ isFocused: true, appState: 'background' }).mode,
    'PAUSED'
  );
  assert.deepEqual(
    policy.getAlertPollingPlan({ isFocused: true, appState: 'active' }),
    { mode: 'FOCUSED_LIST', intervalMs: 5000, pageSize: 30 }
  );
  assert.deepEqual(
    policy.getAlertPollingPlan({ isFocused: false, appState: 'active' }),
    { mode: 'BACKGROUND_WATCHDOG', intervalMs: 6000, pageSize: 20 }
  );
});

test('MissionScreen pauses behind QR modal/off-tab, speeds up 1.5s during UNLOCK/LOCK, and stays 3.5s otherwise', () => {
  assert.equal(
    policy.getMissionPollingPlan({
      isFocused: true,
      appState: 'active',
      jobStatus: 'RUNNING',
      stepCode: 'UNLOCK_SENDER',
      isQrModalOpen: true,
      hasRecentQrVerified: true,
      hasPendingResponseButton: false,
    }).active,
    false
  );

  assert.equal(
    policy.getMissionPollingPlan({
      isFocused: false,
      appState: 'active',
      jobStatus: 'RUNNING',
      stepCode: 'PAYLOAD_SENDER',
      isQrModalOpen: false,
      hasRecentQrVerified: false,
      hasPendingResponseButton: true,
    }).active,
    false
  );

  assert.deepEqual(
    policy.getMissionPollingPlan({
      isFocused: true,
      appState: 'active',
      jobStatus: 'RUNNING',
      stepCode: 'UNLOCK_RECEIVER',
      isQrModalOpen: false,
      hasRecentQrVerified: true,
      hasPendingResponseButton: false,
    }),
    { active: true, intervalMs: 1500 }
  );

  assert.deepEqual(
    policy.getMissionPollingPlan({
      isFocused: true,
      appState: 'active',
      jobStatus: 'RUNNING',
      stepCode: 'PAYLOAD_SENDER',
      isQrModalOpen: false,
      hasRecentQrVerified: true,
      hasPendingResponseButton: true,
    }),
    { active: true, intervalMs: 3500 }
  );
});

