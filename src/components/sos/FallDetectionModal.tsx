import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  AlertTriangle,
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
  Video,
  Navigation,
  XCircle,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { AlertResponse, IncidentResponse } from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';
import {
  classifyEmergencyAlertKind,
  EmergencyAlertKind,
  SosCompletedCallRecord,
  SosCompletionPermission,
  SosDecisionPermission,
} from '../../screens/main/sosDecision';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_H = SCREEN_W * 0.58;

interface FallDetectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
  onStartCall?: () => void;
  onStartCameraView?: () => void;
  alertItem?: AlertResponse | null;
  incident?: IncidentResponse | null;
  incidentId?: string;
  alertKind?: EmergencyAlertKind;
  completedCameraView?: SosCompletedCallRecord | null;
  decisionPermission?: SosDecisionPermission | null;
  completionPermission?: SosCompletionPermission | null;
  isSubmittingDecision?: boolean;
  onConfirmIncident?: () => void;
  onRequestFalseAlarm?: () => void;
  onRequestCompleteSos?: () => void;
  onRetryCloseSos?: () => void;
  onOpenMapRoute?: () => void;
  location?: string;
  robotName?: string;
}

interface EventItem {
  id: number;
  icon: string;
  title: string;
  time: string;
  statusDot: '#EF4444' | '#10B981' | '#F59E0B';
}

