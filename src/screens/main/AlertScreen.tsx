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
} from 'react-native';
import {
  Phone,
  PhoneCall,
  ShieldAlert,
  Check,
  RefreshCw,
  Eye,
  AlertTriangle,
  Video,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { incidentApi } from '../../api/modules/incident.api';
import { alertApi } from '../../api/modules/alert.api';
import { mediaSessionApi } from '../../api/modules/mediaSession.api';
import { IncidentResponse, AlertResponse } from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';
import { SOSCallModal } from '../../components/sos/SOSCallModal';
import { SOSStreamModal } from '../../components/sos/SOSStreamModal';
import { FallDetectionModal } from '../../components/sos/FallDetectionModal';
import { MediaCallModal } from '../../components/media/MediaCallModal';

interface ActiveCallTarget {
  robotId: string;
  robotName: string;
  incidentId?: string;
  alertId?: string;
  sessionId?: string;
  livekitUrl?: string;
  livekitToken?: string;
}

export const AlertScreen: React.FC = () => {
  const [showSOSCall, setShowSOSCall] = useState(false);
  const [showSOSStream, setShowSOSStream] = useState(false);
  const [showFallDetail, setShowFallDetail] = useState(false);

  // Trạng thái cuộc gọi mục tiêu duy nhất — tránh ghép nhầm robot, incident, session
  const [activeCall, setActiveCall] = useState<ActiveCallTarget | null>(null);
  const [inFlightAlertId, setInFlightAlertId] = useState<string | null>(null);

  const [liveIncidents, setLiveIncidents] = useState<IncidentResponse[]>([]);
  const [isLoadingIncidents, setIsLoadingIncidents] = useState(false);
  const [liveAlerts, setLiveAlerts] = useState<AlertResponse[]>([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertResponse | null>(null);
  const [resolvingAlertId, setResolvingAlertId] = useState<string | null>(null);

  const isPollingRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');

  const currentUser = useAuthStore((s) => s.user);
  const userAccountIdRef = useRef<string | undefined>(currentUser?.accountId || currentUser?.username);
  useEffect(() => {
    userAccountIdRef.current = currentUser?.accountId || currentUser?.username;
  }, [currentUser]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // Badge nhấp nháy animation cho cảnh báo khẩn cấp
  const flashAnim = useRef(new Animated.Value(1)).current;
  const hasUrgent = liveAlerts.some(
    (a) =>
      a.status === 'OPEN' &&
      (a.severity === 'CRITICAL' ||
        a.notificationType === 'SUSPECTED_FALL' ||
        a.notificationType === 'GESTURE_SOS' ||
        a.notificationType === 'SOS' ||
        a.notificationType === 'EMERGENCY_SOS')
  );

  useEffect(() => {
    if (hasUrgent) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 0.2, duration: 400, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      flashAnim.setValue(1);
    }
  }, [hasUrgent, flashAnim]);

  // Helper: lấy robotId từ alert data một cách an toàn (KHÔNG fallback sang robot khác)
  const getRobotIdFromAlert = useCallback((alertItem?: AlertResponse | null): string | undefined => {
    if (!alertItem) return undefined;
    const data = alertItem.dataJson || {};
    if (data.robotId) return String(data.robotId);
    if (data.robot_id) return String(data.robot_id);
    if (alertItem.incidentId) {
      const inc = liveIncidents.find((i) => i.incidentId === alertItem.incidentId);
      if (inc?.robotId) return inc.robotId;
    }
    return undefined;
  }, [liveIncidents]);

  // Tiếp nhận SOS một chạm: Mở phiên ASSIST, lấy LiveKit join token và hiển thị đàm thoại 2 chiều
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

      // Acknowledge alert & incident trên BE nếu đang OPEN
      if (alertItem.status === 'OPEN') {
        await alertApi.acknowledgeAlert(alertItem.alertId).catch((err) => {
          console.log('Error acknowledging alert on accept:', err);
        });
        if (incidentId) {
          await incidentApi.acknowledgeIncident(incidentId).catch(() => null);
          await incidentApi.startIncident(incidentId).catch(() => null);
        }
      }

      // Tìm phiên ASSIST khớp cả robotId và incidentId
      const sessions = await mediaSessionApi.getSessions().catch(() => []);
      let targetSession = (sessions || []).find(
        (s) =>
          s.robotId === targetRobotId &&
          s.mode === 'ASSIST' &&
          (!incidentId || s.incidentId === incidentId) &&
          (s.state === 'RINGING' || s.state === 'CONNECTING' || s.state === 'ACTIVE')
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

      const robotDisplayName =
        alertItem.dataJson?.robot_code ||
        alertItem.dataJson?.robot ||
        `Robot ${targetRobotId.slice(0, 8)}`;

      setActiveCall({
        robotId: targetRobotId,
        robotName: robotDisplayName,
        incidentId,
        alertId: alertItem.alertId,
        sessionId: targetSession.sessionId,
        livekitUrl,
        livekitToken,
      });
    } catch (err: any) {
      console.log('Error in handleAcceptSosCall:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể mở cuộc gọi và camera tới robot.');
    } finally {
      setInFlightAlertId(null);
      fetchAlerts();
      fetchIncidents();
    }
  };

  const fetchIncidents = useCallback(async (forAccountId?: string) => {
    setIsLoadingIncidents(true);
    try {
      const result = await incidentApi.getAllIncidents();
      if (forAccountId && userAccountIdRef.current !== forAccountId) return;
      setLiveIncidents(result);
    } catch (err) {
      console.log('Error fetching live incidents:', err);
    } finally {
      setIsLoadingIncidents(false);
    }
  }, []);

  const fetchAlerts = useCallback(async (forAccountId?: string) => {
    setIsLoadingAlerts(true);
    try {
      const result = await alertApi.getAllAlerts();
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
      const ringing = sessions.find((s) => s.state === 'RINGING' && s.mode === 'ASSIST');
      if (ringing && ringing.sessionId !== lastSessionIdRef.current) {
        lastSessionIdRef.current = ringing.sessionId;
        const matchingAlert = liveAlerts.find(
          (a) =>
            (ringing.incidentId && a.incidentId === ringing.incidentId) ||
            (a.dataJson?.robotId === ringing.robotId)
        );
        if (matchingAlert) {
          setSelectedAlert(matchingAlert);
          setShowSOSCall(true);
        }
      }
    } catch {
      // ignore
    }
  }, [liveAlerts]);

  const pollAll = useCallback(async () => {
    if (appStateRef.current !== 'active') return;
    if (isPollingRef.current) return;
    isPollingRef.current = true;
    const accountAtStart = userAccountIdRef.current;
    try {
      await Promise.all([
        fetchIncidents(accountAtStart),
        fetchAlerts(accountAtStart),
        fetchMediaSessions(accountAtStart),
      ]);
    } catch (err) {
      console.log('Poll tick error:', err);
    } finally {
      isPollingRef.current = false;
    }
  }, [fetchIncidents, fetchAlerts, fetchMediaSessions]);

  useEffect(() => {
    pollAll();
    const timer = setInterval(() => {
      pollAll();
    }, 3500);
    return () => clearInterval(timer);
  }, [pollAll]);

  // Tự động mở màn hình cảnh báo nếu có sự cố SOS hoặc Té ngã (SUSPECTED_FALL) mới phát sinh
  useEffect(() => {
    const openUrgent = liveAlerts.find(
      (a) =>
        a.status === 'OPEN' &&
        (a.severity === 'CRITICAL' ||
          a.notificationType === 'SUSPECTED_FALL' ||
          a.notificationType === 'GESTURE_SOS' ||
          a.notificationType === 'SOS' ||
          a.notificationType === 'EMERGENCY_SOS')
    );
    if (openUrgent && openUrgent.alertId !== lastAlertIdRef.current) {
      lastAlertIdRef.current = openUrgent.alertId;
      setSelectedAlert(openUrgent);
      if (openUrgent.notificationType === 'SUSPECTED_FALL') {
        setShowFallDetail(true);
      } else {
        setShowSOSCall(true);
      }
    }
  }, [liveAlerts]);

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
      await alertApi.acknowledgeAlert(alertItem.alertId);
      if (alertItem.incidentId) {
        await incidentApi.acknowledgeIncident(alertItem.incidentId).catch(() => null);
        await incidentApi.startIncident(alertItem.incidentId).catch(() => null);
      }
      await fetchAlerts();
      await fetchIncidents();
      if (alertItem.notificationType === 'SUSPECTED_FALL') {
        setShowFallDetail(true);
      } else {
        await handleAcceptSosCall(alertItem);
      }
    } catch (err: any) {
      console.log('Error acknowledging alert:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể tiếp nhận cảnh báo');
    }
  };

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

  const getAlertTitle = (type?: string) => {
    switch (type) {
      case 'SUSPECTED_FALL':
        return 'Cảnh báo AI: Nghi người bị té ngã';
      case 'GESTURE_SOS':
        return 'Cảnh báo AI: Cử chỉ tay cầu cứu (SOS)';
      case 'SUSPECTED_SEIZURE':
        return 'Cảnh báo AI: Nghi chuyển động co giật';
      case 'SOS':
      case 'EMERGENCY_SOS':
        return 'Tín hiệu SOS từ Robot';
      default:
        return type || 'Cảnh báo khẩn cấp';
    }
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
            const isResolved = alertItem.status === 'RESOLVED';
            const isClosed = alertItem.status === 'CLOSED';
            const isAcknowledged = alertItem.status === 'ACKNOWLEDGED';
            const isOpen = alertItem.status === 'OPEN';
            const isFall = alertItem.notificationType === 'SUSPECTED_FALL';
            const isCritical = alertItem.severity === 'CRITICAL' || isFall;
            const isResolvingThis = resolvingAlertId === alertItem.alertId;
            const data = alertItem.dataJson || {};
            const metrics = data.metrics || {};

            return (
              <View
                key={alertItem.alertId}
                style={[
                  isCritical && isOpen ? styles.cardAlertRed : styles.cardNormal,
                  (isResolved || isClosed) && { opacity: 0.85 },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={isCritical ? styles.cardIconBoxRed : styles.cardIconBoxOrange}>
                    <Text style={{ fontSize: 16 }}>{isFall ? '🚨' : isCritical ? '🆘' : '⚠️'}</Text>
                  </View>
                  <View style={styles.cardTitleBox}>
                    <Text style={styles.cardTitle}>{getAlertTitle(alertItem.notificationType)}</Text>
                    {isFall && data.algorithm ? (
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
                      isOpen
                        ? styles.statusTagRed
                        : isAcknowledged
                        ? styles.statusTagBlue
                        : isResolved
                        ? styles.statusTagGreen
                        : styles.statusTagGray
                    }
                  >
                    <Text style={styles.statusTagText}>
                      {isOpen
                        ? 'Đang xảy ra'
                        : isAcknowledged
                        ? 'Đang xử lý'
                        : isResolved
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

                {isFall && metrics.reason ? (
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

                {isOpen && (
                  <View style={{ gap: 8 }}>
                    {isFall ? (
                      <>
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
                              <PhoneCall size={18} color="#FFFFFF" strokeWidth={2.5} />
                              <Text style={styles.sosEmergencyCallBtnText}>
                                🆘 TIẾP NHẬN & XÁC MINH TÉ NGÃ
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>

                        <View style={styles.btnRow}>
                          <TouchableOpacity
                            style={styles.tealBtn}
                            onPress={() => {
                              setSelectedAlert(alertItem);
                              setShowFallDetail(true);
                            }}
                            activeOpacity={0.8}
                          >
                            <AlertTriangle size={15} color={Colors.tealDark} />
                            <Text style={styles.tealBtnText}>Chi tiết AI</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cameraCheckBtn}
                            onPress={() => handleAcceptSosCall(alertItem)}
                            activeOpacity={0.8}
                            disabled={inFlightAlertId === alertItem.alertId}
                          >
                            {inFlightAlertId === alertItem.alertId ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Video size={16} color="#FFFFFF" />
                                <Text style={styles.cameraCheckBtnText}>📹 Camera Robot</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      /* Một nút duy nhất cho cảnh báo SOS: Gom Tiếp nhận SOS + Chuông SOS + Gọi Camera thành 1 nút */
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
                    )}
                  </View>
                )}

                {isAcknowledged && (
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={[styles.outlineResolveBtn, { flex: 1 }]}
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

                    <TouchableOpacity
                      style={[styles.blueBtn, { flex: 1 }]}
                      onPress={() => {
                        setSelectedAlert(alertItem);
                        if (isFall) {
                          setShowFallDetail(true);
                        } else {
                          handleAcceptSosCall(alertItem);
                        }
                      }}
                      activeOpacity={0.8}
                      disabled={inFlightAlertId === alertItem.alertId}
                    >
                      {inFlightAlertId === alertItem.alertId ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <Video size={15} color="#FFFFFF" />
                          <Text style={styles.blueBtnText}>
                            {isFall ? 'Hồ sơ té ngã' : 'Vào lại đàm thoại'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {isResolved && (
                  <TouchableOpacity
                    style={[styles.outlineResolveBtn, styles.outlineResolveBtnDone]}
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
            handleAcceptSosCall(selectedAlert);
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

      <FallDetectionModal
        visible={showFallDetail}
        onClose={() => setShowFallDetail(false)}
        onStartCall={() => {
          setShowFallDetail(false);
          if (selectedAlert) {
            handleAcceptSosCall(selectedAlert);
          }
        }}
        alertItem={selectedAlert}
        incidentId={selectedAlert?.incidentId || undefined}
        location={getAlertLocation(selectedAlert)}
        robotName={selectedAlert ? `Robot ${getAlertRobot(selectedAlert)}` : 'Robot'}
        onAcknowledge={() => {
          fetchAlerts();
          fetchIncidents();
        }}
      />

      <MediaCallModal
        visible={activeCall !== null}
        onClose={() => {
          setActiveCall(null);
          fetchAlerts();
          fetchIncidents();
        }}
        robotId={activeCall?.robotId}
        robotName={activeCall?.robotName}
        mode="ASSIST"
        incidentId={activeCall?.incidentId}
        existingSessionId={activeCall?.sessionId}
        livekitUrl={activeCall?.livekitUrl}
        livekitToken={activeCall?.livekitToken}
        onSessionEnd={() => {
          setActiveCall(null);
          fetchAlerts();
          fetchIncidents();
        }}
      />
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
    backgroundColor: Colors.hero,
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
    backgroundColor: Colors.hero,
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
});
