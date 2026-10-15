import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { API_CONFIG } from '../config';
import { ApiResponse, RobotStatusResponse, RobotTelemetryResponse } from '../types';

export const robotApi = {
  // Lấy trạng thái tổng quan robot (pin, kết nối, zone hiện tại)
  async getStatus(): Promise<ApiResponse<RobotStatusResponse>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        success: true,
        data: {
          robotId: 'MAR-01',
          robotName: 'Robot Trợ Lý Rover 01',
          battery: 82,
          status: 'running',
          currentZone: 'Khu chờ',
          connection: 'stable',
          estimatedArrivalMinutes: 8,
          destinationRoom: 'P. Tim mạch',
        },
      };
    }
    return apiClient.get<RobotStatusResponse>(ENDPOINTS.ROBOT.STATUS);
  },

  // Tạm dừng nhiệm vụ robot
  async pause(): Promise<ApiResponse<{ paused: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true, message: 'Đã tạm dừng nhiệm vụ robot', data: { paused: true } };
    }
    return apiClient.post(ENDPOINTS.ROBOT.PAUSE);
  },

  // Tiếp tục nhiệm vụ
  async resume(): Promise<ApiResponse<{ resumed: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return { success: true, message: 'Robot tiếp tục di chuyển', data: { resumed: true } };
    }
    return apiClient.post(ENDPOINTS.ROBOT.RESUME);
  },

  // Dừng khẩn cấp
  async emergencyStop(): Promise<ApiResponse<{ stopped: boolean }>> {
    if (API_CONFIG.USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return { success: true, message: 'ĐÃ DỪNG KHẨN CẤP TOÀN BỘ ĐỘNG CƠ', data: { stopped: true } };
    }
    return apiClient.post(ENDPOINTS.ROBOT.EMERGENCY_STOP);
  },

  // Điều khiển thủ công (tiến, lùi, rẽ)
  async manualControl(direction: 'forward' | 'backward' | 'left' | 'right' | 'stop'): Promise<ApiResponse<any>> {
    return apiClient.post(ENDPOINTS.ROBOT.MANUAL_CONTROL, { direction });
  },
};
