import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Polygon, Text as SvgText } from 'react-native-svg';
import { RotateCcw, RotateCw } from 'lucide-react-native';
import { API_CONFIG } from '../../api/config';
import { EndpointResponse, MapResponse, ZoneDto } from '../../api/types';

interface BackendHospitalMapProps {
  map: MapResponse;
  metadata?: Record<string, any> | null;
  endpoints: EndpointResponse[];
  zones: ZoneDto[];
  token: string | null;
  selectedEndpointId?: string | null;
  onSelectEndpoint: (endpoint: EndpointResponse) => void;
}

interface MapPoint {
  x: number;
  y: number;
}

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
}) => {
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [imageFailed, setImageFailed] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [viewRotationDeg, setViewRotationDeg] = useState<number>(0);

  const imageUrl = `${API_CONFIG.BASE_URL}/maps/${map.mapId}/image.png`;

  useEffect(() => {
    setIsLoadingImage(true);
    setImageFailed(false);
    setNaturalSize(null);
    setViewRotationDeg(0);

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
          // Fallback to onLoad or metadata dimensions
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

    // Ưu tiên kích thước pixel thực tế của file ảnh PNG từ SLAM (map_saver)
    // để tránh trường hợp widthM/heightM trong DB là giá trị mặc định gây méo và lệch trục Y
    const pixelWidth = Math.max(
      1,
      (naturalSize?.width && naturalSize.width > 0 ? naturalSize.width : 0) ||
        (metaWidthPx > 0 ? metaWidthPx : 0) ||
        (Number(map.widthM) > 0 ? Number(map.widthM) / resolution : 1)
    );
    const pixelHeight = Math.max(
      1,
      (naturalSize?.height && naturalSize.height > 0 ? naturalSize.height : 0) ||
        (metaHeightPx > 0 ? metaHeightPx : 0) ||
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
    const yaw =
      Number(
        metadata?.origin_yaw_rad ??
          metadata?.originYawRad ??
          metadata?.originYaw ??
          metadata?.yaw ??
          origin[2] ??
          map.originYawRad
      ) || 0;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);

    const toPixel = (point: MapPoint) => {
      const dx = point.x - originX;
      const dy = point.y - originY;
      const localX = cos * dx + sin * dy;
      const localY = -sin * dx + cos * dy;
      return {
        x: localX / resolution,
        y: pixelHeight - localY / resolution,
      };
    };

    return { pixelWidth, pixelHeight, toPixel };
  }, [map, metadata, naturalSize]);

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

  const aspectRatio = geometry.pixelWidth / geometry.pixelHeight;

  return (
    <View style={styles.outerWrapper}>
      <View style={[styles.canvasContainer, { aspectRatio }]}>
        <View
          style={[
            styles.rotatableStage,
            viewRotationDeg !== 0
              ? { transform: [{ rotate: `${viewRotationDeg}deg` }] }
              : null,
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
              style={styles.fullSize}
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
            viewBox={`0 0 ${geometry.pixelWidth} ${geometry.pixelHeight}`}
            preserveAspectRatio="none"
            style={styles.fullSize}
          >
            {visibleZones.map(({ zone, points }) => {
              const pixelPoints = points.map(geometry.toPixel);
              const pointsText = pixelPoints.map((point) => `${point.x},${point.y}`).join(' ');
              const labelX =
                pixelPoints.reduce((sum, point) => sum + point.x, 0) / pixelPoints.length;
              const labelY =
                pixelPoints.reduce((sum, point) => sum + point.y, 0) / pixelPoints.length;
              const zoneEndpoint = visibleEndpoints.find(
                (endpoint) => endpoint.zoneId === zone.zoneId
              );
              return (
                <G
                  key={zone.zoneId}
                  onPress={zoneEndpoint ? () => onSelectEndpoint(zoneEndpoint) : undefined}
                >
                  <Polygon
                    points={pointsText}
                    fill="rgba(14, 165, 233, 0.16)"
                    stroke="#0284C7"
                    strokeWidth={Math.max(2, geometry.pixelWidth / 450)}
                  />
                  <SvgText
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    fontSize={Math.max(10, geometry.pixelWidth / 80)}
                    fontWeight="700"
                    fill="#075985"
                  >
                    {zone.zoneName}
                  </SvgText>
                </G>
              );
            })}

            {visibleEndpoints.map((endpoint) => {
              const point = geometry.toPixel({
                x: Number(endpoint.xM),
                y: Number(endpoint.yM),
              });
              const selected = selectedEndpointId === endpoint.endpointId;
              const radius = Math.max(6, geometry.pixelWidth / 105);
              const fontSize = Math.max(10, geometry.pixelWidth / 72);
              return (
                <G key={endpoint.endpointId} onPress={() => onSelectEndpoint(endpoint)}>
                  <Circle
                    cx={point.x}
                    cy={point.y}
                    r={selected ? radius * 1.45 : radius}
                    fill={selected ? '#F97316' : '#2563EB'}
                    stroke="#FFFFFF"
                    strokeWidth={Math.max(2, radius / 3)}
                  />
                  <SvgText
                    x={point.x}
                    y={point.y - radius * 1.7}
                    textAnchor="middle"
                    fontSize={fontSize}
                    fontWeight="700"
                    fill="#0F172A"
                    stroke="#FFFFFF"
                    strokeWidth={fontSize / 5}
                  >
                    {endpoint.endpointName}
                  </SvgText>
                </G>
              );
            })}
          </Svg>
        </View>

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

        <View style={styles.sourceBadge} pointerEvents="none">
          <Text style={styles.sourceText}>
            LIVE BE · {map.mapCode} ({Math.round(geometry.pixelWidth)}x
            {Math.round(geometry.pixelHeight)}px)
          </Text>
        </View>

        <View style={styles.rotationToolbar}>
          <TouchableOpacity
            style={styles.rotBtn}
            onPress={() => setViewRotationDeg((prev) => prev - 5)}
            activeOpacity={0.75}
          >
            <RotateCcw size={12} color="#E2E8F0" />
            <Text style={styles.rotBtnText}>-5°</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rotBtn, viewRotationDeg === 18 && styles.rotBtnActive]}
            onPress={() => setViewRotationDeg((prev) => (prev === 18 ? 0 : 18))}
            activeOpacity={0.75}
          >
            <Text style={styles.rotBtnText}>
              {viewRotationDeg === 0 ? 'Căn thẳng' : `${viewRotationDeg > 0 ? '+' : ''}${viewRotationDeg}° (Gốc)`}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rotBtn}
            onPress={() => setViewRotationDeg((prev) => prev + 5)}
            activeOpacity={0.75}
          >
            <RotateCw size={12} color="#E2E8F0" />
            <Text style={styles.rotBtnText}>+5°</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  canvasContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  rotatableStage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
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
  sourceBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
  },
  sourceText: {
    color: '#67E8F9',
    fontSize: 9,
    fontWeight: '800',
  },
  rotationToolbar: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.82)',
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 8,
  },
  rotBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    backgroundColor: 'rgba(51, 65, 85, 0.85)',
  },
  rotBtnActive: {
    backgroundColor: '#0284C7',
  },
  rotBtnText: {
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '700',
  },
});
