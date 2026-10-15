/**
 * Danh sách toàn bộ Endpoint của hệ thống MediAssistRover
 * Quản lý tập trung tại một nơi duy nhất để dễ bảo trì khi Backend đổi URL.
 */

export const ENDPOINTS = {
  // Xác thực & Tài khoản
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    SEND_OTP: '/auth/forgot-password/send-otp',
    VERIFY_OTP: '/auth/forgot-password/verify-otp',
    RESET_PASSWORD: '/auth/forgot-password/reset',
    PROFILE: '/auth/me',
  },

  // Robot & Trạng thái điều khiển
  ROBOT: {
    STATUS: '/robots/status',                    // Lấy battery, kết nối, zone hiện tại
    TELEMETRY: '/robots/telemetry',              // Tọa độ x, y, góc quay của robot trên bản đồ
    PAUSE: '/robots/pause',                      // Tạm dừng nhiệm vụ robot
    RESUME: '/robots/resume',                    // Tiếp tục di chuyển
    EMERGENCY_STOP: '/robots/emergency-stop',    // Dừng khẩn cấp
    MANUAL_CONTROL: '/robots/manual-control',    // Lệnh điều khiển thủ công (tiến, lùi, rẽ)
  },

  // Nhiệm vụ (Mission / Tasks)
  MISSION: {
    CREATE: '/missions',                         // Giao nhiệm vụ mới cho robot
    GET_QUEUE: '/missions/queue',                // Lấy danh sách hàng đợi (3 items trong figma)
    GET_ACTIVE: '/missions/active',              // Lấy nhiệm vụ đang thực hiện hiện tại
    GET_TIMELINE: (id: string | number) => `/missions/${id}/timeline`, // Lấy 19 bước tiến trình
    STAFF_ACTION: (id: string | number) => `/missions/${id}/staff-action`, // Tạm dừng, trả hàng, chờ thêm, xác minh lại
    SCAN_QR: '/missions/scan-qr',                // Quét mã QR vật phẩm
    REGISTER_FACE: '/missions/register-face',    // Đăng ký khuôn mặt người nhận
  },

  // Bản đồ số bệnh viện (Digital Twin Map)
  MAP: {
    GET_MAP_DATA: '/map/digital-twin',           // Danh sách phòng, tọa độ các zone
    GET_OBSTACLES: '/map/obstacles',             // Các điểm chặn, đông người, SOS
    REPORT_SOS: '/map/report-sos',               // Kích hoạt báo động SOS tại khu vực
  },
};
