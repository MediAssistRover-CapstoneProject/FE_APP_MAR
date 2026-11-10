import { UUID_PATTERN, type DeliveryScanContext } from './deliveryHandoff';

const BASE64_URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SIGNED_PROOF = /^MARQR1\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]{43}$/;

// The signed payload contains ASCII UUIDs, a purpose, and a timestamp.
function decodeClaims(encoded: string): string {
  let text = '';
  let remainder = 0;
  let bits = 0;
  for (const character of encoded) {
    remainder = (remainder << 6) | BASE64_URL.indexOf(character);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      text += String.fromCharCode(remainder >> bits);
      remainder &= (1 << bits) - 1;
    }
  }
  return text;
}

export function robotDeliveryProof(raw: string, context: DeliveryScanContext, now = Date.now()): string {
  const proof = raw.trim();
  const encoded = proof.length <= 256 ? SIGNED_PROOF.exec(proof)?.[1] : undefined;
  if (!encoded) throw new Error('Mã này không phải QR giao nhận hiển thị trên robot.');

  const claims = decodeClaims(encoded).split('|');
  const [challengeId, jobId, stepId, purpose, expires] = claims;
  const expiresAt = Number(expires) * 1000;
  if (claims.length !== 5 || ![challengeId, jobId, stepId].every(id => UUID_PATTERN.test(id)) ||
      !['DELIVERY_SENDER', 'DELIVERY_RECEIVER'].includes(purpose) ||
      !/^\d+$/.test(expires) || !Number.isSafeInteger(expiresAt)) {
    throw new Error('Nội dung mã QR giao nhận không hợp lệ.');
  }
  if (jobId !== context.jobId || stepId !== context.stepId || purpose !== context.purpose) {
    throw new Error('Mã QR không thuộc nhiệm vụ và chặng đang chọn.');
  }
  if (expiresAt <= now) throw new Error('Mã QR đã hết hạn. Hãy kiểm tra trạng thái trên robot.');
  // The API checks the signature, assignment, one-time use, and live step.
  return proof;
}
