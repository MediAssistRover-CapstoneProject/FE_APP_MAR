import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../constants/theme';
import {
  LogOut,
  Settings,
  Video,
  Check,
  Pause,
  Play,
  RotateCcw,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
  Pill,
  FlaskConical,
  Radio,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ===== Dữ liệu phòng bệnh viện =====
interface Room {
  id: string;
  name: string;
  row: number;
  col: number;
  bgColor?: string;
  hasSOS?: boolean;
  isActive?: boolean;
}

const ROOMS: Room[] = [
  { id: 'tiep_nhan',    name: 'Tiếp nhận',     row: 0, col: 0, bgColor: '#FFFFFF' },
  { id: 'noi_th',       name: 'P. Nội TH',     row: 0, col: 2, bgColor: '#E0F2FE' },
  { id: 'kho_sos',      name: 'Kho',            row: 1, col: 0, bgColor: '#FEF2F2', hasSOS: true },
  { id: 'tim_mach',     name: 'P. Tim mạch',   row: 1, col: 2, bgColor: '#F0FDF4' },
  { id: 'xet_nghiem',   name: 'P. Xét nghiệm', row: 2, col: 0, bgColor: '#FFFBEB' },
  { id: 'sieu_am',      name: 'P. Siêu âm',    row: 2, col: 2, bgColor: '#F5F3FF' },
  { id: 'nha_thuoc',    name: 'Nhà thuốc',     row: 3, col: 0, bgColor: '#FFF7ED' },
  { id: 'nhi_khoa',     name: 'P. Nhi khoa',   row: 3, col: 2, bgColor: '#E0F2FE', isActive: true },
];

const LEGEND = [
  { color: '#10B981', label: 'Robot' },
  { color: '#3B82F6', label: 'Điểm đến' },
  { color: '#F59E0B', label: 'Đông người' },
  { color: '#EA580C', label: 'Chặn' },
  { color: '#EF4444', label: 'SOS' },
];

// ===== 19 Bước Tiến Trình Nhiệm Vụ =====
interface TaskStep {
  id: number;
  label: string;
  status: 'completed' | 'in_progress' | 'upcoming';
}

const TASK_STEPS: TaskStep[] = [
  { id: 1,  label: 'Đã tạo nhiệm vụ',      status: 'completed' },
  { id: 2,  label: 'Đang chờ xử lý',       status: 'completed' },
  { id: 3,  label: 'Robot đã nhận',        status: 'completed' },
  { id: 4,  label: 'Đến nơi gửi',          status: 'completed' },
  { id: 5,  label: 'Chờ đặt vật phẩm',     status: 'completed' },
  { id: 6,  label: 'Xác nhận vật phẩm',    status: 'completed' },
  { id: 7,  label: 'Đã nhận vật phẩm',     status: 'completed' },
  { id: 8,  label: 'Đã khóa thùng',        status: 'completed' },
  { id: 9,  label: 'Đang vận chuyển',      status: 'in_progress' },
  { id: 10, label: 'Đã đến điểm giao',     status: 'upcoming' },
  { id: 11, label: 'Chờ xác nhận',         status: 'upcoming' },
  { id: 12, label: 'Đang xác minh',        status: 'upcoming' },
  { id: 13, label: 'Xác minh thành công',  status: 'upcoming' },
  { id: 14, label: 'Đã mở thùng',          status: 'upcoming' },
  { id: 15, label: 'Chờ lấy vật phẩm',     status: 'upcoming' },
  { id: 16, label: 'Vật phẩm đã lấy',      status: 'upcoming' },
  { id: 17, label: 'Đã đóng thùng',        status: 'upcoming' },
  { id: 18, label: 'Đã bàn giao',          status: 'upcoming' },
  { id: 19, label: 'Hoàn thành',           status: 'upcoming' },
];

// ===== Hàng đợi nhiệm vụ =====
interface QueueItem {
  id: number;
  title: string;
  subtitle: string;
  type: 'medicine' | 'document' | 'blood';
  color: string;
}

const QUEUE_ITEMS: QueueItem[] = [
  {
    id: 1,
    title: 'Đơn thuốc #BN2047',
    subtitle: 'Nhà thuốc → P. Tim mạch',
    type: 'medicine',
    color: '#EF4444',
  },
  {
    id: 2,
    title: 'Hồ sơ bệnh án #BN1983',
    subtitle: 'Phòng lưu trữ → P. Nội TH',
    type: 'document',
    color: '#F59E0B',
  },
  {
    id: 3,
    title: '4 ống mẫu máu #XN0388',
    subtitle: 'P. Nội TH → P. Xét nghiệm',
    type: 'blood',
    color: '#EF4444',
  },
];

export const MapScreen: React.FC = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showRoomSheet, setShowRoomSheet] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [showTimelineSheet, setShowTimelineSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [robotStatus, setRobotStatus] = useState<'running' | 'paused'>('running');

  // Animation values
  const sosAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Realtime clock
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

  // SOS pulse animation
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(sosAnim, { toValue: 1.35, duration: 800, useNativeDriver: true }),
        Animated.timing(sosAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [sosAnim]);

  // Blue active step pulse animation
  useEffect(() => {
    const activePulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    activePulse.start();
    return () => activePulse.stop();
  }, [pulseAnim]);

  const handleOpenRoomSheet = useCallback((room: Room) => {
    setSelectedRoom(room);
    setShowRoomSheet(true);
  }, []);

  const handleConfirmPause = useCallback(() => {
    setRobotStatus('paused');
    setShowConfirmModal(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* ========= HEADER ========= */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>🤖</Text>
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
          <LogOut size={13} color={Colors.primary} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* ========= SUB HEADER ========= */}
      <View style={styles.subHeader}>
        <View style={styles.subHeaderLeft}>
          <Text style={styles.digitalTwinLabel}>DIGITAL TWIN · Y TÁ NGUYỄN VĂN AN</Text>
          <Text style={styles.clockText}>{currentTime}</Text>
        </View>
        <View style={styles.subHeaderRight}>
          <TouchableOpacity style={styles.sosButton} activeOpacity={0.8}>
            <Text style={styles.sosButtonText}>SOS</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cameraButton} activeOpacity={0.8}>
            <Video size={16} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {/* ========= HOSPITAL MAP ========= */}
        <View style={styles.mapContainer}>
          <View style={styles.grid}>
            {/* Row 0 */}
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#FFFFFF' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[0])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>Tiếp nhận</Text>
              </TouchableOpacity>
              <View style={[styles.room, styles.hallwayCol]} />
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#E0F2FE' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[1])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>P. Nội TH</Text>
                <View style={styles.robotTargetDot} />
              </TouchableOpacity>
            </View>

            {/* Row 1 - with robot and path */}
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#FEF2F2' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[2])}
                activeOpacity={0.8}
              >
                <Animated.View style={[styles.sosDotOuter, { transform: [{ scale: sosAnim }] }]}>
                  <View style={styles.sosDotInner}>
                    <Text style={styles.sosDotText}>SOS</Text>
                  </View>
                </Animated.View>
                <Text style={[styles.roomName, { marginTop: 2 }]}>Kho</Text>
              </TouchableOpacity>
              <View style={[styles.room, styles.hallwayCol, styles.hallwayCenter]}>
                <View style={styles.robotTriangleWrapper}>
                  <View style={styles.robotPulseRing} />
                  <View style={styles.robotTriangle} />
                </View>
              </View>
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#F0FDF4' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[3])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>P. Tim mạch</Text>
              </TouchableOpacity>
            </View>

            {/* Hallway Banner */}
            <View style={[styles.gridRow, styles.hallwayRow]}>
              <Text style={styles.hallwayLabel}>HÀNH LANG CHÍNH</Text>
              <View style={styles.staffOrangeBlock} />
            </View>

            {/* Row 2 */}
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#FFFBEB' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[4])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>P. Xét nghiệm</Text>
              </TouchableOpacity>
              <View style={[styles.room, styles.hallwayCol]} />
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#F5F3FF' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[5])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>P. Siêu âm</Text>
              </TouchableOpacity>
            </View>

            {/* Row 3 */}
            <View style={styles.gridRow}>
              <TouchableOpacity
                style={[styles.room, { backgroundColor: '#FFF7ED' }]}
                onPress={() => handleOpenRoomSheet(ROOMS[6])}
                activeOpacity={0.8}
              >
                <Text style={styles.roomName}>Nhà thuốc</Text>
              </TouchableOpacity>
              <View style={[styles.room, styles.hallwayCol, { justifyContent: 'center' }]}>
                <Text style={styles.entranceLabel}>◀ LỐI VÀO ▶</Text>
              </View>
              <TouchableOpacity
                style={[styles.room, styles.roomActive]}
                onPress={() => handleOpenRoomSheet(ROOMS[7])}
                activeOpacity={0.8}
              >
                <Text style={[styles.roomName, { color: Colors.tealDark }]}>P. Nhi khoa</Text>
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
        </View>

        {/* ========= TRACKING & FUNCTION DASHBOARD (Hình 5) ========= */}
        <View style={styles.dashboardContainer}>
          {/* Header Bar */}
          <TouchableOpacity
            style={styles.dashboardHeader}
            onPress={() => setIsExpanded(!isExpanded)}
            activeOpacity={0.8}
          >
            <View style={styles.statusLeft}>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: robotStatus === 'running' ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.statusTitle}>
                {robotStatus === 'running' ? 'ĐANG VẬN CHUYỂN' : 'TẠM DỪNG'}
              </Text>
            </View>
            <View style={styles.statusRight}>
              <Text style={styles.batteryText}>🔋 82%</Text>
              {isExpanded ? (
                <ChevronUp size={18} color={Colors.textSecondary} />
              ) : (
                <ChevronDown size={18} color={Colors.textSecondary} />
              )}
            </View>
          </TouchableOpacity>

          {/* Expandable Content */}
          {isExpanded && (
            <View style={styles.dashboardBody}>
              {/* 6 Info Cards */}
              <View style={styles.infoCardsGrid}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>ZONE HIỆN TẠI</Text>
                  <Text style={styles.infoCardValue}>Khu chờ</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>KẾT NỐI</Text>
                  <Text style={[styles.infoCardValue, { color: '#10B981' }]}>🟢 Ổn định</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>MỨC ƯU TIÊN</Text>
                  <Text style={[styles.infoCardValue, { color: '#EF4444' }]}>Ưu tiên cao</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>BẢO MẬT</Text>
                  <Text style={[styles.infoCardValue, { color: Colors.primary }]}>
                    Xác nhận khuôn mặt
                  </Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>ĐIỂM ĐẾN</Text>
                  <Text style={styles.infoCardValue}>P. Tim mạch</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>ƯỚC TÍNH</Text>
                  <Text style={styles.infoCardValue}>~8 phút</Text>
                </View>
              </View>

              {/* Action Buttons Row 1 */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.actionBtnLight}
                  onPress={() => setShowQueueSheet(true)}
                  activeOpacity={0.8}
                >
                  <FileText size={15} color={Colors.primary} />
                  <Text style={styles.actionBtnLightText}>Hàng đợi</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnOrange}
                  onPress={() => setShowConfirmModal(true)}
                  activeOpacity={0.8}
                >
                  <Pause size={15} color="#D97706" />
                  <Text style={styles.actionBtnOrangeText}>Tạm dừng</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtnRed}
                  onPress={() => setRobotStatus('paused')}
                  activeOpacity={0.8}
                >
                  <AlertTriangle size={15} color="#EF4444" />
                  <Text style={styles.actionBtnRedText}>Dừng khẩn</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons Row 2 */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.manualControlBtn} activeOpacity={0.8}>
                  <Radio size={16} color={Colors.primary} />
                  <Text style={styles.manualControlText}>Điều khiển thủ công</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.progressBtn}
                  onPress={() => setShowTimelineSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.progressBtnText}>Tiến trình ➔</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ========================================================
          MODAL 1: HÀNG ĐỢI NHIỆM VỤ (Hình 4)
      ======================================================== */}
      <Modal visible={showQueueSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.queueSheetTitle}>Hàng đợi ({QUEUE_ITEMS.length})</Text>

            <View style={styles.queueList}>
              {QUEUE_ITEMS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.queueCard}
                  onPress={() => {
                    setShowQueueSheet(false);
                    setShowTimelineSheet(true);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.queueNumberBadge, { backgroundColor: item.color }]}>
                    <Text style={styles.queueNumberText}>{item.id}</Text>
                  </View>
                  <View style={styles.queueCardContent}>
                    <Text style={styles.queueItemTitle}>
                      {item.type === 'medicine' ? '💊 ' : item.type === 'document' ? '📋 ' : '🧪 '}
                      {item.title}
                    </Text>
                    <Text style={styles.queueItemSubtitle}>{item.subtitle}</Text>
                  </View>
                  <ArrowRight size={16} color={Colors.primary} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setShowQueueSheet(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 2: TIẾN TRÌNH & CHI TIẾT NHIỆM VỤ (Hình 2 & 3)
      ======================================================== */}
      <Modal visible={showTimelineSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheetContainer, { maxHeight: SCREEN_HEIGHT * 0.88 }]}>
            <View style={styles.sheetHandle} />

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Task Header Box */}
              <View style={styles.taskDetailHeader}>
                <View style={styles.taskDetailIconBox}>
                  <Pill size={24} color="#EF4444" />
                </View>
                <View style={styles.taskDetailInfo}>
                  <Text style={styles.taskDetailCode}>#TD01 · 09:05</Text>
                  <Text style={styles.taskDetailTitle}>Vận chuyển thuốc</Text>
                  <Text style={styles.taskDetailSubtitle}>Đơn thuốc #BN2047</Text>
                </View>
              </View>

              {/* Badges Row */}
              <View style={styles.badgesRow}>
                <View style={styles.badgeRed}>
                  <Text style={styles.badgeRedText}>🔴 Ưu tiên cao</Text>
                </View>
                <View style={styles.badgeTeal}>
                  <Text style={styles.badgeTealText}>👤 Xác nhận khuôn mặt</Text>
                </View>
                <View style={styles.badgeBlue}>
                  <Text style={styles.badgeBlueText}>⏰ 09:30</Text>
                </View>
              </View>

              {/* Route Card */}
              <View style={styles.routeCard}>
                <View style={styles.routeItem}>
                  <Text style={styles.routeLabel}>TỪ</Text>
                  <Text style={styles.routeName}>Nhà thuốc</Text>
                </View>
                <ArrowRight size={18} color={Colors.textSecondary} style={{ marginHorizontal: 8 }} />
                <View style={styles.routeItem}>
                  <Text style={styles.routeLabel}>ĐẾN</Text>
                  <Text style={styles.routeName}>P. Tim mạch</Text>
                </View>
              </View>

              {/* 19-Step Vertical Timeline */}
              <Text style={styles.timelineSectionTitle}>TIẾN TRÌNH NHIỆM VỤ</Text>
              <View style={styles.timelineList}>
                {TASK_STEPS.map((step, index) => {
                  const isCompleted = step.status === 'completed';
                  const isInProgress = step.status === 'in_progress';
                  const isLast = index === TASK_STEPS.length - 1;

                  return (
                    <View key={step.id} style={styles.timelineItem}>
                      {/* Left icon / connector */}
                      <View style={styles.timelineLeftColumn}>
                        {isCompleted && (
                          <View style={styles.timelineCheckCircle}>
                            <Check size={12} color="#FFFFFF" strokeWidth={3} />
                          </View>
                        )}
                        {isInProgress && (
                          <Animated.View
                            style={[
                              styles.timelineActiveCircle,
                              { transform: [{ scale: pulseAnim }] },
                            ]}
                          >
                            <View style={styles.timelineActiveInner} />
                          </Animated.View>
                        )}
                        {!isCompleted && !isInProgress && (
                          <View style={styles.timelineUpcomingCircle} />
                        )}
                        {!isLast && (
                          <View
                            style={[
                              styles.timelineLine,
                              isCompleted && styles.timelineLineCompleted,
                            ]}
                          />
                        )}
                      </View>

                      {/* Right content */}
                      <View style={styles.timelineRightContent}>
                        <Text
                          style={[
                            styles.timelineLabel,
                            isCompleted && styles.timelineLabelCompleted,
                            isInProgress && styles.timelineLabelActive,
                          ]}
                        >
                          {step.label}
                        </Text>
                        {isInProgress && (
                          <Text style={styles.timelineSubtext}>● Đang thực hiện</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Staff Actions Grid */}
              <Text style={styles.staffActionSectionTitle}>HÀNH ĐỘNG CỦA STAFF</Text>
              <View style={styles.staffActionGrid}>
                <TouchableOpacity
                  style={styles.staffActionBtnOrange}
                  onPress={() => setShowConfirmModal(true)}
                  activeOpacity={0.8}
                >
                  <Pause size={16} color="#D97706" />
                  <Text style={styles.staffActionTextOrange}>Tạm dừng</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.staffActionBtnOrange} activeOpacity={0.8}>
                  <RotateCcw size={16} color="#D97706" />
                  <Text style={styles.staffActionTextOrange}>Trả vật phẩm</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.staffActionBtnTeal} activeOpacity={0.8}>
                  <Clock size={16} color={Colors.tealDark} />
                  <Text style={styles.staffActionTextTeal}>Chờ thêm</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.staffActionBtnBlue} activeOpacity={0.8}>
                  <Radio size={16} color={Colors.primary} />
                  <Text style={styles.staffActionTextBlue}>Xác minh lại</Text>
                </TouchableOpacity>
              </View>

              {/* Note Box */}
              <View style={styles.noteBox}>
                <Text style={styles.noteBoxLabel}>GHI CHÚ</Text>
                <Text style={styles.noteBoxContent}>Thuốc huyết áp khẩn</Text>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setShowTimelineSheet(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetCloseButtonText}>Đóng</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 3: XÁC NHẬN TẠM DỪNG (Hình 1)
      ======================================================== */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmBox}>
            <View style={styles.warningIconCircle}>
              <AlertTriangle size={32} color="#D97706" strokeWidth={2.5} />
            </View>
            <Text style={styles.confirmTitle}>Xác nhận</Text>
            <Text style={styles.confirmSubtitle}>Tạm dừng nhiệm vụ?</Text>

            <View style={styles.confirmBtnRow}>
              <TouchableOpacity
                style={styles.confirmCancelBtn}
                onPress={() => setShowConfirmModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmCancelText}>Hủy</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmAcceptBtn}
                onPress={handleConfirmPause}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmAcceptText}>Xác nhận</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 4: ĐIỀU ROBOT ĐẾN PHÒNG (Room Selection)
      ======================================================== */}
      <Modal visible={showRoomSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.sheetContainer}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetLabel}>ĐIỀU ROBOT ĐẾN</Text>
            <Text style={styles.sheetRoomName}>{selectedRoom?.name}</Text>
            <View style={styles.sheetButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowRoomSheet(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.sendBtn}
                onPress={() => {
                  setShowRoomSheet(false);
                  setShowTimelineSheet(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.sendBtnText}>✓ Gửi robot</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mainScroll: { flex: 1 },

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
  avatarText: { fontSize: 18 },
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

  // Sub Header
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  subHeaderLeft: { flex: 1 },
  digitalTwinLabel: { fontSize: 10, fontWeight: '600', color: Colors.primary, letterSpacing: 0.5 },
  clockText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginTop: 1 },
  subHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sosButton: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  sosButtonText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  cameraButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Map
  mapContainer: { padding: Spacing.sm },
  grid: { gap: 4 },
  gridRow: { flexDirection: 'row', gap: 4, height: 68 },
  room: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  roomActive: {
    backgroundColor: '#CCFBF1',
    borderWidth: 2,
    borderColor: Colors.tealDark,
  },
  hallwayCol: { flex: 0.5, backgroundColor: '#EEF6FB' },
  hallwayCenter: { justifyContent: 'center', alignItems: 'center' },
  hallwayRow: {
    height: 28,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FCD34D',
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  hallwayLabel: { fontSize: 9, fontWeight: '700', color: '#92400E', letterSpacing: 0.5 },
  roomName: { fontSize: 11, fontWeight: '600', color: Colors.textPrimary, textAlign: 'center' },
  entranceLabel: { fontSize: 8, color: Colors.textSecondary, textAlign: 'center' },
  staffOrangeBlock: {
    width: 22,
    height: 14,
    borderRadius: 4,
    backgroundColor: '#EA580C',
    marginLeft: 'auto',
  },

  // Robot Icon in Map
  robotTriangleWrapper: { alignItems: 'center', justifyContent: 'center' },
  robotPulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(16,185,129,0.25)',
  },
  robotTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: Colors.emerald,
  },
  robotTargetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // SOS Dot
  sosDotOuter: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(239,68,68,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosDotInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosDotText: { fontSize: 8, fontWeight: '800', color: '#FFF' },

  // Legend
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, color: Colors.textSecondary },

  // Dashboard (Hình 5)
  dashboardContainer: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Shadows.card,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    backgroundColor: Colors.surfaceSubtle,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { fontSize: 13, fontWeight: '800', color: Colors.textPrimary, letterSpacing: 0.5 },
  statusRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  batteryText: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  dashboardBody: { padding: Spacing.md },

  // Info Cards Grid
  infoCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.md,
  },
  infoCard: {
    width: '48.5%',
    backgroundColor: '#F0F7FF',
    borderRadius: BorderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E0EDFA',
  },
  infoCardLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  infoCardValue: { fontSize: 13, fontWeight: '700', color: Colors.textPrimary },

  // Action Rows
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  actionBtnLight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: BorderRadius.md,
    height: 40,
    gap: 4,
  },
  actionBtnLightText: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  actionBtnOrange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.md,
    height: 40,
    gap: 4,
  },
  actionBtnOrangeText: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  actionBtnRed: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: BorderRadius.md,
    height: 40,
    gap: 4,
  },
  actionBtnRedText: { fontSize: 12, fontWeight: '600', color: '#EF4444' },

  manualControlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: BorderRadius.md,
    height: 42,
    gap: 6,
  },
  manualControlText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  progressBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: BorderRadius.md,
    height: 42,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  progressBtnText: { fontSize: 13, fontWeight: '700', color: Colors.tealDark },

  // Modal / Bottom Sheet General
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
    paddingBottom: 32,
    ...Shadows.floating,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetCloseButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  sheetCloseButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary },

  // Modal 1: Queue (Hình 4)
  queueSheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  queueList: { gap: 10 },
  queueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0EDFA',
    gap: 12,
  },
  queueNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueNumberText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  queueCardContent: { flex: 1 },
  queueItemTitle: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  queueItemSubtitle: { fontSize: 12, color: Colors.textSecondary },

  // Modal 2: Task Detail & Timeline (Hình 2 & 3)
  taskDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  taskDetailIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskDetailInfo: { flex: 1 },
  taskDetailCode: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  taskDetailTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  taskDetailSubtitle: { fontSize: 12, color: Colors.textSecondary },

  badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 14, flexWrap: 'wrap' },
  badgeRed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeRedText: { fontSize: 11, fontWeight: '600', color: '#EF4444' },
  badgeTeal: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeTealText: { fontSize: 11, fontWeight: '600', color: Colors.tealDark },
  badgeBlue: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeBlueText: { fontSize: 11, fontWeight: '600', color: Colors.primary },

  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0EDFA',
    marginBottom: 16,
  },
  routeItem: { flex: 1 },
  routeLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  routeName: { fontSize: 14, fontWeight: '700', color: Colors.textPrimary, marginTop: 2 },

  timelineSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  timelineList: { paddingLeft: 6, marginBottom: 16 },
  timelineItem: { flexDirection: 'row', minHeight: 38 },
  timelineLeftColumn: { width: 26, alignItems: 'center' },
  timelineCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineActiveCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineActiveInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  timelineUpcomingCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  timelineLineCompleted: { backgroundColor: Colors.emerald },
  timelineRightContent: { flex: 1, paddingLeft: 12, paddingBottom: 10 },
  timelineLabel: { fontSize: 13, color: Colors.textMuted },
  timelineLabelCompleted: { color: Colors.emerald, fontWeight: '600' },
  timelineLabelActive: { color: '#3B82F6', fontWeight: '700' },
  timelineSubtext: { fontSize: 11, color: '#3B82F6', marginTop: 2 },

  staffActionSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  staffActionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  staffActionBtnOrange: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    height: 42,
    gap: 6,
  },
  staffActionTextOrange: { fontSize: 12, fontWeight: '600', color: '#D97706' },
  staffActionBtnTeal: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    height: 42,
    gap: 6,
  },
  staffActionTextTeal: { fontSize: 12, fontWeight: '600', color: Colors.tealDark },
  staffActionBtnBlue: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    height: 42,
    gap: 6,
  },
  staffActionTextBlue: { fontSize: 12, fontWeight: '600', color: Colors.primary },

  noteBox: {
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0EDFA',
    marginBottom: 8,
  },
  noteBoxLabel: { fontSize: 10, fontWeight: '700', color: Colors.textMuted },
  noteBoxContent: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary, marginTop: 2 },

  // Modal 3: Confirmation (Hình 1)
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    ...Shadows.floating,
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: 6 },
  confirmSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 24 },
  confirmBtnRow: { flexDirection: 'row', gap: 12, width: '100%' },
  confirmCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmCancelText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  confirmAcceptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmAcceptText: { fontSize: 14, fontWeight: '700', color: '#FFF' },

  // Modal 4: Room dispatch
  sheetLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sheetRoomName: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, marginBottom: 20 },
  sheetButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: Colors.teal },
  sendBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.emerald,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
