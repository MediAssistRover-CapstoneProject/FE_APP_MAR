import {
  MapPresentationPublishedResponse,
  MapResponse,
  SosResponseRouteEndpoint,
  SosResponseRoutePoint,
  SosResponseRouteResponse,
} from '../../api/types';

export interface SosRouteMeterPoint {
  x: number;
  y: number;
}

export interface SosRouteNamedMarker extends SosRouteMeterPoint {
  label: string;
  endpointId?: string;
}

export interface SosRenderableRoute {
  incidentId: string;
  mapId: string;
  mapAssetHash?: string | null;
  distanceCm: number;
  origin: SosRouteNamedMarker;
  destination: SosRouteNamedMarker;
  points: SosRouteMeterPoint[];
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
  switch (status) {
    case 'NO_COORDINATES':
    case 'MISSING_COORDINATES':
      return 'Sự cố chưa có tọa độ SOS hoặc phòng trực hợp lệ.';
    case 'MAP_MISMATCH':
      return 'Tọa độ sự cố thuộc phiên bản bản đồ khác với bản đồ hiện tại.';
    case 'UNWALKABLE':
      return 'Điểm xuất phát hoặc điểm SOS nằm trên vùng không thể đi bộ.';
    case 'UNREACHABLE':
    case 'NO_PATH':
      return 'Không tìm thấy đường đi bộ hợp lệ trên lưới bản đồ.';
    case 'NO_MONITORING_ROOM':
      return 'Chưa cấu hình phòng trực SOS hoạt động cho ca hiện tại.';
    default:
      return 'Máy chủ chưa cung cấp tuyến đi bộ cho sự cố SOS này.';
  }
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
} {
  if (!response) {
    return {
      status: 'UNAVAILABLE',
      reason: 'Không nhận được dữ liệu tuyến SOS từ máy chủ.',
      route: null,
    };
  }

  const normalizedStatus = String(response.status || 'UNAVAILABLE')
    .trim()
    .toUpperCase();

  if (KNOWN_UNAVAILABLE_STATUSES.has(normalizedStatus) || !POSITIVE_ROUTE_STATUSES.has(normalizedStatus)) {
    return {
      status: normalizedStatus || 'UNAVAILABLE',
      reason: response.reason || defaultReasonForRouteStatus(normalizedStatus),
      mapId: response.mapId ?? null,
      mapAssetHash: response.mapAssetHash ?? null,
      route: null,
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
    };
  }

  const originMetersPre = extractPointMetersFromCm(response.origin);
  const destinationMetersPre = extractPointMetersFromCm(response.destination);
  const distanceCmPre =
    typeof response.distanceCm === 'number' && Number.isFinite(response.distanceCm)
      ? Math.max(0, response.distanceCm)
      : 0;

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
        reason: response.reason || 'Máy chủ chưa trả về các điểm tuyến đi bộ.',
        mapId: response.mapId ?? null,
        mapAssetHash: response.mapAssetHash ?? null,
        route: null,
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
        };
      }
      convertedPoints.push(converted);
    }
  }

  const originMeters = originMetersPre ?? convertedPoints[0];
  const destinationMeters =
    destinationMetersPre ?? convertedPoints[convertedPoints.length - 1];

  const distanceCm = distanceCmPre;

  return {
    status: normalizedStatus,
    reason: response.reason ?? null,
    mapId: response.mapId ?? null,
    mapAssetHash: response.mapAssetHash ?? null,
    route: {
      incidentId: response.incidentId || incidentId,
      mapId: (response.mapId || '').trim(),
      mapAssetHash: response.mapAssetHash ?? null,
      distanceCm,
      origin: {
        ...originMeters,
        label: buildMarkerLabel(response.origin, 'Phòng trực SOS'),
        endpointId: response.origin?.endpointId,
      },
      destination: {
        ...destinationMeters,
        label: buildMarkerLabel(response.destination, 'Vị trí SOS đã ghi nhận'),
        endpointId: response.destination?.endpointId,
      },
      points: convertedPoints,
    },
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
    return {
      kind: 'UNAVAILABLE',
      incidentId,
      rawStatus: parsed.status,
      reason: parsed.reason || defaultReasonForRouteStatus(parsed.status),
      mapId: parsed.mapId ?? null,
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
