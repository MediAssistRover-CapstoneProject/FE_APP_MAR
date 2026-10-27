import { create } from 'zustand';

// ===== 1. DATA CONTRACT SPECIFICATION (CHUẨN 1200x680) =====

export interface MapConfig {
  width: number;
  height: number;
  resolution: number; // mét trên mỗi pixel (0.05 m/px -> 1200px = 60m, 680px = 34m)
}

export interface Point2D {
  x: number;
  y: number;
}

export type ZoneType =
  | 'PATIENT_ROOM'
  | 'STATION'
  | 'LABORATORY'
  | 'EMERGENCY'
  | 'CLINIC'
  | 'CHARGING_STATION';

export interface HospitalZone {
  id: string;
  name: string;
  code: string;
  type: ZoneType;
  points: Point2D[];
  dockPoint: Point2D;
  doorPoint: Point2D;
  color: string;
  badgeBg: string;
  department: string;
  bedCount?: number;
  description: string;
}

export type RobotNavStatus = 'IDLE' | 'NAVIGATING' | 'ARRIVED' | 'BLOCKED';

export interface RobotState {
  robotId: string;
  robotCode: string;
  x: number;
  y: number;
  heading: number; // Độ (0 - 360)
  status: RobotNavStatus;
  targetZoneId: string | null;
  path: Point2D[];
  speedMps: number;
  compartmentOpen: boolean;
  deliveryConfirmed: boolean;
  etaSeconds: number;
  distanceRemainingM: number;
  batteryPercent: number;
  lastUpdated: string;
}

