import { getBackendHost, ROBOT_CAMERA_PORT, AI_VISION_PORT, API_CONFIG } from '../config';

export interface CameraHealthResponse {
  service: string;
  status: 'STREAMING' | 'STARTING' | 'OFFLINE' | 'ERROR' | string;
  fps: number;
  frame_id?: number;
  resolution?: string;
  stream_endpoint: string;
  frameFresh?: boolean;
  encodedFps?: number;
  frameAgeSeconds?: number | null;
  topic?: string;
}

export interface AiVisionStateResponse {
  status?: string;
  fps?: number;
  people_count?: number;
  last_event?: string | null;
  mqtt?: any;
}

/**
 * Camera API: Kết nối luồng Camera trực tiếp từ Robot (Raspberry Pi Streamer 8081, ROS MJPEG 8080, hoặc AI Vision 8001)
 */
export const cameraApi = {
  /**
   * Lấy URL luồng video trực tiếp từ robot theo đúng adapter
   * - robot_pi (mặc định): Python camera server cổng 8081, endpoint /stream
   * - ros_mjpeg: Vendor web_video_server cổng 8080, endpoint /stream?topic=...
   * - ai_vision: AI Vision Service cổng 8001, endpoint /video
   */
  getStreamUrl(
    source: 'robot_pi' | 'ros_mjpeg' | 'ai_vision' = 'robot_pi',
    customHost?: string
  ): string {
    const configuredUrl = process.env.EXPO_PUBLIC_ROBOT_CAMERA_URL?.trim();
    if (configuredUrl && source === 'robot_pi') return configuredUrl;

    const host = customHost || getBackendHost();
    if (source === 'ai_vision') {
      return `http://${host}:${AI_VISION_PORT}/video`;
    }
    if (source === 'ros_mjpeg') {
      return `http://${host}:8080/stream?topic=/ascamera/camera_publisher/rgb0/image&type=mjpeg&width=640&height=480&quality=60`;
    }
    return `http://${host}:${ROBOT_CAMERA_PORT}/stream`;
  },

  /**
   * Lấy URL ảnh snapshot mới nhất từ máy chủ Python (8081/snapshot)
   */
  getSnapshotUrl(customHost?: string): string {
    const host = customHost || getBackendHost();
    return `http://${host}:${ROBOT_CAMERA_PORT}/snapshot?t=${Date.now()}`;
  },

  /**
   * Kiểm tra tình trạng kết nối camera trực tiếp trên Raspberry Pi qua /health (cổng 8081)
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
      const encodedFps =
        typeof data.encodedFps === 'number'
          ? data.encodedFps
          : typeof data.fps === 'number'
          ? data.fps
          : 0;
      const frameFresh = Boolean(data.frameFresh);
      const isStreaming = frameFresh || encodedFps > 0 || (Number(data.sourceReceivedFps) > 0);

      return {
        service: 'MAR-Pi-Camera-Streamer',
        status: isStreaming ? 'STREAMING' : data.lastSourceError ? 'ERROR' : 'STARTING',
        fps: encodedFps,
        frame_id: typeof data.frameRevision === 'number' ? data.frameRevision : 0,
        resolution: Array.isArray(data.streamSize) ? `${data.streamSize[0]}x${data.streamSize[1]}` : '640x480',
        stream_endpoint: '/stream',
        frameFresh,
        encodedFps,
        frameAgeSeconds: data.frameAgeSeconds ?? null,
        topic: data.topic,
      };
    } catch {
      return {
        service: 'MAR-Pi-Camera-Streamer',
        status: 'OFFLINE',
        fps: 0,
        frame_id: 0,
        resolution: '640x480',
        stream_endpoint: '/stream',
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
