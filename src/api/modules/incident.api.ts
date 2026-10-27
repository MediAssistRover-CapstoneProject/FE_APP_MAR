import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { IncidentResponse, ResolutionPayload, PageResponse } from '../types';

/**
 * Staff Incidents API Module
 * Quản lý vòng đời sự cố khẩn cấp (Phát hiện người té ngã, SOS, xâm nhập vùng cấm)
 * Khớp 100% với Swagger Backend MediAssistRover
 */

export interface IncidentQueryParams {
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'FALSE_ALARM';
  severity?: 'WARNING' | 'CRITICAL';
  type?: string;
  page?: number;
  size?: number;
}

export const incidentApi = {
  // 1. Lấy danh sách sự cố khẩn cấp (té ngã, SOS)
  async getIncidents(params: IncidentQueryParams = {}): Promise<PageResponse<IncidentResponse>> {
    const { status, severity, type, page = 0, size = 10 } = params;
    const queryParts: string[] = [`page=${page}`, `size=${size}`];
    if (status) queryParts.push(`status=${status}`);
    if (severity) queryParts.push(`severity=${severity}`);
    if (type) queryParts.push(`type=${encodeURIComponent(type)}`);

    const query = queryParts.join('&');
    return apiClient.get<PageResponse<IncidentResponse>>(
      `${ENDPOINTS.INCIDENTS.LIST}?${query}`
    );
  },

  // 2. Chi tiết sự cố theo ID
  async getIncidentDetail(id: string): Promise<IncidentResponse> {
    return apiClient.get<IncidentResponse>(ENDPOINTS.INCIDENTS.DETAIL(id));
  },

  // 3. Tiếp nhận cảnh báo tai nạn / người té ngã (Staff Acknowledge)
  async acknowledgeIncident(id: string): Promise<IncidentResponse> {
    return apiClient.post<IncidentResponse>(ENDPOINTS.INCIDENTS.ACKNOWLEDGE(id));
  },

  // 4. Bắt đầu xử lý / Cử đội cấp cứu & điều phối robot đến hiện trường (Start)
  async startIncident(id: string): Promise<IncidentResponse> {
    return apiClient.post<IncidentResponse>(ENDPOINTS.INCIDENTS.START(id));
  },

  // 5. Giải quyết xong sự cố tai nạn (Resolve)
  async resolveIncident(
    id: string,
    resolutionNote: string,
    evidence?: any
  ): Promise<IncidentResponse> {
    const payload: ResolutionPayload = { resolutionNote, evidence };
    return apiClient.post<IncidentResponse>(ENDPOINTS.INCIDENTS.RESOLVE(id), payload);
  },

  // 6. Đánh dấu báo động giả (False Alarm)
  async markFalseAlarm(
    id: string,
    resolutionNote = 'Báo động giả, hiện trường an toàn'
  ): Promise<IncidentResponse> {
    const payload: ResolutionPayload = { resolutionNote };
    return apiClient.post<IncidentResponse>(ENDPOINTS.INCIDENTS.FALSE_ALARM(id), payload);
  },

  // 7. Đóng sự cố hoàn tất (Close)
  async closeIncident(id: string): Promise<IncidentResponse> {
    return apiClient.post<IncidentResponse>(ENDPOINTS.INCIDENTS.CLOSE(id));
  },
};
