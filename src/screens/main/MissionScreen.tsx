import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Typography, Shadows } from '../../constants/theme';
import { StaffHeader } from '../../components/common/StaffHeader';
import { deliveryApi, type DeliveryResponse } from '../../api/modules/delivery.api';
import { dispatchApi } from '../../api/modules/dispatch.api';
import { facilityApi } from '../../api/modules/facility.api';
import { staffApi } from '../../api/modules/staff.api';
import {
  EndpointResponse,
  JobResponse,
  MapResponse,
  OnDutyStaffResponse,
  RoomDto,
  ShiftResponse,
  StaffMeResponse,
  UserProfileResponse,
} from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../api/client';
import { StaffOnDutyPicker } from '../../components/staff/StaffOnDutyPicker';
import { DeliveryCancelAction } from '../../components/delivery/DeliveryCancelAction';

import {
  ScanLine,
  ChevronDown,
  ArrowRight,
  Check,
  MapPin,
  CheckCircle2,
  X,
  RefreshCw,
  PackageCheck,
  User,
  Camera,
  QrCode,
  Unlock,
  Package,
  ShieldCheck,
  AlertCircle,
  UserCheck,
  Clock,
  Truck,
  Zap,
} from 'lucide-react-native';
import { QRScannerModal } from '../../components/scanning/QRScannerModal';
import { FaceScanModal } from '../../components/scanning/FaceScanModal';
import { QuantityStepper } from '../../components/common/QuantityStepper';
import { MobileBottomSheet } from '../../components/common/MobileBottomSheet';
import {
  validateQuantity,
  getItemCategoryAndUnit,
} from '../../components/delivery/quantityHelper';
import {
  continueDeliverySubmission,
  deliveryPhase,
  expectedDeliveryAccount,
  handoffResponse,
  handoffResponseKey,
  scanContext,
  selectedRunningStep,
  UUID_PATTERN,
  verificationMatches,
  type DeliveryAttempt,
  type DeliveryScanContext,
} from './deliveryHandoff';
import { robotDeliveryProof } from './robotDeliveryProof';
import { loadDeliveryAttempt, saveDeliveryAttempt } from './deliveryAttemptStorage';

interface JobSnapshot {
  job: JobResponse;
  delivery?: DeliveryResponse;
}

async function loadJobSnapshot(jobId: string): Promise<JobSnapshot> {
  const job = await dispatchApi.getJobDetail(jobId);
  const delivery = job.serviceRequestId
    ? await deliveryApi.getDeliveryById(job.serviceRequestId)
    : undefined;
  if (!delivery || delivery.request.requestType !== 'DELIVERY') throw new Error('Nhiệm vụ này không phải giao hàng trong phạm vi tài khoản.');
  return { job, delivery };
}

const submissionApi = {
  create: deliveryApi.createDeliveryRequest,
  submit: dispatchApi.submitServiceRequest,
  getRequest: dispatchApi.getServiceRequest,
  findJob: async (requestId: string) => {
    const page = await dispatchApi.getJobs({ requestId, size: 1 });
    return page.content?.[0];
  },
};

// ===== Kiểu dữ liệu =====
export type DeliveryAuthMode = 'no_auth' | 'qr' | 'face';

type TaskType =
  | 'dan_benh_nhan'
  | 'ho_tro_chi_duong'
  | 'van_chuyen_tai_lieu'
  | 'van_chuyen_thuoc'
  | 'van_chuyen_mau'
  | 'van_chuyen_vat_tu'
  | 'dieu_robot_sos';

type PriorityLevel = 'high' | 'normal' | 'low';

const TASK_TYPES: { id: TaskType; label: string }[] = [
  { id: 'dan_benh_nhan',       label: 'Dẫn bệnh nhân' },
  { id: 'ho_tro_chi_duong',    label: 'Hỗ trợ chỉ đường' },
  { id: 'van_chuyen_tai_lieu', label: 'Vận chuyển tài liệu' },
  { id: 'van_chuyen_thuoc',    label: 'Vận chuyển thuốc' },
  { id: 'van_chuyen_mau',      label: 'Vận chuyển máu xét nghiệm' },
  { id: 'van_chuyen_vat_tu',   label: 'Vận chuyển vật tư y tế' },
  { id: 'dieu_robot_sos',      label: 'Điều robot đến SOS' },
];

const STEP_LABELS: Record<string, string> = {
  MOVE_SENDER: '1. Robot di chuyển đến Điểm lấy hàng (A)',
  AUTH_SENDER: '2. Robot quét mã QR từ điện thoại người gửi (Mở Servo)',
  UNLOCK_SENDER: '3. Robot đang mở khóa Servo ngăn tủ (A)',
  PAYLOAD_SENDER: '4. Đặt hàng vào ngăn tủ & Xác nhận',
  CLOSE_SENDER: '5. Đóng nắp ngăn tủ tại Điểm A',
  LOCK_SENDER: '6. Robot đang khóa Servo ngăn tủ (A)',
  VERIFY_SENDER: '7. Kiểm tra nắp tủ đã khóa chắc (A)',
  MOVE_RECEIVER: '8. Robot vận chuyển đến Điểm nhận hàng (B)',
  AUTH_RECEIVER: '9. Robot quét mã QR từ điện thoại người nhận (Mở Servo)',
  UNLOCK_RECEIVER: '10. Robot đang mở khóa Servo để lấy hàng (B)',
  PAYLOAD_RECEIVER: '11. Lấy hàng khỏi ngăn tủ & Xác nhận',
  CLOSE_RECEIVER: '12. Đóng nắp ngăn tủ tại Điểm B',
  LOCK_RECEIVER: '13. Robot đang khóa lại Servo (B)',
  VERIFY_RECEIVER: '14. Kiểm tra khóa tủ & Hoàn tất giao nhận',
};

