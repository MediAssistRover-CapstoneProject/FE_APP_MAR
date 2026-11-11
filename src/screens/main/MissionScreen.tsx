import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { EndpointResponse, JobResponse, MapResponse, OnDutyStaffResponse, RoomDto, UserProfileResponse } from '../../api/types';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../api/client';
import { StaffOnDutyPicker } from '../../components/staff/StaffOnDutyPicker';

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
  const [authMode, setAuthMode] = useState<DeliveryAuthMode>('qr');
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
  const [pickupEndpoint, setPickupEndpoint] = useState<EndpointResponse | null>(null);
  const [deliveryEndpoint, setDeliveryEndpoint] = useState<EndpointResponse | null>(null);
  const [endpointPickerMode, setEndpointPickerMode] = useState<'pickup' | 'delivery'>('delivery');
  const [isLoadingFacility, setIsLoadingFacility] = useState(false);

  const [receiver, setReceiver] = useState('');
  const [receiverAccountId, setReceiverAccountId] = useState('');
  const [selectedReceiverStaff, setSelectedReceiverStaff] = useState<OnDutyStaffResponse | null>(null);
  const [useManualReceiver, setUseManualReceiver] = useState(false);
  const [priority, setPriority] = useState<PriorityLevel>('high');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');

  const [recentJobs, setRecentJobs] = useState<JobResponse[]>([]);
  const [snapshot, setSnapshot] = useState<JobSnapshot | null>(null);
  const [manualJobIdInput, setManualJobIdInput] = useState('');
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [jobError, setJobError] = useState('');
  const [isSendingStepResponse, setIsSendingStepResponse] = useState(false);
  const [respondedStepId, setRespondedStepId] = useState('');
  const [showRoomModal, setShowRoomModal] = useState(false);
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

  const fromRoom = pickupEndpoint?.endpointName || 'Chọn điểm lấy hàng (A)';
  const toRoom = deliveryEndpoint?.endpointName || 'Chọn điểm giao hàng (B)';

  // Handle staff selection from picker
  const handleStaffSelect = useCallback((staff: OnDutyStaffResponse) => {
    setSelectedReceiverStaff(staff);
    setReceiver(staff.fullName);
    setReceiverAccountId(staff.accountId);
    setUseManualReceiver(false);
  }, []);

  const handleClearStaff = useCallback(() => {
    setSelectedReceiverStaff(null);
    setReceiver('');
    setReceiverAccountId('');
    setUseManualReceiver(true);
  }, []);

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
        const activeMaps = maps.filter(item => item.status === 'ACTIVE');
        const map = activeMaps[0] || null;
        setAvailableMaps(activeMaps);
        setAllEndpoints(endpoints);
        const mapEndpoints = map
          ? endpoints.filter((endpoint) => endpoint.mapId === map.mapId && endpoint.active !== false)
          : [];
        setActiveMap(map);
        setAvailableEndpoints(mapEndpoints);
        setRooms(roomList);
        setPickupEndpoint(mapEndpoints[0] || null);
        setDeliveryEndpoint(mapEndpoints[1] || mapEndpoints[0] || null);
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
  }, [scope]);

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

  const loadRecentJobsAndDetail = useCallback(async (preferredJobId?: string) => {
    const requestScope = scopeRef.current;
    setIsLoadingJobs(true);
    try {
      if (preferredJobId) await followJob(preferredJobId);
      if (scopeRef.current !== requestScope) return;
      const page = await dispatchApi.getJobs({ page: 0, size: 8 });
      if (scopeRef.current !== requestScope) return;
      setRecentJobs(page?.content || []);
    } catch (error) {
      if (scopeRef.current === requestScope) {
        setJobError((error as { message?: string })?.message || 'Không tải được danh sách nhiệm vụ.');
      }
    } finally {
      if (scopeRef.current === requestScope) setIsLoadingJobs(false);
    }
  }, [followJob]);

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
        `Mã nhiệm vụ: ${job.jobCode || job.jobId}\n\nLộ trình: ${fromRoom} → ${toRoom}\n\nBạn có thể mở mã QR ngay để sẵn sàng đưa màn hình trước Camera của Robot quét mở khóa Servo.`,
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

  const handleSubmit = () => {
    if (submitInFlight.current || !attemptReady) return;
    if (attemptRef.current) {
      void sendDelivery(attemptRef.current);
      return;
    }
    if (!activeMap || !pickupEndpoint || !deliveryEndpoint) {
      Alert.alert('Thiếu điểm lấy hoặc giao hàng', 'Chọn hai điểm trên bản đồ trước khi tạo yêu cầu.');
      return;
    }
    if (pickupEndpoint.endpointId === deliveryEndpoint.endpointId) {
      Alert.alert('Trùng điểm A và B', 'Chọn hai điểm khác nhau.');
      return;
    }
    const senderId = (currentSenderAccount?.accountId || user?.accountId || '').trim().toLowerCase();
    const receiverId = receiverAccountId.trim().toLowerCase();
    if (!user?.accountId || !UUID_PATTERN.test(senderId) || !UUID_PATTERN.test(receiverId)) {
      Alert.alert('Thiếu tài khoản được phân công', 'Nhập Account ID (UUID) của người gửi và người nhận.');
      return;
    }
    const itemQuantity = Number(quantity.trim());
    if (!itemName.trim() || !receiver.trim() || !Number.isInteger(itemQuantity) || itemQuantity < 1 || itemQuantity > 2147483647) {
      Alert.alert('Thiếu thông tin giao hàng', 'Nhập tên hàng, tên hiển thị người nhận và số lượng nguyên dương.');
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

    const itemCategory = selectedTasks.includes('van_chuyen_thuoc') ? 'MEDICATION'
      : selectedTasks.includes('van_chuyen_mau') ? 'LAB_SAMPLE'
      : selectedTasks.includes('van_chuyen_vat_tu') ? 'SUPPLIES'
      : 'DOCUMENT';
    const unit = { MEDICATION: 'Hộp', LAB_SAMPLE: 'Ống nghiệm', SUPPLIES: 'Gói', DOCUMENT: 'Bộ' }[itemCategory];

    const modeTag = authMode === 'no_auth'
      ? '[CHẾ ĐỘ: KHÔNG CẦN XÁC NHẬN - GIAO MỞ TỰ DO]'
      : authMode === 'qr'
      ? '[CHẾ ĐỘ: CẦN XÁC NHẬN QR - MỞ KHÓA SERVO]'
      : `[CHẾ ĐỘ: XÁC NHẬN KHUÔN MẶT (FACE ID) - ĐÃ XÁC THỰC (${receiver.trim()})]`;
    const deliveryNote = notes.trim() ? `${modeTag} ${notes.trim()}` : modeTag;

    const payload = {
      mapId: activeMap.mapId,
      targetMode: 'ENDPOINT' as const,
      pickupEndpointId: pickupEndpoint.endpointId,
      deliveryEndpointId: deliveryEndpoint.endpointId,
      expectedSenderAccountId: senderId,
      expectedReceiverAccountId: receiverId,
      recipientName: receiver.trim(),
      requiresConfirmation: true,
      priority: { high: 80, normal: 50, low: 20 }[priority],
      deliveryNote,
      items: [{
        itemCode: 'ITEM-01',
        itemName: itemName.trim(),
        itemCategory,
        unit,
        quantity: itemQuantity,
        sensitive: authMode === 'face' || isHighSecurityItem,
      }],
    };

    const modeName = authMode === 'no_auth'
      ? '🔓 Không cần xác nhận (Giao mở tự do)'
      : authMode === 'qr'
      ? '🛡️ Cần xác nhận QR (Khóa Servo)'
      : '👤 Xác nhận khuôn mặt (Face ID)';

    Alert.alert(
      'Xác nhận tạo nhiệm vụ giao hàng',
      `Phương thức: ${modeName}\nLộ trình: ${fromRoom} → ${toRoom}\nVật phẩm: ${itemName.trim()} × ${itemQuantity}\nNgười nhận: ${receiver.trim()} (${receiverId})`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Tạo & gửi', onPress: () => {
          if (attemptRef.current || submitInFlight.current || scopeRef.current !== scope) return;
          const key = globalThis.crypto?.randomUUID?.() || 'delivery-' + Date.now() + '-' + Math.random().toString(36).slice(2);
          void sendDelivery({ key, payload });
        } },
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
          <Text style={styles.muted}>Tài khoản {user?.username} · {user?.accountId}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {recentJobs.map(job => <TouchableOpacity key={job.jobId} onPress={() => { void followJob(job.jobId); }} style={[styles.chip, activeJob?.jobId === job.jobId && styles.chipActive]}>
              <Text style={styles.link}>{job.jobCode || job.jobId.slice(0, 8)}</Text><Text style={styles.small}>{job.status}</Text>
            </TouchableOpacity>)}
          </ScrollView>
          <Text style={styles.label}>Job ID được chia sẻ từ người giao nhiệm vụ</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, styles.flex]} value={manualJobIdInput} onChangeText={setManualJobIdInput} placeholder="UUID nhiệm vụ" autoCapitalize="none" />
            <TouchableOpacity style={styles.button} onPress={() => { void followJob(manualJobIdInput); }}><Text style={styles.buttonText}>Theo dõi</Text></TouchableOpacity>
          </View>
          {!!jobError && <Text accessibilityRole="alert" style={styles.error}>{jobError}</Text>}
          {activeJob ? <>
            <View style={styles.statusBox}>
              <View style={styles.jobHeaderRow}>
                <View style={styles.flex}>
                  <Text style={styles.heading}>{activeJob.jobCode || 'Nhiệm vụ giao hàng'}</Text>
                  <Text selectable style={styles.small}>{activeJob.jobId}</Text>
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
                  {phase === 'sender' ? '👤 Người gửi: ' : '👤 Người nhận: '}
                  {assignedAccount} {myTurn ? '(Bạn)' : '(Tài khoản khác)'}
                </Text>
              )}
              {runningStep && !myTurn && <Text style={styles.muted}>Đang chờ nhân viên được phân công thực hiện bước này.</Text>}
            </View>

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

        <View style={styles.card}>
          <Text style={styles.eyebrow}>GIAO NHIỆM VỤ CHO ROBOT</Text>
          <Text style={styles.heading}>Tạo giao nhận mới</Text>
          <Text style={styles.muted}>
            Chọn 1 trong 3 phương thức xác nhận giao nhận phù hợp với yêu cầu an toàn của từng loại vật phẩm y tế.
          </Text>

          {/* ===== 3 PHẦN GIAO NHIỆM VỤ ===== */}
          <Text style={styles.label}>CHỌN PHƯƠNG THỨC GIAO NHẬN (3 CHẾ ĐỘ)</Text>
          <View style={styles.authModeTabsRow}>
            {/* Phần 1: Không cần xác nhận */}
            <TouchableOpacity
              style={[
                styles.authModeTab,
                authMode === 'no_auth' && styles.authModeTabActiveNoAuth,
              ]}
              onPress={() => handleSelectAuthMode('no_auth')}
              activeOpacity={0.8}
            >
              <View style={[styles.authModeIconCircle, authMode === 'no_auth' && styles.authModeIconCircleNoAuth]}>
                <Unlock size={20} color={authMode === 'no_auth' ? '#0284C7' : Colors.textSecondary} />
              </View>
              <Text style={[styles.authModeTabTitle, authMode === 'no_auth' && styles.authModeTabTitleNoAuth]}>
                1. Không xác nhận
              </Text>
              <Text style={styles.authModeTabSub}>Mở tự do khi đến</Text>
            </TouchableOpacity>

            {/* Phần 2: Cần xác nhận QR */}
            <TouchableOpacity
              style={[
                styles.authModeTab,
                authMode === 'qr' && styles.authModeTabActiveQr,
              ]}
              onPress={() => handleSelectAuthMode('qr')}
              activeOpacity={0.8}
            >
              <View style={[styles.authModeIconCircle, authMode === 'qr' && styles.authModeIconCircleQr]}>
                <ScanLine size={20} color={authMode === 'qr' ? Colors.primary : Colors.textSecondary} />
              </View>
              <Text style={[styles.authModeTabTitle, authMode === 'qr' && styles.authModeTabTitleQr]}>
                2. Cần xác nhận QR
              </Text>
              <Text style={styles.authModeTabSub}>Khóa Servo ngăn tủ</Text>
            </TouchableOpacity>

            {/* Phần 3: Xác nhận khuôn mặt */}
            <TouchableOpacity
              style={[
                styles.authModeTab,
                authMode === 'face' && styles.authModeTabActiveFace,
              ]}
              onPress={() => handleSelectAuthMode('face')}
              activeOpacity={0.8}
            >
              <View style={[styles.authModeIconCircle, authMode === 'face' && styles.authModeIconCircleFace]}>
                <Camera size={20} color={authMode === 'face' ? '#D97706' : Colors.textSecondary} />
              </View>
              <Text style={[styles.authModeTabTitle, authMode === 'face' && styles.authModeTabTitleFace]}>
                3. Xác nhận khuôn mặt
              </Text>
              <Text style={styles.authModeTabSub}>Face ID sinh trắc học</Text>
            </TouchableOpacity>
          </View>

          {/* ===== BANNER MÔ TẢ CHI TIẾT THEO PHẦN ĐÃ CHỌN ===== */}
          {authMode === 'no_auth' && (
            <View style={[styles.authBanner, styles.authBannerNoAuth]}>
              <View style={styles.authBannerHeader}>
                <Unlock size={18} color="#0284C7" />
                <Text style={[styles.authBannerTitle, { color: '#0369A1' }]}>
                  PHẦN 1: GIAO VẬT PHẨM KHÔNG CẦN XÁC NHẬN
                </Text>
              </View>
              <Text style={styles.authBannerDesc}>
                • Robot tự động mở nắp hộc chứa hàng khi đến phòng nhận.{'\n'}
                • Người nhận có thể lấy vật phẩm ngay mà không cần quét mã hay xác thực khuôn mặt.{'\n'}
                • Phù hợp: Văn thư, hồ sơ bệnh án thông thường, đồ dùng không nhạy cảm.
              </Text>
            </View>
          )}

          {authMode === 'qr' && (
            <View style={[styles.authBanner, styles.authBannerQr]}>
              <View style={styles.authBannerHeader}>
                <QrCode size={18} color={Colors.primary} />
                <Text style={[styles.authBannerTitle, { color: '#0F766E' }]}>
                  PHẦN 2: CẦN XÁC NHẬN MÃ QR (ROBOT QUÉT TỪ STAFF APP)
                </Text>
              </View>
              <Text style={styles.authBannerDesc}>
                • Hộc chứa hàng được robot khóa chặt an toàn bằng cơ cấu Servo.{'\n'}
                • Sau khi giao nhiệm vụ thành công (hoặc khi robot đến nơi), Staff App sẽ hiển thị mã QR trên màn hình điện thoại.{'\n'}
                • Camera của Robot sẽ quét mã QR từ điện thoại của Staff để tự động mở khóa Servo ngăn tủ.{'\n'}
                • Phù hợp: Thuốc theo toa, vật tư y tế, mẫu bệnh phẩm thông thường.
              </Text>
            </View>
          )}

          {authMode === 'face' && (
            <View style={[styles.authBanner, styles.authBannerFace]}>
              <View style={styles.authBannerHeader}>
                <Camera size={18} color="#D97706" />
                <Text style={[styles.authBannerTitle, { color: '#B45309' }]}>
                  PHẦN 3: XÁC NHẬN KHUÔN MẶT (FACE ID)
                </Text>
              </View>
              <Text style={styles.authBannerDesc}>
                • Mức bảo mật sinh trắc học cao nhất: Yêu cầu xác thực nhận diện khuôn mặt người nhận trước khi robot mở hộc.{'\n'}
                • Đảm bảo bàn giao chính xác người được phân công.{'\n'}
                • Phù hợp: Thuốc đặc trị nguy hiểm, mẫu máu khẩn cấp, bệnh phẩm nhạy cảm.
              </Text>

              {/* Box chụp / xác minh khuôn mặt */}
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
                    <Camera size={18} color="#fff" />
                    <Text style={styles.faceScanButtonText}>Chụp ảnh / Quét khuôn mặt người nhận</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {!!pendingDeliveryLabel && <View style={styles.statusBox}><Text style={styles.muted}>Một yêu cầu đang chờ kết quả. Các lần thử lại giữ nguyên nội dung ban đầu.</Text>
            <Text selectable style={styles.small}>{attemptRef.current?.requestId || 'Đang xác định kết quả tạo yêu cầu'}</Text></View>}
          <Text style={styles.label}>Loại hàng</Text>
          <View style={styles.chips}>{TASK_TYPES.filter(task => task.id.startsWith('van_chuyen_')).map(task =>
            <TouchableOpacity key={task.id} style={[styles.chip, selectedTasks.includes(task.id) && styles.chipActive]} onPress={() => setSelectedTasks([task.id])}>
              <Text style={styles.link}>{task.label}</Text>
            </TouchableOpacity>)}</View>
          <Text style={styles.label}>Tên hàng</Text><TextInput style={styles.input} value={itemName} onChangeText={setItemName} placeholder="Tên hàng cần vận chuyển" />
          <Text style={styles.label}>Số lượng</Text><TextInput style={styles.input} value={quantity} onChangeText={setQuantity} keyboardType="number-pad" />
          <Text style={styles.label}>Bản đồ đang sử dụng</Text>
          <View style={styles.chips}>{availableMaps.map(map => <TouchableOpacity key={map.mapId} style={[styles.chip, map.mapId === activeMap?.mapId && styles.chipActive]} onPress={() => {
            const endpoints = allEndpoints.filter(endpoint => endpoint.mapId === map.mapId && endpoint.active !== false);
            setActiveMap(map); setAvailableEndpoints(endpoints); setPickupEndpoint(endpoints[0] || null); setDeliveryEndpoint(endpoints[1] || null);
          }}><Text style={styles.link}>{map.mapName}</Text></TouchableOpacity>)}</View>
          {!activeMap && <Text style={styles.muted}>Chưa có bản đồ hoạt động.</Text>}
          <Text style={styles.label}>Điểm lấy hàng</Text>
          <TouchableOpacity style={styles.select} onPress={() => { setEndpointPickerMode('pickup'); setShowRoomModal(true); }}><MapPin size={18} color={Colors.primary} /><Text style={styles.flex}>{fromRoom}</Text><ChevronDown size={18} /></TouchableOpacity>
          <Text style={styles.label}>Điểm giao hàng</Text>
          <TouchableOpacity style={styles.select} onPress={() => { setEndpointPickerMode('delivery'); setShowRoomModal(true); }}><MapPin size={18} color={Colors.primary} /><Text style={styles.flex}>{toRoom}</Text><ChevronDown size={18} /></TouchableOpacity>
          <Text style={styles.label}>Người gửi (tài khoản của bạn)</Text>
          <View style={styles.senderBox}>
            <User size={18} color={Colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.senderName}>
                {currentSenderAccount?.fullName || currentSenderAccount?.username || 'Nhân viên trực'}
              </Text>
              <Text selectable style={styles.senderIdText}>
                {currentSenderAccount?.accountId || 'Đang tải thông tin tài khoản...'}
              </Text>
            </View>
            <CheckCircle2 size={16} color={currentSenderAccount?.accountId ? '#059669' : '#94A3B8'} />
          </View>

          {/* ===== Người nhận: Staff Picker hoặc nhập thủ công ===== */}
          <Text style={styles.label}>Người nhận hàng</Text>
          {useManualReceiver ? (
            <>
              <TextInput style={styles.input} value={receiver} onChangeText={setReceiver} placeholder="Tên người nhận hiển thị" />
              <Text style={styles.label}>Account ID người nhận</Text>
              <TextInput style={styles.input} value={receiverAccountId} onChangeText={setReceiverAccountId} autoCapitalize="none" placeholder="UUID tài khoản được giao nhận hàng" />
              <TouchableOpacity onPress={() => setUseManualReceiver(false)}>
                <Text style={styles.link}>← Chọn từ danh sách nhân viên trực</Text>
              </TouchableOpacity>
            </>
          ) : (
            <StaffOnDutyPicker
              mapId={activeMap?.mapId}
              selectedStaff={selectedReceiverStaff}
              onSelect={handleStaffSelect}
              onClear={handleClearStaff}
            />
          )}
          <Text style={styles.small}>Chọn nhân viên từ danh sách trực, hoặc nhập thủ công Account ID (UUID) nếu cần.</Text>

          <Text style={styles.label}>Ưu tiên</Text><View style={styles.chips}>{(['normal','high','low'] as const).map(value =>
            <TouchableOpacity key={value} style={[styles.chip, priority === value && styles.chipActive]} onPress={() => setPriority(value)}><Text style={styles.link}>{{normal:'Bình thường',high:'Cao',low:'Thấp'}[value]}</Text></TouchableOpacity>)}</View>
          <Text style={styles.label}>Ghi chú</Text><TextInput multiline style={[styles.input, {minHeight:90, textAlignVertical:'top'}]} value={notes} onChangeText={setNotes} />
          <Text style={styles.small}>
            {authMode === 'no_auth'
              ? 'Chế độ không cần xác nhận: Robot sẽ tự động mở nắp hộc khi đến nơi.'
              : authMode === 'qr'
              ? 'Chế độ xác nhận QR: Staff App hiển thị mã QR trên màn hình điện thoại để camera robot quét mở khóa ngăn tủ.'
              : 'Chế độ xác nhận khuôn mặt: Robot nhận diện khuôn mặt người nhận trước khi mở khóa tủ.'}
          </Text>
          <TouchableOpacity disabled={isSubmitting || isLoadingFacility || !attemptReady} style={[styles.button,(isSubmitting || isLoadingFacility) && styles.disabled]} onPress={handleSubmit}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <ArrowRight size={18} color="#fff" />}
            <Text style={styles.buttonText}>
              {pendingDeliveryLabel || (
                authMode === 'no_auth'
                  ? 'Tạo nhiệm vụ (Giao không cần xác nhận)'
                  : authMode === 'qr'
                  ? 'Tạo nhiệm vụ (Bảo mật quét QR)'
                  : 'Tạo nhiệm vụ (Xác nhận khuôn mặt)'
              )}
            </Text>
          </TouchableOpacity>
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
      <Modal visible={showRoomModal} transparent animationType="fade" onRequestClose={() => setShowRoomModal(false)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.row}><Text style={[styles.heading,styles.flex]}>{endpointPickerMode === 'pickup' ? 'Điểm lấy hàng' : 'Điểm giao hàng'}</Text><TouchableOpacity onPress={() => setShowRoomModal(false)} accessibilityLabel="Đóng"><X /></TouchableOpacity></View>
          <ScrollView style={{maxHeight:400}}>
            {availableEndpoints.map(endpoint => <TouchableOpacity key={endpoint.endpointId} style={styles.select} onPress={() => {
              if (endpointPickerMode === 'pickup') setPickupEndpoint(endpoint); else setDeliveryEndpoint(endpoint);
              setShowRoomModal(false);
            }}><MapPin size={18} color={Colors.primary} /><View style={styles.flex}><Text>{endpoint.endpointName}</Text><Text style={styles.small}>{endpoint.endpointCode} · {rooms.find(room => room.roomId === endpoint.roomId)?.roomName || endpoint.endpointType}</Text></View></TouchableOpacity>)}
            {!availableEndpoints.length && <Text style={styles.muted}>Chưa có điểm giao nhận trên bản đồ này.</Text>}
          </ScrollView>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {flex:1,backgroundColor:Colors.background},
  content: {padding:20,gap:14,paddingBottom:42,maxWidth:840,width:'100%',alignSelf:'center'},
  eyebrow: {fontSize:11,fontWeight:'700',letterSpacing:1.4,color:Colors.primary},
  title: {fontSize:28,fontWeight:'800',color:Colors.textPrimary},
  heading: {fontSize:17,fontWeight:'700',color:Colors.textPrimary},
  label: {fontSize:12,fontWeight:'700',color:Colors.textSecondary,marginTop:12},
  muted: {fontSize:14,lineHeight:21,color:Colors.textSecondary},
  small: {fontSize:12,lineHeight:19,color:Colors.textSecondary},
  status: {fontSize:12,fontWeight:'700',color:Colors.primary},
  card: {backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:'#e2e8f0',padding:18,gap:12},
  statusBox: {backgroundColor:'#f1f8f7',padding:14,borderRadius:12,gap:8},
  row: {flexDirection:'row',alignItems:'center',gap:10},
  flex: {flex:1},
  chips: {flexDirection:'row',gap:8,flexWrap:'wrap',paddingVertical:4},
  chip: {paddingHorizontal:12,paddingVertical:10,borderRadius:10,borderWidth:1,borderColor:'#dbe5e8',gap:3},
  chipActive: {backgroundColor:'#e6f4f0',borderColor:Colors.primary},
  link: {fontSize:13,fontWeight:'600',color:Colors.primary},
  input: {borderWidth:1,borderColor:'#dbe5e8',borderRadius:10,paddingHorizontal:12,paddingVertical:12,fontSize:14,color:Colors.textPrimary,backgroundColor:'#fff'},
  select: {flexDirection:'row',alignItems:'center',gap:10,padding:13,borderWidth:1,borderColor:'#dbe5e8',borderRadius:10,marginVertical:3},
  button: {flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,backgroundColor:Colors.primary,padding:14,borderRadius:10},
  buttonText: {color:'#fff',fontWeight:'700',fontSize:14},
  smallButton: {flexDirection:'row',gap:6,padding:8,alignItems:'center'},
  disabled: {opacity:0.45},
  senderBox: {flexDirection:'row',alignItems:'center',gap:10,padding:13,borderRadius:10,backgroundColor:'#e6f4f0',borderWidth:1,borderColor:'#059669'},
  senderName: {fontSize:14,fontWeight:'700',color:Colors.textPrimary},
  senderIdText: {fontSize:11,color:Colors.textMuted,marginTop:2},
  error: {color:'#b42318',fontSize:13,lineHeight:20},
  actions: {gap:10},
  overlay: {flex:1,backgroundColor:'rgba(0,0,0,0.4)',justifyContent:'center',alignItems:'center',padding:22},
  modal: {width:'100%',maxWidth:540,padding:20,borderRadius:16,backgroundColor:'#fff',gap:15},

  // 3 Chế độ Giao nhiệm vụ
  authModeTabsRow: {flexDirection:'row',gap:8,marginTop:6},
  authModeTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  authModeTabActiveNoAuth: {borderColor: '#0284C7', backgroundColor: '#F0F9FF'},
  authModeTabActiveQr: {borderColor: Colors.primary, backgroundColor: '#F0FDF4'},
  authModeTabActiveFace: {borderColor: '#D97706', backgroundColor: '#FFFBEB'},
  authModeIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authModeIconCircleNoAuth: {backgroundColor: '#E0F2FE'},
  authModeIconCircleQr: {backgroundColor: '#E6F4F0'},
  authModeIconCircleFace: {backgroundColor: '#FEF3C7'},
  authModeTabTitle: {fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textAlign: 'center'},
  authModeTabTitleNoAuth: {color: '#0369A1'},
  authModeTabTitleQr: {color: Colors.primary},
  authModeTabTitleFace: {color: '#B45309'},
  authModeTabSub: {fontSize: 10, color: Colors.textMuted, textAlign: 'center'},

  // Banner mô tả từng phần
  authBanner: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 6,
    gap: 6,
  },
  authBannerNoAuth: {backgroundColor: '#F0F9FF', borderColor: '#BAE6FD'},
  authBannerQr: {backgroundColor: '#F0FDF4', borderColor: '#A7F3D0'},
  authBannerFace: {backgroundColor: '#FFFBEB', borderColor: '#FDE68A'},
  authBannerHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  authBannerTitle: {fontSize: 13, fontWeight: '800', letterSpacing: 0.5},
  authBannerDesc: {fontSize: 12, lineHeight: 19, color: '#334155'},

  // Hộp xác thực khuôn mặt
  faceVerificationBox: {marginTop: 10},
  faceScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#D97706',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  faceScanButtonText: {color: '#fff', fontWeight: '700', fontSize: 13},
  faceVerifiedSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  faceVerifiedTitle: {fontSize: 13, fontWeight: '700', color: '#065F46'},
  faceVerifiedSub: {fontSize: 11, color: '#047857', marginTop: 2},
  retakeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#D1FAE5',
  },
  retakeButtonText: {fontSize: 11, fontWeight: '700', color: '#065F46'},

  // Tiến trình trạng thái Job & Bước hiện tại
  jobHeaderRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10},
  statusBadge: {paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12},
  statusBadgePending: {backgroundColor: '#FEF3C7'},
  statusBadgeRunning: {backgroundColor: '#E0F2FE'},
  statusBadgeSuccess: {backgroundColor: '#D1FAE5'},
  statusBadgeText: {fontSize: 11, fontWeight: '700'},
  statusBadgeTextPending: {color: '#B45309'},
  statusBadgeTextRunning: {color: '#0369A1'},
  statusBadgeTextSuccess: {color: '#047857'},
  stepProgressCard: {backgroundColor: '#FFFFFF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 6, marginTop: 4},
  stepProgressHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  stepProgressTitle: {fontSize: 13, fontWeight: '700', color: Colors.textPrimary, flex: 1},
  stepProgressDesc: {fontSize: 12, color: Colors.textSecondary, lineHeight: 18},
  qrButtonActive: {backgroundColor: '#0284C7'},
  quickQrButton: {
    backgroundColor: '#0284C7',
    paddingVertical: 14,
    shadowColor: '#0284C7',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  quickQrButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  confirmActionButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    marginTop: 6,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmActionButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
