import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MapPin, Bot } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';

const { width: SCREEN_W } = Dimensions.get('window');

interface RoomBlueprint {
  id: string;
  name: string;
  icon: string;
  top: number;
  left: number;
  width: number;
  height: number;
  bgColor?: string;
}

const ROOMS_FLOOR_2: RoomBlueprint[] = [
  // Top row
  { id: 'cap_cuu',    name: 'Cấp cứu',     icon: '🏥', top: 12,  left: 55,  width: 70, height: 62 },
  { id: 'khu_cho',    name: 'Khu chờ',     icon: '👥', top: 12,  left: 135, width: 72, height: 62, bgColor: '#EFF6FF' },
  { id: 'ky_thuat',   name: 'Kỹ thuật',    icon: '⚙️', top: 12,  left: 218, width: 75, height: 62 },

  // Mid left & right
  { id: 'tiep_nhan',  name: 'Tiếp nhận',   icon: '📋', top: 84,  left: 45,  width: 72, height: 65 },
  { id: 'nha_thuoc',  name: 'Nhà thuốc',   icon: '💊', top: 84,  left: 232, width: 68, height: 65 },

  // Center room
  { id: 'p_da_nang',  name: 'P. Đa năng',  icon: '🩺', top: 96,  left: 132, width: 85, height: 78, bgColor: '#F0FDF4' },

  // Lower mid
  { id: 'noi_tru',    name: 'P. Nội trú',  icon: '🛏️', top: 160, left: 35,  width: 80, height: 75 },
  { id: 'wc',         name: 'WC',          icon: '🚻', top: 160, left: 228, width: 45, height: 50 },

  // Bottom row
  { id: 'xet_nghiem', name: 'P. Xét nghiệm',icon: '🧪', top: 246, left: 35,  width: 82, height: 68 },
  { id: 'sieu_am',    name: 'Siêu âm',     icon: '📡', top: 220, left: 200, width: 72, height: 55 },
  { id: 'hoi_thao',   name: 'P. Hội thảo', icon: '🏛️', top: 284, left: 185, width: 92, height: 62 },
];