export const MissionScreen: React.FC = () => {
  const { user, fetchMe } = useAuthStore();
  const [activeAccount, setActiveAccount] = useState<UserProfileResponse | null>(user);
  const currentSenderAccount = activeAccount || user;

  const apiBaseUrl = apiClient.getBaseUrl();
  const scope = `${apiBaseUrl}:${currentSenderAccount?.accountId || ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  // Auto-fetch and sync user profile from staffApi / authApi
  useEffect(() => {
    if (user?.accountId) {
      setActiveAccount(user);
    }
  }, [user]);

  useEffect(() => {
    let mounted = true;
    const resolveSender = async () => {
      if (user?.accountId) {
        setActiveAccount(user);
        return;
      }
      try {
        const staffRes = await staffApi.getStaffMe();
        if (mounted && staffRes?.account?.accountId) {
          setActiveAccount(staffRes.account);
          useAuthStore.setState({ user: staffRes.account });
          return;
        }
      } catch {}

      try {
        await fetchMe();
        const me = useAuthStore.getState().user;
        if (mounted && me?.accountId) {
          setActiveAccount(me);
        }
      } catch {}
    };
    void resolveSender();
    return () => { mounted = false; };
  }, [user?.accountId, fetchMe]);

  useEffect(() => {
    scopeRef.current = scope;
    return () => { if (scopeRef.current === scope) scopeRef.current = ''; };
  }, [scope]);

  // ===== State tạo nhiệm vụ =====
  interface SenderDutyRoom {
    shift: ShiftResponse;
    room: RoomDto;
    endpoint: EndpointResponse;
  }

  const [authMode, setAuthMode] = useState<DeliveryAuthMode>('qr');
  const [showAuthModeSheet, setShowAuthModeSheet] = useState(false);
  const [showAuthGuideDetail, setShowAuthGuideDetail] = useState(false);
  const [showMapSheet, setShowMapSheet] = useState(false);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [faceVerified, setFaceVerified] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<TaskType[]>(['van_chuyen_thuoc']);
  const [itemName, setItemName] = useState('Thuốc theo toa / Vật tư y tế');
  const [quantity, setQuantity] = useState('1');
  const [activeMap, setActiveMap] = useState<MapResponse | null>(null);
  const [availableMaps, setAvailableMaps] = useState<MapResponse[]>([]);
  const [allEndpoints, setAllEndpoints] = useState<EndpointResponse[]>([]);
  const [availableEndpoints, setAvailableEndpoints] = useState<EndpointResponse[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);

  // Điểm lấy hàng (A): Tự điền theo ca trực của người gửi
  const [senderDutyRooms, setSenderDutyRooms] = useState<SenderDutyRoom[]>([]);
  const [selectedPickupDuty, setSelectedPickupDuty] = useState<SenderDutyRoom | null>(null);
  const [senderDutyReason, setSenderDutyReason] = useState<string | null>(null);
  const [showPickupRoomModal, setShowPickupRoomModal] = useState(false);
  const [pickupEndpoint, setPickupEndpoint] = useState<EndpointResponse | null>(null);

  // Điểm giao hàng (B): Liên kết phòng và nhân viên trực
  const [deliveryRoom, setDeliveryRoom] = useState<RoomDto | null>(null);
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<EndpointResponse | null>(null);
  const [roomDutyWarning, setRoomDutyWarning] = useState<string | null>(null);
  const [showDeliveryRoomModal, setShowDeliveryRoomModal] = useState(false);
  const [isLoadingFacility, setIsLoadingFacility] = useState(false);

  const [receiver, setReceiver] = useState('');
  const [receiverAccountId, setReceiverAccountId] = useState('');
  const [receiverShiftId, setReceiverShiftId] = useState<string | undefined>(undefined);
  const [selectedReceiverStaff, setSelectedReceiverStaff] = useState<OnDutyStaffResponse | null>(null);
  const [useManualReceiver, setUseManualReceiver] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);
  const [deliveriesMap, setDeliveriesMap] = useState<Record<string, DeliveryResponse>>({});
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const [manualJobIdInput, setManualJobIdInput] = useState('');
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobError, setJobError] = useState('');
  const [isSendingStepResponse, setIsSendingStepResponse] = useState(false);
  const [respondedStepId, setRespondedStepId] = useState('');
  const [scan, setScan] = useState<DeliveryScanContext | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingDeliveryLabel, setPendingDeliveryLabel] = useState('');
  const [attemptReady, setAttemptReady] = useState(false);
  const selectedJobId = useRef<string | null>(null);
  const jobReadRevision = useRef(0);
  const stepInFlight = useRef(false);
  const submitInFlight = useRef(false);
  const attemptRef = useRef<DeliveryAttempt | null>(null);

  const activeJob = snapshot?.job || null;

  const fromRoom = selectedPickupDuty
    ? `${selectedPickupDuty.room.roomName} (${selectedPickupDuty.room.roomCode}) · phòng trực của bạn`
    : senderDutyReason || 'Chưa xác định điểm lấy hàng (A)';
  const toRoom = deliveryRoom
    ? `${deliveryRoom.roomName} (${deliveryRoom.roomCode})`
    : deliveryEndpoint?.endpointName || 'Chọn điểm giao hàng (B)';

  // Danh sách phòng trên bản đồ đang sử dụng cho Điểm giao hàng (B)
  const availableDeliveryRooms = React.useMemo(() => {
    if (!activeMap) return [];
    return rooms.filter((r) => {
      if (activeMap.floorId && r.floorId === activeMap.floorId) return true;
      return availableEndpoints.some((e) => e.roomId === r.roomId);
    });
  }, [activeMap, rooms, availableEndpoints]);

  // Phân giải ca trực đang hiệu lực của người gửi trên bản đồ hiện tại
  const resolveSenderDutyRooms = useCallback(
    async (
      map: MapResponse | null,
      allRooms: RoomDto[],
      mapEndpoints: EndpointResponse[]
    ) => {
      if (!map) {
        setSenderDutyRooms([]);
        setSelectedPickupDuty(null);
        setPickupEndpoint(null);
        setSenderDutyReason('Chưa chọn bản đồ hoạt động.');
        return;
      }

      try {
        let staffMe: StaffMeResponse | null = null;
        try {
          staffMe = await staffApi.getStaffMe();
        } catch (meErr) {
          console.log('Error fetching staffMe for duty rooms:', meErr);
        }

        const activeShifts = staffMe?.activeShifts || [];
        if (activeShifts.length === 0) {
          setSenderDutyRooms([]);
          setSelectedPickupDuty(null);
          setPickupEndpoint(null);
          setSenderDutyReason('Bạn chưa có ca trực nào đang hoạt động trên hệ thống.');
          return;
        }

        const validRooms: SenderDutyRoom[] = [];
        let hasShiftOnMap = false;

        for (const shift of activeShifts) {
          if (!shift.roomId) continue;

          const matchedRoom = allRooms.find((r) => r.roomId === shift.roomId) || ({
            roomId: shift.roomId,
            roomCode: shift.roomCode || '',
            roomName: shift.roomCode ? `Phòng ${shift.roomCode}` : 'Phòng trực',
            floorId: map.floorId,
          } as RoomDto);

          const isRoomOnFloor = !matchedRoom.floorId || matchedRoom.floorId === map.floorId;
          const hasEndpointOnMap = mapEndpoints.some((e) => e.roomId === shift.roomId);

          if (isRoomOnFloor || hasEndpointOnMap) {
            hasShiftOnMap = true;
            const ep = mapEndpoints.find(
              (e) => e.roomId === shift.roomId && e.active !== false
            );
            if (ep) {
              validRooms.push({
                shift,
                room: matchedRoom,
                endpoint: ep,
              });
            }
          }
        }

        if (validRooms.length === 0) {
          setSenderDutyRooms([]);
          setSelectedPickupDuty(null);
          setPickupEndpoint(null);
          if (!hasShiftOnMap) {
            setSenderDutyReason('Ca trực của bạn không thuộc bản đồ này.');
          } else {
            const firstShift = activeShifts[0];
            setSenderDutyReason(
              `Phòng trực của bạn (${firstShift?.roomCode || ''}) chưa có điểm robot tiếp cận trên bản đồ này.`
            );
          }
          return;
        }

        setSenderDutyRooms(validRooms);
        setSenderDutyReason(null);

        setSelectedPickupDuty((prev) => {
          if (prev && validRooms.some((v) => v.shift.shiftId === prev.shift.shiftId)) {
            return prev;
          }
          return validRooms[0];
        });
        setPickupEndpoint((prev) => {
          if (prev && validRooms.some((v) => v.endpoint.endpointId === prev.endpointId)) {
            return prev;
          }
          return validRooms[0].endpoint;
        });
      } catch (err: any) {
        console.log('Error resolving sender duty rooms:', err);
        setSenderDutyReason('Không thể xác thực ca trực của bạn.');
        setSenderDutyRooms([]);
        setSelectedPickupDuty(null);
        setPickupEndpoint(null);
      }
    },
    []
  );

  // Chọn nhân viên trực -> Tự động điền phòng đang trực của người đó vào Điểm giao hàng (B)
  const handleStaffSelect = useCallback((staff: OnDutyStaffResponse) => {
    setSelectedReceiverStaff(staff);
    setReceiver(staff.fullName);
    setReceiverAccountId(staff.accountId);
    setReceiverShiftId(staff.shiftId);
    setUseManualReceiver(false);
    setRoomDutyWarning(null);

    if (staff.roomId) {
      const matchedRoom = rooms.find((r) => r.roomId === staff.roomId);
      if (matchedRoom) {
        setDeliveryRoom(matchedRoom);
      } else {
        setDeliveryRoom({
          roomId: staff.roomId,
          roomCode: staff.roomCode || '',
          roomName: staff.roomName || staff.roomCode || 'Phòng trực',
        } as RoomDto);
      }

      const ep =
        (staff.endpointId && availableEndpoints.find((e) => e.endpointId === staff.endpointId)) ||
        availableEndpoints.find((e) => e.roomId === staff.roomId && e.active !== false) ||
        null;
      setDeliveryEndpoint(ep);
    }
  }, [rooms, availableEndpoints]);

  const handleClearStaff = useCallback(() => {
    setSelectedReceiverStaff(null);
    setReceiver('');
    setReceiverAccountId('');
    setReceiverShiftId(undefined);
    setUseManualReceiver(true);
    setRoomDutyWarning(null);
  }, []);

  // Chọn phòng nhận hàng (Điểm B) -> Lọc nhân viên trực tại phòng đó
  const handleSelectDeliveryRoom = useCallback(
    async (room: RoomDto) => {
      setDeliveryRoom(room);
      setShowDeliveryRoomModal(false);

      const ep =
        availableEndpoints.find((e) => e.roomId === room.roomId && e.active !== false) || null;
      setDeliveryEndpoint(ep);

      // Khi đổi phòng, bỏ người nhận cũ nếu họ không thuộc phòng mới
      if (selectedReceiverStaff && selectedReceiverStaff.roomId !== room.roomId) {
        setSelectedReceiverStaff(null);
        setReceiver('');
        setReceiverAccountId('');
        setReceiverShiftId(undefined);
      }

      // Lọc danh sách Staff để chỉ hiện người đang trực tại phòng đó
      if (activeMap) {
        try {
          const res = await staffApi.getOnDutyStaff({
            mapId: activeMap.mapId,
            roomId: room.roomId,
          });
          const staffInRoom = res.content || [];

          if (staffInRoom.length === 0) {
            setRoomDutyWarning('Phòng này chưa có nhân viên đang trực.');
            setSelectedReceiverStaff(null);
            setReceiver('');
            setReceiverAccountId('');
            setReceiverShiftId(undefined);
          } else if (staffInRoom.length === 1) {
            const singleStaff = staffInRoom[0];
            setSelectedReceiverStaff(singleStaff);
            setReceiver(singleStaff.fullName);
            setReceiverAccountId(singleStaff.accountId);
            setReceiverShiftId(singleStaff.shiftId);
            setRoomDutyWarning(null);

            if (singleStaff.endpointId) {
              const staffEp = availableEndpoints.find((e) => e.endpointId === singleStaff.endpointId);
              if (staffEp) setDeliveryEndpoint(staffEp);
            }
          } else {
            setRoomDutyWarning(
              `Phòng này có ${staffInRoom.length} nhân viên đang trực. Vui lòng chọn người nhận cụ thể.`
            );
            if (
              !selectedReceiverStaff ||
              !staffInRoom.some((s) => s.accountId === selectedReceiverStaff.accountId)
            ) {
              setSelectedReceiverStaff(null);
              setReceiver('');
              setReceiverAccountId('');
              setReceiverShiftId(undefined);
            }
          }
        } catch (err) {
          console.log('Error loading staff for room:', err);
        }
      }
    },
    [availableEndpoints, selectedReceiverStaff, activeMap]
  );

  // Đổi bản đồ -> Cập nhật lại các lựa chọn theo bản đồ mới
  const handleSelectMap = useCallback(
    (map: MapResponse) => {
      const endpoints = allEndpoints.filter(
        (endpoint) => endpoint.mapId === map.mapId && endpoint.active !== false
      );
      setActiveMap(map);
      setAvailableEndpoints(endpoints);

      // Reset điểm giao hàng và người nhận
      setDeliveryRoom(null);
      setDeliveryEndpoint(null);
      setSelectedReceiverStaff(null);
      setReceiver('');
      setReceiverAccountId('');
      setReceiverShiftId(undefined);
      setRoomDutyWarning(null);

      void resolveSenderDutyRooms(map, rooms, endpoints);
    },
    [allEndpoints, rooms, resolveSenderDutyRooms]
  );

  // Load danh mục Map & Endpoints từ Backend
  useEffect(() => {
    let mounted = true;
    const loadFacility = async () => {
      setIsLoadingFacility(true);
      try {
        const [maps, endpoints, roomList] = await Promise.all([
          facilityApi.getAllMaps(),
          facilityApi.getAllEndpoints(),
          facilityApi.getAllRooms(),
        ]);
        if (!mounted) return;
        const activeMaps = maps.filter((item) => item.status === 'ACTIVE');
        const map = activeMaps[0] || null;
        setAvailableMaps(activeMaps);
        setAllEndpoints(endpoints);
        const mapEndpoints = map
          ? endpoints.filter((endpoint) => endpoint.mapId === map.mapId && endpoint.active !== false)
          : [];
        setActiveMap(map);
        setAvailableEndpoints(mapEndpoints);
        setRooms(roomList);

        // Tự động phân giải phòng trực của người gửi trên bản đồ này
        void resolveSenderDutyRooms(map, roomList, mapEndpoints);
      } catch (err: any) {
        if (mounted) {
          Alert.alert('Không tải được danh mục', err?.message || 'Không thể lấy map và điểm đến từ Backend.');
        }
      } finally {
        if (mounted) setIsLoadingFacility(false);
      }
    };
    loadFacility();
    return () => {
      mounted = false;
    };
  }, [scope, resolveSenderDutyRooms]);

  const refreshSelectedJob = useCallback(async (jobId: string): Promise<JobSnapshot> => {
    const revision = ++jobReadRevision.current;
    const requestScope = scopeRef.current;
    const detail = await loadJobSnapshot(jobId);
    if (scopeRef.current === requestScope && selectedJobId.current === jobId && jobReadRevision.current === revision) {
      setSnapshot(detail);
      setJobError('');
    }
    return detail;
  }, []);

  const followJob = useCallback(async (jobId: string) => {
    const target = jobId.trim().toLowerCase();
    if (!UUID_PATTERN.test(target)) {
      setJobError('Nhập Job ID hợp lệ (UUID).');
      return;
    }
    if (selectedJobId.current !== target) {
      selectedJobId.current = target;
      setScan(null);
      setSnapshot(null);
      setRespondedStepId('');
    }
    setManualJobIdInput(target);
    setJobError('');
    const requestScope = scopeRef.current;
    try {
      await refreshSelectedJob(target);
    } catch (error) {
      if (scopeRef.current === requestScope && selectedJobId.current === target) {
        setJobError((error as { message?: string })?.message || 'Không tải được nhiệm vụ đã chọn.');
      }
    }
  }, [refreshSelectedJob]);

  const getJobDisplayInfo = useCallback(
    (job: JobResponse) => {
      const d = job.serviceRequestId ? deliveriesMap[job.serviceRequestId] : undefined;
      const input = (job.inputJson || {}) as Record<string, any>;

      // 1. Tên hàng hoặc loại giao hàng
      let title = 'Nhiệm vụ giao hàng';
      if (d?.items && d.items.length > 0 && d.items[0]?.itemName) {
        title = d.items[0].itemName;
      } else if (d?.items && d.items.length > 0 && d.items[0]?.itemCode) {
        title = d.items[0].itemCode;
      } else if (d?.request?.requestNote) {
        title = d.request.requestNote;
      } else if (Array.isArray(input.items) && input.items[0]?.item_name) {
        title = input.items[0].item_name;
      } else if (Array.isArray(input.items) && input.items[0]?.itemName) {
        title = input.items[0].itemName;
      }

      // 2. Điểm lấy -> Điểm giao
      let fromText = 'Điểm lấy hàng';
      if (d?.pickupRoomId) {
        const r = rooms.find((room) => room.roomId === d.pickupRoomId);
        fromText = r ? r.roomName : 'Phòng lấy hàng';
      } else if (d?.pickupEndpointId) {
        const ep = allEndpoints.find((e) => e.endpointId === d.pickupEndpointId);
        fromText = ep?.endpointName || 'Điểm lấy hàng';
      } else if (input.pickup_endpoint_id) {
        const ep = allEndpoints.find((e) => e.endpointId === input.pickup_endpoint_id);
        fromText = ep?.endpointName || 'Điểm lấy hàng';
      }

      let toText = 'Điểm giao hàng';
      if (d?.deliveryRoomId) {
        const r = rooms.find((room) => room.roomId === d.deliveryRoomId);
        toText = r ? r.roomName : 'Phòng giao hàng';
      } else if (d?.deliveryEndpointId) {
        const ep = allEndpoints.find((e) => e.endpointId === d.deliveryEndpointId);
        toText = ep?.endpointName || 'Điểm giao hàng';
      } else if (d?.recipientName) {
        toText = d.recipientName;
      } else if (input.delivery_endpoint_id) {
        const ep = allEndpoints.find((e) => e.endpointId === input.delivery_endpoint_id);
        toText = ep?.endpointName || 'Điểm giao hàng';
      }

      const route = `${fromText} → ${toText}`;

      // 3. Trạng thái bằng tiếng Việt
      let statusLabel = 'Chờ điều phối';
      let statusColor = '#D97706';
      let statusBg = '#FEF3C7';

      switch (job.status) {
        case 'RUNNING':
          statusLabel = 'Đang vận chuyển';
          statusColor = '#0284C7';
          statusBg = '#E0F2FE';
          break;
        case 'QUEUED':
          statusLabel = 'Chờ điều phối';
          statusColor = '#D97706';
          statusBg = '#FEF3C7';
          break;
        case 'ACCEPTED':
          statusLabel = 'Robot đã nhận';
          statusColor = '#0369A1';
          statusBg = '#E0F2FE';
          break;
        case 'SUCCEEDED':
          statusLabel = 'Hoàn tất';
          statusColor = '#059669';
          statusBg = '#D1FAE5';
          break;
        case 'FAILED':
          statusLabel = 'Thất bại';
          statusColor = '#DC2626';
          statusBg = '#FEE2E2';
          break;
        case 'CANCELLED':
          statusLabel = 'Đã hủy';
          statusColor = '#64748B';
          statusBg = '#F1F5F9';
          break;
        case 'RECOVERY_REQUIRED':
          statusLabel = 'Cần kiểm tra';
          statusColor = '#EA580C';
          statusBg = '#FFEDD5';
          break;
        default:
          statusLabel = job.status || 'Chưa rõ';
      }

      return {
        title,
        route,
        statusLabel,
        statusColor,
        statusBg,
      };
    },
    [deliveriesMap, rooms, allEndpoints]
  );

  const loadRecentJobsAndDetail = useCallback(async (preferredJobId?: string) => {
    const requestScope = scopeRef.current;
    setIsLoadingJobs(true);
    try {
      if (preferredJobId) await followJob(preferredJobId);
      if (scopeRef.current !== requestScope) return;
      const page = await dispatchApi.getJobs({ page: 0, size: 20 });
      if (scopeRef.current !== requestScope) return;
      const allJobs = page?.content || [];
      // Lọc các nhiệm vụ giao nhận mà tài khoản được BE cho phép xem
      const deliveryJobs = allJobs.filter(
        (j) =>
          j.serviceRequestId ||
          Boolean((j.inputJson as any)?.items) ||
          Boolean((j.inputJson as any)?.pickup_endpoint_id)
      );
      setRecentJobs(deliveryJobs);

      // Nạp chi tiết DeliveryResponse cho các job có serviceRequestId
      const missingIds = Array.from(
        new Set(
          deliveryJobs
            .map((j) => j.serviceRequestId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0)
            .filter((id) => !deliveriesMap[id])
        )
      );

      if (missingIds.length > 0) {
        void Promise.allSettled(
          missingIds.map((id) => deliveryApi.getDeliveryById(id))
        ).then((results) => {
          if (scopeRef.current !== requestScope) return;
          const newEntries: Record<string, DeliveryResponse> = {};
          results.forEach((r, idx) => {
            if (r.status === 'fulfilled' && r.value) {
              newEntries[missingIds[idx]] = r.value;
            }
          });
          if (Object.keys(newEntries).length > 0) {
            setDeliveriesMap((prev) => ({ ...prev, ...newEntries }));
          }
        });
      }
    } catch (error) {
      if (scopeRef.current === requestScope) {
        setJobError((error as { message?: string })?.message || 'Không tải được danh sách nhiệm vụ.');
      }
    } finally {
      if (scopeRef.current === requestScope) setIsLoadingJobs(false);
    }
  }, [followJob, deliveriesMap]);

  useEffect(() => {
    selectedJobId.current = null;
    attemptRef.current = null;
    setAttemptReady(false);
    submitInFlight.current = false;
    stepInFlight.current = false;
    setSnapshot(null);
    setScan(null);
    setRecentJobs([]);
    setManualJobIdInput('');
    setJobError('');
    setPendingDeliveryLabel('');
    setIsSubmitting(false);
    setIsSendingStepResponse(false);
    setRespondedStepId('');
    setReceiverAccountId('');
    setReceiver('');
    setSelectedReceiverStaff(null);
    setUseManualReceiver(false);
    void loadDeliveryAttempt(scope).then(attempt => {
      if (scopeRef.current !== scope) return;
      attemptRef.current = attempt;
      setPendingDeliveryLabel(attempt ? attempt.submitted ? 'Tìm lại Job' : attempt.requestId ? 'Gửi lại yêu cầu đã tạo' : 'Thử lại yêu cầu' : '');
      setAttemptReady(true);
    }).catch(error => {
      if (scopeRef.current === scope) setJobError(error?.message || 'Không đọc được yêu cầu đang chờ.');
    });
    void loadRecentJobsAndDetail();
  }, [scope, user?.accountId, loadRecentJobsAndDetail]);

  useEffect(() => {
    const jobId = activeJob?.jobId;
    if (!jobId || !['QUEUED', 'ACCEPTED', 'RUNNING'].includes(activeJob.status)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(async () => {
        if (stopped || selectedJobId.current !== jobId || scopeRef.current !== scope) return;
        try {
          await refreshSelectedJob(jobId);
        } catch {
          if (!stopped) setJobError('Đang kết nối lại trạng thái nhiệm vụ.');
        }
        if (!stopped) schedule();
      }, 3000);
    };
    schedule();
    return () => { stopped = true; clearTimeout(timer); };
  }, [activeJob?.jobId, activeJob?.status, refreshSelectedJob, scope]);

  const currentStep = activeJob?.steps?.find(step => step.jobStepId === activeJob.selectedJobStepId);
  const runningStep = selectedRunningStep(activeJob);
  const phase = deliveryPhase(runningStep);
  const assignedAccount = expectedDeliveryAccount(activeJob, phase, snapshot?.delivery);
  const myTurn = !assignedAccount || !user?.accountId || assignedAccount === user.accountId.toLowerCase();
  const qrContext = scanContext(activeJob, user?.accountId, snapshot?.delivery);
  const response = myTurn
    ? handoffResponse(runningStep)
    : undefined;

  const verifyDeliveryQr = async (context: DeliveryScanContext, raw: string) => {
    const proof = robotDeliveryProof(raw, context);
    const current = () => scopeRef.current === scope && selectedJobId.current === context.jobId;
    if (!current()) throw new Error('Nhiệm vụ hoặc tài khoản đã thay đổi.');
    const latest = await refreshSelectedJob(context.jobId);
    const active = scanContext(latest.job, context.accountId, latest.delivery);
    if (!current() || active?.stepId !== context.stepId || active.purpose !== context.purpose) {
      throw new Error('Robot không còn chờ bạn xác thực ở chặng này.');
    }
    try {
      const verified = await deliveryApi.verifyQr(context.jobId, proof);
      if (!verificationMatches(verified, context)) {
        throw new Error('Máy chủ trả về xác thực cho nhiệm vụ hoặc chặng khác.');
      }
    } finally {
      if (current()) void refreshSelectedJob(context.jobId).catch(() => {});
    }
  };

  const handleRespondStep = async () => {
    if (!activeJob || !runningStep || !response || !user?.accountId || stepInFlight.current) return;
    const jobId = activeJob.jobId;
    const stepId = runningStep.jobStepId;
    const accountId = user.accountId;
    const current = () => scopeRef.current === scope && selectedJobId.current === jobId;
    if (!current()) return;
    stepInFlight.current = true;
    setIsSendingStepResponse(true);
    try {
      const latest = await refreshSelectedJob(jobId);
      if (!current()) return;
      const step = selectedRunningStep(latest.job);
      const latestResponse = handoffResponse(step);
      const latestAccount = expectedDeliveryAccount(latest.job, deliveryPhase(step), latest.delivery);
      if (step?.jobStepId !== stepId || latestAccount !== accountId.toLowerCase() ||
          latestResponse?.responseType !== response.responseType) {
        throw new Error('Bước hoặc tài khoản được phân công đã thay đổi. Hãy xem trạng thái nhiệm vụ.');
      }
      await deliveryApi.respondJobStep(stepId, latestResponse, handoffResponseKey(stepId, accountId, latestResponse.responseType));
      if (current()) setRespondedStepId(stepId);
    } catch (error) {
      if (current()) {
        Alert.alert('Chưa xác nhận được thao tác', (error as { message?: string })?.message || 'Hãy làm mới trạng thái và thử lại.');
      }
    } finally {
      if (scopeRef.current === scope) {
        stepInFlight.current = false;
        setIsSendingStepResponse(false);
        if (current()) void refreshSelectedJob(jobId).catch(() => {});
      }
    }
  };

  const currentCategoryAndUnit = getItemCategoryAndUnit(selectedTasks);
  const currentItemUnit = currentCategoryAndUnit.unit;
  const quantityCheck = validateQuantity(quantity);

  const submitValidationMessage = useMemo(() => {
    if (attemptRef.current) return null;
    if (!activeMap) return 'Chưa chọn bản đồ hoạt động.';
    if (senderDutyReason) return senderDutyReason;
    if (!selectedPickupDuty || !pickupEndpoint) {
      return 'Chưa xác định phòng trực lấy hàng của bạn (Điểm A).';
    }
    if (!deliveryRoom || !deliveryEndpoint) {
      return 'Vui lòng chọn phòng giao hàng (Điểm B).';
    }
    if (
      selectedPickupDuty.room.roomId === deliveryRoom.roomId ||
      pickupEndpoint.endpointId === deliveryEndpoint.endpointId
    ) {
      return 'Điểm lấy hàng (A) và điểm giao hàng (B) phải ở hai vị trí khác nhau.';
    }
    if (!receiver.trim() || !receiverAccountId.trim()) {
      return 'Vui lòng chọn nhân viên nhận hàng đang trực.';
    }
    if (!itemName.trim()) {
      return 'Vui lòng nhập tên hàng cần vận chuyển.';
    }
    if (!quantityCheck.valid) {
      return quantityCheck.error || 'Vui lòng nhập số lượng hợp lệ.';
    }
    if (authMode === 'face' && !faceVerified) {
      return 'Nhiệm vụ này cần chụp / xác nhận khuôn mặt người nhận trước khi tạo.';
    }
    return null;
  }, [
    activeMap,
    senderDutyReason,
    selectedPickupDuty,
    pickupEndpoint,
    deliveryRoom,
    deliveryEndpoint,
    receiver,
    receiverAccountId,
    itemName,
    quantityCheck.valid,
    quantityCheck.error,
    authMode,
    faceVerified,
  ]);

  const canSubmit = attemptRef.current
    ? !isSubmitting && attemptReady
    : !isSubmitting && !isLoadingFacility && attemptReady && !submitValidationMessage;

  const isHighSecurityItem = selectedTasks.some(t => ['van_chuyen_thuoc', 'van_chuyen_mau', 'van_chuyen_vat_tu'].includes(t));

  const toggleTask = useCallback((id: TaskType) => {
    setSelectedTasks(previous => previous.includes(id) ? previous.filter(task => task !== id) : [...previous, id]);
  }, []);

  const handleSelectAuthMode = useCallback((mode: DeliveryAuthMode) => {
    setAuthMode(mode);
    if (mode === 'no_auth') {
      setSelectedTasks(['van_chuyen_tai_lieu']);
      setItemName('Tài liệu y tế / Hồ sơ bệnh án');
    } else if (mode === 'qr') {
      setSelectedTasks(['van_chuyen_thuoc']);
      setItemName('Thuốc theo toa / Vật tư y tế');
    } else if (mode === 'face') {
      setSelectedTasks(['van_chuyen_mau']);
      setItemName('Mẫu máu xét nghiệm / Thuốc đặc trị');
    }
  }, []);

  const sendDelivery = async (attempt: DeliveryAttempt) => {
    if (submitInFlight.current || scopeRef.current !== scope) return;
    submitInFlight.current = true;
    attemptRef.current = attempt;
    setIsSubmitting(true);
    const current = () => scopeRef.current === scope && attemptRef.current === attempt;
    try {
      await saveDeliveryAttempt(scope, attempt);
      const job = await continueDeliverySubmission(attempt, submissionApi, current, () => saveDeliveryAttempt(scope, attempt));
      if (!current()) return;
      if (!job?.jobId) {
        Alert.alert('Đã gửi yêu cầu', 'Máy chủ đang tạo Job. Bấm Tìm lại Job để tiếp tục.');
        return;
      }
      await saveDeliveryAttempt(scope, null);
      attemptRef.current = null;
      setPendingDeliveryLabel('');
      void followJob(job.jobId);
      Alert.alert(
        'Đã tạo nhiệm vụ giao hàng thành công! 🎉',
        `Nhiệm vụ: ${itemName || 'Giao hàng y tế'}\n\nLộ trình: ${fromRoom} → ${toRoom}\n\nBạn có thể mở mã QR ngay để sẵn sàng đưa màn hình trước Camera của Robot quét mở khóa Servo.`,
        [
          { text: 'Đóng', style: 'cancel' },
          {
            text: '⚡ Mở mã QR cho Robot ngay',
            onPress: () => {
              setScan({
                jobId: job.jobId,
                stepId: '',
                purpose: 'DELIVERY_SENDER',
                accountId: user?.accountId || '',
              });
            },
          },
        ]
      );
    } catch (error) {
      if (!current()) return;
      const problem = error as { status?: number; message?: string };
      if (!attempt.requestId && [400, 403, 404, 422].includes(problem.status || 0)) {
        try {
          await saveDeliveryAttempt(scope, null);
          attemptRef.current = null;
          setPendingDeliveryLabel('');
        } catch { /* Keep the attempt until local persistence can be reconciled. */ }
      }
      Alert.alert(attempt.requestId ? 'Chưa gửi được nhiệm vụ' : 'Chưa tạo được yêu cầu', problem.message || 'Hãy thử lại.');
    } finally {
      if (scopeRef.current === scope) {
        if (attemptRef.current === attempt) {
          setPendingDeliveryLabel(attempt.submitted ? 'Tìm lại Job' : attempt.requestId ? 'Gửi lại yêu cầu đã tạo' : 'Thử lại yêu cầu');
        }
        submitInFlight.current = false;
        setIsSubmitting(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (submitInFlight.current || !attemptReady) return;
    if (attemptRef.current) {
      void sendDelivery(attemptRef.current);
      return;
    }
    if (!activeMap) {
      Alert.alert('Chưa chọn bản đồ', 'Vui lòng chọn bản đồ đang sử dụng.');
      return;
    }
    if (senderDutyReason || !selectedPickupDuty || !pickupEndpoint) {
      Alert.alert(
        'Không thể lấy hàng từ ca trực',
        senderDutyReason || 'Chưa xác định được phòng trực hợp lệ của người gửi trên bản đồ này.'
      );
      return;
    }
    if (!deliveryRoom || !deliveryEndpoint) {
      Alert.alert(
        'Thiếu điểm giao hàng',
        'Vui lòng chọn phòng nhận hoặc nhân viên nhận hàng trên bản đồ.'
      );
      return;
    }
    if (
      selectedPickupDuty.room.roomId === deliveryRoom.roomId ||
      pickupEndpoint.endpointId === deliveryEndpoint.endpointId
    ) {
      Alert.alert('Trùng điểm A và B', 'Điểm lấy hàng (A) và điểm giao hàng (B) phải ở hai vị trí khác nhau.');
      return;
    }

    const senderId = (currentSenderAccount?.accountId || user?.accountId || '').trim().toLowerCase();
    const receiverId = receiverAccountId.trim().toLowerCase();
    if (!user?.accountId || !UUID_PATTERN.test(senderId) || !UUID_PATTERN.test(receiverId)) {
      Alert.alert('Thiếu tài khoản được phân công', 'Nhập Account ID (UUID) của người gửi và người nhận.');
      return;
    }
    const quantityValidation = validateQuantity(quantity);
    if (!quantityValidation.valid || quantityValidation.value === undefined) {
      Alert.alert(
        'Số lượng không hợp lệ',
        quantityValidation.error || 'Vui lòng nhập số lượng nguyên dương từ 1 đến 2.147.483.647.'
      );
      return;
    }
    const itemQuantity = quantityValidation.value;
    if (!itemName.trim() || !receiver.trim()) {
      Alert.alert('Thiếu thông tin giao hàng', 'Vui lòng nhập đầy đủ tên hàng và người nhận.');
      return;
    }
    if (authMode === 'face' && !faceVerified) {
      Alert.alert(
        'Yêu cầu xác nhận khuôn mặt ⚠️',
        'Nhiệm vụ này ở chế độ "Xác nhận khuôn mặt". Bạn cần chụp ảnh / quét khuôn mặt người nhận trước khi tạo nhiệm vụ!',
        [
          { text: 'Hủy', style: 'cancel' },
          { text: 'Chụp khuôn mặt ngay', onPress: () => setShowFaceScan(true) },
        ]
      );
      return;
    }

    // Kiểm tra lại ca trực của người nhận trước khi gửi
    if (selectedReceiverStaff?.shiftId) {
      try {
        const dutyCheck = await staffApi.getOnDutyStaff({
          mapId: activeMap.mapId,
          roomId: deliveryRoom.roomId,
        });
        const stillOnDuty = (dutyCheck.content || []).find(
          (s) => s.accountId.toLowerCase() === receiverId && s.shiftId === selectedReceiverStaff.shiftId
        );
        if (!stillOnDuty) {
          Alert.alert(
            'Ca trực đã thay đổi ⚠️',
            `Người nhận (${receiver}) không còn trong ca trực hợp lệ tại phòng ${deliveryRoom.roomName}. Danh sách đã được làm mới, vui lòng chọn lại.`
          );
          setSelectedReceiverStaff(null);
          setReceiver('');
          setReceiverAccountId('');
          setReceiverShiftId(undefined);
          return;
        }
      } catch (checkErr) {
        console.log('Error verifying receiver duty:', checkErr);
      }
    }

    const { category: itemCategory, unit } = getItemCategoryAndUnit(selectedTasks);

    const modeTag =
      authMode === 'no_auth'
        ? '[CHẾ ĐỘ: KHÔNG CẦN XÁC NHẬN - GIAO MỞ TỰ DO]'
        : authMode === 'qr'
        ? '[CHẾ ĐỘ: CẦN XÁC NHẬN QR - MỞ KHÓA SERVO]'
        : `[CHẾ ĐỘ: XÁC NHẬN KHUÔN MẶT (FACE ID) - ĐÃ XÁC THỰC (${receiver.trim()})]`;
    const deliveryNote = notes.trim() ? `${modeTag} ${notes.trim()}` : modeTag;

    const payload = {
      mapId: activeMap.mapId,
      targetMode: 'ENDPOINT' as const,
      pickupRoomId: selectedPickupDuty.room.roomId,
      pickupEndpointId: pickupEndpoint.endpointId,
      deliveryRoomId: deliveryRoom.roomId,
      deliveryEndpointId: deliveryEndpoint.endpointId,
      expectedSenderAccountId: senderId,
      expectedReceiverAccountId: receiverId,
      receiverShiftId: receiverShiftId || selectedReceiverStaff?.shiftId || undefined,
      recipientName: receiver.trim(),
      requiresConfirmation: true,
      priority: { high: 80, normal: 50, low: 20 }[priority],
      deliveryNote,
      items: [
        {
          itemCode: 'ITEM-01',
          itemName: itemName.trim(),
          itemCategory,
          unit,
          quantity: itemQuantity,
          sensitive: authMode === 'face' || isHighSecurityItem,
        },
      ],
    };

    const modeName =
      authMode === 'no_auth'
        ? '🔓 Không cần xác nhận (Giao mở tự do)'
        : authMode === 'qr'
        ? '🛡️ Cần xác nhận QR (Khóa Servo)'
        : '👤 Xác nhận khuôn mặt (Face ID)';

    Alert.alert(
      'Xác nhận tạo nhiệm vụ giao hàng',
      `Phương thức: ${modeName}\nLộ trình: ${fromRoom} → ${toRoom}\nVật phẩm: ${itemName.trim()} × ${itemQuantity}\nNgười nhận: ${receiver.trim()} (${receiverId})`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Tạo & gửi',
          onPress: () => {
            if (attemptRef.current || submitInFlight.current || scopeRef.current !== scope) return;
            const key =
              globalThis.crypto?.randomUUID?.() ||
              'delivery-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            void sendDelivery({ key, payload });
          },
        },
      ]
    );
  };

  const responseLabel = response?.responseType === 'PAYLOAD_CONFIRMED'
    ? phase === 'sender' ? 'Đã đặt đủ hàng vào thùng' : 'Đã lấy đủ hàng khỏi thùng'
    : response?.responseType === 'DOOR_CLOSED' ? 'Đã đóng nắp, tay đã rời cơ cấu khóa'
    : 'Đã kiểm tra thùng khóa chắc';
  const canRespond = !!response && !!runningStep && !jobError && respondedStepId !== runningStep.jobStepId;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StaffHeader />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.eyebrow}>GIAO NHẬN HÀNG</Text>
        <Text style={styles.title}>Nhiệm vụ của bạn</Text>
        <Text style={styles.muted}>Theo dõi robot, quét mã tại điểm gửi và điểm nhận, xác nhận từng bước bàn giao.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.heading}>Theo dõi giao nhận</Text>
            <TouchableOpacity style={styles.smallButton} disabled={isLoadingJobs} onPress={() => { void loadRecentJobsAndDetail(selectedJobId.current || undefined); }}>
              {isLoadingJobs ? <ActivityIndicator color={Colors.primary} /> : <RefreshCw size={18} color={Colors.primary} />}
              <Text style={styles.link}>Làm mới</Text>
            </TouchableOpacity>
          </View>
          {/* Danh sách nhiệm vụ giao nhận của tài khoản */}
          <View style={styles.deliveryJobList}>
            {recentJobs.length === 0 ? (
              <View style={styles.emptyJobsBox}>
                <Package size={26} color="#94A3B8" />
                <Text style={styles.emptyJobsText}>
                  {isLoadingJobs
                    ? 'Đang tải danh sách nhiệm vụ giao nhận...'
                    : 'Chưa có nhiệm vụ giao nhận nào trong phạm vi tài khoản của bạn.'}
                </Text>
              </View>
            ) : (
              recentJobs.map((job) => {
                const info = getJobDisplayInfo(job);
                const isSelected = activeJob?.jobId === job.jobId;
                return (
                  <TouchableOpacity
                    key={job.jobId}
                    style={[
                      styles.jobItemCard,
                      isSelected && styles.jobItemCardActive,
                    ]}
                    onPress={() => {
                      void followJob(job.jobId);
                    }}
                    activeOpacity={0.8}
                  >
                    <View style={styles.jobItemHeader}>
                      <View style={styles.jobItemTitleRow}>
                        <View
                          style={[
                            styles.jobItemIconBox,
                            isSelected && { backgroundColor: '#E0F2FE' },
                          ]}
                        >
                          <Truck
                            size={16}
                            color={isSelected ? Colors.primary : Colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.jobItemTitle,
                            isSelected && { color: Colors.primary },
                          ]}
                          numberOfLines={1}
                        >
                          {info.title}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.jobItemStatusBadge,
                          { backgroundColor: info.statusBg },
                        ]}
                      >
                        <Text
                          style={[
                            styles.jobItemStatusText,
                            { color: info.statusColor },
                          ]}
                        >
                          {info.statusLabel}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.jobItemRouteRow}>
                      <MapPin size={13} color="#64748B" />
                      <Text style={styles.jobItemRouteText} numberOfLines={1}>
                        {info.route}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
          {!!jobError && <Text accessibilityRole="alert" style={styles.error}>{jobError}</Text>}
          {activeJob ? <>
            <View style={styles.statusBox}>
              <View style={styles.jobHeaderRow}>
                <View style={styles.flex}>
                  <Text style={styles.heading}>{getJobDisplayInfo(activeJob).title}</Text>
                  <Text style={styles.small}>{getJobDisplayInfo(activeJob).route}</Text>
                </View>
                <View style={[
                  styles.statusBadge,
                  activeJob.status === 'SUCCEEDED' ? styles.statusBadgeSuccess
                  : activeJob.status === 'RUNNING' ? styles.statusBadgeRunning
                  : styles.statusBadgePending
                ]}>
                  <Text style={[
                    styles.statusBadgeText,
                    activeJob.status === 'SUCCEEDED' ? styles.statusBadgeTextSuccess
                    : activeJob.status === 'RUNNING' ? styles.statusBadgeTextRunning
                    : styles.statusBadgeTextPending
                  ]}>
                    {activeJob.status === 'QUEUED' ? '⏳ HÀNG ĐỢI'
                      : activeJob.status === 'RUNNING' ? '⚡ ĐANG CHẠY'
                      : activeJob.status === 'SUCCEEDED' ? '✓ HOÀN TẤT'
                      : activeJob.status}
                  </Text>
                </View>
              </View>

              {/* Chi tiết bước hiện tại */}
              <View style={styles.stepProgressCard}>
                <View style={styles.stepProgressHeader}>
                  {activeJob.status === 'QUEUED' ? (
                    <Clock size={16} color="#D97706" />
                  ) : activeJob.status === 'SUCCEEDED' ? (
                    <CheckCircle2 size={16} color="#059669" />
                  ) : qrContext ? (
                    <QrCode size={16} color="#0284C7" />
                  ) : (
                    <Truck size={16} color={Colors.primary} />
                  )}
                  <Text style={styles.stepProgressTitle}>
                    {activeJob.status === 'SUCCEEDED'
                      ? 'Nhiệm vụ đã hoàn tất'
                      : activeJob.status === 'RECOVERY_REQUIRED'
                      ? 'Cần kiểm tra robot và thùng hàng'
                      : activeJob.cancelRequestedAt
                      ? 'Đang xử lý yêu cầu hủy'
                      : currentStep
                      ? STEP_LABELS[currentStep.stepCodeSnapshot || ''] || currentStep.stepTypeSnapshot
                      : 'Đang trong hàng đợi điều phối Robot'}
                  </Text>
                </View>
                <Text style={styles.stepProgressDesc}>
                  {activeJob.status === 'QUEUED'
                    ? 'Robot đang offline hoặc chưa nhận nhiệm vụ. Khi Robot sẵn sàng, hệ thống sẽ tự động điều phối Robot chạy tới Điểm A.'
                    : currentStep?.stepCodeSnapshot === 'MOVE_SENDER'
                    ? 'Robot đang tự hành di chuyển đến Điểm lấy hàng A. Vui lòng đợi Robot tới nơi, nút hiện mã QR sẽ tự động kích hoạt.'
                    : currentStep?.stepCodeSnapshot === 'AUTH_SENDER'
                    ? '🟢 Robot đã đến Điểm lấy hàng A! Hãy bấm nút "Hiện mã QR" bên dưới để đưa cho Robot quét mở ngăn tủ.'
                    : currentStep?.stepCodeSnapshot === 'UNLOCK_SENDER'
                    ? 'Robot đang mở khóa Servo ngăn tủ chứa hàng...'
                    : currentStep?.stepCodeSnapshot === 'PAYLOAD_SENDER'
                    ? 'Hãy đặt hàng vào thùng và bấm xác nhận bên dưới.'
                    : currentStep?.stepCodeSnapshot === 'MOVE_RECEIVER'
                    ? 'Robot đang vận chuyển hàng đến Điểm giao hàng B...'
                    : currentStep?.stepCodeSnapshot === 'AUTH_RECEIVER'
                    ? '🟢 Robot đã đến Điểm B! Người nhận bấm nút bên dưới để hiện mã QR cho Robot quét mở tủ lấy hàng.'
                    : 'Theo dõi chỉ dẫn hiển thị trên màn hình.'}
                </Text>
              </View>

              {!!activeJob.failureReason && <Text style={styles.error}>{activeJob.failureReason}</Text>}
              {!!assignedAccount && (
                <Text style={styles.small}>
                  {phase === 'sender'
                    ? `👤 Người gửi: ${myTurn ? 'Bạn' : 'Nhân viên gửi'}`
                    : `👤 Người nhận: ${myTurn ? 'Bạn' : snapshot?.delivery?.recipientName || 'Nhân viên nhận hàng'}`}
                </Text>
              )}
              {runningStep && !myTurn && <Text style={styles.muted}>Đang chờ nhân viên được phân công thực hiện bước này.</Text>}
            </View>

            <DeliveryCancelAction key={`${scope}:${activeJob.jobId}`} snapshot={{ job: activeJob, delivery: snapshot?.delivery }}
              accountId={user?.accountId || ''} refresh={refreshSelectedJob} unavailable={!!jobError || isSendingStepResponse} />

            {/* Nút vào QR để robot quét nhanh */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.quickQrButton,
                qrContext && styles.qrButtonActive,
              ]}
              onPress={() => {
                setScan({
                  jobId: activeJob.jobId,
                  stepId: currentStep?.jobStepId || '',
                  purpose: phase === 'receiver' ? 'DELIVERY_RECEIVER' : 'DELIVERY_SENDER',
                  accountId: user?.accountId || '',
                });
              }}
              activeOpacity={0.8}
            >
              <Zap size={20} color="#fff" />
              <Text style={styles.quickQrButtonText}>
                {qrContext
                  ? '⚡ HIỆN MÃ QR CHO ROBOT QUÉT (MỞ SERVO)'
                  : '⚡ MỞ MÃ QR CHO ROBOT QUÉT NGAY'}
              </Text>
            </TouchableOpacity>
            {response && <View style={styles.actions}>
              {response.responseType === 'PAYLOAD_CONFIRMED' && Array.isArray(response.data?.items) &&
                response.data.items.map((item: any, index: number) => <Text key={index} style={styles.small}>{item.item_name || item.item_code || 'Hàng được giao'} · {item.quantity} {item.unit || ''}</Text>)}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.confirmActionButton,
                  (!canRespond || isSendingStepResponse) && styles.disabled,
                ]}
                disabled={!canRespond || isSendingStepResponse}
                onPress={() => { void handleRespondStep(); }}
                activeOpacity={0.8}
              >
                {isSendingStepResponse ? <ActivityIndicator color="#fff" /> : <PackageCheck size={20} color="#fff" />}
                <Text style={styles.confirmActionButtonText}>
                  {respondedStepId === runningStep?.jobStepId ? 'Đã gửi, chờ cập nhật' : responseLabel}
                </Text>
              </TouchableOpacity>
            </View>}
            <Text style={styles.small}>Xác thực QR và phản hồi cơ cấu mở khóa là hai bước riêng. Hãy thực hiện theo hướng dẫn đang hiển thị.</Text>
          </> : <Text style={styles.muted}>Chọn nhiệm vụ hoặc nhập Job ID để xem bước giao nhận.</Text>}
        </View>

        {/* ===== FORM TẠO NHIỆM VỤ GIAO NHẬN MỚI (5 NHÓM CHUẨN MOBILE) ===== */}
        <View style={styles.createTaskContainer}>
          <View style={styles.createTaskHeader}>
            <Text style={styles.eyebrow}>GIAO NHIỆM VỤ CHO ROBOT</Text>
            <Text style={styles.title}>Tạo giao nhận mới</Text>
            <Text style={styles.muted}>
              Thiết kế tối ưu thao tác một tay cho nhân viên y tế: chọn phương thức, vật phẩm, lộ trình và người nhận.
            </Text>
          </View>

          {!!pendingDeliveryLabel && (
            <View style={styles.statusBox}>
              <Text style={styles.muted}>
                Một yêu cầu đang chờ kết quả từ máy chủ. Các lần thử lại giữ nguyên nội dung ban đầu đã gửi.
              </Text>
              <Text selectable style={styles.small}>
                {attemptRef.current?.requestId || 'Đang xác định kết quả tạo yêu cầu...'}
              </Text>
            </View>
          )}

          {/* NHÓM 1: PHƯƠNG THỨC BẢO MẬT & XÁC THỰC */}
          <View style={styles.groupCard}>
            <View style={styles.groupHeaderRow}>
              <View style={styles.groupNumberCircle}>
                <Text style={styles.groupNumberText}>1</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupTitle}>Phương thức bảo mật</Text>
                <Text style={styles.groupSubtitle}>Cơ chế xác thực khi mở hộc tủ robot</Text>
              </View>
            </View>

            {/* Selector mở Bottom Sheet */}
            <TouchableOpacity
              style={styles.authModeSelectorCard}
              onPress={() => setShowAuthModeSheet(true)}
              activeOpacity={0.8}
              accessibilityLabel="Chọn phương thức bảo mật"
              accessibilityRole="button"
            >
              <View
                style={[
                  styles.authModeIconCircle,
                  authMode === 'no_auth' && styles.authModeIconCircleNoAuth,
                  authMode === 'qr' && styles.authModeIconCircleQr,
                  authMode === 'face' && styles.authModeIconCircleFace,
                ]}
              >
                {authMode === 'no_auth' && <Unlock size={20} color="#0284C7" />}
                {authMode === 'qr' && <QrCode size={20} color={Colors.primary} />}
                {authMode === 'face' && <Camera size={20} color="#D97706" />}
              </View>
              <View style={styles.flex}>
                <Text style={styles.authModeSelectorTitle}>
                  {authMode === 'no_auth'
                    ? '1. Giao mở tự do (Không cần xác nhận)'
                    : authMode === 'qr'
                    ? '2. Bảo mật quét mã QR (Khuyên dùng)'
                    : '3. Xác thực khuôn mặt (Face ID)'}
                </Text>
                <Text style={styles.authModeSelectorSub}>
                  {authMode === 'no_auth'
                    ? 'Robot tự động mở hộc khi đến phòng nhận'
                    : authMode === 'qr'
                    ? 'Khóa Servo · Robot quét mã QR từ điện thoại'
                    : 'Sinh trắc học · Nhận diện người nhận'}
                </Text>
              </View>
              <ChevronDown size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            {/* Câu hướng dẫn chính */}
            <Text style={styles.authModeGuideShort}>
              {authMode === 'no_auth'
                ? '• Phù hợp: Văn thư, hồ sơ bệnh án, đồ dùng không nhạy cảm. Robot sẽ tự mở nắp hộc khi đến nơi.'
                : authMode === 'qr'
                ? '• Phù hợp: Thuốc theo toa, vật tư y tế, mẫu bệnh phẩm. Robot quét mã QR từ điện thoại để mở ngăn tủ.'
                : '• Phù hợp: Thuốc đặc trị, mẫu máu khẩn. Robot nhận diện khuôn mặt người nhận trước khi mở khóa.'}
            </Text>

            {/* Nút Xem chi tiết hướng dẫn (Toggle) */}
            <TouchableOpacity
              style={styles.guideToggleBtn}
              onPress={() => setShowAuthGuideDetail(!showAuthGuideDetail)}
              activeOpacity={0.7}
            >
              <Text style={styles.guideToggleBtnText}>
                {showAuthGuideDetail ? '▲ Thu gọn hướng dẫn' : '▼ Xem chi tiết quy trình giao nhận'}
              </Text>
            </TouchableOpacity>

            {showAuthGuideDetail && (
              <View style={styles.authGuideDetailBox}>
                <Text style={styles.authGuideDetailText}>
                  {authMode === 'no_auth'
                    ? '• Robot di chuyển đến phòng nhận và tự động mở nắp hộc chứa hàng.\n• Bất kỳ nhân viên nào tại phòng cũng có thể nhận mà không cần quét mã.\n• Không yêu cầu thao tác bảo mật bổ sung.'
                    : authMode === 'qr'
                    ? '• Hộc chứa hàng được robot khóa chặt bằng chốt Servo điện tử.\n• Sau khi tạo nhiệm vụ hoặc khi robot đến nơi, Staff App sẽ hiển thị mã QR trên màn hình.\n• Đưa mã QR trước camera robot để mở khóa Servo và lấy hàng.'
                    : '• Mức độ bảo mật cao nhất: Camera robot sẽ nhận diện khuôn mặt người nhận đã đăng ký trước khi mở hộc.\n• Đảm bảo bàn giao chính xác người được phân công trực tiếp.'}
                </Text>
              </View>
            )}

            {/* Box chụp / xác minh khuôn mặt người nhận khi chọn mode face */}
            {authMode === 'face' && (
              <View style={styles.faceVerificationBox}>
                {faceVerified ? (
                  <View style={styles.faceVerifiedSuccess}>
                    <CheckCircle2 size={20} color="#059669" />
                    <View style={styles.flex}>
                      <Text style={styles.faceVerifiedTitle}>Đã xác minh khuôn mặt người nhận</Text>
                      <Text style={styles.faceVerifiedSub}>
                        {receiver ? `Người nhận: ${receiver}` : 'Đã đăng ký nhận diện khuôn mặt cho chuyến giao này'}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.retakeButton}
                      onPress={() => setShowFaceScan(true)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.retakeButtonText}>Chụp lại</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.faceScanButton}
                    onPress={() => setShowFaceScan(true)}
                    activeOpacity={0.85}
                  >
                    <Camera size={18} color="#FFFFFF" />
                    <Text style={styles.faceScanButtonText}>Chụp ảnh / Quét khuôn mặt người nhận</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* NHÓM 2: THÔNG TIN HÀNG HÓA & SỐ LƯỢNG */}
          <View style={styles.groupCard}>
            <View style={styles.groupHeaderRow}>
              <View style={styles.groupNumberCircle}>
                <Text style={styles.groupNumberText}>2</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupTitle}>Thông tin hàng hóa</Text>
                <Text style={styles.groupSubtitle}>Loại hàng, tên vật phẩm và số lượng cần chuyển</Text>
              </View>
            </View>

            {/* Loại hàng: Chip dạng pill */}
            <Text style={styles.fieldLabel}>Loại hàng y tế</Text>
            <View style={styles.taskChipsRow}>
              {TASK_TYPES.filter((task) => task.id.startsWith('van_chuyen_')).map((task) => {
                const isActive = selectedTasks.includes(task.id);
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={[styles.taskChip, isActive && styles.taskChipActive]}
                    onPress={() => setSelectedTasks([task.id])}
                    activeOpacity={0.75}
                  >
                    {isActive && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                    <Text style={[styles.taskChipText, isActive && styles.taskChipTextActive]}>
                      {task.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tên hàng */}
            <Text style={styles.fieldLabel}>Tên hàng / Vật phẩm</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={itemName}
                onChangeText={setItemName}
                placeholder="Nhập tên vật phẩm y tế cần chuyển..."
                placeholderTextColor="#A1A1AA"
              />
            </View>

            {/* Số lượng: QuantityStepper */}
            <QuantityStepper
              value={quantity}
              onChangeValue={setQuantity}
              unit={currentItemUnit}
              disabled={isSubmitting || !!attemptRef.current}
            />
          </View>

          {/* NHÓM 3: LỘ TRÌNH DI CHUYỂN & NHÂN VIÊN */}
          <View style={styles.groupCard}>
            <View style={styles.groupHeaderRow}>
              <View style={styles.groupNumberCircle}>
                <Text style={styles.groupNumberText}>3</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupTitle}>Lộ trình di chuyển & Nhân viên</Text>
                <Text style={styles.groupSubtitle}>Điểm lấy A, điểm giao B và nhân viên trực nhận hàng</Text>
              </View>
            </View>

            {/* Bản đồ hoạt động */}
            <View style={styles.mapSelectorRow}>
              <Text style={styles.fieldLabel}>Bản đồ đang sử dụng:</Text>
              {availableMaps.length > 1 ? (
                <TouchableOpacity
                  style={styles.mapSelectBtn}
                  onPress={() => setShowMapSheet(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.mapSelectBtnText}>{activeMap?.mapName || 'Chọn bản đồ'}</Text>
                  <ChevronDown size={14} color={Colors.hero} />
                </TouchableOpacity>
              ) : (
                <View style={styles.mapReadOnlyBadge}>
                  <Text style={styles.mapReadOnlyText}>{activeMap?.mapName || 'Bản đồ chính'}</Text>
                </View>
              )}
            </View>

            {/* Card Lộ trình A -> B */}
            <View style={styles.routeCard}>
              {/* Điểm lấy A */}
              <View style={styles.routeLeg}>
                <View style={styles.routeMarkerA}>
                  <Text style={styles.routeMarkerLetter}>A</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.routeLegLabel}>ĐIỂM LẤY HÀNG (Phòng trực của bạn)</Text>
                  <TouchableOpacity
                    style={[
                      styles.routeSelectBox,
                      senderDutyRooms.length > 1 && styles.routeSelectBoxInteractive,
                    ]}
                    onPress={() => {
                      if (senderDutyRooms.length > 1) setShowPickupRoomModal(true);
                    }}
                    disabled={senderDutyRooms.length <= 1}
                    activeOpacity={senderDutyRooms.length > 1 ? 0.7 : 1}
                  >
                    <Text style={[styles.routeRoomName, senderDutyReason && { color: '#DC2626' }]}>
                      {selectedPickupDuty
                        ? selectedPickupDuty.room.roomName
                        : senderDutyReason || 'Đang xác định ca trực...'}
                    </Text>
                    {selectedPickupDuty && (
                      <Text style={styles.routeEndpointDetail}>
                        Phòng {selectedPickupDuty.room.roomCode} · Điểm robot: {selectedPickupDuty.endpoint.endpointName}
                        {senderDutyRooms.length > 1 ? ' · (Chạm để đổi phòng trực)' : ''}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>

              {/* Đường nối giữa A và B */}
              <View style={styles.routeDividerRow}>
                <View style={styles.routeDottedLine} />
                <View style={styles.senderPill}>
                  <User size={12} color="#71717A" />
                  <Text style={styles.senderPillText}>
                    Người gửi: {currentSenderAccount?.fullName || currentSenderAccount?.username || 'Bạn (Nhân viên trực)'}
                  </Text>
                </View>
              </View>

              {/* Điểm giao B */}
              <View style={styles.routeLeg}>
                <View style={styles.routeMarkerB}>
                  <Text style={styles.routeMarkerLetter}>B</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.routeLegLabel}>ĐIỂM GIAO HÀNG (Phòng nhận hàng)</Text>
                  <TouchableOpacity
                    style={[styles.routeSelectBox, styles.routeSelectBoxInteractive]}
                    onPress={() => setShowDeliveryRoomModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.routeRoomName}>
                      {deliveryRoom
                        ? `${deliveryRoom.roomName} (${deliveryRoom.roomCode})`
                        : 'Chọn phòng giao hàng (Điểm B)'}
                    </Text>
                    {deliveryEndpoint ? (
                      <Text style={styles.routeEndpointDetail}>
                        Điểm robot đón trả: {deliveryEndpoint.endpointName}
                      </Text>
                    ) : (
                      <Text style={styles.routeEndpointPlaceholder}>Chạm để chọn phòng trên bản đồ</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {senderDutyReason && (
              <View style={styles.senderDutyWarningBox}>
                <AlertCircle size={14} color="#DC2626" />
                <Text style={styles.senderDutyWarningText}>{senderDutyReason}</Text>
              </View>
            )}

            {/* Người nhận: StaffOnDutyPicker */}
            <Text style={styles.fieldLabel}>Người nhận hàng (Nhân viên đang trực)</Text>
            <StaffOnDutyPicker
              mapId={activeMap?.mapId}
              roomId={deliveryRoom?.roomId}
              roomName={deliveryRoom?.roomName}
              selectedStaff={selectedReceiverStaff}
              onSelect={handleStaffSelect}
              onClear={handleClearStaff}
              disabled={isSubmitting || !!attemptRef.current}
            />
            {roomDutyWarning && (
              <View style={styles.roomDutyWarningBox}>
                <AlertCircle size={14} color="#D97706" />
                <Text style={styles.roomDutyWarningText}>{roomDutyWarning}</Text>
              </View>
            )}
            <Text style={styles.smallHelper}>
              {deliveryRoom
                ? `Đang lọc nhân viên trực tại ${deliveryRoom.roomName}. Chọn người nhận để hoàn tất.`
                : 'Chọn nhân viên từ danh sách trực (tự điền phòng nhận), hoặc chọn phòng trước để lọc nhân viên.'}
            </Text>
          </View>

          {/* NHÓM 4: THÔNG TIN BỔ SUNG */}
          <View style={styles.groupCard}>
            <View style={styles.groupHeaderRow}>
              <View style={styles.groupNumberCircle}>
                <Text style={styles.groupNumberText}>4</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.groupTitle}>Thông tin bổ sung</Text>
                <Text style={styles.groupSubtitle}>Mức độ ưu tiên và ghi chú dặn dò</Text>
              </View>
            </View>

            {/* Mức độ ưu tiên: Segmented control */}
            <Text style={styles.fieldLabel}>Mức độ ưu tiên</Text>
            <View style={styles.segmentedControl}>
              {(['low', 'normal', 'high'] as const).map((level) => {
                const isActive = priority === level;
                const label = { low: 'Thấp', normal: 'Bình thường', high: 'Cao' }[level];
                return (
                  <TouchableOpacity
                    key={level}
                    style={[styles.segmentBtn, isActive && styles.segmentBtnActive]}
                    onPress={() => setPriority(level)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.segmentBtnText, isActive && styles.segmentBtnTextActive]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Ghi chú */}
            <Text style={styles.fieldLabel}>Ghi chú giao nhận</Text>
            <View style={[styles.inputContainer, { minHeight: 80, alignItems: 'stretch' }]}>
              <TextInput
                multiline
                style={[styles.textInput, { minHeight: 70, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Nhập ghi chú giao nhận (nếu có)..."
                placeholderTextColor="#A1A1AA"
              />
            </View>
          </View>

          {/* NHÓM 5: TÓM TẮT & NÚT TẠO NHIỆM VỤ */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Tóm tắt nhiệm vụ</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Vật phẩm:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {itemName.trim() || 'Chưa đặt tên'} · {quantity.trim() || '0'} {currentItemUnit}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Lộ trình:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {selectedPickupDuty?.room.roomName || 'A'} → {deliveryRoom?.roomName || 'B'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Người nhận:</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {receiver || 'Chưa chọn người nhận'}
              </Text>
            </View>

            {/* Dòng cảnh báo nếu form chưa hợp lệ */}
            {!attemptRef.current && !!submitValidationMessage && (
              <View style={styles.submitWarningBox}>
                <AlertCircle size={14} color="#D97706" />
                <Text style={styles.submitWarningText}>{submitValidationMessage}</Text>
              </View>
            )}

            {/* Nút Tạo nhiệm vụ / Thử lại */}
            <TouchableOpacity
              disabled={!canSubmit}
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              activeOpacity={0.85}
              accessibilityLabel="Tạo nhiệm vụ giao hàng"
              accessibilityRole="button"
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.submitButtonText}>
                    {pendingDeliveryLabel ||
                      (attemptRef.current
                        ? 'Thử lại yêu cầu'
                        : 'Tạo nhiệm vụ giao hàng')}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      {scan && (
        <QRScannerModal
          key={scan.jobId + scan.stepId + scan.accountId}
          jobId={scan.jobId}
          jobCode={activeJob?.jobCode || scan.jobId}
          purpose={scan.purpose}
          onClose={() => {
            setScan(null);
            if (activeJob?.jobId) {
              void refreshSelectedJob(activeJob.jobId);
            }
          }}
          onVerify={raw => verifyDeliveryQr(scan, raw)}
        />
      )}
      <FaceScanModal
        visible={showFaceScan}
        receiverName={receiver || 'Người nhận'}
        onClose={() => setShowFaceScan(false)}
        onConfirm={() => {
          setFaceVerified(true);
          setShowFaceScan(false);
        }}
      />

      {/* Bottom Sheet chọn phương thức giao nhận */}
      <MobileBottomSheet
        visible={showAuthModeSheet}
        onClose={() => setShowAuthModeSheet(false)}
        title="Phương thức bảo mật"
        subtitle="Chọn cơ chế mở ngăn chứa hàng khi robot đến nơi"
      >
        <View style={styles.sheetContent}>
          {[
            {
              id: 'no_auth' as const,
              title: '1. Giao mở tự do (Không cần xác nhận)',
              sub: 'Robot tự động mở nắp hộc khi đến nơi. Phù hợp văn thư, hồ sơ, vật phẩm thông thường.',
              icon: Unlock,
              color: '#0284C7',
              bg: '#E0F2FE',
            },
            {
              id: 'qr' as const,
              title: '2. Bảo mật quét mã QR (Khuyên dùng)',
              sub: 'Khóa Servo ngăn tủ an toàn. Robot sẽ quét mã QR trên điện thoại nhân viên để mở nắp.',
              icon: QrCode,
              color: Colors.primary,
              bg: Colors.successSurface,
            },
            {
              id: 'face' as const,
              title: '3. Xác thực khuôn mặt (Face ID)',
              sub: 'Bảo mật sinh trắc học cao nhất. Robot nhận diện khuôn mặt người nhận trước khi mở khóa.',
              icon: Camera,
              color: '#D97706',
              bg: Colors.warningSurface,
            },
          ].map((item) => {
            const isSelected = authMode === item.id;
            const IconComponent = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.sheetRadioItem, isSelected && styles.sheetRadioItemSelected]}
                onPress={() => {
                  handleSelectAuthMode(item.id);
                  setShowAuthModeSheet(false);
                }}
                activeOpacity={0.75}
              >
                <View style={[styles.sheetRadioIconCircle, { backgroundColor: item.bg }]}>
                  <IconComponent size={20} color={item.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.sheetRadioTitle, isSelected && { color: Colors.hero }]}>
                    {item.title}
                  </Text>
                  <Text style={styles.sheetRadioSub}>{item.sub}</Text>
                </View>
                {isSelected ? (
                  <CheckCircle2 size={20} color="#059669" />
                ) : (
                  <View style={styles.sheetRadioUnchecked} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </MobileBottomSheet>

      {/* Bottom Sheet chọn bản đồ */}
      <MobileBottomSheet
        visible={showMapSheet}
        onClose={() => setShowMapSheet(false)}
        title="Chọn bản đồ bệnh viện"
        subtitle="Danh sách các bản đồ đang hoạt động trong hệ thống"
      >
        <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetContent}>
            {availableMaps.map((map) => {
              const isSelected = activeMap?.mapId === map.mapId;
              return (
                <TouchableOpacity
                  key={map.mapId}
                  style={[styles.sheetRadioItem, isSelected && styles.sheetRadioItemSelected]}
                  onPress={() => {
                    handleSelectMap(map);
                    setShowMapSheet(false);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={styles.flex}>
                    <Text style={styles.sheetRadioTitle}>{map.mapName}</Text>
                    <Text style={styles.sheetRadioSub}>
                      Mã bản đồ: {map.mapId.slice(0, 8)} · Trạng thái: {map.status}
                    </Text>
                  </View>
                  {isSelected && <CheckCircle2 size={20} color="#059669" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </MobileBottomSheet>

      {/* Bottom Sheet chọn phòng trực của người gửi (Điểm A) */}
      <MobileBottomSheet
        visible={showPickupRoomModal}
        onClose={() => setShowPickupRoomModal(false)}
        title="Chọn phòng trực của bạn"
        subtitle={`Bạn có nhiều phòng trực trên bản đồ ${activeMap?.mapName || 'hiện tại'}`}
      >
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetContent}>
            {senderDutyRooms.map((duty) => {
              const isSel = selectedPickupDuty?.shift.shiftId === duty.shift.shiftId;
              return (
                <TouchableOpacity
                  key={duty.shift.shiftId}
                  style={[styles.sheetRadioItem, isSel && styles.sheetRadioItemSelected]}
                  onPress={() => {
                    setSelectedPickupDuty(duty);
                    setPickupEndpoint(duty.endpoint);
                    setShowPickupRoomModal(false);
                  }}
                  activeOpacity={0.75}
                >
                  <MapPin size={18} color={isSel ? Colors.hero : Colors.textSecondary} />
                  <View style={styles.flex}>
                    <Text style={styles.sheetRadioTitle}>
                      {duty.room.roomName} ({duty.room.roomCode})
                    </Text>
                    <Text style={styles.sheetRadioSub}>
                      Điểm robot đón: {duty.endpoint.endpointName} · Ca: {duty.shift.shiftName || 'Đang trực'}
                    </Text>
                  </View>
                  {isSel && <CheckCircle2 size={18} color="#059669" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </MobileBottomSheet>

      {/* Bottom Sheet chọn phòng giao hàng (Điểm B) */}
      <MobileBottomSheet
        visible={showDeliveryRoomModal}
        onClose={() => setShowDeliveryRoomModal(false)}
        title="Chọn phòng giao hàng (Điểm B)"
        subtitle={`Danh sách phòng trên bản đồ ${activeMap?.mapName || 'hiện tại'}`}
      >
        <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetContent}>
            {availableDeliveryRooms.length === 0 ? (
              <Text style={styles.emptyJobsText}>Không có phòng nào trên bản đồ này.</Text>
            ) : (
              availableDeliveryRooms.map((room) => {
                const ep = availableEndpoints.find(
                  (e) => e.roomId === room.roomId && e.active !== false
                );
                const isSel = deliveryRoom?.roomId === room.roomId;
                const hasEndpoint = !!ep;
                return (
                  <TouchableOpacity
                    key={room.roomId}
                    style={[
                      styles.sheetRadioItem,
                      isSel && styles.sheetRadioItemSelected,
                      !hasEndpoint && { opacity: 0.5 },
                    ]}
                    disabled={!hasEndpoint}
                    onPress={() => handleSelectDeliveryRoom(room)}
                    activeOpacity={0.75}
                  >
                    <MapPin
                      size={18}
                      color={hasEndpoint ? (isSel ? Colors.hero : Colors.textPrimary) : Colors.textMuted}
                    />
                    <View style={styles.flex}>
                      <Text
                        style={[
                          styles.sheetRadioTitle,
                          !hasEndpoint && { color: Colors.textMuted },
                        ]}
                      >
                        {room.roomName} ({room.roomCode})
                      </Text>
                      <Text style={styles.sheetRadioSub}>
                        {hasEndpoint
                          ? `Điểm robot đón trả: ${ep.endpointName}`
                          : 'Chưa có điểm đón robot trên bản đồ này'}
                      </Text>
                    </View>
                    {isSel && <CheckCircle2 size={18} color="#059669" />}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </ScrollView>
      </MobileBottomSheet>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: 18,
    gap: 16,
    paddingBottom: 110,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 12,
  },
  muted: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  small: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 20,
    gap: 14,
    ...Shadows.card,
  },
  statusBox: {
    backgroundColor: Colors.surfaceMuted,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  flex: { flex: 1 },
  chips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
  },
  chipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.hero,
    borderWidth: 1.5,
  },
  link: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.textPrimary,
    backgroundColor: '#FFFFFF',
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    marginVertical: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 18,
    ...Shadows.button,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  smallButton: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  senderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  senderIdText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  error: {
    color: Colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  actions: { gap: 10 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: '100%',
    maxWidth: 540,
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    gap: 14,
    ...Shadows.hero,
  },

  // 3 Chế độ Giao nhiệm vụ
  authModeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  authModeTab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  authModeTabActiveNoAuth: {
    borderColor: Colors.hero,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  authModeTabActiveQr: {
    borderColor: Colors.hero,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  authModeTabActiveFace: {
    borderColor: Colors.hero,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  authModeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F1EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authModeIconCircleNoAuth: { backgroundColor: '#E0F2FE' },
  authModeIconCircleQr: { backgroundColor: Colors.successSurface },
  authModeIconCircleFace: { backgroundColor: Colors.warningSurface },
  authModeTabTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  authModeTabTitleNoAuth: { color: Colors.textPrimary },
  authModeTabTitleQr: { color: Colors.textPrimary },
  authModeTabTitleFace: { color: Colors.textPrimary },
  authModeTabSub: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
  },

  // Banner mô tả từng phần
  authBanner: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 6,
    gap: 6,
  },
  authBannerNoAuth: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  authBannerQr: {
    backgroundColor: Colors.successSurface,
    borderColor: '#A7F3D0',
  },
  authBannerFace: {
    backgroundColor: Colors.warningSurface,
    borderColor: '#FDE68A',
  },
  authBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  authBannerDesc: {
    fontSize: 12,
    lineHeight: 19,
    color: Colors.textPrimary,
  },

  // Hộp xác thực khuôn mặt
  faceVerificationBox: { marginTop: 10 },
  faceScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  faceScanButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  faceVerifiedSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    backgroundColor: Colors.successSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  faceVerifiedTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.successText,
  },
  faceVerifiedSub: {
    fontSize: 11,
    color: Colors.successText,
    marginTop: 2,
  },
  retakeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  retakeButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.successText,
  },

  // Tiến trình trạng thái Job & Bước hiện tại
  jobHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgePending: { backgroundColor: Colors.warningSurface },
  statusBadgeRunning: { backgroundColor: '#E0F2FE' },
  statusBadgeSuccess: { backgroundColor: Colors.successSurface },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  statusBadgeTextPending: { color: Colors.warningText },
  statusBadgeTextRunning: { color: '#0369A1' },
  statusBadgeTextSuccess: { color: Colors.successText },
  stepProgressCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
    marginTop: 4,
  },
  stepProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepProgressTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  stepProgressDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  qrButtonActive: { backgroundColor: '#0284C7' },
  quickQrButton: {
    backgroundColor: Colors.hero,
    minHeight: 52,
    borderRadius: 16,
    ...Shadows.button,
  },
  quickQrButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmActionButton: {
    backgroundColor: '#166534',
    minHeight: 52,
    marginTop: 6,
    borderRadius: 16,
    ...Shadows.button,
  },
  confirmActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  selectDisabled: {
    borderColor: '#FCA5A5',
    backgroundColor: Colors.dangerSurface,
  },
  selectSenderDuty: {
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
  },
  selectText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  senderDutyWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.dangerSurface,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginTop: 4,
  },
  senderDutyWarningText: {
    fontSize: 12,
    color: Colors.danger,
    fontWeight: '600',
    flex: 1,
  },
  roomDutyWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.warningSurface,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 6,
  },
  roomDutyWarningText: {
    fontSize: 12,
    color: Colors.warningText,
    fontWeight: '600',
    flex: 1,
  },

  // Danh sách nhiệm vụ giao nhận
  deliveryJobList: {
    gap: 10,
    marginTop: 6,
  },
  emptyJobsBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  emptyJobsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  jobItemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    ...Shadows.card,
  },
  jobItemCardActive: {
    borderColor: Colors.hero,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },
  jobItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  jobItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  jobItemIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobItemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  jobItemStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  jobItemStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  jobItemRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  jobItemRouteText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },

  // ===== New Mobile Task Form Styles =====
  createTaskContainer: {
    gap: 16,
    marginTop: 4,
  },
  createTaskHeader: {
    marginBottom: 4,
  },
  groupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
    ...Shadows.card,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 2,
  },
  groupNumberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupNumberText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  groupSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  authModeSelectorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  authModeSelectorTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  authModeSelectorSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  authModeGuideShort: {
    fontSize: 12,
    lineHeight: 18,
    color: '#52525B',
    paddingHorizontal: 4,
  },
  guideToggleBtn: {
    minHeight: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideToggleBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hero,
    textDecorationLine: 'underline',
  },
  authGuideDetailBox: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  authGuideDetailText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#52525B',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  taskChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 2,
  },
  taskChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.sm,
  },
  taskChipActive: {
    backgroundColor: Colors.hero,
    borderColor: Colors.hero,
  },
  taskChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  taskChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    justifyContent: 'center',
    ...Shadows.sm,
  },
  textInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    padding: 0,
  },
  mapSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  mapSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapSelectBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.hero,
  },
  mapReadOnlyBadge: {
    backgroundColor: Colors.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapReadOnlyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  routeCard: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    gap: 10,
    marginVertical: 4,
  },
  routeLeg: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeMarkerA: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.hero,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeMarkerB: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  routeMarkerLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  routeLegLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  routeSelectBox: {
    minHeight: 44,
    justifyContent: 'center',
  },
  routeSelectBoxInteractive: {},
  routeRoomName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  routeEndpointDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  routeEndpointPlaceholder: {
    fontSize: 13,
    color: '#A1A1AA',
    fontStyle: 'italic',
    marginTop: 2,
  },
  routeDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 13,
  },
  routeDottedLine: {
    width: 2,
    height: 22,
    backgroundColor: '#D4D4D8',
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  senderPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  smallHelper: {
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textSecondary,
    paddingHorizontal: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginVertical: 2,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.hero,
    ...Shadows.sm,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 10,
    ...Shadows.card,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  submitWarningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  submitWarningText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#B45309',
    flex: 1,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.hero,
    minHeight: 54,
    borderRadius: 16,
    marginTop: 8,
    ...Shadows.button,
  },
  submitButtonDisabled: {
    opacity: 0.45,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sheetContent: {
    gap: 10,
    paddingVertical: 4,
  },
  sheetRadioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFFFFF',
    minHeight: 64,
  },
  sheetRadioItemSelected: {
    backgroundColor: Colors.surfaceMuted,
    borderColor: Colors.hero,
    borderWidth: 1.5,
  },
  sheetRadioIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRadioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  sheetRadioSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sheetRadioUnchecked: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#D4D4D8',
  },
});
