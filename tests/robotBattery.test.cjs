const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadTsModule(relativePath) {
  const fullPath = path.resolve(__dirname, '..', relativePath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function('module', 'exports', js)(loaded, loaded.exports);
  return loaded.exports;
}

const {
  finiteBatteryNumber,
  normalizeRobotBattery,
  pickNewerRobotBattery,
  formatRobotBatteryDisplay,
} = loadTsModule('src/components/map/robotBattery.ts');

test('normalizes fresh BatteryResponse telemetry accurately', () => {
  const display = formatRobotBatteryDisplay(
    {
      robotId: '0e3f1083-2546-4f45-8004-5eda5cb75a6f',
      batteryRaw: 12450,
      batteryUnit: 'MILLIVOLT',
      voltageV: 12.45,
      batteryPercent: 86.4,
      estimateStatus: 'CALIBRATED',
      fresh: true,
      ageSec: 4.2,
    },
    { robotId: '0e3f1083-2546-4f45-8004-5eda5cb75a6f', batteryPercent: 50 }
  );

  assert.equal(display.normalized.isFromBatteryApi, true);
  assert.equal(display.percentText, '86%');
  assert.equal(display.voltageText, '12.45V');
  assert.equal(display.rawText, '12450 mV');
  assert.equal(display.badgeText, '86% · 12.4V');
  assert.equal(display.detailText, '86% (12.45V)');
  assert.equal(display.freshnessText, 'Mới đo (4s trước)');
  assert.equal(display.tintColor, '#10B981');
});

test('stale or unavailable BatteryResponse must not invent percent from raw millivolts or stale RobotDto', () => {
  const staleDisplay = formatRobotBatteryDisplay(
    {
      robotId: 'robot-1',
      batteryRaw: 7850,
      batteryUnit: 'MILLIVOLT',
      voltageV: null,
      batteryPercent: null,
      estimateStatus: 'STALE',
      fresh: false,
      ageSec: 185,
    },
    {
      robotId: 'robot-1',
      batteryPercent: 95,
      batteryRaw: 7850,
    }
  );

  assert.equal(staleDisplay.percentText, '--');
  assert.equal(staleDisplay.voltageText, '--');
  assert.equal(staleDisplay.rawText, '7850 mV');
  assert.equal(staleDisplay.badgeText, 'Cũ (--)');
  assert.equal(staleDisplay.detailText, '--');
  assert.equal(staleDisplay.tintColor, '#F59E0B');
});

test('RAW_ADC without batteryPercent displays ADC raw label instead of bogus percent', () => {
  const adcDisplay = formatRobotBatteryDisplay(
    {
      robotId: 'robot-1',
      batteryRaw: 2048,
      batteryUnit: 'RAW_ADC',
      voltageV: null,
      batteryPercent: null,
      fresh: true,
    },
    null
  );

  assert.equal(adcDisplay.percentText, '--');
  assert.equal(adcDisplay.rawText, 'ADC 2048');
  assert.equal(adcDisplay.badgeText, '--');
  assert.equal(adcDisplay.subText, 'ADC 2048');
});

test('ignores BatteryResponse belonging to a different robotId and handles invalid numbers', () => {
  assert.equal(finiteBatteryNumber(null), null);
  assert.equal(finiteBatteryNumber('  '), null);
  assert.equal(finiteBatteryNumber(NaN), null);
  assert.equal(finiteBatteryNumber('82.5'), 82.5);

  const norm = normalizeRobotBattery(
    {
      robotId: 'robot-OTHER',
      batteryPercent: 99,
      voltageV: 12.6,
      fresh: true,
    },
    {
      robotId: 'robot-CURRENT',
      batteryPercent: 18,
      batteryRaw: 7200,
      batteryUnit: 'MILLIVOLT',
    }
  );

  assert.equal(norm.isFromBatteryApi, false);
  assert.equal(norm.percent, 18);
  assert.equal(norm.voltageV, 7.2);

  const display = formatRobotBatteryDisplay(
    { robotId: 'robot-OTHER', batteryPercent: 99 },
    { robotId: 'robot-CURRENT', batteryPercent: 18, batteryRaw: 7200, batteryUnit: 'MILLIVOLT' }
  );
  assert.equal(display.tintColor, '#EF4444');
  assert.equal(display.badgeText, '18% · 7.2V');

  const outOfRange = normalizeRobotBattery(
    { robotId: 'robot-1', batteryPercent: 150, voltageV: -2 },
    null
  );
  assert.equal(outOfRange.percent, null);
  assert.equal(outOfRange.voltageV, null);
});

test('pickNewerRobotBattery selects latest timestamp for matching robotId', () => {
  const older = {
    robotId: 'r-1',
    batteryPercent: 60,
    capturedAt: '2026-11-16T02:00:00Z',
  };
  const newer = {
    robotId: 'r-1',
    batteryPercent: 62,
    capturedAt: '2026-11-16T02:00:10Z',
  };
  const wrongRobot = {
    robotId: 'r-2',
    batteryPercent: 100,
    capturedAt: '2026-11-16T02:05:00Z',
  };

  assert.equal(pickNewerRobotBattery(older, newer, 'r-1').batteryPercent, 62);
  assert.equal(pickNewerRobotBattery(newer, wrongRobot, 'r-1').batteryPercent, 62);
});

test('API module, MapScreen, Monitor modal, Camera HUD, and SOSStreamModal all wire /battery cleanly', () => {
  const read = (rel) => fs.readFileSync(path.resolve(__dirname, '..', rel), 'utf8');

  assert.match(read('src/api/endpoints.ts'), /BATTERY:\s*\(id:\s*string\)\s*=>\s*`\/robots\/\$\{id\}\/battery`/);
  assert.match(read('src/api/modules/robot.api.ts'), /getRobotBattery[\s\S]*ENDPOINTS\.ROBOTS\.BATTERY\(id\)/);
  assert.match(read('src/screens/main/MapScreen.tsx'), /robotApi\.getRobotBattery\(robotId\)/);
  assert.match(read('src/components/map/BackendRobotMonitorModal.tsx'), /robotApi\.getRobotBattery/);
  assert.match(read('src/components/camera/RobotCameraStreamView.tsx'), /formatRobotBatteryDisplay/);

  const sosStream = read('src/components/sos/SOSStreamModal.tsx');
  assert.doesNotMatch(sosStream, />78%</);
  assert.match(sosStream, /robotApi\s*\.getRobotBattery/);
});
