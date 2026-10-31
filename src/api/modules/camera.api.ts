import { getBackendHost, ROBOT_CAMERA_PORT, AI_VISION_PORT, API_CONFIG } from '../config';

export interface CameraHealthResponse {
  service: string;
  status: 'STREAMING' | 'STARTING' | 'OFFLINE' | 'ERROR' | string;
  fps: number;
  frame_id: number;
  resolution: string;
  stream_endpoint: string;
}

export interface AiVisionStateResponse {
  status?: string;
  fps?: number;
  people_count?: number;
  last_event?: string | null;
  mqtt?: any;
}

/**
 * Camera API: Gọi trực tiếp tới Camera Robot (Raspberry Pi Port 8090 hoặc AI Vision Port 8001)
 */
export const cameraApi = {
  /**
   * Lấy URL luồng video trực tiếp từ robot
   */
  getStreamUrl(source: 'robot_pi' | 'ai_vision' = 'robot_pi', customHost?: string): string {
    const host = customHost || getBackendHost();
    if (source === 'ai_vision') {
      return `http://${host}:${AI_VISION_PORT}/video`;
    }
    return `http://${host}:${ROBOT_CAMERA_PORT}/video`;
  },

  /**
   * Lấy URL ảnh snapshot mới nhất (cho fallback snapshot polling)
   */
  getSnapshotUrl(customHost?: string): string {
    const host = customHost || getBackendHost();
    return `http://${host}:${ROBOT_CAMERA_PORT}/snapshot?t=${Date.now()}`;
  },

  /**
   * Kiểm tra tình trạng kết nối camera trực tiếp trên Raspberry Pi
   */
  async checkCameraHealth(customHost?: string, timeoutMs = 3000): Promise<CameraHealthResponse> {
    const host = customHost || getBackendHost();
    const url = `http://${host}:${ROBOT_CAMERA_PORT}/health`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Camera response error: ${res.status}`);
      }

      const data = await res.json();
      return data as CameraHealthResponse;
    } catch (err: any) {
      return {
        service: 'MAR-Pi-Camera-Streamer',
        status: 'OFFLINE',
        fps: 0,
        frame_id: 0,
        resolution: '640x480',
        stream_endpoint: '/video',
      };
    } finally {
      clearTimeout(timer);
    }
  },

  /**
   * Kiểm tra tình trạng AI Vision Service
   */
  async checkAiVisionState(customHost?: string, timeoutMs = 3000): Promise<AiVisionStateResponse> {
    const host = customHost || getBackendHost();
    const url = `http://${host}:${AI_VISION_PORT}/api/state`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`AI Vision error: ${res.status}`);
      }

      const data = await res.json();
      return data as AiVisionStateResponse;
    } catch {
      return {
        status: 'OFFLINE',
        fps: 0,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
