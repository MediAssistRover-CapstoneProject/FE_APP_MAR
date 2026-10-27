import { create } from 'zustand';
import { authApi } from '../api/modules/auth.api';
import { UserProfileResponse } from '../api/types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: UserProfileResponse | null;
  isLoading: boolean;
  error: string | null;

  login: (username: string, password: string) => Promise<boolean>;
  fetchMe: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setSession: (token: string, user: UserProfileResponse) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: {
    accountId: '35dacfdf-048b-4885-aac2-84f1eeef43d6',
    accountCode: 'STF-01',
    username: 'staff01',
    fullName: 'Nguyễn Thành Trung',
    email: 'staff@gmail.com',
    phone: '0827898981',
    role: 'STAFF',
    authProvider: 'LOCAL',
    status: 'ACTIVE',
    mustChangePassword: false,
  },
  isLoading: false,
  error: null,

  clearError: () => set({ error: null }),

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const loginRes = await authApi.login({
        username: username.trim(),
        password,
        deviceInfo: 'StaffApp-Mobile',
      });

      set({
        token: loginRes.accessToken,
        refreshToken: loginRes.refreshToken,
      });

      // Lấy thông tin tài khoản người dùng
      try {
        const meRes = await authApi.getMe();
        set({ user: meRes, isLoading: false });
      } catch {
        // Fallback profile nếu /auth/me cần quyền phụ
        set({
          user: {
            accountId: '35dacfdf-048b-4885-aac2-84f1eeef43d6',
            accountCode: 'STF-01',
            username: username.trim(),
            fullName: 'Nguyễn Thành Trung',
            email: 'staff@gmail.com',
            phone: '0827898981',
            role: 'STAFF',
            authProvider: 'LOCAL',
            status: 'ACTIVE',
            mustChangePassword: false,
          },
          isLoading: false,
        });
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

  logout: async () => {
    const { refreshToken } = get();
    await authApi.logout(refreshToken || undefined);
    set({ token: null, refreshToken: null });
  },

  setSession: (token, user) => set({ token, user }),
}));
