export const API_BASE_URL =
  process.env.EXPO_PUBLIC_ROBOT_API_URL || 'https://bemar-production.up.railway.app';

export const DEFAULT_ROBOT_CODE =
  process.env.EXPO_PUBLIC_ROBOT_CODE || 'ROBOT_001';

export const DEFAULT_DEVICE_SECRET =
  process.env.EXPO_PUBLIC_ROBOT_SECRET || 'dev_secret_mar_2026';

let sequenceCounter = 1;

export function getNextSequence(): number {
  return sequenceCounter++;
}

/**
 * Universal UUID v4 generator for Expo Go across iOS, Android, and Web
 */
export function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if randomUUID fails in some sandboxes
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
