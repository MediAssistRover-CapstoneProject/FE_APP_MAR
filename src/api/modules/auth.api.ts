import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  LoginRequest,
  LoginResponse,
  UserProfileResponse,
  ChangePasswordRequest,
} from '../types';

export const authApi = {
  // 1. Đăng nhập nhân viên
  async login(payload: LoginRequest): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>(ENDPOINTS.AUTH.LOGIN, {
      username: payload.username,
      password: payload.password,
      deviceInfo: payload.deviceInfo || 'StaffApp-Mobile',
    });

    if (res?.accessToken) {
      apiClient.setToken(res.accessToken);
    }
    return res;
  },

  // 2. Lấy thông tin tài khoản hiện tại
  async getMe(): Promise<UserProfileResponse> {
    return apiClient.get<UserProfileResponse>(ENDPOINTS.AUTH.ME);
  },

  // 3. Đổi mật khẩu
  async changePassword(payload: ChangePasswordRequest): Promise<void> {
    return apiClient.put<void>(ENDPOINTS.AUTH.CHANGE_PASSWORD, payload);
  },

  // 4. Refresh token
  async refreshToken(refreshToken: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>(ENDPOINTS.AUTH.REFRESH, {
      refreshToken,
      deviceInfo: 'StaffApp-Mobile',
    });
    if (res?.accessToken) {
      apiClient.setToken(res.accessToken);
    }
    return res;
  },

  // 5. Đăng xuất
  async logout(refreshToken?: string): Promise<void> {
    try {
      if (refreshToken) {
        await apiClient.post(ENDPOINTS.AUTH.LOGOUT, { refreshToken });
      }
    } catch {
      // Ignored on logout
    } finally {
      apiClient.setToken(null);
    }
  },
};