// ===== 2. DANH SÁCH KHU VỰC / PHÒNG BỆNH VIỆN MẪU (1200x680) =====
export const INITIAL_ZONES: HospitalZone[] = [
  {
    id: 'room-101',
    name: 'Phòng 101 - Hồi Sức Tích Cực',
    code: 'P-101',
    type: 'PATIENT_ROOM',
    points: [
      { x: 60, y: 60 },
      { x: 240, y: 60 },
      { x: 240, y: 240 },
      { x: 60, y: 240 },
    ],
    dockPoint: { x: 150, y: 150 },
    doorPoint: { x: 240, y: 170 },
    color: '#3B82F6',
    badgeBg: '#EFF6FF',
    department: 'Khoa Hồi Sức Cấp Cứu',
    bedCount: 4,
    description: 'Khu vực chăm sóc bệnh nhân nặng sau phẫu thuật',
  },
  {
    id: 'pharmacy',
    name: 'Kho Dược Trung Tâm',
    code: 'KHO-DUOC',
    type: 'STATION',
    points: [
      { x: 380, y: 60 },
      { x: 570, y: 60 },
      { x: 570, y: 240 },
      { x: 380, y: 240 },
    ],
    dockPoint: { x: 475, y: 150 },
    doorPoint: { x: 475, y: 240 },
    color: '#10B981',
    badgeBg: '#ECFDF5',
    department: 'Khoa Dược Lâm Sàng',
    description: 'Nơi cấp phát thuốc đặc trị, kháng sinh và dịch truyền',
  },
  {
    id: 'lab',
    name: 'Phòng Xét Nghiệm Hóa Sinh',
    code: 'P-XN',
    type: 'LABORATORY',
    points: [
      { x: 660, y: 60 },
      { x: 880, y: 60 },
      { x: 880, y: 240 },
      { x: 660, y: 240 },
    ],
    dockPoint: { x: 770, y: 150 },
    doorPoint: { x: 770, y: 240 },
    color: '#8B5CF6',
    badgeBg: '#F5F3FF',
    department: 'Khoa Xét Nghiệm',
    description: 'Tiếp nhận ống mẫu máu, nước tiểu và phân tích tự động',
  },
  {
    id: 'icu',
    name: 'Phòng ICU - Cấp Cứu Đặc Biệt',
    code: 'ICU-VIP',
    type: 'EMERGENCY',
    points: [
      { x: 970, y: 60 },
      { x: 1140, y: 60 },
      { x: 1140, y: 240 },
      { x: 970, y: 240 },
    ],
    dockPoint: { x: 1055, y: 150 },
    doorPoint: { x: 970, y: 170 },
    color: '#EF4444',
    badgeBg: '#FEF2F2',
    department: 'Khoa Cấp Cứu 24/7',
    bedCount: 2,
    description: 'Phòng cách ly áp lực âm và giám sát sinh tồn liên tục',
  },
  {
    id: 'room-102',
    name: 'Phòng 102 - Nội Tim Mạch',
    code: 'P-102',
    type: 'PATIENT_ROOM',
    points: [
      { x: 60, y: 440 },
      { x: 240, y: 440 },
      { x: 240, y: 620 },
      { x: 60, y: 620 },
    ],
    dockPoint: { x: 150, y: 530 },
    doorPoint: { x: 240, y: 510 },
    color: '#F59E0B',
    badgeBg: '#FFFBEB',
    department: 'Khoa Tim Mạch Can Thiệp',
    bedCount: 6,
    description: 'Phòng lưu trú bệnh nhân phục hồi chức năng tim',
  },
  {
    id: 'pediatrics',
    name: 'Phòng 201 - Khoa Nhi',
    code: 'P-201',
    type: 'PATIENT_ROOM',
    points: [
      { x: 380, y: 440 },
      { x: 570, y: 440 },
      { x: 570, y: 620 },
      { x: 380, y: 620 },
    ],
    dockPoint: { x: 475, y: 530 },
    doorPoint: { x: 475, y: 440 },
    color: '#06B6D4',
    badgeBg: '#ECFEFF',
    department: 'Khoa Nhi Nội - Ngoại',
    bedCount: 5,
    description: 'Khu vực điều trị thân thiện cho bệnh nhi dưới 15 tuổi',
  },
  {
    id: 'ultrasound',
    name: 'Phòng Siêu Âm - Chẩn Đoán',
    code: 'P-SA',
    type: 'CLINIC',
    points: [
      { x: 660, y: 440 },
      { x: 880, y: 440 },
      { x: 880, y: 620 },
      { x: 660, y: 620 },
    ],
    dockPoint: { x: 770, y: 530 },
    doorPoint: { x: 770, y: 440 },
    color: '#14B8A6',
    badgeBg: '#F0FDFA',
    department: 'Khoa Chẩn Đoán Hình Ảnh',
    description: 'Siêu âm 4D, Doppler mạch máu và siêu âm tim',
  },
  {
    id: 'charging-dock',
    name: 'Trạm Sạc Robot MAR-01',
    code: 'DOCK-01',
    type: 'CHARGING_STATION',
    points: [
      { x: 970, y: 440 },
      { x: 1140, y: 440 },
      { x: 1140, y: 620 },
      { x: 970, y: 620 },
    ],
    dockPoint: { x: 1055, y: 530 },
    doorPoint: { x: 970, y: 510 },
    color: '#6366F1',
    badgeBg: '#EEF2FF',
    department: 'Kỹ Thuật & Vận Hành AMR',
    description: 'Đế sạc tự động không dây 48V cho robot điều dưỡng',
  },
];

// ===== 3. HỆ THỐNG ĐƯỜNG HÀNH LANG (WAYPOINT GRAPH TRÁNH TƯỜNG) =====
// Trục hành lang chính chạy ngang ở y = 340
const HALLWAY_Y = 340;

const CORRIDOR_JUNCTIONS: Record<string, Point2D> = {
  jWest: { x: 280, y: HALLWAY_Y },
  jCenterWest: { x: 475, y: HALLWAY_Y },
  jMid: { x: 615, y: HALLWAY_Y },
  jCenterEast: { x: 770, y: HALLWAY_Y },
  jEast: { x: 970, y: HALLWAY_Y },
};

/**
 * Thuật toán tính toán tuyến đường đi trong bệnh viện
 * Đảm bảo robot không đi xuyên tường, luôn ra cửa phòng -> vào hành lang -> rẽ vào cửa phòng đích
 */
