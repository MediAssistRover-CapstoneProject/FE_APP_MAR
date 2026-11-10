import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { CameraOff, ScanLine, ShieldCheck, X } from 'lucide-react-native';
import { BorderRadius, Colors, Spacing, Typography } from '../../constants/theme';
import type { AuthVerificationPurpose } from '../../api/modules/delivery.api';

interface QRScannerModalProps {
  jobCode: string;
  purpose: AuthVerificationPurpose;
  onClose: () => void;
  onVerify: (raw: string) => Promise<void>;
}

type ScanState = 'scanning' | 'verifying' | 'verified' | 'error';

export const QRScannerModal = ({ jobCode, purpose, onClose, onVerify }: QRScannerModalProps) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>('scanning');
  const [error, setError] = useState('');
  const locked = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleScan = async ({ data }: BarcodeScanningResult) => {
    if (locked.current) return;
    locked.current = true;
    setState('verifying');
    try {
      await onVerify(data);
      if (mounted.current) setState('verified');
    } catch (error) {
      if (!mounted.current) return;
      const message = (error as { message?: string } | undefined)?.message;
      setError(message || 'Không thể xác thực mã QR giao nhận.');
      setState('error');
    }
  };

  const close = () => { if (state !== 'verifying') onClose(); };
  const phase = purpose === 'DELIVERY_SENDER' ? 'Lấy hàng tại A' : 'Giao hàng tại B';

  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Quét mã QR trên robot</Text>
            <Text style={styles.subtitle}>{jobCode} · {phase}</Text>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Đóng" onPress={close} disabled={state === 'verifying'} style={styles.close}>
            <X size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {state === 'scanning' && permission?.granted ? (
          <>
            <View style={styles.camera}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleScan}
              />
              <View pointerEvents="none" style={styles.frame}><ScanLine size={34} color="#FFFFFF" /></View>
            </View>
            <Text style={styles.hint}>Đưa mã QR trên màn hình robot vào khung ngắm.</Text>
          </>
        ) : (
          <View style={styles.message}>
            {state === 'scanning' && (
              <>
                <CameraOff size={36} color={Colors.textSecondary} />
                <Text style={styles.hint}>Cho phép dùng camera để quét mã trên màn hình robot.</Text>
                {permission?.canAskAgain !== false ? (
                  <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { void requestPermission(); }}>
                    <Text style={styles.buttonText}>Cấp quyền camera</Text>
                  </TouchableOpacity>
                ) : <Text style={styles.hint}>Mở cài đặt của ứng dụng để cấp quyền camera.</Text>}
              </>
            )}
            {state === 'verifying' && (
              <><ActivityIndicator color={Colors.primary} /><Text style={styles.hint}>Đang xác thực mã QR…</Text></>
            )}
            {state === 'verified' && (
              <>
                <ShieldCheck size={36} color={Colors.primary} />
                <Text style={styles.title}>Đã xác thực mã QR</Text>
                <Text style={styles.hint}>Quay lại nhiệm vụ và đợi robot báo đã mở khóa ngăn hàng.</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onClose}>
                  <Text style={styles.buttonText}>Về nhiệm vụ</Text>
                </TouchableOpacity>
              </>
            )}
            {state === 'error' && (
              <>
                <Text style={styles.error}>{error}</Text>
                <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={() => { locked.current = false; setState('scanning'); }}>
                  <Text style={styles.buttonText}>Quét lại</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.lg, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: Spacing.lg, marginBottom: Spacing.lg },
  headerText: { flex: 1 },
  title: { ...Typography.h2, color: Colors.textPrimary },
  subtitle: { marginTop: 4, color: Colors.textSecondary },
  close: { padding: Spacing.sm },
  camera: { height: 340, borderRadius: BorderRadius.lg, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  frame: { width: 215, height: 215, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  message: { alignItems: 'center', gap: Spacing.md, padding: Spacing.lg },
  hint: { color: Colors.textSecondary, textAlign: 'center', paddingVertical: Spacing.sm },
  button: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.primary },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  error: { color: '#B91C1C', textAlign: 'center' },
});
