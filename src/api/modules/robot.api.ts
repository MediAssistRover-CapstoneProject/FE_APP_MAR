import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { RobotDto, PageResponse } from '../types';

export const robotApi = {
  // Lấy danh sách robot đang vận hành
  async getRobots(page = 0, size = 10, status?: string): Promise<PageResponse<RobotDto>> {
    const statusParam = status ? `&status=${status}` : '';
    return apiClient.get<PageResponse<RobotDto>>(
      `${ENDPOINTS.ROBOTS.LIST}?page=${page}&size=${size}${statusParam}`
    );
  },

  // Chi tiết robot theo ID
  async getRobotDetail(id: string): Promise<RobotDto> {
    return apiClient.get<RobotDto>(ENDPOINTS.ROBOTS.DETAIL(id));
  },

  // Đưa robot vào chế độ bảo trì
  async setMaintenance(id: string, reason = 'Bảo trì theo yêu cầu của nhân viên'): Promise<RobotDto> {
    return apiClient.post<RobotDto>(ENDPOINTS.ROBOTS.MAINTENANCE(id), { reason });
  },

  // Đồng bộ trạng thái robot
  async reconcileRobot(id: string): Promise<RobotDto> {
    return apiClient.post<RobotDto>(ENDPOINTS.ROBOTS.RECONCILE(id), {});
  },
};