export const DensityScreen: React.FC = () => {
  const [selectedFloor, setSelectedFloor] = useState<'Tầng 2' | 'Tầng 3' | 'Tầng 4'>('Tầng 2');

  return (
    <View style={styles.container}>
      {/* ===== REUSABLE STAFF HEADER ===== */}
      <StaffHeader />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ===== SUBHEADER CARD ===== */}
        <View style={styles.subCard}>
          <View style={styles.subCardLeft}>
            <View style={styles.subCardAvatar}>
              <Text style={{ fontSize: 18 }}>🤖</Text>
            </View>
            <View>
              <Text style={styles.subCardTitle}>MediAssistRover</Text>
              <Text style={styles.subCardSubtitle}>Bản đồ di chuyển · Hỗ trợ người dùng</Text>
            </View>
          </View>
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        </View>

        {/* ===== BLUEPRINT MAP CONTAINER ===== */}
        <View style={styles.mapCard}>
          {/* Floor Selector (Tầng 4, Tầng 3, Tầng 2) */}
          <View style={styles.floorSelector}>
            {(['Tầng 4', 'Tầng 3', 'Tầng 2'] as const).map((floor) => {
              const isActive = selectedFloor === floor;
              return (
                <TouchableOpacity
                  key={floor}
                  style={[styles.floorBtn, isActive && styles.floorBtnActive]}
                  onPress={() => setSelectedFloor(floor)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.floorBtnText, isActive && styles.floorBtnTextActive]}>
                    {floor}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Blueprint Canvas */}
          <View style={styles.blueprintCanvas}>
            {/* Rooms */}
            {ROOMS_FLOOR_2.map((room) => (
              <View
                key={room.id}
                style={[
                  styles.roomBox,
                  {
                    top: room.top,
                    left: room.left,
                    width: room.width,
                    height: room.height,
                    backgroundColor: room.bgColor || '#F8FAFC',
                  },
                ]}
              >
                <Text style={styles.roomIconText}>{room.icon}</Text>
                <Text style={styles.roomNameText}>{room.name}</Text>
              </View>
            ))}

            {/* Heatmap density glow spots (Khu đông người) */}
            {/* Spot 1: Red very high density in front of Khu chờ */}
            <View style={[styles.heatSpot, styles.heatSpotRed, { top: 76, left: 156 }]} />
            <View style={[styles.heatSpot, styles.heatSpotOrange, { top: 72, left: 150 }]} />
            <View style={[styles.heatSpot, styles.heatSpotYellow, { top: 66, left: 142 }]} />

            {/* Spot 2: Orange turn */}
            <View style={[styles.heatSpot, styles.heatSpotOrange, { top: 188, left: 198 }]} />
            <View style={[styles.heatSpot, styles.heatSpotYellow, { top: 182, left: 192 }]} />

            {/* Spot 3: Green low density */}
            <View style={[styles.heatSpot, styles.heatSpotGreen, { top: 250, left: 165 }]} />

            {/* Blue Navigation Route Line */}
            <View style={[styles.routePathLine, { top: 96, left: 136, width: 4, height: 160 }]} />
            <View style={[styles.routePathLine, { top: 96, left: 136, width: 78, height: 4 }]} />
            <View style={[styles.routePathLine, { top: 96, left: 210, width: 4, height: 95 }]} />

            {/* Destination Marker 📍 */}
            <View style={[styles.destinationPinBox, { top: 185, left: 206 }]}>
              <MapPin size={22} color="#0284C7" fill="#0284C7" />
            </View>

            {/* Robot Marker 🤖 */}
            <View style={[styles.robotPositionBox, { top: 256, left: 120 }]}>
              <View style={styles.robotMarkerCircle}>
                <Bot size={16} color="#FFFFFF" />
              </View>
              <View style={styles.startTagPill}>
                <Text style={styles.startTagText}>Bắt đầu từ đây</Text>
              </View>
            </View>

            {/* Legend Box (Bottom Left) */}
            <View style={styles.legendBox}>
              <Text style={styles.legendTitle}>Mức độ đông người</Text>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendLabel}>Thấp</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FBBF24' }]} />
                <Text style={styles.legendLabel}>Trung bình</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
                <Text style={styles.legendLabel}>Cao</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendLabel}>Rất cao</Text>
              </View>
              <Text style={styles.legendSubtext}>
                Dữ liệu được cập nhật{'\n'}theo thời gian thực
              </Text>
            </View>
          </View>
        </View>

        {/* ===== BOTTOM METRICS ROW ===== */}
        <View style={styles.metricsBar}>
          <View style={styles.metricItem}>
            <View style={styles.metricIconBox}>
              <Text style={{ fontSize: 24 }}>🚶</Text>
            </View>
            <View>
              <Text style={styles.metricNumber}>120 m</Text>
              <Text style={styles.metricSub}>Khoảng cách tới đích</Text>
            </View>
          </View>

          <View style={styles.metricDividerVertical} />

          <View style={styles.metricItem}>
            <View style={styles.metricIconBox}>
              <Text style={{ fontSize: 24 }}>⏱️</Text>
            </View>
            <View>
              <Text style={styles.metricNumber}>2 phút</Text>
              <Text style={styles.metricSub}>Thời gian dự kiến</Text>
            </View>
          </View>
        </View>
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
    paddingBottom: 24,
  },

  // Header
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

  // Sub card
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  subCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subCardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0A2540',
  },
  subCardSubtitle: {
    fontSize: 10,
    color: '#64748B',
  },
  liveTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },

  // Map Card
  mapCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    overflow: 'hidden',
    position: 'relative',
    ...Shadows.card,
  },
  floorSelector: {
    position: 'absolute',
    top: 14,
    left: 14,
    zIndex: 10,
    gap: 6,
  },
  floorBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  floorBtnActive: {
    backgroundColor: '#0284C7',
    borderColor: '#0284C7',
  },
  floorBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  floorBtnTextActive: {
    color: '#FFFFFF',
  },

  // Blueprint Canvas
  blueprintCanvas: {
    height: 380,
    backgroundColor: '#F0F9FF',
    position: 'relative',
    overflow: 'hidden',
  },
  roomBox: {
    position: 'absolute',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  roomIconText: {
    fontSize: 12,
  },
  roomNameText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#0369A1',
    textAlign: 'center',
    marginTop: 1,
  },

  // Heatmap density glow spots
  heatSpot: {
    position: 'absolute',
    borderRadius: 50,
  },
  heatSpotRed: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.85)',
    zIndex: 4,
  },
  heatSpotOrange: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(249, 115, 22, 0.55)',
    zIndex: 3,
  },
  heatSpotYellow: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(251, 191, 36, 0.35)',
    zIndex: 2,
  },
  heatSpotGreen: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.4)',
    zIndex: 2,
  },

  // Navigation path
  routePathLine: {
    position: 'absolute',
    backgroundColor: '#0284C7',
    borderRadius: 2,
    zIndex: 5,
  },
  destinationPinBox: {
    position: 'absolute',
    zIndex: 6,
  },
  robotPositionBox: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 6,
  },
  robotMarkerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0284C7',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0284C7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  startTagPill: {
    backgroundColor: '#0284C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  startTagText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Legend Box (Bottom Left)
  legendBox: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    zIndex: 10,
    maxWidth: 135,
  },
  legendTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#0A2540',
    marginBottom: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginVertical: 1,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 9,
    color: '#475569',
    fontWeight: '600',
  },
  legendSubtext: {
    fontSize: 7.5,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 10,
  },

  // Bottom metrics row
  metricsBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    ...Shadows.card,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  metricIconBox: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A2540',
  },
  metricSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  metricDividerVertical: {
    width: 1,
    height: '80%',
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
  },
});
