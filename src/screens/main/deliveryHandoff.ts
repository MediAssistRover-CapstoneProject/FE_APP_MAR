import type {
  AuthVerificationPurpose,
  AuthVerificationResponse,
  DeliveryAuthenticationMethod,
  DeliveryCreateRequest,
  DeliveryResponse,
  JobStepResponsePayload,
} from '../../api/modules/delivery.api';
import type {
  JobResponse,
  JobStepResponse,
  ServiceRequestResponse,
  StaffFaceStatusResponse,
} from '../../api/types';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DeliveryPhase = 'sender' | 'receiver';

export interface DeliveryScanContext {
  jobId: string;
  stepId: string;
  purpose: AuthVerificationPurpose;
  accountId: string;
}

export interface DeliveryFaceAuthContext {
  jobId: string;
  stepId: string;
  purpose: AuthVerificationPurpose;
  phase: DeliveryPhase;
  accountId: string;
  expiresAt?: string;
}

export interface FaceParticipantReadiness {
  role: DeliveryPhase;
  accountId: string;
  status: string;
  avatarVersion?: string | null;
  avatarUrl?: string | null;
  enabled: boolean;
  ready: boolean;
  statusLabel: string;
  guidance: string;
}

export interface DeliveryFaceReadinessEvaluation {
  enabled: boolean;
  ready: boolean;
  sender: FaceParticipantReadiness | null;
  receiver: FaceParticipantReadiness | null;
  summaryMessage: string;
  blockingReason: string | null;
}

export type FaceAuthRuntimeStage =
  | 'NOT_FACE_JOB'
  | 'WAITING_FOR_ROBOT_ARRIVAL'
  | 'WAITING_OTHER_STAFF'
  | 'AWAITING_CAMERA_SCAN'
  | 'MISMATCH'
  | 'EXPIRED'
  | 'VERIFIED'
  | 'FAILED';

export interface FaceAuthRuntimeState {
  stage: FaceAuthRuntimeStage;
  phase: DeliveryPhase;
  purpose: AuthVerificationPurpose;
  authStepId?: string;
  expectedAccountId?: string;
  expectedPersonName: string;
  myTurn: boolean;
  expiresAt?: string | null;
  remainingSeconds: number | null;
  reasonCode?: string | null;
  title: string;
  message: string;
  canRetryRefresh: boolean;
}

function allJobSteps(job?: JobResponse | null): JobStepResponse[] {
  if (!job) return [];
  if (job.steps && job.steps.length > 0) return job.steps;
  return job.tasks?.flatMap(task => task.steps || []) || [];
}

export function resolveAuthenticationMethod(mode?: string | null): DeliveryAuthenticationMethod {
  const normalized = String(mode || '').trim().toUpperCase();
  if (normalized === 'FACE' || normalized === 'FACE_VERIFICATION') {
    return 'FACE_VERIFICATION';
  }
  return 'QR_CODE';
}

export function jobAuthenticationMethod(
  job?: JobResponse | null,
  delivery?: DeliveryResponse | null,
): DeliveryAuthenticationMethod {
  const deliveryMatchesJob =
    !job ||
    !delivery?.request?.serviceRequestId ||
    !job.serviceRequestId ||
    delivery.request.serviceRequestId === job.serviceRequestId;

  if (deliveryMatchesJob && delivery?.authenticationMethod) {
    return resolveAuthenticationMethod(delivery.authenticationMethod);
  }

  const inputMethod =
    job?.inputJson?.authentication_method ?? job?.inputJson?.authenticationMethod;
  if (typeof inputMethod === 'string' && inputMethod.trim().length > 0) {
    return resolveAuthenticationMethod(inputMethod);
  }

  const authStepWithMethod = allJobSteps(job).find(
    step =>
      step.stepTypeSnapshot === 'AUTHENTICATE' &&
      typeof step.resolvedInputsJson?.method === 'string',
  );
  if (authStepWithMethod) {
    return resolveAuthenticationMethod(String(authStepWithMethod.resolvedInputsJson?.method));
  }

  return 'QR_CODE';
}

export function getDeliveryStepLabel(
  stepCode?: string,
  method: DeliveryAuthenticationMethod = 'QR_CODE',
  fallbackType?: string,
): string {
  const isFace = method === 'FACE_VERIFICATION';
  switch (stepCode) {
    case 'MOVE_SENDER':
      return '1. Robot di chuyển đến Điểm lấy hàng (A)';
    case 'AUTH_SENDER':
      return isFace
        ? '2. Camera Robot xác thực khuôn mặt người gửi (Mở Servo)'
        : '2. Robot quét mã QR từ điện thoại người gửi (Mở Servo)';
    case 'UNLOCK_SENDER':
      return '3. Robot đang mở khóa Servo ngăn tủ (A)';
    case 'PAYLOAD_SENDER':
      return '4. Đặt hàng vào ngăn tủ & Xác nhận';
    case 'CLOSE_SENDER':
      return '5. Đóng nắp ngăn tủ tại Điểm A';
    case 'LOCK_SENDER':
      return '6. Robot đang khóa Servo ngăn tủ (A)';
    case 'VERIFY_SENDER':
      return '7. Kiểm tra nắp tủ đã khóa chắc (A)';
    case 'MOVE_RECEIVER':
      return '8. Robot vận chuyển đến Điểm nhận hàng (B)';
    case 'AUTH_RECEIVER':
      return isFace
        ? '9. Camera Robot xác thực khuôn mặt người nhận (Mở Servo)'
        : '9. Robot quét mã QR từ điện thoại người nhận (Mở Servo)';
    case 'UNLOCK_RECEIVER':
      return '10. Robot đang mở khóa Servo để lấy hàng (B)';
    case 'PAYLOAD_RECEIVER':
      return '11. Lấy hàng khỏi ngăn tủ & Xác nhận';
    case 'CLOSE_RECEIVER':
      return '12. Đóng nắp ngăn tủ tại Điểm B';
    case 'LOCK_RECEIVER':
      return '13. Robot đang khóa lại Servo (B)';
    case 'VERIFY_RECEIVER':
      return '14. Kiểm tra khóa tủ & Hoàn tất giao nhận';
    case 'ANNOUNCE':
      return '15. Robot thông báo giao hàng thành công';
    default:
      return fallbackType || stepCode || 'Bước thực thi';
  }
}

