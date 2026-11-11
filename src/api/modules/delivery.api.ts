import { apiClient } from '../client';
import { PageResponse, ServiceRequestResponse, ServiceRequestStatus } from '../types';

// ========================================================
// 1. DELIVERY REQUEST INTERFACES
// ========================================================
export interface DeliveryItemRequest {
  itemCode: string;
  itemName: string;
  itemCategory: string;
  quantity: number;
  unit: string;
  sensitive: boolean;
  handlingInstruction?: string;
  itemNote?: string;
}

export interface DeliveryCreateRequest {
  mapId: string;
  pickupRoomId?: string;
  deliveryRoomId?: string;
  pickupEndpointId: string;
  deliveryEndpointId?: string;
  deliveryGroupId?: string;
  expectedSenderAccountId?: string;
  expectedReceiverAccountId?: string;
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  recipientName: string;
  recipientContact?: string;
  requiresConfirmation?: boolean;
  temperatureRequirement?: string;
  deliveryDeadline?: string;
  deliveryNote?: string;
  priority: number;
  note?: string;
  data?: Record<string, any>;
  items: DeliveryItemRequest[];
}

export interface DeliveryItemResponse extends DeliveryItemRequest {
  deliveryItemId: string;
}

export interface DeliveryResponse {
  request: ServiceRequestResponse;
  mapId: string;
  pickupRoomId?: string;
  deliveryRoomId?: string;
  pickupEndpointId: string;
  deliveryEndpointId?: string;
  deliveryGroupId?: string;
  resolvedDeliveryEndpointId?: string;
  expectedSenderAccountId?: string;
  expectedReceiverAccountId?: string;
  senderAccountId?: string;
  receiverAccountId?: string;
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  recipientName: string;
  recipientContact?: string;
  requiresConfirmation: boolean;
  temperatureRequirement?: string;
  deliveryDeadline?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  pickupCompartmentConfirmedAt?: string;
  deliveryCompartmentConfirmedAt?: string;
  pickupPayloadConfirmedAt?: string;
  deliveryPayloadConfirmedAt?: string;
  deliveryNote?: string;
  rowVersion: number;
  items: DeliveryItemResponse[];
}

// ========================================================
// 2. QR & AUTH VERIFICATION INTERFACES
// ========================================================
export type AuthVerificationPurpose = 'DELIVERY_SENDER' | 'DELIVERY_RECEIVER';

export interface StaffPhoneQrResponse {
  authJobStepId: string;
  purpose: AuthVerificationPurpose;
  expiresAt: string;
  rows: string[];
}

export interface AuthVerificationResponse {
  verificationId: string;
  jobId: string;
  authJobStepId: string;
  actorAccountId: string;
  usedByJobStepId?: string;
  method: 'QR_CODE' | 'STAFF_CONFIRMATION';
  purpose: AuthVerificationPurpose;
  requiredPermission: string;
  issuedAt: string;
  validUntil: string;
  revokedAt?: string;
}

export interface ConfirmedItem {
  itemCode: string;
  quantity: number;
}

export interface DeliveryConfirmRequest {
  verificationId: string;
  jobStepId?: string;
  compartmentClosed: boolean;
  compartmentLocked: boolean;
  items?: ConfirmedItem[];
}

// ========================================================
// 3. SCHEMA 3 JOB STEP RESPONSE (SERVO & COMPARTMENT HANDOVER)
// ========================================================
export type StaffStepResponseType =
  | 'PAYLOAD_CONFIRMED'
  | 'DOOR_CLOSED'
  | 'LOCK_CHECKED'
  | 'UI_DISPLAYED'
  | 'INTERACTION_CONFIRMED';

export interface JobStepResponsePayload {
  responseType: StaffStepResponseType;
  data: Record<string, any>;
  note?: string;
}

export interface JobStepResponseReceipt {
  responseId: string;
  jobStepId: string;
  duplicate: boolean;
  result: Record<string, any>;
  completedAt: string;
}

