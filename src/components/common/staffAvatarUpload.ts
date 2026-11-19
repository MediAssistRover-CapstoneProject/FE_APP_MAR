import type {
  StaffFaceStatusResponse,
  StaffMeResponse,
  StaffProfileSummary,
} from '../../api/types';

export const FACE_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB (2,097,152 bytes)

export const SUPPORTED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type SupportedAvatarMimeType = (typeof SUPPORTED_AVATAR_MIME_TYPES)[number];

export interface SelectedAvatarCandidate {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  headerBytes?: Uint8Array | number[] | null;
  webFile?: unknown;
  readBytes?: () => Promise<Uint8Array | ArrayBuffer>;
}

export type AvatarValidationErrorCode =
  | 'EMPTY_FILE'
  | 'UNSUPPORTED_FORMAT'
  | 'FILE_TOO_LARGE';

export interface AvatarValidationResult {
  valid: boolean;
  errorCode?: AvatarValidationErrorCode;
  errorMessage?: string;
  needsCompression?: boolean;
  normalizedFileName?: string;
  normalizedMimeType?: SupportedAvatarMimeType;
  sizeBytes?: number | null;
  aspectRatio?: number | null;
}

export interface AspectPreservingSize {
  width: number;
  height: number;
  scale: number;
  aspectRatio: number;
}

export interface OwnFaceEnrollmentStatusDisplay {
  rawStatus: string;
  badgeLabel: string;
  tone: 'ready' | 'pending' | 'warning' | 'danger' | 'muted';
  enabled: boolean;
  avatarUrl: string | null;
  avatarVersion: string | null;
  isReadyForFaceDelivery: boolean;
  needsAdminReview: boolean;
  description: string;
  adminReviewGuidance: string;
}

export type AvatarUploadOutcomeKind =
  | 'UPLOADED'
  | 'IN_FLIGHT'
  | 'VALIDATION_ERROR'
  | 'STALE_SCOPE'
  | 'TIMEOUT'
  | 'NETWORK_ERROR'
  | 'FORBIDDEN'
  | 'SERVER_ERROR';

export interface AvatarUploadOutcome {
  ok: boolean;
  kind: AvatarUploadOutcomeKind;
  ignored?: boolean;
  recoveredFromLostResponse?: boolean;
  message: string;
  staffMe?: StaffMeResponse | null;
  faceStatus?: StaffFaceStatusResponse | null;
  refreshedProfile?: StaffMeResponse | null;
  statusDisplay?: OwnFaceEnrollmentStatusDisplay;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_TO_EXT: Record<SupportedAvatarMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function normalizeDeclaredMime(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = String(raw).split(';', 2)[0].trim().toLowerCase();
  if (cleaned === 'image/jpg') return 'image/jpeg';
  return cleaned;
}

function extractExtension(pathOrName?: string | null): string {
  if (!pathOrName) return '';
  const stripped = String(pathOrName).split('?')[0].split('#')[0].trim().toLowerCase();
  const lastSlash = Math.max(stripped.lastIndexOf('/'), stripped.lastIndexOf('\\'));
  const base = lastSlash >= 0 ? stripped.slice(lastSlash + 1) : stripped;
  const dot = base.lastIndexOf('.');
  if (dot < 0 || dot === base.length - 1) return '';
  return base.slice(dot + 1);
}

function mimeFromExtension(ext: string): SupportedAvatarMimeType | 'UNSUPPORTED' | null {
  if (!ext) return null;
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'UNSUPPORTED';
}

export function detectAvatarMimeFromHeaderBytes(
  bytes?: Uint8Array | number[] | null
): SupportedAvatarMimeType | 'UNSUPPORTED_SIGNATURE' | null {
  if (!bytes || bytes.length < 3) return null;
  const b = (index: number) => (bytes[index] ?? 0) & 0xff;

  // JPEG: FF D8 FF
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    b(0) === 0x89 &&
    b(1) === 0x50 &&
    b(2) === 0x4e &&
    b(3) === 0x47 &&
    b(4) === 0x0d &&
    b(5) === 0x0a &&
    b(6) === 0x1a &&
    b(7) === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    b(0) === 0x52 &&
    b(1) === 0x49 &&
    b(2) === 0x46 &&
    b(3) === 0x46 &&
    b(8) === 0x57 &&
    b(9) === 0x45 &&
    b(10) === 0x42 &&
    b(11) === 0x50
  ) {
    return 'image/webp';
  }
  return 'UNSUPPORTED_SIGNATURE';
}

