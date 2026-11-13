import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { dispatchApi } from '../../api/modules/dispatch.api';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../store/useAuthStore';
import {
  canCancelDelivery, cancellationMessage, cancellationReason, ownsDelivery,
  requestDeliveryCancellation, type CancellationSnapshot,
} from '../../screens/main/deliveryCancellation';

export function DeliveryCancelAction({ snapshot, accountId, refresh, unavailable = false }: {
  snapshot: CancellationSnapshot;
  accountId: string;
  refresh: (jobId: string) => Promise<CancellationSnapshot>;
  unavailable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const mounted = useRef(false);
  const inFlight = useRef(false);
  const baseUrl = apiClient.getBaseUrl();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const current = () => mounted.current && apiClient.getBaseUrl() === baseUrl &&
    useAuthStore.getState().user?.accountId?.toLowerCase() === accountId.toLowerCase();
  const owner = ownsDelivery(snapshot, accountId);
  const allowed = canCancelDelivery(snapshot, accountId);
  const stateMessage = snapshot.job.cancelRequestedAt ||
    ['CANCELLED', 'RECOVERY_REQUIRED'].includes(snapshot.job.status) ||
    (receipt && ['SUCCEEDED', 'FAILED'].includes(snapshot.job.status)) ? cancellationMessage(snapshot) : receipt;

  async function confirm() {
    if (inFlight.current || !current()) return;
    try { cancellationReason(reason); } catch (e) { setError((e as Error).message); return; }
    inFlight.current = true; setBusy(true); setError('');
    let sent = false;
    try {
      const job = await requestDeliveryCancellation({
        jobId: snapshot.job.jobId, accountId, reason, stillCurrent: current,
        loadLatest: refresh, cancelJob: dispatchApi.cancelJob,
      });
      sent = true;
      if (!current()) return;
      setReceipt(cancellationMessage({ ...snapshot, job }));
      setOpen(false);
    } catch (e) {
      if (current()) setError((e as { message?: string }).message || 'Chưa xác nhận được kết quả. Hãy làm mới trạng thái trước khi thử lại.');
    } finally {
      if (current()) {
        try {
          const latest = await refresh(snapshot.job.jobId);
          if (current() && (latest.job.cancelRequestedAt || latest.job.status === 'CANCELLED')) {
            setReceipt(cancellationMessage(latest)); setOpen(false); setError('');
          }
        } catch {
          if (current() && sent) setReceipt('Đã gửi yêu cầu hủy nhưng chưa đọc lại được trạng thái. Bấm Làm mới; chưa xác nhận robot đã dừng.');
        }
      }
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  }

  if (!owner) return null;
  return <View style={styles.section}>
    {!!stateMessage && <Text accessibilityRole="alert" style={styles.note}>{stateMessage}</Text>}
    {allowed && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Hủy nhiệm vụ giao hàng"
      disabled={busy || unavailable || !!receipt} style={[styles.outline, (busy || unavailable || !!receipt) && styles.disabled]}
      onPress={() => { setReason(''); setError(''); setOpen(true); }}>
      <Text style={styles.danger}>Hủy nhiệm vụ giao hàng</Text>
    </TouchableOpacity>}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => { if (!busy) setOpen(false); }}>
      <View style={styles.overlay}><View style={styles.dialog}>
        <Text style={styles.title}>Hủy nhiệm vụ giao hàng?</Text>
        <Text style={styles.note}>Gửi yêu cầu dừng nhiệm vụ tới BE. Việc hủy không tự mở thùng hoặc thu hồi hàng. Nếu đã đặt hàng vào robot, cần phối hợp người điều phối kiểm tra hàng.</Text>
        <TextInput accessibilityLabel="Lý do hủy nhiệm vụ" placeholder="Nhập lý do hủy" value={reason} onChangeText={setReason}
          multiline maxLength={1000} editable={!busy} style={styles.input} />
        <Text style={styles.count}>{reason.length}/1000</Text>
        {!!error && <Text accessibilityRole="alert" style={styles.danger}>{error}</Text>}
        <TouchableOpacity accessibilityRole="button" disabled={busy || !reason.trim()} style={[styles.submit, (busy || !reason.trim()) && styles.disabled]} onPress={() => { void confirm(); }}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Xác nhận gửi yêu cầu hủy</Text>}
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.outline} onPress={() => setOpen(false)}><Text>Tiếp tục giao hàng</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 }, outline: { padding: 13, borderRadius: 10, borderWidth: 1, borderColor: '#d4dbe3', alignItems: 'center' },
  danger: { color: '#b42318', fontSize: 14, fontWeight: '600' }, note: { fontSize: 14, lineHeight: 21, color: '#475569' },
  disabled: { opacity: 0.5 }, overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12, maxWidth: 480, width: '100%' },
  title: { fontSize: 19, fontWeight: '700', color: '#172334' }, input: { minHeight: 85, maxHeight: 160, textAlignVertical: 'top', padding: 12, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, color: '#172334' },
  count: { fontSize: 12, textAlign: 'right', color: '#64748b' }, submit: { backgroundColor: '#b42318', padding: 14, alignItems: 'center', borderRadius: 10 }, submitText: { color: '#fff', fontWeight: '700' },
});
