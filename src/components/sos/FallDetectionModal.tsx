import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
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
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const VIDEO_H = SCREEN_W * 0.58;

interface FallDetectionModalProps {
  visible: boolean;
  onClose: () => void;
  onAcknowledge?: () => void;
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
    title: 'Y tá Nguyễn Thị Minh đã nhận cảnh báo',
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
}) => {
  const [seconds, setSeconds] = useState(14);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    let interval: any;
    if (visible && !acknowledged) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [visible, acknowledged]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAcknowledge = () => {
    setAcknowledged(true);
    if (onAcknowledge) onAcknowledge();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== TOP BAR ===== */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatarCircle}>
              <Text style={{ fontSize: 16 }}>🤖</Text>
            </View>
            <View>
              <Text style={styles.brandText}>MEDIASSISTROVER · STAFF</Text>
              <Text style={styles.staffName}>Y tá Nguyễn Văn An</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#64748B" />
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
                <Text style={styles.drillTagText}>ĐANG DIỄN TẬP</Text>
              </View>
              <Text style={styles.urgentTitle}>Phát hiện người bị té ngã</Text>
              <Text style={styles.urgentSub}>Khu: 3B · Robot: R001 · 09:14</Text>
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
                <Text style={styles.aiHeaderText}>CAMERA AI · LIVE</Text>
              </View>
              <View style={styles.aiHeaderRight}>
                <View style={styles.greenDot} />
                <Text style={styles.aiStatusText}>Đang hoạt động</Text>
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
                <Text style={styles.recText}>09:41:26 · REC ●</Text>
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

          {/* ===== ACKNOWLEDGE BUTTON ===== */}
          <TouchableOpacity
            style={[styles.acknowledgeBtn, acknowledged && styles.acknowledgeBtnDone]}
            onPress={handleAcknowledge}
            disabled={acknowledged}
            activeOpacity={0.85}
          >
            {acknowledged ? (
              <>
                <Check size={20} color="#FFFFFF" strokeWidth={3} />
                <Text style={styles.acknowledgeBtnText}>Đã tiếp nhận cảnh báo</Text>
              </>
            ) : (
              <>
                <ShieldAlert size={20} color="#FFFFFF" />
                <Text style={styles.acknowledgeBtnText}>Xác nhận đã tiếp nhận cảnh báo</Text>
              </>
            )}
          </TouchableOpacity>

          {/* ===== EVENT TIMELINE (CHÙM SỰ KIỆN) ===== */}
          <Text style={styles.sectionTitle}>CHÙM SỰ KIỆN</Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: { fontSize: 9, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 },
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

  // Urgent Banner
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
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  drillDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FCA5A5',
  },
  drillTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  urgentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  urgentSub: {
    fontSize: 11,
    color: '#FECACA',
    marginTop: 2,
  },
  urgentTimerBox: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  urgentTimerText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  urgentTimerLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FCA5A5',
    letterSpacing: 0.5,
    marginTop: 1,
  },

  // AI Card
  aiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  aiHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  redDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' },
  aiHeaderText: { fontSize: 11, fontWeight: '800', color: '#0A2540', letterSpacing: 0.5 },
  aiHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  aiStatusText: { fontSize: 11, fontWeight: '700', color: '#10B981' },

  // Video box with bounding box
  videoBox: {
    width: '100%',
    height: VIDEO_H,
    backgroundColor: '#EFF6FF',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boundingBox: {
    width: '82%',
    height: '70%',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 8,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    letterSpacing: 0.5,
  },
  fallenPersonSilhouette: {
    flexDirection: 'row',
    alignItems: 'center',
    opacity: 0.35,
  },
  headSilhouette: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0284C7',
    marginRight: 6,
  },
  bodySilhouette: {
    width: 100,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0284C7',
  },
  recTag: {
    position: 'absolute',
    bottom: 8,
    right: 10,
  },
  recText: {
    fontSize: 9,
    color: '#64748B',
    fontWeight: '600',
  },

  // AI Metrics
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  metricCol: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0A2540',
  },
  metricDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#E2E8F0',
  },

  // Acknowledge button
  acknowledgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    height: 52,
    marginBottom: Spacing.lg,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acknowledgeBtnDone: {
    backgroundColor: '#059669',
  },
  acknowledgeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Events Timeline
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  eventsList: {
    gap: 8,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  eventIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTextBox: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A2540',
    lineHeight: 16,
  },
  eventTime: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
