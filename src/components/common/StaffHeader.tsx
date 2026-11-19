import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Colors, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  LogOut,
  ArrowLeft,
  User,
  Briefcase,
  Clock,
  MapPin,
  RefreshCw,
  Lock,
  Camera,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertCircle,
  FlipHorizontal,
  X,
} from 'lucide-react-native';
import { Camera as ExpoCamera, CameraView } from 'expo-camera';
import { File as ExpoFile, FileMode } from 'expo-file-system';
import { useAuthStore } from '../../store/useAuthStore';
import { useStaffProfileStore } from '../../store/useStaffProfileStore';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../api/client';
import { staffApi } from '../../api/modules/staff.api';
import {
  computeAspectPreservingDimensions,
  executeStaffAvatarUpload,
  FACE_AVATAR_MAX_BYTES,
  formatFileSizeVi,
  formatOwnFaceEnrollmentStatus,
  SUPPORTED_AVATAR_MIME_TYPES,
  validateSelectedAvatarAsset,
  type SelectedAvatarCandidate,
} from './staffAvatarUpload';

interface StaffHeaderProps {
  /** Tên nhân viên tùy chọn (mặc định lấy từ authStore hoặc staffApi) */
  staffName?: string;
  /** Callback khi bấm đăng xuất */
  onLogout?: () => void;
  /** Nút quay lại (nếu có) */
  onBack?: () => void;
  /** Tiêu đề phụ (mặc định 'MEDIASSISTROVER · NHÂN VIÊN') */
  subtitle?: string;
}

const WEB_AVATAR_MAX_DIM = 1280;

async function readNativeFileHeaderBytes(
  uri: string,
  existingFile?: ExpoFile | null
): Promise<{ size?: number; headerBytes?: Uint8Array }> {
  try {
    const file = existingFile ?? new ExpoFile(uri);
    const size = typeof file.size === 'number' && file.size > 0 ? file.size : undefined;
    let handle: ReturnType<ExpoFile['open']> | null = null;
    try {
      handle = file.open(FileMode.ReadOnly);
      const headerBytes = await handle.readBytes(16);
      return { size, headerBytes };
    } finally {
      try {
        handle?.close();
      } catch {
        // Bỏ qua lỗi đóng file handle
      }
    }
  } catch {
    return {};
  }
}

async function readNativeFileBytes(
  uri: string,
  existingFile?: ExpoFile | null
): Promise<Uint8Array> {
  const file = existingFile ?? new ExpoFile(uri);
  if (typeof file.bytes === 'function') {
    const raw = await file.bytes();
    return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  }
  const handle = file.open(FileMode.ReadOnly);
  try {
    const targetSize =
      typeof file.size === 'number' && file.size > 0
        ? Math.min(file.size, FACE_AVATAR_MAX_BYTES + 64)
        : FACE_AVATAR_MAX_BYTES + 1;
    const raw = await handle.readBytes(targetSize);
    return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  } finally {
    try {
      handle.close();
    } catch {
      // Bỏ qua lỗi đóng file handle
    }
  }
}

async function readWebHeaderBytes(blob: Blob): Promise<Uint8Array | undefined> {
  try {
    const buf = await blob.slice(0, 16).arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return undefined;
  }
}