export function selectedRunningStep(job: JobResponse | null): JobStepResponse | undefined {
  if (job?.status !== 'RUNNING' || !job.selectedJobStepId || job.cancelRequestedAt) return;
  return allJobSteps(job).find(
    step =>
      step.jobStepId === job.selectedJobStepId &&
      step.status === 'RUNNING' &&
      !step.interruptionRequestedAt,
  );
}

export function deliveryPhase(step?: JobStepResponse): DeliveryPhase | undefined {
  const purpose = step?.resolvedInputsJson?.purpose;
  if (purpose === 'DELIVERY_SENDER') return 'sender';
  if (purpose === 'DELIVERY_RECEIVER') return 'receiver';
  const code = step?.stepCodeSnapshot;
  if (code?.endsWith('_SENDER')) return 'sender';
  if (code?.endsWith('_RECEIVER')) return 'receiver';
  if (step?.stepTypeSnapshot === 'HANDLE_PAYLOAD') {
    if (step.resolvedInputsJson?.action === 'LOAD') return 'sender';
    if (step.resolvedInputsJson?.action === 'UNLOAD') return 'receiver';
  }
  const prompt = step?.resolvedInputsJson?.prompt_key;
  if (typeof prompt === 'string' && prompt.endsWith('_SENDER')) return 'sender';
  if (typeof prompt === 'string' && prompt.endsWith('_RECEIVER')) return 'receiver';
}

export function expectedDeliveryAccount(
  job: JobResponse | null,
  phase?: DeliveryPhase,
  delivery?: DeliveryResponse | null,
): string | undefined {
  if (!job || !phase) return;
  const runtimeAccount = job.inputJson?.[`expected_${phase}_account_id`];
  const assignedAccount =
    delivery?.request?.serviceRequestId === job.serviceRequestId
      ? phase === 'sender'
        ? delivery?.expectedSenderAccountId
        : delivery?.expectedReceiverAccountId
      : undefined;
  if (typeof runtimeAccount === 'string' && UUID_PATTERN.test(runtimeAccount)) {
    if (assignedAccount && runtimeAccount.toLowerCase() !== assignedAccount.toLowerCase()) return;
    return runtimeAccount.toLowerCase();
  }
  if (assignedAccount && UUID_PATTERN.test(assignedAccount)) return assignedAccount.toLowerCase();
}

export function scanContext(
  job: JobResponse | null,
  accountId?: string,
  delivery?: DeliveryResponse,
): DeliveryScanContext | undefined {
  const step = selectedRunningStep(job);
  const phase = deliveryPhase(step);
  if (!job || !step || !phase || !accountId || job.schemaVersion !== 3 || !job.beOrchestrated) return;
  const deliveryMatchesJob =
    !delivery?.request?.serviceRequestId || delivery.request.serviceRequestId === job.serviceRequestId;
  if (
    (deliveryMatchesJob && delivery?.authenticationMethod === 'FACE_VERIFICATION') ||
    job.inputJson?.authentication_method === 'FACE_VERIFICATION'
  ) {
    return;
  }
  const purpose = phase === 'sender' ? 'DELIVERY_SENDER' : 'DELIVERY_RECEIVER';
  if (
    step.stepTypeSnapshot !== 'AUTHENTICATE' ||
    step.resolvedInputsJson?.method !== 'QR_CODE' ||
    (step.resolvedInputsJson?.purpose != null && step.resolvedInputsJson.purpose !== purpose) ||
    expectedDeliveryAccount(job, phase, delivery) !== accountId.toLowerCase()
  ) {
    return;
  }
  return { jobId: job.jobId, stepId: step.jobStepId, purpose, accountId };
}

export function faceAuthContext(
  job: JobResponse | null,
  accountId?: string,
  delivery?: DeliveryResponse,
): DeliveryFaceAuthContext | undefined {
  const step = selectedRunningStep(job);
  const phase = deliveryPhase(step);
  if (!job || !step || !phase || !accountId || job.schemaVersion !== 3 || !job.beOrchestrated) return;
  const deliveryMatchesJob =
    !delivery?.request?.serviceRequestId || delivery.request.serviceRequestId === job.serviceRequestId;
  if (
    (deliveryMatchesJob && delivery?.authenticationMethod === 'QR_CODE') ||
    job.inputJson?.authentication_method === 'QR_CODE'
  ) {
    return;
  }
  const purpose = phase === 'sender' ? 'DELIVERY_SENDER' : 'DELIVERY_RECEIVER';
  if (
    step.stepTypeSnapshot !== 'AUTHENTICATE' ||
    step.resolvedInputsJson?.method !== 'FACE_VERIFICATION' ||
    (step.resolvedInputsJson?.purpose != null && step.resolvedInputsJson.purpose !== purpose) ||
    expectedDeliveryAccount(job, phase, delivery) !== accountId.toLowerCase()
  ) {
    return;
  }
  const expiresAt = typeof step.resultJson?.expires_at === 'string' ? step.resultJson.expires_at : undefined;
  return {
    jobId: job.jobId,
    stepId: step.jobStepId,
    purpose,
    phase,
    accountId,
    expiresAt,
  };
}

