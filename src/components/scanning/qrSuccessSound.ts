const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;

    out += BASE64_CHARS[b0 >> 2];
    out += BASE64_CHARS[((b0 & 0x03) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? BASE64_CHARS[((b1 & 0x0f) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? BASE64_CHARS[b2 & 0x3f] : '=';
  }
  return out;
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

/**
 * Tạo chuỗi Base64 của file WAV PCM 16-bit mono phát âm thanh "ting" thông báo thành công.
 * Không phụ thuộc thư viện native âm thanh ngoài, chạy đồng nhất trên Android, iOS, Web và Node.
 */
export function buildSuccessChimeWavBase64(): string {
  const sampleRate = 22050;
  const durationSec = 0.46;
  const numSamples = Math.floor(sampleRate * durationSec);
  const dataBytes = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  // Header RIFF/WAVE PCM 16-bit mono
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;

    // Nốt 1 (880 Hz -> "tin"): khởi phát sắc nét và ngân nhẹ
    const env1 = t < 0.004 ? t / 0.004 : Math.exp(-t * 14);
    const tone1 =
      (Math.sin(2 * Math.PI * 880 * t) + 0.32 * Math.sin(2 * Math.PI * 1760 * t)) * env1;

    // Nốt 2 (1318.5 Hz -> "ting" sáng rõ ở giây 0.095)
    let tone2 = 0;
    if (t >= 0.095) {
      const t2 = t - 0.095;
      const env2 = t2 < 0.004 ? t2 / 0.004 : Math.exp(-t2 * 9.5);
      tone2 =
        (Math.sin(2 * Math.PI * 1318.5 * t2) + 0.28 * Math.sin(2 * Math.PI * 2637 * t2)) * env2;
    }

    const mixed = Math.max(-1, Math.min(1, (tone1 * 0.42 + tone2 * 0.58) * 0.85));
    view.setInt16(44 + i * 2, Math.round(mixed * 32767), true);
  }

  return bytesToBase64(new Uint8Array(buffer));
}

const CHIME_WAV_DATA_URI = `data:audio/wav;base64,${buildSuccessChimeWavBase64()}`;

export function getSuccessChimeDataUri(): string {
  return CHIME_WAV_DATA_URI;
}

/** HTML nhẹ nhúng trong WebView ẩn để phát tiếng "ting" tức thì qua <audio> hoặc WebAudio. */
export const QR_SUCCESS_AUDIO_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:transparent;">
  <audio id="qr-chime" preload="auto" playsinline src="${CHIME_WAV_DATA_URI}"></audio>
  <script>
    (function () {
      var audioEl = document.getElementById('qr-chime');
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      var sharedCtx = null;

      function playOscillatorFallback() {
        try {
          if (!AudioCtx) return false;
          sharedCtx = sharedCtx || new AudioCtx();
          if (sharedCtx.state === 'suspended' && typeof sharedCtx.resume === 'function') {
            sharedCtx.resume().catch(function () {});
          }
          var now = sharedCtx.currentTime;
          var notes = [
            { freq: 880, start: 0, dur: 0.16, peak: 0.28 },
            { freq: 1318.5, start: 0.095, dur: 0.34, peak: 0.36 }
          ];
          for (var i = 0; i < notes.length; i += 1) {
            var n = notes[i];
            var osc = sharedCtx.createOscillator();
            var gain = sharedCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(n.freq, now + n.start);
            gain.gain.setValueAtTime(0.0001, now + n.start);
            gain.gain.exponentialRampToValueAtTime(n.peak, now + n.start + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur);
            osc.connect(gain);
            gain.connect(sharedCtx.destination);
            osc.start(now + n.start);
            osc.stop(now + n.start + n.dur + 0.02);
          }
          return true;
        } catch (e) {
          return false;
        }
      }

      window.playQrSuccessChime = function () {
        try {
          if (audioEl && typeof audioEl.play === 'function') {
            audioEl.currentTime = 0;
            var p = audioEl.play();
            if (p && typeof p.catch === 'function') {
              p.catch(function () {
                playOscillatorFallback();
              });
            }
            return true;
          }
        } catch (err) {}
        return playOscillatorFallback();
      };
    })();
  </script>
</body>
</html>`;

/** Phát âm thanh "ting" trực tiếp trên trình duyệt Web (Expo Web). */
export function playWebSuccessChime(): void {
  try {
    const AudioCtor = (globalThis as any)?.Audio;
    if (typeof AudioCtor === 'function') {
      const audio = new AudioCtor(CHIME_WAV_DATA_URI);
      const res = audio.play?.();
      if (res && typeof res.catch === 'function') {
        res.catch(() => {});
      }
      return;
    }
    const Ctx = (globalThis as any)?.AudioContext || (globalThis as any)?.webkitAudioContext;
    if (typeof Ctx === 'function') {
      const ctx = new Ctx();
      const now = ctx.currentTime;
      [880, 1318.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = idx * 0.095;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.3, now + start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + 0.3);
      });
    }
  } catch {
    // Bỏ qua nếu môi trường chặn audio API
  }
}