export function normalizeAvatarFileName(
  fileName: string | null | undefined,
  mimeType: SupportedAvatarMimeType
): string {
  const expectedExt = MIME_TO_EXT[mimeType];
  const rawBase = String(fileName || '')
    .split('?')[0]
    .split('#')[0]
    .trim();
  const lastSlash = Math.max(rawBase.lastIndexOf('/'), rawBase.lastIndexOf('\\'));
  const baseName = lastSlash >= 0 ? rawBase.slice(lastSlash + 1) : rawBase;

  if (!baseName) {
    return `staff-avatar.${expectedExt}`;
  }

  const dot = baseName.lastIndexOf('.');
  const stem = (dot > 0 ? baseName.slice(0, dot) : baseName).replace(/[^A-Za-z0-9._-]/g, '_') || 'staff-avatar';
  const currentExt = extractExtension(baseName);

  if (mimeType === 'image/jpeg' && (currentExt === 'jpg' || currentExt === 'jpeg')) {
    return `${stem}.${currentExt}`;
  }
  if (currentExt === expectedExt) {
    return `${stem}.${currentExt}`;
  }
  return `${stem}.${expectedExt}`;
}

export function computeAspectPreservingDimensions(
  width: number,
  height: number,
  maxDimension: number
): AspectPreservingSize {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: maxDimension, height: maxDimension, scale: 1, aspectRatio: 1 };
  }
  const safeMax = Number.isFinite(maxDimension) && maxDimension > 0 ? maxDimension : Math.max(width, height);
  const scale = Math.min(1, safeMax / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
    aspectRatio: width / height,
  };
}

export function formatFileSizeVi(sizeBytes?: number | null): string {
  if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return 'Chưa rõ dung lượng';
  }
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export function validateSelectedAvatarAsset(
  candidate?: SelectedAvatarCandidate | null
): AvatarValidationResult {
  if (!candidate || !candidate.uri || !String(candidate.uri).trim()) {
    return {
      valid: false,
      errorCode: 'EMPTY_FILE',
      errorMessage: 'Vui lòng chọn hoặc chụp một ảnh đại diện hợp lệ trước khi tải lên.',
    };
  }

  if (
    candidate.fileSize !== undefined &&
    candidate.fileSize !== null &&
    (!Number.isFinite(candidate.fileSize) || candidate.fileSize <= 0)
  ) {
    return {
      valid: false,
      errorCode: 'EMPTY_FILE',
      errorMessage: 'Tệp ảnh bị rỗng (0 byte). Vui lòng chọn ảnh khác.',
    };
  }

  const declaredMime = normalizeDeclaredMime(candidate.mimeType);
  const nameExt = extractExtension(candidate.fileName) || extractExtension(candidate.uri);
  const extMime = mimeFromExtension(nameExt);
  const magicMime = detectAvatarMimeFromHeaderBytes(candidate.headerBytes);

  if (magicMime === 'UNSUPPORTED_SIGNATURE') {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_FORMAT',
      errorMessage:
        'Nội dung tệp không phải ảnh JPG, PNG hoặc WebP hợp lệ theo kiểm tra máy chủ.',
    };
  }

  if (
    declaredMime &&
    declaredMime !== 'application/octet-stream' &&
    !SUPPORTED_AVATAR_MIME_TYPES.includes(declaredMime as SupportedAvatarMimeType)
  ) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_FORMAT',
      errorMessage: `Định dạng ${declaredMime} chưa được hỗ trợ. Chỉ chấp nhận JPG, PNG hoặc WebP.`,
    };
  }

  let resolvedMime: SupportedAvatarMimeType | null = null;
  if (magicMime) {
    if (
      declaredMime &&
      declaredMime !== 'application/octet-stream' &&
      declaredMime !== magicMime
    ) {
      return {
        valid: false,
        errorCode: 'UNSUPPORTED_FORMAT',
        errorMessage: `Phần mở rộng/MIME khai báo (${declaredMime}) không khớp nội dung ảnh (${magicMime}). Hãy chọn hoặc xuất lại tệp đúng định dạng.`,
      };
    }
    resolvedMime = magicMime;
  } else if (SUPPORTED_AVATAR_MIME_TYPES.includes(declaredMime as SupportedAvatarMimeType)) {
    resolvedMime = declaredMime as SupportedAvatarMimeType;
  } else if (extMime && extMime !== 'UNSUPPORTED') {
    resolvedMime = extMime;
  }

  if (!resolvedMime) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_FORMAT',
      errorMessage: 'Chỉ hỗ trợ ảnh định dạng JPG, PNG hoặc WebP.',
    };
  }

  if (extMime === 'UNSUPPORTED' && !magicMime) {
    return {
      valid: false,
      errorCode: 'UNSUPPORTED_FORMAT',
      errorMessage: 'Đuôi tệp ảnh phải là .jpg, .jpeg, .png hoặc .webp.',
    };
  }

  const sizeBytes =
    typeof candidate.fileSize === 'number' && Number.isFinite(candidate.fileSize)
      ? candidate.fileSize
      : null;

  if (sizeBytes !== null && sizeBytes > FACE_AVATAR_MAX_BYTES) {
    return {
      valid: false,
      errorCode: 'FILE_TOO_LARGE',
      needsCompression: true,
      sizeBytes,
      normalizedMimeType: resolvedMime,
      errorMessage: `Ảnh có dung lượng ${formatFileSizeVi(sizeBytes)}, vượt giới hạn tối đa 2 MiB (2.00 MiB) cho đăng ký khuôn mặt. Hãy chọn hoặc nén ảnh nhỏ hơn mà giữ nguyên tỷ lệ.`,
    };
  }

  const normalizedFileName = normalizeAvatarFileName(
    candidate.fileName || candidate.uri,
    resolvedMime
  );
  const aspectRatio =
    candidate.width && candidate.height && candidate.height > 0
      ? candidate.width / candidate.height
      : null;

  return {
    valid: true,
    normalizedFileName,
    normalizedMimeType: resolvedMime,
    sizeBytes,
    aspectRatio,
  };
}

