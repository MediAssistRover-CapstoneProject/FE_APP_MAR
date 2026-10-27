/**
 * API Configuration
 * Kết nối trực tiếp đến Backend MediAssistRover đã deploy
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API Configuration
 * Kết nối trực tiếp đến Backend Local chạy qua Docker / Spring Boot trên máy (port 8080)
 * Swagger UI: http://localhost:8080/swagger-ui/index.html
 */

// Tự động nhận diện host IP:
// - Web / Simulator: localhost
// - Điện thoại thật qua Expo Go: IP máy tính trong mạng Wi-Fi (lấy từ hostUri)
const getBackendHost = (): string => {
  if (Platform.OS === 'web') {
    return 'localhost';
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip.trim()) return ip;
  }
  // IP Wi-Fi hiện tại của máy tính
  return '10.1.167.76';
};

const BACKEND_HOST = getBackendHost();
const BACKEND_PORT = 8080;

export const API_CONFIG = {
  // Local Backend URL (tự động theo môi trường)
  BASE_URL: `http://${BACKEND_HOST}:${BACKEND_PORT}/api/v1`,
  HOST: BACKEND_HOST,
  PORT: BACKEND_PORT,
  SWAGGER_URL: `http://localhost:${BACKEND_PORT}/swagger-ui/index.html`,
  
  // Thời gian chờ tối đa (miligiây)
  TIMEOUT_MS: 15000,

  // Khi false: gọi API thật từ server. Khi server trả rỗng thì dùng dữ liệu minh họa
  USE_MOCK_DATA: false,
};
