import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Pattern,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { Layers, Lock } from 'lucide-react-native';
import { API_CONFIG } from '../../api/config';
import { EndpointResponse, MapResponse, ZoneDto } from '../../api/types';

export interface MapRobotPose {
  robotId?: string;
  mapId?: string;
  xM: number;
  yM: number;
  yawRad: number;
  fresh?: boolean;
  capturedAt?: string;
  localizationConfidence?: number;
}

export interface MapPlanPoint {
  xM: number;
  yM: number;
}

interface BackendHospitalMapProps {
  map: MapResponse;
  metadata?: Record<string, any> | null;
  endpoints: EndpointResponse[];
  zones: ZoneDto[];
  token: string | null;
  selectedEndpointId?: string | null;
  onSelectEndpoint: (endpoint: EndpointResponse) => void;
  robotPose?: MapRobotPose | null;
  isPoseLive?: boolean;
  plannedPath?: MapPlanPoint[] | null;
}

interface MapPoint {
  x: number;
  y: number;
}

type MapFilterMode = 'otto_cad' | 'otto_dark' | 'raw';

/**
 * Góc xoay cố định (-20 độ) giúp bản đồ SLAM ở trường (final o truong)
 * hiển thị ngay ngắn theo phương ngang/dọc ngay khi vào màn hình mà không cần Staff tự chỉnh.
 */
const getFixedMapRotationDeg = (map: MapResponse): number => {
  const name = (map.mapName || '').toLowerCase();
  const code = (map.mapCode || '').toLowerCase();
  if (
    map.mapId === 'e571fe71-d3ea-4aa5-a673-ffd857ac9f09' ||
    name.includes('final') ||
    name.includes('truong') ||
    code.includes('c91abd2e7ba64992a843d5bcb5e40540')
  ) {
    return -20;
  }
  return -20;
};

/**
 * Phép biến đổi góc nhìn (viewTransform) kết hợp phóng to (crop sát viền tường sau khi xoay -20°)
 * để lấp đầy khung hiển thị, loại bỏ các mảng xám/khoảng trống thừa ở 4 góc ảnh SLAM gốc,
 * đồng thời giữ 100% độ chính xác tọa độ của Endpoint, Zone và Robot.
 */
const createViewTransform = (width: number, height: number, degrees: number) => {
  const radians = ((Number.isFinite(degrees) ? degrees : 0) * Math.PI) / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);

  const cropScaleX = degrees !== 0 ? 0.86 : 1;
  const cropScaleY = degrees !== 0 ? 0.74 : 1;
  const w = Math.max(1, width * cropScaleX);
  const h = Math.max(1, height * cropScaleY);

  return {
    width: w,
    height: h,
    radians,
    degrees,
    forward(u: number, v: number) {
      const x = u - width / 2;
      const y = v - height / 2;
      return {
        u: c * x - s * y + w / 2,
        v: s * x + c * y + h / 2,
      };
    },
  };
};

const readPoint = (value: any): MapPoint | null => {
  if (Array.isArray(value) && value.length >= 2) {
    const x = Number(value[0]);
    const y = Number(value[1]);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  if (value && typeof value === 'object') {
    const x = Number(value.xM ?? value.x_m ?? value.x ?? value.lng);
    const y = Number(value.yM ?? value.y_m ?? value.y ?? value.lat);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  }

  return null;
};

const readPolygon = (polygonJson: unknown): MapPoint[] => {
  if (!polygonJson) return [];

  let value: any = polygonJson;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }

  const candidates =
    value?.type === 'Polygon'
      ? value.coordinates?.[0]
      : value?.points ?? value?.vertices ?? value?.coordinates ?? value;

  if (!Array.isArray(candidates)) return [];
  return candidates.map(readPoint).filter((point): point is MapPoint => point !== null);
};

