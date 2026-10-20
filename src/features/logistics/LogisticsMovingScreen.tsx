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
  onNext?: () => void;
  onBack?: () => void;
}

export function LogisticsMovingScreen({ onNext, onBack }: Props) {
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
        {/* 4. Stepper Bước 2 */}
        <LogisticsStepper currentStep={2} />

        {/* 5. Center Hero */}
        <View style={styles.centerHero}>
          <View style={styles.heroIconBox}>
            <Ionicons name="map-outline" size={40} color="#0066CC" />
          </View>
          <View style={styles.statusPill}>
            <View style={styles.blueDot} />
            <AppText style={styles.statusPillText}>ĐANG DI CHUYỂN ĐẾN NƠI GỬI</AppText>
          </View>
          <AppText style={styles.heroTitle}>Đang đến Phòng xét nghiệm</AppText>
        </View>

        {/* 6. Card Lộ trình & Thông số thời gian thực */}
        <View style={styles.journeyCard}>
          {/* Visual Route Points */}
          <View style={styles.routePointsRow}>
            <View style={styles.pointItem}>
              <View style={styles.pointIconWrap}>
                <Ionicons name="hardware-chip" size={18} color="#0066CC" />
              </View>
              <AppText style={styles.pointRole}>NƠI ĐI</AppText>
              <AppText style={styles.pointName}>Zone A</AppText>
            </View>

            {/* Dashed connector line */}
            <View style={styles.dashLineWrap}>
              <View style={styles.dashLine} />
              <View style={styles.distanceBadge}>
                <AppText style={styles.distanceBadgeText}>22m · ~40s</AppText>
              </View>
            </View>

            <View style={styles.pointItem}>
              <View style={[styles.pointIconWrap, styles.destIconWrap]}>
                <Ionicons name="business" size={18} color="#0F4C81" />
              </View>
              <AppText style={styles.pointRole}>ĐIỂM ĐẾN</AppText>
              <AppText style={styles.pointName}>Phòng xét nghiệm</AppText>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <View style={styles.progressLabelRow}>
              <AppText style={styles.progressTitle}>TIẾN ĐỘ HÀNH TRÌNH</AppText>
              <AppText style={styles.progressPercent}>45%</AppText>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: '45%' }]} />
            </View>
          </View>

          {/* 4 Metric Tiles Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricTile}>
              <AppText style={styles.metricTileLabel}>KHOẢNG CÁCH CÒN LẠI</AppText>
              <AppText style={styles.metricTileValue}>9.8m</AppText>
            </View>
            <View style={styles.metricTile}>
              <AppText style={styles.metricTileLabel}>DỰ KIẾN ĐẾN</AppText>
              <AppText style={styles.metricTileValue}>~14s</AppText>
            </View>
            <View style={styles.metricTile}>
              <AppText style={styles.metricTileLabel}>TỐC ĐỘ</AppText>
              <AppText style={styles.metricTileValue}>0.8 m/s</AppText>
            </View>
            <View style={styles.metricTile}>
              <AppText style={styles.metricTileLabel}>TRẠNG THÁI</AppText>
              <AppText style={[styles.metricTileValue, { color: '#0284C7' }]}>Đang di chuyển</AppText>
            </View>
          </View>
        </View>

        {/* Action Button: Chuyển sang bước 3 */}
        {onNext && (
          <Pressable
            accessibilityRole="button"
            onPress={onNext}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            ]}
          >
            <AppText style={styles.actionButtonText}>Mô phỏng robot đã đến nơi gửi</AppText>
            <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
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
  journeyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  routePointsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pointItem: {
    alignItems: 'center',
    width: 90,
  },
  pointIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  destIconWrap: {
    backgroundColor: '#EFF6FF',
  },
  pointRole: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  pointName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  dashLineWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 8,
  },
  dashLine: {
    width: '100%',
    height: 2,
    backgroundColor: '#0284C7',
    borderRadius: 1,
  },
  distanceBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  distanceBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0284C7',
  },
  progressSection: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0284C7',
    borderRadius: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricTile: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricTileLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricTileValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
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
