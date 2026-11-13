import { apiClient } from '../client';


// â”€â”€â”€ Media Session Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type MediaSessionMode = 'MONITOR' | 'ASSIST';

export type MediaSessionStatus =
  | 'RINGING'
  | 'CONNECTING'
  | 'ACTIVE'
  | 'RECONNECTING'
  | 'ENDED'
  | 'FAILED'
  | 'EXPIRED';

/** Khá»›p record MediaSessionService.View trÃªn BE */
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
}

export interface CreateMediaSessionRequest {
  robotId: string;
  mode: MediaSessionMode;
  incidentId?: string;
}

// â”€â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MEDIA_ENDPOINTS = {
  LIST: '/media-sessions',
  CREATE: '/media-sessions',
  DETAIL: (id: string) => `/media-sessions/${id}`,
  ACCEPT: (id: string) => `/media-sessions/${id}/accept`,
  JOIN_TOKEN: (id: string) => `/media-sessions/${id}/join-token`,
  END: (id: string) => `/media-sessions/${id}/end`,
};

// â”€â”€â”€ API Module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const mediaSessionApi = {
  /**
   * Danh sÃ¡ch media sessions mÃ  tÃ i khoáº£n Ä‘Æ°á»£c phÃ©p xem (BE tráº£ vá» máº£ng, khÃ´ng phÃ¢n trang)
   */
  async getSessions(): Promise<MediaSessionResponse[]> {
    return apiClient.get<MediaSessionResponse[]>(MEDIA_ENDPOINTS.LIST);
  },

  /**
   * Táº¡o phiÃªn media má»›i (MONITOR / ASSIST)
   */
  async createSession(body: CreateMediaSessionRequest): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(MEDIA_ENDPOINTS.CREATE, body);
  },

  /**
   * Chi tiáº¿t 1 phiÃªn
   */
  async getSession(sessionId: string): Promise<MediaSessionResponse> {
    return apiClient.get<MediaSessionResponse>(MEDIA_ENDPOINTS.DETAIL(sessionId));
  },

  /**
   * Nháº­n phiÃªn (accept)
   */
  async acceptSession(sessionId: string): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(MEDIA_ENDPOINTS.ACCEPT(sessionId));
  },

  /**
   * Láº¥y LiveKit join token
   */
  async getJoinToken(sessionId: string): Promise<MediaSessionJoinToken> {
    return apiClient.post<MediaSessionJoinToken>(MEDIA_ENDPOINTS.JOIN_TOKEN(sessionId));
  },

  /**
   * Káº¿t thÃºc phiÃªn
   */
  async endSession(sessionId: string, reason = 'STAFF_ENDED'): Promise<MediaSessionResponse> {
    return apiClient.post<MediaSessionResponse>(MEDIA_ENDPOINTS.END(sessionId), { reason });
  },
};
