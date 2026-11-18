import {
  MapPresentationPublishedResponse,
  MapResponse,
  SosResponseRouteEndpoint,
  SosResponseRoutePoint,
  SosResponseRouteResponse,
  SosRobotApproach,
} from '../../api/types';

export interface SosRouteMeterPoint {
  x: number;
  y: number;
}

export interface SosRouteNamedMarker extends SosRouteMeterPoint {
  label: string;
  endpointId?: string;
}

export interface SosRenderableApproach {
  endpointId?: string;
  endpointCode?: string;
  endpointName?: string;
  position: SosRouteMeterPoint;
  distanceToPatientCm?: number | null;
}

export interface SosRenderableRoute {
  incidentId: string;
  mapId: string;
  mapAssetHash?: string | null;
  distanceCm: number;
  origin?: SosRouteNamedMarker | null;
  destination: SosRouteNamedMarker;
  points: SosRouteMeterPoint[];
  destinationBasis?: string | null;
  destinationCapturedAt?: string | null;
  patientLocation?: SosRouteNamedMarker | null;
  robotObservationLocation?: SosRouteNamedMarker | null;
  cameraRangeM?: number | null;
  robotApproach?: SosRenderableApproach | null;
  isPreviewOnly?: boolean;
}

export type SosRouteViewState =
  | { kind: 'IDLE' }
  | { kind: 'LOADING'; incidentId: string }
  | {
      kind: 'AVAILABLE';
      incidentId: string;
      route: SosRenderableRoute;
      rawStatus: string;
      reason?: string | null;
    }
  | {
      kind: 'HASH_MISMATCH';
      incidentId: string;
      mapId?: string | null;
      expectedHash: string;
      actualHash?: string | null;
      message: string;
    }
  | {
      kind: 'UNAVAILABLE';
      incidentId: string;
      rawStatus: string;
      reason: string;
      mapId?: string | null;
      fallbackLocations?: SosRenderableRoute | null;
    }
  | {
      kind: 'ERROR';
      incidentId: string;
      message: string;
    };

export interface SosRouteContextScope {
  serverUrl?: string | null;
  accountId?: string | null;
  incidentId: string;
  mapId?: string | null;
}

const POSITIVE_ROUTE_STATUSES = new Set([
  'PREVIEW',
  'AVAILABLE',
  'OK',
  'READY',
  'FOUND',
  'ROUTE_AVAILABLE',
]);

const KNOWN_UNAVAILABLE_STATUSES = new Set([
  'NO_COORDINATES',
  'MISSING_COORDINATES',
  'MAP_MISMATCH',
  'UNWALKABLE',
  'UNREACHABLE',
  'NO_PATH',
  'NO_MONITORING_ROOM',
  'MONITORING_ROOM_MISSING',
  'MONITORING_ROOM_INVALID',
  'MONITORING_ROOM_UNAVAILABLE',
  'DIFFERENT_FLOOR',
  'ORIGIN_ENDPOINT_MISSING_ON_MAP',
  'ORIGIN_POSITION_NOT_FREE',
  'MAP_DATA_UNAVAILABLE',
  'MAP_MISSING',
  'FALL_VIEWPOINT_UNAVAILABLE',
  'SOS_POSITION_MISSING',
  'SOS_POSITION_OUTSIDE_MAP',
  'SOS_POSITION_NOT_FREE',
  'PATIENT_POSITION_OUTSIDE_MAP',
  'PATIENT_POSITION_NOT_FREE',
  'UNAVAILABLE',
  'NOT_FOUND',
  'EMPTY',
]);

export function cmToMetersOnce(cmValue: unknown): number | null {
  if (typeof cmValue !== 'number' || !Number.isFinite(cmValue)) {
    return null;
  }
  return cmValue / 100;
}

export function extractPointMetersFromCm(
  point: SosResponseRoutePoint | null | undefined
): SosRouteMeterPoint | null {
  if (!point) return null;
  // Hỗ trợ cả hợp đồng chuẩn { xCm, yCm } và schema { x, y } nếu Swagger bị trùng tên Point
  const rawXCm = point.xCm ?? point.x;
  const rawYCm = point.yCm ?? point.y;
  const xM = cmToMetersOnce(rawXCm);
  const yM = cmToMetersOnce(rawYCm);
  if (xM === null || yM === null) {
    return null;
  }
  return { x: xM, y: yM };
}