export function verificationMatches(result: AuthVerificationResponse, context: DeliveryScanContext): boolean {
  return result.method === 'QR_CODE' &&
    result.jobId === context.jobId &&
    result.authJobStepId === context.stepId &&
    result.purpose === context.purpose &&
    result.actorAccountId?.toLowerCase() === context.accountId.toLowerCase();
}

/**
 * Kiểm tra bước xác thực (`AUTH_SENDER` / `AUTH_RECEIVER`) đã hoàn tất thành công trên BE chưa.
 * Fail-closed: từ chối nếu nhiệm vụ đã hủy, thất bại, gián đoạn, sai mục đích/phương thức/tài khoản hoặc bước chưa `SUCCEEDED`.
 */
export function isAuthStepCompleted(
  job?: JobResponse | null,
  authStepId?: string,
  expectedPurpose?: AuthVerificationPurpose,
  expectedMethod?: DeliveryAuthenticationMethod,
  expectedActorAccountId?: string,
): boolean {
  if (!job || !authStepId || job.status !== 'RUNNING' || job.cancelRequestedAt) {
    return false;
  }
  const allSteps = allJobSteps(job);
  const authStep = allSteps.find(step => step.jobStepId === authStepId);
  if (!authStep || authStep.interruptionRequestedAt) {
    return false;
  }
  if (
    expectedPurpose &&
    authStep.resolvedInputsJson?.purpose != null &&
    authStep.resolvedInputsJson.purpose !== expectedPurpose
  ) {
    return false;
  }
  if (
    expectedPurpose &&
    authStep.resultJson?.purpose != null &&
    authStep.resultJson.purpose !== expectedPurpose
  ) {
    return false;
  }
  if (expectedMethod && authStep.resolvedInputsJson?.method !== expectedMethod) {
    return false;
  }
  if (authStep.resultJson?.verified === false) {
    return false;
  }
  if (expectedActorAccountId) {
    const expectedLower = expectedActorAccountId.toLowerCase();
    const resultActor =
      typeof authStep.resultJson?.actor_account_id === 'string'
        ? authStep.resultJson.actor_account_id.toLowerCase()
        : '';
    if (resultActor && resultActor !== expectedLower) {
      return false;
    }
    const stepPhase = deliveryPhase(authStep);
    const assignedForStep = expectedDeliveryAccount(job, stepPhase);
    if (assignedForStep && assignedForStep !== expectedLower) {
      return false;
    }
  }
  return authStep.status === 'SUCCEEDED';
}

export function evaluateStaffFaceParticipant(
  role: DeliveryPhase,
  expectedAccountId?: string | null,
  statusRes?: StaffFaceStatusResponse | null,
  fetchError?: string | null,
): FaceParticipantReadiness | null {
  const normalizedId = (expectedAccountId || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalizedId)) return null;
  const roleLabel = role === 'sender' ? 'Người gửi' : 'Người nhận';

  if (fetchError && !statusRes) {
    return {
      role,
      accountId: normalizedId,
      status: 'ERROR',
      avatarVersion: null,
      avatarUrl: null,
      enabled: true,
      ready: false,
      statusLabel: 'Lỗi kiểm tra',
      guidance: fetchError,
    };
  }

  if (!statusRes) return null;

  const returnedId = (statusRes.accountId || '').trim().toLowerCase();
  if (returnedId !== normalizedId) {
    return {
      role,
      accountId: normalizedId,
      status: 'ACCOUNT_MISMATCH',
      avatarVersion: statusRes.avatarVersion ?? null,
      avatarUrl: statusRes.avatarUrl ?? null,
      enabled: Boolean(statusRes.enabled),
      ready: false,
      statusLabel: 'Lệch tài khoản',
      guidance: `Trạng thái khuôn mặt của ${roleLabel.toLowerCase()} không khớp với tài khoản đã chọn. Vui lòng làm mới.`,
    };
  }

  const rawStatus = String(statusRes.status || '').trim().toUpperCase() || 'MISSING';
  const enabled = Boolean(statusRes.enabled);
  const hasAvatar = Boolean(statusRes.avatarUrl && String(statusRes.avatarUrl).trim().length > 0);
  const avatarVersion = statusRes.avatarVersion ? String(statusRes.avatarVersion).trim() : null;
  const revTag = avatarVersion ? ` (phiên bản ${avatarVersion.slice(0, 8)})` : '';
  const ready = Boolean(enabled && rawStatus === 'READY' && hasAvatar && avatarVersion);

  if (rawStatus === 'READY') {
    if (!hasAvatar || !avatarVersion) {
      return {
        role,
        accountId: normalizedId,
        status: rawStatus,
        avatarVersion,
        avatarUrl: statusRes.avatarUrl ?? null,
        enabled,
        ready: false,
        statusLabel: 'Thiếu ảnh / phiên bản',
        guidance: `${roleLabel} có trạng thái READY nhưng thiếu avatar hoặc revision hợp lệ. Cần tải lại ảnh đại diện và nhờ Admin duyệt.`,
      };
    }
    return {
      role,
      accountId: normalizedId,
      status: rawStatus,
      avatarVersion,
      avatarUrl: statusRes.avatarUrl ?? null,
      enabled,
      ready: enabled,
      statusLabel: 'Đã duyệt',
      guidance: enabled
        ? `${roleLabel} đã sẵn sàng xác thực khuôn mặt${revTag}.`
        : `Ảnh đã duyệt${revTag}, nhưng xác thực khuôn mặt đang tắt trên máy chủ.`,
    };
  }

  const statusMeta: Record<string, { label: string; guidance: string }> = {
    PENDING: {
      label: 'Chờ Admin duyệt',
      guidance: `${roleLabel} đã có ảnh đại diện${revTag}, cần Admin duyệt trên trang quản trị trước khi tạo đơn khuôn mặt.`,
    },
    MISSING: {
      label: 'Chưa có ảnh đại diện',
      guidance: `${roleLabel} chưa tải ảnh đại diện lên hồ sơ. Cần cập nhật ảnh rõ 1 khuôn mặt rồi nhờ Admin duyệt.`,
    },
    INVALID: {
      label: 'Ảnh không đạt chuẩn',
      guidance: `Ảnh đại diện của ${roleLabel.toLowerCase()}${revTag} không đạt kiểm tra AI (cần 1 khuôn mặt rõ, <= 2 MiB). Hãy tải ảnh mới và nhờ Admin duyệt lại.`,
    },
    REJECTED: {
      label: 'Ảnh bị từ chối',
      guidance: `Ảnh đại diện của ${roleLabel.toLowerCase()}${revTag} đã bị Admin từ chối. Hãy cập nhật ảnh mới và chờ Admin duyệt lại.`,
    },
  };

  const mapped = statusMeta[rawStatus];
  return {
    role,
    accountId: normalizedId,
    status: rawStatus,
    avatarVersion,
    avatarUrl: statusRes.avatarUrl ?? null,
    enabled,
    ready: false,
    statusLabel: mapped ? mapped.label : `Chưa sẵn sàng (${rawStatus})`,
    guidance: mapped
      ? mapped.guidance
      : `${roleLabel} có trạng thái khuôn mặt ${rawStatus}${revTag}, chưa đủ điều kiện tạo đơn xác thực khuôn mặt.`,
  };
}

