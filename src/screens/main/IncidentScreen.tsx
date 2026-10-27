import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
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
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';

interface IncidentItem {
  id: string;
  code: string;
  title: string;
  robot: string;
  location: string;
  time: string;
  status: 'pending' | 'resolving' | 'resolved';
  severity: 'high' | 'medium' | 'low';
  description: string;
}

const INCIDENTS: IncidentItem[] = [
  {
    id: '1',
    code: '#SC-014',
    title: 'Cảm biến Lidar bị bụi bám / che khuất',
    robot: 'Robot R001',
    location: 'Khu chờ · Tầng 2',
    time: '09:20',
    status: 'resolving',
    severity: 'high',
    description: 'Tầm nhìn 360° giảm 40%. Robot tự giảm tốc độ để đảm bảo an toàn.',
  },
  {
    id: '2',
    code: '#SC-013',
    title: 'Mất tín hiệu kết nối Wi-Fi Mesh',
    robot: 'Robot R002',
    location: 'Hành lang P. Xét nghiệm',
    time: '08:45',
    status: 'resolved',
    severity: 'medium',
    description: 'Chuyển đổi trạm phát AP thất bại trong 12 giây. Đã tự khôi phục.',
  },
  {
    id: '3',
    code: '#SC-012',
    title: 'Pin dưới mức tiêu chuẩn vận hành (<15%)',
    robot: 'Robot R003',
    location: 'Trạm sạc tự động 1',
    time: '07:30',
    status: 'resolved',
    severity: 'low',
    description: 'Robot đã tự động quay về trạm sạc Docking Station an toàn.',
  },
  {
    id: '4',
    code: '#SC-011',
    title: 'Kẹt cơ học bánh xe điều hướng phụ',
    robot: 'Robot R001',
    location: 'Dốc chuyển tầng A',
    time: 'Hôm qua',
    status: 'resolved',
    severity: 'medium',
    description: 'Vướng dây vải y tế. Đội bảo trì kỹ thuật đã xử lý xong.',
  },
];

export const IncidentScreen: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all');

  const filteredIncidents = INCIDENTS.filter((item) => {
    if (filter === 'pending') return item.status !== 'resolved';
    if (filter === 'resolved') return item.status === 'resolved';
    return true;
  });

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
              <Text style={styles.incidentCountText}>1 CẦN XỬ LÝ</Text>
            </View>
          </View>
        </View>

        {/* ===== FILTER TABS ===== */}
        <View style={styles.filterRow}>
          {[
            { id: 'all', label: 'Tất cả (4)' },
            { id: 'pending', label: 'Đang xử lý (1)' },
            { id: 'resolved', label: 'Đã giải quyết (3)' },
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
          {filteredIncidents.map((incident) => {
            const isHigh = incident.severity === 'high';
            const isResolved = incident.status === 'resolved';

            return (
              <View
                key={incident.id}
                style={[
                  styles.incidentCard,
                  isHigh && !isResolved && styles.incidentCardHigh,
                ]}
              >
                <View style={styles.incidentCardHeader}>
                  <View style={styles.codeTag}>
                    <Text style={styles.codeTagText}>{incident.code}</Text>
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

                <Text style={styles.incidentTitle}>{incident.title}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaText}>🤖 {incident.robot}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>📍 {incident.location}</Text>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaText}>🕒 {incident.time}</Text>
                </View>

                <Text style={styles.incidentDesc}>{incident.description}</Text>
              </View>
            );
          })}
        </View>

        {/* ===== REPORT BUTTON ===== */}
        <TouchableOpacity style={styles.reportBtn} activeOpacity={0.85}>
          <Wrench size={18} color="#FFFFFF" />
          <Text style={styles.reportBtnText}>Báo cáo sự cố kỹ thuật mới</Text>
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