// ========================================================
// 4. API CLIENT METHODS
// ========================================================
export const deliveryApi = {
  /**
   * Tạo yêu cầu vận chuyển y tế (POST /api/v1/delivery-requests)
   * Bắt buộc truyền Idempotency-Key trong Header
   */
  createDeliveryRequest: async (
    payload: DeliveryCreateRequest,
    idempotencyKey: string,
  ): Promise<DeliveryResponse> => {
    return apiClient.post<DeliveryResponse>('/delivery-requests', payload, {
      'Idempotency-Key': idempotencyKey,
    });
  },

  /**
   * Danh sách yêu cầu vận chuyển (GET /api/v1/delivery-requests)
   */
  getDeliveryRequests: async (params?: {
    status?: ServiceRequestStatus;
    senderId?: string;
    receiverId?: string;
    pickupRoomId?: string;
    deliveryRoomId?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<DeliveryResponse>> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.senderId) query.append('senderId', params.senderId);
    if (params?.receiverId) query.append('receiverId', params.receiverId);
    if (params?.pickupRoomId) query.append('pickupRoomId', params.pickupRoomId);
    if (params?.deliveryRoomId) query.append('deliveryRoomId', params.deliveryRoomId);
    query.append('page', String(params?.page ?? 0));
    query.append('size', String(params?.size ?? 20));
    return apiClient.get<PageResponse<DeliveryResponse>>(
      `/delivery-requests?${query.toString()}`,
    );
  },

  /**
   * Chi tiết 1 yêu cầu vận chuyển (GET /api/v1/delivery-requests/{id})
   */
  getDeliveryById: async (id: string): Promise<DeliveryResponse> => {
    return apiClient.get<DeliveryResponse>(`/delivery-requests/${id}`);
  },

  /**
   * Lấy toàn bộ danh sách yêu cầu vận chuyển (phục vụ MapScreen & MissionScreen)
   */
  getAllDeliveryRequests: async (params?: {
    status?: ServiceRequestStatus;
    senderId?: string;
    receiverId?: string;
    pickupRoomId?: string;
    deliveryRoomId?: string;
  }): Promise<DeliveryResponse[]> => {
    const first = await deliveryApi.getDeliveryRequests({ ...params, page: 0, size: 100 });
    return first?.content || [];
  },

  /**
   * Phát hành mã QR một lần trên điện thoại Staff (POST /api/v1/jobs/{jobId}/staff-phone-qr)
   * để Camera của Robot quét xác thực mở Servo.
   */
  issueStaffPhoneQr: async (jobId: string): Promise<StaffPhoneQrResponse> => {
    return apiClient.post<StaffPhoneQrResponse>(
      `/jobs/${jobId}/staff-phone-qr`,
      {},
    );
  },

  /**
   * Quét và xác thực mã QR từ Robot (POST /api/v1/jobs/{jobId}/qr-verifications)
   * Bước xác thực và kết quả mở khóa ngăn hàng được báo cáo riêng.
   */
  verifyQr: async (
    jobId: string,
    proof: string,
  ): Promise<AuthVerificationResponse> => {
    return apiClient.post<AuthVerificationResponse>(
      `/jobs/${jobId}/qr-verifications`,
      { proof },
    );
  },

  /**
   * Gửi phản hồi bước thực thi Schema 3 cho ngăn chứa hàng & Servo của Robot
   * (POST /api/v1/job-steps/{stepId}/responses)
   * - PAYLOAD_CONFIRMED: Đã đặt đủ hàng vào ngăn (LOAD) / Đã lấy đủ hàng khỏi ngăn (UNLOAD)
   * - DOOR_CLOSED: Đã đóng nắp ngăn hàng -> kích hoạt LOCK_COMPARTMENT đóng Servo
   * - LOCK_CHECKED: Đã kiểm tra ngăn khóa chắc chắn -> hoàn tất bàn giao
   */
  respondJobStep: async (
    stepId: string,
    payload: JobStepResponsePayload,
    idempotencyKey: string,
  ): Promise<JobStepResponseReceipt> => {
    return apiClient.post<JobStepResponseReceipt>(
      `/job-steps/${stepId}/responses`,
      payload,
      { 'Idempotency-Key': idempotencyKey },
    );
  },

  /**
   * Xác nhận gửi hàng vào hộc Robot (Legacy Schema 2: POST /api/v1/delivery-requests/{id}/confirm-pickup)
   */
  confirmPickup: async (
    id: string,
    payload: DeliveryConfirmRequest,
  ): Promise<DeliveryResponse> => {
    return apiClient.post<DeliveryResponse>(
      `/delivery-requests/${id}/confirm-pickup`,
      payload,
    );
  },

  /**
   * Xác nhận nhận hàng từ hộc Robot (Legacy Schema 2: POST /api/v1/delivery-requests/{id}/confirm-delivery)
   */
  confirmDelivery: async (
    id: string,
    payload: DeliveryConfirmRequest,
  ): Promise<DeliveryResponse> => {
    return apiClient.post<DeliveryResponse>(
      `/delivery-requests/${id}/confirm-delivery`,
      payload,
    );
  },
};
