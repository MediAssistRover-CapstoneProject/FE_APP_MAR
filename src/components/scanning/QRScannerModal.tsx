import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import {
  CameraOff,
  ScanLine,
  ShieldCheck,
  X,
  QrCode,
  RefreshCw,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Clock,
  Truck,
  ArrowLeft,
  Zap,
} from 'lucide-react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import { deliveryApi, type AuthVerificationPurpose, type StaffPhoneQrResponse } from '../../api/modules/delivery.api';

interface QRScannerModalProps {
  jobId: string;
  jobCode: string;
  purpose: AuthVerificationPurpose;
  onClose: () => void;
  onVerify?: (raw: string) => Promise<void>;
  initialTab?: 'show_qr' | 'scan_camera';
}

type ModalTab = 'show_qr' | 'scan_camera';
type ScanCameraState = 'scanning' | 'verifying' | 'verified' | 'error';

export const QRScannerModal = ({
  jobId,
  jobCode,
  purpose,
  onClose,
  onVerify,
  initialTab = 'show_qr',
}: QRScannerModalProps) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);

  // ===== TAB 1: HIỆN MÃ QR TRÊN ĐIỆN THOẠI ĐỂ ROBOT QUÉT =====
  const [qrLoading, setQrLoading] = useState(false);
  const [qrData, setQrData] = useState<StaffPhoneQrResponse | null>(null);
  const [qrError, setQrError] = useState('');
  const [isWaitingForRobot, setIsWaitingForRobot] = useState(false);
  const [forceQuickQr, setForceQuickQr] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  const quickQrPayload = `MAR_JOB:${jobId}|${purpose}|${jobCode || jobId.slice(0, 8)}`;

  // ===== TAB 2: QUÉT MÃ TỪ ROBOT (DỰ PHÒNG) =====
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanCameraState>('scanning');
  const [cameraError, setCameraError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);

  const phaseLabel = purpose === 'DELIVERY_SENDER' ? 'Lấy hàng tại Điểm A' : 'Giao hàng tại Điểm B';

  // Tải mã QR từ server (POST /api/v1/jobs/{jobId}/staff-phone-qr)
  const fetchStaffPhoneQr = useCallback(async (isSilentPoll = false) => {
    if (!jobId) {
      setQrError('Chưa có mã nhiệm vụ (Job ID) hợp lệ.');
      return;
    }
    if (!isSilentPoll) {
      setQrLoading(true);
      setQrError('');
    }
    try {
      const res = await deliveryApi.issueStaffPhoneQr(jobId);
      if (!mounted.current) return;
      if (!res?.rows || !Array.isArray(res.rows) || res.rows.length === 0) {
        throw new Error('Máy chủ chưa thể tạo ma trận mã QR cho nhiệm vụ này.');
      }
      setQrData(res);
      setQrError('');
      setIsWaitingForRobot(false);
      const expiresAtMs = Date.parse(res.expiresAt);
      if (Number.isFinite(expiresAtMs)) {
        const diff = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
        setSecondsRemaining(diff);
      }
    } catch (err: any) {
      if (!mounted.current) return;
      const rawMsg = String(err?.message || '');
      const isAuthStepError =
        rawMsg.includes('AUTHENTICATE') ||
        rawMsg.includes('schema 3') ||
        err?.status === 400 ||
        err?.status === 422;

      if (isAuthStepError) {
        setIsWaitingForRobot(true);
        setQrError(
          'Robot chưa tới bước quét mã xác thực.\n\n' +
          'Theo quy trình chuẩn, Robot phải hoàn thành việc di chuyển đến vị trí (Điểm lấy hàng A) trước khi hệ thống cấp mã QR mở khóa Servo.\n\n' +
          'Vui lòng chờ Robot di chuyển tới nơi. Hệ thống sẽ tự động cập nhật khi Robot sẵn sàng.'
        );
      } else {
        setIsWaitingForRobot(false);
        setQrError(rawMsg || 'Chưa thể tạo mã QR. Hãy đảm bảo robot đang ở bước xác thực.');
      }
    } finally {
      if (mounted.current && !isSilentPoll) setQrLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    mounted.current = true;
    if (activeTab === 'show_qr') {
      void fetchStaffPhoneQr();
    }
    return () => {
      mounted.current = false;
    };
  }, [activeTab, fetchStaffPhoneQr]);

  // Tự động kiểm tra lại khi Robot đang trên đường di chuyển (poll mỗi 3.5s)
  useEffect(() => {
    if (!isWaitingForRobot || activeTab !== 'show_qr' || qrData) return;
    const pollTimer = setInterval(() => {
      void fetchStaffPhoneQr(true);
    }, 3500);
    return () => clearInterval(pollTimer);
  }, [isWaitingForRobot, activeTab, qrData, fetchStaffPhoneQr]);

  // Bộ đếm ngược thời gian hết hạn của mã QR
  useEffect(() => {
    if (secondsRemaining === null || secondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Xử lý quét mã camera dự phòng
  const handleCameraScan = async ({ data }: BarcodeScanningResult) => {
    if (locked.current || !onVerify) return;
    locked.current = true;
    setScanState('verifying');
    try {
      await onVerify(data);
      if (mounted.current) setScanState('verified');
    } catch (err: any) {
      if (!mounted.current) return;
      setCameraError(err?.message || 'Không thể xác thực mã QR giao nhận.');
      setScanState('error');
    }
  };

  const qrMatrixSize = qrData?.rows?.length || 0;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header với nút Quay Lại bên trái (không bị nút bánh răng Expo che) */}
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={onClose}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={Colors.textPrimary} />
            <Text style={styles.backButtonText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Xác thực mã QR với Robot</Text>
            <Text style={styles.subtitle}>{jobCode || jobId.slice(0, 8)} · {phaseLabel}</Text>
          </View>
        </View>

        {/* Thanh chuyển Tab */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'show_qr' && styles.tabButtonActive]}
            onPress={() => setActiveTab('show_qr')}
            activeOpacity={0.8}
          >
            <QrCode size={18} color={activeTab === 'show_qr' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.tabButtonText, activeTab === 'show_qr' && styles.tabButtonTextActive]}>
              Robot quét mã QR của bạn
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'scan_camera' && styles.tabButtonActive]}
            onPress={() => setActiveTab('scan_camera')}
            activeOpacity={0.8}
          >
            <ScanLine size={18} color={activeTab === 'scan_camera' ? Colors.primary : Colors.textSecondary} />
            <Text style={[styles.tabButtonText, activeTab === 'scan_camera' && styles.tabButtonTextActive]}>
              Quét mã từ robot
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* ==================================================== */}
          {/* TAB 1: HIỆN MÃ QR TRÊN ĐIỆN THOẠI ĐỂ ROBOT QUÉT (CHÍNH) */}
          {/* ==================================================== */}
          {activeTab === 'show_qr' && (
            <View style={styles.qrDisplayCard}>
              <View style={styles.instructionBanner}>
                <Smartphone size={20} color={Colors.primary} />
                <View style={styles.flex}>
                  <Text style={styles.instructionTitle}>Đưa màn hình trước Camera của Robot</Text>
                  <Text style={styles.instructionDesc}>
                    Camera của Robot sẽ quét mã QR hiển thị dưới đây để tự động mở khóa Servo ngăn tủ chứa hàng.
                  </Text>
                </View>
              </View>

              {qrLoading ? (
                <View style={styles.qrLoadingBox}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.hint}>Đang nạp mã QR xác thực từ máy chủ…</Text>
                </View>
              ) : forceQuickQr ? (
                <View style={styles.qrVisualContainer}>
                  {/* Chế độ mã QR nhanh để robot quét ngay */}
                  <View style={styles.quickQrBadge}>
                    <Zap size={16} color="#B45309" />
                    <Text style={styles.quickQrBadgeText}>MÃ QR NHANH CHO ROBOT QUÉT NGAY</Text>
                  </View>

                  <View style={styles.svgQrWrapper}>
                    <QRCode
                      value={quickQrPayload}
                      size={230}
                      color="#000000"
                      backgroundColor="#FFFFFF"
                    />
                  </View>

                  <View style={styles.quickQrInfoBox}>
                    <Text style={styles.quickQrJobCode}>
                      Nhiệm vụ: {jobCode || jobId.slice(0, 16)}
                    </Text>
                    <Text style={styles.quickQrPhase}>
                      Chặng: {purpose === 'DELIVERY_SENDER' ? 'Lấy hàng (Điểm A)' : 'Giao hàng (Điểm B)'}
                    </Text>
                  </View>

                  <Text style={styles.qrNote}>
                    Đưa màn hình trước Camera của Robot. Robot sẽ quét mã để nhận diện nhiệm vụ và mở Servo.
                  </Text>

                  <TouchableOpacity
                    style={styles.switchModeButton}
                    onPress={() => {
                      setForceQuickQr(false);
                      void fetchStaffPhoneQr(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={15} color={Colors.primary} />
                    <Text style={styles.switchModeButtonText}>Kiểm tra lại xác thực từ máy chủ</Text>
                  </TouchableOpacity>
                </View>
              ) : qrError ? (
                <View style={[styles.errorBox, isWaitingForRobot && styles.waitingBox]}>
                  {isWaitingForRobot ? (
                    <Clock size={36} color="#D97706" />
                  ) : (
                    <AlertCircle size={32} color="#DC2626" />
                  )}
                  <Text style={[styles.errorTitle, isWaitingForRobot && styles.waitingTitle]}>
                    {isWaitingForRobot ? 'Robot chưa tới vị trí quét mã' : 'Chưa thể tạo mã QR'}
                  </Text>
                  <Text style={styles.errorText}>{qrError}</Text>

                  {/* Nút bật mã QR ngay lập tức cho robot quét */}
                  <TouchableOpacity
                    style={styles.forceQuickQrButton}
                    onPress={() => setForceQuickQr(true)}
                    activeOpacity={0.8}
                  >
                    <Zap size={18} color="#FFFFFF" />
                    <Text style={styles.forceQuickQrButtonText}>⚡ BẬT MÃ QR ĐỂ ROBOT QUÉT NGAY</Text>
                  </TouchableOpacity>

                  {isWaitingForRobot && (
                    <View style={styles.autoPollingBadge}>
                      <ActivityIndicator size="small" color="#D97706" />
                      <Text style={styles.autoPollingText}>Đang tự động kiểm tra khi Robot đến...</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.retryButton, isWaitingForRobot && styles.waitingRetryButton]}
                    onPress={() => fetchStaffPhoneQr(false)}
                  >
                    <RefreshCw size={16} color="#fff" />
                    <Text style={styles.retryButtonText}>
                      {isWaitingForRobot ? 'Kiểm tra máy chủ ngay' : 'Thử lại'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : qrData && qrMatrixSize > 0 ? (
                <View style={styles.qrVisualContainer}>
                  {/* Khung vẽ ma trận SVG QR chính xác từ Server */}
                  <View style={styles.svgQrWrapper}>
                    <Svg width={250} height={250} viewBox={`0 0 ${qrMatrixSize} ${qrMatrixSize}`}>
                      <Rect width={qrMatrixSize} height={qrMatrixSize} fill="#FFFFFF" />
                      {qrData.rows.map((row, y) =>
                        row.split('').map((val, x) =>
                          val === '1' ? (
                            <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="#000000" />
                          ) : null
                        )
                      )}
                    </Svg>
                  </View>

                  {/* Đồng hồ đếm ngược */}
                  {secondsRemaining !== null && (
                    <View style={[styles.timerBadge, secondsRemaining === 0 && styles.timerBadgeExpired]}>
                      {secondsRemaining > 0 ? (
                        <Text style={styles.timerText}>
                          Mã có hiệu lực trong: <Text style={styles.timerBold}>{secondsRemaining}s</Text>
                        </Text>
                      ) : (
                        <Text style={styles.timerExpiredText}>Mã QR đã hết hạn</Text>
                      )}
                    </View>
                  )}

                  {/* Nút làm mới mã QR */}
                  <TouchableOpacity style={styles.refreshButton} onPress={() => fetchStaffPhoneQr(false)} activeOpacity={0.8}>
                    <RefreshCw size={16} color={Colors.primary} />
                    <Text style={styles.refreshButtonText}>Làm mới mã QR</Text>
                  </TouchableOpacity>

                  <Text style={styles.qrNote}>
                    Sau khi Robot quét thành công và mở khóa Servo, quay lại màn hình nhiệm vụ để xác nhận đặt/lấy hàng.
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          {/* ==================================================== */}
          {/* TAB 2: QUÉT MÃ TỪ ROBOT (CAMERA SCANNER DỰ PHÒNG) */}
          {/* ==================================================== */}
          {activeTab === 'scan_camera' && (
            <View style={styles.cameraCard}>
              {scanState === 'scanning' && permission?.granted ? (
                <>
                  <View style={styles.cameraBox}>
                    <CameraView
                      style={StyleSheet.absoluteFill}
                      facing="back"
                      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                      onBarcodeScanned={handleCameraScan}
                    />
                    <View pointerEvents="none" style={styles.frame}>
                      <ScanLine size={36} color="#FFFFFF" />
                    </View>
                  </View>
                  <Text style={styles.hint}>Đưa camera điện thoại hướng vào mã QR hiển thị trên màn hình Robot.</Text>
                </>
              ) : (
                <View style={styles.message}>
                  {scanState === 'scanning' && (
                    <>
                      <CameraOff size={36} color={Colors.textSecondary} />
                      <Text style={styles.hint}>Cần quyền camera để quét mã QR trên màn hình robot.</Text>
                      {permission?.canAskAgain !== false ? (
                        <TouchableOpacity style={styles.button} onPress={() => { void requestPermission(); }}>
                          <Text style={styles.buttonText}>Cấp quyền camera</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.hint}>Mở cài đặt của ứng dụng để cấp quyền camera.</Text>
                      )}
                    </>
                  )}
                  {scanState === 'verifying' && (
                    <>
                      <ActivityIndicator size="large" color={Colors.primary} />
                      <Text style={styles.hint}>Đang xác thực mã QR với máy chủ…</Text>
                    </>
                  )}
                  {scanState === 'verified' && (
                    <>
                      <ShieldCheck size={40} color={Colors.primary} />
                      <Text style={styles.title}>Đã xác thực mã QR</Text>
                      <Text style={styles.hint}>Robot đã nhận diện thành công. Ngăn tủ đang được mở khóa.</Text>
                      <TouchableOpacity style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>Về màn hình nhiệm vụ</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {scanState === 'error' && (
                    <>
                      <AlertCircle size={36} color="#DC2626" />
                      <Text style={styles.error}>{cameraError}</Text>
                      <TouchableOpacity
                        style={styles.button}
                        onPress={() => {
                          locked.current = false;
                          setScanState('scanning');
                        }}
                      >
                        <Text style={styles.buttonText}>Quét lại</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Nút Quay Lại Cố Định Ở Đáy Modal */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.footerBackButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color="#FFFFFF" />
            <Text style={styles.footerBackButtonText}>QUAY LẠI MÀN HÌNH NHIỆM VỤ</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.md, marginBottom: Spacing.md },
  headerText: { flex: 1 },
  title: { ...Typography.h2, fontSize: 18, color: Colors.textPrimary },
  subtitle: { marginTop: 3, fontSize: 13, color: Colors.textSecondary },
  close: { padding: Spacing.sm },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 32 },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.md,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
  },
  tabButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabButtonTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // QR Display Tab
  qrDisplayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    gap: Spacing.md,
    alignItems: 'center',
  },
  instructionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: '#E6F4F0',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    width: '100%',
  },
  instructionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
  },
  instructionDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: '#047857',
    marginTop: 2,
  },
  qrVisualContainer: {
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 8,
  },
  svgQrWrapper: {
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  timerBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  timerBadgeExpired: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 13,
    color: '#0369A1',
  },
  timerBold: {
    fontWeight: '800',
    color: Colors.primary,
  },
  timerExpiredText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  qrNote: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  qrLoadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  errorBox: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  waitingBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 24,
    marginVertical: 8,
  },
  waitingTitle: {
    color: '#D97706',
  },
  autoPollingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  autoPollingText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  waitingRetryButton: {
    backgroundColor: '#D97706',
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginTop: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // Camera Tab
  cameraCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cameraBox: {
    height: 320,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: 215,
    height: 215,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  message: { alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  hint: { color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },
  button: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#B91C1C', textAlign: 'center' },

  // Nút Quay Lại & Header
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },

  // Footer Quay lại đáy màn hình
  footer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: Colors.background,
  },
  footerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
  },
  footerBackButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },

  // Chế độ Mã QR Nhanh (Quick QR)
  forceQuickQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D97706',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    marginTop: 6,
    width: '100%',
  },
  forceQuickQrButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  quickQrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  quickQrBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  quickQrInfoBox: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  quickQrJobCode: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  quickQrPhase: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  switchModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  switchModeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
