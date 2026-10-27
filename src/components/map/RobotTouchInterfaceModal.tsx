import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Bot,
  BatteryCharging,
  Gauge,
  Compass,
  MapPin,
  Clock,
  ShieldAlert,
  X,
  Package,
  CheckCircle2,
  Lock,
  Unlock,
  RotateCcw,
  AlertTriangle,
  Play,
  Pause,
} from 'lucide-react-native';
import { useHospitalMapStore } from '../../store/useHospitalMapStore';
import { HospitalSvgMap } from './HospitalSvgMap';
import { Colors } from '../../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface RobotTouchInterfaceModalProps {
  visible: boolean;
  onClose: () => void;
}

export const RobotTouchInterfaceModal: React.FC<RobotTouchInterfaceModalProps> = ({
  visible,
  onClose,
}) => {
  const {
    robotState,
    zones,
    openCompartment,
    closeCompartment,
    confirmDelivery,
    completeMissionAndReturn,
    emergencyStop,
    resumeNavigation,
  } = useHospitalMapStore();

  const targetZone = zones.find((z) => z.id === robotState.targetZoneId);

  const handleOpenCabinet = () => {
    if (robotState.compartmentOpen) {
      closeCompartment();
      Alert.alert('Robot', 'Đã khóa ngăn tủ chứa vật tư y tế.');
    } else {
      openCompartment();
      Alert.alert('Robot', 'Đã mở khóa ngăn tủ chứa vật tư y tế. Vui lòng lấy vật phẩm.');
    }
  };

  const handleConfirmDelivery = () => {
    confirmDelivery();
    Alert.alert('Thành công', 'Đã xác nhận bàn giao đồ y tế cho điều dưỡng tại phòng.');
  };

  const handleCompleteAndReturn = () => {
    Alert.alert(
      'Xác nhận hoàn tất',
      'Bạn có chắc chắn muốn kết thúc nhiệm vụ và cho Robot tự động quay về Trạm sạc?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Về trạm sạc ngay',
          style: 'default',
          onPress: () => {
            completeMissionAndReturn('charging-dock');
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} statusBarTranslucent>
      <View style={styles.kioskContainer}>
        {/* ========= 1. TOP KIOSK HUD HEADER ========= */}
        <View style={styles.hudHeader}>
          <View style={styles.hudLeft}>
            <View style={styles.robotAvatarBox}>
              <Bot size={22} color="#38BDF8" />
            </View>
            <View>
              <Text style={styles.robotTitleText}>{robotState.robotId} · ROBOT ON-BOARD INTERFACE</Text>
              <Text style={styles.robotSubText}>
                Hệ điều hành AMR Touch Kiosk · Model Gazebo Nav2
              </Text>
            </View>
          </View>

          {/* Telemetry Chips */}
          <View style={styles.telemetryGroup}>
            <View style={styles.telemetryChip}>
              <BatteryCharging size={16} color="#10B981" />
              <Text style={styles.telemetryValueText}>{robotState.batteryPercent}%</Text>
            </View>

            <View style={styles.telemetryChip}>
              <Gauge size={16} color="#38BDF8" />
              <Text style={styles.telemetryValueText}>
                {robotState.status === 'NAVIGATING' ? `${robotState.speedMps} m/s` : '0.0 m/s'}
              </Text>
            </View>

            <View style={styles.telemetryChip}>
              <Compass size={16} color="#F59E0B" />
              <Text style={styles.telemetryValueText}>{robotState.heading}°</Text>
            </View>

            {/* Nút thoát về chế độ Staff */}
            <TouchableOpacity style={styles.exitKioskBtn} onPress={onClose} activeOpacity={0.8}>
              <X size={18} color="#FFFFFF" />
              <Text style={styles.exitKioskText}>Về Staff App</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* ========= 2. BANNER TRẠNG THÁI & ĐÍCH ĐẾN (ETA) ========= */}
          <View
            style={[
              styles.missionStatusCard,
              robotState.status === 'NAVIGATING'
                ? styles.statusCardNavigating
                : robotState.status === 'ARRIVED'
                ? styles.statusCardArrived
                : robotState.status === 'BLOCKED'
                ? styles.statusCardBlocked
                : styles.statusCardIdle,
            ]}
          >
            <View style={styles.statusCardHeader}>
              <View style={styles.statusBadgeRow}>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        robotState.status === 'NAVIGATING'
                          ? '#0284C7'
                          : robotState.status === 'ARRIVED'
                          ? '#059669'
                          : robotState.status === 'BLOCKED'
                          ? '#DC2626'
                          : '#475569',
                    },
                  ]}
                >
                  <Text style={styles.statusPillText}>
                    {robotState.status === 'NAVIGATING'
                      ? '🚀 ĐANG TỰ HÀNH DI CHUYỂN'
                      : robotState.status === 'ARRIVED'
                      ? '🎯 ĐÃ ĐẾN ĐIỂM HẸN PHÒNG BỆNH'
                      : robotState.status === 'BLOCKED'
                      ? '⛔ ĐANG TẠM DỪNG / VẬT CẢN'
                      : '💤 SẴN SÀNG NHẬN LỆNH'}
                  </Text>
                </View>
              </View>

              {robotState.status === 'NAVIGATING' && (
                <View style={styles.etaBadge}>
                  <Clock size={16} color="#0284C7" />
                  <Text style={styles.etaText}>
                    Dự kiến đến: <Text style={{ fontWeight: '800' }}>{robotState.etaSeconds}s</Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.destinationRow}>
              <MapPin size={24} color={robotState.status === 'ARRIVED' ? '#059669' : '#0284C7'} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.destinationTitle}>
                  {targetZone ? targetZone.name : 'Chưa có phòng chỉ định (Đang ở Trạm sạc)'}
                </Text>
                <Text style={styles.destinationSub}>
                  {targetZone
                    ? `${targetZone.department} · Vị trí đỗ: (${targetZone.dockPoint.x}, ${targetZone.dockPoint.y})`
                    : 'Nhân viên y tế có thể chỉ định phòng trên màn hình Staff App'}
                </Text>
              </View>
            </View>

            {/* Thanh cảnh báo an toàn khi robot đang chạy */}
            {robotState.status === 'NAVIGATING' && (
              <View style={styles.warningStrip}>
                <AlertTriangle size={16} color="#D97706" />
                <Text style={styles.warningText}>
                  CẢNH BÁO: Robot đang di chuyển tự động trên hành lang. Vui lòng nhường đường!
                </Text>
              </View>
            )}
          </View>

          {/* ========= 3. BẢN ĐỒ BỆNH VIỆN 2D ĐỒNG BỘ 1200x680 ========= */}
          <View style={styles.mapSectionWrapper}>
            <View style={styles.mapSectionHeader}>
              <Text style={styles.mapSectionTitle}>🗺️ BẢN ĐỒ ĐỊNH VỊ THỜI GIAN THỰC (1200x680)</Text>
              <Text style={styles.mapCoordsText}>
                Tọa độ hiện tại: ({Math.round(robotState.x)}, {Math.round(robotState.y)})
              </Text>
            </View>
            <HospitalSvgMap interactive={false} mode="robot" />
          </View>

          {/* ========= 4. BẢNG ĐIỀU KHIỂN TƯƠNG TÁC TẠI ĐÍCH ĐẾN (ARRIVED PANEL) ========= */}
          {robotState.status === 'ARRIVED' && (
            <View style={styles.touchActionSection}>
              <Text style={styles.touchSectionTitle}>
                🔔 TƯƠNG TÁC TẠI PHÒNG: {targetZone?.name}
              </Text>

              <View style={styles.touchButtonsGrid}>
                {/* Nút 1: Mở ngăn tủ chứa đồ */}
                <TouchableOpacity
                  style={[
                    styles.bigTouchBtn,
                    robotState.compartmentOpen ? styles.btnCabinetOpen : styles.btnCabinetClosed,
                  ]}
                  onPress={handleOpenCabinet}
                  activeOpacity={0.8}
                >
                  {robotState.compartmentOpen ? (
                    <Unlock size={28} color="#059669" />
                  ) : (
                    <Lock size={28} color="#0284C7" />
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.bigTouchTitle}>
                      {robotState.compartmentOpen ? 'ĐÃ MỞ TỦ VẬT TƯ' : 'MỞ NGĂN TỦ CHỨA ĐỒ'}
                    </Text>
                    <Text style={styles.bigTouchSubtitle}>
                      {robotState.compartmentOpen
                        ? 'Nhấn để đóng khóa ngăn tủ lại'
                        : 'Mở khóa điện tử lấy thuốc/mẫu xét nghiệm'}
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Nút 2: Xác nhận đã giao đồ */}
                <TouchableOpacity
                  style={[
                    styles.bigTouchBtn,
                    robotState.deliveryConfirmed ? styles.btnConfirmed : styles.btnNormal,
                  ]}
                  onPress={handleConfirmDelivery}
                  activeOpacity={0.8}
                >
                  <CheckCircle2
                    size={28}
                    color={robotState.deliveryConfirmed ? '#059669' : '#0284C7'}
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.bigTouchTitle}>
                      {robotState.deliveryConfirmed ? 'ĐÃ XÁC NHẬN BÀN GIAO ✓' : 'ĐÃ GIAO ĐỒ XONG'}
                    </Text>
                    <Text style={styles.bigTouchSubtitle}>
                      Xác nhận nhân viên y tế đã nhận đủ vật tư
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Nút 3: Hoàn thành nhiệm vụ & Về trạm sạc */}
                <TouchableOpacity
                  style={[styles.bigTouchBtn, styles.btnCompleteReturn]}
                  onPress={handleCompleteAndReturn}
                  activeOpacity={0.85}
                >
                  <RotateCcw size={28} color="#FFFFFF" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.bigTouchTitle, { color: '#FFFFFF' }]}>
                      XÁC NHẬN HOÀN THÀNH & VỀ TRẠM
                    </Text>
                    <Text style={[styles.bigTouchSubtitle, { color: '#E0E7FF' }]}>
                      Robot sẽ tự động khóa tủ và chạy về Dock Sạc
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Nút dừng khẩn cấp khi đang di chuyển */}
          {robotState.status === 'NAVIGATING' && (
            <View style={styles.emergencyStopContainer}>
              <TouchableOpacity
                style={styles.emergencyStopBtn}
                onPress={emergencyStop}
                activeOpacity={0.8}
              >
                <Pause size={24} color="#FFFFFF" />
                <Text style={styles.emergencyStopBtnText}>TẠM DỪNG DI CHUYỂN KHẨN CẤP</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Nút tiếp tục khi bị dừng */}
          {robotState.status === 'BLOCKED' && (
            <View style={styles.emergencyStopContainer}>
              <TouchableOpacity
                style={[styles.emergencyStopBtn, { backgroundColor: '#059669' }]}
                onPress={resumeNavigation}
                activeOpacity={0.8}
              >
                <Play size={24} color="#FFFFFF" />
                <Text style={styles.emergencyStopBtnText}>TIẾP TỤC DI CHUYỂN ĐẾN ĐÍCH</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  kioskContainer: {
    flex: 1,
    backgroundColor: '#0F172A', // Nền tối chuyên dụng cho màn hình cảm ứng robot
    paddingTop: 36,
  },
  hudHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  hudLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  robotAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#38BDF8',
  },
  robotTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  robotSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  telemetryGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  telemetryValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  exitKioskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    marginLeft: 8,
  },
  exitKioskText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scrollBody: {
    flex: 1,
    padding: 16,
  },
  missionStatusCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
  },
  statusCardNavigating: {
    backgroundColor: '#0C4A6E',
    borderColor: '#38BDF8',
  },
  statusCardArrived: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
  },
  statusCardBlocked: {
    backgroundColor: '#7F1D1D',
    borderColor: '#F87171',
  },
  statusCardIdle: {
    backgroundColor: '#1E293B',
    borderColor: '#475569',
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  etaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E0F2FE',
  },
  etaText: {
    fontSize: 12,
    color: '#0369A1',
    fontWeight: '600',
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  destinationTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  destinationSub: {
    fontSize: 12,
    color: '#CBD5E1',
    marginTop: 2,
  },
  warningStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
  },
  warningText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
    flex: 1,
  },
  mapSectionWrapper: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  mapSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  mapSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  mapCoordsText: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  touchActionSection: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#34D399',
    marginBottom: 20,
  },
  touchSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#34D399',
    marginBottom: 14,
  },
  touchButtonsGrid: {
    gap: 12,
  },
  bigTouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  btnCabinetClosed: {
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
  },
  btnCabinetOpen: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
  },
  btnNormal: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  btnConfirmed: {
    backgroundColor: '#064E3B',
    borderColor: '#34D399',
  },
  btnCompleteReturn: {
    backgroundColor: '#4338CA',
    borderColor: '#6366F1',
  },
  bigTouchTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  bigTouchSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  emergencyStopContainer: {
    marginBottom: 24,
  },
  emergencyStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 12,
  },
  emergencyStopBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
