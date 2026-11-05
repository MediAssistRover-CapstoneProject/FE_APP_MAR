import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, G, Polygon, Text as SvgText } from 'react-native-svg';
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
    const x = Number(value.xM ?? value.x ?? value.lng);
    const y = Number(value.yM ?? value.y ?? value.lat);
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

  useEffect(() => {
    setIsLoadingImage(true);
    setImageFailed(false);
  }, [map.mapId, token]);

  const geometry = useMemo(() => {
    const resolution = Math.max(
      Number(metadata?.resolution ?? metadata?.resolution_m_per_pixel ?? map.resolutionMPerPixel) || 0.05,
      0.000001
    );
    const pixelWidth = Math.max(
      1,
      Number(metadata?.width_px) || (Number(map.widthM) || 1) / resolution
    );
    const pixelHeight = Math.max(
      1,
      Number(metadata?.height_px) || (Number(map.heightM) || 1) / resolution
    );
    const origin = Array.isArray(metadata?.origin) ? metadata.origin : [];
    const originX = Number(metadata?.origin_x_m ?? origin[0] ?? map.originXM) || 0;
    const originY = Number(metadata?.origin_y_m ?? origin[1] ?? map.originYM) || 0;
    const yaw = Number(metadata?.origin_yaw_rad ?? origin[2] ?? map.originYawRad) || 0;
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
  }, [map, metadata]);

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

  const imageUrl = `${API_CONFIG.BASE_URL}/maps/${map.mapId}/image.png`;

  return (
    <View
      style={[
        styles.container,
        { aspectRatio: geometry.pixelWidth / geometry.pixelHeight },
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
          resizeMode="contain"
          style={styles.fullSize}
          onLoadStart={() => setIsLoadingImage(true)}
          onLoadEnd={() => setIsLoadingImage(false)}
          onError={() => {
            setImageFailed(true);
            setIsLoadingImage(false);
          }}
        />
      )}

      <Svg
        viewBox={`0 0 ${geometry.pixelWidth} ${geometry.pixelHeight}`}
        preserveAspectRatio="xMidYMid meet"
        style={styles.fullSize}
      >
        {visibleZones.map(({ zone, points }) => {
          const pixelPoints = points.map(geometry.toPixel);
          const pointsText = pixelPoints.map((point) => `${point.x},${point.y}`).join(' ');
          const labelX = pixelPoints.reduce((sum, point) => sum + point.x, 0) / pixelPoints.length;
          const labelY = pixelPoints.reduce((sum, point) => sum + point.y, 0) / pixelPoints.length;
          const zoneEndpoint = visibleEndpoints.find((endpoint) => endpoint.zoneId === zone.zoneId);
          return (
            <G
              key={zone.zoneId}
              onPress={zoneEndpoint ? () => onSelectEndpoint(zoneEndpoint) : undefined}
            >
              <Polygon
                points={pointsText}
                fill="rgba(14, 165, 233, 0.12)"
                stroke="#0284C7"
                strokeWidth={Math.max(2, geometry.pixelWidth / 500)}
              />
              <SvgText
                x={labelX}
                y={labelY}
                textAnchor="middle"
                fontSize={Math.max(10, geometry.pixelWidth / 85)}
                fontWeight="700"
                fill="#075985"
              >
                {zone.zoneName}
              </SvgText>
            </G>
          );
        })}

        {visibleEndpoints.map((endpoint) => {
          const point = geometry.toPixel({ x: Number(endpoint.xM), y: Number(endpoint.yM) });
          const selected = selectedEndpointId === endpoint.endpointId;
          const radius = Math.max(7, geometry.pixelWidth / 110);
          const fontSize = Math.max(11, geometry.pixelWidth / 75);
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
        <Text style={styles.sourceText}>LIVE BE · {map.mapCode}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    minHeight: 220,
    maxHeight: 440,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
  },
  fullSize: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
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
});