export function evaluateDeliveryFaceReadiness(input: {
  senderAccountId?: string | null;
  receiverAccountId?: string | null;
  senderStatus?: StaffFaceStatusResponse | null;
  receiverStatus?: StaffFaceStatusResponse | null;
  senderError?: string | null;
  receiverError?: string | null;
}): DeliveryFaceReadinessEvaluation {
  const sender = evaluateStaffFaceParticipant('sender', input.senderAccountId, input.senderStatus, input.senderError);
  const receiver = evaluateStaffFaceParticipant('receiver', input.receiverAccountId, input.receiverStatus, input.receiverError);

  const featureDisabled =
    input.senderStatus?.enabled === false ||
    input.receiverStatus?.enabled === false;
  const enabled = !featureDisabled;

  const senderMissingId = !input.senderAccountId || !UUID_PATTERN.test(input.senderAccountId.trim());
  const receiverMissingId = !input.receiverAccountId || !UUID_PATTERN.test(input.receiverAccountId.trim());

  if (senderMissingId) {
    return {
      enabled,
      ready: false,
      sender,
      receiver,
      summaryMessage: 'Chưa xác định được tài khoản người gửi.',
      blockingReason: 'Chưa xác định được tài khoản người gửi để kiểm tra trạng thái khuôn mặt.',
    };
  }

  if (receiverMissingId) {
    const reason = 'Chọn nhân viên nhận hàng đang trực để kiểm tra trạng thái khuôn mặt.';
    return {
      enabled,
      ready: false,
      sender,
      receiver: null,
      summaryMessage: reason,
      blockingReason: reason,
    };
  }

  if (featureDisabled) {
    const reason =
      'Xác thực khuôn mặt hiện đang tắt trên máy chủ (FACE_ENABLED=false). Hãy chuyển sang QR hoặc liên hệ Quản trị viên.';
    return {
      enabled: false,
      ready: false,
      sender,
      receiver,
      summaryMessage: reason,
      blockingReason: reason,
    };
  }

  if (!sender || !receiver) {
    const reason = 'Đang hoặc chưa tải đủ trạng thái khuôn mặt của người gửi và người nhận. Bấm làm mới để kiểm tra.';
    return {
      enabled,
      ready: false,
      sender,
      receiver,
      summaryMessage: reason,
      blockingReason: reason,
    };
  }

  const issues: string[] = [];
  if (!sender.ready) issues.push(`Người gửi (${sender.statusLabel})`);
  if (!receiver.ready) issues.push(`Người nhận (${receiver.statusLabel})`);

  if (issues.length > 0) {
    const blockingReason =
      sender.status === 'ERROR' && !receiver.ready && receiver.status === 'ERROR'
        ? `Không kiểm tra được trạng thái khuôn mặt từ máy chủ: ${sender.guidance}`
        : `Chưa đủ điều kiện giao hàng khuôn mặt: ${issues.join(' · ')}. Cả hai bên phải có avatar READY do Admin duyệt.`;
    return {
      enabled: sender.enabled && receiver.enabled,
      ready: false,
      sender,
      receiver,
      summaryMessage: blockingReason,
      blockingReason,
    };
  }

  return {
    enabled: true,
    ready: true,
    sender,
    receiver,
    summaryMessage: 'Người gửi và người nhận đều đã được duyệt khuôn mặt (READY).',
    blockingReason: null,
  };
}