export function buildAvatarUploadFormData(
  candidate: SelectedAvatarCandidate,
  FormDataCtor: typeof FormData = globalThis.FormData
): { formData: FormData; validation: AvatarValidationResult } {
  const validation = validateSelectedAvatarAsset(candidate);
  if (!validation.valid || !validation.normalizedMimeType || !validation.normalizedFileName) {
    throw new Error(validation.errorMessage || 'Ảnh đại diện không hợp lệ.');
  }
  if (typeof FormDataCtor !== 'function') {
    throw new Error('Môi trường hiện tại không hỗ trợ tạo FormData tải ảnh.');
  }

  const formData = new FormDataCtor();
  const webFile = candidate.webFile as { size?: number; slice?: unknown } | undefined;
  if (webFile && typeof webFile === 'object' && typeof webFile.slice === 'function') {
    formData.append('file', webFile as any, validation.normalizedFileName);
  } else {
    const nativePart: Record<string, any> = {
      uri: candidate.uri,
      name: validation.normalizedFileName,
      type: validation.normalizedMimeType,
    };
    if (typeof candidate.readBytes === 'function') {
      const readBytesFn = candidate.readBytes;
      // Non-enumerable `bytes()` satisfies Expo SDK 58 `expo/fetch` convertFormDataAsync (`'bytes' in entry`)
      // while keeping enumerable spreads `{ ...nativePart }` clean for classic RN FormData.getParts().
      Object.defineProperty(nativePart, 'bytes', {
        enumerable: false,
        configurable: true,
        value: async (): Promise<Uint8Array> => {
          const raw = await readBytesFn();
          return raw instanceof Uint8Array ? raw : new Uint8Array(raw);
        },
      });
    }
    formData.append('file', nativePart as any);
  }

  return { formData, validation };
}

