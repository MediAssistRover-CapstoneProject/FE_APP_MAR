/**
 * API Configuration
 * Dễ dàng chuyển đổi giữa Server thật và Mock Data khi Backend chưa sẵn sàng.
 */

export const API_CONFIG = {
  // Thay đổi địa chỉ IP của Backend Server tại đây (ví dụ: http://192.168.1.100:5000/api hoặc domain production)
  BASE_URL: 'https://api.mediassistrover.hospital.vn/api/v1',
  
  // Thời gian chờ tối đa (miligiây)
  TIMEOUT_MS: 15000,

  // Bật/Tắt chế độ dữ liệu giả lập (Mock Data) để test giao diện offline
  USE_MOCK_DATA: true,
};
