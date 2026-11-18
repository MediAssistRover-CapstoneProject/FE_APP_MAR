import { AlertResponse, IncidentResponse } from '../../api/types';
import { MediaSessionResponse } from '../../api/modules/mediaSession.api';

export type SosIncidentTerminalStatus = 'RESOLVED' | 'CLOSED' | 'FALSE_ALARM';
export type EmergencyAlertKind = 'AUTO_FALL' | 'AUTO_GESTURE_SOS' | 'BUTTON_SOS' | 'OTHER';
export type SosCompletionStage =
  | 'NEED_CONFIRM_FIRST'
  | 'READY_TO_COMPLETE'
  | 'RETRY_CLOSE_ONLY'
  | 'ALREADY_CLOSED'
  | 'FALSE_ALARM'
  | 'NO_PERMISSION'
  | 'UNAVAILABLE';

export interface SosCompletionPermission {
  allowed: boolean;
  canResolve: boolean;
  canClose: boolean;
  isResolvedPendingClose: boolean;
  isAlreadyClosed: boolean;
  isFalseAlarm: boolean;
  isAdmin: boolean;
  isAssignedResponder: boolean;
  stage: SosCompletionStage;
  reason?: string;
}

export type SosCompletionOutcomeKind =
  | 'CLOSED'
  | 'ALREADY_CLOSED'
  | 'RESOLVED_ONLY'
  | 'RESOLVED_CLOSE_FAILED'
  | 'FALSE_ALARM'
  | 'NOT_IN_PROGRESS'
  | 'IN_FLIGHT'
  | 'VALIDATION_ERROR'
  | 'ERROR';

export interface SosCompletionResult {
  ok: boolean;
  outcomeKind: SosCompletionOutcomeKind;
  resolveCalled: boolean;
  resolveSucceeded: boolean;
  closeCalled: boolean;
  closed: boolean;
  incident?: IncidentResponse;
  routeCleared?: boolean;
  error?: SosDecisionErrorInfo;
}

export interface MediaViewerPolicy {
  mode: 'ASSIST' | 'MONITOR';
  autoSubscribe: boolean;
  allowAudioSubscribe: boolean;
  allowMicPublish: boolean;
  requestMicPermission: boolean;
  startRoomAudio: boolean;
  renderAudioControls: boolean;
  renderMicControls: boolean;
  endActionLabel: string;
}

export interface SosActorInfo {
  accountId?: string | null;
  role?: string | null;
}

export interface SosCallSessionContext {
  incidentId: string;
  robotId: string;
  sessionId: string;
  alertId?: string;
  mode?: 'ASSIST' | 'MONITOR' | string;
  accountId?: string;
  serverUrl?: string;
  startedAt?: string;
}

export interface SosCompletedCallRecord {
  incidentId: string;
  robotId: string;
  sessionId: string;
  alertId?: string;
  mode?: 'ASSIST' | 'MONITOR' | string;
  accountId?: string;
  serverUrl?: string;
  endReason?: string;
  backendState?: string;
  endedAt: string;
}

export interface MediaSessionEndEvent {
  source: 'UI_END_BUTTON' | 'WEBVIEW_STATUS' | 'MODAL_CLOSE';
  sessionId?: string;
  incidentId?: string;
  robotId?: string;
  uiStatus?: string;
  endReason?: string;
  error?: string;
  backendSession?: MediaSessionResponse | null;
}

export type ReconciledSessionOutcome =
  | {
      kind: 'SESSION_ENDED';
      duplicate: boolean;
      record: SosCompletedCallRecord;
      confirmCalled: false;
    }
  | {
      kind: 'DISMISS_ONLY' | 'MINIMIZED' | 'CONNECTION_ERROR' | 'EXPIRED' | 'FAILED' | 'CONTEXT_MISMATCH';
      message: string;
      confirmCalled: false;
    };

export interface SosDecisionPermission {
  allowed: boolean;
  isAdmin: boolean;
  isAssignedResponder: boolean;
  isTerminal: boolean;
  reason?: string;
}

export interface SosConfirmationMeta {
  isConfirmed: boolean;
  confirmedByAccountId?: string;
  confirmedAt?: string;
  acknowledgedByAccountId?: string;
  acknowledgedAt?: string;
  sosResponderAccountId?: string;
  sosRoutingStatus?: string;
}

export interface SosDecisionErrorInfo {
  status?: number;
  kind: 'FORBIDDEN' | 'CONFLICT' | 'TIMEOUT' | 'VALIDATION' | 'UNKNOWN';
  code?: string;
  message: string;
  shouldRefreshIncident: boolean;
}

export interface SosDecisionResult {
  ok: boolean;
  incident?: IncidentResponse;
  routeCleared?: boolean;
  error?: SosDecisionErrorInfo;
}

const TERMINAL_STATUSES = new Set<string>(['RESOLVED', 'CLOSED', 'FALSE_ALARM']);

export function normalizeScopePart(value?: string | null): string {
  return (value || '').trim();
}

export function buildSosScopeKey(params: {
  serverUrl?: string | null;
  accountId?: string | null;
  incidentId: string;
}): string {
  return [
    normalizeScopePart(params.serverUrl) || 'default-server',
    normalizeScopePart(params.accountId) || 'anonymous',
    normalizeScopePart(params.incidentId),
  ].join('::');
}

export type SosAlertLike = Partial<
  Pick<AlertResponse, 'notificationType' | 'message' | 'incidentId' | 'dataJson'>
>;

function hasGestureSosToken(value: string): boolean {
  if (!value) return false;
  return (
    value.includes('GESTURE_SOS') ||
    value.includes('AI_GESTURE_SOS') ||
    value.includes('HAND_SOS') ||
    value.includes('SOS_SIGNAL') ||
    value === 'AI_SOS' ||
    value === 'AUTO_SOS'
  );
}

