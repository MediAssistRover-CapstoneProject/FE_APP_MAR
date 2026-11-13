/**
 * ShiftScreen – Màn hình Check-in / Check-out Ca Trực cho Staff
 * Hiển thị danh sách ca trực, cho phép check-in và check-out theo API server.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, CheckCircle, Clock, LogIn, LogOut, RefreshCw, XCircle } from 'lucide-react-native';
import { StaffHeader } from '../../components/common/StaffHeader';
import { staffApi } from '../../api/modules/staff.api';
import { ShiftResponse } from '../../api/types';
import { Colors, Shadows, BorderRadius, Spacing } from '../../constants/theme';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

type ShiftStatusBadge = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

function statusLabel(s: ShiftStatusBadge): string {
  switch (s) {
    case 'PLANNED': return 'Sắp diễn ra';
    case 'ACTIVE': return 'Đang ca';
    case 'COMPLETED': return 'Đã kết thúc';
    case 'CANCELLED': return 'Đã hủy';
    default: return s;
  }
}

function statusColor(s: ShiftStatusBadge): string {
  switch (s) {
    case 'PLANNED': return '#3B82F6';
    case 'ACTIVE': return '#059669';
    case 'COMPLETED': return '#64748B';
    case 'CANCELLED': return '#EF4444';
    default: return '#94A3B8';
  }
}

// ─── Check-in / Check-out button logic (mirror delivery-qr.html) ─────────────

function canCheckIn(shift: ShiftResponse): boolean {
  if (shift.checkedInAt) return false;      // đã check-in rồi
  if (shift.checkedOutAt) return false;     // đã check-out rồi
  const now = Date.now();
  if (now < Date.parse(shift.startsAt)) return false; // ca chưa bắt đầu
  if (now >= Date.parse(shift.endsAt)) return false;  // ca đã kết thúc
  return true;
}

function canCheckOut(shift: ShiftResponse): boolean {
  if (!shift.checkedInAt) return false;     // chưa check-in
  if (shift.checkedOutAt) return false;     // đã check-out rồi
  return true;
}

// ─── Sub-component: Shift Card ────────────────────────────────────────────────

interface ShiftCardProps {
  shift: ShiftResponse;
  onCheckIn: (shiftId: string) => void;
  onCheckOut: (shiftId: string) => void;
  loadingId: string | null;
}

function ShiftCard({ shift, onCheckIn, onCheckOut, loadingId }: ShiftCardProps) {
  const isLoading = loadingId === shift.shiftId;
  const checkInEnabled = canCheckIn(shift);
  const checkOutEnabled = canCheckOut(shift);

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shiftName}>{shift.shiftName || shift.shiftCode}</Text>
          {shift.roomCode ? (
            <Text style={styles.roomCode}>📍 Phòng trực: {shift.roomCode}</Text>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(shift.status) }]}>
          <Text style={styles.statusBadgeText}>{statusLabel(shift.status)}</Text>
        </View>
      </View>

      {/* Time info */}
      <View style={styles.timeRow}>
        <Clock size={14} color={Colors.textSecondary} />
        <Text style={styles.timeText}>
          {formatDate(shift.startsAt)}
        </Text>
      </View>
      <View style={styles.timeRow}>
        <Text style={styles.timeLabel}>Bắt đầu:</Text>
        <Text style={styles.timeValue}>{formatTime(shift.startsAt)}</Text>
        <Text style={[styles.timeLabel, { marginLeft: 16 }]}>Kết thúc:</Text>
        <Text style={styles.timeValue}>{formatTime(shift.endsAt)}</Text>
      </View>

      {/* Check-in / Check-out timestamps */}
      {shift.checkedInAt ? (
        <View style={styles.checkRow}>
          <CheckCircle size={14} color="#166534" />
          <Text style={styles.checkText}>Check-in: {formatDateTime(shift.checkedInAt)}</Text>
        </View>
      ) : null}
      {shift.checkedOutAt ? (
        <View style={styles.checkRow}>
          <CheckCircle size={14} color="#0369A1" />
          <Text style={styles.checkText}>Check-out: {formatDateTime(shift.checkedOutAt)}</Text>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.checkInBtn, !checkInEnabled && styles.actionBtnDisabled]}
          disabled={!checkInEnabled || isLoading}
          onPress={() => onCheckIn(shift.shiftId)}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <LogIn size={16} color="#fff" />
              <Text style={styles.actionBtnText}>VÀO CA (CHECK-IN)</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.checkOutBtn, !checkOutEnabled && styles.actionBtnDisabled]}
          disabled={!checkOutEnabled || isLoading}
          onPress={() => onCheckOut(shift.shiftId)}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={Colors.textPrimary} />
          ) : (
            <>
              <LogOut size={16} color={checkOutEnabled ? Colors.textPrimary : Colors.textMuted} />
              <Text style={[styles.actionBtnText, { color: checkOutEnabled ? Colors.textPrimary : Colors.textMuted }]}>
                HẾT CA (CHECK-OUT)
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Help text */}
      {!shift.checkedInAt && !checkInEnabled && shift.status === 'PLANNED' && (
        <Text style={styles.helpText}>⏳ Ca chưa bắt đầu — bạn có thể check-in khi ca bắt đầu</Text>
      )}
      {!shift.checkedInAt && !checkInEnabled && shift.status === 'ACTIVE' && Date.now() >= Date.parse(shift.endsAt) && (
        <Text style={styles.helpText}>⚠️ Ca đã kết thúc mà chưa check-in</Text>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function ShiftScreen() {
  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const loadShifts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Load PLANNED + ACTIVE shifts (tối đa 100 ca)
      const [planned, active] = await Promise.all([
        staffApi.getAllStaffShifts('PLANNED'),
        staffApi.getAllStaffShifts('ACTIVE'),
      ]);
      // Sort: ACTIVE first, then PLANNED sorted by startsAt ascending
      const sorted = [
        ...active.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
        ...planned.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt)),
      ];
      setShifts(sorted);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Không thể tải danh sách ca trực';
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadShifts();
  }, [loadShifts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadShifts(true);
  }, [loadShifts]);

  const handleCheckIn = useCallback(async (shiftId: string) => {
    setLoadingId(shiftId);
    try {
      await staffApi.checkIn(shiftId);
      Alert.alert('✅ Check-in thành công', 'Bạn đã check-in ca trực thành công!', [{ text: 'OK' }]);
      await loadShifts(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Check-in thất bại';
      Alert.alert('❌ Check-in thất bại', msg, [{ text: 'Đóng' }]);
    } finally {
      setLoadingId(null);
    }
  }, [loadShifts]);

  const handleCheckOut = useCallback(async (shiftId: string) => {
    Alert.alert(
      'Xác nhận Check-out',
      'Bạn có chắc muốn check-out ca trực này không?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Check-out',
          style: 'destructive',
          onPress: async () => {
            setLoadingId(shiftId);
            try {
              await staffApi.checkOut(shiftId);
              Alert.alert('✅ Check-out thành công', 'Bạn đã check-out ca trực thành công!', [{ text: 'OK' }]);
              await loadShifts(true);
            } catch (err: any) {
              const msg = err?.response?.data?.message || err?.message || 'Check-out thất bại';
              Alert.alert('❌ Check-out thất bại', msg, [{ text: 'Đóng' }]);
            } finally {
              setLoadingId(null);
            }
          },
        },
      ]
    );
  }, [loadShifts]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StaffHeader
        subtitle="MEDIASSISTROVER · CA TRỰC"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <Calendar size={18} color={Colors.primary} />
            <Text style={styles.topBarTitle}>Danh sách ca trực</Text>
          </View>
          <TouchableOpacity style={styles.refreshBtn} onPress={() => loadShifts(true)} disabled={loading}>
            <RefreshCw size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Loading */}
        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Đang tải ca trực...</Text>
          </View>
        )}

        {/* Error */}
        {!loading && error && (
          <View style={styles.errorBox}>
            <XCircle size={36} color="#EF4444" />
            <Text style={styles.errorTitle}>Không thể tải dữ liệu</Text>
            <Text style={styles.errorMsg}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadShifts()}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Empty */}
        {!loading && !error && shifts.length === 0 && (
          <View style={styles.centerBox}>
            <Calendar size={48} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>Không có ca trực</Text>
            <Text style={styles.emptyMsg}>
              Bạn chưa có ca trực nào sắp diễn ra hoặc đang hoạt động.
            </Text>
          </View>
        )}

        {/* Shift list */}
        {!loading && !error && shifts.map((shift) => (
          <ShiftCard
            key={shift.shiftId}
            shift={shift}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            loadingId={loadingId}
          />
        ))}

        {/* Bottom padding */}
        <View style={{ height: 24 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 110,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  refreshBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  shiftName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  roomCode: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Time
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  timeText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  timeValue: {
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // Check info
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  checkText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },

  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  checkInBtn: {
    backgroundColor: Colors.hero,
    ...Shadows.button,
  },
  checkOutBtn: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnDisabled: {
    backgroundColor: '#E4E4E7',
    borderWidth: 0,
    opacity: 0.6,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Help text
  helpText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
  },

  // States
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  emptyMsg: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  errorBox: {
    alignItems: 'center',
    backgroundColor: Colors.dangerSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 24,
    gap: 10,
    marginVertical: 12,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.danger,
  },
  errorMsg: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
