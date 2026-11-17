import { apiClient } from '../client';
import { useAuthStore } from '../../store/useAuthStore';

// ─── Media Session Types (Khớp FE_WEB_MAR robotCamera.js & LiveMapping.jsx) ───

export type MediaSessionMode = 'MONITOR' | 'ASSIST';

export type MediaSessionStatus =
  | 'RINGING'
  | 'CONNECTING'
  | 'ACTIVE'
  | 'RECONNECTING'
  | 'ENDED'
  | 'FAILED'
  | 'EXPIRED';

export interface MediaConfigurationResponse {
  enabled: boolean;
  url?: string;
  videoWidth?: number;
  videoHeight?: number;
  videoFps?: number;
  recordingEnabled?: boolean;
  internalTls?: boolean;
}

/** Khớp record MediaSessionService.View trên BE */
export interface MediaSessionResponse {
  sessionId: string;
  robotId: string;
  incidentId?: string | null;
  staffAccountId?: string | null;
  mode: MediaSessionMode;
  state: MediaSessionStatus;
  createdAt?: string;
  expiresAt?: string;
  deviceSeenAt?: string | null;
  endedAt?: string | null;
  endReason?: string | null;
}

export interface MediaSessionJoinToken {
  url: string;
  room: string;
  identity: string;
  token: string;
  expiresAt?: string;
  session?: MediaSessionResponse;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
}

export interface CreateMediaSessionRequest {
  robotId: string;
  mode: MediaSessionMode;
  incidentId?: string;
}

export interface JobCameraPreviewResult {
  status: number;
  dataUri: string | null;
  capturedAt: string | null;
  revision: string | null;
}

export interface CameraViewerAuth {
  token: string;
  accountId: string;
  role: string;
}

// ─── Helpers kiểm tra phiên mở (Khớp FE_WEB_MAR src/features/media/robotCamera.js) ───

const OPEN_STATES = new Set<string>(['RINGING', 'CONNECTING', 'ACTIVE', 'RECONNECTING']);
const UUID_REGEX = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export const isOpenCameraSession = (
  session?: MediaSessionResponse | null,
  now = Date.now()
): boolean => {
  if (!session?.sessionId || !UUID_REGEX.test(session.sessionId)) return false;
  if (!OPEN_STATES.has(session.state)) return false;
  if (!session.expiresAt) return true;
  return Date.parse(session.expiresAt) > now;
};

export const isOwnMonitorSession = (
  session: MediaSessionResponse | null | undefined,
  robotId: string,
  accountId?: string | null
): boolean => {
  return Boolean(
    session &&
      session.robotId === robotId &&
      session.mode === 'MONITOR' &&
      !session.incidentId &&
      (!accountId || session.staffAccountId === accountId)
  );
};

// ─── Endpoints (Đồng bộ với FE_WEB_MAR robotCamera.js & LiveMapping.jsx) ─────