export function classifyEmergencyAlertKind(
  alertItem?: SosAlertLike | null,
  incident?: Partial<Pick<IncidentResponse, 'incidentType' | 'incidentId'>> | null
): EmergencyAlertKind {
  const incidentType = (incident?.incidentType || '').toUpperCase().trim();
  const notifType = (alertItem?.notificationType || '').toUpperCase().trim();
  const data = (alertItem?.dataJson || {}) as Record<string, unknown>;
  const sourceEventType = String(
    data.source_event_type ?? data.sourceEventType ?? data.event_type ?? data.eventType ?? ''
  )
    .toUpperCase()
    .trim();
  const dataIncidentType = String(
    data.incident_type ?? data.incidentType ?? data.type ?? ''
  )
    .toUpperCase()
    .trim();
  const source = String(
    data.source ?? data.request_source ?? data.requestSource ?? ''
  )
    .toUpperCase()
    .trim();
  const combinedMsg = `${alertItem?.message || ''}`.toLowerCase();

  // 1. Phát hiện té ngã (camera / Vision AI)
  if (
    incidentType.includes('FALL') ||
    notifType.includes('FALL') ||
    sourceEventType.includes('FALL') ||
    dataIncidentType.includes('FALL') ||
    combinedMsg.includes('té ngã') ||
    combinedMsg.includes('te nga')
  ) {
    return 'AUTO_FALL';
  }

  // 2. Cảnh báo khác (co giật, xâm nhập vùng cấm...) không thuộc SOS hay Té ngã
  if (
    incidentType.includes('SEIZURE') ||
    notifType.includes('SEIZURE') ||
    sourceEventType.includes('SEIZURE') ||
    dataIncidentType.includes('SEIZURE') ||
    incidentType.includes('INTRUSION') ||
    notifType.includes('INTRUSION')
  ) {
    return 'OTHER';
  }

  // 3. Phát hiện SOS tự động từ camera/AI (GESTURE_SOS, AI_GESTURE_SOS, hoặc Alert SOS gắn nguồn VISION_AI)
  const hasVisionAiMarker =
    source === 'VISION_AI' ||
    source === 'DETECTOR' ||
    source === 'AI_CAMERA' ||
    Boolean(
      data.detection_event_id ??
        data.detectionEventId ??
        data.vision_event ??
        data.visionEvent
    );

  if (
    hasGestureSosToken(incidentType) ||
    hasGestureSosToken(notifType) ||
    hasGestureSosToken(sourceEventType) ||
    hasGestureSosToken(dataIncidentType)
  ) {
    return 'AUTO_GESTURE_SOS';
  }

  const hasAnySosMarker =
    incidentType.includes('SOS') ||
    notifType.includes('SOS') ||
    sourceEventType.includes('SOS') ||
    dataIncidentType.includes('SOS') ||
    combinedMsg.includes('sos') ||
    combinedMsg.includes('cấp cứu');

  if (
    hasAnySosMarker &&
    (hasVisionAiMarker ||
      combinedMsg.includes('cử chỉ') ||
      combinedMsg.includes('cu chi') ||
      combinedMsg.includes('gesture'))
  ) {
    return 'AUTO_GESTURE_SOS';
  }

  // 4. Bệnh nhân bấm nút SOS trên robot
  if (hasAnySosMarker) {
    return 'BUTTON_SOS';
  }

  return 'OTHER';
}

export function isFallIncident(
  alertItem?: SosAlertLike | null,
  incident?: Pick<IncidentResponse, 'incidentType'> | null
): boolean {
  return classifyEmergencyAlertKind(alertItem, incident) === 'AUTO_FALL';
}

export function isAutoGestureSosIncident(
  alertItem?: SosAlertLike | null,
  incident?: Pick<IncidentResponse, 'incidentType'> | null
): boolean {
  return classifyEmergencyAlertKind(alertItem, incident) === 'AUTO_GESTURE_SOS';
}

export function isCameraViewOnlyEmergency(
  alertItem?: SosAlertLike | null,
  incident?: Partial<Pick<IncidentResponse, 'incidentType' | 'incidentId'>> | null
): boolean {
  const kind = classifyEmergencyAlertKind(alertItem, incident);
  return kind === 'AUTO_FALL' || kind === 'AUTO_GESTURE_SOS';
}

export function isSosButtonIncident(
  alertItem?: SosAlertLike | null,
  incident?: Partial<Pick<IncidentResponse, 'incidentType' | 'incidentId'>> | null
): boolean {
  return classifyEmergencyAlertKind(alertItem, incident) === 'BUTTON_SOS';
}

export function needsIncidentLookupForSosClassification(
  alertItem?: SosAlertLike | null,
  incident?: Pick<IncidentResponse, 'incidentType'> | null
): boolean {
  if (incident?.incidentType || !alertItem?.incidentId) return false;
  if (classifyEmergencyAlertKind(alertItem, null) !== 'BUTTON_SOS') return false;
  const data = (alertItem.dataJson || {}) as Record<string, unknown>;
  // Robot UI SOS gắn source_payload_hash; cảnh báo VISION_AI có thể chỉ gắn notificationType === "SOS"
  if (data.source_payload_hash || data.sourcePayloadHash) return false;
  return true;
}

export function getMediaViewerPolicyForMode(mode?: string | null): MediaViewerPolicy {
  if (String(mode || '').toUpperCase() === 'ASSIST') {
    return {
      mode: 'ASSIST',
      autoSubscribe: true,
      allowAudioSubscribe: true,
      allowMicPublish: true,
      requestMicPermission: true,
      startRoomAudio: true,
      renderAudioControls: true,
      renderMicControls: true,
      endActionLabel: 'Kết thúc cuộc gọi',
    };
  }
  return {
    mode: 'MONITOR',
    autoSubscribe: false,
    allowAudioSubscribe: false,
    allowMicPublish: false,
    requestMicPermission: false,
    startRoomAudio: false,
    renderAudioControls: false,
    renderMicControls: false,
    endActionLabel: 'Kết thúc xem',
  };
}

export function getMediaViewerPolicyForAlertKind(kind: EmergencyAlertKind): MediaViewerPolicy {
  return getMediaViewerPolicyForMode(kind === 'BUTTON_SOS' ? 'ASSIST' : 'MONITOR');
}

