import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { AlertResponse, AlertQueryParams, PageResponse } from '../types';

/**
 * Staff Alerts API Module
 * Quản lý vòng đời cảnh báo & thông báo sự cố SOS trên Robot (Scoped Staff alert lifecycle)
 * Khớp 100% với Swagger Backend MediAssistRover
 */

export const alertApi = {
  /**
   * 1. Lấy danh sách cảnh báo (phân trang, lọc theo status, severity, type, thời gian)
   */
  async getAlerts(params: AlertQueryParams = {}): Promise<PageResponse<AlertResponse>> {
    const { status, severity, type, from, to, page = 0, size = 10 } = params;
    const queryParts: string[] = [`page=${page}`, `size=${size}`];
    if (status) queryParts.push(`status=${status}`);
    if (severity) queryParts.push(`severity=${severity}`);
    if (type) queryParts.push(`type=${encodeURIComponent(type)}`);
    if (from) queryParts.push(`from=${encodeURIComponent(from)}`);
    if (to) queryParts.push(`to=${encodeURIComponent(to)}`);

    const query = queryParts.join('&');
    return apiClient.get<PageResponse<AlertResponse>>(`${ENDPOINTS.ALERTS.LIST}?${query}`);
  },

  /**
   * 2. Lấy thông tin chi tiết cảnh báo theo Alert ID
   */
  async getAlertDetail(id: string): Promise<AlertResponse> {
    return apiClient.get<AlertResponse>(ENDPOINTS.ALERTS.DETAIL(id));
  },

  /**
   * 3. Xác nhận tiếp nhận cảnh báo SOS từ robot / bệnh nhân (Acknowledge)
   */
  async acknowledgeAlert(id: string): Promise<AlertResponse> {
    return apiClient.post<AlertResponse>(ENDPOINTS.ALERTS.ACKNOWLEDGE(id));
  },

  /**
   * 4. Đánh dấu đã giải quyết cảnh báo (Resolve)
   */
  async resolveAlert(id: string): Promise<AlertResponse> {
    return apiClient.post<AlertResponse>(ENDPOINTS.ALERTS.RESOLVE(id));
  },

  /**
   * 5. Đóng cảnh báo hoàn tất (Close)
   */
  async closeAlert(id: string): Promise<AlertResponse> {
    return apiClient.post<AlertResponse>(ENDPOINTS.ALERTS.CLOSE(id));
  },
};
