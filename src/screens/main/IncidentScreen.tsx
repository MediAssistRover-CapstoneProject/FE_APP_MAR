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
  AlertOctagon,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { incidentApi } from '../../api/modules/incident.api';
import { alertApi } from '../../api/modules/alert.api';
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
      const [listResult, alertsResult] = await Promise.all([
        incidentApi.getAllIncidents().catch(() => [] as IncidentResponse[]),
        alertApi.getAllAlerts().catch(() => []),
      ]);

      const byId = new Map<string, IncidentResponse>();
      for (const item of listResult) {
        if (item?.incidentId) byId.set(item.incidentId, item);
      }

      // Bổ sung các sự cố SUSPECTED_FALL có endpointId=null liên kết từ bảng Alert
      const missingIds = alertsResult
        .map((a) => a.incidentId)
        .filter((id): id is string => Boolean(id && !byId.has(id)));

      if (missingIds.length > 0) {
        const fetchedDetails = await Promise.all(
          Array.from(new Set(missingIds)).map((id) =>
            incidentApi.getIncidentDetail(id).catch(() => null)
          )
        );
        for (const detail of fetchedDetails) {
          if (detail?.incidentId) {
            byId.set(detail.incidentId, detail);
          }
        }
      }

      const merged = Array.from(byId.values()).sort(
        (a, b) =>
          new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime()
      );
      setIncidents(merged);
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

  const filteredIncidents = useMemo(
    () =>
      incidents.filter((item) => {
        const resolved = ['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(item.status);
        if (filter === 'pending') return !resolved;
        if (filter === 'resolved') return resolved;
        return true;
      }),
    [filter, incidents]
  );

  const pendingCount = incidents.filter(
    (item) => !['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(item.status)
  ).length;
  const resolvedCount = incidents.length - pendingCount;

  const getIncidentTitle = (type?: string) => {
    switch (type) {
      case 'SUSPECTED_FALL':
        return 'Cảnh báo AI: Phát hiện nghi té ngã';
      case 'GESTURE_SOS':
        return 'Cảnh báo AI: Cử chỉ tay cầu cứu';
      case 'SUSPECTED_SEIZURE':
        return 'Cảnh báo AI: Nghi chuyển động co giật';
      case 'SOS':
      case 'SOS_BUTTON':
        return 'Sự cố khẩn cấp SOS';
      default:
        return type || 'Sự cố robot';
    }
  };

  return (
    <View style={styles.container}>
      <StaffHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageHeaderSub}>NHẬT KÝ VẬN HÀNH & KHẨN CẤP</Text>
          <View style={styles.titleRow}>
            <Text style={styles.pageTitle}>Quản lý sự cố Robot</Text>
            <View style={styles.incidentCountBadge}>
              <AlertOctagon size={12} color="#EF4444" />
              <Text style={styles.incidentCountText}>{pendingCount} CẦN XỬ LÝ</Text>
            </View>
          </View>
        </View>

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

        <View style={styles.listContainer}>
          {isLoading && <ActivityIndicator size="small" color={Colors.primary} />}
          {!isLoading && loadError && <Text style={styles.emptyText}>{loadError}</Text>}
          {!isLoading && !loadError && filteredIncidents.length === 0 && (
            <Text style={styles.emptyText}>Backend chưa có sự cố phù hợp bộ lọc.</Text>
          )}
          {filteredIncidents.map((incident) => {
            const isHigh =
              incident.severity === 'CRITICAL' || incident.incidentType === 'SUSPECTED_FALL';
            const isResolved = ['RESOLVED', 'CLOSED', 'FALSE_ALARM'].includes(incident.status);
            const time = incident.occurredAt
              ? new Date(incident.occurredAt).toLocaleString('vi-VN')
              : 'Chưa có thời gian';
            const location = incident.endpointId
              ? `Endpoint ${incident.endpointId.slice(0, 8)}`
              : Number.isFinite(incident.xM) && Number.isFinite(incident.yM)
              ? `X ${incident.xM?.toFixed(2)} · Y ${incident.yM?.toFixed(2)}`
              : incident.mapId
              ? `Map ${incident.mapId.slice(0, 8)}`
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
                    <Text style={styles.codeTagText}>
                      #{incident.incidentId.slice(0, 8).toUpperCase()} · {incident.incidentType}
                    </Text>
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
                      {isResolved ? `Đã đóng (${incident.status})` : `Đang mở (${incident.status})`}
                    </Text>
                  </View>
                </View>

                <Text style={styles.incidentTitle}>{getIncidentTitle(incident.incidentType)}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>
                    🤖 {incident.robotId ? incident.robotId.slice(0, 8) : 'N/A'}
                  </Text>
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
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: 110,
  },
  pageHeader: {
    marginBottom: Spacing.md,
  },
  pageHeaderSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#71717A',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  incidentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  incidentCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    ...Shadows.sm,
  },
  filterBtnActive: {
    backgroundColor: Colors.hero,
    borderColor: Colors.hero,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
  },
  filterBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContainer: {
    gap: 12,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    paddingVertical: 32,
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 13,
  },
  incidentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.card,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    ...Shadows.card,
  },
  incidentCardHigh: {
    borderColor: '#F87171',
    borderWidth: 1.5,
  },
  incidentCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  codeTag: {
    backgroundColor: '#F4F4F5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  codeTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#71717A',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusBadgeResolving: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeResolved: {
    backgroundColor: '#ECFDF5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
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
    color: '#71717A',
  },
  metaDot: {
    color: '#D4D4D8',
  },
  incidentDesc: {
    fontSize: 12,
    color: '#52525B',
    lineHeight: 18,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    borderRadius: BorderRadius.lg,
    minHeight: 52,
    ...Shadows.button,
  },
  reportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
