import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../constants/theme';
import { LogOut, Settings, AlertTriangle } from 'lucide-react-native';

// ----- Dữ liệu phòng bệnh viện -----
interface Room {
  id: string;
  name: string;
  row: number;
  col: number;
  colSpan?: number;
  rowSpan?: number;
  bgColor?: string;
  hasSOS?: boolean;
  isHallway?: boolean;
}

const ROOMS: Room[] = [
  { id: 'tiep_nhan',    name: 'Tiếp nhận',     row: 0, col: 0, bgColor: '#FFFFFF' },
  { id: 'noi_th',       name: 'P. Nội TH',     row: 0, col: 2, bgColor: '#E0F2FE' },
  { id: 'kho_sos',      name: 'Kho',            row: 1, col: 0, bgColor: '#FEF2F2', hasSOS: true },
  { id: 'tim_mach',     name: 'P. Tim mạch',   row: 1, col: 2, bgColor: '#F0FDF4' },
  { id: 'xet_nghiem',   name: 'P. Xét nghiệm', row: 2, col: 0, bgColor: '#FFFBEB' },
  { id: 'sieu_am',      name: 'P. Siêu âm',    row: 2, col: 2, bgColor: '#F5F3FF' },
  { id: 'nha_thuoc',    name: 'Nhà thuốc',     row: 3, col: 0, bgColor: '#FFF7ED' },
  { id: 'nhi_khoa',     name: 'P. Nhi khoa',   row: 3, col: 2, bgColor: '#F0FDF4' },
];

const LEGEND = [
  { color: '#10B981', label: 'Robot' },
  { color: '#3B82F6', label: 'Điểm đến' },
  { color: '#F59E0B', label: 'Đồng người' },
  { color: '#EF4444', label: 'Chặn' },
  { color: '#EF4444', label: 'SOS' },
];

