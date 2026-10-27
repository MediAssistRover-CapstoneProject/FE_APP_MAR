import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  DeliveryResponse,
  CreateDeliveryPayload,
  PageResponse,
  QrChallengeResponse,
  IssueQrChallengeRequest,
  VerifyQrRequest,
  AuthVerificationResponse,
} from '../types';

/**
 * Staff Delivery API Module
 * Quản lý toàn bộ nghiệp vụ giao hàng, cấp mã QR, xác minh QR và xác nhận hoàn tất giao hàng
 * Khớp 100% với Swagger Backend MediAssistRover
 */

// Hàm tạo UUID ngẫu nhiên làm Idempotency-Key
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const deliveryApi = {
  // 1. Lấy danh sách yêu cầu giao hàng (phân trang + lọc theo trạng thái)
  async getDeliveryRequests(
    page = 0,
    size = 10,
    status?: string
  ): Promise<PageResponse<DeliveryResponse>> {
    const statusParam = status ? `&status=${status}` : '';
    return apiClient.get<PageResponse<DeliveryResponse>>(
      `${ENDPOINTS.DELIVERY.REQUESTS}?page=${page}&size=${size}${statusParam}`
    );
  },

  // 2. Chi tiết 1 yêu cầu giao hàng
  async getDeliveryRequestDetail(id: string): Promise<DeliveryResponse> {
    return apiClient.get<DeliveryResponse>(ENDPOINTS.DELIVERY.REQUEST_DETAIL(id));
  },

  // 3. Tạo yêu cầu giao hàng mới (cần Idempotency-Key)
  async createDeliveryRequest(payload: CreateDeliveryPayload): Promise<DeliveryResponse> {
    const idempotencyKey = generateUUID();
    return apiClient.post<DeliveryResponse>(
      ENDPOINTS.DELIVERY.REQUESTS,
      payload,
      { 'Idempotency-Key': idempotencyKey }
    );
  },

  // 4. Xác nhận lấy hàng từ kho / tủ robot (confirm-pickup)
  async confirmPickup(id: string, payload: any = {}): Promise<DeliveryResponse> {
    return apiClient.post<DeliveryResponse>(
      `${ENDPOINTS.DELIVERY.REQUESTS}/${id}/confirm-pickup`,
      payload
    );
  },

  // 5. Xác nhận đã giao hàng đến đích (confirm-delivery)
  async confirmDelivery(id: string, payload: any = {}): Promise<DeliveryResponse> {
    return apiClient.post<DeliveryResponse>(
      `${ENDPOINTS.DELIVERY.REQUESTS}/${id}/confirm-delivery`,
      payload
    );
  },

  // 6. Tạo mã QR challenge cho Job giao hàng (khi robot đến nơi)
  async issueQrChallenge(
    jobId: string,
    payload: IssueQrChallengeRequest
  ): Promise<QrChallengeResponse> {
    return apiClient.post<QrChallengeResponse>(
      ENDPOINTS.DELIVERY.QR_CHALLENGE(jobId),
      payload
    );
  },

  // 7. Xác minh mã QR người nhận (sau khi quét camera)
  async verifyQr(
    jobId: string,
    payload: VerifyQrRequest
  ): Promise<AuthVerificationResponse> {
    return apiClient.post<AuthVerificationResponse>(
      ENDPOINTS.DELIVERY.QR_VERIFY(jobId),
      payload
    );
  },

  // 8. Cấp quyền xác nhận của Staff (Staff Confirmation Grant)
  async issueStaffConfirmation(
    jobId: string,
    payload: { authJobStepId: string; purpose: 'DELIVERY_SENDER' | 'DELIVERY_RECEIVER' }
  ): Promise<AuthVerificationResponse> {
    return apiClient.post<AuthVerificationResponse>(
      ENDPOINTS.DELIVERY.AUTH_VERIFY(jobId),
      payload
    );
  },

  // 9. Lấy thông tin chứng nhận xác minh (Auth Verification)
  async getAuthVerification(id: string): Promise<AuthVerificationResponse> {
    return apiClient.get<AuthVerificationResponse>(`/auth-verifications/${id}`);
  },

  // 10. Gửi phản hồi thực thi cho một bước trong Job (Job Step Response)
  async respondJobStep(jobStepId: string, responsePayload: any): Promise<any> {
    const idempotencyKey = generateUUID();
    return apiClient.post<any>(
      `/job-steps/${jobStepId}/responses`,
      responsePayload,
      { 'Idempotency-Key': idempotencyKey }
    );
  },
};
