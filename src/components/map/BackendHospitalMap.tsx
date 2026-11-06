import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
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

  // Khi ảnh SLAM bị nghiêng 20° được xoay thẳng lại, phần diện tích phòng thực tế nằm gọn ở trung tâm
  // (chiếm khoảng 86% chiều ngang và 74% chiều dọc của ảnh PNG gốc).
  // Thu nhỏ khung viewBox vào đúng vùng trung tâm này giúp phóng to bản đồ lấp kín khung.
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

    // Ưu tiên width_px / height_px từ image-metadata của BE (khớp 100% với mapping.html),
    // sau đó đến naturalSize của ảnh PNG
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

    // Công thức mapToPixel khớp 100% với map-navigation.js trên mapping.html,
    // sau đó qua view.forward(u, v) để xoay cố định -20° và phóng to lấp đầy khung
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

    // Tính góc hướng mũi tên (radian) trên khung nhìn đã xoay cố định
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

  const viewWidth = geometry.view.width;
  const viewHeight = geometry.view.height;
  const aspectRatio = viewWidth / viewHeight;

  const imageWidthPct = (geometry.pixelWidth / viewWidth) * 100;
  const imageHeightPct = (geometry.pixelHeight / viewHeight) * 100;
  const imageLeftPct = ((viewWidth - geometry.pixelWidth) / (2 * viewWidth)) * 100;
  const imageTopPct = ((viewHeight - geometry.pixelHeight) / (2 * viewHeight)) * 100;

  return (
    <View style={styles.outerWrapper}>
      <View style={[styles.canvasContainer, { aspectRatio }]}>
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

        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${viewWidth} ${viewHeight}`}
          preserveAspectRatio="none"
          style={styles.fullSize}
        >
          {/* 1. Vẽ các phân khu (Zones: vùng giảm tốc SPEED / vùng cấm KEEP_OUT) */}
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
            const fillColor = isKeepOut
              ? 'rgba(220, 38, 38, 0.20)'
              : 'rgba(14, 165, 233, 0.18)';
            const strokeColor = isKeepOut ? '#DC2626' : '#0284C7';
            const textColor = isKeepOut ? '#991B1B' : '#075985';
            const zoneFontSize = Math.max(5.5, viewWidth / 32);

            return (
              <G
                key={zone.zoneId}
                onPress={zoneEndpoint ? () => onSelectEndpoint(zoneEndpoint) : undefined}
              >
                <Polygon
                  points={pointsText}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={Math.max(1.2, viewWidth / 175)}
                />
                <SvgText
                  x={labelX}
                  y={labelY + zoneFontSize * 0.32}
                  textAnchor="middle"
                  fontSize={zoneFontSize}
                  fontWeight="800"
                  fill={textColor}
                >
                  {zone.zoneName || zone.zoneCode}
                </SvgText>
              </G>
            );
          })}

          {/* 2. Vẽ đường đi dự kiến Nav2 (nếu Robot đang thực hiện lệnh MOVE) */}
          {validPlannedPath && (
            <Polyline
              points={validPlannedPath
                .map((pt) => {
                  const p = geometry.toViewPixel({ x: Number(pt.xM), y: Number(pt.yM) });
                  return `${p.x},${p.y}`;
                })
                .join(' ')}
              fill="none"
              stroke="#2563EB"
              strokeWidth={Math.max(1.5, viewWidth / 130)}
              strokeDasharray="4,2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* 3. Vẽ các điểm dừng (Endpoints) kèm hướng mũi tên & nhãn tên điểm rõ nét */}
          {visibleEndpoints.map((endpoint) => {
            const point = geometry.toViewPixel({
              x: Number(endpoint.xM),
              y: Number(endpoint.yM),
            });
            const selected = selectedEndpointId === endpoint.endpointId;
            const radius = Math.max(3.6, viewWidth / 48);
            const r = selected ? radius * 1.28 : radius;
            const headingRad = geometry.toViewHeadingRad(Number(endpoint.yawRad) || 0);
            const tipX = point.x + Math.cos(headingRad) * (r * 1.75);
            const tipY = point.y + Math.sin(headingRad) * (r * 1.75);

            const label = (endpoint.endpointName || endpoint.endpointCode || '').trim();
            const fontSize = Math.max(5.0, viewWidth / 38);
            const badgeWidth = Math.max(label.length * fontSize * 0.56 + 5, 16);
            const badgeHeight = fontSize + 3.2;
            const badgeX = point.x - badgeWidth / 2;
            const badgeY = point.y - r - badgeHeight - 2;

            const fillColor = selected ? '#F97316' : '#2563EB';

            return (
              <G key={endpoint.endpointId} onPress={() => onSelectEndpoint(endpoint)}>
                {/* Vòng hào quang khi chọn */}
                {selected && (
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={r * 1.55}
                    fill="rgba(249, 115, 22, 0.24)"
                  />
                )}

                {/* Kim chỉ hướng yawRad của Endpoint */}
                <Line
                  x1={point.x}
                  y1={point.y}
                  x2={tipX}
                  y2={tipY}
                  stroke={fillColor}
                  strokeWidth={Math.max(1.3, r * 0.4)}
                  strokeLinecap="round"
                />

                {/* Chấm tròn Endpoint */}
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={r}
                  fill={fillColor}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(1.1, r * 0.3)}
                />
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={r * 0.34}
                  fill="#FFFFFF"
                />

                {/* Nhãn tên Endpoint dễ đọc trên nền trắng */}
                {label ? (
                  <G>
                    <Rect
                      x={badgeX}
                      y={badgeY}
                      width={badgeWidth}
                      height={badgeHeight}
                      rx={badgeHeight / 2}
                      fill={selected ? '#EA580C' : 'rgba(15, 23, 42, 0.86)'}
                    />
                    <SvgText
                      x={point.x}
                      y={badgeY + badgeHeight - fontSize * 0.26}
                      textAnchor="middle"
                      fontSize={fontSize}
                      fontWeight="700"
                      fill="#FFFFFF"
                    >
                      {label}
                    </SvgText>
                  </G>
                ) : null}
              </G>
            );
          })}

          {/* 4. Vẽ vị trí và hướng Robot thời gian thực (từ API /robots/{id}/snapshot) */}
          {validRobotPose && (() => {
            const robotPt = geometry.toViewPixel({
              x: validRobotPose.xM,
              y: validRobotPose.yM,
            });
            const headingRad = geometry.toViewHeadingRad(validRobotPose.yawRad);
            const r = Math.max(4.8, viewWidth / 36);
            const cosH = Math.cos(headingRad);
            const sinH = Math.sin(headingRad);

            // Mũi tên chỉ hướng đầu Robot giống mapping.html
            const tipX = robotPt.x + cosH * (r * 2.1);
            const tipY = robotPt.y + sinH * (r * 2.1);
            const leftX = robotPt.x + cosH * (r * 0.25) - sinH * (r * 0.85);
            const leftY = robotPt.y + sinH * (r * 0.25) + cosH * (r * 0.85);
            const rightX = robotPt.x + cosH * (r * 0.25) + sinH * (r * 0.85);
            const rightY = robotPt.y + sinH * (r * 0.25) - cosH * (r * 0.85);
            const arrowPath = `M ${tipX} ${tipY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;

            const mainColor = isPoseLive ? '#0879EE' : '#64748B';
            const arrowColor = isPoseLive ? '#FF7900' : '#94A3B8';
            const fontSize = Math.max(5.2, viewWidth / 36);
            const tagText = isPoseLive ? 'ROBOT LIVE' : 'ROBOT (CUỐI)';
            const tagWidth = tagText.length * fontSize * 0.58 + 7;
            const tagHeight = fontSize + 3.6;

            return (
              <G>
                <Circle
                  cx={robotPt.x}
                  cy={robotPt.y}
                  r={r * 1.7}
                  fill={isPoseLive ? 'rgba(8, 121, 238, 0.22)' : 'rgba(100, 116, 139, 0.18)'}
                />
                <Circle
                  cx={robotPt.x}
                  cy={robotPt.y}
                  r={r}
                  fill={mainColor}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(1.2, r * 0.28)}
                />
                <Path
                  d={arrowPath}
                  fill={arrowColor}
                  stroke="#FFFFFF"
                  strokeWidth={Math.max(0.7, r * 0.14)}
                />
                <Rect
                  x={robotPt.x - tagWidth / 2}
                  y={robotPt.y + r + 2}
                  width={tagWidth}
                  height={tagHeight}
                  rx={tagHeight / 2}
                  fill={isPoseLive ? '#0369A1' : '#475569'}
                />
                <SvgText
                  x={robotPt.x}
                  y={robotPt.y + r + 2 + tagHeight - fontSize * 0.26}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight="800"
                  fill="#FFFFFF"
                >
                  {tagText}
                </SvgText>
              </G>
            );
          })()}
        </Svg>

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

      {/* Thanh chú thích & trạng thái định vị Robot đồng bộ từ mapping.html */}
      <View style={styles.legendBar}>
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
            <Text style={styles.legendLabel}>Điểm đến ({visibleEndpoints.length})</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#0284C7' }]} />
            <Text style={styles.legendLabel}>Giảm tốc</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} />
            <Text style={styles.legendLabel}>Vùng cấm</Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendDot,
                { backgroundColor: validRobotPose ? (isPoseLive ? '#0879EE' : '#64748B') : '#94A3B8' },
              ]}
            />
            <Text style={styles.legendLabel}>
              {validRobotPose
                ? `Robot (${validRobotPose.xM.toFixed(2)}m, ${validRobotPose.yM.toFixed(2)}m · ${Math.round((validRobotPose.yawRad * 180) / Math.PI)}°)`
                : 'Robot: Chưa có pose trên map này'}
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
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  canvasContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
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
  gridBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#FFFFFF',
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
    bottom: 8,
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
  sourceBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
  },
  sourceText: {
    color: '#67E8F9',
    fontSize: 9,
    fontWeight: '800',
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
    gap: 10,
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