function buildMarkerLabel(
  endpoint: SosResponseRouteEndpoint | null | undefined,
  fallbackLabel: string
): string {
  const candidate =
    endpoint?.label ||
    endpoint?.endpointName ||
    endpoint?.roomName ||
    endpoint?.endpointCode;
  return (candidate || '').trim() || fallbackLabel;
}

export function formatDestinationBasisLabel(basis?: string | null): string {
  switch (String(basis || '').trim().toUpperCase()) {
    case 'PATIENT_RGBD':
      return 'Vị trí người bệnh từ camera độ sâu (RGB-D)';
    case 'PATIENT_RGBD_NEARBY_WALKABLE':
      return 'Ô đi bộ gần vị trí người bệnh (RGB-D)';
    case 'ROBOT_VIEWPOINT':
      return 'Vị trí robot lúc quan sát';
    case 'INCIDENT_POSITION':
      return 'Vị trí sự cố đã ghi nhận';
    default:
      return basis ? String(basis) : 'Vị trí đã ghi nhận';
  }
}

export function resolveActiveMapAssetHash(
  activeMap?: Pick<MapResponse, 'mapId' | 'assetHash'> | null,
  presentation?: Pick<MapPresentationPublishedResponse, 'source'> | null
): string | null {
  const presMapId = presentation?.source?.mapId;
  const presHash =
    presentation && (!activeMap || !presMapId || presMapId === activeMap.mapId)
      ? presentation.source?.assetHash
      : undefined;
  const raw = presHash || activeMap?.assetHash;
  return raw && raw.trim() ? raw.trim() : null;
}

export function defaultReasonForRouteStatus(status: string): string {
  switch (String(status || '').trim().toUpperCase()) {
    case 'MAP_MISSING':
      return 'Sự cố chưa gắn bản đồ hợp lệ.';
    case 'FALL_VIEWPOINT_UNAVAILABLE':
      return 'Chưa có tọa độ RGB-D của người bệnh hoặc vị trí robot hợp lệ tại lúc phát hiện.';
    case 'SOS_POSITION_MISSING':
    case 'NO_COORDINATES':
    case 'MISSING_COORDINATES':
      return 'Sự cố chưa có tọa độ vị trí hoặc phòng trực hợp lệ.';
    case 'MAP_MISMATCH':
      return 'Tọa độ sự cố thuộc phiên bản bản đồ khác với bản đồ hiện tại.';
    case 'MAP_DATA_UNAVAILABLE':
      return 'Bản đồ chưa có dữ liệu lưới đường đi để tính tuyến SOS.';
    case 'DIFFERENT_FLOOR':
      return 'Phòng trực SOS và vị trí sự cố đang nằm ở hai tầng khác nhau.';
    case 'ORIGIN_ENDPOINT_MISSING_ON_MAP':
      return 'Phòng trực SOS chưa có điểm dừng (endpoint) trên bản đồ hiện tại.';
    case 'ORIGIN_POSITION_NOT_FREE':
      return 'Điểm xuất phát của phòng trực SOS đang bị vật cản che chắn trên bản đồ.';
    case 'PATIENT_POSITION_OUTSIDE_MAP':
    case 'SOS_POSITION_OUTSIDE_MAP':
      return 'Tọa độ ghi nhận nằm ngoài phạm vi bản đồ hiện tại.';
    case 'PATIENT_POSITION_NOT_FREE':
    case 'SOS_POSITION_NOT_FREE':
    case 'UNWALKABLE':
      return 'Điểm đích nằm trên vùng vật cản hoặc không thể đi bộ.';
    case 'UNREACHABLE':
    case 'NO_PATH':
      return 'Không tìm thấy đường đi bộ hợp lệ trên lưới bản đồ.';
    case 'MONITORING_ROOM_MISSING':
    case 'MONITORING_ROOM_INVALID':
    case 'NO_MONITORING_ROOM':
      return 'Chưa cấu hình phòng trực SOS hợp lệ trên máy chủ.';
    case 'MONITORING_ROOM_UNAVAILABLE':
      return 'Phòng trực SOS đang tạm ngừng hoạt động.';
    default:
      return 'Máy chủ chưa cung cấp tuyến đi bộ cho sự cố này.';
  }
}

