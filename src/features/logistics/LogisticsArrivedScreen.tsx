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

interface Props {
  onReset?: () => void;
  onBack?: () => void;
}

export function LogisticsArrivedScreen({ onReset, onBack }: Props) {
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

      {/* 2. Banner Thông tin nhiệm vụ */}
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
        {/* 4. Stepper Bước 2 hoàn thành */}
        <LogisticsStepper currentStep={2} />

        {/* 5. Center Hero */}
        <View style={styles.centerHero}>
          <View style={styles.heroIconBox}>
            <Ionicons name="location" size={40} color="#DC2626" />
          </View>
          <View style={styles.statusPill}>
            <View style={styles.tealDot} />
            <AppText style={styles.statusPillText}>ĐÃ ĐẾN NƠI GỬI</AppText>
          </View>
          <AppText style={styles.heroTitle}>Robot đã đến Phòng xét nghiệm</AppText>
        </View>

        {/* 6. Card Mẫu vật & Chờ Staff */}
        <View style={styles.pickupCard}>
          <View style={styles.pickupHeader}>
            <View style={styles.boxIconWrap}>
              <Ionicons name="cube" size={28} color="#D97706" />
            </View>
            <View style={styles.pickupInfo}>
              <AppText style={styles.pickupTitle}>Mẫu xét nghiệm #XN1024</AppText>
              <AppText style={styles.pickupSubtitle}>Mã: XN-1024-0904 · SL: 1</AppText>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.statusMessageRow}>
            <Ionicons name="time-outline" size={18} color="#047857" />
            <AppText style={styles.statusMessageText}>
              Robot đang đợi Staff đặt vật phẩm vào thùng.
            </AppText>
          </View>
        </View>

        {/* 7. Action Button */}
        {onReset && (
          <Pressable
            accessibilityRole="button"
            onPress={onReset}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <AppText style={styles.actionButtonText}>Xem lại từ bước nhận nhiệm vụ</AppText>
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
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
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 4,
  },
  tealDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F766E',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  pickupCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  pickupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  boxIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  pickupInfo: {
    flex: 1,
  },
  pickupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickupSubtitle: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#DCFCE7',
  },
  statusMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusMessageText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#065F46',
    lineHeight: 18,
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