export function classifyCameraMonitorOpenError(
  err: unknown,
  sessions?: MediaSessionResponse[] | null,
  targetRobotId?: string | null,
  incident?: Pick<IncidentResponse, 'sosRoutingStatus' | 'sosResponderAccountId'> | null
): string {
  const anyErr = err as { status?: number; message?: string } | null;
  const status = typeof anyErr?.status === 'number' ? anyErr.status : undefined;
  const raw = String(anyErr?.message || '').trim();
  const upper = raw.toUpperCase();

  if (status === 409 || upper.includes('ROBOT_MEDIA_SESSION_ALREADY_OPEN')) {
    const blockingRingingAssist = (sessions || []).find(
      (s) =>
        (!targetRobotId || s.robotId === targetRobotId) &&
        s.mode === 'ASSIST' &&
        (s.state === 'RINGING' || s.state === 'CONNECTING' || s.state === 'ACTIVE')
    );
    if (blockingRingingAssist) {
      return `Robot đang có phiên ASSIST (${blockingRingingAssist.state}) được máy chủ tạo sẵn cho cảnh báo này nên chưa thể mở phiên MONITOR chỉ xem camera (409). Vui lòng bấm Thử lại sau khi phiên chờ hết hạn hoặc cập nhật BE không tự mở ASSIST cho cảnh báo AI.`;
    }
    return 'Robot đang có phiên media khác đang mở (409 ROBOT_MEDIA_SESSION_ALREADY_OPEN). Vui lòng thử lại sau.';
  }

  if (upper.includes('MEDIA_DEVICE_NOT_CONNECTED')) {
    return 'Robot chưa kết nối kênh truyền media (SSE) với máy chủ. Kiểm tra kết nối Pi/Robot rồi bấm Thử lại.';
  }
  if (upper.includes('MEDIA_INCIDENT_ROBOT_MISMATCH')) {
    return 'Robot được chọn không khớp với robot ghi nhận trong sự cố.';
  }
  if (upper.includes('MEDIA_DISABLED') || upper.includes('MEDIA_SERVER')) {
    return 'Dịch vụ camera trực tiếp trên máy chủ đang tạm tắt hoặc gián đoạn. Vui lòng thử lại.';
  }
  if (status === 403 || upper.includes('ACCESS') || upper.includes('FORBIDDEN') || upper.includes('RESPONDER')) {
    if (incident?.sosRoutingStatus && incident.sosRoutingStatus !== 'ASSIGNED') {
      return `Sự cố chưa có nhân viên trực phòng SOS được phân công (${incident.sosRoutingStatus}). Vui lòng check-in ca trực tại phòng SOS hoặc dùng tài khoản ADMIN.`;
    }
    if (incident?.sosResponderAccountId) {
      return 'Chỉ nhân viên trực SOS được phân công hoặc ADMIN mới có quyền mở camera xác minh sự cố này.';
    }
    return raw || 'Tài khoản Staff hiện tại không có quyền mở camera chỉ xem cho sự cố này.';
  }
  return raw || 'Camera robot hiện chưa khả dụng. Vui lòng bấm Thử lại.';
}

export function isTerminalIncidentStatus(status?: string | null): boolean {
  if (!status) return false;
  return TERMINAL_STATUSES.has(status.toUpperCase());
}

/**
 * Phải đối soát đúng phiên media đã thật sự kết thúc (backend state === 'ENDED' hoặcStaff chủ động cúp máy),
 * phân biệt rõ với đóng modal, thu nhỏ, mất kết nối hoặc phiên FAILED/EXPIRED.
 */