export async function loadPairFaceReadiness(params: {
  senderAccountId?: string | null;
  receiverAccountId?: string | null;
  fetchFaceStatus: (accountId: string) => Promise<StaffFaceStatusResponse>;
  stillCurrent?: () => boolean;
}): Promise<{
  senderStatus: StaffFaceStatusResponse | null;
  receiverStatus: StaffFaceStatusResponse | null;
  evaluation: DeliveryFaceReadinessEvaluation;
  stale: boolean;
}> {
  const isCurrent = params.stillCurrent ?? (() => true);
  const senderId = (params.senderAccountId || '').trim().toLowerCase();
  const receiverId = (params.receiverAccountId || '').trim().toLowerCase();
  const hasSender = UUID_PATTERN.test(senderId);
  const hasReceiver = UUID_PATTERN.test(receiverId);

  const [senderRes, receiverRes] = await Promise.all([
    hasSender
      ? params.fetchFaceStatus(senderId).then(
          data => ({ ok: true as const, data }),
          err => ({ ok: false as const, error: (err as { message?: string })?.message || 'Không đọc được trạng thái khuôn mặt.' }),
        )
      : Promise.resolve(null),
    hasReceiver
      ? (hasSender && receiverId === senderId
          ? null
          : params.fetchFaceStatus(receiverId).then(
              data => ({ ok: true as const, data }),
              err => ({ ok: false as const, error: (err as { message?: string })?.message || 'Không đọc được trạng thái khuôn mặt.' }),
            ))
      : Promise.resolve(null),
  ]);

  const effectiveReceiverRes = hasReceiver && hasSender && receiverId === senderId ? senderRes : receiverRes;
  const senderStatus = senderRes && senderRes.ok ? senderRes.data : null;
  const receiverStatus = effectiveReceiverRes && effectiveReceiverRes.ok ? effectiveReceiverRes.data : null;
  const senderError = senderRes && !senderRes.ok ? senderRes.error : null;
  const receiverError = effectiveReceiverRes && !effectiveReceiverRes.ok ? effectiveReceiverRes.error : null;

  const evaluation = evaluateDeliveryFaceReadiness({
    senderAccountId: hasSender ? senderId : null,
    receiverAccountId: hasReceiver ? receiverId : null,
    senderStatus,
    receiverStatus,
    senderError,
    receiverError,
  });

  return {
    senderStatus,
    receiverStatus,
    evaluation,
    stale: !isCurrent(),
  };
}

function faceFailureReasonLabel(reasonCode?: string | null): string | null {
  switch (String(reasonCode || '').trim().toUpperCase()) {
    case 'NO_MATCH':
      return 'Khuôn mặt trước camera robot không khớp với nhân viên được phân công.';
    case 'NO_FACE':
      return 'Camera robot chưa phát hiện thấy khuôn mặt rõ trong khung hình.';
    case 'MULTIPLE_FACES':
      return 'Camera robot phát hiện nhiều hơn một khuôn mặt. Chỉ nhân viên được phân công đứng trước camera.';
    case 'LOW_QUALITY':
      return 'Hình ảnh từ camera robot bị mờ hoặc thiếu sáng. Hãy đứng thẳng và đủ sáng.';
    case 'FACE_AI_UNAVAILABLE':
      return 'Dịch vụ nhận diện khuôn mặt tạm thời không phản hồi. Hãy thử đứng lại trước camera hoặc liên hệ quản trị viên.';
    case 'FACE_AVATAR_CHANGED':
      return 'Ảnh đại diện hoặc phiên bản khuôn mặt đã thay đổi. Quyền xác thực cũ không còn hiệu lực.';
    case 'FACE_SESSION_EXPIRED_OR_CHANGED':
      return 'Phiên xác thực khuôn mặt đã hết hạn (tối đa 120 giây) hoặc robot đã kết nối lại.';
    case 'FACE_ROBOT_NOT_READY':
      return 'Robot hiện chưa bật hoặc chưa hỗ trợ xác thực khuôn mặt (`staff-face-verify-v1`).';
    default:
      return null;
  }
}