export function calculateHospitalPath(start: Point2D, destinationZone: HospitalZone): Point2D[] {
  const path: Point2D[] = [{ x: Math.round(start.x), y: Math.round(start.y) }];

  // 1. Xác định điểm kết nối hành lang từ vị trí hiện tại
  let startJunction: Point2D;
  if (start.x < 380) {
    startJunction = CORRIDOR_JUNCTIONS.jWest;
  } else if (start.x < 590) {
    startJunction = CORRIDOR_JUNCTIONS.jCenterWest;
  } else if (start.x < 720) {
    startJunction = CORRIDOR_JUNCTIONS.jMid;
  } else if (start.x < 920) {
    startJunction = CORRIDOR_JUNCTIONS.jCenterEast;
  } else {
    startJunction = CORRIDOR_JUNCTIONS.jEast;
  }

  // Nếu vị trí hiện tại chưa nằm trên hành lang, di chuyển ra hành lang trước
  if (Math.abs(start.y - HALLWAY_Y) > 20) {
    path.push({ x: startJunction.x, y: start.y });
    path.push({ x: startJunction.x, y: HALLWAY_Y });
  }

  // 2. Xác định điểm kết nối hành lang của phòng đích
  let targetJunction: Point2D;
  switch (destinationZone.id) {
    case 'room-101':
    case 'room-102':
      targetJunction = CORRIDOR_JUNCTIONS.jWest;
      break;
    case 'pharmacy':
    case 'pediatrics':
      targetJunction = CORRIDOR_JUNCTIONS.jCenterWest;
      break;
    case 'lab':
    case 'ultrasound':
      targetJunction = CORRIDOR_JUNCTIONS.jCenterEast;
      break;
    case 'icu':
    case 'charging-dock':
    default:
      targetJunction = CORRIDOR_JUNCTIONS.jEast;
      break;
  }

  // 3. Nếu điểm bắt đầu hành lang khác điểm kết thúc hành lang, chèn các điểm trung gian trên hành lang
  if (startJunction.x !== targetJunction.x) {
    const junctions = [
      CORRIDOR_JUNCTIONS.jWest,
      CORRIDOR_JUNCTIONS.jCenterWest,
      CORRIDOR_JUNCTIONS.jMid,
      CORRIDOR_JUNCTIONS.jCenterEast,
      CORRIDOR_JUNCTIONS.jEast,
    ];

    const startIndex = junctions.findIndex((j) => j.x === startJunction.x);
    const targetIndex = junctions.findIndex((j) => j.x === targetJunction.x);

    if (startIndex !== -1 && targetIndex !== -1) {
      const step = startIndex < targetIndex ? 1 : -1;
      for (let i = startIndex + step; i !== targetIndex; i += step) {
        path.push({ x: junctions[i].x, y: HALLWAY_Y });
      }
      path.push({ x: targetJunction.x, y: HALLWAY_Y });
    }
  }

  // 4. Từ hành lang đi tới cửa phòng (doorPoint)
  path.push({ x: destinationZone.doorPoint.x, y: destinationZone.doorPoint.y });

  // 5. Từ cửa phòng tiến vào điểm dừng đỗ (dockPoint)
  path.push({ x: destinationZone.dockPoint.x, y: destinationZone.dockPoint.y });

  // Loại bỏ các điểm trùng nhau liên tiếp
  return path.filter((pt, idx, arr) => {
    if (idx === 0) return true;
    const prev = arr[idx - 1];
    return Math.abs(pt.x - prev.x) > 3 || Math.abs(pt.y - prev.y) > 3;
  });
}

// ===== 4. ZUSTAND STORE QUẢN LÝ ĐỒNG BỘ 2 CHIỀU =====

interface HospitalMapStore {
  // Data Contract
  mapConfig: MapConfig;
  zones: HospitalZone[];
  robotState: RobotState;

  // UI state
  selectedZoneId: string | null;
  isRobotScreenOpen: boolean;

