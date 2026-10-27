import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { ScheduleResponse, ScheduleQueryParams, PageResponse } from '../types';

/**
 * Schedule API Module (Staff Operations)
 * Quản lý & theo dõi lịch trình hoạt động định kỳ của robot (Khử khuẩn, tuần tra, vận chuyển định kỳ)
 * Khớp 100% với Swagger Backend MediAssistRover
 */

export const scheduleApi = {
  /**
   * 1. Lấy danh sách lịch trình hoạt động robot (phân trang, lọc theo status)
   */
  async getSchedules(params: ScheduleQueryParams = {}): Promise<PageResponse<ScheduleResponse>> {
    const { status, page = 0, size = 10 } = params;
    const queryParts: string[] = [`page=${page}`, `size=${size}`];
    if (status) queryParts.push(`status=${status}`);

    const query = queryParts.join('&');
    return apiClient.get<PageResponse<ScheduleResponse>>(`${ENDPOINTS.SCHEDULES.LIST}?${query}`);
  },

  /**
   * 2. Lấy chi tiết lịch trình theo ID
   */
  async getScheduleDetail(id: string): Promise<ScheduleResponse> {
    return apiClient.get<ScheduleResponse>(ENDPOINTS.SCHEDULES.DETAIL(id));
  },

  /**
   * 3. Kích hoạt lịch trình hoạt động
   */
  async activateSchedule(id: string): Promise<ScheduleResponse> {
    return apiClient.post<ScheduleResponse>(ENDPOINTS.SCHEDULES.ACTIVATE(id));
  },

  /**
   * 4. Tạm dừng lịch trình hoạt động
   */
  async pauseSchedule(id: string): Promise<ScheduleResponse> {
    return apiClient.post<ScheduleResponse>(ENDPOINTS.SCHEDULES.PAUSE(id));
  },

  /**
   * 5. Hủy bỏ / Cho nghỉ hưu lịch trình
   */
  async retireSchedule(id: string): Promise<ScheduleResponse> {
    return apiClient.post<ScheduleResponse>(ENDPOINTS.SCHEDULES.RETIRE(id));
  },
};
