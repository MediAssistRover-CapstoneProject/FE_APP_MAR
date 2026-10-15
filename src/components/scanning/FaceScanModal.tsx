import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { X, Check, User } from 'lucide-react-native';
import { Colors, Spacing } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const OVAL_W = SCREEN_W * 0.58;
const OVAL_H = OVAL_W * 1.25;
const FRAME_SIZE = SCREEN_W * 0.62;

interface FaceScanModalProps {
  visible: boolean;
  receiverName: string;
  onClose: () => void;
  onConfirm: () => void;
}

type ScanPhase = 'prepare' | 'scanning' | 'success';

export const FaceScanModal: React.FC<FaceScanModalProps> = ({
  visible,
  receiverName,
  onClose,
  onConfirm,
}) => {
  const [phase, setPhase] = useState<ScanPhase>('prepare');

  // Corner scan animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  // Pulse ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setPhase('prepare');
    }
  }, [visible]);

  // Scanning corner animation
  useEffect(() => {
    if (phase === 'scanning') {
      // Pulse animation
      const pulsing = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulsing.start();

      // Corner scan glow
      const cornerAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 600, useNativeDriver: false }),
          Animated.timing(scanAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
        ])
      );
      cornerAnim.start();

      // Giả lập nhận dạng thành công sau 2.5 giây
      const timer = setTimeout(() => {
        pulsing.stop();
        cornerAnim.stop();
        setPhase('success');
      }, 2500);

      return () => {
        clearTimeout(timer);
        pulsing.stop();
        cornerAnim.stop();
      };
    }
  }, [phase]);

  const borderColor = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#10B981', '#34D399'],
  });

  const handleCapture = () => {
    setPhase('scanning');
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabel}>NGƯỜI NHẬN XÁC NHẬN</Text>
            <Text style={styles.headerName}>{receiverName || 'BS. Trần Thị Lan'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* ===== PHASE 1: PREPARE ===== */}
          {phase === 'prepare' && (
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>Chuẩn bị chụp ảnh</Text>
              <Text style={styles.phaseSubtitle}>
                Scan khuôn mặt của bạn để xác minh nhận hàng
              </Text>

              {/* Face oval silhouette */}
              <View style={styles.ovalWrapper}>
                <View style={styles.oval}>
                  <View style={styles.silhouetteContainer}>
                    <User size={100} color="rgba(255,255,255,0.3)" strokeWidth={1.2} />
                  </View>
                  {/* Corner indicators */}
                  <View style={[styles.ovalCorner, styles.ovalCornerTL]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerTR]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerBL]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerBR]} />
                </View>
              </View>

              <Text style={styles.ovalHint}>
                Đưa khuôn mặt vào vùng sáng, nhìn thẳng vào camera
              </Text>

              {/* Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.captureBtn}
                  onPress={handleCapture}
                  activeOpacity={0.8}
                >
                  <Text style={styles.captureBtnText}>Chụp ảnh</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ===== PHASE 2: SCANNING ===== */}
          {phase === 'scanning' && (
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>Đang nhận dạng...</Text>
              <Text style={styles.phaseSubtitle}>Giữ yên khuôn mặt trong khung</Text>

              {/* Animated scan frame */}
              <View style={styles.scanFrameWrapper}>
                <Animated.View
                  style={[
                    styles.scanFrame,
                    {
                      borderColor,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  {/* Scan corner highlights */}
                  <View style={[styles.scanCorner, styles.scanCornerTL]} />
                  <View style={[styles.scanCorner, styles.scanCornerTR]} />
                  <View style={[styles.scanCorner, styles.scanCornerBL]} />
                  <View style={[styles.scanCorner, styles.scanCornerBR]} />

                  {/* Center dots loading */}
                  <View style={styles.scanningDots}>
                    <LoadingDots />
                  </View>
                </Animated.View>
              </View>

              <Text style={styles.scanningText}>Đang xử lý nhận dạng khuôn mặt...</Text>
            </View>
          )}

          {/* ===== PHASE 3: SUCCESS ===== */}
          {phase === 'success' && (
            <View style={styles.phaseContainer}>
              <Text style={[styles.phaseTitle, { color: '#10B981' }]}>
                Đã nhận dạng thành công!
              </Text>

              {/* Success Frame */}
              <View style={styles.successFrameWrapper}>
                <View style={styles.successFrame}>
                  {/* Corner indicators xanh */}
                  <View style={[styles.successCorner, styles.successCornerTL]} />
                  <View style={[styles.successCorner, styles.successCornerTR]} />
                  <View style={[styles.successCorner, styles.successCornerBL]} />
                  <View style={[styles.successCorner, styles.successCornerBR]} />

                  {/* Checkmark center */}
                  <View style={styles.successCheckCircle}>
                    <Check size={40} color="#10B981" strokeWidth={3} />
                  </View>
                </View>
              </View>

              {/* Person info card */}
              <View style={styles.personCard}>
                <View style={styles.personAvatarCircle}>
                  <User size={20} color={Colors.primary} />
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{receiverName || 'BS. Trần Thị Lan'}</Text>
                  <Text style={styles.personRole}>Bác sĩ điều trị · P. Tim mạch</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Check size={12} color="#10B981" strokeWidth={3} />
                  <Text style={styles.verifiedText}>Đã xác minh</Text>
                </View>
              </View>

              {/* Confirm button */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Xác nhận đúng người  ▶</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPhase('prepare')}
                style={styles.retryLink}
                activeOpacity={0.7}
              >
                <Text style={styles.retryLinkText}>Chụp lại</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

// Loading dots animation component
const LoadingDots: React.FC = () => {
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 200);
    const a3 = animate(dot3, 400);
    a1.start();
    a2.start();
    a3.start();
    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[dot1, dot2, dot3].map((dot, i) => (
        <Animated.View
          key={i}
          style={[styles.dot, { opacity: dot }]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1628',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerInfo: { flex: 1 },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  phaseTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  phaseSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },

  // Face Oval (Phase 1)
  ovalWrapper: {
    marginBottom: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    position: 'relative',
  },
  silhouetteContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    paddingBottom: 12,
  },
  ovalCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#10B981',
    borderWidth: 2.5,
  },
  ovalCornerTL: { top: 24, left: 24, borderRightWidth: 0, borderBottomWidth: 0 },
  ovalCornerTR: { top: 24, right: 24, borderLeftWidth: 0, borderBottomWidth: 0 },
  ovalCornerBL: { bottom: 24, left: 24, borderRightWidth: 0, borderTopWidth: 0 },
  ovalCornerBR: { bottom: 24, right: 24, borderLeftWidth: 0, borderTopWidth: 0 },
  ovalHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 20,
  },

  // Buttons (Phase 1)
  btnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: 'rgba(255,255,255,0.7)' },
  captureBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },

  // Scan Frame (Phase 2)
  scanFrameWrapper: { marginBottom: 28 },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 20,
    borderWidth: 3,
    backgroundColor: 'rgba(16,185,129,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#10B981',
    borderWidth: 3,
  },
  scanCornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  scanCornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  scanCornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  scanCornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  scanningDots: { alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  scanningText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Success (Phase 3)
  successFrameWrapper: { marginBottom: 24 },
  successFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE * 0.8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  successCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#34D399',
    borderWidth: 3,
  },
  successCornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  successCornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  successCornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  successCornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  successCheckCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 2,
    borderColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    gap: 12,
  },
  personAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(59,130,246,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: { flex: 1 },
  personName: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  personRole: { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  confirmBtn: {
    width: '100%',
    height: 52,
    borderRadius: 14,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  retryLink: { paddingVertical: 8 },
  retryLinkText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
});
