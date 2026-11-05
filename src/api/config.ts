import Constants from 'expo-constants';
import { Platform, NativeModules } from 'react-native';

/**
 * API Configuration
 * Backend production được truy cập qua DuckDNS, không phụ thuộc vào BE local.
 * Swagger UI: https://mediassistrover.duckdns.org/swagger-ui/index.html
 */

export const REMOTE_BACKEND_URL = 'https://mediassistrover.duckdns.org/api/v1';
export const REMOTE_BACKEND_HOST = 'mediassistrover.duckdns.org';

// Hàm kiểm tra IP hợp lệ trong mạng LAN (loại trừ các domain tunnel của Expo/Ngrok)
const isValidLocalIp = (host?: string): boolean => {
  if (!host) return false;
  const h = host.toLowerCase().trim();
  if (
    h.includes('expo.app') ||
    h.includes('expo.dev') ||
    h.includes('ngrok') ||
    h === 'localhost' ||
    h === '127.0.0.1'
  ) {
    return false;
  }
  // Kiểm tra chuỗi định dạng IPv4 trong mạng LAN.
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
};

// Tự động nhận diện host IP:
// - Web / Simulator: localhost
// - Điện thoại thật qua Expo Go: tự động trích xuất IP LAN từ Metro Bundler hoặc fallback IP Wi-Fi
export const getBackendHost = (): string => {
  const configuredCameraHost = process.env.EXPO_PUBLIC_ROBOT_CAMERA_HOST?.trim();
  if (configuredCameraHost) return configuredCameraHost;

  if (Platform.OS === 'web') {
    return 'localhost';
  }

  // 1. Lấy trực tiếp từ URL nạp bundle của Metro
  try {
    const scriptURL: string | undefined = NativeModules?.SourceCode?.scriptURL;
    if (scriptURL) {
      const host = scriptURL.split('://')?.[1]?.split('/')?.[0]?.split(':')?.[0];
      if (isValidLocalIp(host)) {
        return host;
      }
    }
  } catch {}

  // 2. Lấy từ Expo Go debuggerHost
  try {
    const debuggerHost = (Constants as any)?.expoGoConfig?.debuggerHost;
    if (debuggerHost) {
      const ip = debuggerHost.split(':')[0];
      if (isValidLocalIp(ip)) return ip;
    }
  } catch {}

  // 3. Lấy từ hostUri
  try {
    const hostUri = Constants.expoConfig?.hostUri;
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (isValidLocalIp(ip)) return ip;
    }
  } catch {}

  // 4. Lấy từ linkingUri
  try {
    const linking = Constants.linkingUri;
    if (linking) {
      const match = linking.match(/:\/\/(.[^/:]+)/);
      if (match && isValidLocalIp(match[1])) {
        return match[1];
      }
    }
  } catch {}

  // Không gắn cứng IP LAN. Có thể cấu hình EXPO_PUBLIC_ROBOT_CAMERA_HOST khi chạy tunnel.
  return REMOTE_BACKEND_HOST;
};

export const ROBOT_CAMERA_PORT = 8090;
export const AI_VISION_PORT = 8001;

export const API_CONFIG = {
  // Backend production cố định; không gọi Spring Boot local qua localhost/LAN.
  get BASE_URL(): string {
    return REMOTE_BACKEND_URL;
  },
  get HOST(): string {
    return REMOTE_BACKEND_HOST;
  },
  PORT: 443,
  SWAGGER_URL: 'https://mediassistrover.duckdns.org/swagger-ui/index.html',
  get ROBOT_CAMERA_STREAM_URL(): string {
    return `http://${getBackendHost()}:${ROBOT_CAMERA_PORT}/video`;
  },
  get ROBOT_CAMERA_SNAPSHOT_URL(): string {
    return `http://${getBackendHost()}:${ROBOT_CAMERA_PORT}/snapshot`;
  },
  get AI_VISION_STREAM_URL(): string {
    return `http://${getBackendHost()}:${AI_VISION_PORT}/video`;
  },
  
  // Thời gian chờ tối đa (miligiây)
  TIMEOUT_MS: 15000,

};
