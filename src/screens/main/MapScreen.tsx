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
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows, Typography } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { robotApi } from '../../api/modules/robot.api';
import { deliveryApi } from '../../api/modules/delivery.api';
import { scheduleApi } from '../../api/modules/schedule.api';
import { facilityApi } from '../../api/modules/facility.api';
import { dispatchApi } from '../../api/modules/dispatch.api';
import {
  RobotDto,
  DeliveryResponse,
  MapResponse,
  FloorResponse,
  EndpointResponse,
  ScheduleResponse,
  JobResponse,
} from '../../api/types';
import { SOSCallModal } from '../../components/sos/SOSCallModal';
import { SOSStreamModal } from '../../components/sos/SOSStreamModal';
import { HospitalSvgMap } from '../../components/map/HospitalSvgMap';
import { RobotTouchInterfaceModal } from '../../components/map/RobotTouchInterfaceModal';
import { useHospitalMapStore, HospitalZone } from '../../store/useHospitalMapStore';
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
  RefreshCw,
  Calendar,
  Navigation,
  MapPin,
  Compass,
  Trash2,
  Send,
  UserCheck,
  Bot,
} from 'lucide-react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ===== Dữ liệu phòng bệnh viện =====
interface Room {
  id: string;
  name: string;
  row: number;
  col: number;
  bgColor?: string;
  color?: string;
  badge?: string;
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

// ===== Lịch trình mẫu khi máy chủ chưa phát sinh lịch mới =====
const DEFAULT_SCHEDULES = [
  {
    scheduleId: 'SCH-01',
    scheduleName: 'Khử khuẩn hành lang ca đêm',
    scheduleType: 'DISINFECTION',
    cronExpression: '0 22 * * * (22:00 hằng ngày)',
    nextRunAt: '2026-10-20T22:00:00Z',
    status: 'ACTIVE' as const,
    intervalSec: 86400,
  },
  {
    scheduleId: 'SCH-02',
    scheduleName: 'Tuần tra an ninh & phát hiện sự cố SOS',
    scheduleType: 'PATROL',
    cronExpression: '*/30 8-18 * * * (Mỗi 30 phút)',
    nextRunAt: '2026-10-20T14:00:00Z',
    status: 'ACTIVE' as const,
    intervalSec: 1800,
  },
  {
    scheduleId: 'SCH-03',
    scheduleName: 'Giao mẫu xét nghiệm định kỳ',
    scheduleType: 'DELIVERY',
    cronExpression: '0 9,11,14,16 * * *',
    nextRunAt: '2026-10-20T16:00:00Z',
    status: 'PAUSED' as const,
    intervalSec: 7200,
  },
];

// ===== Helper chuyển đổi thông tin Job sang tên nhiệm vụ thân thiện =====
const getJobDisplayInfo = (job: JobResponse, epList: EndpointResponse[]) => {
  const input = job.inputJson || {};
  const targetEpId = input.endpoint_id || input.destination_endpoint_id || input.destinationEndpointId;
  const originEpId = input.origin_endpoint_id || input.originEndpointId || input.pickup_endpoint_id || input.pickupEndpointId;

  const targetEp = targetEpId ? epList.find((e) => e.endpointId === targetEpId) : null;
  const originEp = originEpId ? epList.find((e) => e.endpointId === originEpId) : null;

  const destinationName = targetEp
    ? targetEp.endpointName
    : input.target_mode === 'ENDPOINT_GROUP'
      ? 'Khu vực chỉ định'
      : targetEpId
        ? `Điểm ${String(targetEpId).substring(0, 8)}...`
        : 'Vị trí yêu cầu';

  const originName = originEp ? originEp.endpointName : null;

  // Xác định nghiệp vụ nhiệm vụ
  const isEscort = Boolean(input.escort_mode || input.patient_reference || input.patientReference);
  const isDelivery = Boolean(input.items || input.pickup_endpoint_id || input.pickupEndpointId);

  let title = '';
  let category = '';
  let icon = '🚀';

  if (isEscort) {
    icon = '🚶‍♂️';
    category = 'Dẫn đường bệnh nhân';
    title = `Dẫn đường đến ${destinationName}`;
  } else if (isDelivery) {
    icon = '📦';
    category = 'Vận chuyển y tế';
    title = `Vận chuyển đến ${destinationName}`;
  } else {
    icon = '🚀';
    category = 'Điều hướng robot';
    title = `Điều hướng đến ${destinationName}`;
  }

  // Mức độ ưu tiên
  let priorityLabel = 'Bình thường (P2)';
  if (job.priority >= 80) priorityLabel = 'Khẩn cấp (P1)';
  else if (job.priority < 40) priorityLabel = 'Thấp (P3)';

  return {
    icon,
    category,
    title,
    destinationName,
    originName,
    priorityLabel,
  };
};

export const MapScreen: React.FC = () => {
  const [currentTime, setCurrentTime] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showRoomSheet, setShowRoomSheet] = useState(false);
  const [showQueueSheet, setShowQueueSheet] = useState(false);
  const [showTimelineSheet, setShowTimelineSheet] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSOSCall, setShowSOSCall] = useState(false);
  const [showSOSStream, setShowSOSStream] = useState(false);
  const [showScheduleSheet, setShowScheduleSheet] = useState(false);
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [robotStatus, setRobotStatus] = useState<'running' | 'paused'>('running');

  // Animation values
  const sosAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Facility & Maps & Schedules state
  const [activeMap, setActiveMap] = useState<MapResponse | null>(null);
  const [activeFloor, setActiveFloor] = useState<FloorResponse | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointResponse[]>([]);
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [actionScheduleId, setActionScheduleId] = useState<string | null>(null);

  // Jobs & Dispatch state (Nhiệm vụ & Điều phối Robot)
  const [jobs, setJobs] = useState<JobResponse[]>([]);
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [queueTab, setQueueTab] = useState<'jobs' | 'deliveries'>('jobs');
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchMode, setDispatchMode] = useState<'NAV' | 'ESCORT'>('NAV');
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  // Hospital SVG Map Store (Đồng bộ 1200x680 giữa Staff App và Robot App)
  const {
    zones: hospitalZones,
    robotState,
    selectedZoneId,
    selectZone,
    dispatchRobotToZone,
    isRobotScreenOpen,
    setRobotScreenOpen,
  } = useHospitalMapStore();

  const [selectedHospitalZone, setSelectedHospitalZone] = useState<HospitalZone | null>(null);

  const handleSelectHospitalZone = useCallback(
    (zone: HospitalZone) => {
      setSelectedHospitalZone(zone);
      selectZone(zone.id);
      setSelectedRoom({
        id: zone.id,
        name: zone.name,
        row: 0,
        col: 0,
        color: zone.color,
        badge: zone.code,
      });
      setShowRoomSheet(true);
    },
    [selectZone]
  );

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

  const [robotData, setRobotData] = useState<RobotDto | null>(null);
  const [isLoadingRobot, setIsLoadingRobot] = useState(false);
  const [deliveryRequests, setDeliveryRequests] = useState<DeliveryResponse[]>([]);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  const fetchRobot = useCallback(async () => {
    setIsLoadingRobot(true);
    try {
      const res = await robotApi.getRobots(0, 5);
      if (res?.content && res.content.length > 0) {
        setRobotData(res.content[0]);
      }
    } catch (err) {
      console.log('Using default robot data:', err);
    } finally {
      setIsLoadingRobot(false);
    }
  }, []);

  const fetchFacilityData = useCallback(async () => {
    try {
      const [mapsRes, floorsRes, epRes] = await Promise.all([
        facilityApi.getMaps(0, 5),
        facilityApi.getFloors(0, 5),
        facilityApi.getEndpoints(0, 50),
      ]);
      if (mapsRes?.content && mapsRes.content.length > 0) {
        const active = mapsRes.content.find((m) => m.status === 'ACTIVE') || mapsRes.content[0];
        setActiveMap(active);
      }
      if (floorsRes?.content && floorsRes.content.length > 0) {
        setActiveFloor(floorsRes.content[0]);
      }
      if (epRes?.content && epRes.content.length > 0) {
        setEndpoints(epRes.content);
      }
    } catch (err) {
      console.log('Error fetching facility data:', err);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    setIsLoadingSchedules(true);
    try {
      const res = await scheduleApi.getSchedules({ page: 0, size: 10 });
      if (res?.content) {
        setSchedules(res.content);
      }
    } catch (err) {
      console.log('Error fetching schedules:', err);
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  const fetchDeliveryQueue = useCallback(async () => {
    setIsLoadingQueue(true);
    try {
      const res = await deliveryApi.getDeliveryRequests(0, 10);
      if (res?.content) {
        setDeliveryRequests(res.content);
      }
    } catch (err) {
      console.log('Error fetching delivery queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  const handleToggleSchedule = async (scheduleItem: ScheduleResponse) => {
    setActionScheduleId(scheduleItem.scheduleId);
    try {
      if (scheduleItem.status === 'ACTIVE') {
        await scheduleApi.pauseSchedule(scheduleItem.scheduleId);
        Alert.alert('Thành công', `Đã tạm dừng lịch trình "${scheduleItem.scheduleName}".`);
      } else {
        await scheduleApi.activateSchedule(scheduleItem.scheduleId);
        Alert.alert('Thành công', `Đã kích hoạt lịch trình "${scheduleItem.scheduleName}".`);
      }
      await fetchSchedules();
    } catch (err: any) {
      console.log('Error toggling schedule:', err);
      Alert.alert('Lỗi', err?.message || 'Không thể đổi trạng thái lịch trình');
    } finally {
      setActionScheduleId(null);
    }
  };

  const fetchJobs = useCallback(async () => {
    setIsLoadingJobs(true);
    try {
      const res = await dispatchApi.getJobs({ page: 0, size: 20 });
      if (res?.content) {
        setJobs(res.content);
      }
    } catch (err) {
      console.log('Error fetching jobs:', err);
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  const handleDispatchRobot = async () => {
    if (!selectedRoom) return;
    setIsDispatching(true);
    try {
      // 1. Kích hoạt thuật toán di chuyển thời gian thực trên bản đồ 1200x680
      const targetZone =
        selectedHospitalZone ||
        hospitalZones.find((z) => z.id === selectedRoom.id || z.name === selectedRoom.name) ||
        hospitalZones[0];

      dispatchRobotToZone(targetZone.id);

      // 2. Gửi lệnh điều phối lên Backend Railway (nếu kết nối)
      const mapId = activeMap?.mapId || 'dee53b44-a8ef-446a-947e-c42aa14ce9c2';
      const targetEp = endpoints.find((e) => e.mapId === mapId) || endpoints[0];
      const epId = targetEp?.endpointId || '74d46e9c-73f0-4b05-91b3-4adabf54bf86';

      if (dispatchMode === 'ESCORT') {
        dispatchApi
          .dispatchEscortToJob({
            mapId,
            endpointId: epId,
            patientReference: `Bệnh nhân đến ${selectedRoom.name}`,
            note: `Dẫn đường bệnh nhân đến ${selectedRoom.name} từ Staff App`,
            walkingSpeedMps: 0.2,
            priority: 60,
          })
          .catch((err) => console.log('Escort API note:', err.message));
      } else {
        dispatchApi
          .dispatchNavigationToJob({
            mapId,
            endpointId: epId,
            note: `Điều robot đến ${selectedRoom.name} từ Staff App`,
            passengerCount: 1,
            priority: 50,
          })
          .catch((err) => console.log('Nav API note:', err.message));
      }

      setShowRoomSheet(false);
      Alert.alert(
        'Đã điều phối Robot! 🚀',
        `Robot MAR-01 đang tự hành di chuyển dọc theo tuyến đường đến ${selectedRoom.name}.\n\nBạn có thể nhấn nút "Màn hình Robot AMR" ở trên để xem trực tiếp góc nhìn cảm ứng của Robot!`
      );
      await fetchJobs();
    } catch (err: any) {
      console.log('Error dispatching robot:', err);
      Alert.alert('Không thể gửi robot', err?.message || 'Lỗi kết nối máy chủ');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    Alert.alert('Xác nhận hủy', 'Bạn có chắc chắn muốn hủy nhiệm vụ này của robot?', [
      { text: 'Quay lại', style: 'cancel' },
      {
        text: 'HỦY NHIỆM VỤ',
        style: 'destructive',
        onPress: async () => {
          setCancellingJobId(jobId);
          try {
            await dispatchApi.cancelJob(jobId, 'Nhân viên y tế hủy từ Staff App');
            Alert.alert('Thành công', 'Đã gửi yêu cầu hủy nhiệm vụ robot.');
            await fetchJobs();
          } catch (err: any) {
            Alert.alert('Lỗi', err?.message || 'Không thể hủy nhiệm vụ');
          } finally {
            setCancellingJobId(null);
          }
        },
      },
    ]);
  };

  useEffect(() => {
    fetchRobot();
    fetchFacilityData();
    fetchSchedules();
    fetchJobs();
  }, [fetchRobot, fetchFacilityData, fetchSchedules, fetchJobs]);

  useEffect(() => {
    if (showQueueSheet) {
      fetchDeliveryQueue();
      fetchJobs();
    }
  }, [showQueueSheet, fetchDeliveryQueue, fetchJobs]);

  useEffect(() => {
    if (showScheduleSheet) {
      fetchSchedules();
    }
  }, [showScheduleSheet, fetchSchedules]);

  const handleConfirmPause = useCallback(() => {
    setRobotStatus('paused');
    setShowConfirmModal(false);
  }, []);

  return (
    <View style={styles.container}>
      {/* ========= REUSABLE STAFF HEADER ========= */}
      <StaffHeader />


      <ScrollView style={styles.mainScroll} showsVerticalScrollIndicator={false}>
        {/* ========= VIEW MODE SWITCHER & ROBOT KIOSK BUTTON ========= */}
        <View style={styles.viewModeBar}>
          <View style={styles.viewModeInfo}>
            <Text style={styles.viewModeTitle}>
              CHẾ ĐỘ: <Text style={{ color: Colors.primary }}>STAFF DISPATCH APP</Text>
            </Text>
            <Text style={styles.viewModeSub}>
              Nhấn trực tiếp vào phòng trên bản đồ 1200x680 để điều Robot AMR
            </Text>
          </View>
          <TouchableOpacity
            style={styles.openRobotKioskBtn}
            onPress={() => setRobotScreenOpen(true)}
            activeOpacity={0.8}
          >
            <Video size={16} color="#FFFFFF" />
            <Text style={styles.openRobotKioskText}>Màn hình & Camera Robot</Text>
          </TouchableOpacity>
        </View>

        {/* ========= 2D HOSPITAL SVG MAP (CHUẨN 1200x680 PIXEL) ========= */}
        <View style={styles.svgMapCard}>
          <View style={styles.mapCardHeaderRow}>
            <View style={styles.mapStatusBadge}>
              <View
                style={[
                  styles.statusDotLive,
                  {
                    backgroundColor:
                      robotState.status === 'NAVIGATING'
                        ? '#06B6D4'
                        : robotState.status === 'ARRIVED'
                        ? '#10B981'
                        : robotState.status === 'BLOCKED'
                        ? '#EF4444'
                        : '#3B82F6',
                  },
                ]}
              />
              <Text style={styles.mapStatusBadgeText}>
                {robotState.status === 'NAVIGATING'
                  ? `ROBOT ĐANG DI CHUYỂN: ${hospitalZones.find((z) => z.id === robotState.targetZoneId)?.name || 'PHÒNG BỆNH'}`
                  : robotState.status === 'ARRIVED'
                  ? 'ROBOT ĐÃ VÀO VỊ TRÍ ĐÍCH'
                  : robotState.status === 'BLOCKED'
                  ? 'ROBOT ĐANG TẠM DỪNG'
                  : 'SƠ ĐỒ BẢN ĐỒ BỆNH VIỆN 1200x680 (0.05m/px)'}
              </Text>
            </View>
            <Text style={styles.robotCoordLiveText}>
              Robot MAR-01: ({Math.round(robotState.x)}, {Math.round(robotState.y)}) · {robotState.heading}°
            </Text>
          </View>

          <HospitalSvgMap
            interactive={true}
            mode="staff"
            onSelectZone={handleSelectHospitalZone}
          />
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
                {robotData?.status === 'OFFLINE' ? 'GAZEBO · OFFLINE' : (robotStatus === 'running' ? 'ĐANG VẬN CHUYỂN' : 'TẠM DỪNG')}
              </Text>
            </View>
            <View style={styles.statusRight}>
              <Text style={styles.batteryText}>🔋 {robotData?.batteryRaw ?? 100}%</Text>
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
                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => setShowLocationSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.infoCardLabel}>VỊ TRÍ ROBOT</Text>
                  <Text style={styles.infoCardValue} numberOfLines={1}>
                    {activeFloor?.floorCode ? `${activeFloor.floorCode} · ${activeMap?.mapCode || 'Nav2'}` : 'F1 · Khu chờ'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.infoCard}>
                  <Text style={styles.infoCardLabel}>KẾT NỐI</Text>
                  <Text style={[styles.infoCardValue, { color: robotData?.status === 'OFFLINE' ? '#F59E0B' : '#10B981' }]}>
                    {robotData?.status === 'OFFLINE' ? '🟡 Sẵn sàng' : '🟢 Ổn định'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => setShowLocationSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.infoCardLabel}>TỌA ĐỘ NAV2</Text>
                  <Text style={[styles.infoCardValue, { color: Colors.primary }]} numberOfLines={1}>
                    X: 2.05 | Y: 1.50
                  </Text>
                </TouchableOpacity>

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

                <TouchableOpacity
                  style={styles.infoCard}
                  onPress={() => setShowScheduleSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.infoCardLabel}>LỊCH TRÌNH</Text>
                  <Text style={[styles.infoCardValue, { color: Colors.tealDark }]}>
                    {schedules.length > 0 ? `${schedules.length} đang chạy` : '3 định kỳ'}
                  </Text>
                </TouchableOpacity>
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
                  style={styles.actionBtnTealSchedule}
                  onPress={() => setShowScheduleSheet(true)}
                  activeOpacity={0.8}
                >
                  <Calendar size={15} color={Colors.tealDark} />
                  <Text style={styles.actionBtnTealText}>Lịch trình</Text>
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
                  onPress={() => {
                    Alert.alert(
                      'Dừng khẩn cấp robot',
                      'Bạn có chắc chắn muốn ngắt chuyển động toàn bộ robot ngay lập tức để đảm bảo an toàn?',
                      [
                        { text: 'Hủy', style: 'cancel' },
                        {
                          text: 'DỪNG NGAY ⚠️',
                          style: 'destructive',
                          onPress: () => {
                            setRobotStatus('paused');
                            Alert.alert('Đã kích hoạt', 'Robot đã dừng khẩn cấp và bật đèn cảnh báo.');
                          },
                        },
                      ]
                    );
                  }}
                  activeOpacity={0.8}
                >
                  <AlertTriangle size={15} color="#EF4444" />
                  <Text style={styles.actionBtnRedText}>Dừng khẩn</Text>
                </TouchableOpacity>
              </View>

              {/* Action Buttons Row 2 */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.manualControlBtn}
                  onPress={() => setShowLocationSheet(true)}
                  activeOpacity={0.8}
                >
                  <Navigation size={16} color={Colors.primary} />
                  <Text style={styles.manualControlText}>Tọa độ & Vị trí</Text>
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
          <View style={[styles.sheetContainer, { maxHeight: SCREEN_HEIGHT * 0.82 }]}>
            <View style={styles.sheetHandle} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={styles.queueSheetTitle}>Hàng đợi & Nhiệm vụ Robot</Text>
              {isLoadingQueue || isLoadingJobs ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => {
                    fetchDeliveryQueue();
                    fetchJobs();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <RefreshCw size={14} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Tab Switcher: Nhiệm vụ Robot vs Đơn vận chuyển */}
            <View style={styles.queueTabRow}>
              <TouchableOpacity
                style={[styles.queueTabBtn, queueTab === 'jobs' && styles.queueTabBtnActive]}
                onPress={() => setQueueTab('jobs')}
                activeOpacity={0.8}
              >
                <Text style={[styles.queueTabText, queueTab === 'jobs' && styles.queueTabTextActive]}>
                  Nhiệm vụ Robot ({jobs.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.queueTabBtn, queueTab === 'deliveries' && styles.queueTabBtnActive]}
                onPress={() => setQueueTab('deliveries')}
                activeOpacity={0.8}
              >
                <Text style={[styles.queueTabText, queueTab === 'deliveries' && styles.queueTabTextActive]}>
                  Đơn vận chuyển ({deliveryRequests.length > 0 ? deliveryRequests.length : QUEUE_ITEMS.length})
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 4 }}>
              {queueTab === 'jobs' ? (
                /* TAB 1: NHIỆM VỤ ROBOT (JOBS REALTIME TỪ BACKEND) */
                <View style={styles.queueList}>
                  {jobs.length > 0 ? (
                    jobs.map((job) => {
                      const isQueued = job.status === 'QUEUED';
                      const isRunning = job.status === 'RUNNING';
                      const isCancelled = job.status === 'CANCELLED';
                      const isCancelling = cancellingJobId === job.jobId;

                      let badgeBg = '#E0F2FE';
                      let badgeText = Colors.primary;
                      let statusVi: string = job.status;

                      if (isQueued) {
                        badgeBg = '#FEF3C7';
                        badgeText = '#D97706';
                        statusVi = 'ĐANG XẾP HÀNG';
                      } else if (isRunning) {
                        badgeBg = '#D1FAE5';
                        badgeText = '#059669';
                        statusVi = 'ĐANG CHẠY';
                      } else if (job.status === 'SUCCEEDED') {
                        badgeBg = '#ECFDF5';
                        badgeText = '#047857';
                        statusVi = 'HOÀN TẤT';
                      } else if (isCancelled) {
                        badgeBg = '#FEE2E2';
                        badgeText = '#DC2626';
                        statusVi = 'ĐÃ HỦY';
                      }

                      const display = getJobDisplayInfo(job, endpoints);

                      return (
                        <View key={job.jobId} style={styles.jobCard}>
                          <View style={styles.jobCardTop}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <Text style={styles.jobTitleText} numberOfLines={1}>
                                {display.icon} {display.title}
                              </Text>
                              <Text style={styles.jobSubtitleText}>
                                {display.category} · Mã: {job.jobCode}
                              </Text>
                            </View>
                            <View style={[styles.jobBadge, { backgroundColor: badgeBg }]}>
                              <Text style={[styles.jobBadgeText, { color: badgeText }]}>{statusVi}</Text>
                            </View>
                          </View>

                          <View style={styles.jobDetailBox}>
                            <View style={styles.jobDetailRow}>
                              <MapPin size={12} color={Colors.primary} />
                              <Text style={styles.jobDetailText} numberOfLines={1}>
                                Đích đến: <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>{display.destinationName}</Text>
                                {display.originName ? ` (Từ: ${display.originName})` : ''}
                              </Text>
                            </View>
                            <View style={styles.jobDetailRow}>
                              <Clock size={12} color={Colors.textMuted} />
                              <Text style={styles.jobDetailText}>
                                Khởi tạo: {job.queuedAt ? new Date(job.queuedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Vừa tạo'}
                                {' · '}Ưu tiên: <Text style={{ fontWeight: '600', color: Colors.textPrimary }}>{display.priorityLabel}</Text>
                              </Text>
                            </View>
                          </View>

                          {(isQueued || isRunning) && (
                            <TouchableOpacity
                              style={styles.jobCancelBtn}
                              onPress={() => handleCancelJob(job.jobId)}
                              activeOpacity={0.8}
                              disabled={isCancelling}
                            >
                              {isCancelling ? (
                                <ActivityIndicator size="small" color="#EF4444" />
                              ) : (
                                <>
                                  <Trash2 size={13} color="#EF4444" />
                                  <Text style={styles.jobCancelText}>Hủy nhiệm vụ này</Text>
                                </>
                              )}
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  ) : (
                    <View style={styles.sampleDataBanner}>
                      <Text style={styles.sampleDataText}>
                        (Hiện chưa có nhiệm vụ nào trong hàng đợi · Chọn phòng trên sơ đồ để điều robot)
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                /* TAB 2: ĐƠN VẬN CHUYỂN */
                <View style={styles.queueList}>
                  {deliveryRequests.length === 0 && (
                    <View style={styles.sampleDataBanner}>
                      <Text style={styles.sampleDataText}>
                        (Dữ liệu minh họa · Chưa phát sinh đơn mới trên máy chủ)
                      </Text>
                    </View>
                  )}
                  {deliveryRequests.length > 0
                    ? deliveryRequests.map((req, idx) => (
                        <TouchableOpacity
                          key={req.request?.requestId || idx}
                          style={styles.queueCard}
                          onPress={() => {
                            setShowQueueSheet(false);
                            setShowTimelineSheet(true);
                          }}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.queueNumberBadge, { backgroundColor: Colors.primary }]}>
                            <Text style={styles.queueNumberText}>{idx + 1}</Text>
                          </View>
                          <View style={styles.queueCardContent}>
                            <Text style={styles.queueItemTitle}>
                              📦 {req.request?.title || req.items?.[0]?.itemName || 'Đơn vận chuyển'}
                            </Text>
                            <Text style={styles.queueItemSubtitle}>
                              Đến: {req.recipientName || 'Nhân viên trực'} · Trạng thái: {req.request?.status || 'QUEUED'}
                            </Text>
                          </View>
                          <ArrowRight size={16} color={Colors.primary} />
                        </TouchableOpacity>
                      ))
                    : QUEUE_ITEMS.map((item) => (
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
              )}
            </ScrollView>

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
            <Text style={styles.sheetLabel}>ĐIỀU ROBOT ĐẾN PHÒNG</Text>
            <Text style={styles.sheetRoomName}>
              {selectedHospitalZone?.name || selectedRoom?.name}
            </Text>

            {selectedHospitalZone && (
              <View style={styles.zoneDetailsBox}>
                <Text style={styles.zoneDepartmentText}>
                  🏢 {selectedHospitalZone.department}
                </Text>
                <Text style={styles.zoneCoordsText}>
                  📍 Tọa độ đích (dockPoint): ({selectedHospitalZone.dockPoint.x}, {selectedHospitalZone.dockPoint.y})
                </Text>
                <Text style={styles.zoneDescText}>
                  {selectedHospitalZone.description}
                </Text>
              </View>
            )}

            {selectedRoom?.id === '2' && (
              <View style={styles.roomSosAlertBanner}>
                <Text style={styles.roomSosAlertTitle}>🆘 TÍN HIỆU SOS ĐANG KÍCH HOẠT</Text>
                <Text style={styles.roomSosAlertSubtitle}>
                  Có tín hiệu gọi khẩn cấp từ bệnh nhân tại vị trí này.
                </Text>
                <TouchableOpacity
                  style={styles.roomSosCallBtn}
                  onPress={() => {
                    setShowRoomSheet(false);
                    setShowSOSCall(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.roomSosCallBtnText}>Xem cuộc gọi SOS ngay ➔</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Chế độ điều robot (Navigation vs Escort) */}
            <View style={styles.dispatchModeRow}>
              <TouchableOpacity
                style={[styles.dispatchModeBtn, dispatchMode === 'NAV' && styles.dispatchModeBtnActive]}
                onPress={() => setDispatchMode('NAV')}
                activeOpacity={0.8}
              >
                <Navigation size={14} color={dispatchMode === 'NAV' ? '#1D4ED8' : Colors.textSecondary} />
                <Text style={[styles.dispatchModeText, dispatchMode === 'NAV' && styles.dispatchModeTextActive]}>
                  🚀 Tự hành đến phòng
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.dispatchModeBtn, dispatchMode === 'ESCORT' && styles.dispatchModeBtnActive]}
                onPress={() => setDispatchMode('ESCORT')}
                activeOpacity={0.8}
              >
                <UserCheck size={14} color={dispatchMode === 'ESCORT' ? '#1D4ED8' : Colors.textSecondary} />
                <Text style={[styles.dispatchModeText, dispatchMode === 'ESCORT' && styles.dispatchModeTextActive]}>
                  🚶‍♂️ Dẫn đường bệnh nhân
                </Text>
              </TouchableOpacity>
            </View>

            {/* Thông số vị trí đích */}
            <View style={styles.dispatchMetaBox}>
              <Text style={styles.dispatchMetaTitle}>ĐIỂM ĐÍCH TRÊN BẢN ĐỒ NAV2</Text>
              <Text style={styles.dispatchMetaText}>
                Bản đồ: {activeMap?.mapName || 'Hospital F1 - Gazebo Nav2 V2'}
              </Text>
              <Text style={[styles.dispatchMetaText, { color: Colors.textMuted, fontSize: 11, marginTop: 2 }]}>
                {dispatchMode === 'ESCORT'
                  ? 'Robot sẽ di chuyển tốc độ an toàn (0.2 m/s) và hướng dẫn bệnh nhân tới phòng.'
                  : 'Robot sẽ tự tìm đường tối ưu theo thuật toán Nav2 SLAM để tới phòng.'}
              </Text>
            </View>

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
                onPress={handleDispatchRobot}
                disabled={isDispatching}
                activeOpacity={0.8}
              >
                {isDispatching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.sendBtnText}>
                    {dispatchMode === 'ESCORT' ? '✓ Dẫn đường ngay' : '✓ Gửi robot'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 5: CUỘC GỌI & STREAM SOS KHẨN CẤP
      ======================================================== */}
      <SOSCallModal
        visible={showSOSCall}
        robotName="Robot MAR-GAZEBO-01"
        location={selectedRoom?.name || 'Kho · Tầng 4'}
        onAccept={() => {
          setShowSOSCall(false);
          setShowSOSStream(true);
        }}
        onDecline={() => setShowSOSCall(false)}
      />

      <SOSStreamModal
        visible={showSOSStream}
        robotName="Robot MAR-GAZEBO-01"
        location={selectedRoom?.name || 'Kho · Tầng 4'}
        onClose={() => setShowSOSStream(false)}
      />

      {/* ========================================================
          MODAL 6: LỊCH TRÌNH HOẠT ĐỘNG ROBOT (Staff Schedules)
      ======================================================== */}
      <Modal visible={showScheduleSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheetContainer, { maxHeight: SCREEN_HEIGHT * 0.82 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.sheetCategoryLabel}>HỆ THỐNG ĐIỀU HÀNH · LỊCH TRÌNH</Text>
                <Text style={styles.queueSheetTitle}>
                  Lịch trình định kỳ robot {schedules.length > 0 ? `(${schedules.length})` : `(${DEFAULT_SCHEDULES.length})`}
                </Text>
              </View>
              {isLoadingSchedules ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <TouchableOpacity onPress={fetchSchedules} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <RefreshCw size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {schedules.length === 0 && (
              <View style={styles.sampleDataBanner}>
                <Text style={styles.sampleDataText}>
                  (Dữ liệu minh họa · Chưa phát sinh lịch trình mới trên máy chủ)
                </Text>
              </View>
            )}

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {schedules.length > 0
                ? schedules.map((sch) => {
                    const isActive = sch.status === 'ACTIVE';
                    const isToggling = actionScheduleId === sch.scheduleId;
                    return (
                      <View key={sch.scheduleId} style={styles.scheduleCard}>
                        <View style={styles.scheduleCardTop}>
                          <View style={styles.scheduleIconCircle}>
                            <Calendar size={18} color={Colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.scheduleTitle}>{sch.scheduleName}</Text>
                            <Text style={styles.scheduleCode}>
                              {sch.scheduleCode} · {sch.scheduleType}
                            </Text>
                          </View>
                          <View style={[styles.scheduleStatusBadge, isActive ? styles.badgeGreen : styles.badgeOrange]}>
                            <Text style={[styles.scheduleStatusText, isActive ? styles.textGreen : styles.textOrange]}>
                              {isActive ? 'Đang chạy' : 'Tạm dừng'}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.scheduleMetaGrid}>
                          <View style={styles.scheduleMetaItem}>
                            <Text style={styles.scheduleMetaLabel}>CHU KỲ</Text>
                            <Text style={styles.scheduleMetaVal}>
                              {sch.cronExpression || (sch.intervalSec ? `Mỗi ${Math.round(sch.intervalSec / 60)} phút` : 'Định kỳ')}
                            </Text>
                          </View>
                          <View style={styles.scheduleMetaItem}>
                            <Text style={styles.scheduleMetaLabel}>LẦN CHẠY TIẾP</Text>
                            <Text style={styles.scheduleMetaVal}>
                              {sch.nextRunAt ? new Date(sch.nextRunAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : 'Theo ca trực'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[styles.scheduleToggleBtn, isActive ? styles.scheduleBtnPause : styles.scheduleBtnResume]}
                          onPress={() => handleToggleSchedule(sch)}
                          activeOpacity={0.8}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <ActivityIndicator size="small" color={isActive ? '#D97706' : '#059669'} />
                          ) : (
                            <Text style={[styles.scheduleToggleBtnText, isActive ? styles.textOrange : styles.textGreen]}>
                              {isActive ? '⏸ Tạm dừng lịch trình' : '▶ Kích hoạt lại'}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                : DEFAULT_SCHEDULES.map((sch) => (
                    <View key={sch.scheduleId} style={styles.scheduleCard}>
                      <View style={styles.scheduleCardTop}>
                        <View style={styles.scheduleIconCircle}>
                          <Calendar size={18} color={Colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.scheduleTitle}>{sch.scheduleName}</Text>
                          <Text style={styles.scheduleCode}>
                            {sch.scheduleId} · {sch.scheduleType}
                          </Text>
                        </View>
                        <View style={[styles.scheduleStatusBadge, sch.status === 'ACTIVE' ? styles.badgeGreen : styles.badgeOrange]}>
                          <Text style={[styles.scheduleStatusText, sch.status === 'ACTIVE' ? styles.textGreen : styles.textOrange]}>
                            {sch.status === 'ACTIVE' ? 'Đang chạy' : 'Tạm dừng'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.scheduleMetaGrid}>
                        <View style={styles.scheduleMetaItem}>
                          <Text style={styles.scheduleMetaLabel}>CHU KỲ</Text>
                          <Text style={styles.scheduleMetaVal}>{sch.cronExpression}</Text>
                        </View>
                        <View style={styles.scheduleMetaItem}>
                          <Text style={styles.scheduleMetaLabel}>ROBOT GÁN</Text>
                          <Text style={styles.scheduleMetaVal}>MAR-GAZEBO-01</Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[styles.scheduleToggleBtn, sch.status === 'ACTIVE' ? styles.scheduleBtnPause : styles.scheduleBtnResume]}
                        onPress={() => {
                          Alert.alert('Thông báo', `Đã chuyển đổi trạng thái lịch trình: ${sch.scheduleName}`);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.scheduleToggleBtnText, sch.status === 'ACTIVE' ? styles.textOrange : styles.textGreen]}>
                          {sch.status === 'ACTIVE' ? '⏸ Tạm dừng lịch trình' : '▶ Kích hoạt lại'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setShowScheduleSheet(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 7: TỌA ĐỘ VÀ VỊ TRÍ ROBOT NAV2 (Telemetry)
      ======================================================== */}
      <Modal visible={showLocationSheet} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheetContainer, { maxHeight: SCREEN_HEIGHT * 0.85 }]}>
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View>
                <Text style={styles.sheetCategoryLabel}>ĐỊNH VỊ REAL-TIME · TELEMETRY</Text>
                <Text style={styles.queueSheetTitle}>Vị trí & Tọa độ Robot Nav2</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  fetchRobot();
                  fetchFacilityData();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RefreshCw size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {/* Robot Identity Box */}
              <View style={styles.telemetryRobotCard}>
                <View style={styles.telemetryRobotLeft}>
                  <View style={styles.telemetryRobotAvatar}>
                    <Text style={{ fontSize: 24 }}>🤖</Text>
                  </View>
                  <View>
                    <Text style={styles.telemetryRobotName}>
                      {robotData?.robotName || 'MediAssist Rover Gazebo'}
                    </Text>
                    <Text style={styles.telemetryRobotCode}>
                      Mã: {robotData?.robotCode || 'MAR-GAZEBO-01'} · Model: {robotData?.model || 'TurtleBot3'}
                    </Text>
                  </View>
                </View>
                <View style={[styles.scheduleStatusBadge, styles.badgeGreen]}>
                  <Text style={[styles.scheduleStatusText, styles.textGreen]}>
                    {robotData?.status === 'OFFLINE' ? 'OFFLINE' : 'ONLINE'}
                  </Text>
                </View>
              </View>

              {/* Map & Floor Telemetry */}
              <View style={styles.locationDetailSection}>
                <Text style={styles.locationSectionTitle}>BẢN ĐỒ & KHÔNG GIAN BỆNH VIỆN</Text>
                <View style={styles.telemetryGrid}>
                  <View style={styles.telemetryGridItem}>
                    <Text style={styles.telemetryLabel}>TẦNG HIỆN TẠI</Text>
                    <Text style={styles.telemetryValue}>
                      {activeFloor?.floorName || 'Hospital Ground Floor (F1)'}
                    </Text>
                  </View>
                  <View style={styles.telemetryGridItem}>
                    <Text style={styles.telemetryLabel}>BẢN ĐỒ NAV2</Text>
                    <Text style={styles.telemetryValue}>
                      {activeMap?.mapName || 'Hospital F1 - Gazebo Nav2 V2'}
                    </Text>
                  </View>
                  <View style={styles.telemetryGridItem}>
                    <Text style={styles.telemetryLabel}>KÍCH THƯỚC MAP</Text>
                    <Text style={styles.telemetryValue}>
                      {activeMap?.widthM || 5.0}m × {activeMap?.heightM || 3.0}m ({activeMap?.resolutionMPerPixel || 0.004} m/px)
                    </Text>
                  </View>
                  <View style={styles.telemetryGridItem}>
                    <Text style={styles.telemetryLabel}>KHUNG THAM CHIẾU</Text>
                    <Text style={styles.telemetryValue}>frame_id: "map"</Text>
                  </View>
                </View>
              </View>

              {/* Exact Nav2 Coordinates */}
              <View style={styles.locationDetailSection}>
                <Text style={styles.locationSectionTitle}>TỌA ĐỘ VẬT LÝ NAV2 (ODOMETRY / SLAM)</Text>
                <View style={styles.coordsRow}>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>TRỤC X</Text>
                    <Text style={styles.coordVal}>2.050 m</Text>
                  </View>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>TRỤC Y</Text>
                    <Text style={styles.coordVal}>1.500 m</Text>
                  </View>
                  <View style={styles.coordBox}>
                    <Text style={styles.coordLabel}>GÓC YAW</Text>
                    <Text style={styles.coordVal}>0.000 rad</Text>
                  </View>
                </View>
              </View>

              {/* Waypoints List */}
              <View style={styles.locationDetailSection}>
                <Text style={styles.locationSectionTitle}>
                  ĐIỂM ĐÍCH / WAYPOINTS TRÊN BẢN ĐỒ {endpoints.length > 0 ? `(${endpoints.length})` : '(2)'}
                </Text>
                {endpoints.length > 0 ? (
                  endpoints.map((ep) => (
                    <View key={ep.endpointId} style={styles.waypointItem}>
                      <MapPin size={16} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.waypointName}>{ep.endpointName}</Text>
                        <Text style={styles.waypointCoords}>
                          Mã: {ep.endpointCode} · X: {ep.xM.toFixed(2)}m, Y: {ep.yM.toFixed(2)}m ({ep.endpointType})
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <>
                    <View style={styles.waypointItem}>
                      <MapPin size={16} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.waypointName}>Gazebo Test Point (Điểm an toàn Nav2)</Text>
                        <Text style={styles.waypointCoords}>Mã: EP_TEST_01 · X: 2.05m, Y: 1.50m (WAYPOINT)</Text>
                      </View>
                    </View>
                    <View style={styles.waypointItem}>
                      <MapPin size={16} color={Colors.primary} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.waypointName}>Gazebo North 04 (Hành lang phía Bắc)</Text>
                        <Text style={styles.waypointCoords}>Mã: EP_GAZEBO_NORTH_04 · X: 3.50m, Y: 2.12m (WAYPOINT)</Text>
                      </View>
                    </View>
                  </>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => setShowLocationSheet(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================
          MODAL 7: MÀN HÌNH CẢM ỨNG GẮN TRÊN ROBOT (ROBOT INTERFACE KIOSK)
      ======================================================== */}
      <RobotTouchInterfaceModal
        visible={isRobotScreenOpen}
        onClose={() => setRobotScreenOpen(false)}
      />
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
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  },
  sampleDataBanner: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 12,
  },
  sampleDataText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
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
  roomSosAlertBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  roomSosAlertTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#DC2626',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  roomSosAlertSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
    lineHeight: 16,
  },
  roomSosCallBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomSosCallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modal 6: Schedules & Modal 7: Telemetry Styles
  actionBtnTealSchedule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.md,
    height: 38,
    gap: 4,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  actionBtnTealText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.tealDark,
  },
  robotMapTag: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  robotMapTagText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.3,
  },

  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  scheduleCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  scheduleCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  scheduleIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  scheduleCode: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  scheduleStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scheduleStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeGreen: {
    backgroundColor: '#D1FAE5',
  },
  badgeOrange: {
    backgroundColor: '#FEF3C7',
  },
  textGreen: {
    color: '#059669',
  },
  textOrange: {
    color: '#D97706',
  },
  scheduleMetaGrid: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 10,
  },
  scheduleMetaItem: {
    flex: 1,
  },
  scheduleMetaLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  scheduleMetaVal: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  scheduleToggleBtn: {
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  scheduleBtnPause: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  scheduleBtnResume: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  scheduleToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  telemetryRobotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  telemetryRobotLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  telemetryRobotAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  telemetryRobotName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  telemetryRobotCode: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  locationDetailSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  locationSectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  telemetryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  telemetryGridItem: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  telemetryLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  telemetryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  coordsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  coordBox: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  coordLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coordVal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  waypointItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  waypointName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  waypointCoords: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },

  // Modal 4 Dispatch Mode Styles
  dispatchModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dispatchModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  dispatchModeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  dispatchModeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dispatchModeTextActive: {
    color: '#1D4ED8',
    fontWeight: '700',
  },
  dispatchMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  dispatchMetaTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  dispatchMetaText: {
    fontSize: 12,
    color: Colors.textPrimary,
  },

  // Modal 1 Queue Tabs & Jobs Styles
  queueTabRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  queueTabBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  queueTabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.button,
  },
  queueTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  queueTabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  jobCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  jobCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  jobTitleText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  jobSubtitleText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  jobCode: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  jobBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  jobBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  jobDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 8,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  jobDetailText: {
    fontSize: 11,
    color: Colors.textSecondary,
    flex: 1,
  },
  jobMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  jobCancelBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  jobCancelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },
  // --- HOSPITAL SVG MAP & ROBOT INTERFACE STYLES ---
  viewModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  viewModeInfo: {
    flex: 1,
    marginRight: 8,
  },
  viewModeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  viewModeSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  openRobotKioskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  openRobotKioskText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  svgMapCard: {
    margin: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  mapCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  mapStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDotLive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mapStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  robotCoordLiveText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
    fontVariant: ['tabular-nums'],
  },
  zoneDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  zoneDepartmentText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  zoneCoordsText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  zoneDescText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});

