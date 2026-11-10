import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  StaffMeResponse,
  ShiftResponse,
  ShiftQueryParams,
  PageResponse,
  OnDutyStaffResponse,
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

  async getAllStaffShifts(status?: ShiftQueryParams['status']): Promise<ShiftResponse[]> {
    const first = await this.getStaffShifts({ status, page: 0, size: 100 });
    const shifts = [...(first.content || [])];
    for (let page = 1; page < first.totalPages; page += 1) {
      const next = await this.getStaffShifts({ status, page, size: 100 });
      shifts.push(...(next.content || []));
    }
    return shifts;
  },

  /**
   * 3. Chi tiết 1 ca trực
   * Endpoint: GET /api/v1/staff/shifts/{shiftId}
   */
  async getShiftDetail(shiftId: string): Promise<ShiftResponse> {
    return apiClient.get<ShiftResponse>(ENDPOINTS.STAFF.SHIFT_DETAIL(shiftId));
  },

  /**
   * 4. Lấy danh sách nhân viên đang trực (on-duty)
   * Endpoint: GET /api/v1/staff/on-duty
   */
  async getOnDutyStaff(params?: {
    mapId?: string;
    roomId?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<OnDutyStaffResponse>> {
    const queryParts: string[] = [];
    if (params?.mapId) queryParts.push(`mapId=${encodeURIComponent(params.mapId)}`);
    if (params?.roomId) queryParts.push(`roomId=${encodeURIComponent(params.roomId)}`);
    queryParts.push(`page=${params?.page ?? 0}`);
    queryParts.push(`size=${params?.size ?? 100}`);
    const query = queryParts.join('&');
    return apiClient.get<PageResponse<OnDutyStaffResponse>>(`${ENDPOINTS.STAFF.ON_DUTY}?${query}`);
  },
};