async function shrinkWebImageIfNeeded(
  file: globalThis.File
): Promise<{ webFile: globalThis.File; width?: number; height?: number; headerBytes?: Uint8Array }> {
  const initialHeader = await readWebHeaderBytes(file);
  if (
    file.size <= FACE_AVATAR_MAX_BYTES &&
    SUPPORTED_AVATAR_MIME_TYPES.includes(file.type as any)
  ) {
    return { webFile: file, headerBytes: initialHeader };
  }
  const doc = (globalThis as any)?.document;
  const WinImage = (globalThis as any)?.Image;
  const UrlApi = (globalThis as any)?.URL;
  if (!doc || typeof WinImage !== 'function' || !UrlApi) {
    return { webFile: file, headerBytes: initialHeader };
  }

  const objectUrl = UrlApi.createObjectURL(file);
  try {
    const img = await new Promise<any>((resolve, reject) => {
      const el = new WinImage();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Không đọc được ảnh đã chọn.'));
      el.src = objectUrl;
    });

    const natW = Number(img.naturalWidth || img.width || 0);
    const natH = Number(img.naturalHeight || img.height || 0);
    if (!natW || !natH) {
      return { webFile: file, headerBytes: initialHeader };
    }

    const scaled = computeAspectPreservingDimensions(natW, natH, WEB_AVATAR_MAX_DIM);
    const canvas = doc.createElement('canvas');
    canvas.width = scaled.width;
    canvas.height = scaled.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { webFile: file, width: natW, height: natH, headerBytes: initialHeader };
    }
    ctx.drawImage(img, 0, 0, scaled.width, scaled.height);

    const qualities = [0.9, 0.8, 0.68, 0.55];
    let bestBlob: Blob | null = null;
    for (const q of qualities) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((res: Blob | null) => resolve(res), 'image/jpeg', q)
      );
      if (blob) {
        bestBlob = blob;
        if (blob.size <= FACE_AVATAR_MAX_BYTES) break;
      }
    }

    if (!bestBlob) {
      return { webFile: file, width: natW, height: natH, headerBytes: initialHeader };
    }

    const stem = (file.name || 'staff-avatar').replace(/\.[^.]+$/, '') || 'staff-avatar';
    const converted = new (globalThis as any).File([bestBlob], `${stem}.jpg`, {
      type: 'image/jpeg',
    });
    const headerBytes = await readWebHeaderBytes(converted);
    return {
      webFile: converted,
      width: scaled.width,
      height: scaled.height,
      headerBytes,
    };
  } catch {
    return { webFile: file, headerBytes: initialHeader };
  } finally {
    UrlApi.revokeObjectURL(objectUrl);
  }
}

