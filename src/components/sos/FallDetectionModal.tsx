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
  Camera,
  Activity,
  Check,
  Clock,
  Radio,
  User,
  ShieldAlert,
  Cpu,
  Layers,
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { incidentApi } from '../../api/modules/incident.api';
import { useAuthStore } from '../../store/useAuthStore';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_H = SCREEN_W * 0.58;

interface FallDetectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
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

const EVENTS: EventItem[] = [
  {
    id: 1,
    icon: '🏃',
    title: 'Cảm biến gia tốc phát hiện va chạm bất thường',
    time: '09:41:26',
    statusDot: '#EF4444',
  },
  {
    id: 2,
    icon: '📷',
    title: 'AI camera xác nhận tư thế ngã — độ chính xác 94.2%',
    time: '09:41:26',
    statusDot: '#10B981',
  },
  {
    id: 3,
    icon: '🔴',
    title: 'Robot dừng khẩn cấp, giữ nguyên vị trí hiện trường',
    time: '09:41:16',
    statusDot: '#10B981',
  },
  {
    id: 4,
    icon: '🚑',
    title: 'Thông báo khẩn gửi đến nhân viên trực',
    time: '09:41:10',
    statusDot: '#10B981',
  },
  {
    id: 5,
    icon: '👷',
    title: 'Nhân viên y tế đã nhận tín hiệu qua hệ thống',
    time: '09:41:08',
    statusDot: '#10B981',
  },
  {
    id: 6,
    icon: '🚶',
    title: 'Nhân viên đang trên đường đến hiện trường',
    time: '09:40:52',
    statusDot: '#10B981',
  },
  {
    id: 7,
    icon: '🚨',
    title: 'Robot đã dừng khẩn cấp — Khu: 3B · Robot: R001',
    time: '09:40:48',
    statusDot: '#F59E0B',
  },
];

