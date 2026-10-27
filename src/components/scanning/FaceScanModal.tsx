import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { X, Check, User, Camera, FlipHorizontal } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const OVAL_W = SCREEN_W * 0.62;
const OVAL_H = OVAL_W * 1.3;

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
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  // Corner scan animation
  const scanAnim = useRef(new Animated.Value(0)).current;
  // Pulse ring
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      setPhase('prepare');
      if (!permission?.granted) {
        requestPermission();
      }
    }
  }, [visible, permission?.granted, requestPermission]);

  // Scanning corner animation
  useEffect(() => {
    if (phase === 'scanning') {
      // Pulse animation
      const pulsing = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulsing.start();

      // Corner scan glow
      const cornerAnim = Animated.loop(
        Animated.sequence([
          Animated.timing(scanAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
          Animated.timing(scanAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
        ])
      );
      cornerAnim.start();

      // Giả lập nhận dạng AI thành công sau 2.2 giây
      const timer = setTimeout(() => {
        pulsing.stop();
        cornerAnim.stop();
        setPhase('success');
      }, 2200);

      return () => {
        clearTimeout(timer);
        pulsing.stop();
        cornerAnim.stop();
      };
    }
  }, [phase, pulseAnim, scanAnim]);

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

  const toggleFacing = () => {
    setFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabel}>XÁC NHẬN KHUÔN MẶT BẰNG CAMERA THẬT</Text>
            <Text style={styles.headerName}>{receiverName || 'Nhân viên nhận hàng'}</Text>
          </View>
          <View style={styles.headerActions}>
            {permission?.granted && phase !== 'success' && (
              <TouchableOpacity onPress={toggleFacing} style={styles.flipBtn} activeOpacity={0.7}>
                <FlipHorizontal size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {/* ===== PHASE 1: PREPARE ===== */}
          {phase === 'prepare' && (
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>Scan khuôn mặt trực tiếp</Text>
              <Text style={styles.phaseSubtitle}>
                Camera trước đang hoạt động. Căn chỉnh khuôn mặt vào trong khung oval.
              </Text>

              {/* Face oval silhouette & Live Camera */}
              <View style={styles.ovalWrapper}>
                <View style={styles.oval}>
                  {permission?.granted ? (
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing={facing}
                    />
                  ) : (
                    <View style={styles.silhouetteContainer}>
                      <User size={90} color="rgba(255,255,255,0.4)" strokeWidth={1.2} />
                      <TouchableOpacity
                        style={styles.permissionBtn}
                        onPress={requestPermission}
                        activeOpacity={0.8}
                      >
                        <Camera size={14} color="#FFFFFF" />
                        <Text style={styles.permissionBtnText}>Bật quyền Camera</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Corner indicators */}
                  <View style={[styles.ovalCorner, styles.ovalCornerTL]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerTR]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerBL]} />
                  <View style={[styles.ovalCorner, styles.ovalCornerBR]} />
                </View>
              </View>

              <Text style={styles.ovalHint}>
                {facing === 'front' ? 'Camera trước: Nhìn thẳng' : 'Camera sau đang bật'} · Đảm bảo đủ ánh sáng
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
                  <Camera size={18} color="#FFFFFF" />
                  <Text style={styles.captureBtnText}>Quét khuôn mặt</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ===== PHASE 2: SCANNING ===== */}
          {phase === 'scanning' && (
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>Đang nhận diện AI...</Text>
              <Text style={styles.phaseSubtitle}>Giữ yên khuôn mặt trong khung camera</Text>

              {/* Animated scan frame with live camera */}
              <View style={styles.ovalWrapper}>
                <Animated.View
                  style={[
                    styles.oval,
                    {
                      borderColor,
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  {permission?.granted && (
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing={facing}
                    />
                  )}

                  {/* Scan corner highlights */}
                  <View style={[styles.scanCorner, styles.scanCornerTL]} />
                  <View style={[styles.scanCorner, styles.scanCornerTR]} />
                  <View style={[styles.scanCorner, styles.scanCornerBL]} />
                  <View style={[styles.scanCorner, styles.scanCornerBR]} />

                  {/* Center dots loading */}
                  <View style={styles.scanningDots}>
                    <ActivityIndicator size="large" color="#10B981" />
                  </View>
                </Animated.View>
              </View>

              <Text style={styles.scanningText}>Hệ thống AI đang so khớp dữ liệu...</Text>
            </View>
          )}

          {/* ===== PHASE 3: SUCCESS ===== */}
          {phase === 'success' && (
            <View style={styles.phaseContainer}>
              <Text style={[styles.phaseTitle, { color: '#10B981' }]}>
                Xác thực khuôn mặt thành công!
              </Text>

              {/* Success Frame */}
              <View style={styles.successFrameWrapper}>
                <View style={styles.successFrame}>
                  <View style={[styles.successCorner, styles.successCornerTL]} />
                  <View style={[styles.successCorner, styles.successCornerTR]} />
                  <View style={[styles.successCorner, styles.successCornerBL]} />
                  <View style={[styles.successCorner, styles.successCornerBR]} />

                  <View style={styles.successCheckCircle}>
                    <Check size={42} color="#10B981" strokeWidth={3} />
                  </View>
                </View>
              </View>

              {/* Person info card */}
              <View style={styles.personCard}>
                <View style={styles.personAvatarCircle}>
                  <User size={22} color={Colors.primary} />
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{receiverName || 'BS. Trần Thị Lan'}</Text>
                  <Text style={styles.personRole}>Nhân viên y tế được cấp quyền nhận bàn giao</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Check size={12} color="#10B981" strokeWidth={3} />
                  <Text style={styles.verifiedText}>Đã khớp</Text>
                </View>
              </View>

              {/* Confirm button */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Hoàn tất xác minh khuôn mặt</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setPhase('prepare')}
                style={styles.retryLink}
                activeOpacity={0.7}
              >
                <Text style={styles.retryLinkText}>Quét lại</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  headerInfo: { flex: 1 },
  headerLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flipBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  phaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  phaseTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  phaseSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
    maxWidth: 300,
  },
  ovalWrapper: {
    marginBottom: 20,
  },
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2.5,
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  silhouetteContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  permissionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  ovalCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#38BDF8',
  },
  ovalCornerTL: { top: 12, left: 16, borderTopWidth: 3, borderLeftWidth: 3 },
  ovalCornerTR: { top: 12, right: 16, borderTopWidth: 3, borderRightWidth: 3 },
  ovalCornerBL: { bottom: 12, left: 16, borderBottomWidth: 3, borderLeftWidth: 3 },
  ovalCornerBR: { bottom: 12, right: 16, borderBottomWidth: 3, borderRightWidth: 3 },
  ovalHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 24,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 320,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  captureBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  captureBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#10B981',
  },
  scanCornerTL: { top: 10, left: 14, borderTopWidth: 3.5, borderLeftWidth: 3.5 },
  scanCornerTR: { top: 10, right: 14, borderTopWidth: 3.5, borderRightWidth: 3.5 },
  scanCornerBL: { bottom: 10, left: 14, borderBottomWidth: 3.5, borderLeftWidth: 3.5 },
  scanCornerBR: { bottom: 10, right: 14, borderBottomWidth: 3.5, borderRightWidth: 3.5 },
  scanningDots: {
    position: 'absolute',
  },
  scanningText: {
    fontSize: 13,
    color: '#34D399',
    fontWeight: '600',
  },
  successFrameWrapper: {
    marginBottom: 20,
  },
  successFrame: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  successCorner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: '#10B981',
  },
  successCornerTL: { top: 6, left: 6, borderTopWidth: 3, borderLeftWidth: 3 },
  successCornerTR: { top: 6, right: 6, borderTopWidth: 3, borderRightWidth: 3 },
  successCornerBL: { bottom: 6, left: 6, borderBottomWidth: 3, borderLeftWidth: 3 },
  successCornerBR: { bottom: 6, right: 6, borderBottomWidth: 3, borderRightWidth: 3 },
  successCheckCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.md,
    padding: 12,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
    gap: 10,
  },
  personAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: { flex: 1 },
  personName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  personRole: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  confirmBtn: {
    width: '100%',
    maxWidth: 320,
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  retryLink: {
    padding: 8,
  },
  retryLinkText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
});