const MEDIA_ENDPOINTS = {
  CONFIGURATION: '/media/configuration',
  LIST: '/media-sessions',
  CREATE: '/media-sessions',
  DETAIL: (id: string) => `/media-sessions/${encodeURIComponent(id)}`,
  ACCEPT: (id: string) => `/media-sessions/${encodeURIComponent(id)}/accept`,
  JOIN_TOKEN: (id: string) => `/media-sessions/${encodeURIComponent(id)}/join-token`,
  END: (id: string) => `/media-sessions/${encodeURIComponent(id)}/end`,
  JOB_CAMERA_PREVIEW: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/camera-preview.jpg`,
  JOB_MAPPING_PREVIEW: (jobId: string) => `/jobs/${encodeURIComponent(jobId)}/mapping-preview.png`,
  JOB_MAPPING_SESSION: (jobId: string) =>
    `/jobs/${encodeURIComponent(jobId)}/mapping-session?includePreview=false`,
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < len ? bytes[i + 1] : 0;
    const b3 = i + 2 < len ? bytes[i + 2] : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 3) << 4) | (b2 >> 4)];
    result += i + 1 < len ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < len ? chars[b3 & 63] : '=';
  }
  return result;
}

function buildAuthHeader(customToken?: string): Record<string, string> | undefined {
  if (!customToken) return undefined;
  return { Authorization: `Bearer ${customToken}` };
}

// ─── API Module ──────────────────────────────────────────────────────────────

export const mediaSessionApi = {
  /**
   * Lấy thông tin xác thực của tài khoản Staff hiện tại để mở Camera MONITOR & xem camera-preview.jpg.
   * Dùng trực tiếp phiên đăng nhập của Staff (BE_MAR d77fe7f đã cấp quyền MONITOR cho vai trò Staff không cần incident).
   */
  async acquireCameraViewerAuth(): Promise<CameraViewerAuth> {
    const currentState = useAuthStore.getState();
    const currentToken = apiClient.getToken() || currentState.token;
    const currentUser = currentState.user;

    if (currentToken && currentUser?.accountId) {
      return {
        token: currentToken,
        accountId: currentUser.accountId,
        role: currentUser.role || 'STAFF',
      };
    }

    if (currentToken) {
      return {
        token: currentToken,
        accountId: '',
        role: currentUser?.role || 'STAFF',
      };
    }

    throw new Error('Chưa có phiên xác thực hợp lệ. Vui lòng đăng nhập tài khoản nhân viên để xem camera robot.');
  },

  /**
   * 1. Kiểm tra cấu hình dịch vụ media trực tiếp (GET /api/v1/media/configuration)
   * Khớp FE_WEB_MAR src/features/media/robotCamera.js
   */
  async getConfiguration(customToken?: string): Promise<MediaConfigurationResponse> {
    return apiClient.get<MediaConfigurationResponse>(
      MEDIA_ENDPOINTS.CONFIGURATION,
      buildAuthHeader(customToken)
    );
  },

  /**
   * 2. Danh sách media sessions đang mở (GET /api/v1/media-sessions)
   */
  async getSessions(customToken?: string): Promise<MediaSessionResponse[]> {
    return apiClient.get<MediaSessionResponse[]>(
      MEDIA_ENDPOINTS.LIST,
      buildAuthHeader(customToken)
    );
  },

  /**
   * 3. Tạo phiên media mới (POST /api/v1/media-sessions)
   * Mode MONITOR: xem camera trực tiếp không làm dừng nhiệm vụ của robot.
   * Mode ASSIST: đàm thoại 2 chiều khẩn cấp.
   */
  async createSession(
    body: CreateMediaSessionRequest,
    customToken?: string
  ): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(
      MEDIA_ENDPOINTS.CREATE,
      body,
      buildAuthHeader(customToken)
    );
  },

  /**
   * 4. Chi tiết 1 phiên (GET /api/v1/media-sessions/{sessionId})
   */
  async getSession(sessionId: string, customToken?: string): Promise<MediaSessionResponse> {
    return apiClient.get<MediaSessionResponse>(
      MEDIA_ENDPOINTS.DETAIL(sessionId),
      buildAuthHeader(customToken)
    );
  },

  /**
   * 5. Nhận phiên (POST /api/v1/media-sessions/{sessionId}/accept)
   */
  async acceptSession(sessionId: string, customToken?: string): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(
      MEDIA_ENDPOINTS.ACCEPT(sessionId),
      {},
      buildAuthHeader(customToken)
    );
  },

  /**
   * 6. Lấy LiveKit join token (POST /api/v1/media-sessions/{sessionId}/join-token)
   */
  async getJoinToken(sessionId: string, customToken?: string): Promise<MediaSessionJoinToken> {
    return apiClient.post<MediaSessionJoinToken>(
      MEDIA_ENDPOINTS.JOIN_TOKEN(sessionId),
      {},
      buildAuthHeader(customToken)
    );
  },

  /**
   * 7. Kết thúc phiên (POST /api/v1/media-sessions/{sessionId}/end)
   */
  async endSession(
    sessionId: string,
    reason = 'MONITOR_VIEW_CLOSED',
    customToken?: string
  ): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(
      MEDIA_ENDPOINTS.END(sessionId),
      { reason },
      buildAuthHeader(customToken)
    );
  },

  /**
   * 8. Lấy ảnh camera snapshot từ phiên quét map / nhiệm vụ của robot qua MQTT
   * (GET /api/v1/jobs/{jobId}/camera-preview.jpg) — Khớp LiveMapping.jsx trên FE_WEB_MAR
   */
  async fetchJobCameraPreview(
    jobId: string,
    customToken?: string
  ): Promise<JobCameraPreviewResult> {
    const baseUrl = apiClient.getBaseUrl();
    const token = customToken || apiClient.getToken();
    const url = `${baseUrl}${MEDIA_ENDPOINTS.JOB_CAMERA_PREVIEW(jobId)}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'image/jpeg, */*',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      });

      if (res.status === 204) {
        return {
          status: 204,
          dataUri: null,
          capturedAt: null,
          revision: null,
        };
      }

      if (!res.ok) {
        return {
          status: res.status,
          dataUri: null,
          capturedAt: null,
          revision: null,
        };
      }

      const buffer = await res.arrayBuffer();
      if (!buffer || buffer.byteLength === 0) {
        return {
          status: 204,
          dataUri: null,
          capturedAt: null,
          revision: null,
        };
      }

      const base64 = arrayBufferToBase64(buffer);
      return {
        status: 200,
        dataUri: `data:image/jpeg;base64,${base64}`,
        capturedAt: res.headers.get('X-Captured-At'),
        revision: res.headers.get('X-Frame-Revision'),
      };
    } catch {
      return {
        status: 0,
        dataUri: null,
        capturedAt: null,
        revision: null,
      };
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * 9. Tìm Job ID đang chạy (RUNNING / QUEUED) hoặc mới nhất của robot để lấy camera-preview.jpg
   */
  async findRobotActiveOrLatestJobId(
    robotId: string,
    customToken?: string
  ): Promise<string | null> {
    try {
      const snapshot = await apiClient.get<{ activeJobId?: string | null }>(
        `/robots/${encodeURIComponent(robotId)}/snapshot`,
        buildAuthHeader(customToken)
      );
      if (snapshot?.activeJobId) {
        return snapshot.activeJobId;
      }
    } catch {
      // Bỏ qua lỗi snapshot
    }

    try {
      const jobsPage = await apiClient.get<{
        content?: Array<{ jobId: string; robotId?: string; status?: string }>;
      }>('/jobs?size=10&sort=createdAt,desc', buildAuthHeader(customToken));
      const list = jobsPage?.content || [];
      const running = list.find(
        (j) => j.robotId === robotId && (j.status === 'RUNNING' || j.status === 'ACCEPTED')
      );
      if (running?.jobId) return running.jobId;
      const latestForRobot = list.find((j) => j.robotId === robotId);
      return latestForRobot?.jobId || null;
    } catch {
      return null;
    }
  },
};
