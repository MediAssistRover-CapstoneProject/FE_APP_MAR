/**
 * =========================================================================
 * 🔗 CHỖ GẮN LINK API CỦA BẠN (DÀNH RIÊNG ĐỂ DÁN LINK BACKEND VÀO ĐÂY)
 * =========================================================================
 * Bạn chỉ cần gửi link cho tôi hoặc dán trực tiếp vào các dòng bên dưới:
 */

// 1. ĐỊA CHỈ SERVER GỐC (Base URL của Backend bạn đang chạy)
export const BASE_URL = 'http://YOUR_SERVER_IP_OR_DOMAIN:PORT'; // <-- DÁN LINK SERVER VÀO ĐÂY

// 2. DANH SÁCH CÁC ĐƯỜNG DẪN API CỤ THỂ
export const APIS = {
  // ---- PHẦN 1: ĐĂNG NHẬP & TÀI KHOẢN ----
  LOGIN: `${BASE_URL}/api/auth/login`,                   // API Đăng nhập y tá/nhân viên
  SEND_OTP: `${BASE_URL}/api/auth/send-otp`,             // API Gửi mã OTP về email
  VERIFY_OTP: `${BASE_URL}/api/auth/verify-otp`,         // API Xác nhận mã OTP
  RESET_PASSWORD: `${BASE_URL}/api/auth/reset-password`, // API Đổi mật khẩu mới

  // ---- PHẦN 2: BẢN ĐỒ & THEO DÕI ROBOT ----
  GET_MAP_DATA: `${BASE_URL}/api/map/rooms`,             // API Lấy danh sách phòng & bản đồ
  GET_ROBOT_STATUS: `${BASE_URL}/api/robot/status`,       // API Lấy pin (82%), vị trí robot, zone hiện tại
  PAUSE_ROBOT: `${BASE_URL}/api/robot/pause`,            // API Tạm dừng robot (khi bấm Tạm dừng)
  EMERGENCY_STOP: `${BASE_URL}/api/robot/emergency`,     // API Dừng khẩn cấp robot

  // ---- PHẦN 3: GIAO NHIỆM VỤ & HÀNG ĐỢI ----
  CREATE_MISSION: `${BASE_URL}/api/missions/create`,     // API Tạo nhiệm vụ mới
  GET_QUEUE_LIST: `${BASE_URL}/api/missions/queue`,      // API Lấy danh sách 3 đơn hàng đợi
  GET_TASK_TIMELINE: `${BASE_URL}/api/missions/timeline`,// API Lấy chi tiết tiến trình 19 bước
  STAFF_ACTION: `${BASE_URL}/api/missions/staff-action`, // API Nút bấm: Chờ thêm, Trả vật phẩm, Xác minh lại
};

// =========================================================================
// 🚀 HÀM GỌI API SẴN SÀNG (ĐÃ CẤU HÌNH HEADERS & JSON CHUẨN)
// =========================================================================
let authToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  authToken = token;
};

export const callApi = async <T = any>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || `Lỗi gọi API: ${response.status}`);
  }

  return data as T;
};
