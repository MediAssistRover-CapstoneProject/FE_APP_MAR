/**
 * =========================================================================
 * 🔗 DỊCH VỤ GỌI API MEDIASSISTROVER (BACKEND RAILWAY ĐÃ DEPLOY)
 * =========================================================================
 */
import { API_CONFIG } from './config';
import { apiClient } from './client';

export const BASE_URL = API_CONFIG.BASE_URL;

export const APIS = {
  // ---- PHẦN 1: ĐĂNG NHẬP & TÀI KHOẢN ----
  LOGIN: `${BASE_URL}/auth/login`,
  ME: `${BASE_URL}/auth/me`,
  CHANGE_PASSWORD: `${BASE_URL}/auth/change-password`,
  REFRESH: `${BASE_URL}/auth/refresh`,
  LOGOUT: `${BASE_URL}/auth/logout`,

  // ---- PHẦN 2: BẢN ĐỒ & ROBOT ----
  ROBOTS: `${BASE_URL}/robots`,
  ROOMS: `${BASE_URL}/rooms`,
  FLOORS: `${BASE_URL}/floors`,
  ZONES: `${BASE_URL}/zones`,
  MAPS: `${BASE_URL}/maps`,

  // ---- PHẦN 3: GIAO NHIỆM VỤ, HÀNG ĐỢI & SỰ CỐ ----
  JOBS: `${BASE_URL}/jobs`,
  DELIVERY_REQUESTS: `${BASE_URL}/delivery-requests`,
  ALERTS: `${BASE_URL}/alerts`,
  INCIDENTS: `${BASE_URL}/emergency-incidents`,
};

export const setAuthToken = (token: string | null) => {
  apiClient.setToken(token);
};

export const callApi = async <T = any>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<T> => {
  if (method === 'GET') return apiClient.get<T>(url);
  if (method === 'POST') return apiClient.post<T>(url, body);
  if (method === 'PUT') return apiClient.put<T>(url, body);
  return apiClient.delete<T>(url);
};
