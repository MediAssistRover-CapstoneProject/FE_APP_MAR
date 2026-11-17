import type { DeliveryResponse } from '../../api/modules/delivery.api';
import type {
  AlertResponse,
  EndpointResponse,
  JobResponse,
  RoomDto,
} from '../../api/types';
import { UUID_PATTERN } from './deliveryHandoff';

export interface VerifiedDeliveryNotification {
  alertId: string;
  jobId: string;
  serviceRequestId?: string;
  title: string;
  message: string;
  routeSummary: string;
  jobStatus: string;
  createdAt?: string;
  expectedReceiverAccountId: string;
}

const TERMINAL_INACTIVE_JOB_STATUSES = new Set([
  'CANCELLED',
  'FAILED',
  'SUCCEEDED',
]);

const INACTIVE_SERVICE_REQUEST_STATUSES = new Set([
  'DRAFT',
  'FAILED',
  'CANCELLED',
  'COMPLETED',
]);

function normalizeId(value?: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function findByIdNormalized<T>(
  map: Record<string, T | undefined> | undefined,
  id?: string | null
): T | undefined {
  if (!map || !id) return undefined;
  const trimmed = id.trim();
  if (trimmed in map) return map[trimmed];
  const lower = trimmed.toLowerCase();
  if (lower in map) return map[lower];
  for (const [k, v] of Object.entries(map)) {
    if (k.trim().toLowerCase() === lower) return v;
  }
  return undefined;
}

export function extractJobIdFromAlert(alert?: Pick<AlertResponse, 'dataJson'> | null): string | undefined {
  if (!alert?.dataJson || typeof alert.dataJson !== 'object') return undefined;
  const raw = (alert.dataJson as Record<string, unknown>).jobId ??
    (alert.dataJson as Record<string, unknown>).job_id;
  const cleaned = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return UUID_PATTERN.test(cleaned) ? cleaned : undefined;
}

/**
 * Khi dùng GET /api/v1/alerts, BE có thể trả Alert cho người gửi hoặc Staff cùng phòng.
 * Chỉ nhận khi `recipients` chứa đúng `accountId` đang đăng nhập.
 */
export function alertRecipientsIncludesAccount(
  alert?: Pick<AlertResponse, 'recipients'> | null,
  currentAccountId?: string | null
): boolean {
  const actorId = normalizeId(currentAccountId);
  if (!actorId || !UUID_PATTERN.test(actorId)) return false;
  if (!Array.isArray(alert?.recipients) || alert.recipients.length === 0) return false;
  return alert.recipients.some((recipient) => {
    const recipientId = normalizeId(recipient?.accountId ?? recipient?.account?.accountId);
    return recipientId === actorId;
  });
}

function resolveExpectedReceiverId(
  job?: JobResponse,
  delivery?: DeliveryResponse
): { valid: boolean; accountId: string } {
  const deliveryReceiver = normalizeId(delivery?.expectedReceiverAccountId);
  const input = (job?.inputJson || {}) as Record<string, unknown>;
  const runtimeReceiver = normalizeId(
    input.expected_receiver_account_id ?? input.expectedReceiverAccountId
  );

  if (deliveryReceiver && runtimeReceiver && deliveryReceiver !== runtimeReceiver) {
    return { valid: false, accountId: '' };
  }
  const resolved = deliveryReceiver || runtimeReceiver;
  if (!resolved || !UUID_PATTERN.test(resolved)) {
    return { valid: false, accountId: '' };
  }
  return { valid: true, accountId: resolved };
}

function resolveDeliveryRouteSummary(
  job?: JobResponse,
  delivery?: DeliveryResponse,
  roomsById?: Record<string, RoomDto>,
  endpointsById?: Record<string, EndpointResponse>
): string {
  const input = (job?.inputJson || {}) as Record<string, unknown>;
  let fromText = 'Điểm lấy hàng';
  if (delivery?.pickupRoomId && roomsById?.[delivery.pickupRoomId]) {
    fromText = roomsById[delivery.pickupRoomId].roomName;
  } else if (delivery?.pickupEndpointId && endpointsById?.[delivery.pickupEndpointId]) {
    fromText = endpointsById[delivery.pickupEndpointId].endpointName;
  } else if (typeof input.pickup_endpoint_id === 'string' && endpointsById?.[input.pickup_endpoint_id]) {
    fromText = endpointsById[input.pickup_endpoint_id].endpointName;
  }

  let toText = 'Điểm giao hàng';
  if (delivery?.deliveryRoomId && roomsById?.[delivery.deliveryRoomId]) {
    toText = roomsById[delivery.deliveryRoomId].roomName;
  } else if (delivery?.deliveryEndpointId && endpointsById?.[delivery.deliveryEndpointId]) {
    toText = endpointsById[delivery.deliveryEndpointId].endpointName;
  } else if (delivery?.recipientName) {
    toText = delivery.recipientName;
  } else if (typeof input.delivery_endpoint_id === 'string' && endpointsById?.[input.delivery_endpoint_id]) {
    toText = endpointsById[input.delivery_endpoint_id].endpointName;
  }

  return `${fromText} → ${toText}`;
}

function resolveDeliveryTitle(job?: JobResponse, delivery?: DeliveryResponse): string {
  const firstItem = delivery?.items?.[0];
  if (firstItem?.itemName) return firstItem.itemName;
  if (firstItem?.itemCode) return firstItem.itemCode;
  if (delivery?.request?.requestNote) return delivery.request.requestNote;
  const input = (job?.inputJson || {}) as Record<string, unknown>;
  if (Array.isArray(input.items) && input.items.length > 0) {
    const inputFirst = input.items[0] as Record<string, unknown>;
    if (typeof inputFirst?.item_name === 'string' && inputFirst.item_name) return inputFirst.item_name;
    if (typeof inputFirst?.itemName === 'string' && inputFirst.itemName) return inputFirst.itemName;
  }
  return 'Đơn giao hàng từ Robot';
}

export function verifyAndDedupeDeliveryAlerts(params: {
  alerts: AlertResponse[];
  currentAccountId?: string | null;
  jobsById: Record<string, JobResponse | undefined>;
  deliveriesByRequestId: Record<string, DeliveryResponse | undefined>;
  roomsById?: Record<string, RoomDto>;
  endpointsById?: Record<string, EndpointResponse>;
}): VerifiedDeliveryNotification[] {
  const {
    alerts,
    currentAccountId,
    jobsById,
    deliveriesByRequestId,
    roomsById,
    endpointsById,
  } = params;

  const actorId = normalizeId(currentAccountId);
  if (!actorId || !UUID_PATTERN.test(actorId)) {
    return [];
  }

  const seenAlertIds = new Set<string>();
  const verified: VerifiedDeliveryNotification[] = [];

  for (const alert of alerts || []) {
    if (!alert) continue;

    const notifType = String(alert.notificationType || '').toUpperCase().trim();
    if (notifType !== 'DELIVERY_CREATED') continue;

    const alertStatus = String(alert.status || '').toUpperCase().trim();
    if (alertStatus === 'CLOSED') continue;

    // Bắt buộc alertId hợp lệ & chống trùng theo alertId
    const alertIdKey = normalizeId(alert.alertId);
    if (!alertIdKey || seenAlertIds.has(alertIdKey)) continue;

    // 1. Quyền xem nhiệm vụ hay cùng phòng KHÔNG thay thế recipients đúng tài khoản
    if (!alertRecipientsIncludesAccount(alert, actorId)) continue;

    // 2. Bắt buộc có dataJson.jobId hợp lệ
    const jobId = extractJobIdFromAlert(alert);
    if (!jobId) continue;

    // 3. Đối chiếu Job thực tế từ BE (bản nháp / gửi thất bại / hủy không hiển thị)
    const job = findByIdNormalized(jobsById, jobId);
    if (!job) continue;

    const jobStatusUpper = String(job.status || '').toUpperCase().trim();
    if (!jobStatusUpper || TERMINAL_INACTIVE_JOB_STATUSES.has(jobStatusUpper) || job.cancelRequestedAt) {
      continue;
    }

    // 4. Đối chiếu Delivery & ServiceRequest hợp lệ từ BE + expectedReceiverAccountId
    const serviceRequestId = (job.serviceRequestId || alert.serviceRequestId || '').trim();
    const delivery = findByIdNormalized(deliveriesByRequestId, serviceRequestId);
    if (!delivery || !delivery.request) continue;

    if (String(delivery.request.requestType || '').toUpperCase() !== 'DELIVERY') continue;

    const requestStatus = String(delivery.request.status || '').toUpperCase().trim();
    if (!requestStatus || INACTIVE_SERVICE_REQUEST_STATUSES.has(requestStatus)) continue;

    const receiverCheck = resolveExpectedReceiverId(job, delivery);
    if (!receiverCheck.valid || receiverCheck.accountId !== actorId) {
      continue;
    }

    seenAlertIds.add(alertIdKey);
    verified.push({
      alertId: alert.alertId,
      jobId: job.jobId || jobId,
      serviceRequestId: serviceRequestId || undefined,
      title: resolveDeliveryTitle(job, delivery),
      message: alert.message || 'Có đơn giao hàng mới dành cho bạn.',
      routeSummary: resolveDeliveryRouteSummary(job, delivery, roomsById, endpointsById),
      jobStatus: jobStatusUpper,
      createdAt: alert.createdAt,
      expectedReceiverAccountId: receiverCheck.accountId,
    });
  }

  verified.sort((a, b) => {
    const tA = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tB = b.createdAt ? Date.parse(b.createdAt) : 0;
    return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0);
  });

  return verified;
}