export async function reconcileMediaSessionEnd(params: {
  event: MediaSessionEndEvent;
  activeContext: SosCallSessionContext | null;
  handledSessionIds: Set<string>;
  fetchSession?: (sessionId: string) => Promise<MediaSessionResponse>;
  nowIso?: () => string;
}): Promise<ReconciledSessionOutcome> {
  const { event, activeContext, handledSessionIds, fetchSession } = params;
  const nowIso = params.nowIso ?? (() => new Date().toISOString());

  if (!activeContext || !activeContext.incidentId || !activeContext.robotId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Thiếu ngữ cảnh cuộc gọi SOS đang hoạt động.',
      confirmCalled: false,
    };
  }

  const targetSessionId = (event.sessionId || activeContext.sessionId || '').trim();
  if (!targetSessionId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Không xác định được sessionId của cuộc gọi.',
      confirmCalled: false,
    };
  }

  if (activeContext.sessionId && event.sessionId && activeContext.sessionId !== event.sessionId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Sự kiện kết thúc không khớp phiên đàm thoại hiện tại.',
      confirmCalled: false,
    };
  }

  if (event.incidentId && event.incidentId !== activeContext.incidentId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Sự kiện không khớp sự cố SOS đang mở.',
      confirmCalled: false,
    };
  }

  if (event.robotId && event.robotId !== activeContext.robotId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Sự kiện kết thúc không khớp robot của sự cố hiện tại.',
      confirmCalled: false,
    };
  }

  if (event.backendSession?.robotId && event.backendSession.robotId !== activeContext.robotId) {
    return {
      kind: 'CONTEXT_MISMATCH',
      message: 'Phiên máy chủ thuộc về một robot khác với sự cố hiện tại.',
      confirmCalled: false,
    };
  }

  const isMonitorContext = String(activeContext.mode || '').toUpperCase() === 'MONITOR';
  const sessionLabel = isMonitorContext ? 'Phiên xem camera' : 'Phiên đàm thoại';
  const uiStatus = (event.uiStatus || '').toUpperCase();

  // Đóng/thu nhỏ hộp thoại khi không bấm kết thúc không tự xem là phiên đã kết thúc
  if (event.source === 'MODAL_CLOSE') {
    if (uiStatus === 'MINIMIZED') {
      return {
        kind: 'MINIMIZED',
        message: `${sessionLabel} đang thu nhỏ, phiên vẫn tiếp tục.`,
        confirmCalled: false,
      };
    }

    // Nếu BE thực sự đã ghi nhận ENDED (do Staff kết thúc, không phải bị preemption/thu hồi) thì mới đánh dấu kết thúc
    if (
      event.backendSession?.state === 'ENDED' &&
      !isNonVoluntaryEndReason(event.backendSession.endReason)
    ) {
      return markSessionEndedOnce(event.backendSession, activeContext, handledSessionIds, nowIso);
    }

    if (fetchSession) {
      try {
        const latest = await fetchSession(targetSessionId);
        if (latest?.state === 'ENDED' && !isNonVoluntaryEndReason(latest.endReason)) {
          return markSessionEndedOnce(latest, activeContext, handledSessionIds, nowIso);
        }
        if (latest?.state === 'EXPIRED') {
          return {
            kind: 'EXPIRED',
            message: `${sessionLabel} đã hết hạn.`,
            confirmCalled: false,
          };
        }
        if (latest?.state === 'FAILED') {
          return {
            kind: 'FAILED',
            message: `${sessionLabel} gặp lỗi.`,
            confirmCalled: false,
          };
        }
      } catch {
        // Bỏ qua lỗi mạng khi đóng modal; không tự đánh dấu ENDED
      }
    }

    return {
      kind: 'DISMISS_ONLY',
      message: isMonitorContext
        ? 'Đã đóng cửa sổ xem camera mà chưa bấm Kết thúc xem.'
        : 'Đã đóng cửa sổ cuộc gọi mà chưa kết thúc phiên media.',
      confirmCalled: false,
    };
  }

  if (uiStatus === 'MINIMIZED') {
    return {
      kind: 'MINIMIZED',
      message: `${sessionLabel} đang thu nhỏ.`,
      confirmCalled: false,
    };
  }

  if (uiStatus === 'ERROR' || uiStatus === 'TIMEOUT' || uiStatus === 'CAMERA_LOST') {
    return {
      kind: 'CONNECTION_ERROR',
      message: event.error || `${sessionLabel} gián đoạn do lỗi kết nối hoặc không có hình ảnh camera.`,
      confirmCalled: false,
    };
  }

  if (uiStatus === 'EXPIRED') {
    return {
      kind: 'EXPIRED',
      message: `${sessionLabel} đã hết hạn.`,
      confirmCalled: false,
    };
  }

  if (uiStatus === 'FAILED') {
    return {
      kind: 'FAILED',
      message: event.error || `${sessionLabel} thất bại.`,
      confirmCalled: false,
    };
  }

  // Trường hợp WEBVIEW_STATUS === 'ENDED' hoặc Staff bấm gác máy / Kết thúc xem (UI_END_BUTTON)
  let backendState = event.backendSession?.state;
  let endReason = event.backendSession?.endReason || event.endReason;

  if (event.source !== 'UI_END_BUTTON' && isNonVoluntaryEndReason(endReason)) {
    return {
      kind: 'CONNECTION_ERROR',
      message: `${sessionLabel} bị gián đoạn (${endReason}). Vui lòng thử mở lại camera.`,
      confirmCalled: false,
    };
  }

  const looksLikeNonEndedReason = isNonVoluntaryEndReason(endReason);

  // Đối soát lại BE khi WebView báo ENDED (tránh LiveKit mất mạng nhất thời bị hiểu nhầm là kết thúc phiên thật)
  const shouldVerifyWithServer =
    Boolean(fetchSession) &&
    event.backendSession?.state !== 'ENDED' &&
    (event.source === 'WEBVIEW_STATUS' || Boolean(looksLikeNonEndedReason));

  if (shouldVerifyWithServer && fetchSession) {
    try {
      const serverSession = await fetchSession(targetSessionId);
      backendState = serverSession.state;
      endReason = serverSession.endReason || endReason;
      if (serverSession.state === 'EXPIRED') {
        return {
          kind: 'EXPIRED',
          message: `${sessionLabel} đã hết hạn trên máy chủ.`,
          confirmCalled: false,
        };
      }
      if (serverSession.state === 'FAILED') {
        return {
          kind: 'FAILED',
          message: `${sessionLabel} bị lỗi trên máy chủ.`,
          confirmCalled: false,
        };
      }
      if (serverSession.state !== 'ENDED') {
        return {
          kind: 'CONNECTION_ERROR',
          message: 'Mất kết nối tạm thời; phiên media trên máy chủ chưa kết thúc.',
          confirmCalled: false,
        };
      }
      if (event.source !== 'UI_END_BUTTON' && isNonVoluntaryEndReason(endReason)) {
        return {
          kind: 'CONNECTION_ERROR',
          message: `${sessionLabel} bị ngắt trước khi hoàn tất (${endReason}). Vui lòng thử lại.`,
          confirmCalled: false,
        };
      }
    } catch {
      return {
        kind: 'CONNECTION_ERROR',
        message: 'Không thể đối soát trạng thái kết thúc phiên media với máy chủ.',
        confirmCalled: false,
      };
    }
  }

  if (event.source === 'WEBVIEW_STATUS' && uiStatus !== 'ENDED') {
    return {
      kind: 'DISMISS_ONLY',
      message: `Trạng thái phiên hiện tại là ${uiStatus || 'UNKNOWN'}.`,
      confirmCalled: false,
    };
  }

  if (event.source === 'UI_END_BUTTON' && backendState && backendState !== 'ENDED') {
    if (backendState === 'EXPIRED') {
      return { kind: 'EXPIRED', message: `${sessionLabel} đã hết hạn.`, confirmCalled: false };
    }
    if (backendState === 'FAILED') {
      return { kind: 'FAILED', message: `${sessionLabel} thất bại.`, confirmCalled: false };
    }
    if (['RINGING', 'CONNECTING', 'ACTIVE', 'RECONNECTING'].includes(backendState)) {
      return {
        kind: 'CONNECTION_ERROR',
        message: `${sessionLabel} chưa kết thúc trên máy chủ (${backendState}). Vui lòng thử lại.`,
        confirmCalled: false,
      };
    }
  }

  const effectiveEndReason =
    endReason ||
    (event.source === 'UI_END_BUTTON'
      ? isMonitorContext
        ? 'STAFF_ENDED_VIEW'
        : 'STAFF_ENDED'
      : undefined);
  const record: SosCompletedCallRecord = {
    incidentId: activeContext.incidentId,
    robotId: activeContext.robotId,
    sessionId: targetSessionId,
    alertId: activeContext.alertId,
    mode: event.backendSession?.mode || activeContext.mode,
    accountId: activeContext.accountId,
    serverUrl: activeContext.serverUrl,
    endReason: effectiveEndReason,
    backendState: backendState || 'ENDED',
    endedAt: event.backendSession?.endedAt || nowIso(),
  };

  if (handledSessionIds.has(targetSessionId)) {
    return {
      kind: 'SESSION_ENDED',
      duplicate: true,
      record,
      confirmCalled: false,
    };
  }

  handledSessionIds.add(targetSessionId);
  return {
    kind: 'SESSION_ENDED',
    duplicate: false,
    record,
    confirmCalled: false,
  };
}

export function isNonVoluntaryEndReason(reason?: string | null): boolean {
  if (!reason) return false;
  const upper = reason.toUpperCase();
  return [
    'EXPIRED',
    'FAILED',
    'TIMEOUT',
    'CONNECTION_ERROR',
    'NETWORK_ERROR',
    'PREEMPTED',
    'REVOKED',
    'INCIDENT_CLOSED',
  ].some((token) => upper.includes(token));
}

function markSessionEndedOnce(
  backendSession: MediaSessionResponse,
  activeContext: SosCallSessionContext,
  handledSessionIds: Set<string>,
  nowIso: () => string
): ReconciledSessionOutcome {
  const sessionId = backendSession.sessionId || activeContext.sessionId;
  const record: SosCompletedCallRecord = {
    incidentId: backendSession.incidentId || activeContext.incidentId,
    robotId: backendSession.robotId || activeContext.robotId,
    sessionId,
    alertId: activeContext.alertId,
    mode: backendSession.mode || activeContext.mode,
    accountId: activeContext.accountId,
    serverUrl: activeContext.serverUrl,
    endReason: backendSession.endReason ?? undefined,
    backendState: backendSession.state,
    endedAt: backendSession.endedAt || nowIso(),
  };

  if (handledSessionIds.has(sessionId)) {
    return { kind: 'SESSION_ENDED', duplicate: true, record, confirmCalled: false };
  }

  handledSessionIds.add(sessionId);
  return { kind: 'SESSION_ENDED', duplicate: false, record, confirmCalled: false };
}

