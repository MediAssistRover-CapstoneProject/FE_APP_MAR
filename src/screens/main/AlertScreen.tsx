import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  AppStateStatus,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Phone,
  PhoneCall,
  ShieldAlert,
  Check,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Eye,
  AlertTriangle,
  Video,
  Navigation,
  Clock,
} from 'lucide-react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { incidentApi } from '../../api/modules/incident.api';
import { alertApi } from '../../api/modules/alert.api';
import { mediaSessionApi, MediaSessionMode } from '../../api/modules/mediaSession.api';
import { getAlertPollingPlan } from '../../api/pollingPolicy';
import { apiClient } from '../../api/client';
import { IncidentResponse, AlertResponse } from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';
import { useSosContextStore } from '../../store/useSosContextStore';
import { MainTabParamList } from '../../types/navigation';
import { SOSCallModal } from '../../components/sos/SOSCallModal';
import { SOSStreamModal } from '../../components/sos/SOSStreamModal';
import { FallDetectionModal } from '../../components/sos/FallDetectionModal';
import { MediaCallModal, MediaSessionEndPayload } from '../../components/media/MediaCallModal';
import {
  buildSosScopeKey,
  canActOnSosCompletion,
  canActOnSosDecision,
  classifyCameraMonitorOpenError,
  classifyEmergencyAlertKind,
  EmergencyAlertKind,
  extractSosConfirmationMeta,
  getMediaViewerPolicyForMode,
  isCameraViewOnlyEmergency,
  isNonVoluntaryEndReason,
  isSosButtonIncident,
  isTerminalIncidentStatus,
  needsIncidentLookupForSosClassification,
  reconcileMediaSessionEnd,
  SosCallSessionContext,
  submitSosCloseRetry,
  submitSosCompleteDecision,
  submitSosConfirmDecision,
  submitSosFalseAlarmDecision,
  validateFalseAlarmReason,
  validateResolutionNote,
} from './sosDecision';

interface ActiveCallTarget {
  robotId: string;
  robotName: string;
  mode: MediaSessionMode;
  incidentId?: string;
  alertId?: string;
  sessionId?: string;
  livekitUrl?: string;
  livekitToken?: string;
  startedAt?: string;
  externalError?: string | null;
  alertItem: AlertResponse;
}

function formatShortTime(iso?: string): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function getSosRoutingStatusLabel(status?: string): string | null {
  switch ((status || '').toUpperCase()) {
    case 'ASSIGNED':
      return 'Đã phân công trực SOS';
    case 'NO_MONITORING_ROOM':
      return 'Chưa cấu hình phòng trực SOS';
    case 'ROOM_UNAVAILABLE':
      return 'Phòng trực SOS chưa sẵn sàng';
    case 'NO_ACTIVE_SHIFT':
      return 'Chưa có ca trực hoạt động';
    case 'AMBIGUOUS_SHIFT':
      return 'Trùng nhiều ca trực hoạt động';
    default:
      return status || null;
  }
}

