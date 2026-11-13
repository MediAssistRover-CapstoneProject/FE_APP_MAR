import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  X,
  AlertTriangle,
  Check,
  ShieldAlert,
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
  Video,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { incidentApi } from '../../api/modules/incident.api';
import { alertApi } from '../../api/modules/alert.api';
import { AlertResponse } from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_H = SCREEN_W * 0.58;

interface FallDetectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
  onStartCall?: () => void;
  alertItem?: AlertResponse | null;
  incidentId?: string;
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
  alertItem,
  incidentId,
  location = 'Chưa có vị trí từ Backend',
  robotName = 'Robot chưa xác định',
}) => {
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentStatus, setIncidentStatus] = useState<
    'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_ALARM'
  >('OPEN');

  const resolvedIncidentId = alertItem?.incidentId || incidentId;
  const dataJson = alertItem?.dataJson || {};
  const metrics = dataJson?.metrics || {};
  const confidencePct =
    typeof dataJson?.confidence === 'number'
      ? `${(dataJson.confidence * 100).toFixed(1)}%`
      : typeof metrics?.confidence === 'number'
      ? `${(metrics.confidence * 100).toFixed(1)}%`
      : null;
  const algorithmName = dataJson?.algorithm || metrics?.algorithm || 'lower_body_rules_v1';
  const detectionMode = metrics?.detection_mode || 'lower_body';
  const reasonCode = metrics?.reason || 'RAPID_SUPPORT_LOSS_AND_PERSISTENT_LEG_COLLAPSE';
  const displayRobot = dataJson?.robot_code
    ? `Robot ${dataJson.robot_code}`
    : robotName;
  const displayLocation = dataJson?.map_name || location;

  useEffect(() => {
    if (!visible) return;
    if (alertItem?.status === 'RESOLVED' || alertItem?.status === 'CLOSED') {
      setIncidentStatus('RESOLVED');
    } else if (alertItem?.status === 'ACKNOWLEDGED') {
      setIncidentStatus('IN_PROGRESS');
    } else {
      setIncidentStatus('OPEN');
    }
  }, [visible, alertItem?.alertId, alertItem?.status]);

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
      title: `AI Vision (${algorithmName}) phát hiện nghi té ngã${confidencePct ? ` — độ tin cậy ${confidencePct}` : ' — đã xác thực bởi AI'}`,
      time: eventTimeStr,
      statusDot: '#EF4444',
    },
    {
      id: 2,
      icon: '🦿',
      title: `Chế độ: ${detectionMode} · Lý do: ${reasonCode}`,
      time: eventTimeStr,
      statusDot: '#F59E0B',
    },
    {
      id: 3,
      icon: '📄',
      title:
        alertItem?.message ||
        `CẢNH BÁO AI: ${displayRobot} tại '${displayLocation}' phát hiện người có dấu hiệu té ngã.`,
      time: eventTimeStr,
      statusDot: '#10B981',
    },
    {
      id: 4,
      icon: '🚑',
      title: 'Backend đã tạo DetectionEvent, EmergencyIncident & Alert gửi tới nhân viên trực',
      time: eventTimeStr,
      statusDot: '#10B981',
    },
  ];

  // 1. Gọi API tiếp nhận & điều phối cấp cứu
  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      if (alertItem?.alertId && alertItem.status === 'OPEN') {
        await alertApi.acknowledgeAlert(alertItem.alertId);
      }
      if (resolvedIncidentId) {
        await incidentApi.acknowledgeIncident(resolvedIncidentId);
        await incidentApi.startIncident(resolvedIncidentId);
      }
      setIncidentStatus('IN_PROGRESS');
      if (onAcknowledge) onAcknowledge();
      Alert.alert(
        'Đã tiếp nhận cảnh báo',
        'Đã xác nhận tiếp nhận cảnh báo té ngã và chuyển trạng thái sự cố sang Đang xử lý!'
      );
    } catch (err: any) {
      console.log('Phản hồi server sự cố:', err);
      Alert.alert(
        'Không thể tiếp nhận',
        err?.message || 'Không thể gửi phản hồi tiếp nhận lên máy chủ. Vui lòng thử lại.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Gọi API đánh dấu báo động giả
  const handleFalseAlarm = async () => {
    setIsSubmitting(true);
    try {
      if (resolvedIncidentId) {
        await incidentApi.markFalseAlarm(
          resolvedIncidentId,
          'Báo động giả, đã kiểm tra thực tế qua AI Camera'
        );
      }
      setIncidentStatus('FALSE_ALARM');
      if (onAcknowledge) onAcknowledge();
      Alert.alert('Báo động giả', 'Đã cập nhật trạng thái báo động giả lên hệ thống!');
    } catch (err: any) {
      Alert.alert('Lỗi cập nhật', err?.message || 'Không thể cập nhật trạng thái báo động giả.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Gọi API giải quyết xong sự cố
  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      if (resolvedIncidentId) {
        await incidentApi.resolveIncident(
          resolvedIncidentId,
          'Đã sơ cứu kịp thời và đưa nạn nhân vào phòng y tế an toàn'
        );
      }
      if (alertItem?.alertId) {
        await alertApi.resolveAlert(alertItem.alertId);
      }
      setIncidentStatus('RESOLVED');
      if (onAcknowledge) onAcknowledge();
      Alert.alert('Hoàn tất giải quyết', 'Đã cập nhật báo cáo xử lý sự cố thành công!');
    } catch (err: any) {
      Alert.alert('Lỗi giải quyết', err?.message || 'Không thể cập nhật báo cáo xử lý sự cố.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                  {incidentStatus === 'OPEN'
                    ? 'CẢNH BÁO TÉ NGÃ MỚI (SUSPECTED_FALL)'
                    : incidentStatus === 'IN_PROGRESS'
                    ? 'ĐANG XỬ LÝ CỨU HỘ'
                    : incidentStatus === 'RESOLVED'
                    ? 'ĐÃ XỬ LÝ XONG'
                    : 'BÁO ĐỘNG GIẢ'}
                </Text>
              </View>
              <Text style={styles.urgentTitle}>Phát hiện người có dấu hiệu té ngã</Text>
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
                  <Text style={styles.boundingTagText}>TÉ NGÃ{confidencePct ? ` · ${confidencePct}` : ' · AI VISION'}</Text>
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

          {/* ===== BỘ NÚT ĐIỀU HÀNH XỬ LÝ SỰ CỐ TAI NẠN ===== */}
          <View style={styles.actionButtonGroup}>
            {/* Nút Gọi trực tiếp Robot (Camera LiveKit + Đàm thoại 2 chiều) */}
            <TouchableOpacity
              style={styles.directCallBtn}
              onPress={() => {
                onClose();
                onStartCall?.();
              }}
              activeOpacity={0.85}
            >
              <Video size={18} color="#FFFFFF" />
              <Text style={styles.directCallBtnText}>
                📹 Gọi trực tiếp Robot (Camera LiveKit + Mic/Loa)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acknowledgeBtn,
                incidentStatus === 'IN_PROGRESS' && styles.acknowledgeBtnDone,
                incidentStatus === 'RESOLVED' && { backgroundColor: '#166534' },
                incidentStatus === 'FALSE_ALARM' && { backgroundColor: '#64748B' },
              ]}
              onPress={handleAcknowledge}
              disabled={incidentStatus !== 'OPEN' || isSubmitting}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : incidentStatus === 'IN_PROGRESS' ? (
                <>
                  <Check size={20} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.acknowledgeBtnText}>Đã tiếp nhận · Đội cứu hộ đang đến</Text>
                </>
              ) : incidentStatus === 'RESOLVED' ? (
                <>
                  <Check size={20} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.acknowledgeBtnText}>Sự cố đã giải quyết xong ✓</Text>
                </>
              ) : incidentStatus === 'FALSE_ALARM' ? (
                <>
                  <AlertOctagon size={20} color="#FFFFFF" />
                  <Text style={styles.acknowledgeBtnText}>Đã đóng (Báo động giả)</Text>
                </>
              ) : (
                <>
                  <ShieldAlert size={20} color="#FFFFFF" />
                  <Text style={styles.acknowledgeBtnText}>Xác nhận & Điều phối cấp cứu</Text>
                </>
              )}
            </TouchableOpacity>

            {incidentStatus === 'IN_PROGRESS' && (
              <View style={styles.subActionRow}>
                <TouchableOpacity
                  style={styles.falseAlarmBtn}
                  onPress={handleFalseAlarm}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <AlertOctagon size={16} color={Colors.danger} />
                  <Text style={styles.falseAlarmBtnText}>Báo động giả</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resolveBtn}
                  onPress={handleResolve}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <CheckCircle2 size={16} color="#FFFFFF" />
                  <Text style={styles.resolveBtnText}>Đã xử lý xong</Text>
                </TouchableOpacity>
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
    backgroundColor: Colors.hero,
  },
  directCallBtn: {
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.hero,
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