export function evaluateFaceAuthRuntimeState(input: {
  job?: JobResponse | null;
  delivery?: DeliveryResponse | null;
  currentAccountId?: string | null;
  trackedAuthStepId?: string | null;
  trackedPurpose?: AuthVerificationPurpose | null;
  nowMs?: number;
}): FaceAuthRuntimeState {
  const nowMs = input.nowMs ?? Date.now();
  const job = input.job ?? null;
  const delivery = input.delivery;
  const method = jobAuthenticationMethod(job, delivery);

  if (!job || method !== 'FACE_VERIFICATION') {
    return {
      stage: 'NOT_FACE_JOB',
      phase: 'sender',
      purpose: 'DELIVERY_SENDER',
      expectedPersonName: '',
      myTurn: false,
      remainingSeconds: null,
      title: '',
      message: '',
      canRetryRefresh: false,
    };
  }

  const allSteps = allJobSteps(job);
  const runningStep = selectedRunningStep(job);
  const faceAuthSteps = allSteps.filter(
    step =>
      step.stepTypeSnapshot === 'AUTHENTICATE' &&
      step.resolvedInputsJson?.method === 'FACE_VERIFICATION',
  );

  let authStep: JobStepResponse | undefined;
  if (input.trackedAuthStepId) {
    authStep = allSteps.find(step => step.jobStepId === input.trackedAuthStepId);
  }
  if (!authStep && runningStep?.stepTypeSnapshot === 'AUTHENTICATE' && runningStep.resolvedInputsJson?.method === 'FACE_VERIFICATION') {
    authStep = runningStep;
  }
  if (!authStep && input.trackedPurpose) {
    authStep = faceAuthSteps.find(step => step.resolvedInputsJson?.purpose === input.trackedPurpose);
  }
  if (!authStep) {
    const runningPhase = deliveryPhase(runningStep);
    if (runningPhase) {
      const targetPurpose = runningPhase === 'receiver' ? 'DELIVERY_RECEIVER' : 'DELIVERY_SENDER';
      authStep = faceAuthSteps.find(step => step.resolvedInputsJson?.purpose === targetPurpose);
    }
  }
  if (!authStep) {
    authStep =
      faceAuthSteps.find(step => step.status === 'RUNNING') ||
      faceAuthSteps.find(step => step.status === 'FAILED') ||
      faceAuthSteps.find(step => step.status === 'PENDING') ||
      faceAuthSteps[faceAuthSteps.length - 1];
  }

  const phase: DeliveryPhase =
    deliveryPhase(authStep) ||
    deliveryPhase(runningStep) ||
    (input.trackedPurpose === 'DELIVERY_RECEIVER'
      ? 'receiver'
      : input.trackedPurpose === 'DELIVERY_SENDER'
      ? 'sender'
      : delivery?.pickedUpAt
      ? 'receiver'
      : 'sender');
  const purpose: AuthVerificationPurpose = phase === 'receiver' ? 'DELIVERY_RECEIVER' : 'DELIVERY_SENDER';

  const expectedAccountId = expectedDeliveryAccount(job, phase, delivery);
  const myTurn =
    !expectedAccountId ||
    Boolean(input.currentAccountId && expectedAccountId === input.currentAccountId.toLowerCase());
  const expectedPersonName =
    phase === 'receiver'
      ? myTurn
        ? 'Bạn (Người nhận hàng)'
        : delivery?.recipientName || 'Nhân viên nhận hàng'
      : myTurn
      ? 'Bạn (Người gửi hàng)'
      : 'Nhân viên gửi hàng';

  const expiresAt = typeof authStep?.resultJson?.expires_at === 'string' ? authStep.resultJson.expires_at : null;
  const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
  const remainingSeconds = Number.isFinite(expiresMs)
    ? Math.max(0, Math.ceil((expiresMs - nowMs) / 1000))
    : null;

  const reasonCodeRaw =
    (typeof authStep?.resultJson?.reason === 'string' && authStep.resultJson.reason) ||
    (typeof authStep?.resultJson?.error_code === 'string' && authStep.resultJson.error_code) ||
    job.errorCode ||
    null;
  const reasonCode = reasonCodeRaw ? String(reasonCodeRaw).trim().toUpperCase() : null;
  const failureDetail = faceFailureReasonLabel(reasonCode) || job.failureReason || null;

  const targetAuthStepId = authStep?.jobStepId || input.trackedAuthStepId || undefined;
  const isVerifiedFromBe = Boolean(
    targetAuthStepId &&
      isAuthStepCompleted(
        job,
        targetAuthStepId,
        purpose,
        'FACE_VERIFICATION',
        expectedAccountId || input.currentAccountId || undefined,
      ),
  );

  if (isVerifiedFromBe) {
    return {
      stage: 'VERIFIED',
      phase,
      purpose,
      authStepId: targetAuthStepId,
      expectedAccountId,
      expectedPersonName,
      myTurn,
      expiresAt,
      remainingSeconds,
      reasonCode,
      title:
        phase === 'sender'
          ? 'Đã xác thực khuôn mặt người gửi'
          : 'Đã xác thực khuôn mặt người nhận',
      message: 'Máy chủ đã xác nhận khuôn mặt khớp và cấp quyền mở khóa ngăn hàng.',
      canRetryRefresh: true,
    };
  }

  const expiredByCode =
    reasonCode === 'FACE_SESSION_EXPIRED_OR_CHANGED' ||
    reasonCode === 'EXPIRED' ||
    reasonCode === 'STEP_TIMEOUT' ||
    reasonCode === 'TIMEOUT';
  const mismatchCode =
    reasonCode === 'NO_MATCH' ||
    reasonCode === 'NO_FACE' ||
    reasonCode === 'MULTIPLE_FACES' ||
    reasonCode === 'LOW_QUALITY' ||
    reasonCode === 'FACE_AVATAR_CHANGED' ||
    reasonCode === 'FACE_AI_UNAVAILABLE';

  const stepOrJobFailed =
    authStep?.status === 'FAILED' ||
    Boolean(job.cancelRequestedAt) ||
    ['FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'].includes(job.status);

  if (stepOrJobFailed) {
    if (expiredByCode || (remainingSeconds !== null && remainingSeconds <= 0)) {
      return {
        stage: 'EXPIRED',
        phase,
        purpose,
        authStepId: targetAuthStepId,
        expectedAccountId,
        expectedPersonName,
        myTurn,
        expiresAt,
        remainingSeconds: 0,
        reasonCode,
        title: 'Phiên quét khuôn mặt đã hết hạn',
        message:
          (failureDetail || 'Quá thời hạn xác thực khuôn mặt (tối đa 120 giây).') +
          ' Ngăn hàng vẫn khóa và không tự chuyển sang QR.',
        canRetryRefresh: true,
      };
    }

    if (mismatchCode) {
      return {
        stage: 'MISMATCH',
        phase,
        purpose,
        authStepId: targetAuthStepId,
        expectedAccountId,
        expectedPersonName,
        myTurn,
        expiresAt,
        remainingSeconds,
        reasonCode,
        title: 'Không khớp / Chưa nhận diện được khuôn mặt',
        message:
          (failureDetail || 'Xác thực khuôn mặt không thành công.') +
          ' Ngăn hàng vẫn khóa và đơn vẫn giữ phương thức khuôn mặt (không tự chuyển sang QR).',
        canRetryRefresh: true,
      };
    }

    return {
      stage: 'FAILED',
      phase,
      purpose,
      authStepId: targetAuthStepId,
      expectedAccountId,
      expectedPersonName,
      myTurn,
      expiresAt,
      remainingSeconds,
      reasonCode,
      title:
        job.cancelRequestedAt || job.status === 'CANCELLED'
          ? 'Nhiệm vụ đã bị hủy'
          : 'Bước xác thực khuôn mặt không thành công',
      message:
        (failureDetail || 'Không thể tiếp tục xác thực khuôn mặt cho nhiệm vụ này.') +
        ' Ngăn hàng vẫn khóa và không tự chuyển sang QR.',
      canRetryRefresh: true,
    };
  }

  const stepIsActiveFaceAuth =
    runningStep &&
    runningStep.stepTypeSnapshot === 'AUTHENTICATE' &&
    runningStep.resolvedInputsJson?.method === 'FACE_VERIFICATION' &&
    (!input.trackedAuthStepId || runningStep.jobStepId === input.trackedAuthStepId);

  if (stepIsActiveFaceAuth) {
    if (!myTurn) {
      return {
        stage: 'WAITING_OTHER_STAFF',
        phase,
        purpose,
        authStepId: runningStep.jobStepId,
        expectedAccountId,
        expectedPersonName,
        myTurn: false,
        expiresAt,
        remainingSeconds,
        reasonCode,
        title: `Đang chờ ${expectedPersonName} xác thực khuôn mặt`,
        message: `Camera robot tại ${phase === 'sender' ? 'Điểm lấy hàng (A)' : 'Điểm giao hàng (B)'} đang chờ đúng ${expectedPersonName} đứng trước robot để xác thực.`,
        canRetryRefresh: true,
      };
    }

    if (remainingSeconds !== null && remainingSeconds <= 0) {
      return {
        stage: 'EXPIRED',
        phase,
        purpose,
        authStepId: runningStep.jobStepId,
        expectedAccountId,
        expectedPersonName,
        myTurn: true,
        expiresAt,
        remainingSeconds: 0,
        reasonCode,
        title: 'Cửa sổ quét khuôn mặt đã hết hạn',
        message:
          'Cửa sổ 120 giây đã kết thúc và đang chờ máy chủ chốt trạng thái bước. Ngăn hàng vẫn khóa và không tự chuyển sang QR.',
        canRetryRefresh: true,
      };
    }

    if (runningStep.resultJson?.verified === false || mismatchCode) {
      return {
        stage: 'MISMATCH',
        phase,
        purpose,
        authStepId: runningStep.jobStepId,
        expectedAccountId,
        expectedPersonName,
        myTurn: true,
        expiresAt,
        remainingSeconds,
        reasonCode,
        title: 'Khuôn mặt chưa khớp — Vui lòng thử lại trước Camera Robot',
        message:
          (failureDetail || 'Camera robot chưa xác nhận khớp khuôn mặt.') +
          ' Giữ 1 khuôn mặt rõ nét trước camera robot khi robot đứng yên (không tự chuyển sang QR).',
        canRetryRefresh: true,
      };
    }

    return {
      stage: 'AWAITING_CAMERA_SCAN',
      phase,
      purpose,
      authStepId: runningStep.jobStepId,
      expectedAccountId,
      expectedPersonName,
      myTurn: true,
      expiresAt,
      remainingSeconds,
      reasonCode,
      title: `Camera Robot đang chờ quét khuôn mặt (${expectedPersonName})`,
      message: `Hãy để ${expectedPersonName} đứng yên trước Camera của Robot tại ${
        phase === 'sender' ? 'Điểm lấy hàng (A)' : 'Điểm giao hàng (B)'
      }. Sau khi máy chủ xác thực thành công, Servo mới mở khóa (không dùng QR).`,
      canRetryRefresh: true,
    };
  }

  return {
    stage: 'WAITING_FOR_ROBOT_ARRIVAL',
    phase,
    purpose,
    authStepId: targetAuthStepId,
    expectedAccountId,
    expectedPersonName,
    myTurn,
    expiresAt,
    remainingSeconds,
    reasonCode,
    title:
      phase === 'sender'
        ? 'Chờ Robot tới Điểm A để bật Camera xác thực khuôn mặt'
        : 'Chờ Robot tới Điểm B để bật Camera xác thực khuôn mặt',
    message: `Người cần đứng trước Camera Robot ở chặng này: ${expectedPersonName}. Đơn sử dụng xác thực khuôn mặt (không mở quét QR).`,
    canRetryRefresh: true,
  };
}