export const AlertScreen: React.FC = () => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const [showSOSCall, setShowSOSCall] = useState(false);
  const [showSOSStream, setShowSOSStream] = useState(false);
  const [showFallDetail, setShowFallDetail] = useState(false);

  // Trạng thái cuộc gọi mục tiêu duy nhất — tránh ghép nhầm robot, incident, session
  const [activeCall, setActiveCall] = useState<ActiveCallTarget | null>(null);
  const activeCallRef = useRef<ActiveCallTarget | null>(null);
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  const [inFlightAlertId, setInFlightAlertId] = useState<string | null>(null);
  const [isRetryingCamera, setIsRetryingCamera] = useState(false);
  const [decisionInFlightIncidentId, setDecisionInFlightIncidentId] = useState<string | null>(null);
  const [recentFocusedIncidentId, setRecentFocusedIncidentId] = useState<string | null>(null);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView> | null>(null);
  const cardYByIncidentRef = useRef<Record<string, number>>({});
  const inFlightDecisionSetRef = useRef<Set<string>>(new Set());
  const handledSessionIdsRef = useRef<Set<string>>(new Set());
  const resolvingPopupAlertIdsRef = useRef<Set<string>>(new Set());
  const [callFeedbackByIncident, setCallFeedbackByIncident] = useState<Record<string, string>>({});

  // Modal nhập lý do báo nhầm SOS
  const [falseAlarmTarget, setFalseAlarmTarget] = useState<{
    incident: IncidentResponse;
    alertItem: AlertResponse;
  } | null>(null);
  const [falseAlarmNote, setFalseAlarmNote] = useState('');
  const [falseAlarmNoteError, setFalseAlarmNoteError] = useState<string | null>(null);

  // Modal nhập resolutionNote khi Xác nhận kết thúc SOS (/resolve -> /close)
  const [completeTarget, setCompleteTarget] = useState<{
    incident: IncidentResponse;
    alertItem: AlertResponse;
  } | null>(null);
  const [completeNote, setCompleteNote] = useState('');
  const [completeNoteError, setCompleteNoteError] = useState<string | null>(null);

  const [liveIncidents, setLiveIncidents] = useState<IncidentResponse[]>([]);
  const liveIncidentsRef = useRef<IncidentResponse[]>([]);
  useEffect(() => {
    liveIncidentsRef.current = liveIncidents;
  }, [liveIncidents]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<AlertResponse[]>([]);
  const liveAlertsRef = useRef<AlertResponse[]>([]);
  useEffect(() => {
    liveAlertsRef.current = liveAlerts;
  }, [liveAlerts]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertResponse | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const isFocused = useIsFocused();
  const isPollingRef = useRef(false);
  const incidentLookupCooldownRef = useRef<Record<string, number>>({});
  const [appState, setAppState] = useState<AppStateStatus>(
    (AppState.currentState as AppStateStatus) || 'active'
  );
  const appStateRef = useRef<AppStateStatus>(appState);

  const currentUser = useAuthStore((s) => s.user);
  const currentServerUrl = apiClient.getBaseUrl();
  const currentAccountKey = currentUser?.accountId || currentUser?.username;
  const userAccountIdRef = useRef<string | undefined>(currentAccountKey);
  useEffect(() => {
    userAccountIdRef.current = currentUser?.accountId || currentUser?.username;
  }, [currentUser]);

  const completedCallsByScope = useSosContextStore((s) => s.completedCallsByScope);
  const recordCompletedCall = useSosContextStore((s) => s.recordCompletedCall);
  const clearCompletedCall = useSosContextStore((s) => s.clearCompletedCall);
  const invalidateRouteForIncident = useSosContextStore((s) => s.invalidateRouteForIncident);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      setAppState(nextAppState);
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Helper: lấy robotId từ alert/incident một cách an toàn (KHÔNG fallback sang robot khác)
  const getRobotIdFromAlert = useCallback((alertItem?: AlertResponse | null): string | undefined => {
    if (!alertItem) return undefined;
    if (alertItem.incidentId) {
      const inc =
        liveIncidentsRef.current.find((i) => i.incidentId === alertItem.incidentId) ||
        liveIncidents.find((i) => i.incidentId === alertItem.incidentId);
      if (inc?.robotId) return inc.robotId;
    }
    const data = alertItem.dataJson || {};
    if (data.robotId) return String(data.robotId);
    if (data.robot_id) return String(data.robot_id);
    return undefined;
  }, [liveIncidents]);

  const getLinkedIncidentForAlert = useCallback(
    (alertItem?: AlertResponse | null, explicitIncident?: IncidentResponse | null): IncidentResponse | undefined => {
      if (explicitIncident) return explicitIncident;
      if (!alertItem?.incidentId) return undefined;
      return (
        liveIncidents.find((i) => i.incidentId === alertItem.incidentId) ||
        liveIncidentsRef.current.find((i) => i.incidentId === alertItem.incidentId)
      );
    },
    [liveIncidents]
  );

  const getAlertKind = useCallback(
    (alertItem?: AlertResponse | null, explicitIncident?: IncidentResponse | null): EmergencyAlertKind => {
      if (!alertItem) return 'OTHER';
      const linkedInc = getLinkedIncidentForAlert(alertItem, explicitIncident);
      return classifyEmergencyAlertKind(alertItem, linkedInc);
    },
    [getLinkedIncidentForAlert]
  );

  // Helper: nhận diện riêng cảnh báo té ngã (AUTO_FALL)
  const isFallDetectionAlert = useCallback(
    (alertItem?: AlertResponse | null, incident?: IncidentResponse | null): boolean => {
      return getAlertKind(alertItem, incident) === 'AUTO_FALL';
    },
    [getAlertKind]
  );

  // Badge nhấp nháy animation cho cảnh báo khẩn cấp
  const flashAnim = useRef(new Animated.Value(1)).current;
  const hasUrgent = liveAlerts.some((a) => {
    if (a.status !== 'OPEN') return false;
    const kind = getAlertKind(a);
    return (
      a.severity === 'CRITICAL' ||
      kind === 'AUTO_FALL' ||
      kind === 'AUTO_GESTURE_SOS' ||
      kind === 'BUTTON_SOS'
    );
  });

  // Luồng CAMERA CHỈ XEM (MONITOR, không audio) cho Phát hiện té ngã & Phát hiện SOS tự động (GESTURE_SOS / AI_GESTURE_SOS)
  const openViewOnlyCameraForAlert = async (
    alertItem: AlertResponse,
    opts?: { isRetry?: boolean }
  ) => {
    const isRetry = Boolean(opts?.isRetry);
    if (!isRetry && inFlightAlertId) return;
    if (isRetry) {
      setIsRetryingCamera(true);
    } else {
      setInFlightAlertId(alertItem.alertId);
    }
    setSelectedAlert(alertItem);

    try {
      const incidentId = alertItem.incidentId || undefined;
      let currentIncident: IncidentResponse | undefined = incidentId
        ? getLinkedIncidentForAlert(alertItem)
        : undefined;

      if (incidentId) {
        try {
          const fresh = await incidentApi.getIncidentDetail(incidentId);
          if (fresh) {
            currentIncident = fresh;
            upsertIncident(fresh);
          }
        } catch (detailErr) {
          console.log('Error fetching incident detail for camera view:', detailErr);
        }
      }

      if (currentIncident && isTerminalIncidentStatus(currentIncident.status)) {
        if (isRetry) setActiveCall(null);
        Alert.alert(
          'Sự cố đã kết thúc',
          `Sự cố này đã ở trạng thái ${currentIncident.status}. Không cần mở camera xem lại.`
        );
        return;
      }

      // Kiểm tra phân loại lần cuối sau khi có incident mới nhất: nếu thực sự là nút bấm SOS -> giữ luồng ASSIST 2 chiều
      const verifiedKind = classifyEmergencyAlertKind(alertItem, currentIncident);
      if (verifiedKind === 'BUTTON_SOS') {
        if (!isRetry) setInFlightAlertId(null);
        await handleAcceptSosCall(alertItem);
        return;
      }

      const targetRobotId = currentIncident?.robotId || getRobotIdFromAlert(alertItem);
      if (!targetRobotId) {
        const noRobotErr = 'Không tìm thấy Robot gắn với cảnh báo này. Vui lòng kiểm tra lại sự cố.';
        if (isRetry) {
          setActiveCall((prev) => (prev ? { ...prev, externalError: noRobotErr } : prev));
        } else {
          Alert.alert('Không thể xác định Robot', noRobotErr);
        }
        return;
      }

      const robotDisplayName =
        alertItem.dataJson?.robot_code ||
        alertItem.dataJson?.robot ||
        `Robot ${targetRobotId.slice(0, 8)}`;

      // Ghi nhận tiếp nhận OPEN -> ACKNOWLEDGED (tuyệt đối KHÔNG tự gọi startIncident hay confirm)
      if (alertItem.status === 'OPEN') {
        await alertApi.acknowledgeAlert(alertItem.alertId).catch((err) => {
          console.log('Error acknowledging alert on view camera:', err);
        });
      }
      if (incidentId && (!currentIncident || currentIncident.status === 'OPEN')) {
        await incidentApi.acknowledgeIncident(incidentId).catch(() => null);
      }

      // Dùng phiên MONITOR hiện có của đúng Staff + robotId + incidentId (nếu còn mở), KHÔNG accept phiên ASSIST tự sinh
      const sessions = await mediaSessionApi.getSessions().catch(() => []);
      const actorAccountId = currentUser?.accountId;
      let targetSession = (sessions || []).find(
        (s) =>
          s.robotId === targetRobotId &&
          s.mode === 'MONITOR' &&
          (!incidentId || s.incidentId === incidentId) &&
          (!actorAccountId || !s.staffAccountId || s.staffAccountId === actorAccountId) &&
          (s.state === 'RINGING' ||
            s.state === 'CONNECTING' ||
            s.state === 'ACTIVE' ||
            s.state === 'RECONNECTING')
      );

      if (!targetSession) {
        try {
          targetSession = await mediaSessionApi.createSession({
            robotId: targetRobotId,
            incidentId,
            mode: 'MONITOR',
          });
        } catch (createErr: any) {
          const friendlyError = classifyCameraMonitorOpenError(createErr, sessions, targetRobotId);
          if (incidentId) {
            setCallFeedbackByIncident((prev) => ({
              ...prev,
              [incidentId]: friendlyError,
            }));
          }
          setActiveCall({
            robotId: targetRobotId,
            robotName: robotDisplayName,
            mode: 'MONITOR',
            incidentId,
            alertId: alertItem.alertId,
            startedAt: new Date().toISOString(),
            externalError: friendlyError,
            alertItem,
          });
          return;
        }
      }

      if (!targetSession?.sessionId) {
        const missingSessErr = 'Không thể khởi tạo phiên xem camera MONITOR hợp lệ.';
        setActiveCall({
          robotId: targetRobotId,
          robotName: robotDisplayName,
          mode: 'MONITOR',
          incidentId,
          alertId: alertItem.alertId,
          startedAt: new Date().toISOString(),
          externalError: missingSessErr,
          alertItem,
        });
        return;
      }

      let livekitUrl: string | undefined;
      let livekitToken: string | undefined;
      try {
        const joinRes = await mediaSessionApi.getJoinToken(targetSession.sessionId);
        livekitUrl = joinRes?.url;
        livekitToken = joinRes?.token;
      } catch (tokenErr: any) {
        const tokenErrMsg =
          classifyCameraMonitorOpenError(tokenErr, sessions, targetRobotId) ||
          'Máy chủ chưa cấp được vé LiveKit để xem camera robot.';
        setActiveCall({
          robotId: targetRobotId,
          robotName: robotDisplayName,
          mode: 'MONITOR',
          incidentId,
          alertId: alertItem.alertId,
          sessionId: targetSession.sessionId,
          startedAt: new Date().toISOString(),
          externalError: tokenErrMsg,
          alertItem,
        });
        return;
      }

      if (!livekitUrl || !livekitToken) {
        setActiveCall({
          robotId: targetRobotId,
          robotName: robotDisplayName,
          mode: 'MONITOR',
          incidentId,
          alertId: alertItem.alertId,
          sessionId: targetSession.sessionId,
          startedAt: new Date().toISOString(),
          externalError: 'Camera robot chưa sẵn sàng (thiếu URL hoặc vé kết nối LiveKit). Bấm Thử lại để kết nối lại.',
          alertItem,
        });
        return;
      }

      setActiveCall({
        robotId: targetRobotId,
        robotName: robotDisplayName,
        mode: 'MONITOR',
        incidentId,
        alertId: alertItem.alertId,
        sessionId: targetSession.sessionId,
        livekitUrl,
        livekitToken,
        startedAt: new Date().toISOString(),
        externalError: null,
        alertItem,
      });

      if (incidentId) {
        setCallFeedbackByIncident((prev) => {
          if (!(incidentId in prev)) return prev;
          const next = { ...prev };
          delete next[incidentId];
          return next;
        });
      }
    } catch (err: any) {
      console.log('Error in openViewOnlyCameraForAlert:', err);
      const fallbackMsg = err?.message || 'Không thể mở camera robot.';
      const targetRobotId = getRobotIdFromAlert(alertItem) || '';
      if (targetRobotId) {
        setActiveCall({
          robotId: targetRobotId,
          robotName: `Robot ${targetRobotId.slice(0, 8)}`,
          mode: 'MONITOR',
          incidentId: alertItem.incidentId || undefined,
          alertId: alertItem.alertId,
          startedAt: new Date().toISOString(),
          externalError: fallbackMsg,
          alertItem,
        });
      } else {
        Alert.alert('Lỗi', fallbackMsg);
      }
    } finally {
      if (isRetry) {
        setIsRetryingCamera(false);
      } else {
        setInFlightAlertId(null);
      }
      void fetchAlerts();
      void fetchIncidents();
    }
  };

  // Tiếp nhận SOS bấm nút: Mở phiên ASSIST, lấy LiveKit join token và hiển thị đàm thoại 2 chiều
  const handleAcceptSosCall = async (alertItem: AlertResponse) => {
    if (inFlightAlertId) return; // Chặn bấm kép
    setInFlightAlertId(alertItem.alertId);
    setSelectedAlert(alertItem);

    try {
      const incidentId = alertItem.incidentId || undefined;
      let targetRobotId: string | undefined = getRobotIdFromAlert(alertItem);
      let currentIncident: IncidentResponse | undefined = incidentId
        ? liveIncidents.find((i) => i.incidentId === incidentId)
        : undefined;

      // Nếu chưa có targetRobotId hoặc cần kiểm tra trạng thái incident mới nhất, gọi API incident detail
      if (incidentId && (!targetRobotId || !currentIncident)) {
        try {
          currentIncident = await incidentApi.getIncidentDetail(incidentId);
          if (currentIncident?.robotId) {
            targetRobotId = currentIncident.robotId;
          }
        } catch (detailErr) {
          console.log('Error fetching incident detail for SOS call:', detailErr);
        }
      }

      // Bảo vệ: Nếu phát hiện thực tế là cảnh báo AI té ngã hoặc SOS tự động (GESTURE_SOS), chuyển sang luồng MONITOR chỉ xem
      if (isCameraViewOnlyEmergency(alertItem, currentIncident)) {
        setInFlightAlertId(null);
        await openViewOnlyCameraForAlert(alertItem);
        return;
      }

      // Kiểm tra trạng thái sự cố có hợp lệ để mở cuộc gọi không
      if (currentIncident) {
        const isTerminal =
          currentIncident.status === 'RESOLVED' ||
          currentIncident.status === 'CLOSED' ||
          currentIncident.status === 'FALSE_ALARM';
        if (isTerminal) {
          Alert.alert(
            'Sự cố đã kết thúc',
            `Sự cố này đã ở trạng thái ${currentIncident.status}. Không thể mở cuộc gọi hỗ trợ.`
          );
          return;
        }
      }

      if (!targetRobotId) {
        Alert.alert(
          'Không thể xác định Robot',
          'Không tìm thấy Robot gắn với cảnh báo SOS này. Vui lòng kiểm tra lại sự cố hoặc danh sách thiết bị.'
        );
        return;
      }

      // Acknowledge alert & incident trên BE nếu đang OPEN (tuyệt đối KHÔNG tự gọi startIncident).
      if (alertItem.status === 'OPEN') {
        await alertApi.acknowledgeAlert(alertItem.alertId).catch((err) => {
          console.log('Error acknowledging alert on accept:', err);
        });
      }
      if (incidentId && (!currentIncident || currentIncident.status === 'OPEN')) {
        await incidentApi.acknowledgeIncident(incidentId).catch(() => null);
      }

      // Tìm phiên ASSIST khớp cả robotId và incidentId
      const sessions = await mediaSessionApi.getSessions().catch(() => []);
      let targetSession = (sessions || []).find(
        (s) =>
          s.robotId === targetRobotId &&
          s.mode === 'ASSIST' &&
          (!incidentId || s.incidentId === incidentId) &&
          (s.state === 'RINGING' ||
            s.state === 'CONNECTING' ||
            s.state === 'ACTIVE' ||
            s.state === 'RECONNECTING')
      );

      // Nếu đã có phiên RINGING -> accept
      if (targetSession) {
        if (targetSession.state === 'RINGING') {
          try {
            targetSession = await mediaSessionApi.acceptSession(targetSession.sessionId);
          } catch (accErr) {
            console.log('Error accepting existing session:', accErr);
          }
        }
      } else {
        // Chưa có phiên -> Tạo phiên mới với mode 'ASSIST'
        try {
          targetSession = await mediaSessionApi.createSession({
            robotId: targetRobotId,
            incidentId,
            mode: 'ASSIST',
          });
          if (targetSession && targetSession.state === 'RINGING') {
            targetSession = await mediaSessionApi.acceptSession(targetSession.sessionId);
          }
        } catch (createErr: any) {
          console.log('Error creating media session:', createErr);
          Alert.alert(
            'Không thể mở phiên đàm thoại',
            createErr?.message || 'Robot chưa sẵn sàng nhận cuộc gọi hoặc thiếu quyền.'
          );
          return;
        }
      }

      if (!targetSession?.sessionId) {
        Alert.alert('Lỗi phiên', 'Không thể khởi tạo hoặc tìm thấy phiên đàm thoại hợp lệ.');
        return;
      }

      // Lấy LiveKit join token trực tiếp từ BE (giữ Staff JWT ngoài WebView)
      let livekitUrl: string | undefined = undefined;
      let livekitToken: string | undefined = undefined;
      try {
        const joinRes = await mediaSessionApi.getJoinToken(targetSession.sessionId);
        if (joinRes && joinRes.token) {
          livekitUrl = joinRes.url;
          livekitToken = joinRes.token;
        }
      } catch (tokenErr) {
        console.log('Error fetching LiveKit join token:', tokenErr);
      }

      if (!livekitToken || !livekitUrl) {
        Alert.alert(
          'Đã tiếp nhận sự cố',
          'Sự cố đã được ghi nhận tiếp nhận thành công trên hệ thống. Tuy nhiên kênh đàm thoại LiveKit chưa thể kết nối (máy chủ chưa cấp vé). Bạn có thể bấm "Vào lại đàm thoại" để thử lại.'
        );
        return;
      }

      const robotDisplayName =
        alertItem.dataJson?.robot_code ||
        alertItem.dataJson?.robot ||
        `Robot ${targetRobotId.slice(0, 8)}`;

      setActiveCall({
        robotId: targetRobotId,
        robotName: robotDisplayName,
        mode: 'ASSIST',
        incidentId,
        alertId: alertItem.alertId,
        sessionId: targetSession.sessionId,
        livekitUrl,
        livekitToken,
        startedAt: new Date().toISOString(),
        externalError: null,
        alertItem,
      });
      if (incidentId) {
        setCallFeedbackByIncident((prev) => {
          if (!(incidentId in prev)) return prev;
          const next = { ...prev };
          delete next[incidentId];
          return next;
        });
      }
    } catch (err: any) {
      console.log('Error in handleAcceptSosCall:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể mở cuộc gọi và camera tới robot.');
    } finally {
      setInFlightAlertId(null);
      fetchAlerts();
      fetchIncidents();
    }
  };

  const upsertIncident = useCallback((updated: IncidentResponse) => {
    setLiveIncidents((prev) => {
      const idx = prev.findIndex((i) => i.incidentId === updated.incidentId);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  }, []);

  const refreshSingleIncident = useCallback(async (incidentId: string): Promise<IncidentResponse | null> => {
    try {
      const prevStatus = liveIncidentsRef.current.find((i) => i.incidentId === incidentId)?.status;
      const detail = await incidentApi.getIncidentDetail(incidentId);
      if (detail) {
        upsertIncident(detail);
        const srv = apiClient.getBaseUrl();
        const acct = userAccountIdRef.current;
        if (detail.status === 'FALSE_ALARM' || detail.status === 'RESOLVED' || detail.status === 'CLOSED') {
          clearCompletedCall(detail.incidentId, srv, acct);
          if (prevStatus !== detail.status || detail.status === 'FALSE_ALARM') {
            invalidateRouteForIncident(detail.incidentId, srv, acct);
          }
        }
        return detail;
      }
      return null;
    } catch {
      return null;
    }
  }, [upsertIncident, clearCompletedCall, invalidateRouteForIncident]);

  const fetchIncidents = useCallback(
    async (forAccountId?: string, size = 30) => {
      setIsLoadingIncidents(true);
      try {
        const page = await incidentApi.getIncidents({ page: 0, size });
        const result = page?.content || [];
        if (forAccountId && userAccountIdRef.current !== forAccountId) return;
        const prevById = new Map(liveIncidentsRef.current.map((i) => [i.incidentId, i]));
        setLiveIncidents(result);
        const acct = forAccountId ?? userAccountIdRef.current;
        const srv = apiClient.getBaseUrl();
        for (const inc of result) {
          const prevStatus = prevById.get(inc.incidentId)?.status;
          if (inc.status === 'FALSE_ALARM') {
            if (prevStatus && prevStatus !== 'FALSE_ALARM') {
              invalidateRouteForIncident(inc.incidentId, srv, acct);
            }
            clearCompletedCall(inc.incidentId, srv, acct);
          } else if (inc.status === 'RESOLVED' || inc.status === 'CLOSED') {
            if (prevStatus && prevStatus !== inc.status) {
              invalidateRouteForIncident(inc.incidentId, srv, acct);
            }
            clearCompletedCall(inc.incidentId, srv, acct);
          }
        }
      } catch (err) {
        console.log('Error fetching live incidents:', err);
      } finally {
        setIsLoadingIncidents(false);
      }
    },
    [clearCompletedCall, invalidateRouteForIncident]
  );

  const fetchAlerts = useCallback(async (forAccountId?: string, size = 30) => {
    setIsLoadingAlerts(true);
    try {
      const page = await alertApi.getAlerts({ page: 0, size });
      const result = page?.content || [];
      if (forAccountId && userAccountIdRef.current !== forAccountId) return;
      setLiveAlerts(result);
    } catch (err) {
      console.log('Error fetching live alerts:', err);
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  const lastAlertIdRef = useRef<string | null>(null);
  const lastSessionIdRef = useRef<string | null>(null);

  const fetchMediaSessions = useCallback(async (forAccountId?: string) => {
    try {
      const sessions = await mediaSessionApi.getSessions();
      if (forAccountId && userAccountIdRef.current !== forAccountId) return;
      const srv = apiClient.getBaseUrl();
      const acct = forAccountId ?? userAccountIdRef.current;

      // Phục hồi ngữ cảnh phiên đã kết thúc thực sự trên BE cho SOS bấm nút (ASSIST) hoặc cảnh báo AI (MONITOR)
      for (const s of sessions || []) {
        if (s.state === 'ENDED' && s.incidentId && !isNonVoluntaryEndReason(s.endReason)) {
          const inc = liveIncidentsRef.current.find((i) => i.incidentId === s.incidentId);
          const matchedAlert = liveAlertsRef.current.find((a) => a.incidentId === s.incidentId);
          const kind = classifyEmergencyAlertKind(matchedAlert, inc);
          const expectedMode = kind === 'BUTTON_SOS' ? 'ASSIST' : 'MONITOR';
          if (
            inc &&
            s.mode === expectedMode &&
            (expectedMode === 'ASSIST' || !acct || !s.staffAccountId || s.staffAccountId === acct) &&
            !isTerminalIncidentStatus(inc.status) &&
            inc.status !== 'IN_PROGRESS' &&
            (!inc.robotId || !s.robotId || inc.robotId === s.robotId)
          ) {
            const key = buildSosScopeKey({ serverUrl: srv, accountId: acct, incidentId: inc.incidentId });
            const existingCompleted = useSosContextStore.getState().completedCallsByScope[key];
            if (!existingCompleted) {
              recordCompletedCall(
                {
                  incidentId: inc.incidentId,
                  robotId: s.robotId || inc.robotId || '',
                  sessionId: s.sessionId,
                  mode: s.mode,
                  accountId: acct,
                  serverUrl: srv,
                  endReason: s.endReason ?? undefined,
                  backendState: s.state,
                  endedAt: s.endedAt || new Date().toISOString(),
                },
                srv,
                acct
              );
            }
          }
        }
      }

      const ringing = sessions.find((s) => s.state === 'RINGING' && s.mode === 'ASSIST');
      if (ringing && ringing.sessionId !== lastSessionIdRef.current) {
        // Khớp chặt chẽ cả incidentId và robotId theo yêu cầu S1/F1 (không khớp bừa chỉ theo robotId)
        const matchingAlert = liveAlertsRef.current.find((a) => {
          if (!ringing.incidentId || a.incidentId !== ringing.incidentId) return false;
          const robotId = getRobotIdFromAlert(a);
          return !robotId || robotId === ringing.robotId;
        });
        if (matchingAlert) {
          const matchingInc = matchingAlert.incidentId
            ? liveIncidentsRef.current.find((i) => i.incidentId === matchingAlert.incidentId)
            : undefined;
          if (needsIncidentLookupForSosClassification(matchingAlert, matchingInc)) {
            void refreshSingleIncident(matchingAlert.incidentId!);
          } else {
            lastSessionIdRef.current = ringing.sessionId;
            setSelectedAlert(matchingAlert);
            const kind = classifyEmergencyAlertKind(matchingAlert, matchingInc);
            if (kind === 'AUTO_FALL' || kind === 'AUTO_GESTURE_SOS') {
              // Cảnh báo AI té ngã / GESTURE_SOS không bao giờ tự mở đàm thoại 2 chiều ASSIST
              setShowFallDetail(true);
            } else if (kind === 'BUTTON_SOS') {
              setShowSOSCall(true);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }, [getRobotIdFromAlert, recordCompletedCall, refreshSingleIncident]);

  const alertPollingPlan = getAlertPollingPlan({ isFocused, appState });

  const pollAll = useCallback(async () => {
    if (alertPollingPlan.mode === 'PAUSED' || appStateRef.current !== 'active') return;
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    const accountAtStart = userAccountIdRef.current;
    try {
      if (alertPollingPlan.mode === 'FOCUSED_LIST') {
        await Promise.all([
          fetchIncidents(accountAtStart, alertPollingPlan.pageSize),
          fetchAlerts(accountAtStart, alertPollingPlan.pageSize),
          fetchMediaSessions(accountAtStart),
        ]);
      } else {
        // Watchdog nhẹ khi đang ở tab khác: chỉ lấy alert OPEN mới nhất + media sessions
        const [openPage] = await Promise.all([
          alertApi.getAlerts({ status: 'OPEN', page: 0, size: alertPollingPlan.pageSize }),
          fetchMediaSessions(accountAtStart),
        ]);
        if (accountAtStart && userAccountIdRef.current !== accountAtStart) return;
        const openAlerts = openPage?.content || [];
        if (openAlerts.length > 0) {
          setLiveAlerts((prev) => {
            const byId = new Map<string, AlertResponse>();
            for (const a of openAlerts) byId.set(a.alertId, a);
            for (const old of prev) {
              if (!byId.has(old.alertId)) byId.set(old.alertId, old);
            }
            return Array.from(byId.values()).slice(0, 50);
          });
          // Chỉ lấy thêm incidents khi thực sự có alert OPEN chưa có incident trong cache
          const hasMissingIncident = openAlerts.some(
            (a) =>
              a.incidentId &&
              !liveIncidentsRef.current.some((inc) => inc.incidentId === a.incidentId)
          );
          if (hasMissingIncident) {
            await fetchIncidents(accountAtStart, 20);
          }
        }
      }
    } catch (err) {
      console.log('Poll tick error:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [alertPollingPlan.mode, alertPollingPlan.pageSize, fetchIncidents, fetchAlerts, fetchMediaSessions]);

  useEffect(() => {
    if (alertPollingPlan.mode === 'PAUSED') return;
    void pollAll();
    const timer = setInterval(() => {
      void pollAll();
    }, alertPollingPlan.intervalMs);
    return () => clearInterval(timer);
  }, [alertPollingPlan.mode, alertPollingPlan.intervalMs, pollAll]);

  // Tự động mở màn hình cảnh báo nếu có sự cố SOS, Té ngã hoặc SOS tự động mới phát sinh
  useEffect(() => {
    const openUrgent = liveAlerts.find((a) => {
      if (a.status !== 'OPEN') return false;
      const kind = getAlertKind(a);
      return (
        a.severity === 'CRITICAL' ||
        kind === 'AUTO_FALL' ||
        kind === 'AUTO_GESTURE_SOS' ||
        kind === 'BUTTON_SOS'
      );
    });
    if (!openUrgent || openUrgent.alertId === lastAlertIdRef.current) return;

    const linkedInc = getLinkedIncidentForAlert(openUrgent);
    if (needsIncidentLookupForSosClassification(openUrgent, linkedInc)) {
      const targetIncidentId = openUrgent.incidentId;
      const now = Date.now();
      const lastLookupAt = targetIncidentId
        ? incidentLookupCooldownRef.current[targetIncidentId] || 0
        : 0;
      if (
        targetIncidentId &&
        now - lastLookupAt >= 5000 &&
        !resolvingPopupAlertIdsRef.current.has(openUrgent.alertId)
      ) {
        incidentLookupCooldownRef.current[targetIncidentId] = now;
        resolvingPopupAlertIdsRef.current.add(openUrgent.alertId);
        void refreshSingleIncident(targetIncidentId).finally(() => {
          resolvingPopupAlertIdsRef.current.delete(openUrgent.alertId);
        });
      }
      return;
    }

    lastAlertIdRef.current = openUrgent.alertId;
    setSelectedAlert(openUrgent);
    const kind = classifyEmergencyAlertKind(openUrgent, linkedInc);
    if (kind === 'AUTO_FALL' || kind === 'AUTO_GESTURE_SOS') {
      setShowFallDetail(true);
    } else if (kind === 'BUTTON_SOS') {
      setShowSOSCall(true);
    }
  }, [liveAlerts, getAlertKind, getLinkedIncidentForAlert, refreshSingleIncident]);

  const handleResolveAlert = async (alertItem: AlertResponse) => {
    const alertId = alertItem.alertId;
    setResolvingAlertId(alertId);
    try {
      if (alertItem.incidentId) {
        await incidentApi
          .resolveIncident(
            alertItem.incidentId,
            'Đã kiểm tra và xử lý hoàn tất sự cố tại hiện trường'
          )
          .catch(() => null);
      }
      await alertApi.resolveAlert(alertId);
      Alert.alert('Thành công', 'Đã đánh dấu giải quyết cảnh báo.');
      await fetchAlerts();
      await fetchIncidents();
    } catch (err: any) {
      console.log('Error resolving alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể cập nhật trạng thái cảnh báo');
    } finally {
      setResolvingAlertId(null);
    }
  };

  const handleAcknowledgeAlert = async (alertItem: AlertResponse) => {
    setSelectedAlert(alertItem);
    try {
      let linkedInc = getLinkedIncidentForAlert(alertItem);
      if (alertItem.incidentId && !linkedInc) {
        linkedInc = (await refreshSingleIncident(alertItem.incidentId)) || undefined;
      }
      const kind = classifyEmergencyAlertKind(alertItem, linkedInc);
      await alertApi.acknowledgeAlert(alertItem.alertId);
      if (alertItem.incidentId) {
        await incidentApi.acknowledgeIncident(alertItem.incidentId).catch(() => null);
      }
      await fetchAlerts();
      await fetchIncidents();
      if (kind === 'AUTO_FALL' || kind === 'AUTO_GESTURE_SOS') {
        await openViewOnlyCameraForAlert(alertItem);
      } else {
        await handleAcceptSosCall(alertItem);
      }
    } catch (err: any) {
      console.log('Error acknowledging alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể tiếp nhận cảnh báo');
    }
  };

  const handleMediaCallSessionEnd = useCallback(
    async (payload?: MediaSessionEndPayload) => {
      const targetCall = activeCallRef.current;
      const srv = apiClient.getBaseUrl();
      const acct = userAccountIdRef.current;
      const activeContext: SosCallSessionContext | null = targetCall?.incidentId
        ? {
            incidentId: targetCall.incidentId,
            robotId: targetCall.robotId,
            sessionId: payload?.sessionId || targetCall.sessionId || '',
            alertId: targetCall.alertId,
            mode: targetCall.mode,
            accountId: acct,
            serverUrl: srv,
            startedAt: targetCall.startedAt,
          }
        : null;

      setActiveCall(null);

      if (activeContext) {
        const outcome = await reconcileMediaSessionEnd({
          event: {
            source: payload?.source || 'WEBVIEW_STATUS',
            sessionId: payload?.sessionId || activeContext.sessionId,
            incidentId: payload?.incidentId || activeContext.incidentId,
            robotId: payload?.robotId || activeContext.robotId,
            uiStatus: payload?.uiStatus || 'ENDED',
            endReason: payload?.endReason,
            error: payload?.error,
            backendSession: payload?.backendSession,
          },
          activeContext,
          handledSessionIds: handledSessionIdsRef.current,
          fetchSession: (id) => mediaSessionApi.getSession(id),
        });

        if (outcome.kind === 'SESSION_ENDED') {
          if (!outcome.duplicate) {
            recordCompletedCall(outcome.record, srv, acct);
            setCallFeedbackByIncident((prev) => {
              if (!(outcome.record.incidentId in prev)) return prev;
              const next = { ...prev };
              delete next[outcome.record.incidentId];
              return next;
            });
          }
          setRecentFocusedIncidentId(outcome.record.incidentId);
          const targetY = cardYByIncidentRef.current[outcome.record.incidentId];
          if (typeof targetY === 'number') {
            setTimeout(() => {
              scrollViewRef.current?.scrollTo({ y: Math.max(0, targetY - 12), animated: true });
            }, 120);
          }
          await refreshSingleIncident(outcome.record.incidentId);
        } else if (
          outcome.kind === 'DISMISS_ONLY' ||
          outcome.kind === 'CONNECTION_ERROR' ||
          outcome.kind === 'EXPIRED' ||
          outcome.kind === 'FAILED'
        ) {
          setRecentFocusedIncidentId(activeContext.incidentId);
          setCallFeedbackByIncident((prev) => ({
            ...prev,
            [activeContext.incidentId]: outcome.message,
          }));
        }
      }

      fetchAlerts();
      fetchIncidents();
    },
    [recordCompletedCall, refreshSingleIncident, fetchAlerts, fetchIncidents]
  );

  const handleConfirmRealSos = useCallback(
    async (incident: IncidentResponse) => {
      const incidentId = incident.incidentId;
      const perm = canActOnSosDecision(incident, currentUser);
      if (!perm.allowed) {
        Alert.alert('Không có quyền thao tác', perm.reason || 'Bạn không được phân công xử lý SOS này.');
        await refreshSingleIncident(incidentId);
        return;
      }

      setDecisionInFlightIncidentId(incidentId);
      const res = await submitSosConfirmDecision({
        incidentId,
        inFlightIncidentIds: inFlightDecisionSetRef.current,
        confirmIncident: (id) => incidentApi.confirmIncident(id),
        refreshIncident: refreshSingleIncident,
      });
      setDecisionInFlightIncidentId((cur) => (cur === incidentId ? null : cur));

      if (res.ok && res.incident) {
        upsertIncident(res.incident);
        await Promise.all([fetchIncidents(), fetchAlerts()]);
        Alert.alert(
          'Đã xác nhận SOS thật',
          'Sự cố đã chuyển sang Đang xử lý (IN_PROGRESS). Bạn có thể bấm "Xem đường đến SOS" để mở bản đồ tuyến đi bộ.'
        );
      } else {
        await Promise.all([fetchIncidents(), fetchAlerts()]);
        Alert.alert(
          'Không thể xác nhận SOS',
          res.error?.message || 'Đã làm mới trạng thái sự cố từ máy chủ. Vui lòng thử lại.'
        );
      }
    },
    [currentUser, refreshSingleIncident, upsertIncident, fetchIncidents, fetchAlerts]
  );

  const handleOpenFalseAlarmModal = useCallback(
    (incident: IncidentResponse, alertItem: AlertResponse) => {
      const perm = canActOnSosDecision(incident, currentUser);
      if (!perm.allowed) {
        Alert.alert('Không có quyền thao tác', perm.reason || 'Bạn không được phân công xử lý SOS này.');
        refreshSingleIncident(incident.incidentId);
        return;
      }
      setFalseAlarmNote('');
      setFalseAlarmNoteError(null);
      setFalseAlarmTarget({ incident, alertItem });
    },
    [currentUser, refreshSingleIncident]
  );

  const handleSubmitFalseAlarm = useCallback(async () => {
    if (!falseAlarmTarget) return;
    const { incident } = falseAlarmTarget;
    const incidentId = incident.incidentId;

    const noteCheck = validateFalseAlarmReason(falseAlarmNote);
    if (!noteCheck.valid) {
      setFalseAlarmNoteError(noteCheck.error || 'Vui lòng nhập lý do báo nhầm.');
      return;
    }

    setFalseAlarmNoteError(null);
    setDecisionInFlightIncidentId(incidentId);

    const res = await submitSosFalseAlarmDecision({
      incidentId,
      resolutionNote: noteCheck.cleaned,
      inFlightIncidentIds: inFlightDecisionSetRef.current,
      markFalseAlarm: (id, note) => incidentApi.markFalseAlarm(id, note),
      refreshIncident: refreshSingleIncident,
      clearRouteForIncident: (id) =>
        invalidateRouteForIncident(id, apiClient.getBaseUrl(), userAccountIdRef.current),
    });

    setDecisionInFlightIncidentId((cur) => (cur === incidentId ? null : cur));

    if (res.ok && res.incident) {
      upsertIncident(res.incident);
      clearCompletedCall(incidentId, apiClient.getBaseUrl(), userAccountIdRef.current);
      setFalseAlarmTarget(null);
      setFalseAlarmNote('');
      await Promise.all([fetchIncidents(), fetchAlerts()]);
      Alert.alert('Đã báo nhầm SOS', 'Sự cố đã chuyển sang Báo nhầm (FALSE_ALARM) và xóa tuyến đường (nếu có).');
    } else {
      await Promise.all([fetchIncidents(), fetchAlerts()]);
      setFalseAlarmNoteError(
        res.error?.message || 'Không thể gửi báo nhầm. Đã làm mới trạng thái sự cố từ máy chủ.'
      );
    }
  }, [
    falseAlarmTarget,
    falseAlarmNote,
    refreshSingleIncident,
    invalidateRouteForIncident,
    upsertIncident,
    clearCompletedCall,
    fetchIncidents,
    fetchAlerts,
  ]);

  const handleOpenSosRouteOnMap = useCallback(
    (incidentId: string) => {
      // Chỉ mở tab Bản đồ đúng sự cố, tuyệt đối không điều phối robot
      navigation.navigate('Home', {
        focusSosIncidentId: incidentId,
        sosRequestNonce: Date.now(),
      });
    },
    [navigation]
  );

  const handleRetryCloseSos = useCallback(
    async (incident: IncidentResponse) => {
      const incidentId = incident.incidentId;
      const perm = canActOnSosCompletion(incident, currentUser);
      if (!perm.allowed && !perm.isAlreadyClosed) {
        Alert.alert('Không có quyền thao tác', perm.reason || 'Bạn không có quyền đóng sự cố này.');
        await refreshSingleIncident(incidentId);
        return;
      }

      setDecisionInFlightIncidentId(incidentId);
      const res = await submitSosCloseRetry({
        incidentId,
        currentIncident: incident,
        inFlightIncidentIds: inFlightDecisionSetRef.current,
        closeIncident: (id) => incidentApi.closeIncident(id),
        refreshIncident: refreshSingleIncident,
        clearRouteForIncident: (id) =>
          invalidateRouteForIncident(id, apiClient.getBaseUrl(), userAccountIdRef.current),
        clearCompletedCall: (id) =>
          clearCompletedCall(id, apiClient.getBaseUrl(), userAccountIdRef.current),
      });
      setDecisionInFlightIncidentId((cur) => (cur === incidentId ? null : cur));

      if (res.incident) {
        upsertIncident(res.incident);
      }
      await Promise.all([fetchIncidents(), fetchAlerts()]);

      if (res.ok && res.closed) {
        setCallFeedbackByIncident((prev) => {
          if (!(incidentId in prev)) return prev;
          const next = { ...prev };
          delete next[incidentId];
          return next;
        });
        Alert.alert(
          res.outcomeKind === 'ALREADY_CLOSED' ? 'Sự cố đã đóng trước đó' : 'Đã hoàn tất kết thúc SOS',
          'Sự cố đã chuyển sang trạng thái Đã đóng (CLOSED) và cập nhật tuyến SOS.'
        );
      } else {
        const msg =
          res.error?.message ||
          'Chưa thể đóng sự cố trên máy chủ. Dữ liệu đã được làm mới, vui lòng thử lại.';
        setCallFeedbackByIncident((prev) => ({
          ...prev,
          [incidentId]: msg,
        }));
        Alert.alert('Chưa đóng được sự cố', msg);
      }
    },
    [
      currentUser,
      refreshSingleIncident,
      invalidateRouteForIncident,
      clearCompletedCall,
      upsertIncident,
      fetchIncidents,
      fetchAlerts,
    ]
  );

  const handleOpenCompleteSosModal = useCallback(
    (incident: IncidentResponse, alertItem: AlertResponse) => {
      const perm = canActOnSosCompletion(incident, currentUser);
      if (perm.isAlreadyClosed) {
        Alert.alert('Sự cố đã đóng', 'Sự cố này đã ở trạng thái Đã đóng (CLOSED).');
        void refreshSingleIncident(incident.incidentId);
        return;
      }
      if (perm.stage === 'RETRY_CLOSE_ONLY' && perm.allowed) {
        void handleRetryCloseSos(incident);
        return;
      }
      if (!perm.allowed) {
        Alert.alert(
          'Không thể kết thúc SOS',
          perm.reason || 'Tài khoản hoặc trạng thái hiện tại không hợp lệ để kết thúc SOS.'
        );
        void refreshSingleIncident(incident.incidentId);
        return;
      }
      const cameraOnly = isCameraViewOnlyEmergency(alertItem, incident);
      setCompleteNote(
        cameraOnly
          ? 'Đã kiểm tra hiện trường và hoàn tất hỗ trợ sự cố cảnh báo từ robot'
          : 'Đã hỗ trợ bệnh nhân qua SOS và hoàn tất xử lý tại hiện trường'
      );
      setCompleteNoteError(null);
      setCompleteTarget({ incident, alertItem });
    },
    [currentUser, refreshSingleIncident, handleRetryCloseSos]
  );

  const handleSubmitCompleteSos = useCallback(async () => {
    if (!completeTarget) return;
    const { incident } = completeTarget;
    const incidentId = incident.incidentId;

    const noteCheck = validateResolutionNote(completeNote);
    if (!noteCheck.valid) {
      setCompleteNoteError(noteCheck.error || 'Vui lòng nhập ghi chú xử lý.');
      return;
    }

    setCompleteNoteError(null);
    setDecisionInFlightIncidentId(incidentId);

    const res = await submitSosCompleteDecision({
      incidentId,
      currentIncident: incident,
      resolutionNote: noteCheck.cleaned,
      inFlightIncidentIds: inFlightDecisionSetRef.current,
      resolveIncident: (id, note) => incidentApi.resolveIncident(id, note),
      closeIncident: (id) => incidentApi.closeIncident(id),
      refreshIncident: refreshSingleIncident,
      clearRouteForIncident: (id) =>
        invalidateRouteForIncident(id, apiClient.getBaseUrl(), userAccountIdRef.current),
      clearCompletedCall: (id) =>
        clearCompletedCall(id, apiClient.getBaseUrl(), userAccountIdRef.current),
    });

    setDecisionInFlightIncidentId((cur) => (cur === incidentId ? null : cur));

    if (res.incident) {
      upsertIncident(res.incident);
    }
    await Promise.all([fetchIncidents(), fetchAlerts()]);

    if (res.ok && res.closed) {
      setCompleteTarget(null);
      setCompleteNote('');
      setCallFeedbackByIncident((prev) => {
        if (!(incidentId in prev)) return prev;
        const next = { ...prev };
        delete next[incidentId];
        return next;
      });
      Alert.alert(
        res.outcomeKind === 'ALREADY_CLOSED' ? 'Sự cố đã đóng trước đó' : 'Đã kết thúc SOS hoàn tất',
        'Sự cố đã chuyển sang Đã đóng (CLOSED) và cập nhật danh sách cảnh báo, tuyến SOS.'
      );
      return;
    }

    if (res.outcomeKind === 'ALREADY_CLOSED') {
      setCompleteTarget(null);
      setCompleteNote('');
      Alert.alert(
        'Sự cố đã đóng trước đó',
        res.error?.message || 'Sự cố này đã ở trạng thái CLOSED trên máy chủ.'
      );
      return;
    }

    if (res.outcomeKind === 'RESOLVED_CLOSE_FAILED' || res.outcomeKind === 'RESOLVED_ONLY') {
      setCompleteTarget(null);
      setCompleteNote('');
      const msg =
        res.error?.message ||
        'Đã ghi nhận Đã giải quyết (RESOLVED), nhưng bước đóng hoàn tất (CLOSED) gặp lỗi. Vui lòng bấm lại để chỉ thử bước đóng.';
      setCallFeedbackByIncident((prev) => ({
        ...prev,
        [incidentId]: `Đã resolve (RESOLVED), lỗi khi đóng: ${msg}`,
      }));
      Alert.alert('Đã giải quyết, chờ đóng sự cố', msg);
      return;
    }

    if (res.outcomeKind === 'FALSE_ALARM') {
      setCompleteTarget(null);
      setCompleteNote('');
      Alert.alert('Sự cố đã báo nhầm', res.error?.message || 'Sự cố đã chuyển sang FALSE_ALARM.');
      return;
    }

    setCompleteNoteError(
      res.error?.message || 'Không thể xác nhận kết thúc SOS. Trạng thái sự cố đã được làm mới.'
    );
  }, [
    completeTarget,
    completeNote,
    refreshSingleIncident,
    invalidateRouteForIncident,
    clearCompletedCall,
    upsertIncident,
    fetchIncidents,
    fetchAlerts,
  ]);

  const handleCloseAlert = async (alertItem: AlertResponse) => {
    try {
      if (alertItem.incidentId) {
        await incidentApi.closeIncident(alertItem.incidentId).catch(() => null);
      }
      await alertApi.closeAlert(alertItem.alertId);
      Alert.alert('Thành công', 'Đã đóng hoàn tất cảnh báo.');
      await fetchAlerts();
      await fetchIncidents();
    } catch (err: any) {
      console.log('Error closing alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể đóng cảnh báo');
    }
  };

  const activeAlertCount = React.useMemo(() => {
    const unacknowledgedAlerts = liveAlerts.filter((a) => a.status === 'OPEN').length;
    const unacknowledgedIncidents = liveIncidents.filter((i) => i.status === 'OPEN').length;
    return Math.max(unacknowledgedAlerts, unacknowledgedIncidents);
  }, [liveAlerts, liveIncidents]);

  const getAlertTitle = (alertItem?: AlertResponse | null, incident?: IncidentResponse | null) => {
    const kind = getAlertKind(alertItem, incident);
    if (kind === 'AUTO_FALL') {
      return 'Cảnh báo AI: Nghi người bị té ngã';
    }
    if (kind === 'AUTO_GESTURE_SOS') {
      return 'Cảnh báo AI: Phát hiện tín hiệu SOS tự động';
    }
    if (kind === 'BUTTON_SOS') {
      return 'Tín hiệu SOS từ Robot';
    }
    const type = (incident?.incidentType || alertItem?.notificationType || '').toUpperCase();
    if (type.includes('SEIZURE')) {
      return 'Cảnh báo AI: Nghi chuyển động co giật';
    }
    return alertItem?.notificationType || 'Cảnh báo khẩn cấp';
  };

  const getAlertLocation = (alertItem?: AlertResponse | null) => {
    if (!alertItem) return 'Khu vực bệnh viện';
    const data = alertItem.dataJson || {};
    if (data.map_name) return data.map_name;
    if (data.location) return data.location;
    if (data.room) return data.room;
    if (alertItem.zoneId) return `Zone ${alertItem.zoneId.substring(0, 8)}`;
    return 'Vị trí Robot';
  };

  const getAlertRobot = (alertItem?: AlertResponse | null) => {
    if (!alertItem) return 'Chưa xác định';
    const data = alertItem.dataJson || {};
    return (
      data.robot_code ||
      data.robot ||
      (data.robotId ? String(data.robotId).slice(0, 8) : null) ||
      (data.robot_id ? String(data.robot_id).slice(0, 8) : null) ||
      (alertItem.incidentId
        ? liveIncidents.find((i) => i.incidentId === alertItem.incidentId)?.robotId?.slice(0, 8)
        : null) ||
      'ROBOT_MAR'
    );
  };

  return (
    <View style={styles.container}>
      <StaffHeader />

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>HỆ THỐNG · TRUNG TÂM CẢNH BÁO</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Cảnh báo khẩn cấp</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isLoadingAlerts || isLoadingIncidents ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    fetchIncidents();
                    fetchAlerts();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RefreshCw size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
              <Animated.View style={[styles.activeAlertBadge, { opacity: hasUrgent ? flashAnim : 1 }]}>
                <View style={styles.alertDot} />
                <Text style={styles.activeAlertText}>{activeAlertCount} ĐANG XẢY RA</Text>
              </Animated.View>
            </View>
          </View>
        </View>

        {liveAlerts.length > 0 ? (
          liveAlerts.map((alertItem) => {
            const linkedIncident = alertItem.incidentId
              ? liveIncidents.find((i) => i.incidentId === alertItem.incidentId)
              : undefined;
            const alertKind = classifyEmergencyAlertKind(alertItem, linkedIncident);
            const isFall = alertKind === 'AUTO_FALL';
            const isAutoGestureSos = alertKind === 'AUTO_GESTURE_SOS';
            const isCameraViewOnly = isFall || isAutoGestureSos;
            const isSosCard = alertKind === 'BUTTON_SOS';
            const usesPostViewDecisionFlow = isSosCard || isCameraViewOnly;
            const incidentStatus = linkedIncident?.status;
            const isFalseAlarm = incidentStatus === 'FALSE_ALARM';
            const isClosed = incidentStatus === 'CLOSED' || (!incidentStatus && alertItem.status === 'CLOSED');
            const isResolvedPendingClose =
              !isClosed &&
              !isFalseAlarm &&
              (incidentStatus === 'RESOLVED' || (!incidentStatus && alertItem.status === 'RESOLVED'));
            const isFinalClosedOrFalseAlarm = isClosed || isFalseAlarm;
            const isConfirmedInProgress = incidentStatus === 'IN_PROGRESS';
            const isAcknowledged =
              !isFinalClosedOrFalseAlarm &&
              !isResolvedPendingClose &&
              (alertItem.status === 'ACKNOWLEDGED' || incidentStatus === 'ACKNOWLEDGED');
            const isOpen =
              !isFinalClosedOrFalseAlarm && !isResolvedPendingClose && alertItem.status === 'OPEN';
            const isCritical = alertItem.severity === 'CRITICAL' || isFall || isAutoGestureSos;
            const isResolvingThis = resolvingAlertId === alertItem.alertId;
            const data = alertItem.dataJson || {};
            const metrics = data.metrics || {};

            const sosScopeKey = alertItem.incidentId
              ? buildSosScopeKey({
                  serverUrl: currentServerUrl,
                  accountId: currentAccountKey,
                  incidentId: alertItem.incidentId,
                })
              : null;
            const completedCall = sosScopeKey ? completedCallsByScope[sosScopeKey] : undefined;
            const callFeedback = alertItem.incidentId
              ? callFeedbackByIncident[alertItem.incidentId]
              : undefined;
            const sosPermission = linkedIncident
              ? canActOnSosDecision(linkedIncident, currentUser)
              : null;
            const sosCompletionPerm = linkedIncident
              ? canActOnSosCompletion(linkedIncident, currentUser)
              : null;
            const confirmMeta = extractSosConfirmationMeta(linkedIncident);
            const isSubmittingDecision =
              Boolean(alertItem.incidentId) && decisionInFlightIncidentId === alertItem.incidentId;
            const routingLabel = getSosRoutingStatusLabel(linkedIncident?.sosRoutingStatus);
            const assignedToMe =
              Boolean(linkedIncident?.sosResponderAccountId) &&
              Boolean(currentUser?.accountId) &&
              linkedIncident?.sosResponderAccountId === currentUser?.accountId;

            return (
              <View
                key={alertItem.alertId}
                onLayout={(ev) => {
                  if (alertItem.incidentId) {
                    cardYByIncidentRef.current[alertItem.incidentId] = ev.nativeEvent.layout.y;
                  }
                }}
                style={[
                  isCritical && isOpen ? styles.cardAlertRed : styles.cardNormal,
                  Boolean(alertItem.incidentId) &&
                    recentFocusedIncidentId === alertItem.incidentId && {
                      borderColor: '#0284C7',
                      borderWidth: 2,
                    },
                  (isResolvedPendingClose || isFinalClosedOrFalseAlarm) && { opacity: 0.92 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={isCritical ? styles.cardIconBoxRed : styles.cardIconBoxOrange}>
                    <Text style={{ fontSize: 16 }}>
                      {isFall ? '🚨' : isAutoGestureSos ? '✋' : isCritical ? '🆘' : '⚠️'}
                    </Text>
                  </View>
                  <View style={styles.cardTitleBox}>
                    <Text style={styles.cardTitle}>{getAlertTitle(alertItem, linkedIncident)}</Text>
                    {isCameraViewOnly && data.algorithm ? (
                      <Text style={styles.fallSubBadge}>
                        AI: {data.algorithm}
                        {typeof data.confidence === 'number'
                          ? ` · ${(data.confidence * 100).toFixed(1)}%`
                          : ''}
                        {metrics.detection_mode ? ` · ${metrics.detection_mode}` : ''}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={
                      isFalseAlarm
                        ? styles.statusTagGray
                        : isOpen
                        ? styles.statusTagRed
                        : isConfirmedInProgress || isAcknowledged
                        ? styles.statusTagBlue
                        : isResolvedPendingClose
                        ? styles.statusTagGreen
                        : styles.statusTagGray
                    }
                  >
                    <Text style={[styles.statusTagText, isFalseAlarm && { color: Colors.textSecondary }]}>
                      {isFalseAlarm
                        ? 'Báo nhầm'
                        : isOpen
                        ? 'Đang xảy ra'
                        : isConfirmedInProgress
                        ? isCameraViewOnly
                          ? 'Đang xử lý (Sự cố thật)'
                          : 'Đang xử lý (SOS thật)'
                        : isAcknowledged
                        ? 'Đã tiếp nhận'
                        : isResolvedPendingClose
                        ? 'Đã giải quyết'
                        : 'Đã đóng'}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaRow}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>BẢN ĐỒ / KHU VỰC</Text>
                    <Text style={styles.metaVal} numberOfLines={1}>
                      {getAlertLocation(alertItem)}
                    </Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>ROBOT</Text>
                    <Text style={styles.metaVal}>{getAlertRobot(alertItem)}</Text>
                  </View>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>GIỜ</Text>
                    <Text style={styles.metaVal}>
                      {alertItem.createdAt
                        ? new Date(alertItem.createdAt).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Vừa xong'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.cardDesc}>
                  {alertItem.message || 'Cảnh báo từ hệ thống Robot. Cần nhân viên y tế xác minh.'}
                </Text>

                {usesPostViewDecisionFlow && (linkedIncident?.sosResponderAccountId || routingLabel) ? (
                  <View style={styles.sosAssignRow}>
                    <Text style={styles.sosAssignText} numberOfLines={2}>
                      {linkedIncident?.sosResponderAccountId
                        ? `Phân công: ${assignedToMe ? 'Bạn (Staff phụ trách SOS)' : linkedIncident.sosResponderAccountId}`
                        : 'Chưa gắn tài khoản phân công'}
                      {routingLabel ? ` · ${routingLabel}` : ''}
                    </Text>
                  </View>
                ) : null}

                {isCameraViewOnly && metrics.reason ? (
                  <View style={styles.sampleAlertBanner}>
                    <Text style={styles.sampleAlertText}>
                      Lý do AI: {metrics.reason}
                      {metrics.visible_legs !== undefined
                        ? ` · Chân thấy: ${metrics.visible_legs}`
                        : ''}
                      {metrics.support_ratio !== undefined
                        ? ` · Support: ${metrics.support_ratio}`
                        : ''}
                    </Text>
                  </View>
                ) : null}

                {/* CÁC CẢNH BÁO KHÁC NGOÀI SOS BẤM NÚT / TÉ NGÃ / GESTURE_SOS */}
                {!usesPostViewDecisionFlow && isOpen && (
                  <TouchableOpacity
                    style={styles.sosEmergencyCallBtn}
                    onPress={() => handleAcknowledgeAlert(alertItem)}
                    activeOpacity={0.8}
                    disabled={inFlightAlertId === alertItem.alertId}
                  >
                    {inFlightAlertId === alertItem.alertId ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.sosEmergencyCallBtnText}>Tiếp nhận cảnh báo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {!usesPostViewDecisionFlow && isAcknowledged && (
                  <TouchableOpacity
                    style={styles.outlineResolveBtn}
                    onPress={() => handleResolveAlert(alertItem)}
                    activeOpacity={0.8}
                    disabled={isResolvingThis}
                  >
                    {isResolvingThis ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Check size={14} color={Colors.primary} />
                        <Text style={styles.outlineResolveBtnText}>Đánh dấu đã giải quyết ✓</Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}

                {/* LUỒNG THỐNG NHẤT:
                    - BUTTON_SOS: Đàm thoại ASSIST -> Kết thúc cuộc gọi -> Xác nhận SOS thật / Báo nhầm -> Bản đồ -> Xác nhận kết thúc SOS (/resolve -> /close)
                    - AUTO_FALL & AUTO_GESTURE_SOS: Xem camera robot (MONITOR, không audio) -> Kết thúc xem -> Xác nhận sự cố / Báo nhầm -> Bản đồ -> Xác nhận kết thúc SOS (/resolve -> /close) */}
                {usesPostViewDecisionFlow && (
                  <View style={{ gap: 8 }}>
                    {isFinalClosedOrFalseAlarm ? (
                      <View style={styles.sosTerminalBox}>
                        <Text style={styles.sosTerminalTitle}>
                          {isFalseAlarm
                            ? 'Trạng thái: Báo nhầm (FALSE_ALARM)'
                            : 'Trạng thái: Đã đóng hoàn tất (CLOSED)'}
                        </Text>
                        {linkedIncident?.resolutionNote ? (
                          <Text style={styles.sosTerminalNote}>
                            Ghi chú: {linkedIncident.resolutionNote}
                          </Text>
                        ) : null}
                      </View>
                    ) : isResolvedPendingClose && linkedIncident ? (
                      <>
                        <View style={styles.sosConfirmedBox}>
                          <View style={styles.sosConfirmedHeader}>
                            <CheckCircle2 size={16} color="#059669" />
                            <Text style={styles.sosConfirmedTitle}>
                              Đã giải quyết (RESOLVED) · Chờ đóng hoàn tất (CLOSED)
                            </Text>
                          </View>
                          {linkedIncident.resolutionNote ? (
                            <Text style={styles.sosConfirmedMeta}>
                              Ghi chú: {linkedIncident.resolutionNote}
                            </Text>
                          ) : null}
                        </View>

                        {callFeedback ? (
                          <View style={styles.sosNoticeBanner}>
                            <Clock size={14} color="#B45309" />
                            <Text style={styles.sosNoticeText}>{callFeedback}</Text>
                          </View>
                        ) : null}

                        {sosCompletionPerm?.allowed ? (
                          <TouchableOpacity
                            style={[
                              styles.blueBtn,
                              { flex: 0, height: 48, width: '100%' },
                              isSubmittingDecision && { opacity: 0.6 },
                            ]}
                            onPress={() => void handleRetryCloseSos(linkedIncident)}
                            activeOpacity={0.85}
                            disabled={isSubmittingDecision}
                          >
                            {isSubmittingDecision ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <CheckCircle2 size={16} color="#FFFFFF" />
                                <Text style={styles.blueBtnText}>
                                  Xác nhận kết thúc SOS (Thử lại đóng)
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.sosPermissionHint}>
                            {sosCompletionPerm?.reason ||
                              'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền đóng sự cố.'}
                          </Text>
                        )}
                      </>
                    ) : isConfirmedInProgress && linkedIncident ? (
                      <>
                        <View style={styles.sosConfirmedBox}>
                          <View style={styles.sosConfirmedHeader}>
                            <CheckCircle2 size={16} color="#059669" />
                            <Text style={styles.sosConfirmedTitle}>
                              {isCameraViewOnly
                                ? 'Đã xác nhận sự cố · IN_PROGRESS'
                                : 'Đã xác nhận SOS thật · IN_PROGRESS'}
                            </Text>
                          </View>
                          {confirmMeta.confirmedByAccountId ? (
                            <Text style={styles.sosConfirmedMeta}>
                              Người xác nhận: {confirmMeta.confirmedByAccountId}
                              {confirmMeta.confirmedAt
                                ? ` · ${formatShortTime(confirmMeta.confirmedAt) || ''}`
                                : ''}
                            </Text>
                          ) : confirmMeta.acknowledgedByAccountId ? (
                            <Text style={styles.sosConfirmedMeta}>
                              Người tiếp nhận: {confirmMeta.acknowledgedByAccountId}
                              {confirmMeta.acknowledgedAt
                                ? ` · ${formatShortTime(confirmMeta.acknowledgedAt) || ''}`
                                : ''}
                            </Text>
                          ) : null}
                        </View>

                        <TouchableOpacity
                          style={styles.viewRouteBtn}
                          onPress={() => handleOpenSosRouteOnMap(linkedIncident.incidentId)}
                          activeOpacity={0.85}
                        >
                          <Navigation size={17} color="#FFFFFF" />
                          <Text style={styles.viewRouteBtnText}>Xem đường đến SOS</Text>
                        </TouchableOpacity>

                        {callFeedback ? (
                          <View style={styles.sosNoticeBanner}>
                            <Clock size={14} color="#B45309" />
                            <Text style={styles.sosNoticeText}>{callFeedback}</Text>
                          </View>
                        ) : null}

                        <View style={styles.btnRow}>
                          {sosCompletionPerm?.allowed ? (
                            <TouchableOpacity
                              style={[
                                styles.blueBtn,
                                { flex: 1.15 },
                                isSubmittingDecision && { opacity: 0.6 },
                              ]}
                              onPress={() => handleOpenCompleteSosModal(linkedIncident, alertItem)}
                              activeOpacity={0.85}
                              disabled={isSubmittingDecision}
                            >
                              {isSubmittingDecision ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <CheckCircle2 size={15} color="#FFFFFF" />
                                  <Text style={styles.blueBtnText}>Xác nhận kết thúc SOS</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          ) : null}

                          <TouchableOpacity
                            style={[styles.tealBtn, { flex: 0.9 }]}
                            onPress={() =>
                              isCameraViewOnly
                                ? void openViewOnlyCameraForAlert(alertItem)
                                : void handleAcceptSosCall(alertItem)
                            }
                            activeOpacity={0.8}
                            disabled={inFlightAlertId === alertItem.alertId}
                          >
                            <Video size={15} color={Colors.textPrimary} />
                            <Text style={styles.tealBtnText}>
                              {isCameraViewOnly ? 'Xem lại camera robot' : 'Vào lại đàm thoại'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {!sosCompletionPerm?.allowed ? (
                          <Text style={styles.sosPermissionHint}>
                            {sosCompletionPerm?.reason ||
                              'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền kết thúc SOS.'}
                          </Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        {isCameraViewOnly ? (
                          <View style={styles.btnRow}>
                            {!completedCall && (
                              <TouchableOpacity
                                style={[styles.cameraCheckBtn, { flex: 1.4 }]}
                                onPress={() => void openViewOnlyCameraForAlert(alertItem)}
                                activeOpacity={0.8}
                                disabled={inFlightAlertId === alertItem.alertId}
                              >
                                {inFlightAlertId === alertItem.alertId ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <>
                                    <Eye size={16} color="#FFFFFF" />
                                    <Text style={styles.cameraCheckBtnText}>Xem camera robot</Text>
                                  </>
                                )}
                              </TouchableOpacity>
                            )}

                            <TouchableOpacity
                              style={[styles.tealBtn, { flex: 0.85 }]}
                              onPress={() => {
                                setSelectedAlert(alertItem);
                                setShowFallDetail(true);
                              }}
                              activeOpacity={0.8}
                            >
                              <AlertTriangle size={15} color={Colors.tealDark} />
                              <Text style={styles.tealBtnText}>Chi tiết AI</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          isOpen &&
                          !completedCall && (
                            <TouchableOpacity
                              style={styles.sosEmergencyCallBtn}
                              onPress={() => handleAcceptSosCall(alertItem)}
                              activeOpacity={0.8}
                              disabled={inFlightAlertId === alertItem.alertId}
                            >
                              {inFlightAlertId === alertItem.alertId ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <>
                                  <PhoneCall size={18} color="#FFFFFF" strokeWidth={2.5} />
                                  <Text style={styles.sosEmergencyCallBtnText}>
                                    Nhận SOS · Camera và đàm thoại
                                  </Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )
                        )}

                        {callFeedback ? (
                          <View style={styles.sosNoticeBanner}>
                            <Clock size={14} color="#B45309" />
                            <Text style={styles.sosNoticeText}>{callFeedback}</Text>
                          </View>
                        ) : null}

                        {completedCall && linkedIncident ? (
                          <View style={styles.sosDecisionBox}>
                            <Text style={styles.sosDecisionHeader}>
                              {isCameraViewOnly
                                ? `Đã kết thúc xem camera robot (Phiên ${completedCall.sessionId.slice(0, 8)})`
                                : `Cuộc gọi ASSIST đã kết thúc (Phiên ${completedCall.sessionId.slice(0, 8)})`}
                            </Text>
                            {sosPermission?.allowed ? (
                              <View style={styles.btnRow}>
                                <TouchableOpacity
                                  style={[
                                    styles.confirmSosBtn,
                                    isSubmittingDecision && { opacity: 0.6 },
                                  ]}
                                  onPress={() => handleConfirmRealSos(linkedIncident)}
                                  disabled={isSubmittingDecision}
                                  activeOpacity={0.85}
                                >
                                  {isSubmittingDecision ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                  ) : (
                                    <>
                                      <CheckCircle2 size={16} color="#FFFFFF" />
                                      <Text style={styles.confirmSosBtnText}>
                                        {isCameraViewOnly ? 'Xác nhận sự cố' : 'Xác nhận SOS thật'}
                                      </Text>
                                    </>
                                  )}
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.falseAlarmBtn,
                                    isSubmittingDecision && { opacity: 0.6 },
                                  ]}
                                  onPress={() => handleOpenFalseAlarmModal(linkedIncident, alertItem)}
                                  disabled={isSubmittingDecision}
                                  activeOpacity={0.85}
                                >
                                  <XCircle size={16} color="#B91C1C" />
                                  <Text style={styles.falseAlarmBtnText}>Báo nhầm</Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <Text style={styles.sosPermissionHint}>
                                {sosPermission?.reason ||
                                  'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có thể xác nhận.'}
                              </Text>
                            )}
                          </View>
                        ) : (
                          (isCameraViewOnly || !isOpen) && (
                            <View style={styles.sosNoticeBanner}>
                              <Clock size={14} color="#0369A1" />
                              <Text style={[styles.sosNoticeText, { color: '#0369A1' }]}>
                                {isCameraViewOnly
                                  ? 'Bấm "Xem camera robot" (chỉ hình ảnh, không âm thanh), sau đó bấm "Kết thúc xem" để mở Xác nhận sự cố / Báo nhầm.'
                                  : 'Kết thúc phiên đàm thoại ASSIST để hiển thị lựa chọn Xác nhận SOS thật / Báo nhầm.'}
                              </Text>
                            </View>
                          )
                        )}

                        {(completedCall || (!isCameraViewOnly && !isOpen)) && (
                          <TouchableOpacity
                            style={styles.tealBtn}
                            onPress={() =>
                              isCameraViewOnly
                                ? void openViewOnlyCameraForAlert(alertItem)
                                : void handleAcceptSosCall(alertItem)
                            }
                            activeOpacity={0.8}
                            disabled={inFlightAlertId === alertItem.alertId}
                          >
                            {inFlightAlertId === alertItem.alertId ? (
                              <ActivityIndicator size="small" color={Colors.primary} />
                            ) : (
                              <>
                                <Video size={15} color={Colors.textPrimary} />
                                <Text style={styles.tealBtnText}>
                                  {isCameraViewOnly ? 'Xem lại camera robot' : 'Vào lại đàm thoại'}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}

                {!usesPostViewDecisionFlow && !alertItem.incidentId && alertItem.status === 'RESOLVED' && (
                  <TouchableOpacity
                    style={[styles.outlineResolveBtn, styles.outlineResolveBtnDone, { marginTop: 8 }]}
                    onPress={() => handleCloseAlert(alertItem)}
                    activeOpacity={0.8}
                  >
                    <Check size={14} color="#059669" />
                    <Text style={[styles.outlineResolveBtnText, { color: '#059669' }]}>
                      Đóng cảnh báo hoàn tất ✓
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <ShieldAlert size={36} color="#10B981" />
            </View>
            <Text style={styles.emptyTitle}>Khu vực an toàn</Text>
            <Text style={styles.emptySubtitle}>
              Hiện không có cảnh báo khẩn cấp hoặc sự cố té ngã nào. Hệ thống sẵn sàng tiếp nhận khi có tín hiệu từ robot.
            </Text>
            <TouchableOpacity
              style={styles.emptyRefreshBtn}
              onPress={() => {
                fetchIncidents();
                fetchAlerts();
              }}
              activeOpacity={0.8}
            >
              <RefreshCw size={14} color={Colors.primary} />
              <Text style={styles.emptyRefreshText}>Cập nhật lại</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <SOSCallModal
        visible={showSOSCall}
        alertId={selectedAlert?.alertId}
        robotName={selectedAlert ? `Robot ${getAlertRobot(selectedAlert)}` : 'Robot'}
        location={getAlertLocation(selectedAlert)}
        timestamp={
          selectedAlert?.createdAt
            ? new Date(selectedAlert.createdAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : undefined
        }
        onAccept={() => {
          setShowSOSCall(false);
          if (selectedAlert) {
            if (isCameraViewOnlyEmergency(selectedAlert, getLinkedIncidentForAlert(selectedAlert))) {
              void openViewOnlyCameraForAlert(selectedAlert);
            } else {
              void handleAcceptSosCall(selectedAlert);
            }
          }
        }}
        onDecline={() => {
          setShowSOSCall(false);
        }}
      />

      <SOSStreamModal
        visible={showSOSStream}
        alertId={selectedAlert?.alertId}
        incidentId={selectedAlert?.incidentId || undefined}
        robotId={
          selectedAlert
            ? getLinkedIncidentForAlert(selectedAlert)?.robotId ||
              getRobotIdFromAlert(selectedAlert) ||
              undefined
            : undefined
        }
        robotName={selectedAlert ? `Robot ${getAlertRobot(selectedAlert)}` : 'Robot'}
        location={getAlertLocation(selectedAlert)}
        onClose={() => {
          setShowSOSStream(false);
          fetchAlerts();
        }}
        onResolve={() => {
          fetchAlerts();
          fetchIncidents();
        }}
        onDispatch={() => {
          setShowSOSStream(false);
          setShowFallDetail(true);
        }}
      />

      {(() => {
        const selectedIncident = selectedAlert ? getLinkedIncidentForAlert(selectedAlert) : undefined;
        const selectedScopeKey = selectedAlert?.incidentId
          ? buildSosScopeKey({
              serverUrl: currentServerUrl,
              accountId: currentAccountKey,
              incidentId: selectedAlert.incidentId,
            })
          : null;
        const selectedCompletedView = selectedScopeKey ? completedCallsByScope[selectedScopeKey] : undefined;
        const selectedPerm = selectedIncident
          ? canActOnSosDecision(selectedIncident, currentUser)
          : null;
        const selectedCompletionPerm = selectedIncident
          ? canActOnSosCompletion(selectedIncident, currentUser)
          : null;
        return (
          <FallDetectionModal
            visible={showFallDetail}
            onClose={() => setShowFallDetail(false)}
            onStartCameraView={() => {
              setShowFallDetail(false);
              if (selectedAlert) {
                void openViewOnlyCameraForAlert(selectedAlert);
              }
            }}
            alertItem={selectedAlert}
            incident={selectedIncident}
            incidentId={selectedAlert?.incidentId || undefined}
            alertKind={selectedAlert ? getAlertKind(selectedAlert, selectedIncident) : undefined}
            completedCameraView={selectedCompletedView}
            decisionPermission={selectedPerm}
            completionPermission={selectedCompletionPerm}
            isSubmittingDecision={
              Boolean(selectedIncident) && decisionInFlightIncidentId === selectedIncident?.incidentId
            }
            onConfirmIncident={() => {
              if (selectedIncident) {
                void handleConfirmRealSos(selectedIncident);
              }
            }}
            onRequestFalseAlarm={() => {
              if (selectedIncident && selectedAlert) {
                handleOpenFalseAlarmModal(selectedIncident, selectedAlert);
              }
            }}
            onRequestCompleteSos={() => {
              if (selectedIncident && selectedAlert) {
                handleOpenCompleteSosModal(selectedIncident, selectedAlert);
              }
            }}
            onRetryCloseSos={() => {
              if (selectedIncident) {
                void handleRetryCloseSos(selectedIncident);
              }
            }}
            onOpenMapRoute={() => {
              if (selectedIncident) {
                handleOpenSosRouteOnMap(selectedIncident.incidentId);
              }
            }}
            location={getAlertLocation(selectedAlert)}
            robotName={selectedAlert ? `Robot ${getAlertRobot(selectedAlert)}` : 'Robot'}
            onAcknowledge={() => {
              fetchAlerts();
              fetchIncidents();
            }}
          />
        );
      })()}

      <MediaCallModal
        visible={activeCall !== null}
        onClose={() => {
          setActiveCall(null);
          fetchAlerts();
          fetchIncidents();
        }}
        robotId={activeCall?.robotId}
        robotName={activeCall?.robotName}
        mode={activeCall?.mode || 'MONITOR'}
        incidentId={activeCall?.incidentId}
        existingSessionId={activeCall?.sessionId}
        livekitUrl={activeCall?.livekitUrl}
        livekitToken={activeCall?.livekitToken}
        externalError={activeCall?.externalError}
        isRetrying={isRetryingCamera}
        endButtonLabel={getMediaViewerPolicyForMode(activeCall?.mode).endActionLabel}
        onRetryCamera={() => {
          const current = activeCallRef.current;
          if (!current?.alertItem) return;
          if (current.mode === 'ASSIST') {
            setActiveCall(null);
            void handleAcceptSosCall(current.alertItem);
          } else {
            return openViewOnlyCameraForAlert(current.alertItem, { isRetry: true });
          }
        }}
        onSessionEnd={handleMediaCallSessionEnd}
      />

      <Modal
        visible={falseAlarmTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!decisionInFlightIncidentId) setFalseAlarmTarget(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.falseAlarmBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.falseAlarmSheet}>
            {(() => {
              const targetIsCameraOnly = falseAlarmTarget
                ? isCameraViewOnlyEmergency(falseAlarmTarget.alertItem, falseAlarmTarget.incident)
                : false;
              return (
                <>
                  <Text style={styles.falseAlarmModalTitle}>
                    {targetIsCameraOnly ? 'Báo nhầm cảnh báo sự cố' : 'Báo nhầm tín hiệu SOS'}
                  </Text>
                  <Text style={styles.falseAlarmModalSub}>
                    {targetIsCameraOnly
                      ? 'Nhập lý do xác minh sau khi xem camera robot để chuyển sự cố sang FALSE_ALARM và xóa tuyến đường (nếu có).'
                      : 'Nhập lý do xác minh sau cuộc gọi để chuyển sự cố sang FALSE_ALARM và xóa tuyến đường (nếu có).'}
                  </Text>
                </>
              );
            })()}

            <TextInput
              style={styles.falseAlarmInput}
              placeholder={
                falseAlarmTarget &&
                isCameraViewOnlyEmergency(falseAlarmTarget.alertItem, falseAlarmTarget.incident)
                  ? 'Ví dụ: Đã xem camera robot, không có người té ngã hoặc tín hiệu cầu cứu thật'
                  : 'Ví dụ: Bệnh nhân vô tình chạm nhầm nút SOS, đã nói chuyện xác nhận bình thường'
              }
              placeholderTextColor="#94A3B8"
              value={falseAlarmNote}
              onChangeText={(txt) => {
                setFalseAlarmNote(txt);
                if (falseAlarmNoteError) setFalseAlarmNoteError(null);
              }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={
                !falseAlarmTarget ||
                decisionInFlightIncidentId !== falseAlarmTarget.incident.incidentId
              }
            />

            {falseAlarmNoteError ? (
              <Text style={styles.falseAlarmErrorText}>{falseAlarmNoteError}</Text>
            ) : null}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.tealBtn, { flex: 1 }]}
                onPress={() => setFalseAlarmTarget(null)}
                disabled={
                  Boolean(falseAlarmTarget) &&
                  decisionInFlightIncidentId === falseAlarmTarget?.incident.incidentId
                }
              >
                <Text style={styles.tealBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.falseAlarmSubmitBtn,
                  Boolean(falseAlarmTarget) &&
                    decisionInFlightIncidentId === falseAlarmTarget?.incident.incidentId && {
                      opacity: 0.6,
                    },
                ]}
                onPress={handleSubmitFalseAlarm}
                disabled={
                  Boolean(falseAlarmTarget) &&
                  decisionInFlightIncidentId === falseAlarmTarget?.incident.incidentId
                }
              >
                {Boolean(falseAlarmTarget) &&
                decisionInFlightIncidentId === falseAlarmTarget?.incident.incidentId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.falseAlarmSubmitBtnText}>Gửi báo nhầm</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={completeTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!decisionInFlightIncidentId) setCompleteTarget(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.falseAlarmBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.falseAlarmSheet}>
            {(() => {
              const targetIsCameraOnly = completeTarget
                ? isCameraViewOnlyEmergency(completeTarget.alertItem, completeTarget.incident)
                : false;
              return (
                <>
                  <Text style={styles.falseAlarmModalTitle}>
                    Xác nhận kết thúc SOS
                  </Text>
                  <Text style={styles.falseAlarmModalSub}>
                    {targetIsCameraOnly
                      ? 'Nhập ghi chú xử lý (resolutionNote) để ghi nhận Đã giải quyết (/resolve) và Đóng hoàn tất (/close) sự cố từ camera AI.'
                      : 'Nhập ghi chú xử lý (resolutionNote) để ghi nhận Đã giải quyết (/resolve) và Đóng hoàn tất (/close) sự cố SOS.'}
                  </Text>
                </>
              );
            })()}

            <TextInput
              style={styles.falseAlarmInput}
              placeholder="Ví dụ: Đã tới hiện trường hỗ trợ bệnh nhân an toàn, kết thúc sự cố"
              placeholderTextColor="#94A3B8"
              value={completeNote}
              onChangeText={(txt) => {
                setCompleteNote(txt);
                if (completeNoteError) setCompleteNoteError(null);
              }}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={
                !completeTarget ||
                decisionInFlightIncidentId !== completeTarget.incident.incidentId
              }
            />

            {completeNoteError ? (
              <Text style={styles.falseAlarmErrorText}>{completeNoteError}</Text>
            ) : null}

            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.tealBtn, { flex: 1 }]}
                onPress={() => setCompleteTarget(null)}
                disabled={
                  Boolean(completeTarget) &&
                  decisionInFlightIncidentId === completeTarget?.incident.incidentId
                }
              >
                <Text style={styles.tealBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.blueBtn,
                  { flex: 1.35, height: 46, borderRadius: 12 },
                  Boolean(completeTarget) &&
                    decisionInFlightIncidentId === completeTarget?.incident.incidentId && {
                      opacity: 0.6,
                    },
                ]}
                onPress={() => void handleSubmitCompleteSos()}
                disabled={
                  Boolean(completeTarget) &&
                  decisionInFlightIncidentId === completeTarget?.incident.incidentId
                }
              >
                {Boolean(completeTarget) &&
                decisionInFlightIncidentId === completeTarget?.incident.incidentId ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.blueBtnText}>Xác nhận kết thúc SOS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 110,
  },
  pageHeader: {
    marginBottom: Spacing.md,
  },
  pageHeaderSub: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  activeAlertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dangerSurface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.danger,
  },
  activeAlertText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.danger,
  },
  cardNormal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  cardAlertRed: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: Colors.danger,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIconBoxOrange: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.warningSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconBoxRed: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: Colors.dangerSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleBox: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  fallSubBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.danger,
    marginTop: 2,
  },
  statusTagGray: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
  },
  metaCol: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  blueBtn: {
    flex: 1.2,
    height: 48,
    backgroundColor: Colors.actionSurface,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    ...Shadows.button,
  },
  blueBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tealBtn: {
    flex: 0.85,
    height: 48,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  tealBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  outlineResolveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  outlineResolveBtnDone: {
    borderColor: '#86EFAC',
    backgroundColor: Colors.successSurface,
  },
  outlineResolveBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statusTagRed: {
    backgroundColor: Colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagBlue: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagGreen: {
    backgroundColor: '#166534',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sampleAlertBanner: {
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  sampleAlertText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.danger,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.successSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
  },
  emptyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyRefreshText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cameraCheckBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    backgroundColor: Colors.actionSurface,
    borderRadius: 14,
    paddingHorizontal: 12,
    ...Shadows.button,
  },
  cameraCheckBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sosEmergencyCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    backgroundColor: Colors.danger,
    borderRadius: 16,
    paddingHorizontal: 14,
    ...Shadows.button,
  },
  sosEmergencyCallBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  sosAssignRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  sosAssignText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sosDecisionBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  sosDecisionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#991B1B',
  },
  sosPermissionHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 17,
  },
  confirmSosBtn: {
    flex: 1.25,
    height: 46,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
    ...Shadows.button,
  },
  confirmSosBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  falseAlarmBtn: {
    flex: 0.9,
    height: 46,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  falseAlarmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
  },
  sosConfirmedBox: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  sosConfirmedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sosConfirmedTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  sosConfirmedMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#047857',
  },
  viewRouteBtn: {
    height: 48,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.button,
  },
  viewRouteBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sosTerminalBox: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  sosTerminalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  sosTerminalNote: {
    fontSize: 12,
    color: '#475569',
  },
  sosNoticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sosNoticeText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
  },
  falseAlarmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  falseAlarmSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  falseAlarmModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  falseAlarmModalSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  falseAlarmInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    color: Colors.textPrimary,
    backgroundColor: '#F8FAFC',
  },
  falseAlarmErrorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#DC2626',
  },
  falseAlarmSubmitBtn: {
    flex: 1.2,
    height: 46,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  falseAlarmSubmitBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