export const StaffHeader: React.FC<StaffHeaderProps> = ({
  staffName,
  onLogout,
  onBack,
  subtitle = 'MEDIASSISTROVER · NHÂN VIÊN',
}) => {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuthStore();
  const staffData = useStaffProfileStore((s) => s.staffMe);
  const shifts = useStaffProfileStore((s) => s.shifts);
  const faceStatus = useStaffProfileStore((s) => s.faceStatus);
  const ensureProfileLoaded = useStaffProfileStore((s) => s.ensureLoaded);
  const refreshFaceStatus = useStaffProfileStore((s) => s.refreshFaceStatus);
  const applyStaffMeUpdate = useStaffProfileStore((s) => s.applyStaffMeUpdate);
  const isLoadingProfile = useStaffProfileStore((s) => s.isLoading);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [avatarImageFailed, setAvatarImageFailed] = useState(false);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const [isCameraCaptureOpen, setIsCameraCaptureOpen] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const [isCapturingPhoto, setIsCapturingPhoto] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<SelectedAvatarCandidate | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isRefreshingFaceStatus, setIsRefreshingFaceStatus] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{
    kind: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const mountedRef = useRef(true);
  const cameraRef = useRef<CameraView | null>(null);
  const uploadInFlightRef = useRef(false);
  const scopeKey = `${apiClient.getBaseUrl()}::${user?.accountId || user?.username || ''}`;
  const currentScopeRef = useRef(scopeKey);
  currentScopeRef.current = scopeKey;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchStaffProfile = (force = false) => {
    void ensureProfileLoaded(force).catch(() => {});
  };

  useEffect(() => {
    fetchStaffProfile(false);
  }, [user?.accountId]);

  const clearPreviewCandidate = () => {
    setSelectedCandidate((prev) => {
      if (
        Platform.OS === 'web' &&
        prev?.uri?.startsWith('blob:') &&
        typeof (globalThis as any)?.URL?.revokeObjectURL === 'function'
      ) {
        try {
          (globalThis as any).URL.revokeObjectURL(prev.uri);
        } catch {
          // Bỏ qua lỗi thu hồi ObjectURL
        }
      }
      return null;
    });
  };

  // Reset trạng thái xem trước/tải ảnh nếu đổi tài khoản hoặc máy chủ
  useEffect(() => {
    clearPreviewCandidate();
    setShowAvatarChooser(false);
    setIsCameraCaptureOpen(false);
    setUploadFeedback(null);
    setAvatarImageFailed(false);
  }, [scopeKey]);

  const faceEnrollmentDisplay = useMemo(
    () =>
      formatOwnFaceEnrollmentStatus({
        accountId: staffData?.account?.accountId || user?.accountId,
        staffProfile: staffData?.staffProfile,
        faceStatus,
      }),
    [staffData?.account?.accountId, user?.accountId, staffData?.staffProfile, faceStatus]
  );

  const currentAvatarUrl = faceEnrollmentDisplay.avatarUrl;
  useEffect(() => {
    setAvatarImageFailed(false);
  }, [currentAvatarUrl]);

  const previewValidation = useMemo(
    () => (selectedCandidate ? validateSelectedAvatarAsset(selectedCandidate) : null),
    [selectedCandidate]
  );

  const handleRefreshProfileAndFaceStatus = async () => {
    setIsRefreshingFaceStatus(true);
    try {
      await ensureProfileLoaded(true);
      await refreshFaceStatus().catch(() => null);
    } finally {
      if (mountedRef.current) setIsRefreshingFaceStatus(false);
    }
  };

  const handlePickFromLibrary = async () => {
    const pickScope = currentScopeRef.current;
    setUploadFeedback(null);
    setIsCameraCaptureOpen(false);

    if (Platform.OS === 'web') {
      const doc = (globalThis as any)?.document;
      if (!doc) return;
      const input = doc.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp';
      input.onchange = async () => {
        const pickedFile = input.files?.[0] as globalThis.File | undefined;
        if (!pickedFile) return; // Người dùng bấm hủy chọn tệp
        const processed = await shrinkWebImageIfNeeded(pickedFile);
        if (!mountedRef.current || currentScopeRef.current !== pickScope) return;
        const url = (globalThis as any).URL.createObjectURL(processed.webFile);
        clearPreviewCandidate();
        setSelectedCandidate({
          uri: url,
          fileName: processed.webFile.name,
          mimeType: processed.webFile.type,
          fileSize: processed.webFile.size,
          width: processed.width,
          height: processed.height,
          headerBytes: processed.headerBytes,
          webFile: processed.webFile,
        });
        setShowAvatarChooser(true);
      };
      input.click();
      return;
    }

    try {
      const picked = await ExpoFile.pickFileAsync({
        multipleFiles: false,
        mimeTypes: [...SUPPORTED_AVATAR_MIME_TYPES],
      });
      if (!mountedRef.current || currentScopeRef.current !== pickScope) return;
      if (picked.canceled || !picked.result) {
        return; // Người dùng hủy chọn ảnh
      }
      const pickedFile = picked.result;
      const meta = await readNativeFileHeaderBytes(pickedFile.uri, pickedFile);
      if (!mountedRef.current || currentScopeRef.current !== pickScope) return;

      clearPreviewCandidate();
      setSelectedCandidate({
        uri: pickedFile.uri,
        fileName: pickedFile.name || 'staff-avatar.jpg',
        mimeType: pickedFile.type || undefined,
        fileSize: meta.size ?? (typeof pickedFile.size === 'number' ? pickedFile.size : undefined),
        headerBytes: meta.headerBytes,
        readBytes: () => readNativeFileBytes(pickedFile.uri, pickedFile),
      });
      setShowAvatarChooser(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setUploadFeedback({
        kind: 'error',
        message: err?.message || 'Không thể mở thư viện ảnh trên thiết bị.',
      });
    }
  };

  const handleOpenCameraCapture = async () => {
    setUploadFeedback(null);
    try {
      const perm = await ExpoCamera.requestCameraPermissionsAsync();
      if (!mountedRef.current) return;
      if (!perm?.granted) {
        setUploadFeedback({
          kind: 'error',
          message:
            'Chưa được cấp quyền Camera. Hãy bật quyền Camera trong Cài đặt thiết bị hoặc chọn ảnh từ thư viện.',
        });
        return;
      }
      setIsCameraCaptureOpen(true);
      setShowAvatarChooser(true);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setUploadFeedback({
        kind: 'error',
        message: err?.message || 'Không thể yêu cầu quyền Camera.',
      });
    }
  };

  const handleTakePhoto = async () => {
    if (isCapturingPhoto || !cameraRef.current) return;
    const captureScope = currentScopeRef.current;
    setIsCapturingPhoto(true);
    setUploadFeedback(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.72,
        skipProcessing: false,
      });
      if (!mountedRef.current || currentScopeRef.current !== captureScope || !photo?.uri) return;

      let candidate: SelectedAvatarCandidate;
      if (Platform.OS === 'web' && photo.uri.startsWith('data:')) {
        const res = await fetch(photo.uri);
        const blob = await res.blob();
        const webFile = new (globalThis as any).File([blob], 'staff-camera.jpg', {
          type: blob.type || 'image/jpeg',
        });
        const processed = await shrinkWebImageIfNeeded(webFile);
        const objectUrl = (globalThis as any).URL.createObjectURL(processed.webFile);
        candidate = {
          uri: objectUrl,
          fileName: processed.webFile.name,
          mimeType: processed.webFile.type,
          fileSize: processed.webFile.size,
          width: processed.width ?? photo.width,
          height: processed.height ?? photo.height,
          headerBytes: processed.headerBytes,
          webFile: processed.webFile,
        };
      } else {
        const meta = await readNativeFileHeaderBytes(photo.uri);
        candidate = {
          uri: photo.uri,
          fileName: `staff-camera.${photo.format === 'png' ? 'png' : 'jpg'}`,
          mimeType: photo.format === 'png' ? 'image/png' : 'image/jpeg',
          fileSize: meta.size,
          width: photo.width,
          height: photo.height,
          headerBytes: meta.headerBytes,
          readBytes: () => readNativeFileBytes(photo.uri),
        };
      }

      if (!mountedRef.current || currentScopeRef.current !== captureScope) return;
      clearPreviewCandidate();
      setSelectedCandidate(candidate);
      setIsCameraCaptureOpen(false);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setUploadFeedback({
        kind: 'error',
        message: err?.message || 'Không chụp được ảnh. Vui lòng thử lại hoặc chọn ảnh từ thư viện.',
      });
    } finally {
      if (mountedRef.current) setIsCapturingPhoto(false);
    }
  };

  const handleUploadSelectedAvatar = async () => {
    if (!selectedCandidate || uploadInFlightRef.current) return;
    const submitScope = currentScopeRef.current;
    setIsUploadingAvatar(true);
    setUploadFeedback(null);

    try {
      const outcome = await executeStaffAvatarUpload({
        candidate: selectedCandidate,
        previousProfile: staffData?.staffProfile,
        inFlightLock: uploadInFlightRef,
        uploadAvatar: (formData) => staffApi.uploadMyAvatar(formData),
        refreshStaffMe: async () => {
          const loaded = await ensureProfileLoaded(true);
          return loaded.staffMe;
        },
        fetchFaceStatus: (accountId) => staffApi.getFaceStatus(accountId).catch(() => null),
        isCurrentScope: () => mountedRef.current && currentScopeRef.current === submitScope,
      });

      if (outcome.ignored || !mountedRef.current || currentScopeRef.current !== submitScope) {
        return;
      }

      if (outcome.ok && outcome.staffMe) {
        applyStaffMeUpdate(outcome.staffMe, outcome.faceStatus);
        clearPreviewCandidate();
        setShowAvatarChooser(false);
        setIsCameraCaptureOpen(false);
        setUploadFeedback({
          kind: 'success',
          message: outcome.message,
        });
      } else {
        if (outcome.refreshedProfile) {
          applyStaffMeUpdate(outcome.refreshedProfile);
        }
        setUploadFeedback({
          kind: 'error',
          message: outcome.message,
        });
      }
    } finally {
      if (mountedRef.current && currentScopeRef.current === submitScope) {
        setIsUploadingAvatar(false);
      }
    }
  };

  const displayName =
    staffName || staffData?.account?.fullName || user?.fullName || 'Nhân viên';
  const departmentName =
    staffData?.staffProfile?.departmentCode === 'KHO_DUOC'
      ? 'Kho Dược'
      : (staffData?.staffProfile?.departmentCode || 'Chưa cập nhật khoa');
  const jobTitle = staffData?.staffProfile?.jobTitle || 'Nhân viên';
  const activeShift = staffData?.activeShifts?.[0] || shifts?.[0];

  const handleLogout = async () => {
    if (onLogout) {
      onLogout();
    } else {
      await logout();
      try {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Login' }],
        });
      } catch {
        navigation.navigate('Login');
      }
    }
  };

  const faceBadgeTheme =
    faceEnrollmentDisplay.tone === 'ready'
      ? { bg: '#D1FAE5', text: '#047857' }
      : faceEnrollmentDisplay.tone === 'pending'
      ? { bg: '#FEF3C7', text: '#B45309' }
      : faceEnrollmentDisplay.tone === 'danger'
      ? { bg: '#FEE2E2', text: '#B91C1C' }
      : faceEnrollmentDisplay.tone === 'warning'
      ? { bg: '#FFEDD5', text: '#C2410C' }
      : { bg: '#F1F5F9', text: '#475569' };

  return (
    <>
      <View style={styles.header} accessible accessibilityRole="header">
        <TouchableOpacity
          style={styles.headerLeft}
          onPress={() => setShowProfileModal(true)}
          activeOpacity={0.8}
        >
          {onBack && (
            <TouchableOpacity
              onPress={onBack}
              style={styles.backBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Quay lại"
              accessibilityRole="button"
            >
              <ArrowLeft size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <View style={styles.avatarCircle} accessibilityLabel="Ảnh đại diện">
            {currentAvatarUrl && !avatarImageFailed ? (
              <Image
                source={{ uri: currentAvatarUrl }}
                style={styles.headerAvatarImage}
                onError={() => setAvatarImageFailed(true)}
              />
            ) : (
              <User size={18} color="#FFFFFF" strokeWidth={2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.brandSmall}>{subtitle}</Text>
              {staffData?.activeShifts && staffData.activeShifts.length > 0 ? (
                <View style={styles.badgeOnDuty} accessibilityLabel="Trạng thái trực: Đang trực">
                  <Text style={styles.badgeOnDutyText}>ĐANG TRỰC</Text>
                </View>
              ) : (
                <View style={styles.badgeOffDuty} accessibilityLabel="Trạng thái trực: Ngoài ca">
                  <Text style={styles.badgeOffDutyText}>NGOÀI CA</Text>
                </View>
              )}
            </View>
            <Text style={styles.staffName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.staffSubtitle} numberOfLines={1}>
              {departmentName} · {jobTitle}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          accessibilityLabel="Đăng xuất"
          accessibilityRole="button"
          activeOpacity={0.7}
        >
          <LogOut size={13} color={Colors.textPrimary} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================
          MODAL: HỒ SƠ NHÂN VIÊN, ĐĂNG KÝ KHUÔN MẶT & CA TRỰC (GET /staff/me)
      ======================================================== */}
      <Modal
        visible={showProfileModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setIsCameraCaptureOpen(false);
          setShowProfileModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.profileSheetContainer}>
            <View style={styles.sheetHandle} />

            <View style={styles.profileHeaderRow}>
              <View>
                <Text style={styles.profileCategoryLabel}>HỆ THỐNG Y TẾ · STAFF PROFILE</Text>
                <Text style={styles.profileModalTitle}>Hồ sơ nhân viên & Ca trực</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  void handleRefreshProfileAndFaceStatus();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isLoadingProfile || isRefreshingFaceStatus ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <RefreshCw size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {/* Account Card với ảnh đại diện thật */}
              <View style={styles.profileCard}>
                <View style={styles.profileAvatarBox}>
                  {currentAvatarUrl && !avatarImageFailed ? (
                    <Image
                      source={{ uri: currentAvatarUrl }}
                      style={styles.profileAvatarImage}
                      onError={() => setAvatarImageFailed(true)}
                    />
                  ) : (
                    <User size={24} color={Colors.actionSurface} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.profileFullName}>{displayName}</Text>
                  <Text style={styles.profileAccountCode}>
                    Tài khoản: {staffData?.account?.username || user?.username || 'staff'} ·{' '}
                    {staffData?.account?.role || 'STAFF'}
                  </Text>
                  <Text style={styles.profileContact}>
                    📧 {staffData?.account?.email || 'Chưa cập nhật'} · 📱{' '}
                    {staffData?.account?.phone || 'Chưa cập nhật'}
                  </Text>
                </View>
              </View>

              {/* Khu vực ảnh khuôn mặt & trạng thái duyệt */}
              <View style={styles.infoSection}>
                <View style={styles.faceSectionHeader}>
                  <Text style={[styles.sectionHeaderTitle, { marginBottom: 0, flex: 1 }]}>
                    ĐĂNG KÝ KHUÔN MẶT GIAO HÀNG
                  </Text>
                  <View style={[styles.faceStatusBadge, { backgroundColor: faceBadgeTheme.bg }]}>
                    <Text style={[styles.faceStatusBadgeText, { color: faceBadgeTheme.text }]}>
                      {faceEnrollmentDisplay.badgeLabel}
                    </Text>
                  </View>
                </View>

                <Text style={styles.faceDescText}>{faceEnrollmentDisplay.description}</Text>

                {faceEnrollmentDisplay.avatarVersion ? (
                  <Text style={styles.faceVersionText} selectable>
                    Avatar revision: {faceEnrollmentDisplay.avatarVersion}
                  </Text>
                ) : null}

                <View
                  style={[
                    styles.faceGuidanceBox,
                    faceEnrollmentDisplay.isReadyForFaceDelivery && styles.faceGuidanceBoxReady,
                  ]}
                >
                  {faceEnrollmentDisplay.isReadyForFaceDelivery ? (
                    <CheckCircle2 size={15} color="#047857" />
                  ) : (
                    <AlertCircle size={15} color="#B45309" />
                  )}
                  <Text
                    style={[
                      styles.faceGuidanceText,
                      faceEnrollmentDisplay.isReadyForFaceDelivery && { color: '#065F46' },
                    ]}
                  >
                    {faceEnrollmentDisplay.adminReviewGuidance}
                  </Text>
                </View>

                <View style={styles.faceActionRow}>
                  <TouchableOpacity
                    style={[styles.facePrimaryBtn, isUploadingAvatar && styles.disabledBtn]}
                    disabled={isUploadingAvatar}
                    onPress={() => {
                      setShowAvatarChooser((prev) => !prev);
                      setIsCameraCaptureOpen(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Camera size={15} color="#FFFFFF" />
                    <Text style={styles.facePrimaryBtnText}>Cập nhật ảnh khuôn mặt</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.faceSecondaryBtn}
                    disabled={isRefreshingFaceStatus || isUploadingAvatar}
                    onPress={() => {
                      void handleRefreshProfileAndFaceStatus();
                    }}
                    activeOpacity={0.8}
                  >
                    {isRefreshingFaceStatus ? (
                      <ActivityIndicator size="small" color={Colors.actionSurface} />
                    ) : (
                      <RefreshCw size={14} color={Colors.actionSurface} />
                    )}
                    <Text style={styles.faceSecondaryBtnText}>Làm mới trạng thái</Text>
                  </TouchableOpacity>
                </View>

                {/* Nguồn chọn ảnh / Camera / Xem trước / Tải lên */}
                {(showAvatarChooser || selectedCandidate || isCameraCaptureOpen) && (
                  <View style={styles.avatarUploadCard}>
                    <Text style={styles.avatarGuideHint}>
                      Chọn ảnh có đúng 1 khuôn mặt rõ nét, nhìn thẳng, đủ sáng (JPG, PNG hoặc WebP · tối đa 2 MiB). Chất lượng nhận diện do AI/BE kiểm tra khi duyệt.
                    </Text>

                    {!isCameraCaptureOpen && (
                      <View style={styles.sourceButtonsRow}>
                        <TouchableOpacity
                          style={styles.sourceBtn}
                          disabled={isUploadingAvatar}
                          onPress={() => {
                            void handlePickFromLibrary();
                          }}
                          activeOpacity={0.8}
                        >
                          <ImageIcon size={15} color={Colors.actionSurface} />
                          <Text style={styles.sourceBtnText}>Chọn ảnh từ thư viện</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.sourceBtn}
                          disabled={isUploadingAvatar}
                          onPress={() => {
                            void handleOpenCameraCapture();
                          }}
                          activeOpacity={0.8}
                        >
                          <Camera size={15} color={Colors.actionSurface} />
                          <Text style={styles.sourceBtnText}>Chụp ảnh mới</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {isCameraCaptureOpen && (
                      <View style={styles.cameraCaptureBox}>
                        <View style={styles.cameraFrame}>
                          <CameraView
                            ref={cameraRef}
                            style={StyleSheet.absoluteFill}
                            facing={cameraFacing}
                          />
                          <View style={styles.cameraOvalGuide} pointerEvents="none" />
                        </View>
                        <Text style={styles.cameraGuideCaption}>
                          Căn 1 khuôn mặt vào giữa khung, nhìn thẳng và đủ sáng
                        </Text>
                        <View style={styles.cameraControlsRow}>
                          <TouchableOpacity
                            style={styles.cameraCancelBtn}
                            onPress={() => setIsCameraCaptureOpen(false)}
                            disabled={isCapturingPhoto}
                          >
                            <X size={15} color={Colors.textPrimary} />
                            <Text style={styles.cameraCancelBtnText}>Hủy</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.cameraFlipBtn}
                            onPress={() =>
                              setCameraFacing((prev) => (prev === 'front' ? 'back' : 'front'))
                            }
                            disabled={isCapturingPhoto}
                          >
                            <FlipHorizontal size={16} color={Colors.textPrimary} />
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.cameraShootBtn, isCapturingPhoto && styles.disabledBtn]}
                            onPress={() => {
                              void handleTakePhoto();
                            }}
                            disabled={isCapturingPhoto}
                          >
                            {isCapturingPhoto ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Camera size={15} color="#FFFFFF" />
                                <Text style={styles.cameraShootBtnText}>Chụp ảnh</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {selectedCandidate && !isCameraCaptureOpen && (
                      <View style={styles.previewCard}>
                        <View style={styles.previewTopRow}>
                          <Image
                            source={{ uri: selectedCandidate.uri }}
                            style={styles.previewThumb}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.previewFileName} numberOfLines={1}>
                              {previewValidation?.normalizedFileName ||
                                selectedCandidate.fileName ||
                                'staff-avatar.jpg'}
                            </Text>
                            <Text style={styles.previewMetaText}>
                              {previewValidation?.normalizedMimeType ||
                                selectedCandidate.mimeType ||
                                'Ảnh đã chọn'}{' '}
                              · {formatFileSizeVi(selectedCandidate.fileSize)}
                            </Text>
                            {previewValidation && !previewValidation.valid && (
                              <Text style={styles.previewErrorText}>
                                {previewValidation.errorMessage}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={styles.previewActionRow}>
                          <TouchableOpacity
                            style={styles.previewRetryBtn}
                            disabled={isUploadingAvatar}
                            onPress={() => {
                              clearPreviewCandidate();
                              setUploadFeedback(null);
                            }}
                          >
                            <Text style={styles.previewRetryBtnText}>Chọn lại / Hủy</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.uploadConfirmBtn,
                              (isUploadingAvatar || !previewValidation?.valid) && styles.disabledBtn,
                            ]}
                            disabled={isUploadingAvatar || !previewValidation?.valid}
                            onPress={() => {
                              void handleUploadSelectedAvatar();
                            }}
                          >
                            {isUploadingAvatar ? (
                              <>
                                <ActivityIndicator size="small" color="#FFFFFF" />
                                <Text style={styles.uploadConfirmBtnText}>Đang tải lên...</Text>
                              </>
                            ) : (
                              <>
                                <Upload size={15} color="#FFFFFF" />
                                <Text style={styles.uploadConfirmBtnText}>Tải ảnh lên</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {uploadFeedback && (
                  <View
                    style={[
                      styles.uploadFeedbackBox,
                      uploadFeedback.kind === 'success'
                        ? styles.uploadFeedbackSuccess
                        : styles.uploadFeedbackError,
                    ]}
                  >
                    {uploadFeedback.kind === 'success' ? (
                      <CheckCircle2 size={15} color="#047857" />
                    ) : (
                      <AlertCircle size={15} color="#B91C1C" />
                    )}
                    <Text
                      style={[
                        styles.uploadFeedbackText,
                        {
                          color: uploadFeedback.kind === 'success' ? '#065F46' : '#991B1B',
                        },
                      ]}
                    >
                      {uploadFeedback.message}
                    </Text>
                  </View>
                )}
              </View>

              {/* Department & Role Details */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionHeaderTitle}>VỊ TRÍ CÔNG TÁC TẠI BỆNH VIỆN</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoGridItem}>
                    <Briefcase size={14} color={Colors.primary} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>KHOA / PHÒNG</Text>
                      <Text style={styles.infoGridValue}>{departmentName}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <User size={14} color={Colors.tealDark} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>CHỨC DANH</Text>
                      <Text style={styles.infoGridValue}>{jobTitle}</Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <MapPin size={14} color="#D97706" />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>MÃ NHÂN VIÊN</Text>
                      <Text style={styles.infoGridValue}>
                        {staffData?.staffProfile?.staffCode || 'STF-TEST-001'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.infoGridItem}>
                    <Clock size={14} color={Colors.emerald} />
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.infoGridLabel}>TRẠNG THÁI</Text>
                      <Text style={[styles.infoGridValue, { color: Colors.emerald }]}>
                        Đang làm việc
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Active Shifts */}
              <View style={styles.infoSection}>
                <Text style={styles.sectionHeaderTitle}>CA TRỰC ĐANG HIỆU LỰC (SHIFTS)</Text>
                {activeShift ? (
                  <View style={styles.shiftCard}>
                    <View style={styles.shiftCardTop}>
                      <View style={styles.shiftBadgeActive}>
                        <Text style={styles.shiftBadgeActiveText}>ĐANG TRỰC</Text>
                      </View>
                      <Text style={styles.shiftTime}>
                        {activeShift.startsAt
                          ? new Date(activeShift.startsAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}{' '}
                        -{' '}
                        {activeShift.endsAt
                          ? new Date(activeShift.endsAt).toLocaleTimeString('vi-VN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </Text>
                    </View>
                    <Text style={styles.shiftTitle}>
                      {activeShift.shiftName || 'Ca trực'}
                    </Text>
                    <Text style={styles.shiftSubtext}>
                      Mã ca: {activeShift.shiftCode || 'Chưa cập nhật'} · Phòng:{' '}
                      {activeShift.roomCode || 'Chưa cập nhật'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.shiftCard}>
                    <Text style={styles.shiftTitle}>Backend chưa có ca trực được phân công.</Text>
                  </View>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.sheetChangePasswordBtn}
              onPress={() => {
                setIsCameraCaptureOpen(false);
                setShowProfileModal(false);
                navigation.navigate('FirstLoginPasswordChange', {
                  username: user?.username || staffData?.account?.username || 'staff1',
                  staffCode: staffData?.staffProfile?.staffCode || user?.accountCode || 'STF-001',
                });
              }}
              activeOpacity={0.8}
            >
              <Lock size={15} color={Colors.primary} />
              <Text style={styles.sheetChangePasswordText}>Đổi mật khẩu tài khoản</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetCloseButton}
              onPress={() => {
                setIsCameraCaptureOpen(false);
                setShowProfileModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetCloseButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  backBtn: {
    marginRight: Spacing.sm,
    padding: 4,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandSmall: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  badgeOnDuty: {
    backgroundColor: Colors.successSurface,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  badgeOnDutyText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.successText,
  },
  badgeOffDuty: {
    backgroundColor: Colors.surfaceMuted,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  badgeOffDutyText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  staffName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  staffSubtitle: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: Colors.surface,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },

  // Modal Profile & Shifts
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  profileSheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.md,
    paddingBottom: 32,
    maxHeight: '85%',
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
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  profileCategoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  profileModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9FF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    marginBottom: 14,
    gap: 12,
  },
  profileAvatarBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileAvatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  profileFullName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profileAccountCode: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  profileContact: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 3,
  },

  faceSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  faceStatusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  faceStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  faceDescText: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  faceVersionText: {
    fontSize: 11,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  faceGuidanceBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  faceGuidanceBoxReady: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  faceGuidanceText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    color: '#92400E',
  },
  faceActionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  facePrimaryBtn: {
    flex: 1,
    minWidth: 165,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Colors.actionSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  facePrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  faceSecondaryBtn: {
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  faceSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  disabledBtn: {
    opacity: 0.5,
  },
  avatarUploadCard: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  avatarGuideHint: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textSecondary,
  },
  sourceButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sourceBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 8,
  },
  sourceBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cameraCaptureBox: {
    gap: 8,
    alignItems: 'center',
  },
  cameraFrame: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0A293B',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cameraOvalGuide: {
    width: 130,
    height: 165,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  cameraGuideCaption: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  cameraControlsRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    alignItems: 'center',
  },
  cameraCancelBtn: {
    minHeight: 42,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cameraCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  cameraFlipBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraShootBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: Colors.actionSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  cameraShootBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 10,
    gap: 10,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewThumb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#E2E8F0',
  },
  previewFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewMetaText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  previewErrorText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
    marginTop: 3,
  },
  previewActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  previewRetryBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRetryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  uploadConfirmBtn: {
    flex: 1.4,
    minHeight: 40,
    borderRadius: 10,
    backgroundColor: '#059669',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadConfirmBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  uploadFeedbackBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
  },
  uploadFeedbackSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  uploadFeedbackError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  uploadFeedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },

  infoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  sectionHeaderTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.7,
    marginBottom: 10,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoGridItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  infoGridLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  infoGridValue: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },

  shiftCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  shiftCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  shiftBadgeActive: {
    backgroundColor: '#16A34A',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  shiftBadgeActiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  shiftTime: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  shiftTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  shiftSubtext: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },

  sheetChangePasswordBtn: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  sheetChangePasswordText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  sheetCloseButton: {
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  sheetCloseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});
