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
import { normalizeRobotPose } from './robotPose';
import {
  analyzeSlamMapGeometry,
  decodePngGrayscale,
  SlamAutoAlignResult,
} from './slamMapAutoAlign';

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
  const [autoAlign, setAutoAlign] = useState<SlamAutoAlignResult | null>(null);
  const [filterMode, setFilterMode] = useState<MapFilterMode>('otto_cad');

  const imageUrl = `${API_CONFIG.BASE_URL}/maps/${map.mapId}/image.png`;
  const mapImageSource = useMemo(
    () => ({
      uri: imageUrl,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
    [imageUrl, token]
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoadingImage(true);
    setImageFailed(false);
    setNaturalSize(null);
    setAutoAlign(null);

    // Tải trực tiếp binary PNG từ Backend để tự động nhận diện góc nghiêng của tường (Wall Alignment)
    // và tìm khung chữ nhật bao quanh viền tường (Tight Bounding Box) cho bất kỳ map mới nào quét từ Raspi.
    const analyzeMapBinary = async () => {
      try {
        const res = await fetch(imageUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;
        const buffer = await res.arrayBuffer();
        if (cancelled) return;
        const decoded = decodePngGrayscale(new Uint8Array(buffer));
        if (!decoded || cancelled) return;

        setNaturalSize({ width: decoded.width, height: decoded.height });
        const aligned = analyzeSlamMapGeometry(decoded.width, decoded.height, decoded.gray);
        if (!cancelled) {
          setAutoAlign(aligned);
          setIsLoadingImage(false);
        }
      } catch {
        // Fallback sang Image.getSizeWithHeaders nếu không đọc được binary
        if (!cancelled && imageUrl && typeof Image.getSizeWithHeaders === 'function') {
          Image.getSizeWithHeaders(
            imageUrl,
            token ? { Authorization: `Bearer ${token}` } : {},
            (width, height) => {
              if (!cancelled && width > 0 && height > 0) {
                setNaturalSize({ width, height });
              }
              if (!cancelled) setIsLoadingImage(false);
            },
            () => {
              if (!cancelled) setIsLoadingImage(false);
            }
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingImage(false);
        }
      }
    };

    analyzeMapBinary();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, map.mapId, token]);

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
    const pose = normalizeRobotPose(robotPose);
    if (!pose || (pose.mapId && pose.mapId !== map.mapId)) return null;
    return pose;
  }, [map.mapId, robotPose]);

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
      (autoAlign?.width && autoAlign.width > 0 ? autoAlign.width : 0) ||
        (metaWidthPx > 0 ? metaWidthPx : 0) ||
        (naturalSize?.width && naturalSize.width > 0 ? naturalSize.width : 0) ||
        (Number(map.widthM) > 0 ? Number(map.widthM) / resolution : 1)
    );
    const pixelHeight = Math.max(
      1,
      (autoAlign?.height && autoAlign.height > 0 ? autoAlign.height : 0) ||
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
    const cosO = Math.cos(originYaw);
    const sinO = Math.sin(originYaw);

    // Góc xoay tự động từ bộ nhận diện viền tường SLAM (fallback -20° khi đang tải ảnh)
    const rotationDeg = autoAlign ? autoAlign.rotationDeg : -20;
    const rotationRad = (rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);

    // Quy đổi tọa độ mét (xM, yM) sang tọa độ xoay quanh tâm ảnh (pixelWidth/2, pixelHeight/2)
    const worldToRotatedCenter = (point: MapPoint) => {
      const dx = point.x - originX;
      const dy = point.y - originY;
      const u = (cosO * dx + sinO * dy) / resolution;
      const v = pixelHeight - (-sinO * dx + cosO * dy) / resolution;
      const relU = u - pixelWidth / 2;
      const relV = v - pixelHeight / 2;
      return {
        rx: cosR * relU - sinR * relV,
        ry: sinR * relU + cosR * relV,
        rawU: u,
        rawV: v,
      };
    };

    // Khung bao từ thuật toán nhận diện viền tường SLAM
    let xMin = autoAlign ? autoAlign.xMin : -pixelWidth * 0.45;
    let xMax = autoAlign ? autoAlign.xMax : pixelWidth * 0.45;
    let yMin = autoAlign ? autoAlign.yMin : -pixelHeight * 0.42;
    let yMax = autoAlign ? autoAlign.yMax : pixelHeight * 0.42;

    // Đảm bảo mọi Zone, Endpoint và vị trí Robot trên map cũng nằm trọn trong khung nhìn
    const expandWithPoint = (pt: MapPoint) => {
      const { rx, ry } = worldToRotatedCenter(pt);
      const margin = 6;
      if (rx - margin < xMin) xMin = rx - margin;
      if (rx + margin > xMax) xMax = rx + margin;
      if (ry - margin < yMin) yMin = ry - margin;
      if (ry + margin > yMax) yMax = ry + margin;
    };

    visibleEndpoints.forEach((ep) =>
      expandWithPoint({ x: Number(ep.xM), y: Number(ep.yM) })
    );
    visibleZones.forEach(({ points }) => points.forEach(expandWithPoint));
    if (validRobotPose) {
      expandWithPoint({ x: validRobotPose.xM, y: validRobotPose.yM });
    }

    const viewWidth = Math.max(10, xMax - xMin);
    const viewHeight = Math.max(10, yMax - yMin);

    const toViewPixel = (point: MapPoint) => {
      const { rx, ry, rawU, rawV } = worldToRotatedCenter(point);
      return {
        x: rx - xMin,
        y: ry - yMin,
        rawU,
        rawV,
      };
    };

    const toViewHeadingRad = (yawRad: number) => {
      const safeYaw = Number.isFinite(yawRad) ? yawRad : 0;
      return -(safeYaw - originYaw) + rotationRad;
    };

    return {
      pixelWidth,
      pixelHeight,
      resolution,
      originYaw,
      rotationDeg,
      rotationRad,
      xMin,
      xMax,
      yMin,
      yMax,
      viewWidth,
      viewHeight,
      toViewPixel,
      toViewHeadingRad,
    };
  }, [
    autoAlign,
    map,
    metadata,
    naturalSize,
    validRobotPose,
    visibleEndpoints,
    visibleZones,
  ]);

  const cycleFilterMode = () => {
    setFilterMode((prev) =>
      prev === 'otto_cad' ? 'otto_dark' : prev === 'otto_dark' ? 'raw' : 'otto_cad'
    );
  };

  const viewWidth = geometry.viewWidth;
  const viewHeight = geometry.viewHeight;
  const aspectRatio = viewWidth / viewHeight;

  // Đặt tâm của ảnh PNG gốc tại đúng tọa độ (-xMin, -yMin) trong hệ quy chiếu [0..viewWidth, 0..viewHeight]
  // để dù Robot bắt đầu quét SLAM ở góc phòng hay giữa phòng thì bản đồ vẫn luôn căn giữa và hiện đủ 4 viền tường!
  const imageWidthPct = (geometry.pixelWidth / viewWidth) * 100;
  const imageHeightPct = (geometry.pixelHeight / viewHeight) * 100;
  const imageLeftPct = ((-geometry.xMin - geometry.pixelWidth / 2) / viewWidth) * 100;
  const imageTopPct = ((-geometry.yMin - geometry.pixelHeight / 2) / viewHeight) * 100;

  // Bước lưới 1 mét chuẩn CAD (quy đổi sang đơn vị viewBox)
  const gridStepPx = Math.max(12, 1 / geometry.resolution);

  return (
    <View style={styles.outerWrapper}>
      <View
        style={[
          styles.canvasContainer,
          {
            aspectRatio,
            backgroundColor: filterMode === 'otto_dark' ? '#1E242B' : '#CDCDCD',
          },
        ]}
      >
        <View style={styles.gridBackground} />

        {!imageFailed && (
          <Image
            source={mapImageSource}
            resizeMode="stretch"
            style={[
              styles.rotatedMapImage,
              {
                width: `${imageWidthPct}%`,
                height: `${imageHeightPct}%`,
                left: `${imageLeftPct}%`,
                top: `${imageTopPct}%`,
                opacity: filterMode === 'otto_dark' ? 0.88 : 0.98,
                transform: [{ rotate: `${geometry.rotationDeg}deg` }],
              },
            ]}
            onLoad={(event) => {
              const src = event.nativeEvent?.source;
              if (src?.width && src?.height) {
                setNaturalSize((prev) => prev || { width: src.width, height: src.height });
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
                <Polygon
                  points={pointsText}
                  fill={isKeepOut ? 'url(#ottoHazardStripe)' : 'url(#ottoSpeedPattern)'}
                  stroke={strokeColor}
                  strokeWidth={Math.max(1.3, viewWidth / 165)}
                />
                <Polygon
                  points={pointsText}
                  fill="none"
                  stroke={innerDashColor}
                  strokeWidth={Math.max(0.7, viewWidth / 280)}
                  strokeDasharray="3,2"
                />
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

          {/* 3. Vùng chạm ẩn của các điểm dừng (Endpoints) */}
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
                <Rect
                  x={chassisLen * 0.18}
                  y={-chassisWid * 0.32}
                  width={chassisLen * 0.22}
                  height={chassisWid * 0.64}
                  rx={chassisWid * 0.12}
                  fill={frontLedColor}
                />
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

        {isLoadingImage && !naturalSize && !autoAlign && !imageFailed && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Đang tải & căn chỉnh viền map...</Text>
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
    backgroundColor: '#CDCDCD',
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