export function formatOwnFaceEnrollmentStatus(input: {
  accountId?: string | null;
  staffProfile?: StaffProfileSummary | null;
  faceStatus?: StaffFaceStatusResponse | null;
}): OwnFaceEnrollmentStatusDisplay {
  const faceStatus = input.faceStatus;
  const profile = input.staffProfile;
  const avatarUrl =
    (faceStatus?.avatarUrl && faceStatus.avatarUrl.trim()) ||
    (profile?.url && profile.url.trim()) ||
    null;
  const avatarVersion =
    (faceStatus?.avatarVersion && faceStatus.avatarVersion.trim()) ||
    (profile?.faceAvatarVersion && profile.faceAvatarVersion.trim()) ||
    null;
  const rawStatus =
    String(faceStatus?.status || profile?.faceStatus || '')
      .trim()
      .toUpperCase() || (avatarUrl ? 'PENDING' : 'MISSING');
  const enabled = faceStatus ? Boolean(faceStatus.enabled) : true;
  const revTag = avatarVersion ? ` (phiên bản ${avatarVersion.slice(0, 8)})` : '';

  if (faceStatus && !enabled) {
    return {
      rawStatus,
      badgeLabel: 'Dịch vụ chưa bật',
      tone: 'warning',
      enabled: false,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: false,
      needsAdminReview: rawStatus === 'PENDING',
      description:
        'Dịch vụ nhận diện khuôn mặt hiện đang tắt trên máy chủ (FACE_ENABLED=false). Ảnh đại diện đã lưu nhưng chưa thể tạo đơn giao hàng bằng khuôn mặt.',
      adminReviewGuidance:
        rawStatus === 'PENDING'
          ? `Nhờ quản trị viên duyệt ảnh khuôn mặt${revTag} và bật dịch vụ FACE_ENABLED trên máy chủ.`
          : 'Liên hệ quản trị viên để kích hoạt dịch vụ xác thực khuôn mặt trên máy chủ.',
    };
  }

  if (rawStatus === 'READY') {
    const beConfirmed = Boolean(faceStatus && enabled && avatarUrl && avatarVersion);
    if (!avatarUrl || !avatarVersion) {
      return {
        rawStatus,
        badgeLabel: 'Chưa có ảnh',
        tone: 'warning',
        enabled,
        avatarUrl,
        avatarVersion,
        isReadyForFaceDelivery: false,
        needsAdminReview: false,
        description:
          'Hồ sơ báo trạng thái READY nhưng thiếu URL ảnh hoặc avatarVersion. Vui lòng cập nhật ảnh và làm mới.',
        adminReviewGuidance:
          'Tải lên ảnh rõ 1 khuôn mặt (<= 2 MiB), sau đó nhờ quản trị viên duyệt ảnh khuôn mặt.',
      };
    }

    return {
      rawStatus,
      badgeLabel: beConfirmed ? 'Sẵn sàng' : 'Đang xác minh',
      tone: beConfirmed ? 'ready' : 'pending',
      enabled,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: beConfirmed,
      needsAdminReview: !beConfirmed,
      description: beConfirmed
        ? `Ảnh đại diện${revTag} đã được Admin duyệt và tạo mẫu sinh trắc học thành công trên máy chủ. Bạn có thể nhận đơn giao hàng xác thực khuôn mặt (người giao dùng mã QR).`
        : `Đang đồng bộ trạng thái sẵn sàng từ máy chủ${revTag}. Bấm Làm mới trạng thái để xác nhận.`,
      adminReviewGuidance:
        'Nếu bạn đổi ảnh đại diện mới, mẫu cũ sẽ tự động hủy và cần quản trị viên duyệt lại phiên bản mới.',
    };
  }

  if (rawStatus === 'PENDING') {
    return {
      rawStatus,
      badgeLabel: 'Chờ duyệt',
      tone: 'pending',
      enabled,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: false,
      needsAdminReview: true,
      description: `Đã lưu ảnh đại diện${revTag}. Ảnh chưa thể dùng để mở khóa Robot cho đến khi Admin duyệt đúng phiên bản này.`,
      adminReviewGuidance: `Nhờ quản trị viên duyệt ảnh khuôn mặt cho phiên bản ${avatarVersion || 'hiện tại'} trên Web Admin (chỉ tài khoản ADMIN được phép gọi face-review).`,
    };
  }

  if (rawStatus === 'INVALID') {
    return {
      rawStatus,
      badgeLabel: 'Ảnh không đạt',
      tone: 'danger',
      enabled,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: false,
      needsAdminReview: false,
      description: `Ảnh đại diện${revTag} không đạt yêu cầu của hệ thống AI (ảnh mờ, thiếu sáng, quá 2 MiB hoặc không có đúng 1 khuôn mặt rõ nét).`,
      adminReviewGuidance:
        'Vui lòng chụp hoặc chọn lại ảnh khác có đúng 1 khuôn mặt nhìn thẳng, đủ sáng rồi tải lên để Admin duyệt lại.',
    };
  }

  if (rawStatus === 'REJECTED') {
    return {
      rawStatus,
      badgeLabel: 'Bị từ chối',
      tone: 'danger',
      enabled,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: false,
      needsAdminReview: false,
      description: `Quản trị viên đã từ chối ảnh đại diện${revTag}.`,
      adminReviewGuidance:
        'Vui lòng cập nhật ảnh khuôn mặt mới rõ nét và nhờ quản trị viên duyệt ảnh khuôn mặt.',
    };
  }

  if (rawStatus === 'MISSING' || !avatarUrl) {
    return {
      rawStatus: 'MISSING',
      badgeLabel: 'Chưa có ảnh',
      tone: 'muted',
      enabled,
      avatarUrl,
      avatarVersion,
      isReadyForFaceDelivery: false,
      needsAdminReview: false,
      description:
        'Tài khoản chưa có ảnh đại diện để đăng ký xác thực khuôn mặt giao hàng.',
      adminReviewGuidance:
        'Chọn hoặc chụp ảnh khuôn mặt rõ 1 người (JPG/PNG/WebP, <= 2 MiB), tải lên rồi nhờ quản trị viên duyệt.',
    };
  }

  return {
    rawStatus,
    badgeLabel: `Trạng thái: ${rawStatus}`,
    tone: 'warning',
    enabled,
    avatarUrl,
    avatarVersion,
    isReadyForFaceDelivery: false,
    needsAdminReview: false,
    description: `Trạng thái khuôn mặt hiện tại trên BE là ${rawStatus}${revTag}.`,
    adminReviewGuidance: 'Làm mới trạng thái hoặc liên hệ quản trị viên để kiểm tra.',
  };
}