function parseApproach(approach?: SosRobotApproach | null): SosRenderableApproach | null {
  if (!approach) return null;
  const position = extractPointMetersFromCm(approach.position);
  if (!position) return null;
  return {
    endpointId: approach.endpointId,
    endpointCode: approach.endpointCode,
    endpointName: approach.endpointName,
    position,
    distanceToPatientCm:
      typeof approach.distanceToPatientCm === 'number' && Number.isFinite(approach.distanceToPatientCm)
        ? approach.distanceToPatientCm
        : null,
  };
}

function extractFallMetadataMarkers(response: SosResponseRouteResponse): {
  patientMarker: SosRouteNamedMarker | null;
  observationMarker: SosRouteNamedMarker | null;
  cameraRangeM: number | null;
  approach: SosRenderableApproach | null;
} {
  const patientMeters = extractPointMetersFromCm(response.patientLocation);
  const observationMeters = extractPointMetersFromCm(response.robotObservationLocation);
  const patientMarker: SosRouteNamedMarker | null = patientMeters
    ? { ...patientMeters, label: 'Vị trí người té ngã' }
    : null;
  const observationMarker: SosRouteNamedMarker | null = observationMeters
    ? { ...observationMeters, label: 'Robot lúc quan sát' }
    : null;
  const cameraRangeM =
    typeof response.cameraRangeM === 'number' && Number.isFinite(response.cameraRangeM)
      ? response.cameraRangeM
      : null;
  const approach = parseApproach(response.robotApproach);
  return { patientMarker, observationMarker, cameraRangeM, approach };
}

function buildFallbackLocations(
  incidentId: string,
  response: SosResponseRouteResponse
): SosRenderableRoute | null {
  const unit = (response.unit || 'cm').trim().toLowerCase();
  if (unit !== 'cm') return null;

  const { patientMarker, observationMarker, cameraRangeM, approach } =
    extractFallMetadataMarkers(response);
  const destMeters = extractPointMetersFromCm(response.destination);
  const fallbackDest: SosRouteNamedMarker | null = destMeters
    ? {
        ...destMeters,
        label: buildMarkerLabel(
          response.destination,
          response.destinationBasis === 'ROBOT_VIEWPOINT'
            ? 'Vị trí robot lúc quan sát'
            : 'Vị trí SOS đã ghi nhận'
        ),
        endpointId: response.destination?.endpointId,
      }
    : patientMarker || observationMarker;

  if (!fallbackDest) return null;

  const originMeters = extractPointMetersFromCm(response.origin);
  return {
    incidentId: response.incidentId || incidentId,
    mapId: (response.mapId || '').trim(),
    mapAssetHash: response.mapAssetHash ?? null,
    distanceCm: 0,
    origin: originMeters
      ? {
          ...originMeters,
          label: buildMarkerLabel(response.origin, 'Phòng trực SOS'),
          endpointId: response.origin?.endpointId,
        }
      : null,
    destination: fallbackDest,
    points: [],
    destinationBasis: response.destinationBasis ?? null,
    destinationCapturedAt: response.destinationCapturedAt ?? null,
    patientLocation: patientMarker,
    robotObservationLocation: observationMarker,
    cameraRangeM,
    robotApproach: approach,
    isPreviewOnly: true,
  };
}