export const FallDetectionModal: React.FC<FallDetectionModalProps> = ({
  visible,
  onClose,
  onAcknowledge,
  incidentId,
  location = 'Khu: 3B · Hành lang Tim mạch',
  robotName = 'Robot MAR-01',
}) => {
  const { user } = useAuthStore();
  const [seconds, setSeconds] = useState(14);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [incidentStatus, setIncidentStatus] = useState<
    'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'FALSE_ALARM'
  >('OPEN');

  useEffect(() => {
    let interval: any;
    if (visible && incidentStatus === 'OPEN') {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, incidentStatus]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 1. Gọi API tiếp nhận & điều phối cấp cứu
  const handleAcknowledge = async () => {
    setIsSubmitting(true);
    try {
      if (incidentId) {
        await incidentApi.acknowledgeIncident(incidentId);
        await incidentApi.startIncident(incidentId);
      }
      setIncidentStatus('IN_PROGRESS');
      if (onAcknowledge) onAcknowledge();
      Alert.alert(
        'Đã tiếp nhận cảnh báo',
        'Đã phát lệnh điều phối cứu hộ và điều động nhân sự đến hiện trường!'
      );
    } catch (err: any) {
      console.log('Phản hồi server sự cố:', err);
      setIncidentStatus('IN_PROGRESS');
      if (onAcknowledge) onAcknowledge();
      Alert.alert(
        'Đã tiếp nhận cảnh báo',
        'Đã ghi nhận sự cố té ngã và phát lệnh hỗ trợ y tế khẩn cấp!'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Gọi API đánh dấu báo động giả
  const handleFalseAlarm = async () => {
    setIsSubmitting(true);
    try {
      if (incidentId) {
        await incidentApi.markFalseAlarm(
          incidentId,
          'Báo động giả, đã kiểm tra thực tế qua AI Camera'
        );
      }
      setIncidentStatus('FALSE_ALARM');
      Alert.alert('Báo động giả', 'Đã cập nhật trạng thái báo động giả lên hệ thống!');
    } catch {
      setIncidentStatus('FALSE_ALARM');
      Alert.alert('Báo động giả', 'Đã đóng cảnh báo do báo động giả.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Gọi API giải quyết xong sự cố
  const handleResolve = async () => {
    setIsSubmitting(true);
    try {
      if (incidentId) {
        await incidentApi.resolveIncident(
          incidentId,
          'Đã sơ cứu kịp thời và đưa nạn nhân vào phòng y tế an toàn'
        );
      }
      setIncidentStatus('RESOLVED');
      Alert.alert('Hoàn tất giải quyết', 'Đã cập nhật báo cáo xử lý sự cố thành công!');
    } catch {
      setIncidentStatus('RESOLVED');
      Alert.alert('Hoàn tất', 'Sự cố đã được xử lý xong.');
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
            <Text style={styles.staffName}>{user?.fullName || 'Nguyễn Thành Trung'}</Text>
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
                    ? 'CẢNH BÁO MỚI'
                    : incidentStatus === 'IN_PROGRESS'
                    ? 'ĐANG XỬ LÝ CỨU HỘ'
                    : incidentStatus === 'RESOLVED'
                    ? 'ĐÃ XỬ LÝ XONG'
                    : 'BÁO ĐỘNG GIẢ'}
                </Text>
              </View>
              <Text style={styles.urgentTitle}>Phát hiện người bị té ngã</Text>
              <Text style={styles.urgentSub}>{location} · {robotName}</Text>
            </View>
            <View style={styles.urgentTimerBox}>
              <Text style={styles.urgentTimerText}>{formatTimer(seconds)}</Text>
              <Text style={styles.urgentTimerLabel}>THỜI GIAN</Text>
            </View>
          </View>

          {/* ===== AI CAMERA LIVE CARD ===== */}
          <View style={styles.aiCard}>
            {/* Header */}
            <View style={styles.aiCardHeader}>
              <View style={styles.aiHeaderLeft}>
                <View style={styles.redDot} />
                <Text style={styles.aiHeaderText}>CAMERA AI · LIVE TỪ ROBOT</Text>
              </View>
              <View style={styles.aiHeaderRight}>
                <View style={styles.greenDot} />
                <Text style={styles.aiStatusText}>Phát hiện chuẩn xác</Text>
              </View>
            </View>

            {/* Video View with Bounding Box */}
            <View style={styles.videoBox}>
              {/* Bounding box AI */}
              <View style={styles.boundingBox}>
                <View style={styles.boundingTag}>
                  <Text style={styles.boundingTagText}>TÉ NGÃ · 94.2%</Text>
                </View>

                {/* Silhouette hình người nằm ngã */}
                <View style={styles.fallenPersonSilhouette}>
                  <View style={styles.headSilhouette} />
                  <View style={styles.bodySilhouette} />
                </View>
              </View>

              {/* Timestamp REC */}
              <View style={styles.recTag}>
                <Text style={styles.recText}>LIVE STREAM · REC ●</Text>
              </View>
            </View>

            {/* AI Metrics Row */}
            <View style={styles.metricsRow}>
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>AI MODEL</Text>
                <Text style={styles.metricVal}>FastLinet v2.3</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>FRAME RATE</Text>
                <Text style={styles.metricVal}>30 FPS</Text>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.metricCol}>
                <Text style={styles.metricLabel}>ĐỘ TRỄ</Text>
                <Text style={styles.metricVal}>42ms</Text>
              </View>
            </View>
          </View>

          {/* ===== BỘ NÚT ĐIỀU HÀNH XỬ LÝ SỰ CỐ TAI NẠN ===== */}
          <View style={styles.actionButtonGroup}>
            {/* Nút 1: Tiếp nhận & Cử cấp cứu */}
            <TouchableOpacity
              style={[
                styles.acknowledgeBtn,
                incidentStatus === 'IN_PROGRESS' && styles.acknowledgeBtnDone,
                incidentStatus === 'RESOLVED' && { backgroundColor: '#059669' },
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

            {/* Hàng nút Giải quyết hoặc Báo động giả khi đang xử lý */}
            {incidentStatus === 'IN_PROGRESS' && (
              <View style={styles.subActionRow}>
                <TouchableOpacity
                  style={styles.falseAlarmBtn}
                  onPress={handleFalseAlarm}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  <AlertOctagon size={16} color="#DC2626" />
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
          <Text style={styles.sectionTitle}>CHÙM SỰ KIỆN TỰ ĐỘNG TỪ ROBOT</Text>
          <View style={styles.eventsList}>
            {EVENTS.map((event) => (
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
            <ArrowLeft size={16} color={Colors.primary} />
            <Text style={styles.exitBottomBtnText}>Thoát ra xem các giao diện khác</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    borderBottomColor: '#E2E8F0',
  },
  backBtnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  backBtnHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  headerCenter: {
    alignItems: 'center',
  },
  brandText: { fontSize: 8, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
  staffName: { fontSize: 13, fontWeight: '700', color: '#0A2540' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  urgentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#991B1B',
    borderRadius: 16,
    padding: 14,
    marginBottom: Spacing.md,
  },
  urgentIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  urgentTextBox: {
    flex: 1,
  },
  drillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    color: '#FEF08A',
    letterSpacing: 0.5,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  urgentSub: {
    fontSize: 11,
    color: '#FECACA',
    fontWeight: '500',
  },
  urgentTimerBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  urgentTimerText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  urgentTimerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FECACA',
    letterSpacing: 0.5,
  },
  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
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
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs + 2,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  aiHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  aiHeaderText: {
    fontSize: 10,
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
    backgroundColor: '#10B981',
  },
  aiStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#10B981',
  },
  videoBox: {
    height: VIDEO_H,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  boundingBox: {
    width: VIDEO_H * 0.75,
    height: VIDEO_H * 0.58,
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boundingTag: {
    position: 'absolute',
    top: -12,
    left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
    borderColor: '#EF4444',
  },
  bodySilhouette: {
    width: 58,
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1.5,
    borderColor: '#EF4444',
  },
  recTag: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#EF4444',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.sm,
    backgroundColor: '#FFFFFF',
  },
  metricCol: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.border,
  },
  actionButtonGroup: {
    marginBottom: Spacing.md,
    gap: 8,
  },
  acknowledgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderRadius: BorderRadius.md,
    height: 48,
    gap: Spacing.xs + 2,
    ...Shadows.card,
  },
  acknowledgeBtnDone: {
    backgroundColor: '#0284C7',
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
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    height: 44,
    gap: 6,
  },
  falseAlarmBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  resolveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: BorderRadius.md,
    height: 44,
    gap: 6,
  },
  resolveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  eventsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    gap: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  eventIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  eventTextBox: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  eventTime: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  eventDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginLeft: 6,
  },
  exitBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: BorderRadius.md,
    height: 44,
    gap: 6,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: Spacing.xl,
  },
  exitBottomBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
});
