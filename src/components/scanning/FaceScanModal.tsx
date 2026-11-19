import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
  Vibration,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import WebView from 'react-native-webview';
import {
  X,
  Check,
  User,
  Camera,
  RefreshCw,
  AlertCircle,
  Clock,
  ShieldCheck,
  WifiOff,
  ArrowRight,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '../../constants/theme';
import { dispatchApi } from '../../api/modules/dispatch.api';
import type { AuthVerificationPurpose, DeliveryResponse } from '../../api/modules/delivery.api';
import type { JobResponse } from '../../api/types';
import { QR_JOB_POLL_MS } from '../../api/pollingPolicy';
import { useAuthStore } from '../../store/useAuthStore';
import {
  evaluateFaceAuthRuntimeState,
  isAuthStepCompleted,
} from '../../screens/main/deliveryHandoff';
import { playWebSuccessChime, QR_SUCCESS_AUDIO_HTML } from './qrSuccessSound';

const FACE_VERIFIED_REDIRECT_DELAY_MS = 1200;

export interface FaceScanModalProps {
  visible: boolean;
  jobId: string;
  jobCode?: string;
  stepId?: string;
  purpose?: AuthVerificationPurpose;
  assignedAccountId?: string;
  personName?: string;
  receiverName?: string;
  jobSnapshot?: JobResponse | null;
  deliverySnapshot?: DeliveryResponse | null;
  onClose: () => void;
  onFaceVerified?: () => void;
  onRefreshJob?: (jobId: string) => Promise<void> | void;
}

export const FaceScanModal: React.FC<FaceScanModalProps> = ({
  visible,
  jobId,
  jobCode,
  stepId,
  purpose,
  assignedAccountId,
  personName,
  receiverName,
  jobSnapshot,
  deliverySnapshot,
  onClose,
  onFaceVerified,
  onRefreshJob,
}) => {
  const currentAccountId = useAuthStore((s) => s.user?.accountId);
  const [latestJob, setLatestJob] = useState<JobResponse | null>(jobSnapshot ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pollError, setPollError] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const mountedRef = useRef(true);
  const pollInFlightRef = useRef(false);
  const verifiedTriggeredRef = useRef(false);
  const audioPlayedRef = useRef(false);
  const audioWebViewLoadedRef = useRef(false);
  const redirectCompletedRef = useRef(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioWebViewRef = useRef<any>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const tickScaleAnim = useRef(new Animated.Value(0.45)).current;

  const clearRedirectTimer = useCallback(() => {
    if (redirectTimerRef.current) {
      clearTimeout(redirectTimerRef.current);
      redirectTimerRef.current = null;
    }
  }, []);

  const handleVerifiedRedirect = useCallback(() => {
    clearRedirectTimer();
    if (redirectCompletedRef.current) return;
    redirectCompletedRef.current = true;
    if (onFaceVerified) {
      onFaceVerified();
    } else {
      onClose();
    }
  }, [clearRedirectTimer, onFaceVerified, onClose]);

  const playChimeOnce = useCallback(() => {
    if (audioPlayedRef.current) return;
    if (Platform.OS === 'web') {
      audioPlayedRef.current = true;
      playWebSuccessChime();
      return;
    }
    try {
      Vibration.vibrate([0, 70, 60, 110]);
    } catch {
      // Bỏ qua nếu thiết bị không hỗ trợ rung
    }
    if (audioWebViewLoadedRef.current && audioWebViewRef.current) {
      audioPlayedRef.current = true;
      try {
        audioWebViewRef.current.injectJavaScript(
          'window.playQrSuccessChime && window.playQrSuccessChime(); true;'
        );
      } catch {
        // Bỏ qua lỗi inject WebView
      }
    }
  }, []);

  const triggerVerificationSuccess = useCallback(() => {
    if (!mountedRef.current || verifiedTriggeredRef.current) return;
    verifiedTriggeredRef.current = true;
    setIsVerified(true);
    setPollError('');
    playChimeOnce();

    tickScaleAnim.setValue(0.45);
    Animated.spring(tickScaleAnim, {
      toValue: 1,
      tension: 75,
      friction: 6,
      useNativeDriver: true,
    }).start();

    clearRedirectTimer();
    redirectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        handleVerifiedRedirect();
      }
    }, FACE_VERIFIED_REDIRECT_DELAY_MS);
  }, [playChimeOnce, tickScaleAnim, clearRedirectTimer, handleVerifiedRedirect]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearRedirectTimer();
    };
  }, [clearRedirectTimer]);

  // Reset trạng thái mỗi lần mở modal cho một bước hoặc nhiệm vụ mới
  useEffect(() => {
    if (!visible) {
      clearRedirectTimer();
      return;
    }
    verifiedTriggeredRef.current = false;
    audioPlayedRef.current = false;
    redirectCompletedRef.current = false;
    setIsVerified(false);
    setPollError('');
    setNowMs(Date.now());
    setLatestJob(jobSnapshot && jobSnapshot.jobId === jobId ? jobSnapshot : null);
  }, [visible, jobId, stepId, purpose, assignedAccountId, clearRedirectTimer]);

  // Đồng bộ snapshot mới nhất từ màn hình cha
  useEffect(() => {
    if (visible && jobSnapshot && jobSnapshot.jobId === jobId) {
      setLatestJob(jobSnapshot);
    }
  }, [visible, jobId, jobSnapshot]);

  const effectiveJob =
    latestJob && latestJob.jobId === jobId
      ? latestJob
      : jobSnapshot && jobSnapshot.jobId === jobId
      ? jobSnapshot
      : null;

  const runtimeState = evaluateFaceAuthRuntimeState({
    job: effectiveJob,
    delivery: deliverySnapshot,
    currentAccountId: assignedAccountId || currentAccountId,
    trackedAuthStepId: stepId,
    trackedPurpose: purpose,
    nowMs,
  });

  // Kiểm tra trạng thái AUTHENTICATE (FACE_VERIFICATION) trực tiếp từ dữ liệu BE
  useEffect(() => {
    if (!visible || isVerified) return;
    if (
      runtimeState.stage === 'VERIFIED' ||
      (stepId &&
        isAuthStepCompleted(
          effectiveJob,
          stepId,
          purpose,
          'FACE_VERIFICATION',
          assignedAccountId || runtimeState.expectedAccountId
        ))
    ) {
      triggerVerificationSuccess();
    }
  }, [
    visible,
    isVerified,
    runtimeState.stage,
    runtimeState.expectedAccountId,
    stepId,
    purpose,
    assignedAccountId,
    effectiveJob,
    triggerVerificationSuccess,
  ]);

  const fetchLatestJobState = useCallback(
    async (isManual = false) => {
      if (!visible || !jobId || pollInFlightRef.current) return;
      pollInFlightRef.current = true;
      if (isManual) setIsRefreshing(true);
      try {
        const freshJob = await dispatchApi.getJobDetail(jobId);
        if (!mountedRef.current) return;
        setLatestJob(freshJob);
        setPollError('');
        if (onRefreshJob) {
          void Promise.resolve(onRefreshJob(jobId)).catch(() => {});
        }
      } catch (err: any) {
        if (!mountedRef.current) return;
        const msg = err?.message || 'Không kết nối được máy chủ để kiểm tra xác thực khuôn mặt.';
        setPollError(msg);
      } finally {
        pollInFlightRef.current = false;
        if (mountedRef.current && isManual) setIsRefreshing(false);
      }
    },
    [visible, jobId, onRefreshJob]
  );

  // Poll trạng thái bước xác thực khuôn mặt từ BE mỗi 1.5s khi modal đang mở
  useEffect(() => {
    if (!visible || !jobId || isVerified) return;
    if (runtimeState.stage === 'EXPIRED' || runtimeState.stage === 'FAILED') return;

    void fetchLatestJobState(false);
    const timer = setInterval(() => {
      void fetchLatestJobState(false);
    }, QR_JOB_POLL_MS);

    return () => clearInterval(timer);
  }, [visible, jobId, isVerified, runtimeState.stage, fetchLatestJobState]);

  // Đồng hồ 1s cho bộ đếm ngược thời hạn cửa sổ quét khuôn mặt từ expiresAt BE
  useEffect(() => {
    if (!visible || isVerified) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visible, isVerified]);

  // Hiệu ứng nhấp nháy khung quét khi Robot đang chờ quét
  useEffect(() => {
    if (!visible || isVerified || runtimeState.stage !== 'AWAITING_CAMERA_SCAN') {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 750, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [visible, isVerified, runtimeState.stage, pulseAnim]);

  const targetPerson =
    personName ||
    runtimeState.expectedPersonName ||
    receiverName ||
    (purpose === 'DELIVERY_RECEIVER' ? 'Người nhận hàng' : 'Người gửi hàng');

  const stageLabel =
    purpose === 'DELIVERY_RECEIVER' || runtimeState.phase === 'receiver'
      ? 'ĐIỂM GIAO HÀNG (B) · NGƯỜI NHẬN'
      : 'ĐIỂM LẤY HÀNG (A) · NGƯỜI GỬI';

  const statusBadgeStyle = isVerified
    ? { bg: 'rgba(16,185,129,0.18)', border: '#10B981', text: '#34D399', label: 'ĐÃ XÁC THỰC (BE)' }
    : runtimeState.stage === 'MISMATCH'
    ? { bg: 'rgba(245,158,11,0.18)', border: '#F59E0B', text: '#FBBF24', label: 'KHÔNG KHỚP / THỬ LẠI' }
    : runtimeState.stage === 'EXPIRED' || runtimeState.stage === 'FAILED'
    ? { bg: 'rgba(239,68,68,0.18)', border: '#EF4444', text: '#F87171', label: 'HẾT HẠN / THẤT BẠI' }
    : runtimeState.stage === 'WAITING_OTHER_STAFF'
    ? { bg: 'rgba(14,91,126,0.55)', border: '#38BDF8', text: '#BAE6FD', label: 'CHỜ ĐÚNG NHÂN VIÊN' }
    : { bg: 'rgba(14,165,233,0.18)', border: '#38BDF8', text: '#7DD3FC', label: 'CHỜ CAMERA ROBOT QUÉT' };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {Platform.OS !== 'web' && visible && (
          <View style={styles.hiddenAudioBox} pointerEvents="none">
            <WebView
              ref={audioWebViewRef}
              source={{ html: QR_SUCCESS_AUDIO_HTML }}
              originWhitelist={['*']}
              javaScriptEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsInlineMediaPlayback
              onLoadEnd={() => {
                audioWebViewLoadedRef.current = true;
              }}
            />
          </View>
        )}

        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabel}>XÁC THỰC KHUÔN MẶT QUA CAMERA ROBOT</Text>
            <Text style={styles.headerName} numberOfLines={1}>
              {stageLabel} · {jobCode || jobId.slice(0, 8)}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <View style={[styles.statusPill, { backgroundColor: statusBadgeStyle.bg, borderColor: statusBadgeStyle.border }]}>
            <Text style={[styles.statusPillText, { color: statusBadgeStyle.text }]}>
              {statusBadgeStyle.label}
            </Text>
          </View>

          {isVerified ? (
            <View style={styles.phaseContainer}>
              <Text style={[styles.phaseTitle, { color: '#34D399' }]}>
                Máy chủ đã xác thực khuôn mặt!
              </Text>
              <Text style={styles.phaseSubtitle}>
                {purpose === 'DELIVERY_RECEIVER'
                  ? 'Quyền mở ngăn lấy hàng tại Điểm B đã được BE cấp. Đang chuyển về thao tác bàn giao...'
                  : 'Quyền mở ngăn đặt hàng tại Điểm A đã được BE cấp. Đang chuyển về thao tác bàn giao...'}
              </Text>

              <Animated.View
                style={[
                  styles.successFrame,
                  { transform: [{ scale: tickScaleAnim }] },
                ]}
              >
                <View style={styles.successCheckCircle}>
                  <Check size={44} color="#059669" strokeWidth={3} />
                </View>
              </Animated.View>

              <View style={styles.personCard}>
                <View style={[styles.personAvatarCircle, { backgroundColor: '#059669' }]}>
                  <ShieldCheck size={20} color="#FFFFFF" />
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{targetPerson}</Text>
                  <Text style={styles.personRole}>
                    BE xác nhận bước {purpose === 'DELIVERY_RECEIVER' ? 'DELIVERY_RECEIVER' : 'DELIVERY_SENDER'} thành công
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleVerifiedRedirect}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>Tiếp tục bước bàn giao hàng</Text>
                <ArrowRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.phaseContainer}>
              <Text style={styles.phaseTitle}>
                {runtimeState.title || 'Đang chờ Robot xác thực khuôn mặt'}
              </Text>
              <Text style={styles.phaseSubtitle}>
                {runtimeState.message}
              </Text>

              {/* Khung minh họa Camera Robot */}
              <Animated.View
                style={[
                  styles.robotCameraBox,
                  {
                    borderColor: statusBadgeStyle.border,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              >
                <View style={styles.robotCameraIconWrap}>
                  {runtimeState.stage === 'MISMATCH' || runtimeState.stage === 'EXPIRED' || runtimeState.stage === 'FAILED' ? (
                    <AlertCircle size={48} color={statusBadgeStyle.border} />
                  ) : (
                    <Camera size={48} color="#38BDF8" />
                  )}
                </View>
                <Text style={styles.robotCameraHintTitle}>
                  Camera Robot thực hiện nhận diện
                </Text>
                <Text style={styles.robotCameraHintSub}>
                  Ứng dụng chỉ nhận kết quả xác thực từ máy chủ BE, không mở camera điện thoại và không tự đổi sang QR.
                </Text>
              </Animated.View>

              {/* Thông tin người cần đứng trước camera */}
              <View style={styles.personCard}>
                <View style={styles.personAvatarCircle}>
                  <User size={20} color="#FFFFFF" />
                </View>
                <View style={styles.personInfo}>
                  <Text style={styles.personRole}>NHÂN VIÊN ĐƯỢC PHÂN CÔNG ĐỨNG TRƯỚC CAMERA</Text>
                  <Text style={styles.personName}>{targetPerson}</Text>
                  {assignedAccountId ? (
                    <Text style={styles.personAccountId}>
                      Account ID: {assignedAccountId.slice(0, 8)}...
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Đếm ngược thời hạn phiên xác thực nếu BE cấp */}
              {runtimeState.remainingSeconds !== null && (
                <View style={styles.timerRow}>
                  <Clock size={15} color="#7DD3FC" />
                  <Text style={styles.timerText}>
                    {runtimeState.remainingSeconds > 0
                      ? `Cửa sổ xác thực còn ${runtimeState.remainingSeconds}s (tối đa 120s)`
                      : 'Cửa sổ thời gian phiên quét đã hết'}
                  </Text>
                </View>
              )}

              {/* Lỗi mạng khi poll */}
              {!!pollError && (
                <View style={styles.networkErrorBox}>
                  <WifiOff size={16} color="#FCA5A5" />
                  <Text style={styles.networkErrorText}>
                    {pollError} Phương thức khuôn mặt được giữ nguyên (không tự chuyển sang QR).
                  </Text>
                </View>
              )}

              {/* Các nút điều khiển: chỉ làm mới từ BE hoặc đóng màn theo dõi */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>Đóng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.refreshBtn, isRefreshing && { opacity: 0.65 }]}
                  disabled={isRefreshing}
                  onPress={() => {
                    void fetchLatestJobState(true);
                  }}
                  activeOpacity={0.85}
                >
                  {isRefreshing ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <RefreshCw size={16} color="#FFFFFF" />
                      <Text style={styles.refreshBtnText}>
                        {pollError ? 'Thử kết nối lại' : 'Làm mới trạng thái BE'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.navigationDock,
  },
  hiddenAudioBox: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.heroSurface,
    borderBottomWidth: 1,
    borderBottomColor: '#164E63',
  },
  headerInfo: { flex: 1, paddingRight: 10 },
  headerLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7DD3FC',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.darkRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 24,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 16,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  phaseContainer: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  phaseTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  phaseSubtitle: {
    fontSize: 13,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  robotCameraBox: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    backgroundColor: Colors.heroSurface,
    padding: 20,
    alignItems: 'center',
    marginBottom: 18,
  },
  robotCameraIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(14, 91, 126, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  robotCameraHintTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  robotCameraHintSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
  },
  personCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.heroSurface,
    borderRadius: BorderRadius.md,
    padding: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.darkRaised,
    marginBottom: 14,
    gap: 10,
  },
  personAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInfo: { flex: 1 },
  personRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7DD3FC',
    marginBottom: 2,
  },
  personName: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  personAccountId: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7DD3FC',
  },
  networkErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: BorderRadius.md,
    padding: 12,
    width: '100%',
    marginBottom: 16,
  },
  networkErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#FECACA',
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 6,
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
    color: '#CBD5E1',
  },
  refreshBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  refreshBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successFrame: {
    width: 132,
    height: 132,
    borderRadius: 66,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: 'rgba(16,185,129,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successCheckCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: {
    flexDirection: 'row',
    width: '100%',
    height: 50,
    borderRadius: BorderRadius.md,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