export function formatFallLocationSummary(
  response: SosResponseRouteResponse | null | undefined
): string | null {
  if (!response) return null;
  const basisLabel = formatDestinationBasisLabel(response.destinationBasis);
  const parts: string[] = [basisLabel];
  if (typeof response.cameraRangeM === 'number' && Number.isFinite(response.cameraRangeM)) {
    parts.push(`Độ sâu camera: ${response.cameraRangeM.toFixed(2)} m`);
  }
  if (response.destinationCapturedAt) {
    const parsedTime = new Date(response.destinationCapturedAt);
    if (!Number.isNaN(parsedTime.getTime())) {
      parts.push(
        `Ghi nhận: ${parsedTime.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })}`
      );
    }
  }
  const hasPatient = Boolean(extractPointMetersFromCm(response.patientLocation));
  const hasObs = Boolean(extractPointMetersFromCm(response.robotObservationLocation));
  if (hasPatient && hasObs) {
    parts.push('Có đủ ghim người bệnh & robot quan sát');
  } else if (!hasPatient && hasObs) {
    parts.push('Chỉ có vị trí robot lúc quan sát');
  } else if (!hasPatient && !hasObs && !extractPointMetersFromCm(response.destination)) {
    return response.reason
      ? `Chưa có vị trí trên bản đồ (${defaultReasonForRouteStatus(response.reason)})`
      : 'Chưa có tọa độ vị trí nghi té ngã trên bản đồ';
  }
  return parts.join(' · ');
}