export function canActOnSosDecision(
  incident: Pick<IncidentResponse, 'status' | 'sosResponderAccountId' | 'sosRoutingStatus'> | null | undefined,
  actor: SosActorInfo | null | undefined
): SosDecisionPermission {
  const roleUpper = (actor?.role || '').toUpperCase().replace(/^ROLE_/, '');
  const isAdmin = roleUpper === 'ADMIN';

  if (!incident) {
    return {
      allowed: false,
      isAdmin,
      isAssignedResponder: false,
      isTerminal: false,
      reason: 'Chưa tải được dữ liệu sự cố từ máy chủ.',
    };
  }

  if (isTerminalIncidentStatus(incident.status)) {
    return {
      allowed: false,
      isAdmin,
      isAssignedResponder: false,
      isTerminal: true,
      reason: `Sự cố đã ở trạng thái ${incident.status}.`,
    };
  }

  const assignedAccountId = (incident.sosResponderAccountId || '').trim();
  const actorAccountId = (actor?.accountId || '').trim();
  const isAssignedResponder = Boolean(assignedAccountId && actorAccountId && assignedAccountId === actorAccountId);

  if (isAdmin || isAssignedResponder) {
    return {
      allowed: true,
      isAdmin,
      isAssignedResponder,
      isTerminal: false,
    };
  }

  if (assignedAccountId) {
    return {
      allowed: false,
      isAdmin: false,
      isAssignedResponder: false,
      isTerminal: false,
      reason: 'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền xác nhận.',
    };
  }

  return {
    allowed: false,
    isAdmin: false,
    isAssignedResponder: false,
    isTerminal: false,
    reason: 'Sự cố chưa có tài khoản Staff được phân công xử lý (hoặc chỉ ADMIN được thao tác).',
  };
}

export function validateFalseAlarmReason(note: string | null | undefined): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = (note || '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      error: 'Vui lòng nhập lý do báo nhầm trước khi gửi.',
    };
  }
  return { valid: true, cleaned };
}

export function extractSosConfirmationMeta(incident?: IncidentResponse | null): SosConfirmationMeta {
  if (!incident) {
    return { isConfirmed: false };
  }
  const hasExplicitConfirmed = Boolean(incident.confirmedByAccountId || incident.confirmedAt);
  const isInProgress = incident.status === 'IN_PROGRESS';
  return {
    isConfirmed: isInProgress || hasExplicitConfirmed,
    confirmedByAccountId: incident.confirmedByAccountId,
    confirmedAt: incident.confirmedAt,
    acknowledgedByAccountId: incident.acknowledgedByAccountId,
    acknowledgedAt: incident.acknowledgedAt,
    sosResponderAccountId: incident.sosResponderAccountId,
    sosRoutingStatus: incident.sosRoutingStatus,
  };
}

export function classifySosDecisionError(err: unknown): SosDecisionErrorInfo {
  const anyErr = err as { status?: number; message?: string; code?: string } | null;
  const status = typeof anyErr?.status === 'number' ? anyErr.status : undefined;
  const rawMessage = (anyErr?.message || '').trim();
  const lower = rawMessage.toLowerCase();
  const upper = rawMessage.toUpperCase();
  const errCodeUpper = String(anyErr?.code || '').toUpperCase();

  if (
    upper.includes('MEDIA_FALL_REVIEW_NOT_ACTIVE') ||
    errCodeUpper === 'MEDIA_FALL_REVIEW_NOT_ACTIVE'
  ) {
    return {
      status: status ?? 409,
      kind: 'VALIDATION',
      code: 'MEDIA_FALL_REVIEW_NOT_ACTIVE',
      message: 'Cần mở "Xem camera robot" và bấm "Xác nhận sự cố" ngay khi camera đang hiển thị hình ảnh trực tiếp.',
      shouldRefreshIncident: true,
    };
  }

  if (status === 403) {
    return {
      status,
      kind: 'FORBIDDEN',
      message: rawMessage || 'Bạn không có quyền xác nhận hoặc hủy báo sự cố SOS này.',
      shouldRefreshIncident: true,
    };
  }

  if (status === 409) {
    return {
      status,
      kind: 'CONFLICT',
      message: rawMessage || 'Trạng thái sự cố đã thay đổi trên máy chủ. Dữ liệu đã được làm mới.',
      shouldRefreshIncident: true,
    };
  }

  if (
    status === 408 ||
    lower.includes('timeout') ||
    lower.includes('quá thời gian') ||
    anyErr?.code === 'ECONNABORTED'
  ) {
    return {
      status: status ?? 408,
      kind: 'TIMEOUT',
      message: rawMessage || 'Kết nối tới máy chủ quá thời gian chờ. Đang làm mới trạng thái sự cố.',
      shouldRefreshIncident: true,
    };
  }

  if (status === 400 || status === 422) {
    return {
      status,
      kind: 'VALIDATION',
      message: rawMessage || 'Dữ liệu hoặc trạng thái sự cố không hợp lệ cho thao tác này.',
      shouldRefreshIncident: true,
    };
  }

  return {
    status,
    kind: 'UNKNOWN',
    message: rawMessage || 'Không thể gửi quyết định xử lý SOS tới máy chủ.',
    shouldRefreshIncident: true,
  };
}

