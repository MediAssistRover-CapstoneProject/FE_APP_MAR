import { create } from 'zustand';
import { authApi } from '../api/modules/auth.api';
import { apiClient } from '../api/client';
import { UserProfileResponse } from '../api/types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfileResponse | null;
  mustChangePassword: boolean;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  fetchMe: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setSession: (token: string, user: UserProfileResponse) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  mustChangePassword: false,
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null, mustChangePassword: false });
    try {
      const loginRes = await authApi.login({
        username: username.trim(),
        password,
        deviceInfo: 'StaffApp-Mobile',
      });

      set({
        token: loginRes.accessToken,
        refreshToken: loginRes.refreshToken,
        mustChangePassword: loginRes.mustChangePassword,
      });

      // Backend chỉ cho phép gọi /auth/change-password khi tài khoản còn dùng mật khẩu tạm.
      if (loginRes.mustChangePassword) {
        set({ user: null, isLoading: false });
        return true;
      }

      // Lấy thông tin tài khoản người dùng
      try {
        const meRes = await authApi.getMe();
        set({ user: meRes, isLoading: false });
      } catch (profileError: any) {
        apiClient.setToken(null);
        set({
          token: null,
          refreshToken: null,
          user: null,
          isLoading: false,
          error: profileError?.message || 'Không thể lấy hồ sơ tài khoản từ máy chủ.',
        });
        return false;
      }

      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err.message || 'Đăng nhập không thành công. Vui lòng kiểm tra lại!',
      });
      return false;
    }
  },

  fetchMe: async () => {
    try {
      const me = await authApi.getMe();
      set({ user: me });
    } catch (err) {
      console.warn('Could not fetch user profile:', err);
    }
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    set({ isLoading: true, error: null });
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      apiClient.setToken(null);
      set({
        token: null,
        refreshToken: null,
        user: null,
        mustChangePassword: false,
        isLoading: false,
      });
      return true;
    } catch (err: any) {
      set({
        isLoading: false,
        error: err?.message || 'Không thể đổi mật khẩu. Vui lòng thử lại.',
      });
      return false;
    }
  },

  logout: async () => {
    const { refreshToken } = get();
    await authApi.logout(refreshToken || undefined);
    set({ token: null, refreshToken: null, user: null, mustChangePassword: false });
  },

  setSession: (token, user) => set({ token, user }),
}));