export function parseSosResponseRoute(
  incidentId: string,
  response: SosResponseRouteResponse | null | undefined
): {
  status: string;
  reason?: string | null;
  mapId?: string | null;
  mapAssetHash?: string | null;
  route: SosRenderableRoute | null;
  fallbackLocations?: SosRenderableRoute | null;
} {
  if (!response) {
    return {
      status: 'UNAVAILABLE',
      reason: 'Không nhận được dữ liệu tuyến SOS từ máy chủ.',
      route: null,
      fallbackLocations: null,
    };
  }

  const normalizedStatus = String(response.status || 'UNAVAILABLE')
    .trim()
    .toUpperCase();
  const reasonCode = (response.reason || '').trim();

  if (KNOWN_UNAVAILABLE_STATUSES.has(normalizedStatus) || !POSITIVE_ROUTE_STATUSES.has(normalizedStatus)) {
    return {
      status: normalizedStatus || 'UNAVAILABLE',
      reason: defaultReasonForRouteStatus(reasonCode || normalizedStatus),
      mapId: response.mapId ?? null,
      mapAssetHash: response.mapAssetHash ?? null,
      route: null,
      fallbackLocations: buildFallbackLocations(incidentId, response),
    };
  }

  const unit = (response.unit || 'cm').trim().toLowerCase();
  if (unit !== 'cm') {
    return {
      status: 'INVALID_UNIT',
      reason: `Đơn vị tọa độ không hợp lệ (${response.unit}); hệ thống yêu cầu cm.`,
      mapId: response.mapId ?? null,
      mapAssetHash: response.mapAssetHash ?? null,
      route: null,
      fallbackLocations: null,
    };
  }

  const { patientMarker, observationMarker, cameraRangeM, approach } =
    extractFallMetadataMarkers(response);
  const originMetersPre = extractPointMetersFromCm(response.origin);
  const destinationMetersPre = extractPointMetersFromCm(response.destination);
  const distanceCmPre =
    typeof response.distanceCm === 'number' && Number.isFinite(response.distanceCm)
      ? Math.max(0, response.distanceCm)
      : 0;

  if (normalizedStatus === 'PREVIEW') {
    const previewDest: SosRouteNamedMarker | null = destinationMetersPre
      ? {
          ...destinationMetersPre,
          label: buildMarkerLabel(
            response.destination,
            response.destinationBasis === 'ROBOT_VIEWPOINT'
              ? 'Vị trí robot lúc quan sát'
              : 'Vị trí nghi té ngã'
          ),
          endpointId: response.destination?.endpointId,
        }
      : patientMarker || observationMarker;

    if (!previewDest) {
      return {
        status: 'UNAVAILABLE',
        reason: defaultReasonForRouteStatus(reasonCode || 'FALL_VIEWPOINT_UNAVAILABLE'),
        mapId: response.mapId ?? null,
        mapAssetHash: response.mapAssetHash ?? null,
        route: null,
        fallbackLocations: null,
      };
    }

    return {
      status: 'PREVIEW',
      reason: response.reason ?? null,
      mapId: response.mapId ?? null,
      mapAssetHash: response.mapAssetHash ?? null,
      route: {
        incidentId: response.incidentId || incidentId,
        mapId: (response.mapId || '').trim(),
        mapAssetHash: response.mapAssetHash ?? null,
        distanceCm: 0,
        origin: originMetersPre
          ? {
              ...originMetersPre,
              label: buildMarkerLabel(response.origin, 'Phòng trực SOS'),
              endpointId: response.origin?.endpointId,
            }
          : null,
        destination: previewDest,
        points: [],
        destinationBasis: response.destinationBasis ?? null,
        destinationCapturedAt: response.destinationCapturedAt ?? null,
        patientLocation: patientMarker,
        robotObservationLocation: observationMarker,
        cameraRangeM,
        robotApproach: approach,
        isPreviewOnly: true,
      },
      fallbackLocations: null,
    };
  }

  const rawPoints = Array.isArray(response.points) ? response.points : [];
  const convertedPoints: SosRouteMeterPoint[] = [];

  if (rawPoints.length === 0) {
    // Chỉ chấp nhận không có điểm trung gian nếu origin === destination và quãng đường = 0 cm
    if (
      distanceCmPre === 0 &&
      originMetersPre &&
      destinationMetersPre &&
      originMetersPre.x === destinationMetersPre.x &&
      originMetersPre.y === destinationMetersPre.y
    ) {
      convertedPoints.push(originMetersPre);
    } else {
      // Tuyệt đối không vẽ đường thẳng thay thế khi danh sách điểm rỗng
      return {
        status: normalizedStatus,
        reason: response.reason ? defaultReasonForRouteStatus(response.reason) : 'Máy chủ chưa trả về các điểm tuyến đi bộ.',
        mapId: response.mapId ?? null,
        mapAssetHash: response.mapAssetHash ?? null,
        route: null,
        fallbackLocations: buildFallbackLocations(incidentId, response),
      };
    }
  } else {
    for (const pt of rawPoints) {
      const converted = extractPointMetersFromCm(pt);
      if (!converted) {
        return {
          status: 'INVALID_POINTS',
          reason: response.reason || 'Tọa độ tuyến từ máy chủ chứa giá trị không hợp lệ.',
          mapId: response.mapId ?? null,
          mapAssetHash: response.mapAssetHash ?? null,
          route: null,
          fallbackLocations: buildFallbackLocations(incidentId, response),
        };
      }
      convertedPoints.push(converted);
    }
  }

  const originMeters = originMetersPre ?? convertedPoints[0];
  const destinationMeters =
    destinationMetersPre ?? convertedPoints[convertedPoints.length - 1];

  return {
    status: normalizedStatus,
    reason: response.reason ?? null,
    mapId: response.mapId ?? null,
    mapAssetHash: response.mapAssetHash ?? null,
    route: {
      incidentId: response.incidentId || incidentId,
      mapId: (response.mapId || '').trim(),
      mapAssetHash: response.mapAssetHash ?? null,
      distanceCm: distanceCmPre,
      origin: {
        ...originMeters,
        label: buildMarkerLabel(response.origin, 'Phòng trực SOS'),
        endpointId: response.origin?.endpointId,
      },
      destination: {
        ...destinationMeters,
        label: buildMarkerLabel(
          response.destination,
          response.destinationBasis === 'ROBOT_VIEWPOINT'
            ? 'Vị trí robot lúc quan sát'
            : 'Vị trí SOS đã ghi nhận'
        ),
        endpointId: response.destination?.endpointId,
      },
      points: convertedPoints,
      destinationBasis: response.destinationBasis ?? null,
      destinationCapturedAt: response.destinationCapturedAt ?? null,
      patientLocation: patientMarker,
      robotObservationLocation: observationMarker,
      cameraRangeM,
      robotApproach: approach,
      isPreviewOnly: false,
    },
    fallbackLocations: null,
  };
}