export async function submitSosConfirmDecision(params: {
  incidentId: string;
  inFlightIncidentIds: Set<string>;
  confirmIncident: (id: string) => Promise<IncidentResponse>;
  refreshIncident: (id: string) => Promise<IncidentResponse | null>;
}): Promise<SosDecisionResult> {
  const { incidentId, inFlightIncidentIds, confirmIncident, refreshIncident } = params;
  if (inFlightIncidentIds.has(incidentId)) {
    return {
      ok: false,
      error: {
        kind: 'VALIDATION',
        message: 'Yêu cầu trước đó đang được gửi tới máy chủ.',
        shouldRefreshIncident: false,
      },
    };
  }

  inFlightIncidentIds.add(incidentId);
  try {
    const updated = await confirmIncident(incidentId);
    return {
      ok: true,
      incident: updated,
    };
  } catch (err) {
    const info = classifySosDecisionError(err);
    let refreshed: IncidentResponse | undefined;
    if (info.shouldRefreshIncident) {
      try {
        const latest = await refreshIncident(incidentId);
        if (latest) refreshed = latest;
      } catch {
        // Giữ thông báo lỗi chính cho người dùng
      }
    }
    return {
      ok: false,
      incident: refreshed,
      error: info,
    };
  } finally {
    inFlightIncidentIds.delete(incidentId);
  }
}
export async function submitSosFalseAlarmDecision(params: {
  incidentId: string;
  resolutionNote: string;
  inFlightIncidentIds: Set<string>;
  markFalseAlarm: (id: string, note: string) => Promise<IncidentResponse>;
  refreshIncident: (id: string) => Promise<IncidentResponse | null>;
  clearRouteForIncident?: (incidentId: string) => void;
}): Promise<SosDecisionResult> {
  const { incidentId, resolutionNote, inFlightIncidentIds, markFalseAlarm, refreshIncident, clearRouteForIncident } =
    params;

  const reasonCheck = validateFalseAlarmReason(resolutionNote);
  if (!reasonCheck.valid) {
    return {
      ok: false,
      error: {
        kind: 'VALIDATION',
        message: reasonCheck.error || 'Thiếu lý do báo nhầm.',
        shouldRefreshIncident: false,
      },
    };
  }

  if (inFlightIncidentIds.has(incidentId)) {
    return {
      ok: false,
      error: {
        kind: 'VALIDATION',
        message: 'Yêu cầu trước đó đang được gửi tới máy chủ.',
        shouldRefreshIncident: false,
      },
    };
  }

  inFlightIncidentIds.add(incidentId);
  try {
    const updated = await markFalseAlarm(incidentId, reasonCheck.cleaned);
    clearRouteForIncident?.(incidentId);
    return {
      ok: true,
      incident: updated,
      routeCleared: true,
    };
  } catch (err) {
    const info = classifySosDecisionError(err);
    let refreshed: IncidentResponse | undefined;
    if (info.shouldRefreshIncident) {
      try {
        const latest = await refreshIncident(incidentId);
        if (latest) {
          refreshed = latest;
          if (latest.status === 'FALSE_ALARM') {
            clearRouteForIncident?.(incidentId);
          }
        }
      } catch {
        // Giữ thông báo lỗi chính
      }
    }
    return {
      ok: false,
      incident: refreshed,
      error: info,
    };
  } finally {
    inFlightIncidentIds.delete(incidentId);
  }
}

export function canActOnSosCompletion(
  incident:
    | Pick<
        IncidentResponse,
        'status' | 'sosResponderAccountId' | 'sosRoutingStatus' | 'acknowledgedByAccountId'
      >
    | null
    | undefined,
  actor: SosActorInfo | null | undefined
): SosCompletionPermission {
  const roleUpper = (actor?.role || '').toUpperCase().replace(/^ROLE_/, '');
  const isAdmin = roleUpper === 'ADMIN';
  const assignedAccountId = (incident?.sosResponderAccountId || '').trim().toLowerCase();
  const actorAccountId = (actor?.accountId || '').trim().toLowerCase();
  const isAssignedResponder = Boolean(
    assignedAccountId && actorAccountId && assignedAccountId === actorAccountId
  );

  if (!incident) {
    return {
      allowed: false,
      canResolve: false,
      canClose: false,
      isResolvedPendingClose: false,
      isAlreadyClosed: false,
      isFalseAlarm: false,
      isAdmin,
      isAssignedResponder: false,
      stage: 'UNAVAILABLE',
      reason: 'Chưa tải được dữ liệu sự cố từ máy chủ.',
    };
  }

  const statusUpper = String(incident.status || '').toUpperCase();
  if (statusUpper === 'CLOSED') {
    return {
      allowed: false,
      canResolve: false,
      canClose: false,
      isResolvedPendingClose: false,
      isAlreadyClosed: true,
      isFalseAlarm: false,
      isAdmin,
      isAssignedResponder,
      stage: 'ALREADY_CLOSED',
      reason: 'Sự cố đã được đóng hoàn tất (CLOSED).',
    };
  }

  if (statusUpper === 'FALSE_ALARM') {
    return {
      allowed: false,
      canResolve: false,
      canClose: false,
      isResolvedPendingClose: false,
      isAlreadyClosed: false,
      isFalseAlarm: true,
      isAdmin,
      isAssignedResponder,
      stage: 'FALSE_ALARM',
      reason: 'Sự cố đã được đánh dấu báo nhầm (FALSE_ALARM).',
    };
  }

  if (!isAdmin && !isAssignedResponder) {
    return {
      allowed: false,
      canResolve: false,
      canClose: false,
      isResolvedPendingClose: statusUpper === 'RESOLVED',
      isAlreadyClosed: false,
      isFalseAlarm: false,
      isAdmin: false,
      isAssignedResponder: false,
      stage: 'NO_PERMISSION',
      reason: assignedAccountId
        ? 'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền kết thúc sự cố.'
        : 'Sự cố chưa có tài khoản Staff được phân công xử lý (chỉ ADMIN mới được kết thúc).',
    };
  }

  if (statusUpper === 'OPEN' || statusUpper === 'ACKNOWLEDGED') {
    return {
      allowed: false,
      canResolve: false,
      canClose: false,
      isResolvedPendingClose: false,
      isAlreadyClosed: false,
      isFalseAlarm: false,
      isAdmin,
      isAssignedResponder,
      stage: 'NEED_CONFIRM_FIRST',
      reason: 'Cần xác nhận sự cố thật (/confirm) để chuyển sang IN_PROGRESS trước khi kết thúc SOS.',
    };
  }

  if (statusUpper === 'RESOLVED') {
    return {
      allowed: true,
      canResolve: false,
      canClose: true,
      isResolvedPendingClose: true,
      isAlreadyClosed: false,
      isFalseAlarm: false,
      isAdmin,
      isAssignedResponder,
      stage: 'RETRY_CLOSE_ONLY',
    };
  }

  if (statusUpper === 'IN_PROGRESS') {
    const ackAccountId = (incident.acknowledgedByAccountId || '').trim().toLowerCase();
    if (!isAdmin && ackAccountId && actorAccountId && ackAccountId !== actorAccountId) {
      return {
        allowed: false,
        canResolve: false,
        canClose: false,
        isResolvedPendingClose: false,
        isAlreadyClosed: false,
        isFalseAlarm: false,
        isAdmin: false,
        isAssignedResponder,
        stage: 'NO_PERMISSION',
        reason: 'Sự cố đang được tài khoản khác tiếp nhận xác nhận nên bạn chưa thể kết thúc.',
      };
    }
    return {
      allowed: true,
      canResolve: true,
      canClose: true,
      isResolvedPendingClose: false,
      isAlreadyClosed: false,
      isFalseAlarm: false,
      isAdmin,
      isAssignedResponder,
      stage: 'READY_TO_COMPLETE',
    };
  }

  return {
    allowed: false,
    canResolve: false,
    canClose: false,
    isResolvedPendingClose: false,
    isAlreadyClosed: false,
    isFalseAlarm: false,
    isAdmin,
    isAssignedResponder,
    stage: 'UNAVAILABLE',
    reason: `Trạng thái sự cố ${incident.status || 'UNKNOWN'} chưa hỗ trợ kết thúc.`,
  };
}