export const MapScreen: React.FC = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [progress] = useState(82);

  // SOS pulse animation
  const sosAnim = useRef(new Animated.Value(1)).current;
  // Sheet slide animation
  const sheetAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, '0');
      const mm = now.getMinutes().toString().padStart(2, '0');
      const ss = now.getSeconds().toString().padStart(2, '0');
      setCurrentTime(`${hh}:${mm}:${ss}`);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
        Animated.timing(sosAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const openSheet = useCallback((room: Room) => {
    setSelectedRoom(room);
    setShowSheet(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }, []);

  const closeSheet = useCallback(() => {
    Animated.timing(sheetAnim, {
      toValue: 300,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setShowSheet(false);
      setSelectedRoom(null);
    });
  }, []);

  const handleSendRobot = useCallback(() => {
    console.log(`Gửi robot đến: ${selectedRoom?.name}`);
    closeSheet();
  }, [selectedRoom, closeSheet]);

  return (
    <View style={styles.container}>
      {/* ========= HEADER ========= */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={styles.brandSmall}>MEDIASSISTROVER · STAFF</Text>
              <View style={styles.badgeOnDuty}>
                <Text style={styles.badgeOnDutyText}>ĐANG TRỰC</Text>
              </View>
            </View>
            <Text style={styles.staffName}>Y tá Nguyễn Văn An</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} activeOpacity={0.7}>
          <LogOut size={14} color={Colors.primary} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* ========= SUB HEADER ========= */}
      <View style={styles.subHeader}>
        <Text style={styles.subHeaderLeft}>
          <Text style={styles.digitalTwinLabel}>DIGITAL TWIN · Y TÁ NGUYỄN VĂN AN</Text>
          {'   '}
          <Text style={styles.clockText}>{currentTime}</Text>
        </Text>
        <View style={styles.subHeaderRight}>
          <TouchableOpacity style={styles.sosButton} activeOpacity={0.8}>
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingButton} activeOpacity={0.7}>
            <Settings size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ========= HOSPITAL MAP ========= */}
      <View style={styles.mapContainer}>
        {/* Rooms Grid */}
        <View style={styles.grid}>
          {/* Row 0 */}
          <View style={styles.gridRow}>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#FFFFFF' }]}
              onPress={() => openSheet(ROOMS[0])} activeOpacity={0.8}>
              <Text style={styles.roomName}>Tiếp nhận</Text>
            </TouchableOpacity>
            <View style={[styles.room, styles.hallwayCol]} />
            <TouchableOpacity style={[styles.room, { backgroundColor: '#E0F2FE' }]}
              onPress={() => openSheet(ROOMS[1])} activeOpacity={0.8}>
              <Text style={styles.roomName}>P. Nội TH</Text>
              <View style={styles.robotDot} />
            </TouchableOpacity>
          </View>

          {/* Row 1 - with robot path */}
          <View style={styles.gridRow}>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#FEF2F2' }]}
              onPress={() => openSheet(ROOMS[2])} activeOpacity={0.8}>
              <Animated.View style={[styles.sosDotOuter, { transform: [{ scale: sosAnim }] }]}>
                <View style={styles.sosDotInner}>
                  <Text style={styles.sosDotText}>SOS</Text>
                </View>
              </Animated.View>
              <Text style={[styles.roomName, { marginTop: 4 }]}>Kho</Text>
            </TouchableOpacity>
            <View style={[styles.room, styles.hallwayCol]}>
              {/* Robot icon (triangle) */}
              <View style={styles.robotTriangle} />
            </View>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#F0FDF4' }]}
              onPress={() => openSheet(ROOMS[3])} activeOpacity={0.8}>
              <Text style={styles.roomName}>P. Tim mạch</Text>
            </TouchableOpacity>
          </View>

          {/* Hallway Row */}
          <View style={[styles.gridRow, styles.hallwayRow]}>
            <Text style={styles.hallwayLabel}>HÀNH LANG CHÍNH</Text>
            <View style={styles.staffDot} />
          </View>

          {/* Row 2 */}
          <View style={styles.gridRow}>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#FFFBEB' }]}
              onPress={() => openSheet(ROOMS[4])} activeOpacity={0.8}>
              <Text style={styles.roomName}>P. Xét nghiệm</Text>
            </TouchableOpacity>
            <View style={[styles.room, styles.hallwayCol]} />
            <TouchableOpacity style={[styles.room, { backgroundColor: '#F5F3FF' }]}
              onPress={() => openSheet(ROOMS[5])} activeOpacity={0.8}>
              <Text style={styles.roomName}>P. Siêu âm</Text>
            </TouchableOpacity>
          </View>

          {/* Row 3 */}
          <View style={styles.gridRow}>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#FFF7ED' }]}
              onPress={() => openSheet(ROOMS[6])} activeOpacity={0.8}>
              <Text style={styles.roomName}>Nhà thuốc</Text>
            </TouchableOpacity>
            <View style={[styles.room, styles.hallwayCol]}>
              <Text style={styles.entranceLabel}>◀ LỐI VÀO ▶</Text>
            </View>
            <TouchableOpacity style={[styles.room, { backgroundColor: '#F0FDF4' }]}
              onPress={() => openSheet(ROOMS[7])} activeOpacity={0.8}>
              <Text style={styles.roomName}>P. Nhi khoa</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Status Bar */}
        <View style={styles.statusBar}>
          <View style={styles.statusLeft}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>ĐANG VẬN CHUYỂN</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{progress}%</Text>
          <Text style={styles.arrowUp}>▲</Text>
        </View>
      </View>

      {/* ========= BOTTOM SHEET (Room Selection) ========= */}
      <Modal
        visible={showSheet}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeSheet}>
          <Animated.View
            style={[styles.bottomSheet, { transform: [{ translateY: sheetAnim }] }]}
          >
            <TouchableOpacity activeOpacity={1}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetLabel}>ĐIỀU ROBOT ĐẾN</Text>
              <Text style={styles.sheetRoomName}>{selectedRoom?.name}</Text>
              <View style={styles.sheetButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeSheet} activeOpacity={0.8}>
                  <Text style={styles.cancelBtnText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sendBtn} onPress={handleSendRobot} activeOpacity={0.8}>
                  <Text style={styles.sendBtnText}>✓ Gửi robot</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatarCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.teal, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brandSmall: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5 },
  badgeOnDuty: {
    backgroundColor: '#D1FAE5', borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  badgeOnDutyText: { fontSize: 9, fontWeight: '700', color: Colors.emerald },
  staffName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: Colors.primary, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  logoutText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  // Sub Header
  subHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  subHeaderLeft: { flex: 1 },
  digitalTwinLabel: { fontSize: 10, fontWeight: '600', color: Colors.primary, letterSpacing: 0.5 },
  clockText: { fontSize: 10, fontWeight: '500', color: Colors.textSecondary },
  subHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosButton: {
    backgroundColor: '#EF4444', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  sosButtonText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  settingButton: { padding: 4 },
  // Map
  mapContainer: { flex: 1, padding: Spacing.sm },
  grid: { flex: 1, gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4, flex: 1 },
  room: {
    flex: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', padding: 4,
    minHeight: 60,
  },
  hallwayCol: { flex: 0.5, backgroundColor: '#EEF6FB' },
  hallwayRow: {
    flex: 0, height: 28, backgroundColor: '#FEF3C7',
    borderRadius: 6, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#FCD34D', flexDirection: 'row',
    paddingHorizontal: 8,
  },
  hallwayLabel: { fontSize: 9, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  roomName: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  entranceLabel: { fontSize: 8, color: Colors.textSecondary, textAlign: 'center' },
  // Robot
  robotTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderBottomWidth: 18,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    borderBottomColor: Colors.emerald,
  },
  robotDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.emerald,
    position: 'absolute', top: 6, right: 6,
  },
  // SOS
  sosDotOuter: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(239,68,68,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  sosDotInner: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#EF4444',
    alignItems: 'center', justifyContent: 'center',
  },
  sosDotText: { fontSize: 8, fontWeight: '800', color: '#FFF' },
  staffDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: '#F59E0B',
    borderWidth: 2, borderColor: '#FFF', marginLeft: 'auto', marginRight: 20,
  },
  // Legend
  legend: {
    flexDirection: 'row', justifyContent: 'center', gap: 10,
    paddingVertical: 6, flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.textSecondary },
  // Status Bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border, gap: 8,
    ...Shadows.card,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.emerald },
  statusText: { fontSize: 11, fontWeight: '700', color: Colors.textPrimary },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.teal, borderRadius: 3 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: Colors.teal },
  arrowUp: { fontSize: 12, color: Colors.teal },
  // Bottom Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    ...Shadows.floating,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 20,
  },
  sheetLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 4,
  },
  sheetRoomName: { fontSize: 24, fontWeight: '700', color: Colors.textPrimary, marginBottom: 24 },
  sheetButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1, height: 48, borderRadius: 12,
    borderWidth: 1.5, borderColor: Colors.teal,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.teal },
  sendBtn: {
    flex: 1, height: 48, borderRadius: 12,
    backgroundColor: Colors.emerald,
    alignItems: 'center', justifyContent: 'center',
    ...Shadows.button,
  },
  sendBtnText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
