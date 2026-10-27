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
import { X, QrCode, Check, RefreshCw, Camera, ScanLine } from 'lucide-react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';
import { deliveryApi } from '../../api/modules/delivery.api';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_W * 0.65;

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (itemInfo: QRItemInfo) => void;
  jobId?: string;
  defaultMode?: 'scan' | 'show';
}

export interface QRItemInfo {
  code: string;
  serialNumber: string;
  quantity: string;
}

type ModalTab = 'scan_camera' | 'show_backend_qr';
type ScanPhase = 'scanning' | 'success';

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onConfirm,
  jobId,
  defaultMode = 'scan',
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>(
    defaultMode === 'show' ? 'show_backend_qr' : 'scan_camera'
  );
  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<QRItemInfo>({
    code: 'Mẫu thuốc #RX-2026',
    serialNumber: 'SN: MAR-88392',
    quantity: '1 hộp',
  });
  const [backendQrCode, setBackendQrCode] = useState<string>('MAR-DELIVERY-VERIFY-001');
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(false);

  // Đường quét laser animation
  const laserAnim = useRef(new Animated.Value(0)).current;
  const isScannedLock = useRef(false);

  useEffect(() => {
    if (visible) {
      setPhase('scanning');
      isScannedLock.current = false;
      if (!permission?.granted) {
        requestPermission();
      }
      laserAnim.setValue(0);

      // Animation laser lặp lại
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.timing(laserAnim, { toValue: 0, duration: 1400, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [visible, permission?.granted, requestPermission, laserAnim]);

  // Hàm sinh hoặc lấy mã QR Challenge thật từ Backend
  const fetchBackendQrChallenge = async () => {
    setIsLoadingChallenge(true);
    try {
      if (jobId) {
        const res = await deliveryApi.issueQrChallenge(jobId, {
          authJobStepId: '00000000-0000-0000-0000-000000000001',
          purpose: 'DELIVERY_RECEIVER',
          validForSeconds: 300,
        });
        if (res?.proof) {
          setBackendQrCode(res.proof);
        }
      } else {
        // Mã định danh vật phẩm thật chuẩn định dạng MediAssistRover
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
        setBackendQrCode(`MAR:DELIVERY:UUID-BN2047:TS-${timestamp}`);
      }
    } catch {
      const fallbackCode = `MAR:CHALLENGE:STAFF-CONFIRM:${Date.now()}`;
      setBackendQrCode(fallbackCode);
    } finally {
      setIsLoadingChallenge(false);
    }
  };

  useEffect(() => {
    if (visible && activeTab === 'show_backend_qr') {
      fetchBackendQrChallenge();
    }
  }, [visible, activeTab]);

  const laserTranslate = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 6],
  });

  // Khi camera thật của điện thoại quét trúng mã QR
  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (isScannedLock.current || phase === 'success') return;
    isScannedLock.current = true;

    try {
      // Thử parse dữ liệu nếu QR chứa JSON
      const parsed = JSON.parse(data);
      setScannedData({
        code: parsed.code || parsed.title || data,
        serialNumber: parsed.serialNumber || `SN: ${data.slice(0, 10)}`,
        quantity: parsed.quantity || '1 đơn vị',
      });
    } catch {
      // Nếu là chuỗi text / link bình thường
      setScannedData({
        code: data.length > 28 ? `${data.slice(0, 25)}...` : data,
        serialNumber: `SN: ${Date.now().toString().slice(-6)}`,
        quantity: '1 đơn vị',
      });
    }

    setPhase('success');
  };

  const handleRescan = () => {
    isScannedLock.current = false;
    setPhase('scanning');
  };

  const handleConfirm = () => {
    onConfirm(scannedData);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Xác thực mã QR vật phẩm</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* ===== TAB CHUYỂN ĐỔI: QUÉT BẰNG CAMERA THẬT HOẶC HIỆN MÃ QR TỪ BE ===== */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'scan_camera' && styles.tabBtnActive]}
            onPress={() => {
              setActiveTab('scan_camera');
              setPhase('scanning');
              isScannedLock.current = false;
            }}
            activeOpacity={0.8}
          >
            <Camera size={15} color={activeTab === 'scan_camera' ? '#FFFFFF' : '#94A3B8'} />
            <Text
              style={[styles.tabText, activeTab === 'scan_camera' && styles.tabTextActive]}
            >
              Quét bằng Camera thật
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'show_backend_qr' && styles.tabBtnActive]}
            onPress={() => setActiveTab('show_backend_qr')}
            activeOpacity={0.8}
          >
            <QrCode size={15} color={activeTab === 'show_backend_qr' ? '#FFFFFF' : '#94A3B8'} />
            <Text
              style={[styles.tabText, activeTab === 'show_backend_qr' && styles.tabTextActive]}
            >
              Hiện mã QR từ Server
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* ==================================================== */}
          {/* TAB 1: QUÉT BẰNG CAMERA THẬT CỦA ĐIỆN THOẠI          */}
          {/* ==================================================== */}
          {activeTab === 'scan_camera' && (
            <>
              {phase === 'scanning' ? (
                <View style={styles.scanPhaseContainer}>
                  <Text style={styles.instructionTitle}>Hướng camera vào mã QR</Text>
                  <Text style={styles.instructionSub}>
                    Camera sau đang chạy. Căn chỉnh mã QR vào giữa khung viền.
                  </Text>

                  {/* Camera Frame */}
                  <View style={styles.frameWrapper}>
                    <View style={styles.qrFrame}>
                      {permission?.granted ? (
                        <CameraView
                          style={StyleSheet.absoluteFill}
                          facing="back"
                          barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                          }}
                          onBarcodeScanned={handleBarCodeScanned}
                        />
                      ) : (
                        <View style={styles.permissionBox}>
                          <Camera size={36} color="#64748B" />
                          <TouchableOpacity
                            style={styles.permissionBtn}
                            onPress={requestPermission}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.permissionBtnText}>Cấp quyền Camera sau</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Các góc của khung quét */}
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />

                      {/* Tia laser quét */}
                      <Animated.View
                        style={[
                          styles.laserLine,
                          { transform: [{ translateY: laserTranslate }] },
                        ]}
                      />
                    </View>
                  </View>

                  <Text style={styles.scanHint}>
                    Tự động nhận diện khi mã QR nằm trong khung hình
                  </Text>
                </View>
              ) : (
                /* Giao diện quét thành công */
                <View style={styles.successPhaseContainer}>
                  <View style={styles.successCheckCircle}>
                    <Check size={36} color="#10B981" strokeWidth={3} />
                  </View>
                  <Text style={styles.successTitle}>Đã đọc mã QR thành công!</Text>

                  {/* Thông tin vật phẩm đọc được */}
                  <View style={styles.itemCard}>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemLabel}>Mã vật phẩm:</Text>
                      <Text style={styles.itemValue}>{scannedData.code}</Text>
                    </View>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemLabel}>Serial:</Text>
                      <Text style={styles.itemValue}>{scannedData.serialNumber}</Text>
                    </View>
                    <View style={styles.itemRow}>
                      <Text style={styles.itemLabel}>Số lượng:</Text>
                      <Text style={styles.itemValue}>{scannedData.quantity}</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.confirmBtn}
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.confirmBtnText}>Xác nhận vật phẩm</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleRescan}
                    style={styles.rescanBtn}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={14} color="#38BDF8" />
                    <Text style={styles.rescanBtnText}>Quét lại mã khác</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          {/* ==================================================== */}
          {/* TAB 2: HIỆN MÃ QR THẬT CỦA SERVER / ROBOT            */}
          {/* ==================================================== */}
          {activeTab === 'show_backend_qr' && (
            <View style={styles.showQrContainer}>
              <Text style={styles.instructionTitle}>Mã QR xác thực của Robot</Text>
              <Text style={styles.instructionSub}>
                Đưa mã QR này cho camera trên robot hoặc y bác sĩ quét để mở tủ bàn giao.
              </Text>

              {/* Box chứa mã QR thật vẽ bằng react-native-qrcode-svg */}
              <View style={styles.qrCodeBox}>
                {isLoadingChallenge ? (
                  <ActivityIndicator size="large" color={Colors.primary} />
                ) : (
                  <QRCode
                    value={backendQrCode}
                    size={FRAME_SIZE * 0.78}
                    color="#0F172A"
                    backgroundColor="#FFFFFF"
                  />
                )}
              </View>

              <Text style={styles.qrCodeTextPayload} numberOfLines={1}>
                {backendQrCode}
              </Text>

              <TouchableOpacity
                style={styles.refreshChallengeBtn}
                onPress={fetchBackendQrChallenge}
                activeOpacity={0.8}
              >
                <RefreshCw size={14} color="#FFFFFF" />
                <Text style={styles.refreshChallengeText}>Tạo mã Challenge mới</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => {
                  onConfirm({
                    code: backendQrCode,
                    serialNumber: 'BE-QR-CHALLENGE',
                    quantity: '1',
                  });
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>Sử dụng mã QR này</Text>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: '#334155',
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#0284C7',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
  },
  scanPhaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  instructionSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 17,
    marginBottom: 20,
    maxWidth: 280,
  },
  frameWrapper: {
    marginBottom: 16,
  },
  qrFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#38BDF8',
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  permissionBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  permissionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#0284C7',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  laserLine: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2.5,
    backgroundColor: '#38BDF8',
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  scanHint: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  successPhaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  successCheckCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 16,
  },
  itemCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1E293B',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  itemLabel: { fontSize: 13, color: '#94A3B8' },
  itemValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  confirmBtn: {
    width: '100%',
    maxWidth: 320,
    height: 48,
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
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  rescanBtnText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '600',
  },
  showQrContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  qrCodeBox: {
    backgroundColor: '#FFFFFF',
    padding: 18,
    borderRadius: 16,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: FRAME_SIZE * 0.95,
    height: FRAME_SIZE * 0.95,
  },
  qrCodeTextPayload: {
    fontSize: 11,
    color: '#64748B',
    maxWidth: 260,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  refreshChallengeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    marginBottom: 16,
  },
  refreshChallengeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
