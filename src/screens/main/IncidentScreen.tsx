import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  LogOut,
  AlertOctagon,
  Wrench,
  WifiOff,
  BatteryWarning,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { incidentApi } from '../../api/modules/incident.api';
import { IncidentResponse } from '../../api/types';

export const IncidentScreen: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [incidents, setIncidents] = useState<IncidentResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await incidentApi.getAllIncidents();
      setIncidents(result);
    } catch (err: any) {
      setLoadError(err?.message || 'Không thể tải sự cố từ Backend.');
      setIncidents([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const filteredIncidents = useMemo(() => incidents.filter((item) => {
    const resolved = ['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(item.status);
    if (filter === 'pending') return !resolved;
    if (filter === 'resolved') return resolved;
    return true;
  }), [filter, incidents]);

  const pendingCount = incidents.filter((item) => !['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(item.status)).length;
  const resolvedCount = incidents.length - pendingCount;

  return (
    <View style={styles.container}>
      {/* ===== REUSABLE STAFF HEADER ===== */}
      <StaffHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ===== SUBHEADER ===== */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>NHẬT KÝ VẬN HÀNH KỸ THUẬT</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Quản lý sự cố Robot</Text>
            <View style={styles.incidentCountBadge}>
              <AlertOctagon size={12} color="#EF4444" />
              <Text style={styles.incidentCountText}>{pendingCount} CẦN XỬ LÝ</Text>
            </View>
          </View>
        </View>

        {/* ===== FILTER TABS ===== */}
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: `Tất cả (${incidents.length})` },
            { id: 'pending', label: `Đang xử lý (${pendingCount})` },
            { id: 'resolved', label: `Đã giải quyết (${resolvedCount})` },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.filterBtn, filter === tab.id && styles.filterBtnActive]}
              onPress={() => setFilter(tab.id as any)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterBtnText, filter === tab.id && styles.filterBtnTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ===== INCIDENTS LIST ===== */}
        <View style={styles.listContainer}>
          {isLoading && <ActivityIndicator size="small" color={Colors.primary} />}
          {!isLoading && loadError && <Text style={styles.emptyText}>{loadError}</Text>}
          {!isLoading && !loadError && filteredIncidents.length === 0 && (
            <Text style={styles.emptyText}>Backend chưa có sự cố phù hợp bộ lọc.</Text>
          )}
          {filteredIncidents.map((incident) => {
            const isHigh = incident.severity === 'CRITICAL';
            const isResolved = ['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(incident.status);
            const time = incident.occurredAt
              ? new Date(incident.occurredAt).toLocaleString('vi-VN')
              : 'Chưa có thời gian';
            const location = incident.endpointId
              ? `Endpoint ${incident.endpointId.slice(0, 8)}`
              : Number.isFinite(incident.xM) && Number.isFinite(incident.yM)
                ? `X ${incident.xM?.toFixed(2)} · Y ${incident.yM?.toFixed(2)}`
                : 'Chưa xác định vị trí';

            return (
              <View
                key={incident.incidentId}
                style={[
                  styles.incidentCard,
                  isHigh && !isResolved && styles.incidentCardHigh,
                ]}
              >
                <View style={styles.incidentCardHeader}>
                  <View style={styles.codeTag}>
                    <Text style={styles.codeTagText}>#{incident.incidentId.slice(0, 8).toUpperCase()}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      isResolved ? styles.statusBadgeResolved : styles.statusBadgeResolving,
                    ]}
                  >
                    {isResolved ? (
                      <CheckCircle2 size={12} color="#059669" />
                    ) : (
                      <Clock size={12} color="#D97706" />
                    )}
                    <Text
                      style={[
                        styles.statusBadgeText,
                        isResolved ? { color: '#059669' } : { color: '#D97706' },
                      ]}
                    >
                      {isResolved ? 'Đã sửa xong' : 'Kỹ thuật đang xử lý'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.incidentTitle}>{incident.incidentType || 'Sự cố robot'}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>🤖 {incident.robotId ? incident.robotId.slice(0, 8) : 'N/A'}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>📍 {location}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>🕒 {time}</Text>
                </View>

                <Text style={styles.incidentDesc}>{incident.description || 'Không có mô tả.'}</Text>
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.reportBtn} activeOpacity={0.85} onPress={fetchIncidents}>
          <RefreshCw size={18} color="#FFFFFF" />
          <Text style={styles.reportBtnText}>Tải lại sự cố từ Backend</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F7FF',
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandSmall: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  badgeOnDuty: {
    backgroundColor: '#D1FAE5',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  badgeOnDutyText: { fontSize: 9, fontWeight: '700', color: Colors.emerald },
  staffName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  logoutText: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  // Subheader
  pageHeader: { marginBottom: Spacing.sm },
  pageHeaderSub: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0A2540',
  },
  incidentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  incidentCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#EF4444',
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // List
  listContainer: {
    gap: 12,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    paddingVertical: 24,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
  },
  incidentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  incidentCardHigh: {
    borderColor: '#FED7AA',
    borderWidth: 1.5,
  },
  incidentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeTag: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeResolving: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeResolved: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  incidentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A2540',
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  metaDot: {
    color: '#CBD5E1',
  },
  incidentDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
  },

  // Report button
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    borderRadius: 14,
    height: 50,
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