export async function executeStaffAvatarUpload(params: {
  candidate?: SelectedAvatarCandidate | null;
  previousProfile?: StaffProfileSummary | null;
  inFlightLock: { current: boolean };
  uploadAvatar: (formData: FormData) => Promise<StaffMeResponse>;
  refreshStaffMe: () => Promise<StaffMeResponse | null>;
  fetchFaceStatus: (accountId: string) => Promise<StaffFaceStatusResponse | null>;
  isCurrentScope: () => boolean;
  FormDataCtor?: typeof FormData;
}): Promise<AvatarUploadOutcome> {
  if (params.inFlightLock.current) {
    return {
      ok: false,
      kind: 'IN_FLIGHT',
      message: 'Đang tải ảnh lên máy chủ, vui lòng đợi hoàn tất.',
    };
  }

  let built: { formData: FormData; validation: AvatarValidationResult };
  try {
    built = buildAvatarUploadFormData(
      params.candidate as SelectedAvatarCandidate,
      params.FormDataCtor
    );
  } catch (validationErr: any) {
    return {
      ok: false,
      kind: 'VALIDATION_ERROR',
      message: validationErr?.message || 'Ảnh đại diện không hợp lệ.',
    };
  }

  params.inFlightLock.current = true;
  try {
    let uploadedMe: StaffMeResponse | null = null;
    try {
      uploadedMe = await params.uploadAvatar(built.formData);
    } catch (uploadErr: any) {
      if (!params.isCurrentScope()) {
        return {
          ok: false,
          kind: 'STALE_SCOPE',
          ignored: true,
          message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi tải ảnh cũ.',
        };
      }

      if (uploadErr?.code === 'CLIENT_REQUEST_ERROR') {
        return {
          ok: false,
          kind: 'VALIDATION_ERROR',
          message:
            uploadErr.message ||
            'Không thể đọc hoặc đóng gói tệp ảnh trên thiết bị. Vui lòng chọn hoặc chụp lại ảnh.',
        };
      }

      const status = typeof uploadErr?.status === 'number' ? uploadErr.status : 0;
      const mayHaveCommittedOnServer = status === 0 || status === 408 || status >= 500;

      if (mayHaveCommittedOnServer) {
        const refreshed = await params.refreshStaffMe().catch(() => null);
        if (!params.isCurrentScope()) {
          return {
            ok: false,
            kind: 'STALE_SCOPE',
            ignored: true,
            message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi cũ.',
          };
        }

        const prevUrl = params.previousProfile?.url || null;
        const prevVer = params.previousProfile?.faceAvatarVersion || null;
        const nextUrl = refreshed?.staffProfile?.url || null;
        const nextVer = refreshed?.staffProfile?.faceAvatarVersion || null;
        const profileUpdated =
          Boolean(nextUrl) &&
          ((nextVer && nextVer !== prevVer) || (nextUrl !== prevUrl));

        if (refreshed && profileUpdated) {
          const accId = refreshed.account?.accountId || '';
          const refreshedFaceStatus = UUID_PATTERN.test(accId)
            ? await params.fetchFaceStatus(accId).catch(() => null)
            : null;
          if (!params.isCurrentScope()) {
            return {
              ok: false,
              kind: 'STALE_SCOPE',
              ignored: true,
              message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi cũ.',
            };
          }
          const display = formatOwnFaceEnrollmentStatus({
            accountId: accId,
            staffProfile: refreshed.staffProfile,
            faceStatus: refreshedFaceStatus,
          });
          return {
            ok: true,
            kind: 'UPLOADED',
            recoveredFromLostResponse: true,
            staffMe: refreshed,
            faceStatus: refreshedFaceStatus,
            statusDisplay: display,
            message:
              'Máy chủ đã lưu ảnh đại diện mới dù mất phản hồi lúc tải lên. Đã đồng bộ lại trạng thái mới nhất.',
          };
        }

        const kind: AvatarUploadOutcomeKind =
          status === 408 ? 'TIMEOUT' : status === 0 ? 'NETWORK_ERROR' : 'SERVER_ERROR';
        return {
          ok: false,
          kind,
          refreshedProfile: refreshed,
          message:
            (uploadErr?.message ||
              (kind === 'TIMEOUT'
                ? 'Hết thời gian chờ khi tải ảnh lên.'
                : 'Mất kết nối mạng khi tải ảnh lên.')) +
            ' Đã kiểm tra lại hồ sơ hiện tại, vui lòng bấm Tải ảnh lên để thử lại.',
        };
      }

      if (status === 401 || status === 403) {
        return {
          ok: false,
          kind: 'FORBIDDEN',
          message:
            status === 401
              ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại bằng tài khoản Staff.'
              : uploadErr?.message || 'Chỉ tài khoản Staff đang hoạt động mới được cập nhật ảnh đại diện.',
        };
      }

      return {
        ok: false,
        kind: 'SERVER_ERROR',
        message: uploadErr?.message || 'Máy chủ từ chối tệp ảnh này. Vui lòng chọn ảnh khác.',
      };
    }

    if (!params.isCurrentScope()) {
      return {
        ok: false,
        kind: 'STALE_SCOPE',
        ignored: true,
        message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi tải ảnh cũ.',
      };
    }

    const refreshed = (await params.refreshStaffMe().catch(() => null)) || uploadedMe;
    if (!params.isCurrentScope()) {
      return {
        ok: false,
        kind: 'STALE_SCOPE',
        ignored: true,
        message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi cũ.',
      };
    }

    const accountId = refreshed?.account?.accountId || uploadedMe?.account?.accountId || '';
    const faceStatus = UUID_PATTERN.test(accountId)
      ? await params.fetchFaceStatus(accountId).catch(() => null)
      : null;

    if (!params.isCurrentScope()) {
      return {
        ok: false,
        kind: 'STALE_SCOPE',
        ignored: true,
        message: 'Tài khoản hoặc máy chủ đã thay đổi. Đã bỏ qua phản hồi cũ.',
      };
    }

    const statusDisplay = formatOwnFaceEnrollmentStatus({
      accountId,
      staffProfile: refreshed?.staffProfile,
      faceStatus,
    });

    return {
      ok: true,
      kind: 'UPLOADED',
      recoveredFromLostResponse: false,
      staffMe: refreshed,
      faceStatus,
      statusDisplay,
      message: statusDisplay.isReadyForFaceDelivery
        ? 'Đã tải ảnh lên và ảnh đã sẵn sàng xác thực khuôn mặt.'
        : 'Tải ảnh đại diện thành công. Nhờ quản trị viên duyệt ảnh khuôn mặt trước khi dùng giao hàng Face.',
    };
  } finally {
    params.inFlightLock.current = false;
  }
}
