import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  NavigationCreateRequest,
  NavigationResponse,
  EscortCreateRequest,
  EscortResponse,
  ServiceRequestResponse,
  JobResponse,
  JobQueryParams,
  CancelJobRequest,
  PageResponse,
} from '../types';

/**
 * Tạo Idempotency-Key chuẩn định dạng UUID v4 đơn giản
 */
function generateIdempotencyKey(): string {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-4${s4().substr(0, 3)}-${s4()}-${s4()}${s4()}${s4()}`;
}

export const dispatchApi = {
  /**
   * 1. Tạo yêu cầu điều robot di chuyển đến điểm đích (Navigation Request)
   * Endpoint: POST /api/v1/navigation-requests
   */
  async createNavigationRequest(
    payload: NavigationCreateRequest,
    idempotencyKey?: string
  ): Promise<NavigationResponse> {
    const key = idempotencyKey || generateIdempotencyKey();
    return apiClient.post<NavigationResponse>(
      ENDPOINTS.DELIVERY.NAVIGATION_REQUESTS,
      payload,
      { 'Idempotency-Key': key }
    );
  },

  /**
   * 2. Tạo yêu cầu robot dẫn đường bệnh nhân (Escort Request)
   * Endpoint: POST /api/v1/escort-requests
   */
  async createEscortRequest(
    payload: EscortCreateRequest,
    idempotencyKey?: string
  ): Promise<EscortResponse> {
    const key = idempotencyKey || generateIdempotencyKey();
    return apiClient.post<EscortResponse>(
      ENDPOINTS.DELIVERY.ESCORT_REQUESTS,
      payload,
      { 'Idempotency-Key': key }
    );
  },

  /**
   * 3. Submit Service Request để chuyển trạng thái từ DRAFT sang QUEUED
   * và khởi tạo Job điều phối robot thực tế trên máy chủ
   * Endpoint: POST /api/v1/service-requests/{id}/submit
   */
  async submitServiceRequest(serviceRequestId: string): Promise<ServiceRequestResponse> {
    return apiClient.post<ServiceRequestResponse>(
      ENDPOINTS.SERVICE_REQUESTS.SUBMIT(serviceRequestId)
    );
  },

  /**
   * 4. Hủy Service Request
   * Endpoint: POST /api/v1/service-requests/{id}/cancel
   */
  async cancelServiceRequest(serviceRequestId: string): Promise<ServiceRequestResponse> {
    return apiClient.post<ServiceRequestResponse>(
      ENDPOINTS.SERVICE_REQUESTS.CANCEL(serviceRequestId)
    );
  },

  /**
   * 5. Lấy danh sách nhiệm vụ (Jobs) của robot trong hệ thống
   * Endpoint: GET /api/v1/jobs
   */
  async getJobs(params?: JobQueryParams): Promise<PageResponse<JobResponse>> {
    const { status, workflowId, requestId, robotId, from, to, page = 0, size = 10 } = params || {};
    const queryParts: string[] = [`page=${page}`, `size=${size}`];
    if (status) queryParts.push(`status=${encodeURIComponent(status)}`);
    if (workflowId) queryParts.push(`workflowId=${encodeURIComponent(workflowId)}`);
    if (requestId) queryParts.push(`requestId=${encodeURIComponent(requestId)}`);
    if (robotId) queryParts.push(`robotId=${encodeURIComponent(robotId)}`);
    if (from) queryParts.push(`from=${encodeURIComponent(from)}`);
    if (to) queryParts.push(`to=${encodeURIComponent(to)}`);
    const query = queryParts.join('&');
    return apiClient.get<PageResponse<JobResponse>>(`${ENDPOINTS.JOBS.LIST}?${query}`);
  },

  /**
   * 6. Chi tiết 1 nhiệm vụ
   * Endpoint: GET /api/v1/jobs/{id}
   */
  async getJobDetail(jobId: string): Promise<JobResponse> {
    return apiClient.get<JobResponse>(ENDPOINTS.JOBS.DETAIL(jobId));
  },

  /**
   * 7. Hủy nhiệm vụ đang chạy hoặc trong hàng đợi
   * Endpoint: POST /api/v1/jobs/{id}/cancel
   */
  async cancelJob(jobId: string, reason: string): Promise<JobResponse> {
    const payload: CancelJobRequest = { reason };
    return apiClient.post<JobResponse>(ENDPOINTS.JOBS.CANCEL(jobId), payload);
  },

  /**
   * 8. HÀM TIỆN ÍCH TỔNG HỢP (DISPATCH TO JOB):
   * Tự động tạo Navigation Request + Submit để phát sinh ngay 1 Job cho Robot
   */
  async dispatchNavigationToJob(options: {
    mapId: string;
    endpointId?: string | null;
    roomId?: string | null;
    note?: string;
    priority?: number;
    passengerCount?: number;
  }): Promise<{ request: NavigationResponse; submitted: ServiceRequestResponse }> {
    // Bước 1: Tạo Navigation Request
    const navReq = await this.createNavigationRequest({
      mapId: options.mapId,
      destinationEndpointId: options.endpointId,
      roomId: options.roomId,
      targetMode: 'ENDPOINT',
      navigationMode: 'STANDARD',
      passengerCount: options.passengerCount || 1,
      priority: options.priority || 50,
      note: options.note || 'Điều robot đến phòng chỉ định từ Staff App',
    });

    // Bước 2: Submit để đưa vào hàng đợi Job
    const submitted = await this.submitServiceRequest(navReq.request.serviceRequestId);

    return { request: navReq, submitted };
  },

  /**
   * 9. HÀM TIỆN ÍCH TỔNG HỢP (ESCORT TO JOB):
   * Tự động tạo Escort Request (Dẫn đường bệnh nhân) + Submit để phát sinh Job
   */
  async dispatchEscortToJob(options: {
    mapId: string;
    endpointId?: string | null;
    patientReference?: string;
    note?: string;
    walkingSpeedMps?: number;
    priority?: number;
  }): Promise<{ request: EscortResponse; submitted: ServiceRequestResponse }> {
    // Bước 1: Tạo Escort Request
    const escortReq = await this.createEscortRequest({
      mapId: options.mapId,
      destinationEndpointId: options.endpointId,
      targetMode: 'ENDPOINT',
      escortMode: 'GUIDED',
      walkingSpeedMps: options.walkingSpeedMps || 0.2,
      patientReference: options.patientReference || 'Bệnh nhân khám bệnh',
      priority: options.priority || 50,
      note: options.note || 'Dẫn đường bệnh nhân từ Staff App',
    });

    // Bước 2: Submit để đưa vào hàng đợi Job
    const submitted = await this.submitServiceRequest(escortReq.request.serviceRequestId);

    return { request: escortReq, submitted };
  },
};