export function handoffResponse(step?: JobStepResponse): JobStepResponsePayload | undefined {
  const phase = deliveryPhase(step);
  if (!step || !phase || step.status !== 'RUNNING' || step.interruptionRequestedAt) return;
  const codeSuffix = phase.toUpperCase();
  const inputs = step.resolvedInputsJson;
  if (!inputs) return;
  if (
    step.stepTypeSnapshot === 'HANDLE_PAYLOAD' &&
    inputs.action === (phase === 'sender' ? 'LOAD' : 'UNLOAD') &&
    Array.isArray(inputs.items) && inputs.items.length > 0
  ) {
    return { responseType: 'PAYLOAD_CONFIRMED', data: { confirmed: true, items: inputs.items } };
  }
  if (step.stepTypeSnapshot !== 'INTERACT') return;
  if ([`CLOSE_${codeSuffix}`, 'CONFIRM_COMPARTMENT_CLOSED', 'STAFF_CLOSE_DOOR_AND_CLEAR_MECHANISM'].includes(String(inputs.prompt_key))) {
    return { responseType: 'DOOR_CLOSED', data: { closed: true } };
  }
  if ([`VERIFY_${codeSuffix}`, 'VERIFY_COMPARTMENT_LOCKED', 'STAFF_PHYSICALLY_VERIFY_LOCK'].includes(String(inputs.prompt_key))) {
    return { responseType: 'LOCK_CHECKED', data: { locked: true } };
  }
}