export function validateResolutionNote(
  note: string | null | undefined
): { valid: boolean; cleaned: string; error?: string } {
  const cleaned = (note || '').trim();
  if (!cleaned) {
    return {
      valid: false,
      cleaned: '',
      error: 'Vui lòng nhập ghi chú xử lý (resolutionNote) trước khi xác nhận kết thúc SOS.',
    };
  }
  if (cleaned.length > 4000) {
    return {
      valid: false,
      cleaned,
      error: 'Ghi chú xử lý tối đa 4000 ký tự theo quy định máy chủ.',
    };
  }
  return { valid: true, cleaned };
}

export async function submitSosCloseRetry(params: {
  incidentId: string;
  currentIncident?: IncidentResponse | null;
  inFlightIncidentIds: Set<string>;
  closeIncident: (id: string) => Promise<IncidentResponse>;
  refreshIncident: (id: string) => Promise<IncidentResponse | null>;
  clearRouteForIncident?: (incidentId: string) => void;
  clearCompletedCall?: (incidentId: string) => void;
}): Promise<SosCompletionResult> {
  const {
    incidentId,
    currentIncident,
    inFlightIncidentIds,
    closeIncident,
    refreshIncident,
    clearRouteForIncident,
    clearCompletedCall,
  } = params;

  if (inFlightIncidentIds.has(incidentId)) {
    return {
      ok: false,
      outcomeKind: 'IN_FLIGHT',
      resolveCalled: false,
      resolveSucceeded: currentIncident?.status === 'RESOLVED' || currentIncident?.status === 'CLOSED',
      closeCalled: false,
      closed: currentIncident?.status === 'CLOSED',
      incident: currentIncident || undefined,
      error: {
        kind: 'VALIDATION',
        message: 'Yêu cầu đóng sự cố trước đó đang được xử lý.',
        shouldRefreshIncident: false,
      },
    };
  }

  if (currentIncident?.status === 'CLOSED') {
    clearCompletedCall?.(incidentId);
    clearRouteForIncident?.(incidentId);
    return {
      ok: true,
      outcomeKind: 'ALREADY_CLOSED',
      resolveCalled: false,
      resolveSucceeded: true,
      closeCalled: false,
      closed: true,
      incident: currentIncident,
      routeCleared: true,
    };
  }

  inFlightIncidentIds.add(incidentId);
  try {
    const latestBeforeClose = await refreshIncident(incidentId).catch(() => null);
    const effective = latestBeforeClose || currentIncident;

    if (effective?.status === 'CLOSED') {
      clearCompletedCall?.(incidentId);
      clearRouteForIncident?.(incidentId);
      return {
        ok: true,
        outcomeKind: 'ALREADY_CLOSED',
        resolveCalled: false,
        resolveSucceeded: true,
        closeCalled: false,
        closed: true,
        incident: effective,
        routeCleared: true,
      };
    }

    if (effective?.status === 'FALSE_ALARM') {
      clearCompletedCall?.(incidentId);
      clearRouteForIncident?.(incidentId);
      return {
        ok: false,
        outcomeKind: 'FALSE_ALARM',
        resolveCalled: false,
        resolveSucceeded: false,
        closeCalled: false,
        closed: false,
        incident: effective,
        routeCleared: true,
        error: {
          kind: 'CONFLICT',
          message: 'Sự cố đã được đánh dấu báo nhầm (FALSE_ALARM).',
          shouldRefreshIncident: false,
        },
      };
    }

    if (effective?.status && effective.status !== 'RESOLVED') {
      return {
        ok: false,
        outcomeKind: 'NOT_IN_PROGRESS',
        resolveCalled: false,
        resolveSucceeded: false,
        closeCalled: false,
        closed: false,
        incident: effective,
        error: {
          kind: 'CONFLICT',
          message: `Trạng thái hiện tại trên máy chủ là ${effective.status}, không thể đóng trực tiếp.`,
          shouldRefreshIncident: false,
        },
      };
    }

    try {
      const closedIncident = await closeIncident(incidentId);
      clearCompletedCall?.(incidentId);
      clearRouteForIncident?.(incidentId);
      const isClosed = closedIncident.status === 'CLOSED';
      return {
        ok: isClosed,
        outcomeKind: isClosed ? 'CLOSED' : 'RESOLVED_ONLY',
        resolveCalled: false,
        resolveSucceeded: true,
        closeCalled: true,
        closed: isClosed,
        incident: closedIncident,
        routeCleared: true,
        ...(isClosed
          ? {}
          : {
              error: {
                kind: 'CONFLICT',
                message: `Máy chủ trả về trạng thái ${closedIncident.status} sau khi gọi đóng sự cố.`,
                shouldRefreshIncident: true,
              },
            }),
      };
    } catch (closeErr) {
      const info = classifySosDecisionError(closeErr);
      const refreshed = await refreshIncident(incidentId).catch(() => null);
      if (refreshed?.status === 'CLOSED') {
        clearCompletedCall?.(incidentId);
        clearRouteForIncident?.(incidentId);
        return {
          ok: true,
          outcomeKind: 'ALREADY_CLOSED',
          resolveCalled: false,
          resolveSucceeded: true,
          closeCalled: true,
          closed: true,
          incident: refreshed,
          routeCleared: true,
        };
      }
      const nextIncident = refreshed || effective || undefined;
      if (nextIncident?.status === 'RESOLVED') {
        clearCompletedCall?.(incidentId);
        clearRouteForIncident?.(incidentId);
      }
      return {
        ok: false,
        outcomeKind: 'RESOLVED_CLOSE_FAILED',
        resolveCalled: false,
        resolveSucceeded: nextIncident?.status === 'RESOLVED',
        closeCalled: true,
        closed: false,
        incident: nextIncident,
        routeCleared: nextIncident?.status === 'RESOLVED',
        error: info,
      };
    }
  } finally {
    inFlightIncidentIds.delete(incidentId);
  }
}