  // Actions
  selectZone: (zoneId: string | null) => void;
  setRobotScreenOpen: (open: boolean) => void;
  dispatchRobotToZone: (zoneId: string) => void;
  cancelNavigation: () => void;
  emergencyStop: () => void;
  resumeNavigation: () => void;

  // Robot Touch Screen Kiosk Actions
  openCompartment: () => void;
  closeCompartment: () => void;
  confirmDelivery: () => void;
  completeMissionAndReturn: (dockId?: string) => void;

  // Ticker di chuyển
  updateRobotPositionStep: () => void;
}

let moveIntervalTimer: ReturnType<typeof setInterval> | null = null;

export const useHospitalMapStore = create<HospitalMapStore>((set, get) => ({
  mapConfig: {
    width: 1200,
    height: 680,
    resolution: 0.05,
  },
  zones: INITIAL_ZONES,
  robotState: {
    robotId: 'MAR-01',
    robotCode: 'MAR-GAZEBO-01',
    x: 1055, // Bắt đầu tại trạm sạc Charging Dock
    y: 530,
    heading: 180, // Quay hướng về phía hành lang
    status: 'IDLE',
    targetZoneId: null,
    path: [],
    speedMps: 0.5,
    compartmentOpen: false,
    deliveryConfirmed: false,
    etaSeconds: 0,
    distanceRemainingM: 0,
    batteryPercent: 94,
    lastUpdated: new Date().toISOString(),
  },
  selectedZoneId: null,
  isRobotScreenOpen: false,

  selectZone: (zoneId) => set({ selectedZoneId: zoneId }),
  setRobotScreenOpen: (open) => set({ isRobotScreenOpen: open }),

  dispatchRobotToZone: (zoneId: string) => {
    const { zones, robotState } = get();
    const target = zones.find((z) => z.id === zoneId);
    if (!target) return;

    // Dừng timer cũ nếu có
    if (moveIntervalTimer) {
      clearInterval(moveIntervalTimer);
      moveIntervalTimer = null;
    }

    const currentPos = { x: robotState.x, y: robotState.y };
    const computedPath = calculateHospitalPath(currentPos, target);

    // Tính tổng độ dài tuyến đường bằng mét (pixel * resolution)
    let totalPixels = 0;
    for (let i = 0; i < computedPath.length - 1; i++) {
      const dx = computedPath[i + 1].x - computedPath[i].x;
      const dy = computedPath[i + 1].y - computedPath[i].y;
      totalPixels += Math.sqrt(dx * dx + dy * dy);
    }
    const distanceM = Math.round(totalPixels * 0.05 * 10) / 10;
    const speed = 0.5; // 0.5 m/s
    const etaSec = Math.max(5, Math.round(distanceM / speed));

    set({
      selectedZoneId: zoneId,
      robotState: {
        ...robotState,
        status: 'NAVIGATING',
        targetZoneId: zoneId,
        path: computedPath,
        etaSeconds: etaSec,
        distanceRemainingM: distanceM,
        compartmentOpen: false,
        deliveryConfirmed: false,
        lastUpdated: new Date().toISOString(),
      },
    });

    // Bắt đầu vòng lặp di chuyển mượt mà (~30 fps = mỗi 33ms)
    moveIntervalTimer = setInterval(() => {
      get().updateRobotPositionStep();
    }, 33);
  },

  updateRobotPositionStep: () => {
    const { robotState } = get();
    if (robotState.status !== 'NAVIGATING' || robotState.path.length === 0) {
      if (moveIntervalTimer) {
        clearInterval(moveIntervalTimer);
        moveIntervalTimer = null;
      }
      return;
    }

    const path = [...robotState.path];
    const targetPoint = path[0];

    const dx = targetPoint.x - robotState.x;
    const dy = targetPoint.y - robotState.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);

    // Tốc độ di chuyển: ~120 pixel/giây tương đương ~4 pixel mỗi tick 33ms
    const stepSize = 4.2;

    if (distToTarget <= stepSize) {
      // Đã tới điểm waypoints này -> chuyển sang điểm tiếp theo
      path.shift();

      if (path.length === 0) {
        // ĐÃ TỚI ĐÍCH (ĐẾN PHÒNG CHỈ ĐỊNH)!
        if (moveIntervalTimer) {
          clearInterval(moveIntervalTimer);
          moveIntervalTimer = null;
        }

        set({
          robotState: {
            ...robotState,
            x: targetPoint.x,
            y: targetPoint.y,
            path: [],
            status: 'ARRIVED',
            etaSeconds: 0,
            distanceRemainingM: 0,
            lastUpdated: new Date().toISOString(),
          },
        });
        return;
      }

      // Vẫn còn điểm tiếp theo
      const nextPoint = path[0];
      const nextAngle = Math.atan2(nextPoint.y - targetPoint.y, nextPoint.x - targetPoint.x) * (180 / Math.PI);

      set({
        robotState: {
          ...robotState,
          x: targetPoint.x,
          y: targetPoint.y,
          path,
          heading: Math.round(nextAngle),
          lastUpdated: new Date().toISOString(),
        },
      });
    } else {
      // Tiến thêm một bước về phía targetPoint
      const angleRad = Math.atan2(dy, dx);
      const newX = robotState.x + Math.cos(angleRad) * stepSize;
      const newY = robotState.y + Math.sin(angleRad) * stepSize;
      const headingDeg = Math.round(angleRad * (180 / Math.PI));

      // Giảm dần ETA theo thời gian
      const newEta = Math.max(1, robotState.etaSeconds - 0.033);

      set({
        robotState: {
          ...robotState,
          x: Math.round(newX * 10) / 10,
          y: Math.round(newY * 10) / 10,
          heading: headingDeg,
          etaSeconds: Math.round(newEta),
          distanceRemainingM: Math.max(0, Math.round((distToTarget * 0.05) * 10) / 10),
          lastUpdated: new Date().toISOString(),
        },
      });
    }
  },

  cancelNavigation: () => {
    if (moveIntervalTimer) {
      clearInterval(moveIntervalTimer);
      moveIntervalTimer = null;
    }
    set((state) => ({
      robotState: {
        ...state.robotState,
        status: 'IDLE',
        path: [],
        targetZoneId: null,
        etaSeconds: 0,
        distanceRemainingM: 0,
      },
    }));
  },

  emergencyStop: () => {
    if (moveIntervalTimer) {
      clearInterval(moveIntervalTimer);
      moveIntervalTimer = null;
    }
    set((state) => ({
      robotState: {
        ...state.robotState,
        status: 'BLOCKED',
      },
    }));
  },

  resumeNavigation: () => {
    const { robotState } = get();
    if (robotState.status === 'BLOCKED' && robotState.path.length > 0) {
      set({
        robotState: {
          ...robotState,
          status: 'NAVIGATING',
        },
      });
      moveIntervalTimer = setInterval(() => {
        get().updateRobotPositionStep();
      }, 33);
    }
  },

  // ===== ROBOT ON-BOARD INTERFACE ACTIONS =====
  openCompartment: () => {
    set((state) => ({
      robotState: {
        ...state.robotState,
        compartmentOpen: true,
      },
    }));
  },

  closeCompartment: () => {
    set((state) => ({
      robotState: {
        ...state.robotState,
        compartmentOpen: false,
      },
    }));
  },

  confirmDelivery: () => {
    set((state) => ({
      robotState: {
        ...state.robotState,
        deliveryConfirmed: true,
      },
    }));
  },

  completeMissionAndReturn: (dockId = 'charging-dock') => {
    const { dispatchRobotToZone } = get();
    set((state) => ({
      robotState: {
        ...state.robotState,
        compartmentOpen: false,
        deliveryConfirmed: false,
      },
    }));
    // Tự động điều robot quay về Trạm sạc
    dispatchRobotToZone(dockId);
  },
}));