export function handoffResponseKey(stepId: string, accountId: string, responseType: string): string {
  return `delivery:${stepId}:${accountId.toLowerCase()}:${responseType}`;
}

export interface DeliveryAttempt {
  key: string;
  payload: DeliveryCreateRequest;
  requestId?: string;
  submitted?: boolean;
}

export function shouldDiscardAttemptForMethodChange(
  attempt: DeliveryAttempt | null | undefined,
  nextMethod: DeliveryAuthenticationMethod,
): boolean {
  if (!attempt) return false;
  return (
    resolveAuthenticationMethod(attempt.payload?.authenticationMethod) !==
    resolveAuthenticationMethod(nextMethod)
  );
}

export function prepareDeliveryAttempt(
  existingAttempt: DeliveryAttempt | null | undefined,
  payload: DeliveryCreateRequest,
  createKey: () => string,
): DeliveryAttempt {
  const normalizedMethod = resolveAuthenticationMethod(payload.authenticationMethod);
  const normalizedPayload: DeliveryCreateRequest = {
    ...payload,
    authenticationMethod: normalizedMethod,
  };

  if (existingAttempt && !shouldDiscardAttemptForMethodChange(existingAttempt, normalizedMethod)) {
    const prev = existingAttempt.payload;
    const sameCoreTargets =
      prev?.mapId === normalizedPayload.mapId &&
      prev?.pickupEndpointId === normalizedPayload.pickupEndpointId &&
      (prev?.deliveryEndpointId || '') === (normalizedPayload.deliveryEndpointId || '') &&
      (prev?.deliveryGroupId || '') === (normalizedPayload.deliveryGroupId || '') &&
      (prev?.expectedSenderAccountId || '').toLowerCase() ===
        (normalizedPayload.expectedSenderAccountId || '').toLowerCase() &&
      (prev?.expectedReceiverAccountId || '').toLowerCase() ===
        (normalizedPayload.expectedReceiverAccountId || '').toLowerCase() &&
      (prev?.recipientName || '').trim() === (normalizedPayload.recipientName || '').trim() &&
      JSON.stringify(prev?.items || []) === JSON.stringify(normalizedPayload.items || []);

    if (sameCoreTargets) {
      return {
        ...existingAttempt,
        payload: {
          ...prev,
          authenticationMethod: resolveAuthenticationMethod(prev?.authenticationMethod),
        },
      };
    }
  }

  return {
    key: createKey(),
    payload: normalizedPayload,
  };
}

interface DeliverySubmissionApi {
  create: (payload: DeliveryCreateRequest, key: string) => Promise<DeliveryResponse>;
  submit: (requestId: string) => Promise<ServiceRequestResponse>;
  getRequest: (requestId: string) => Promise<ServiceRequestResponse>;
  findJob: (requestId: string) => Promise<JobResponse | undefined>;
}

export async function continueDeliverySubmission(
  attempt: DeliveryAttempt,
  api: DeliverySubmissionApi,
  stillCurrent: () => boolean,
  onProgress: () => Promise<void> = async () => {},
): Promise<JobResponse | undefined> {
  const normalizedMethod = resolveAuthenticationMethod(attempt.payload?.authenticationMethod);
  attempt.payload = {
    ...attempt.payload,
    authenticationMethod: normalizedMethod,
  };

  if (!attempt.requestId) {
    const created = await api.create(attempt.payload, attempt.key);
    attempt.requestId = created.request?.serviceRequestId;
    if (!attempt.requestId) throw new Error('Máy chủ chưa trả về ID yêu cầu giao hàng.');
    if (created.authenticationMethod) {
      attempt.payload.authenticationMethod = resolveAuthenticationMethod(created.authenticationMethod);
    }
    await onProgress();
  }
  if (!stillCurrent()) return;
  if (!attempt.submitted) {
    try {
      await api.submit(attempt.requestId);
      attempt.submitted = true;
      await onProgress();
    } catch (submitError) {
      if (!stillCurrent()) return;
      const job = await api.findJob(attempt.requestId).catch(() => undefined);
      if (job) {
        attempt.submitted = true;
        await onProgress();
        return stillCurrent() ? job : undefined;
      }
      if (!stillCurrent()) return;
      const request = await api.getRequest(attempt.requestId).catch(() => undefined);
      if (request && ['SUBMITTED', 'QUEUED', 'RUNNING', 'IN_PROGRESS', 'COMPLETED'].includes(request.status)) {
        attempt.submitted = true;
        await onProgress();
      } else {
        throw submitError;
      }
    }
  }
  if (!stillCurrent()) return;
  return api.findJob(attempt.requestId);
}
