/**
 * Kiểu dữ liệu TypeScript cho toàn bộ Request & Response của API
 */

// Định dạng Response chuẩn từ Backend
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  timestamp?: string;
}

// Định dạng lỗi chuẩn
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

// ----- 1. Auth Types -----
export interface LoginRequest {
  usernameOrEmail: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  user: {
    id: string;
    name: string;
    role: string;
    email: string;
    isOnDuty: boolean;
  };
}

export interface SendOtpRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  newPassword: string;
}

// ----- 2. Robot Types -----
export interface RobotStatusResponse {
  robotId: string;
  robotName: string;
  battery: number;           // ví dụ: 82 (%)
  status: 'running' | 'paused' | 'charging' | 'emergency';
  currentZone: string;       // ví dụ: 'Khu chờ'
  connection: 'stable' | 'weak' | 'disconnected';
  estimatedArrivalMinutes: number; // ví dụ: 8
  destinationRoom: string;   // ví dụ: 'P. Tim mạch'
}

export interface RobotTelemetryResponse {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

// ----- 3. Mission Types -----
export type SecurityLevel = 'none' | 'qr' | 'face';
export type PriorityLevel = 'high' | 'normal' | 'low';

export interface CreateMissionRequest {
  taskTypes: string[];       // ['van_chuyen_thuoc', ...]
  itemName: string;          // 'Đơn thuốc #BN2047'
  quantity: number;          // 1
  fromRoom: string;          // 'Nhà thuốc'
  toRoom: string;            // 'P. Tim mạch'
  sender: string;            // 'KTV. Nguyễn Minh Tuấn'
  receiver: string;          // 'BS. Trần Thị Lan'
  securityLevel: SecurityLevel;
  priority: PriorityLevel;
  deadline?: string;         // '09:30'
  notes?: string;            // 'Thuốc huyết áp khẩn'
  faceImageData?: string;    // Base64 ảnh đăng ký khuôn mặt
}

export interface QueueItemDto {
  id: number;
  code: string;              // '#TD01'
  title: string;             // 'Đơn thuốc #BN2047'
  fromRoom: string;          // 'Nhà thuốc'
  toRoom: string;            // 'P. Tim mạch'
  priority: PriorityLevel;
  time: string;              // '09:05'
  type: 'medicine' | 'document' | 'blood' | 'supplies';
}

export interface TaskStepDto {
  id: number;
  label: string;
  status: 'completed' | 'in_progress' | 'upcoming';
  timestamp?: string;
}

export interface MissionDetailDto {
  id: string;
  code: string;              // '#TD01'
  title: string;             // 'Vận chuyển thuốc'
  itemName: string;          // 'Đơn thuốc #BN2047'
  priority: PriorityLevel;
  securityLevel: SecurityLevel;
  deadline: string;          // '09:30'
  fromRoom: string;
  toRoom: string;
  notes: string;
  steps: TaskStepDto[];
}

export type StaffActionType = 'pause' | 'return_item' | 'wait_more' | 'reverify';
