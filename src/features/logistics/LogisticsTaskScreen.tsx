import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/ui';
import { LogisticsStepper } from '../../components/LogisticsStepper';
import { colors } from '../../theme';

interface Props {
  onNext?: () => void;
}

export function LogisticsTaskScreen({ onNext }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* 1. Header Trạng thái Robot */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Ionicons name="hardware-chip" size={16} color="#0284C7" />
          <AppText style={styles.robotNameText}>MediRover #001</AppText>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <AppText style={styles.onlineText}>Online</AppText>
          </View>
        </View>
        <View style={styles.topBarRight}>
          <Ionicons name="battery-charging" size={16} color="#10B981" />
          <AppText style={styles.batteryText}>79%</AppText>
          <AppText style={styles.headerTimeText}>15:44</AppText>
        </View>
      </View>

      {/* 2. Banner Thông tin nhiệm vụ & Độ ưu tiên */}
      <View style={styles.taskBanner}>
        <View style={styles.taskBannerLeft}>
          <AppText style={styles.taskIdText}>#XN002</AppText>
          <View style={styles.priorityBadge}>
            <AppText style={styles.priorityText}>Ưu tiên cao</AppText>
          </View>
          <AppText style={styles.routeSummaryText}>Phòng xét nghiệm → P. Chẩn đoán</AppText>
        </View>
        <AppText style={styles.timeTag}>15:44</AppText>
      </View>

      {/* 3. Status Tags */}
      <View style={styles.tagRow}>
        <View style={styles.tagItem}>
          <Ionicons name="cube-outline" size={13} color="#475569" />
          <AppText style={styles.tagText}>Thùng: Trống</AppText>
        </View>
        <View style={[styles.tagItem, styles.tagItemHighlight]}>
          <Ionicons name="person-circle-outline" size={13} color="#0284C7" />
          <AppText style={[styles.tagText, { color: '#0284C7' }]}>Xác minh: Khuôn mặt</AppText>
        </View>
        <AppText style={styles.zoneText}>Zone A - Tầng 1</AppText>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* 4. 6-Step Workflow Stepper */}
        <LogisticsStepper currentStep={1} />

        {/* 5. Center Icon & Title */}
        <View style={styles.centerHero}>
          <View style={styles.heroIconBox}>
            <Ionicons name="clipboard-outline" size={40} color="#0066CC" />
          </View>
          <View style={styles.statusPill}>
            <View style={styles.blueDot} />
            <AppText style={styles.statusPillText}>ĐÃ NHẬN NHIỆM VỤ</AppText>
          </View>
          <AppText style={styles.heroTitle}>Nhiệm vụ được giao</AppText>
        </View>

        {/* 6. Chi tiết nhiệm vụ */}
        <View style={styles.detailsCard}>
          <AppText style={styles.cardHeaderTitle}>CHI TIẾT NHIỆM VỤ</AppText>

          {/* 2x3 Grid */}
          <View style={styles.grid}>
            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>VẬT PHẨM</AppText>
              <AppText style={styles.cellValue}>Mẫu xét nghiệm #X...</AppText>
            </View>
            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>MÃ VẬT PHẨM</AppText>
              <AppText style={styles.cellValue}>XN-1024-0904</AppText>
            </View>

            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>SỐ LƯỢNG</AppText>
              <AppText style={styles.cellValue}>1 đơn vị</AppText>
            </View>
            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>NƠI GỬI</AppText>
              <AppText style={styles.cellValue}>Phòng xét nghiệm</AppText>
            </View>

            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>NƠI NHẬN</AppText>
              <AppText style={styles.cellValue}>P. Chẩn đoán</AppText>
            </View>
            <View style={styles.gridCell}>
              <AppText style={styles.cellLabel}>NGƯỜI NHẬN</AppText>
              <AppText style={styles.cellValue}>BS. Nguyễn Văn An</AppText>
            </View>
          </View>

          {/* Verification Box */}
          <View style={styles.verifyBox}>
            <Ionicons name="person-outline" size={16} color="#D97706" />
            <View style={{ flex: 1 }}>
              <AppText style={styles.verifyLabel}>PHƯƠNG THỨC XÁC MINH - ĐÃ THIẾT LẬP</AppText>
              <AppText style={styles.verifyTitle}>Xác minh khuôn mặt</AppText>
            </View>
          </View>

          {/* Note Box */}
          <View style={styles.noteBox}>
            <AppText style={styles.noteLabel}>GHI CHÚ</AppText>
            <AppText style={styles.noteText}>Mẫu xét nghiệm — xác nhận khuôn mặt bắt buộc</AppText>
          </View>
        </View>

        {/* Action Button: Chuyển sang bước 2 */}
        {onNext && (
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <AppText style={styles.actionButtonText}>Bắt đầu di chuyển đến nơi gửi</AppText>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  robotNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  onlineText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#059669',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batteryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  headerTimeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  taskBanner: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  taskBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  taskIdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  priorityBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  routeSummaryText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '500',
  },
  timeTag: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagItemHighlight: {
    backgroundColor: '#E0F2FE',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  zoneText: {
    fontSize: 10,
    color: '#94A3B8',
    marginLeft: 'auto',
    fontWeight: '500',
  },
  scrollContent: {
    padding: 14,
    gap: 12,
    paddingBottom: 32,
  },
  centerHero: {
    alignItems: 'center',
    marginVertical: 4,
    gap: 6,
  },
  heroIconBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  blueDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0284C7',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 14,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridCell: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cellLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  cellValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },
  verifyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
  },
  verifyLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#D97706',
    letterSpacing: 0.5,
  },
  verifyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B45309',
  },
  noteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  noteLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  noteText: {
    fontSize: 12,
    color: '#334155',
    marginTop: 2,
    fontWeight: '500',
  },
  actionButton: {
    backgroundColor: '#0066CC',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