export function evaluateSosRouteAgainstMap(params: {
  incidentId: string;
  response: SosResponseRouteResponse;
  activeMap?: Pick<MapResponse, 'mapId' | 'assetHash'> | null;
  presentation?: Pick<MapPresentationPublishedResponse, 'source'> | null;
}): SosRouteViewState {
  const { incidentId, response, activeMap, presentation } = params;
  const parsed = parseSosResponseRoute(incidentId, response);

  if (!parsed.route) {
    const fb = parsed.fallbackLocations || null;
    const expectedFbHash = (fb?.mapAssetHash || '').trim();
    const actualHash = resolveActiveMapAssetHash(activeMap, presentation);
    const fbMatchesMap =
      Boolean(fb) &&
      (!fb?.mapId || (activeMap && activeMap.mapId === fb.mapId)) &&
      (!expectedFbHash || expectedFbHash === actualHash);

    return {
      kind: 'UNAVAILABLE',
      incidentId,
      rawStatus: parsed.status,
      reason: parsed.reason || defaultReasonForRouteStatus(parsed.status),
      mapId: parsed.mapId ?? null,
      fallbackLocations: fbMatchesMap ? fb : null,
    };
  }

  const routeMapId = parsed.route.mapId;
  if (routeMapId && (!activeMap || activeMap.mapId !== routeMapId)) {
    return {
      kind: 'HASH_MISMATCH',
      incidentId,
      mapId: routeMapId,
      expectedHash: parsed.route.mapAssetHash || '',
      actualHash: activeMap?.assetHash ?? null,
      message: 'Đang chuyển sang đúng bản đồ của sự cố SOS...',
    };
  }

  const expectedHash = (parsed.route.mapAssetHash || '').trim();
  const actualHash = resolveActiveMapAssetHash(activeMap, presentation);

  if (expectedHash && expectedHash !== actualHash) {
    return {
      kind: 'HASH_MISMATCH',
      incidentId,
      mapId: routeMapId || activeMap?.mapId || null,
      expectedHash,
      actualHash,
      message: 'Phiên bản bản đồ đã thay đổi, cần làm mới ảnh bản đồ trước khi vẽ tuyến.',
    };
  }

  return {
    kind: 'AVAILABLE',
    incidentId,
    route: parsed.route,
    rawStatus: parsed.status,
    reason: parsed.reason,
  };
}

export function formatDistanceFromCm(distanceCm: number): string {
  if (!Number.isFinite(distanceCm) || distanceCm <= 0) {
    return '0 cm (0 m)';
  }
  const roundedCm = Math.round(distanceCm);
  const meters = distanceCm / 100;
  return `${roundedCm} cm (~${meters.toFixed(1)} m)`;
}

export function buildSosRouteContextKey(scope: SosRouteContextScope): string {
  return [
    (scope.serverUrl || '').trim() || 'default-server',
    (scope.accountId || '').trim() || 'anonymous',
    (scope.incidentId || '').trim(),
    (scope.mapId || '').trim() || 'any-map',
  ].join('::');
}

export interface SosRouteRequestToken {
  seq: number;
  contextKey: string;
}

/**
 * Đảm bảo chỉ phản hồi mới nhất khớp (server, tài khoản, sự cố, map) được áp dụng vào UI.
 */
export class SosRouteRequestGuard {
  private latestSeq = 0;
  private activeContextKey = '';

  begin(scope: SosRouteContextScope): SosRouteRequestToken {
    this.latestSeq += 1;
    const contextKey = buildSosRouteContextKey(scope);
    this.activeContextKey = contextKey;
    return { seq: this.latestSeq, contextKey };
  }

  invalidate(): void {
    this.latestSeq += 1;
    this.activeContextKey = '';
  }

  isCurrent(token: SosRouteRequestToken, currentScope?: SosRouteContextScope): boolean {
    if (token.seq !== this.latestSeq) return false;
    if (token.contextKey !== this.activeContextKey) return false;
    if (currentScope) {
      return buildSosRouteContextKey(currentScope) === token.contextKey;
    }
    return true;
  }
}