export const FallDetectionModal: React.FC<FallDetectionModalProps> = ({
  visible,
  onClose,
  onAcknowledge,
  onStartCall,
  onStartCameraView,
  alertItem,
  incident,
  incidentId,
  alertKind,
  completedCameraView,
  decisionPermission,
  completionPermission,
  isSubmittingDecision = false,
  onConfirmIncident,
  onRequestFalseAlarm,
  onRequestCompleteSos,
  onRetryCloseSos,
  onOpenMapRoute,
  location = 'Chưa có vị trí từ Backend',
  robotName = 'Robot chưa xác định',
}) => {
  const { user } = useAuthStore();

  const resolvedKind = alertKind || classifyEmergencyAlertKind(alertItem, incident);
  const isGestureSos = resolvedKind === 'AUTO_GESTURE_SOS';
  const resolvedIncidentId = incident?.incidentId || alertItem?.incidentId || incidentId;
  const incidentStatus: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'FALSE_ALARM' =
    (incident?.status as any) ||
    (alertItem?.status === 'RESOLVED' || alertItem?.status === 'CLOSED'
      ? (alertItem.status as any)
      : alertItem?.status === 'ACKNOWLEDGED'
      ? 'ACKNOWLEDGED'
      : 'OPEN');

  const dataJson = alertItem?.dataJson || {};
  const metrics = dataJson?.metrics || {};
  const confidencePct =
    typeof dataJson?.confidence === 'number'
      ? `${(dataJson.confidence * 100).toFixed(1)}%`
      : typeof metrics?.confidence === 'number'
      ? `${(metrics.confidence * 100).toFixed(1)}%`
      : null;
  const algorithmName =
    dataJson?.algorithm ||
    metrics?.algorithm ||
    (isGestureSos ? 'gesture_sos_v1' : 'lower_body_rules_v1');
  const detectionMode = metrics?.detection_mode || (isGestureSos ? 'gesture_sos' : 'lower_body');
  const reasonCode =
    metrics?.reason ||
    (isGestureSos ? 'GESTURE_SOS_DETECTED' : 'RAPID_SUPPORT_LOSS_AND_PERSISTENT_LEG_COLLAPSE');
  const displayRobot = dataJson?.robot_code
    ? `Robot ${dataJson.robot_code}`
    : robotName;
  const displayLocation = dataJson?.map_name || location;

  const eventTimeStr = alertItem?.createdAt
    ? new Date(alertItem.createdAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Vừa xong';

  const eventsList: EventItem[] = [
    {
      id: 1,
      icon: '📷',
      title: isGestureSos
        ? `AI Vision (${algorithmName}) phát hiện tín hiệu SOS tự động${confidencePct ? ` — độ tin cậy ${confidencePct}` : ''}`
        : `AI Vision (${algorithmName}) phát hiện nghi té ngã${confidencePct ? ` — độ tin cậy ${confidencePct}` : ' — đã xác thực bởi AI'}`,
      time: eventTimeStr,
      statusDot: '#EF4444',
    },
    {
      id: 2,
      icon: '🔎',
      title: `Chế độ: ${detectionMode} · Mã sự kiện: ${reasonCode}`,
      time: eventTimeStr,
      statusDot: '#F59E0B',
    },
    {
      id: 3,
      icon: '📄',
      title:
        alertItem?.message ||
        (isGestureSos
          ? `CẢNH BÁO AI: ${displayRobot} tại '${displayLocation}' phát hiện cử chỉ cầu cứu SOS.`
          : `CẢNH BÁO AI: ${displayRobot} tại '${displayLocation}' phát hiện người có dấu hiệu té ngã.`),
      time: eventTimeStr,
      statusDot: '#10B981',
    },
    {
      id: 4,
      icon: '🛡️',
      title: 'Staff cần bấm "Xem camera robot" -> "Kết thúc xem" trước khi Xác nhận sự cố hoặc Báo nhầm',
      time: eventTimeStr,
      statusDot: '#10B981',
    },
  ];

  const handleTriggerCameraView = () => {
    onClose();
    if (onStartCameraView) {
      onStartCameraView();
    } else {
      onStartCall?.();
    }
  };

  const isClosedOrFalseAlarm =
    incidentStatus === 'CLOSED' || incidentStatus === 'FALSE_ALARM';
  const isResolvedPendingClose = incidentStatus === 'RESOLVED';

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== TOP BAR ===== */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtnHeader} activeOpacity={0.7}>
            <ArrowLeft size={16} color={Colors.primary} />
            <Text style={styles.backBtnHeaderText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.brandText}>MEDIASSISTROVER · STAFF</Text>
            <Text style={styles.staffName}>{user?.fullName || 'Nhân viên'}</Text>
          </View>

          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
          {/* ===== URGENT BANNER ===== */}
          <View style={styles.urgentBanner}>
            <View style={styles.urgentIconBox}>
              <AlertTriangle size={24} color="#EF4444" strokeWidth={2.5} />
            </View>
            <View style={styles.urgentTextBox}>
              <View style={styles.drillTag}>
                <View style={styles.drillDot} />
                <Text style={styles.drillTagText}>
                  {incidentStatus === 'IN_PROGRESS'
                    ? 'ĐANG XỬ LÝ SỰ CỐ (IN_PROGRESS)'
                    : incidentStatus === 'RESOLVED' || incidentStatus === 'CLOSED'
                    ? 'ĐÃ XỬ LÝ XONG'
                    : incidentStatus === 'FALSE_ALARM'
                    ? 'BÁO NHẦM (FALSE_ALARM)'
                    : isGestureSos
                    ? 'CẢNH BÁO SOS TỰ ĐỘNG (GESTURE_SOS)'
                    : 'CẢNH BÁO TÉ NGÃ MỚI (SUSPECTED_FALL)'}
                </Text>
              </View>
              <Text style={styles.urgentTitle}>
                {isGestureSos
                  ? 'Phát hiện tín hiệu SOS tự động từ camera AI'
                  : 'Phát hiện người có dấu hiệu té ngã'}
              </Text>
              <Text style={styles.urgentSub}>{displayLocation} · {displayRobot}</Text>
            </View>
            <View style={styles.urgentTimerBox}>
              <Text style={styles.urgentTimerText}>{eventTimeStr}</Text>
              <Text style={styles.urgentTimerLabel}>PHÁT HIỆN</Text>
            </View>
          </View>

          {/* ===== AI CAMERA LIVE CARD ===== */}
          <View style={styles.aiCard}>
            {/* Header */}
            <View style={styles.aiCardHeader}>
              <View style={styles.aiHeaderLeft}>
                <View style={styles.redDot} />
                <Text style={styles.aiHeaderText}>CAMERA AI · DỮ LIỆU TỪ VISION BE</Text>
              </View>
              <View style={styles.aiHeaderRight}>
                <View style={styles.greenDot} />
                <Text style={styles.aiStatusText}>Đối tượng #{dataJson?.person_id || 1}</Text>
              </View>
            </View>

            {/* Video View with Bounding Box */}
            <View style={styles.videoBox}>
              <View style={styles.boundingBox}>
                <View style={styles.boundingTag}>
                  <Text style={styles.boundingTagText}>
                    {isGestureSos ? 'GESTURE SOS' : 'TÉ NGÃ'}
                    {confidencePct ? ` · ${confidencePct}` : ' · AI VISION'}
                  </Text>
                </View>

                <View style={styles.fallenPersonSilhouette}>
                  <View style={styles.headSilhouette} />
                  <View style={styles.bodySilhouette} />
                </View>
              </View>

              <View style={styles.recTag}>
                <Text style={styles.recText}>MODE: {detectionMode.toUpperCase()} ●</Text>
              </View>
            </View>

            {/* AI Metrics Row */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>THUẬT TOÁN</Text>
                <Text style={styles.metricVal}>{algorithmName}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>CHÂN HIỂN THỊ</Text>
                <Text style={styles.metricVal}>{metrics?.visible_legs ?? 2}</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>SUPPORT RATIO</Text>
                <Text style={styles.metricVal}>{metrics?.support_ratio ?? 0.18}</Text>
              </View>
            </View>
          </View>

          {/* ===== BỘ NÚT ĐIỀU HÀNH XỬ LÝ SỰ CỐ TỰ ĐỘNG (CHỈ XEM CAMERA -> XÁC NHẬN -> KẾT THÚC -> ĐÓNG) ===== */}
          <View style={styles.actionButtonGroup}>
            {!isClosedOrFalseAlarm && !isResolvedPendingClose && (
              <TouchableOpacity
                style={styles.directCallBtn}
                onPress={handleTriggerCameraView}
                activeOpacity={0.85}
              >
                <Video size={18} color="#FFFFFF" />
                <Text style={styles.directCallBtnText}>
                  {completedCameraView || incidentStatus === 'IN_PROGRESS'
                    ? 'Xem lại camera robot'
                    : 'Xem camera robot'}
                </Text>
              </TouchableOpacity>
            )}

            {isClosedOrFalseAlarm ? (
              <View style={styles.acknowledgeBtn}>
                <AlertOctagon size={20} color="#FFFFFF" />
                <Text style={styles.acknowledgeBtnText}>
                  {incidentStatus === 'FALSE_ALARM'
                    ? 'Đã đóng (Báo nhầm)'
                    : 'Đã đóng hoàn tất (CLOSED)'}
                </Text>
              </View>
            ) : isResolvedPendingClose ? (
              <>
                <View style={{ backgroundColor: '#ECFDF5', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#86EFAC' }}>
                  <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '700' }}>
                    Đã giải quyết sự cố (RESOLVED) · Đang chờ đóng hoàn tất (CLOSED)
                  </Text>
                  {incident?.resolutionNote ? (
                    <Text style={{ fontSize: 11, color: '#047857', marginTop: 4 }}>
                      Ghi chú: {incident.resolutionNote}
                    </Text>
                  ) : null}
                </View>

                {completionPermission?.allowed ? (
                  <TouchableOpacity
                    style={[styles.resolveBtn, isSubmittingDecision && { opacity: 0.6 }]}
                    onPress={() => onRetryCloseSos?.()}
                    disabled={isSubmittingDecision}
                    activeOpacity={0.85}
                  >
                    {isSubmittingDecision ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.resolveBtnText}>Xác nhận kết thúc SOS (Thử đóng lại)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '600' }}>
                    {completionPermission?.reason ||
                      'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền đóng sự cố.'}
                  </Text>
                )}
              </>
            ) : incidentStatus === 'IN_PROGRESS' ? (
              <>
                {onOpenMapRoute && (
                  <TouchableOpacity
                    style={[styles.acknowledgeBtn, { backgroundColor: '#0284C7' }]}
                    onPress={() => {
                      onClose();
                      onOpenMapRoute();
                    }}
                    activeOpacity={0.85}
                  >
                    <Navigation size={18} color="#FFFFFF" />
                    <Text style={styles.acknowledgeBtnText}>Xem đường đến SOS</Text>
                  </TouchableOpacity>
                )}

                {completionPermission?.allowed ? (
                  <TouchableOpacity
                    style={[styles.resolveBtn, isSubmittingDecision && { opacity: 0.6 }]}
                    onPress={() => {
                      onClose();
                      onRequestCompleteSos?.();
                    }}
                    disabled={isSubmittingDecision}
                    activeOpacity={0.85}
                  >
                    {isSubmittingDecision ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.resolveBtnText}>Xác nhận kết thúc SOS</Text>
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '600' }}>
                    {completionPermission?.reason ||
                      'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền kết thúc sự cố.'}
                  </Text>
                )}
              </>
            ) : completedCameraView ? (
              decisionPermission?.allowed ? (
                <View style={styles.subActionRow}>
                  <TouchableOpacity
                    style={[styles.acknowledgeBtn, { flex: 1.25 }]}
                    onPress={() => onConfirmIncident?.()}
                    disabled={isSubmittingDecision}
                    activeOpacity={0.85}
                  >
                    {isSubmittingDecision ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.acknowledgeBtnText}>Xác nhận sự cố</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.falseAlarmBtn, { flex: 0.9 }]}
                    onPress={() => {
                      onClose();
                      onRequestFalseAlarm?.();
                    }}
                    disabled={isSubmittingDecision}
                    activeOpacity={0.8}
                  >
                    <XCircle size={16} color={Colors.danger} />
                    <Text style={styles.falseAlarmBtnText}>Báo nhầm</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ fontSize: 12, color: Colors.textSecondary, fontWeight: '600' }}>
                  {decisionPermission?.reason ||
                    'Chỉ ADMIN hoặc nhân viên được phân công xử lý SOS mới có quyền xác nhận sự cố.'}
                </Text>
              )
            ) : (
              <View style={{ backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
                <Text style={{ fontSize: 12, color: '#1E3A8A', fontWeight: '600', lineHeight: 18 }}>
                  Bấm &quot;Xem camera robot&quot; (chỉ nhận hình ảnh, không có âm thanh), sau đó bấm &quot;Kết thúc xem&quot; để mở lựa chọn Xác nhận sự cố hoặc Báo nhầm.
                </Text>
              </View>
            )}
          </View>

          {/* ===== EVENT TIMELINE (CHÙM SỰ KIỆN) ===== */}
          <Text style={styles.sectionTitle}>DỮ LIỆU TỪ MÁY CHỦ</Text>
          <View style={styles.eventsList}>
            {eventsList.map((event) => (
              <View key={event.id} style={styles.eventItem}>
                <View style={styles.eventIconCircle}>
                  <Text style={{ fontSize: 16 }}>{event.icon}</Text>
                </View>
                <View style={styles.eventTextBox}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.eventTime}>{event.time}</Text>
                </View>
                <View style={[styles.eventDot, { backgroundColor: event.statusDot }]} />
              </View>
            ))}
          </View>

          {/* ===== NÚT THOÁT RA XEM CÁC GIAO DIỆN KHÁC ===== */}
          <TouchableOpacity
            style={styles.exitBottomBtn}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <ArrowLeft size={16} color={Colors.textPrimary} />
            <Text style={styles.exitBottomBtnText}>Đóng & Quay lại màn hình chính</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  brandText: { fontSize: 9, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6 },
  staffName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  scrollBody: {
    padding: Spacing.md,
    paddingBottom: 50,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 20,
    padding: 16,
    marginBottom: Spacing.md,
    ...Shadows.hero,
  },
  urgentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  urgentTextBox: {
    flex: 1,
  },
  drillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
    gap: 4,
  },
  drillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FDE047',
  },
  drillTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  urgentTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  urgentSub: {
    fontSize: 12,
    color: '#FEE2E2',
    fontWeight: '500',
  },
  urgentTimerBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  urgentTimerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  urgentTimerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FECACA',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  aiCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surfaceMuted,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  aiHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  aiHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#24A148',
  },
  aiStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#166534',
  },
  videoBox: {
    height: VIDEO_H,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  boundingBox: {
    width: VIDEO_H * 0.75,
    height: VIDEO_H * 0.58,
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: 10,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boundingTag: {
    position: 'absolute',
    top: -12,
    left: 8,
    backgroundColor: Colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  boundingTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fallenPersonSilhouette: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headSilhouette: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  bodySilhouette: {
    width: 58,
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  recTag: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  recText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.danger,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
  },
  actionButtonGroup: {
    marginBottom: Spacing.md,
    gap: 10,
  },
  acknowledgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.danger,
    borderRadius: 16,
    height: 52,
    gap: Spacing.xs + 2,
    ...Shadows.button,
  },
  acknowledgeBtnDone: {
    backgroundColor: Colors.actionSurface,
  },
  directCallBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.actionSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...Shadows.button,
  },
  directCallBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  acknowledgeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  falseAlarmBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    height: 48,
    gap: 6,
  },
  falseAlarmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
  },
  resolveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#166534',
    borderRadius: 14,
    height: 48,
    gap: 6,
  },
  resolveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  eventsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    gap: 10,
    ...Shadows.card,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  eventIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventTextBox: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  eventTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 6,
  },
  exitBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    height: 48,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  exitBottomBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
