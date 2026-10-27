import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  StaffMeResponse,
  ShiftResponse,
  ShiftQueryParams,
  PageResponse,
} from '../types';

export const staffApi = {
  /**
   * 1. Lấy thông tin tài khoản, hồ sơ nhân viên y tế (khoa phòng, chức danh)
   * và ca trực đang hiệu lực hiện tại
   * Endpoint: GET /api/v1/staff/me
   */
  async getStaffMe(): Promise<StaffMeResponse> {
    return apiClient.get<StaffMeResponse>(ENDPOINTS.STAFF.ME);
  },

  /**
   * 2. Lấy danh sách ca trực được phân công cho nhân viên
   * Endpoint: GET /api/v1/staff/shifts
   */
  async getStaffShifts(params?: ShiftQueryParams): Promise<PageResponse<ShiftResponse>> {
    const { status, page = 0, size = 10 } = params || {};
    const queryParts: string[] = [`page=${page}`, `size=${size}`];
    if (status) queryParts.push(`status=${encodeURIComponent(status)}`);
    const query = queryParts.join('&');
    return apiClient.get<PageResponse<ShiftResponse>>(`${ENDPOINTS.STAFF.SHIFTS}?${query}`);
  },

  /**
   * 3. Chi tiết 1 ca trực
   * Endpoint: GET /api/v1/staff/shifts/{shiftId}
   */
  async getShiftDetail(shiftId: string): Promise<ShiftResponse> {
    return apiClient.get<ShiftResponse>(ENDPOINTS.STAFF.SHIFT_DETAIL(shiftId));
  },
};
