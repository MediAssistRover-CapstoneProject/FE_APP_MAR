export type AppLifecycleState = 'active' | 'background' | 'inactive' | string;

export interface MapPollingInput {
  isFocused: boolean;
  isMonitorOpen: boolean;
  appState: AppLifecycleState;
  robotStatus?: string | null;
  hasActiveJob: boolean;
}

export interface MapPollingPlan {
  active: boolean;
  intervalMs: number;
}

export const MAP_BUSY_POLL_MS = 3000;
export const MAP_IDLE_POLL_MS = 6000;
export const BATTERY_REFRESH_INTERVAL_MS = 15000;
export const LOCATION_HISTORY_FALLBACK_COOLDOWN_MS = 15000;

export const ALERT_FOCUSED_POLL_MS = 5000;
export const ALERT_BACKGROUND_POLL_MS = 6000;
export const ALERT_FOCUSED_PAGE_SIZE = 30;
export const ALERT_BACKGROUND_PAGE_SIZE = 20;

export const MISSION_FAST_POLL_MS = 1500;
export const MISSION_NORMAL_POLL_MS = 3500;
export const QR_JOB_POLL_MS = 1500;
export const QR_WAITING_POLL_MS = 4000;
export const MQTT_PREVIEW_POLL_MS = 2500;

/**
 * Quyết định chu kỳ poll cho MapScreen:
 * - Tạm dừng hoàn toàn khi app xuống nền hoặc người dùng chuyển sang tab khác (trừ khi modal Giám sát đang mở).
 * - Khi đang mở Map và robot di chuyển (`BUSY`/`STARTING`/có job) giữ nguyên 3s để tọa độ mượt; khi đứng yên giãn nhẹ 6s.
 */
export function getMapPollingPlan(input: MapPollingInput): MapPollingPlan {
  const isForeground = input.appState === 'active';
  if (!isForeground || (!input.isFocused && !input.isMonitorOpen)) {
    return { active: false, intervalMs: 0 };
  }
  const isMovingOrMonitored =
    input.isMonitorOpen ||
    input.hasActiveJob ||
    input.robotStatus === 'BUSY' ||
    input.robotStatus === 'STARTING';
  return {
    active: true,
    intervalMs: isMovingOrMonitored ? MAP_BUSY_POLL_MS : MAP_IDLE_POLL_MS,
  };
}

/** Chỉ gọi lại `/robots/{id}/battery` mỗi 15s (trừ khi ép làm mới hoặc đổi robot). */
export function shouldFetchBatteryTelemetry(
  lastFetchedAt: number | null | undefined,
  nowMs: number,
  forceRefresh = false
): boolean {
  if (forceRefresh || typeof lastFetchedAt !== 'number' || !Number.isFinite(lastFetchedAt)) {
    return true;
  }
  return nowMs - lastFetchedAt >= BATTERY_REFRESH_INTERVAL_MS;
}

/** Nếu `snapshot` trả về 200 OK nhưng chưa có pose, tránh lặp `/location-history` mỗi 3s. */
export function shouldFetchLocationHistoryFallback(
  snapshotSucceeded: boolean,
  lastFallbackAt: number | null | undefined,
  nowMs: number
): boolean {
  if (!snapshotSucceeded) return true;
  if (typeof lastFallbackAt !== 'number' || !Number.isFinite(lastFallbackAt)) {
    return true;
  }
  return nowMs - lastFallbackAt >= LOCATION_HISTORY_FALLBACK_COOLDOWN_MS;
}

export interface AlertPollingPlan {
  mode: 'PAUSED' | 'FOCUSED_LIST' | 'BACKGROUND_WATCHDOG';
  intervalMs: number;
  pageSize: number;
}

/**
 * Khi đang mở tab Cảnh báo: tải trang mới nhất (30 bản ghi) mỗi 5s.
 * Khi ở tab khác: chuyển sang watchdog siêu nhẹ (chỉ cảnh báo `OPEN` + `media-sessions` mỗi 6s) để bắt SOS tức thì mà không kéo lại lịch sử cũ.
 */
export function getAlertPollingPlan(input: {
  isFocused: boolean;
  appState: AppLifecycleState;
}): AlertPollingPlan {
  if (input.appState !== 'active') {
    return { mode: 'PAUSED', intervalMs: 0, pageSize: 0 };
  }
  if (input.isFocused) {
    return {
      mode: 'FOCUSED_LIST',
      intervalMs: ALERT_FOCUSED_POLL_MS,
      pageSize: ALERT_FOCUSED_PAGE_SIZE,
    };
  }
  return {
    mode: 'BACKGROUND_WATCHDOG',
    intervalMs: ALERT_BACKGROUND_POLL_MS,
    pageSize: ALERT_BACKGROUND_PAGE_SIZE,
  };
}

export interface MissionPollingPlan {
  active: boolean;
  intervalMs: number;
}

const FAST_HANDOFF_STEPS = new Set([
  'UNLOCK_SENDER',
  'UNLOCK_RECEIVER',
  'LOCK_SENDER',
  'LOCK_RECEIVER',
]);

/**
 * Điều phối poll cho MissionScreen:
 * - Tạm dừng khi app nền, không ở tab Nhiệm vụ, đơn không chạy, hoặc đang mở QRScannerModal (modal tự poll 1.5s tránh bắn trùng).
 * - Nhanh 1.5s lúc vừa quét QR / đang mở-khóa Servo; 3.5s ở các bước còn lại.
 */
export function getMissionPollingPlan(input: {
  isFocused: boolean;
  appState: AppLifecycleState;
  jobStatus?: string | null;
  stepCode?: string | null;
  isQrModalOpen: boolean;
  hasRecentQrVerified: boolean;
  hasPendingResponseButton: boolean;
}): MissionPollingPlan {
  if (
    input.appState !== 'active' ||
    !input.isFocused ||
    input.isQrModalOpen ||
    !input.jobStatus ||
    !['QUEUED', 'ACCEPTED', 'RUNNING'].includes(input.jobStatus)
  ) {
    return { active: false, intervalMs: 0 };
  }

  const waitingForHardware =
    (input.stepCode ? FAST_HANDOFF_STEPS.has(input.stepCode) : false) ||
    (input.hasRecentQrVerified && !input.hasPendingResponseButton);

  return {
    active: true,
    intervalMs: waitingForHardware ? MISSION_FAST_POLL_MS : MISSION_NORMAL_POLL_MS,
  };
}

