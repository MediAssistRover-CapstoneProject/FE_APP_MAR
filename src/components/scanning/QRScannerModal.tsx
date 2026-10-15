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
import { X, QrCode, Check, RefreshCw } from 'lucide-react-native';
import { Colors, BorderRadius, Spacing } from '../../constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const FRAME_SIZE = SCREEN_W * 0.62;

interface QRScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (itemInfo: QRItemInfo) => void;
}

export interface QRItemInfo {
  code: string;
  serialNumber: string;
  quantity: string;
}

type ScanPhase = 'scanning' | 'success';

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const [phase, setPhase] = useState<ScanPhase>('scanning');
  const [isScanning, setIsScanning] = useState(false);

  // Đường quét laser animation
  const laserAnim = useRef(new Animated.Value(0)).current;
  const laserLoop = useRef<Animated.CompositeAnimation | null>(null);

  const mockItem: QRItemInfo = {
    code: 'Mẫu xét nghiệm #XN9924',
    serialNumber: 'SN: 9024-42884',
    quantity: '1 đơn vị',
  };

  // Reset về trạng thái scanning mỗi lần mở modal
  useEffect(() => {
    if (visible) {
      setPhase('scanning');
      setIsScanning(false);
      laserAnim.setValue(0);
    }
  }, [visible]);

  // Laser animation chạy khi đang quét
  useEffect(() => {
    if (isScanning) {
      laserLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(laserAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(laserAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      );
      laserLoop.current.start();

      // Giả lập quét thành công sau 2 giây
      const timer = setTimeout(() => {
        laserLoop.current?.stop();
        setPhase('success');
        setIsScanning(false);
      }, 2200);

      return () => {
        clearTimeout(timer);
        laserLoop.current?.stop();
      };
    }
  }, [isScanning]);

  const laserTranslate = laserAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, FRAME_SIZE - 4],
  });

  const handleStartScan = () => setIsScanning(true);

  const handleRescan = () => {
    setPhase('scanning');
    setIsScanning(false);
    laserAnim.setValue(0);
  };

  const handleConfirm = () => {
    onConfirm(mockItem);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {phase === 'scanning' ? 'Đưa mã QR vào khung quét' : 'Quét thành công!'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* ===== PHASE 1: SCANNING ===== */}
          {phase === 'scanning' && (
            <View style={styles.scanPhaseContainer}>
              {/* Camera Frame */}
              <View style={styles.frameWrapper}>
                {/* Khung quét QR với góc bo */}
                <View style={styles.qrFrame}>
                  {/* Các góc của khung */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />

                  {/* QR Icon ở giữa khi chưa quét */}
                  {!isScanning && (
                    <View style={styles.qrIconCenter}>
                      <QrCode size={64} color="#CBD5E1" strokeWidth={1.5} />
                    </View>
                  )}

                  {/* Đường laser quét */}
                  {isScanning && (
                    <Animated.View
                      style={[
                        styles.laserLine,
                        { transform: [{ translateY: laserTranslate }] },
                      ]}
                    />
                  )}
                </View>
              </View>

              <Text style={styles.scanInstruction}>
                Đặt mã QR của vật phẩm cần vận chuyển vào trong khung{'\n'}để nhận dạng tự động
              </Text>

              <TouchableOpacity
                style={[styles.primaryBtn, isScanning && styles.primaryBtnDisabled]}
                onPress={handleStartScan}
                disabled={isScanning}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>
                  {isScanning ? 'Đang quét...' : 'Bắt đầu quét QR'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={onClose} style={styles.cancelLink}>
                <Text style={styles.cancelLinkText}>Hủy</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ===== PHASE 2: SUCCESS ===== */}
          {phase === 'success' && (
            <View style={styles.successPhaseContainer}>
              {/* Khung thành công với checkmark */}
              <View style={styles.successFrame}>
                <View style={styles.successIconWrapper}>
                  <Check size={48} color="#10B981" strokeWidth={3} />
                </View>
              </View>

              {/* Thông tin vật phẩm */}
              <View style={styles.itemInfoBox}>
                <View style={styles.itemInfoHeader}>
                  <QrCode size={16} color={Colors.primary} />
                  <Text style={styles.itemInfoHeaderText}>Thông tin vật phẩm từ QR</Text>
                </View>
                <View style={styles.itemInfoDivider} />

                <View style={styles.itemInfoRow}>
                  <Text style={styles.itemInfoLabel}>Tên vật phẩm:</Text>
                  <Text style={styles.itemInfoValue}>{mockItem.code}</Text>
                </View>
                <View style={styles.itemInfoRow}>
                  <Text style={styles.itemInfoLabel}>Mã serial:</Text>
                  <Text style={styles.itemInfoValue}>{mockItem.serialNumber}</Text>
                </View>
                <View style={styles.itemInfoRow}>
                  <Text style={styles.itemInfoLabel}>Số lượng:</Text>
                  <Text style={styles.itemInfoValue}>{mockItem.quantity}</Text>
                </View>
              </View>

              {/* Nút xác nhận */}
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <Check size={18} color="#FFF" strokeWidth={3} />
                <Text style={styles.confirmBtnText}>Xác nhận thông tin vật phẩm</Text>
              </TouchableOpacity>

              {/* Quét lại */}
              <TouchableOpacity
                style={styles.rescanBtn}
                onPress={handleRescan}
                activeOpacity={0.7}
              >
                <RefreshCw size={14} color={Colors.primary} />
                <Text style={styles.rescanBtnText}>Quét lại</Text>
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  // Body
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phase 1 - Scanning
  scanPhaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  frameWrapper: {
    marginBottom: 32,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    backgroundColor: '#EEF6FB',
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  // Các góc của khung QR
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },

  qrIconCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  laserLine: {
    position: 'absolute',
    top: 0,
    left: 8,
    right: 8,
    height: 2.5,
    backgroundColor: '#3B82F6',
    borderRadius: 2,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  scanInstruction: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  primaryBtn: {
    width: '100%',
    height: 50,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: '#FFF' },
  cancelLink: { paddingVertical: 8 },
  cancelLinkText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  // Phase 2 - Success
  successPhaseContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  successFrame: {
    width: FRAME_SIZE * 0.7,
    height: FRAME_SIZE * 0.7,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Item info box
  itemInfoBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  itemInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  itemInfoHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.4,
  },
  itemInfoDivider: { height: 1, backgroundColor: '#E2E8F0', marginBottom: 10 },
  itemInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  itemInfoLabel: { fontSize: 13, color: Colors.textSecondary },
  itemInfoValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Confirm button
  confirmBtn: {
    width: '100%',
    height: 50,
    backgroundColor: '#10B981',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  rescanBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
});
