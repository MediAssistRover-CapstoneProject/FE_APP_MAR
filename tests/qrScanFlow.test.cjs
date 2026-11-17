const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function loadTs(relPath) {
  const fullPath = path.resolve(__dirname, '..', relPath);
  const src = fs.readFileSync(fullPath, 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require);
  return mod.exports;
}

const { isAuthStepCompleted } = loadTs('src/screens/main/deliveryHandoff.ts');
const {
  buildSuccessChimeWavBase64,
  getSuccessChimeDataUri,
  QR_SUCCESS_AUDIO_HTML,
  playWebSuccessChime,
} = loadTs('src/components/scanning/qrSuccessSound.ts');

test('isAuthStepCompleted detects verified AUTH_SENDER & AUTH_RECEIVER and fails closed on cancel/interrupt', () => {
  const stepId = 'step-auth-1';
  const baseJob = {
    jobId: 'job-1',
    status: 'RUNNING',
    selectedJobStepId: 'step-unlock-1',
    steps: [
      {
        jobStepId: stepId,
        stepCodeSnapshot: 'AUTH_SENDER',
        stepTypeSnapshot: 'AUTHENTICATE',
        status: 'SUCCEEDED',
        resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_SENDER' },
      },
      {
        jobStepId: 'step-unlock-1',
        stepCodeSnapshot: 'UNLOCK_SENDER',
        stepTypeSnapshot: 'CONTROL_HARDWARE',
        status: 'RUNNING',
      },
    ],
  };

  assert.equal(isAuthStepCompleted(baseJob, stepId, 'DELIVERY_SENDER'), true);
  assert.equal(isAuthStepCompleted(baseJob, stepId, 'DELIVERY_RECEIVER'), false);

  const receiverJob = {
    jobId: 'job-2',
    status: 'RUNNING',
    selectedJobStepId: 'step-unlock-2',
    tasks: [
      {
        jobTaskId: 'task-1',
        steps: [
          {
            jobStepId: 'step-auth-2',
            stepCodeSnapshot: 'AUTH_RECEIVER',
            stepTypeSnapshot: 'AUTHENTICATE',
            status: 'SUCCEEDED',
            resolvedInputsJson: { method: 'QR_CODE', purpose: 'DELIVERY_RECEIVER' },
          },
        ],
      },
    ],
  };
  assert.equal(isAuthStepCompleted(receiverJob, 'step-auth-2', 'DELIVERY_RECEIVER'), true);

  for (const status of ['CANCELLED', 'FAILED', 'RECOVERY_REQUIRED', 'QUEUED']) {
    assert.equal(isAuthStepCompleted({ ...baseJob, status }, stepId, 'DELIVERY_SENDER'), false);
  }
  assert.equal(
    isAuthStepCompleted({ ...baseJob, cancelRequestedAt: '2026-11-16T00:00:00Z' }, stepId, 'DELIVERY_SENDER'),
    false
  );
  assert.equal(
    isAuthStepCompleted(
      {
        ...baseJob,
        steps: [{ ...baseJob.steps[0], interruptionRequestedAt: '2026-11-16T00:00:00Z' }],
      },
      stepId,
      'DELIVERY_SENDER'
    ),
    false
  );
  assert.equal(
    isAuthStepCompleted(
      {
        ...baseJob,
        steps: [{ ...baseJob.steps[0], status: 'RUNNING' }],
      },
      stepId,
      'DELIVERY_SENDER'
    ),
    false
  );
});

test('buildSuccessChimeWavBase64 generates valid PCM RIFF/WAVE binary and WebView HTML triggers chime cleanly', async () => {
  const b64 = buildSuccessChimeWavBase64();
  const wav = Buffer.from(b64, 'base64');

  assert.equal(wav.toString('ascii', 0, 4), 'RIFF');
  assert.equal(wav.toString('ascii', 8, 12), 'WAVE');
  assert.equal(wav.toString('ascii', 12, 16), 'fmt ');
  assert.equal(wav.toString('ascii', 36, 40), 'data');
  assert.ok(wav.length > 10000);
  assert.match(getSuccessChimeDataUri(), /^data:audio\/wav;base64,/);

  // Kiểm tra peak âm thanh không bị rỗng
  let maxSample = 0;
  for (let offset = 44; offset + 1 < wav.length; offset += 2) {
    maxSample = Math.max(maxSample, Math.abs(wav.readInt16LE(offset)));
  }
  assert.ok(maxSample > 10000, 'Expected audible chime PCM waveform');

  // Mô phỏng chạy script trong QR_SUCCESS_AUDIO_HTML
  const scriptMatch = QR_SUCCESS_AUDIO_HTML.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch);
  let audioPlayCalls = 0;
  const fakeAudioEl = {
    currentTime: 5,
    play: () => {
      audioPlayCalls += 1;
      return Promise.resolve();
    },
  };
  const win = {
    document: { getElementById: (id) => (id === 'qr-chime' ? fakeAudioEl : null) },
  };
  win.window = win;
  vm.runInNewContext(scriptMatch[1], win);
  const ok = win.playQrSuccessChime();
  assert.equal(ok, true);
  assert.equal(audioPlayCalls, 1);
  assert.equal(fakeAudioEl.currentTime, 0);

  // Test fallback playWebSuccessChime với Audio mock
  let webPlays = 0;
  globalThis.Audio = function MockAudio(uri) {
    assert.ok(uri.startsWith('data:audio/wav;base64,'));
    return {
      play: () => {
        webPlays += 1;
        return Promise.resolve();
      },
    };
  };
  try {
    playWebSuccessChime();
    assert.equal(webPlays, 1);
  } finally {
    delete globalThis.Audio;
  }
});

test('QRScannerModal and MissionScreen wire green tick, chime sound, and redirect to pickup/delivery confirm & close servo', () => {
  const modalSrc = fs.readFileSync(
    path.resolve(__dirname, '../src/components/scanning/QRScannerModal.tsx'),
    'utf8'
  );
  const missionSrc = fs.readFileSync(
    path.resolve(__dirname, '../src/screens/main/MissionScreen.tsx'),
    'utf8'
  );

  // Modal hỗ trợ tick xanh + âm báo + auto redirect cho cả Tab 1 (Robot quét) & Tab 2 (Camera điện thoại quét)
  assert.match(modalSrc, /isAuthStepCompleted\(jobSnapshot,\s*stepId,\s*purpose\)/);
  assert.match(modalSrc, /dispatchApi\.getJobDetail\(jobId\)/);
  assert.match(modalSrc, /Vibration\.vibrate/);
  assert.match(modalSrc, /playQrSuccessChime/);
  assert.match(modalSrc, /<Check\s+size=\{52\}/);
  assert.match(modalSrc, /Quét QR nhận hàng thành công!/);
  assert.match(modalSrc, /Quét QR giao hàng thành công!/);
  assert.match(modalSrc, /QR_VERIFIED_REDIRECT_DELAY_MS/);

  // MissionScreen chuyển hướng/cuộn đúng chỗ nút xác nhận lấy/bỏ hàng & đóng servo
  assert.match(missionSrc, /onQrVerified=\{.*?handleQrVerifiedRedirect/);
  assert.match(missionSrc, /scrollToHandoffControls/);
  assert.match(missionSrc, /Xác nhận đã bỏ hàng vào thùng/);
  assert.match(missionSrc, /Xác nhận đã lấy \/ giao hàng/);
  assert.match(missionSrc, /Đã đóng nắp — Đóng khóa Servo/);
});