export const BackendHospitalMap: React.FC<BackendHospitalMapProps> = ({
  map,
  metadata,
  endpoints,
  zones,
  token,
  selectedEndpointId,
  onSelectEndpoint,
  robotPose,
  isPoseLive = false,
  plannedPath,
}) => {
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [filterMode, setFilterMode] = useState<MapFilterMode>('otto_cad');

  const imageUrl = `${API_CONFIG.BASE_URL}/maps/${map.mapId}/image.png`;
  const fixedRotationDeg = useMemo(() => getFixedMapRotationDeg(map), [map]);

  useEffect(() => {
    setIsLoadingImage(true);
    setImageFailed(false);
    setNaturalSize(null);

    if (imageUrl && typeof Image.getSizeWithHeaders === 'function') {
      Image.getSizeWithHeaders(
        imageUrl,
        token ? { Authorization: `Bearer ${token}` } : {},
        (width, height) => {
          if (width > 0 && height > 0) {
            setNaturalSize({ width, height });
          }
        },
        () => {
          // Fallback to metadata or onLoad
        }
      );
    }
  }, [imageUrl, map.mapId, token]);

  const geometry = useMemo(() => {
    const resolution = Math.max(
      Number(
        metadata?.resolution ??
          metadata?.resolution_m_per_pixel ??
          metadata?.resolutionMPerPixel ??
          map.resolutionMPerPixel
      ) || 0.05,
      0.000001
    );

    const metaWidthPx = Number(
      metadata?.width_px ?? metadata?.widthPx ?? metadata?.imageWidthPx ?? metadata?.width
    );
    const metaHeightPx = Number(
      metadata?.height_px ?? metadata?.heightPx ?? metadata?.imageHeightPx ?? metadata?.height
    );

    const pixelWidth = Math.max(
      1,
      (metaWidthPx > 0 ? metaWidthPx : 0) ||
        (naturalSize?.width && naturalSize.width > 0 ? naturalSize.width : 0) ||
        (Number(map.widthM) > 0 ? Number(map.widthM) / resolution : 1)
    );
    const pixelHeight = Math.max(
      1,
      (metaHeightPx > 0 ? metaHeightPx : 0) ||
        (naturalSize?.height && naturalSize.height > 0 ? naturalSize.height : 0) ||
        (Number(map.heightM) > 0 ? Number(map.heightM) / resolution : 1)
    );

    const origin = Array.isArray(metadata?.origin) ? metadata.origin : [];
    const originX =
      Number(
        metadata?.origin_x_m ??
          metadata?.originXM ??
          metadata?.originX ??
          origin[0] ??
          map.originXM
      ) || 0;
    const originY =
      Number(
        metadata?.origin_y_m ??
          metadata?.originYM ??
          metadata?.originY ??
          origin[1] ??
          map.originYM
      ) || 0;
    const originYaw =
      Number(
        metadata?.origin_yaw_rad ??
          metadata?.originYawRad ??
          metadata?.originYaw ??
          metadata?.yaw ??
          origin[2] ??
          map.originYawRad
      ) || 0;
    const cos = Math.cos(originYaw);
    const sin = Math.sin(originYaw);

    const view = createViewTransform(pixelWidth, pixelHeight, fixedRotationDeg);

    const toViewPixel = (point: MapPoint) => {
      const dx = point.x - originX;
      const dy = point.y - originY;
      const u = (cos * dx + sin * dy) / resolution;
      const v = pixelHeight - (-sin * dx + cos * dy) / resolution;
      const rotated = view.forward(u, v);
      return {
        x: rotated.u,
        y: rotated.v,
        rawU: u,
        rawV: v,
      };
    };

    const toViewHeadingRad = (yawRad: number) => {
      const safeYaw = Number.isFinite(yawRad) ? yawRad : 0;
      return -(safeYaw - originYaw) + view.radians;
    };

    return {
      pixelWidth,
      pixelHeight,
      resolution,
      originYaw,
      view,
      toViewPixel,
      toViewHeadingRad,
    };
  }, [fixedRotationDeg, map, metadata, naturalSize]);

  const visibleEndpoints = useMemo(
    () =>
      endpoints.filter(
        (endpoint) =>
          endpoint.mapId === map.mapId &&
          endpoint.active !== false &&
          Number.isFinite(Number(endpoint.xM)) &&
          Number.isFinite(Number(endpoint.yM))
      ),
    [endpoints, map.mapId]
  );

  const visibleZones = useMemo(
    () =>
      zones
        .filter((zone) => zone.mapId === map.mapId && zone.active !== false)
        .map((zone) => ({ zone, points: readPolygon(zone.polygonJson) }))
        .filter(({ points }) => points.length >= 3),
    [map.mapId, zones]
  );

  const validPlannedPath = useMemo(() => {
    if (!Array.isArray(plannedPath) || plannedPath.length < 2) return null;
    const pts = plannedPath.filter(
      (p) => Number.isFinite(Number(p.xM)) && Number.isFinite(Number(p.yM))
    );
    return pts.length >= 2 ? pts : null;
  }, [plannedPath]);

  const validRobotPose = useMemo(() => {
    if (!robotPose) return null;
    const xM = Number(robotPose.xM);
    const yM = Number(robotPose.yM);
    if (!Number.isFinite(xM) || !Number.isFinite(yM)) return null;
    if (robotPose.mapId && robotPose.mapId !== map.mapId) return null;
    return {
      ...robotPose,
      xM,
      yM,
      yawRad: Number(robotPose.yawRad) || 0,
    };
  }, [map.mapId, robotPose]);

  const cycleFilterMode = () => {
    setFilterMode((prev) =>
      prev === 'otto_cad' ? 'otto_dark' : prev === 'otto_dark' ? 'raw' : 'otto_cad'
    );
  };

  const viewWidth = geometry.view.width;
  const viewHeight = geometry.view.height;
  const aspectRatio = viewWidth / viewHeight;

  const imageWidthPct = (geometry.pixelWidth / viewWidth) * 100;
  const imageHeightPct = (geometry.pixelHeight / viewHeight) * 100;
  const imageLeftPct = ((viewWidth - geometry.pixelWidth) / (2 * viewWidth)) * 100;
  const imageTopPct = ((viewHeight - geometry.pixelHeight) / (2 * viewHeight)) * 100;

  // Bước lưới 1 mét chuẩn CAD (quy đổi sang đơn vị viewBox)
  const gridStepPx = Math.max(12, 1 / geometry.resolution);

  return (
    <View style={styles.outerWrapper}>
      <View
        style={[
          styles.canvasContainer,
          {
            aspectRatio,
            backgroundColor: filterMode === 'otto_dark' ? '#1E242B' : '#F1F5F9',
          },
        ]}
      >
        <View style={styles.gridBackground} />

        {!imageFailed && (
          <Image
            source={{
              uri: imageUrl,
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              cache: 'reload',
            }}
            resizeMode="stretch"
            style={[
              styles.rotatedMapImage,
              {
                width: `${imageWidthPct}%`,
                height: `${imageHeightPct}%`,
                left: `${imageLeftPct}%`,
                top: `${imageTopPct}%`,
                opacity: filterMode === 'otto_dark' ? 0.88 : 0.96,
                transform: [{ rotate: `${geometry.view.degrees}deg` }],
              },
            ]}
            onLoadStart={() => setIsLoadingImage(true)}
            onLoad={(event) => {
              const src = event.nativeEvent?.source;
              if (src?.width && src?.height) {
                setNaturalSize({ width: src.width, height: src.height });
              }
              setIsLoadingImage(false);
            }}
            onLoadEnd={() => setIsLoadingImage(false)}
            onError={() => {
              setImageFailed(true);
              setIsLoadingImage(false);
            }}
          />
        )}

        {/* Lớp phủ Filter công nghiệp chuẩn OTTO Fleet Manager */}
        {filterMode !== 'raw' && (
          <View
            pointerEvents="none"
            style={[
              styles.fullSize,
              filterMode === 'otto_cad' ? styles.ottoCadTint : styles.ottoDarkTint,
            ]}
          />
        )}

        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
          style={styles.fullSize}
        >
          <Defs>
            {/* Lưới tọa độ kỹ thuật 1m x 1m chuẩn OTTO Fleet Manager */}
            <Pattern
              id="ottoCadGrid"
              width={gridStepPx}
              height={gridStepPx}
              patternUnits="userSpaceOnUse"
            >
              <Line
                x1="0"
                y1="0"
                x2={gridStepPx}
                y2="0"
                stroke={
                  filterMode === 'otto_dark'
                    ? 'rgba(56, 189, 248, 0.14)'
                    : 'rgba(14, 116, 144, 0.11)'
                }
                strokeWidth="0.45"
              />
              <Line
                x1="0"
                y1="0"
                x2="0"
                y2={gridStepPx}
                stroke={
                  filterMode === 'otto_dark'
                    ? 'rgba(56, 189, 248, 0.14)'
                    : 'rgba(14, 116, 144, 0.11)'
                }
                strokeWidth="0.45"
              />
            </Pattern>

            {/* Sọc chéo cảnh báo công nghiệp cho Exclusion Zone (Vùng cấm KEEP_OUT) */}
            <Pattern
              id="ottoHazardStripe"
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <Rect width="6" height="6" fill="rgba(239, 68, 68, 0.18)" />
              <Line
                x1="0"
                y1="0"
                x2="0"
                y2="6"
                stroke="rgba(220, 38, 38, 0.52)"
                strokeWidth="2.2"
              />
            </Pattern>

            {/* Sọc mịn cho Speed Limit Zone (Vùng giảm tốc SPEED) */}
            <Pattern
              id="ottoSpeedPattern"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(-30)"
            >
              <Rect width="5" height="5" fill="rgba(14, 165, 233, 0.18)" />
              <Line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke="rgba(2, 132, 199, 0.36)"
                strokeWidth="1.4"
              />
            </Pattern>
          </Defs>

          {/* 0. Lớp lưới kỹ thuật CAD đè lên mặt sàn */}
          {filterMode !== 'raw' && (
            <Rect
              x="0"
              y="0"
              width={viewWidth}
              height={viewHeight}
              fill="url(#ottoCadGrid)"
            />
          )}

          {/* 1. Vẽ các phân khu Traffic Control (Zones) theo chuẩn OTTO Fleet Manager */}
          {visibleZones.map(({ zone, points }) => {
            const pixelPoints = points.map(geometry.toViewPixel);
            const pointsText = pixelPoints.map((point) => `${point.x},${point.y}`).join(' ');
            const labelX =
              pixelPoints.reduce((sum, point) => sum + point.x, 0) / pixelPoints.length;
            const labelY =
              pixelPoints.reduce((sum, point) => sum + point.y, 0) / pixelPoints.length;
            const zoneEndpoint = visibleEndpoints.find(
              (endpoint) => endpoint.zoneId === zone.zoneId
            );
            const isKeepOut = zone.zoneType === 'KEEP_OUT';
            const strokeColor = isKeepOut ? '#EF4444' : '#0284C7';
            const innerDashColor = isKeepOut ? '#FCA5A5' : '#38BDF8';
            const badgeBg = isKeepOut
              ? 'rgba(153, 27, 27, 0.90)'
              : 'rgba(3, 105, 161, 0.90)';
            const zoneLabel = (zone.zoneName || zone.zoneCode || '').trim();
            const zoneFontSize = Math.max(4.6, viewWidth / 38);
            const badgeW = Math.max(zoneLabel.length * zoneFontSize * 0.58 + 7, 18);
            const badgeH = zoneFontSize + 3.4;

            return (
              <G
                key={zone.zoneId}
                onPress={zoneEndpoint ? () => onSelectEndpoint(zoneEndpoint) : undefined}
              >
                {/* Lớp nền sọc kỹ thuật OTTO */}
                <Polygon
                  points={pointsText}
                  fill={isKeepOut ? 'url(#ottoHazardStripe)' : 'url(#ottoSpeedPattern)'}
                  stroke={strokeColor}
                  strokeWidth={Math.max(1.3, viewWidth / 165)}
                />
                {/* Đường viền nét đứt kỹ thuật chuẩn OTTO Traffic Control */}
                <Polygon
                  points={pointsText}
                  fill="none"
                  stroke={innerDashColor}
                  strokeWidth={Math.max(0.7, viewWidth / 280)}
                  strokeDasharray="3,2"
                />
                {/* Nhãn Pill chuyên nghiệp giữa vùng Zone */}
                <Rect
                  x={labelX - badgeW / 2}
                  y={labelY - badgeH / 2}
                  width={badgeW}
                  height={badgeH}
                  rx={badgeH / 2}
                  fill={badgeBg}
                  stroke={innerDashColor}
                  strokeWidth={0.5}
                />
                <SvgText
                  x={labelX}
                  y={labelY + zoneFontSize * 0.32}
                  textAnchor="middle"
                  fontSize={zoneFontSize}
                  fontWeight="800"
                  fill="#FFFFFF"
                >
                  {zoneLabel}
                </SvgText>
              </G>
            );
          })}

          {/* 2. Vẽ đường dẫn Nav2 phát sáng (Glowing Trajectory) chuẩn OTTO Fleet Manager */}
          {validPlannedPath && (() => {
            const polyPoints = validPlannedPath
              .map((pt) => {
                const p = geometry.toViewPixel({ x: Number(pt.xM), y: Number(pt.yM) });
                return `${p.x},${p.y}`;
              })
              .join(' ');
            return (
              <G>
                <Polyline
                  points={polyPoints}
                  fill="none"
                  stroke="rgba(14, 165, 233, 0.35)"
                  strokeWidth={Math.max(3.4, viewWidth / 70)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Polyline
                  points={polyPoints}
                  fill="none"
                  stroke="#0EA5E9"
                  strokeWidth={Math.max(1.5, viewWidth / 140)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            );
          })()}

          {/* 3. Vùng chạm ẩn của các điểm dừng (Endpoints) — giữ tương tác điều phối khi nhấn vào phòng */}
          {visibleEndpoints.map((endpoint) => {
            const point = geometry.toViewPixel({
              x: Number(endpoint.xM),
              y: Number(endpoint.yM),
            });
            const hitRadius = Math.max(12, viewWidth / 16);

            return (
              <G key={endpoint.endpointId} onPress={() => onSelectEndpoint(endpoint)}>
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={hitRadius}
                  fill="rgba(0, 0, 0, 0.001)"
                  stroke="none"
                />
              </G>
            );
          })}

          {/* 4. Vẽ thân xe AMR (OTTO Chassis Footprint + Safety LiDAR Field) */}
          {validRobotPose && (() => {
            const robotPt = geometry.toViewPixel({
              x: validRobotPose.xM,
              y: validRobotPose.yM,
            });
            const headingDeg =
              (geometry.toViewHeadingRad(validRobotPose.yawRad) * 180) / Math.PI;
            const chassisLen = Math.max(9.5, viewWidth / 22);
            const chassisWid = chassisLen * 0.72;
            const safetyLen = chassisLen * 1.36;
            const safetyWid = chassisWid * 1.38;

            const safetyStroke = isPoseLive ? '#0EA5E9' : '#64748B';
            const safetyFill = isPoseLive
              ? 'rgba(14, 165, 233, 0.22)'
              : 'rgba(100, 116, 139, 0.18)';
            const frontLedColor = isPoseLive ? '#10B981' : '#94A3B8';

            return (
              <G
                transform={`translate(${robotPt.x}, ${robotPt.y}) rotate(${headingDeg})`}
              >
                {/* Vùng đệm an toàn LiDAR (Blue Safety Field chuẩn OTTO) */}
                <Rect
                  x={-safetyLen / 2}
                  y={-safetyWid / 2}
                  width={safetyLen}
                  height={safetyWid}
                  rx={safetyWid * 0.26}
                  fill={safetyFill}
                  stroke={safetyStroke}
                  strokeWidth={Math.max(0.9, viewWidth / 210)}
                />
                {/* Thân robot AMR màu trắng công nghiệp */}
                <Rect
                  x={-chassisLen / 2}
                  y={-chassisWid / 2}
                  width={chassisLen}
                  height={chassisWid}
                  rx={chassisWid * 0.2}
                  fill="#FFFFFF"
                  stroke="#0F172A"
                  strokeWidth={Math.max(0.7, viewWidth / 260)}
                />
                {/* Đèn LED trạng thái mũi xe (Xanh lục chuẩn OTTO) */}
                <Rect
                  x={chassisLen * 0.18}
                  y={-chassisWid * 0.32}
                  width={chassisLen * 0.22}
                  height={chassisWid * 0.64}
                  rx={chassisWid * 0.12}
                  fill={frontLedColor}
                />
                {/* Đèn hậu đỏ ở đuôi xe */}
                <Rect
                  x={-chassisLen * 0.44}
                  y={-chassisWid * 0.34}
                  width={chassisLen * 0.1}
                  height={chassisWid * 0.2}
                  rx={0.6}
                  fill="#EF4444"
                />
                <Rect
                  x={-chassisLen * 0.44}
                  y={chassisWid * 0.14}
                  width={chassisLen * 0.1}
                  height={chassisWid * 0.2}
                  rx={0.6}
                  fill="#EF4444"
                />
              </G>
            );
          })()}
        </Svg>

        {/* HUD 1 (Góc dưới trái): Hệ trục tọa độ 0°/90° & Tọa độ mét chuẩn OTTO Fleet Manager */}
        <View style={styles.ottoAxisHud} pointerEvents="none">
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Line x1="14" y1="23" x2="14" y2="5" stroke="#94A3B8" strokeWidth="1.2" />
            <Polygon points="14,3 11.8,7 16.2,7" fill="#E2E8F0" />
            <Line x1="5" y1="14" x2="23" y2="14" stroke="#94A3B8" strokeWidth="1.2" />
            <Polygon points="25,14 21,11.8 21,16.2" fill="#E2E8F0" />
            <Circle cx="14" cy="14" r="1.8" fill="#38BDF8" />
            <SvgText x="14" y="2.8" fontSize="4.2" fill="#CBD5E1" textAnchor="middle">
              0°
            </SvgText>
          </Svg>
          <View style={styles.ottoAxisTextCol}>
            <Text style={styles.ottoAxisCoordText}>
              x: {validRobotPose ? `${validRobotPose.xM.toFixed(2)} m` : '-- m'}
            </Text>
            <Text style={styles.ottoAxisCoordText}>
              y: {validRobotPose ? `${validRobotPose.yM.toFixed(2)} m` : '-- m'}
            </Text>
          </View>
        </View>

        {/* HUD 2 (Chính giữa dưới): Nhãn khóa phiên bản Live Map chuẩn OTTO Fleet Manager */}
        <View style={styles.ottoLivePillWrap} pointerEvents="none">
          <View style={styles.ottoLivePill}>
            <View style={styles.ottoLiveLockIcon}>
              <Lock size={9} color="#052E16" strokeWidth={2.8} />
            </View>
            <Text style={styles.ottoLivePillText} numberOfLines={1}>
              Live {'>'} v{map.versionNo || 1}: {map.mapName || 'final_o_truong'}
            </Text>
          </View>
        </View>

        {/* HUD 3 (Góc trên phải): Nút chuyển chế độ Filter lớp bản đồ */}
        <TouchableOpacity
          style={styles.ottoFilterBtn}
          onPress={cycleFilterMode}
          activeOpacity={0.8}
        >
          <Layers size={12} color="#38BDF8" />
          <Text style={styles.ottoFilterBtnText}>
            {filterMode === 'otto_cad'
              ? 'OTTO CAD'
              : filterMode === 'otto_dark'
              ? 'OTTO DARK'
              : 'RAW MAP'}
          </Text>
        </TouchableOpacity>

        {isLoadingImage && !imageFailed && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Đang tải ảnh map từ BE...</Text>
          </View>
        )}

        {imageFailed && (
          <View style={styles.warningBadge} pointerEvents="none">
            <Text style={styles.warningText}>
              BE chưa trả ảnh PNG · đang hiển thị tọa độ waypoint/zone
            </Text>
          </View>
        )}
      </View>

      {/* Thanh chú thích Traffic Control chuẩn OTTO Fleet Manager */}
      <View style={styles.legendBar}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
            <Text style={styles.legendLabel}>Speed Limit Zone</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendLabel}>Exclusion Zone</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: validRobotPose
                    ? isPoseLive
                      ? '#10B981'
                      : '#64748B'
                    : '#94A3B8',
                },
              ]}
            />
            <Text style={styles.legendLabel}>
              {validRobotPose
                ? `AMR (${validRobotPose.xM.toFixed(2)}m, ${validRobotPose.yM.toFixed(2)}m · ${Math.round((validRobotPose.yawRad * 180) / Math.PI)}°)`
                : 'AMR: Chờ định vị AMCL'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    backgroundColor: '#0F172A',
    overflow: 'hidden',
  },
  canvasContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  rotatedMapImage: {
    position: 'absolute',
  },
  fullSize: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  ottoCadTint: {
    backgroundColor: 'rgba(14, 116, 144, 0.07)',
  },
  ottoDarkTint: {
    backgroundColor: 'rgba(15, 23, 42, 0.24)',
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
  },
  ottoAxisHud: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
  },
  ottoAxisTextCol: {
    justifyContent: 'center',
  },
  ottoAxisCoordText: {
    color: '#E2E8F0',
    fontSize: 9,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  ottoLivePillWrap: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  ottoLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.90)',
    borderWidth: 1.2,
    borderColor: '#10B981',
  },
  ottoLiveLockIcon: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ottoLivePillText: {
    color: '#F8FAFC',
    fontSize: 9.5,
    fontWeight: '700',
  },
  ottoFilterBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: 7,
    backgroundColor: 'rgba(15, 23, 42, 0.86)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  ottoFilterBtnText: {
    color: '#E0F2FE',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(248, 250, 252, 0.82)',
  },
  loadingText: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '700',
  },
  warningBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 38,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    backgroundColor: 'rgba(254, 243, 199, 0.95)',
  },
  warningText: {
    color: '#92400E',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  legendBar: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    color: '#E2E8F0',
    fontSize: 10,
    fontWeight: '600',
  },
});
