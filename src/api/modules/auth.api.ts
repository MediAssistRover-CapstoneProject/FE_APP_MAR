import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { API_CONFIG } from '../config';
import {
  ApiResponse,
  LoginRequest,
  LoginResponse,
  SendOtpRequest,
  VerifyOtpRequest,
  ResetPasswordRequest,
} from '../types';

export const authApi = {
  // 1. Đăng nhập
  async login(payload: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      // Giả lập phản hồi từ server
      await new Promise((resolve) => setTimeout(resolve, 600));
      const mockResponse: LoginResponse = {
        token: 'mock-jwt-token-mediassistrover-staff-12345',
        user: {
          id: 'NV001',
          name: 'Y tá Nguyễn Văn An',
          role: 'STAFF',
          email: payload.usernameOrEmail,
          isOnDuty: true,
        },
      };
      apiClient.setToken(mockResponse.token);
      return { success: true, data: mockResponse };
    }

    const res = await apiClient.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, payload);
    if (res.data?.token) {
      apiClient.setToken(res.data.token);
    }
    return res;
  },

  // 2. Gửi mã OTP
  async sendOtp(payload: SendOtpRequest): Promise<ApiResponse<{ sent: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, message: 'Đã gửi mã OTP thành công', data: { sent: true } };
    }
    return apiClient.post(ENDPOINTS.AUTH.SEND_OTP, payload);
  },

  // 3. Xác minh mã OTP
  async verifyOtp(payload: VerifyOtpRequest): Promise<ApiResponse<{ verified: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { success: true, data: { verified: true } };
    }
    return apiClient.post(ENDPOINTS.AUTH.VERIFY_OTP, payload);
  },

  // 4. Đặt lại mật khẩu mới
  async resetPassword(payload: ResetPasswordRequest): Promise<ApiResponse<{ updated: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return { success: true, data: { updated: true } };
    }
    return apiClient.post(ENDPOINTS.AUTH.RESET_PASSWORD, payload);
  },

  // 5. Đăng xuất
  async logout(): Promise<void> {
    apiClient.setToken(null);
    if (!API_CONFIG.USE_MOCK_DATA) {
      await apiClient.post(ENDPOINTS.AUTH.LOGOUT).catch(() => {});
    }
  },
};
