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
} from 'lucide-react-native';
import { QRScannerModal } from '../../components/scanning/QRScannerModal';
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
  AUTH_SENDER: '2. Người gửi quét QR trên màn hình robot',
  UNLOCK_SENDER: '3. Robot đang mở khóa Servo ngăn tủ (A)',
  PAYLOAD_SENDER: '4. Đặt hàng vào ngăn tủ & Xác nhận',
  CLOSE_SENDER: '5. Đóng nắp ngăn tủ tại Điểm A',
  LOCK_SENDER: '6. Robot đang khóa Servo ngăn tủ (A)',
  VERIFY_SENDER: '7. Kiểm tra nắp tủ đã khóa chắc (A)',
  MOVE_RECEIVER: '8. Robot vận chuyển đến Điểm nhận hàng (B)',
  AUTH_RECEIVER: '9. Người nhận quét QR trên màn hình robot',
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
  const [selectedTasks, setSelectedTasks] = useState<TaskType[]>(['van_chuyen_tai_lieu']);
  const [itemName, setItemName] = useState('Thuốc kháng sinh / Mẫu bệnh phẩm');
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
  const myTurn = !!assignedAccount && assignedAccount === user?.accountId.toLowerCase();
  const qrContext = scanContext(activeJob, user?.accountId, snapshot?.delivery);
  const response = myTurn && activeJob?.schemaVersion === 3 && activeJob.beOrchestrated
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
      Alert.alert('Đã gửi nhiệm vụ tới robot', 'Job ID: ' + job.jobId + '\nChia sẻ Job ID với người được phân công. Khi robot đến, hãy quét mã trên màn hình robot.');
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
    const itemCategory = selectedTasks.includes('van_chuyen_thuoc') ? 'MEDICATION'
      : selectedTasks.includes('van_chuyen_mau') ? 'LAB_SAMPLE'
      : selectedTasks.includes('van_chuyen_vat_tu') ? 'SUPPLIES'
      : 'DOCUMENT';
    const unit = { MEDICATION: 'Hộp', LAB_SAMPLE: 'Ống nghiệm', SUPPLIES: 'Gói', DOCUMENT: 'Bộ' }[itemCategory];
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
      deliveryNote: notes.trim() || undefined,
      items: [{ itemCode: 'ITEM-01', itemName: itemName.trim(), itemCategory, unit, quantity: itemQuantity, sensitive: isHighSecurityItem }],
    };
    Alert.alert('Xác nhận tạo nhiệm vụ giao hàng', fromRoom + ' → ' + toRoom + '\n' + itemName.trim() + ' × ' + itemQuantity + '\nNgười gửi: ' + senderId + '\nNgười nhận: ' + receiver.trim() + '\n' + receiverId, [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Tạo & gửi', onPress: () => {
        if (attemptRef.current || submitInFlight.current || scopeRef.current !== scope) return;
        const key = globalThis.crypto?.randomUUID?.() || 'delivery-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        void sendDelivery({ key, payload });
      } },
    ]);
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
              <Text style={styles.heading}>{activeJob.jobCode || 'Nhiệm vụ giao hàng'}</Text>
              <Text selectable style={styles.small}>{activeJob.jobId}</Text>
              <Text style={styles.status}>{activeJob.status}</Text>
              <Text style={styles.heading}>{activeJob.status === 'SUCCEEDED' ? 'Nhiệm vụ đã hoàn tất'
                : activeJob.status === 'RECOVERY_REQUIRED' ? 'Cần kiểm tra robot và thùng hàng'
                : activeJob.cancelRequestedAt ? 'Đang xử lý yêu cầu hủy'
                : currentStep ? STEP_LABELS[currentStep.stepCodeSnapshot || ''] || currentStep.stepTypeSnapshot
                : 'Đang chờ điều phối hoặc cập nhật bước tiếp theo'}</Text>
              {!!activeJob.failureReason && <Text style={styles.error}>{activeJob.failureReason}</Text>}
              {!!assignedAccount && <Text style={styles.small}>{phase === 'sender' ? 'Người gửi' : 'Người nhận'} được phân công · {assignedAccount}</Text>}
              {runningStep && !myTurn && <Text style={styles.muted}>Đang chờ nhân viên được phân công thực hiện bước này.</Text>}
            </View>
            <TouchableOpacity style={[styles.button, (!qrContext || !!jobError) && styles.disabled]} disabled={!qrContext || !!jobError}
              onPress={() => { if (qrContext) setScan(qrContext); }}>
              <ScanLine size={19} color="#fff" /><Text style={styles.buttonText}>Quét QR trên màn hình robot</Text>
            </TouchableOpacity>
            {response && <View style={styles.actions}>
              {response.responseType === 'PAYLOAD_CONFIRMED' && Array.isArray(response.data?.items) &&
                response.data.items.map((item: any, index: number) => <Text key={index} style={styles.small}>{item.item_name || item.item_code || 'Hàng được giao'} · {item.quantity} {item.unit || ''}</Text>)}
              <TouchableOpacity style={[styles.button, (!canRespond || isSendingStepResponse) && styles.disabled]} disabled={!canRespond || isSendingStepResponse} onPress={() => { void handleRespondStep(); }}>
                {isSendingStepResponse ? <ActivityIndicator color="#fff" /> : <PackageCheck size={18} color="#fff" />}
                <Text style={styles.buttonText}>{respondedStepId === runningStep?.jobStepId ? 'Đã gửi, chờ cập nhật' : responseLabel}</Text>
              </TouchableOpacity>
            </View>}
            <Text style={styles.small}>Xác thực QR và phản hồi cơ cấu mở khóa là hai bước riêng. Hãy thực hiện theo hướng dẫn đang hiển thị.</Text>
          </> : <Text style={styles.muted}>Chọn nhiệm vụ hoặc nhập Job ID để xem bước giao nhận.</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Tạo giao nhận mới</Text>
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
          <Text style={styles.small}>Người gửi và người nhận quét QR trên robot khi đến đúng bước xác thực.</Text>
          <TouchableOpacity disabled={isSubmitting || isLoadingFacility || !attemptReady} style={[styles.button,(isSubmitting || isLoadingFacility) && styles.disabled]} onPress={handleSubmit}>
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <ArrowRight size={18} color="#fff" />}
            <Text style={styles.buttonText}>{pendingDeliveryLabel || 'Tạo và gửi nhiệm vụ'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {scan && <QRScannerModal key={scan.jobId + scan.stepId + scan.accountId} jobCode={activeJob?.jobCode || scan.jobId} purpose={scan.purpose}
        onClose={() => setScan(null)} onVerify={raw => verifyDeliveryQr(scan, raw)} />}
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
});