export async function submitSosCompleteDecision(params: {
  incidentId: string;
  currentIncident?: IncidentResponse | null;
  resolutionNote: string;
  inFlightIncidentIds: Set<string>;
  resolveIncident: (id: string, note: string) => Promise<IncidentResponse>;
  closeIncident: (id: string) => Promise<IncidentResponse>;
  refreshIncident: (id: string) => Promise<IncidentResponse | null>;
  clearRouteForIncident?: (incidentId: string) => void;
  clearCompletedCall?: (incidentId: string) => void;
}): Promise<SosCompletionResult> {
  const {
    incidentId,
    currentIncident,
    resolutionNote,
    inFlightIncidentIds,
    resolveIncident,
    closeIncident,
    refreshIncident,
    clearRouteForIncident,
    clearCompletedCall,
  } = params;

  if (currentIncident?.status === 'RESOLVED') {
    return submitSosCloseRetry({
      incidentId,
      currentIncident,
      inFlightIncidentIds,
      closeIncident,
      refreshIncident,
      clearRouteForIncident,
      clearCompletedCall,
    });
  }

  if (currentIncident?.status === 'CLOSED') {
    clearCompletedCall?.(incidentId);
    clearRouteForIncident?.(incidentId);
    return {
      ok: true,
      outcomeKind: 'ALREADY_CLOSED',
      resolveCalled: false,
      resolveSucceeded: true,
      closeCalled: false,
      closed: true,
      incident: currentIncident,
      routeCleared: true,
    };
  }

  const noteCheck = validateResolutionNote(resolutionNote);
  if (!noteCheck.valid) {
    return {
      ok: false,
      outcomeKind: 'VALIDATION_ERROR',
      resolveCalled: false,
      resolveSucceeded: false,
      closeCalled: false,
      closed: false,
      incident: currentIncident || undefined,
      error: {
        kind: 'VALIDATION',
        message: noteCheck.error || 'Thiếu ghi chú xử lý.',
        shouldRefreshIncident: false,
      },
    };
  }

  if (inFlightIncidentIds.has(incidentId)) {
    return {
      ok: false,
      outcomeKind: 'IN_FLIGHT',
      resolveCalled: false,
      resolveSucceeded: false,
      closeCalled: false,
      closed: false,
      incident: currentIncident || undefined,
      error: {
        kind: 'VALIDATION',
        message: 'Yêu cầu kết thúc SOS trước đó đang được gửi tới máy chủ.',
        shouldRefreshIncident: false,
      },
    };
  }

  inFlightIncidentIds.add(incidentId);
  try {
    let resolvedIncident: IncidentResponse;
    try {
      resolvedIncident = await resolveIncident(incidentId, noteCheck.cleaned);
    } catch (resolveErr) {
      const info = classifySosDecisionError(resolveErr);
      const refreshed = await refreshIncident(incidentId).catch(() => null);
      if (refreshed?.status === 'CLOSED') {
        clearCompletedCall?.(incidentId);
        clearRouteForIncident?.(incidentId);
        return {
          ok: false,
          outcomeKind: 'ALREADY_CLOSED',
          resolveCalled: true,
          resolveSucceeded: false,
          closeCalled: false,
          closed: true,
          incident: refreshed,
          routeCleared: true,
          error: {
            ...info,
            message: 'Sự cố đã được đóng (CLOSED) trên máy chủ. Dữ liệu đã được cập nhật.',
            shouldRefreshIncident: false,
          },
        };
      }
      if (refreshed?.status === 'RESOLVED') {
        clearCompletedCall?.(incidentId);
        clearRouteForIncident?.(incidentId);
        return {
          ok: false,
          outcomeKind: 'RESOLVED_CLOSE_FAILED',
          resolveCalled: true,
          resolveSucceeded: true,
          closeCalled: false,
          closed: false,
          incident: refreshed,
          routeCleared: true,
          error: {
            ...info,
            message:
              'Sự cố đã ở trạng thái Đã giải quyết (RESOLVED) nhưng chưa đóng. Bấm lại để chỉ thử bước đóng (/close).',
            shouldRefreshIncident: false,
          },
        };
      }
      if (refreshed?.status === 'FALSE_ALARM') {
        clearCompletedCall?.(incidentId);
        clearRouteForIncident?.(incidentId);
        return {
          ok: false,
          outcomeKind: 'FALSE_ALARM',
          resolveCalled: true,
          resolveSucceeded: false,
          closeCalled: false,
          closed: false,
          incident: refreshed,
          routeCleared: true,
          error: {
            ...info,
            message: 'Sự cố đã chuyển sang Báo nhầm (FALSE_ALARM).',
            shouldRefreshIncident: false,
          },
        };
      }
      return {
        ok: false,
        outcomeKind: 'ERROR',
        resolveCalled: true,
        resolveSucceeded: false,
        closeCalled: false,
        closed: false,
        incident: refreshed || currentIncident || undefined,
        error: info,
      };
    }

    // /resolve đã thành công trên BE
    clearCompletedCall?.(incidentId);
    clearRouteForIncident?.(incidentId);

    if (resolvedIncident.status === 'CLOSED') {
      return {
        ok: true,
        outcomeKind: 'CLOSED',
        resolveCalled: true,
        resolveSucceeded: true,
        closeCalled: false,
        closed: true,
        incident: resolvedIncident,
        routeCleared: true,
      };
    }

    if (resolvedIncident.status !== 'RESOLVED') {
      return {
        ok: false,
        outcomeKind: 'RESOLVED_ONLY',
        resolveCalled: true,
        resolveSucceeded: true,
        closeCalled: false,
        closed: false,
        incident: resolvedIncident,
        routeCleared: true,
        error: {
          kind: 'CONFLICT',
          message: `Máy chủ cập nhật trạng thái ${resolvedIncident.status} sau khi resolve, chưa thể tự động đóng.`,
          shouldRefreshIncident: true,
        },
      };
    }

    try {
      const closedIncident = await closeIncident(incidentId);
      const isClosed = closedIncident.status === 'CLOSED';
      return {
        ok: isClosed,
        outcomeKind: isClosed ? 'CLOSED' : 'RESOLVED_ONLY',
        resolveCalled: true,
        resolveSucceeded: true,
        closeCalled: true,
        closed: isClosed,
        incident: closedIncident,
        routeCleared: true,
        ...(isClosed
          ? {}
          : {
              error: {
                kind: 'CONFLICT',
                message: `Máy chủ vẫn trả về trạng thái ${closedIncident.status} sau khi đóng.`,
                shouldRefreshIncident: true,
              },
            }),
      };
    } catch (closeErr) {
      const closeInfo = classifySosDecisionError(closeErr);
      const refreshed = await refreshIncident(incidentId).catch(() => null);
      if (refreshed?.status === 'CLOSED') {
        return {
          ok: true,
          outcomeKind: 'CLOSED',
          resolveCalled: true,
          resolveSucceeded: true,
          closeCalled: true,
          closed: true,
          incident: refreshed,
          routeCleared: true,
        };
      }
      return {
        ok: false,
        outcomeKind: 'RESOLVED_CLOSE_FAILED',
        resolveCalled: true,
        resolveSucceeded: true,
        closeCalled: true,
        closed: false,
        incident: refreshed || resolvedIncident,
        routeCleared: true,
        error: closeInfo,
      };
    }
  } finally {
    inFlightIncidentIds.delete(incidentId);
  }
}
