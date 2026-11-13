const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../src/components/map/robotPose.ts'), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
new Function('module', 'exports', js)(loaded, loaded.exports);
const { normalizeRobotPose } = loaded.exports;

test('HTTP 200 with null or missing coordinates must not create an origin position', () => {
  for (const value of [null, undefined, '', '   ', false, NaN, Infinity, 'bad', 'Infinity']) {
    assert.equal(normalizeRobotPose({ xM: value, yM: 1 }), null);
    assert.equal(normalizeRobotPose({ xM: 1, yM: value }), null);
  }
  assert.equal(normalizeRobotPose(null), null);
  assert.equal(normalizeRobotPose({}), null);
});
test('real zero and negative coordinates remain valid and can be formatted', () => {
  const pose = normalizeRobotPose({ xM: 0, yM: -0.26, yawRad: 1.1, robotId: 'robot-A', fresh: false });
  assert.equal(pose.xM.toFixed(2), '0.00');
  assert.equal(pose.yM.toFixed(2), '-0.26');
  assert.equal(pose.robotId, 'robot-A');
  assert.equal(pose.fresh, false);
});
test('numeric JSON strings are normalized before rendering toFixed', () => {
  const pose = normalizeRobotPose({ xM: '0.15', yM: '-0.26', yawRad: '1.57' });
  assert.equal(pose.xM.toFixed(2), '0.15');
  assert.equal(pose.yawRad, 1.57);
});
test('missing heading retains existing map fallback without admitting missing position', () => {
  assert.equal(normalizeRobotPose({ xM: 1, yM: 2, yawRad: null }).yawRad, 0);
  assert.equal(normalizeRobotPose({ xM: null, yM: 2, yawRad: null }), null);
});
