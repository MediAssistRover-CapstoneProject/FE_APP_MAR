import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import Svg, {
  Rect,
  Circle,
  Path,
  Polygon,
  Polyline,
  Line,
  Text as SvgText,
  G,
  Defs,
  LinearGradient,
  Stop,
  Pattern,
} from 'react-native-svg';
import { useHospitalMapStore, HospitalZone } from '../../store/useHospitalMapStore';
import { Colors } from '../../constants/theme';

interface HospitalSvgMapProps {
  interactive?: boolean;
  mode?: 'staff' | 'robot';
  onSelectZone?: (zone: HospitalZone) => void;
}

export const HospitalSvgMap: React.FC<HospitalSvgMapProps> = ({
  interactive = true,
  mode = 'staff',
  onSelectZone,
}) => {
  const { mapConfig, zones, robotState, selectedZoneId, selectZone } = useHospitalMapStore();

  const handleZonePress = (zone: HospitalZone) => {
    if (!interactive) return;
    selectZone(zone.id);
    if (onSelectZone) {
      onSelectZone(zone);
    }
  };

  // Tạo chuỗi đường đi path SVG dạng "M x1 y1 L x2 y2 ..."
  const pathD = React.useMemo(() => {
    if (!robotState.path || robotState.path.length === 0) return '';
    let d = `M ${robotState.x} ${robotState.y}`;
    for (const pt of robotState.path) {
      d += ` L ${pt.x} ${pt.y}`;
    }
    return d;
  }, [robotState.path, robotState.x, robotState.y]);

  return (
    <View style={styles.container}>
      <Svg
        viewBox={`0 0 ${mapConfig.width} ${mapConfig.height}`}
        style={styles.svgCanvas}
        preserveAspectRatio="xMidYMid meet"
      >
        <Defs>
          {/* Gradient cho nền mặt bằng */}
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#F8FAFC" />
            <Stop offset="100%" stopColor="#F1F5F9" />
          </LinearGradient>

          {/* Gradient cho hành lang chính */}
          <LinearGradient id="corridorGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#E2E8F0" stopOpacity="0.7" />
            <Stop offset="50%" stopColor="#CBD5E1" stopOpacity="0.8" />
            <Stop offset="100%" stopColor="#E2E8F0" stopOpacity="0.7" />
          </LinearGradient>

          {/* Gradient cho Robot AMR */}
          <LinearGradient id="robotBodyGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#1E293B" />
            <Stop offset="100%" stopColor="#0F172A" />
          </LinearGradient>
        </Defs>

        {/* 1. NỀN TOÀN BẢN ĐỒ & TƯỜNG BAO BỆNH VIỆN */}
        <Rect
          x={0}
          y={0}
          width={mapConfig.width}
          height={mapConfig.height}
          fill="url(#bgGrad)"
          rx={16}
        />

        {/* Tường bao ngoại vi dày kiến trúc */}
        <Rect
          x={20}
          y={20}
          width={mapConfig.width - 40}
          height={mapConfig.height - 40}
          fill="none"
          stroke="#94A3B8"
          strokeWidth={4}
          rx={12}
        />

        {/* 2. TRỤC HÀNH LANG CHÍNH (MAIN CORRIDORS) */}
        {/* Hành lang ngang trung tâm */}
        <Rect
          x={240}
          y={260}
          width={mapConfig.width - 480}
          height={160}
          fill="url(#corridorGrad)"
        />

        {/* Hành lang kết nối phía Tây (West Corridor) */}
        <Rect x={240} y={60} width={120} height={560} fill="url(#corridorGrad)" />

        {/* Hành lang kết nối trung tâm (Center Corridor) */}
        <Rect x={570} y={60} width={90} height={560} fill="url(#corridorGrad)" />

        {/* Hành lang kết nối phía Đông (East Corridor) */}
        <Rect x={880} y={60} width={90} height={560} fill="url(#corridorGrad)" />

        {/* Vạch kẻ trung tâm hành lang dẫn đường */}
        <Line
          x1={40}
          y1={340}
          x2={mapConfig.width - 40}
          y2={340}
          stroke="#94A3B8"
          strokeWidth={2}
          strokeDasharray="12,12"
        />

        <SvgText
          x={615}
          y={345}
          textAnchor="middle"
          fontSize={13}
          fontWeight="800"
          fill="#64748B"
          letterSpacing={2}
        >
          HÀNH LANG TRUNG TÂM (CENTRAL CORRIDOR 0.05m/px)
        </SvgText>

        {/* 3. CÁC PHÒNG BỆNH & KHU VỰC CHỨC NĂNG (ZONES) */}
        {zones.map((zone) => {
          const isSelected = selectedZoneId === zone.id;
          const isTarget = robotState.targetZoneId === zone.id;

          // Chuyển mảng points thành chuỗi "x1,y1 x2,y2 ..."
          const pointsStr = zone.points.map((p) => `${p.x},${p.y}`).join(' ');

          // Tọa độ trung tâm để đặt chữ
          const minX = Math.min(...zone.points.map((p) => p.x));
          const maxX = Math.max(...zone.points.map((p) => p.x));
          const minY = Math.min(...zone.points.map((p) => p.y));
          const maxY = Math.max(...zone.points.map((p) => p.y));
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;

          return (
            <G key={zone.id} onPress={() => handleZonePress(zone)}>
              {/* Vùng polygon của phòng */}
              <Polygon
                points={pointsStr}
                fill={isSelected ? '#E0F2FE' : isTarget ? '#FEF3C7' : '#FFFFFF'}
                stroke={isSelected ? '#0284C7' : isTarget ? '#F59E0B' : '#CBD5E1'}
                strokeWidth={isSelected || isTarget ? 3.5 : 2}
                strokeDasharray={isTarget ? '8,4' : undefined}
              />

              {/* Vạch cửa phòng (Door Indicator) */}
              <Circle
                cx={zone.doorPoint.x}
                cy={zone.doorPoint.y}
                r={6}
                fill={isSelected ? '#0284C7' : '#94A3B8'}
              />
              <SvgText
                x={zone.doorPoint.x}
                y={zone.doorPoint.y + (zone.doorPoint.y < 340 ? -10 : 15)}
                textAnchor="middle"
                fontSize={9}
                fontWeight="700"
                fill="#64748B"
              >
                CỬA
              </SvgText>

              {/* Điểm đỗ Docking Point bên trong phòng */}
              <Circle
                cx={zone.dockPoint.x}
                cy={zone.dockPoint.y}
                r={isTarget ? 16 : 10}
                fill={isTarget ? 'rgba(245, 158, 11, 0.2)' : 'rgba(2, 132, 199, 0.1)'}
                stroke={isTarget ? '#F59E0B' : '#0284C7'}
                strokeWidth={2}
                strokeDasharray={isTarget ? '4,4' : undefined}
              />
              <Circle
                cx={zone.dockPoint.x}
                cy={zone.dockPoint.y}
                r={4}
                fill={isTarget ? '#F59E0B' : '#0284C7'}
              />

              {/* Tag nhãn mã phòng (P-101, ICU...) */}
              <Rect
                x={centerX - 42}
                y={minY + 12}
                width={84}
                height={22}
                rx={6}
                fill={zone.color}
              />
              <SvgText
                x={centerX}
                y={minY + 27}
                textAnchor="middle"
                fontSize={11}
                fontWeight="800"
                fill="#FFFFFF"
              >
                {zone.code}
              </SvgText>

              {/* Tên phòng */}
              <SvgText
                x={centerX}
                y={centerY}
                textAnchor="middle"
                fontSize={12}
                fontWeight="700"
                fill="#1E293B"
              >
                {zone.name.split(' - ')[0]}
              </SvgText>

              {/* Mô tả phụ / Số giường */}
              <SvgText
                x={centerX}
                y={centerY + 18}
                textAnchor="middle"
                fontSize={10}
                fontWeight="500"
                fill="#64748B"
              >
                {zone.bedCount ? `${zone.bedCount} Giường bệnh` : zone.department.replace('Khoa ', '')}
              </SvgText>
            </G>
          );
        })}

        {/* 4. TUYẾN ĐƯỜNG ĐANG ĐI (ACTIVE NAVIGATION PATH) */}
        {pathD ? (
          <G>
            {/* Lớp viền phát sáng (Glow aura) */}
            <Path
              d={pathD}
              fill="none"
              stroke="rgba(6, 182, 212, 0.35)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Tuyến đường chính dạng gạch đứt sắc nét */}
            <Path
              d={pathD}
              fill="none"
              stroke="#06B6D4"
              strokeWidth={4.5}
              strokeDasharray="10,6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Các điểm waypoint trung gian */}
            {robotState.path.map((pt, idx) => (
              <Circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={idx === robotState.path.length - 1 ? 7 : 4}
                fill={idx === robotState.path.length - 1 ? '#EF4444' : '#06B6D4'}
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            ))}
          </G>
        ) : null}

        {/* 5. ROBOT AMR — HÌNH VUÔNG NHỎ (SMALL SQUARE) THEO THỜI GIAN THỰC */}
        <G>
          {/* Vòng hào quang radar xung quanh robot */}
          <Circle
            cx={robotState.x}
            cy={robotState.y}
            r={24}
            fill={
              robotState.status === 'NAVIGATING'
                ? 'rgba(6, 182, 212, 0.2)'
                : robotState.status === 'ARRIVED'
                ? 'rgba(16, 185, 129, 0.25)'
                : robotState.status === 'BLOCKED'
                ? 'rgba(239, 68, 68, 0.25)'
                : 'rgba(56, 189, 248, 0.15)'
            }
            stroke={
              robotState.status === 'NAVIGATING'
                ? '#06B6D4'
                : robotState.status === 'ARRIVED'
                ? '#10B981'
                : robotState.status === 'BLOCKED'
                ? '#EF4444'
                : '#38BDF8'
            }
            strokeWidth={1.5}
            strokeDasharray="4,4"
          />

          {/* Khối thân Robot dạng HÌNH VUÔNG NHỎ (28x28 pixel) xoay theo hướng heading */}
          <G
            transform={`translate(${robotState.x}, ${robotState.y}) rotate(${robotState.heading})`}
          >
            {/* Khối vuông chính (Square Chassis) */}
            <Rect
              x={-14}
              y={-14}
              width={28}
              height={28}
              rx={6}
              ry={6}
              fill="url(#robotBodyGrad)"
              stroke={
                robotState.status === 'NAVIGATING'
                  ? '#38BDF8'
                  : robotState.status === 'ARRIVED'
                  ? '#10B981'
                  : '#94A3B8'
              }
              strokeWidth={2.5}
            />

            {/* Mũi tên chỉ hướng di chuyển ở đầu thân robot */}
            <Path d="M 8 -5 L 14 0 L 8 5 Z" fill="#38BDF8" />

            {/* Cảm biến LiDAR / Mắt camera ở mép trước */}
            <Circle cx={11} cy={0} r={3} fill="#22D3EE" />

            {/* Đèn tín hiệu trung tâm */}
            <Circle
              cx={0}
              cy={0}
              r={4}
              fill={
                robotState.status === 'NAVIGATING'
                  ? '#22C55E'
                  : robotState.status === 'ARRIVED'
                  ? '#10B981'
                  : robotState.status === 'BLOCKED'
                  ? '#EF4444'
                  : '#38BDF8'
              }
            />

            {/* Hai bánh xe bên hông */}
            <Rect x={-8} y={-16} width={16} height={3} rx={1} fill="#64748B" />
            <Rect x={-8} y={13} width={16} height={3} rx={1} fill="#64748B" />
          </G>

          {/* Tag nhãn tên Robot MAR-01 bay phía trên hình vuông */}
          <G transform={`translate(${robotState.x}, ${robotState.y - 30})`}>
            <Rect
              x={-34}
              y={-12}
              width={68}
              height={18}
              rx={5}
              fill="#0F172A"
              stroke="#38BDF8"
              strokeWidth={1}
            />
            <SvgText
              x={0}
              y={1}
              textAnchor="middle"
              fontSize={10}
              fontWeight="800"
              fill="#38BDF8"
            >
              {robotState.robotId}
            </SvgText>
          </G>
        </G>
      </Svg>

      {/* CHÚ THÍCH HỆ TỌA ĐỘ BẢN ĐỒ & TỈ LỆ PIXEL CHUẨN */}
      <View style={styles.mapFooterNote}>
        <View style={styles.footerNoteRow}>
          <View style={[styles.statusDot, { backgroundColor: '#3B82F6' }]} />
          <Text style={styles.footerNoteText}>Phòng bệnh</Text>
        </View>
        <View style={styles.footerNoteRow}>
          <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
          <Text style={styles.footerNoteText}>Kho dược</Text>
        </View>
        <View style={styles.footerNoteRow}>
          <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
          <Text style={styles.footerNoteText}>Cấp cứu ICU</Text>
        </View>
        <View style={styles.footerNoteRow}>
          <View style={[styles.statusDot, { backgroundColor: '#06B6D4' }]} />
          <Text style={styles.footerNoteText}>Tuyến đường Nav</Text>
        </View>
        <View style={styles.footerNoteRow}>
          <View style={[styles.statusDot, { backgroundColor: '#0F172A' }]} />
          <Text style={styles.footerNoteText}>Robot (Hình vuông 28px)</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  svgCanvas: {
    width: '100%',
    aspectRatio: 1200 / 680,
  },
  mapFooterNote: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  footerNoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  footerNoteText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});
