/**
 * Kiểu dữ liệu TypeScript cho toàn bộ Request & Response của API MediAssistRover
 * Đồng bộ chính xác với Backend Swagger Spec: https://bemar-production.up.railway.app
 */

// Định dạng lỗi chuẩn
export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

// ----- 1. Auth Types -----
export interface LoginRequest {
  username: string;
  password: string;
  deviceInfo?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  accessTokenExpiresAt: string;
  refreshTokenExpiresAt: string;
  mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfileResponse {
  accountId: string;
  accountCode: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'STAFF' | string;
  authProvider: string;
  status: 'ACTIVE' | 'INACTIVE' | string;
  lastLoginAt?: string;
  mustChangePassword: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// ----- 2. Paged Response Format -----
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

// ----- 3. Robot Types -----
export interface RobotDto {
  robotId: string;
  currentMapId?: string;
  robotCode: string;
  robotName: string;
  model: string;
  serialNumber?: string | null;
  runtimeVersion?: string;
  status: 'OFFLINE' | 'STARTING' | 'IDLE' | 'BUSY' | 'EMERGENCY_STOP' | 'ERROR' | 'MAINTENANCE';
  batteryRaw?: number;
  batteryPercent?: number | null;
  batteryCapturedAt?: string;
  lastHeartbeatAt?: string;
}

// ----- 4. Room, Floor & Zone Types -----
export interface RoomDto {
  roomId: string;
  roomCode: string;
  roomName: string;
  floorId?: string;
  zoneId?: string;
  status?: string;
  description?: string;
}

export interface FloorDto {
  floorId: string;
  floorCode: string;
  floorName: string;
  floorNumber: number;
  status?: string;
}

export interface FloorResponse {
  floorId: string;
  hospitalInformationId?: string;
  floorCode: string;
  floorName: string;
  levelNo: number;
  displayOrder?: number;
  description?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ZoneDto {
  zoneId: string;
  zoneCode: string;
  zoneName: string;
  status?: string;
}

export interface MapResponse {
  mapId: string;
  floorId: string;
  mapCode: string;
  versionNo: number;
  mapName: string;
  widthM: number;
  heightM: number;
  resolutionMPerPixel: number;
  originXM: number;
  originYM: number;
  originYawRad: number;
  frameId: string;
  mapFileUri: string;
  assetHash?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  commissionedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EndpointResponse {
  endpointId: string;
  mapId: string;
  zoneId?: string | null;
  roomId?: string | null;
  endpointCode: string;
  endpointName: string;
  endpointType: 'WAYPOINT' | 'CHARGING_STATION' | 'WAITING_AREA' | 'ROOM_ENTRANCE' | string;
  xM: number;
  yM: number;
  yawRad: number;
  active: boolean;
  accessible: boolean;
  publicVisible: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EndpointGroupResponse {
  endpointGroupId: string;
  groupCode: string;
  groupName: string;
  strategy?: string;
  active?: boolean;
}

// ----- 5. Alert & Incident Types -----
export interface AlertDto {
  alertId: string;
  code?: string;
  title: string;
  description?: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  status: 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED';
  robotId?: string;
  location?: string;
  createdAt: string;
}

export interface AlertResponse {
  alertId: string;
  incidentId?: string | null;
  jobStepId?: string | null;
  serviceRequestId?: string | null;
  zoneId?: string | null;
  notificationType?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
  message?: string;
  dataJson?: any;
  requireAck?: boolean;
  ackPolicy?: 'ANY' | 'ALL';
  createdAt?: string;
  expiresAt?: string;
  rowVersion?: number;
  recipients?: any[];
}

export interface AlertQueryParams {
  status?: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'CLOSED';
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export interface IncidentResponse {
  incidentId: string;
  robotId?: string;
  mapId?: string;
  endpointId?: string;
  acknowledgedByAccountId?: string;
  resolvedByAccountId?: string;
  incidentType?: string;
  severity: 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'FALSE_ALARM';
  description?: string;
  xM?: number;
  yM?: number;
  occurredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  rowVersion?: number;
}

export interface ResolutionPayload {
  resolutionNote: string;
  evidence?: any;
}

export interface EmergencyIncidentDto extends Partial<IncidentResponse> {
  incidentCode?: string;
  type?: string;
  location?: string;
  createdAt?: string;
}

// ----- 6. Mission & Job Types -----
export type SecurityLevel = 'none' | 'qr' | 'face';
export type PriorityLevel = 'high' | 'normal' | 'low';

export interface JobDto {
  jobId: string;
  jobCode: string;
  robotId?: string;
  status: 'PENDING' | 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'PAUSED';
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  title?: string;
  fromLocation?: string;
  toLocation?: string;
  createdAt?: string;
}

export interface DeliveryItemResponse {
  deliveryItemId?: string;
  itemCode?: string;
  itemName: string;
  itemCategory?: string;
  quantity?: number;
  unit?: string;
  sensitive?: boolean;
  handlingInstruction?: string;
  itemNote?: string;
}

export interface ServiceRequestInfo {
  requestId: string;
  requestCode?: string;
  title?: string;
  status?: string;
  priority?: string;
  createdAt?: string;
}

export interface DeliveryResponse {
  request?: ServiceRequestInfo;
  mapId?: string;
  pickupRoomId?: string;
  deliveryRoomId?: string;
  pickupEndpointId?: string;
  deliveryEndpointId?: string;
  deliveryGroupId?: string;
  resolvedDeliveryEndpointId?: string;
  senderAccountId?: string;
  receiverAccountId?: string;
  targetMode?: 'ENDPOINT' | 'ENDPOINT_GROUP';
  recipientName?: string;
  recipientContact?: string;
  requiresConfirmation?: boolean;
  temperatureRequirement?: string;
  deliveryDeadline?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  pickupCompartmentConfirmedAt?: string;
  deliveryCompartmentConfirmedAt?: string;
  pickupPayloadConfirmedAt?: string;
  deliveryPayloadConfirmedAt?: string;
  deliveryNote?: string;
  items?: DeliveryItemResponse[];
}

export interface CreateDeliveryPayload {
  mapId: string;
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  pickupEndpointId: string;
  deliveryEndpointId?: string;
  pickupRoomId?: string;
  deliveryRoomId?: string;
  recipientName: string;
  recipientContact?: string;
  deliveryDeadline?: string;
  requiresConfirmation?: boolean;
  deliveryNote?: string;
  items: DeliveryItemResponse[];
}

// ----- 7. QR & Authentication Grant Verification Types -----
export interface QrChallengeResponse {
  challengeId: string;
  jobId: string;
  authJobStepId: string;
  purpose: 'DELIVERY_SENDER' | 'DELIVERY_RECEIVER';
  proof: string;
  expiresAt: string;
}

export interface IssueQrChallengeRequest {
  authJobStepId: string;
  purpose: 'DELIVERY_SENDER' | 'DELIVERY_RECEIVER';
  validForSeconds?: number;
}

export interface VerifyQrRequest {
  proof: string;
}

export interface AuthVerificationResponse {
  verificationId: string;
  jobId: string;
  authJobStepId: string;
  actorAccountId?: string;
  usedByJobStepId?: string;
  method: 'QR_CODE' | 'STAFF_CONFIRMATION';
  purpose: 'DELIVERY_SENDER' | 'DELIVERY_RECEIVER';
  requiredPermission?: string;
  issuedAt?: string;
  validUntil?: string;
  revokedAt?: string;
}

// ----- 8. Schedule Types (Staff Operations) -----
export interface ScheduleResponse {
  scheduleId: string;
  workflowId: string;
  robotId?: string | null;
  createdByAccountId?: string;
  scheduleCode: string;
  scheduleName: string;
  scheduleType: string;
  timezone: string;
  startsAt?: string | null;
  endsAt?: string | null;
  intervalSec?: number | null;
  cronExpression?: string | null;
  inputTemplateJson?: any;
  priority?: number;
  misfirePolicy?: 'SKIP' | 'FIRE_ONCE';
  status: 'ACTIVE' | 'PAUSED' | 'RETIRED';
  nextRunAt?: string | null;
  lastRunAt?: string | null;
  rowVersion?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleQueryParams {
  status?: 'ACTIVE' | 'PAUSED' | 'RETIRED';
  page?: number;
  size?: number;
}

// ----- 9. Job Event Types -----
export interface JobEventResponse {
  jobEventId: string;
  jobId: string;
  robotId?: string | null;
  jobTaskId?: string | null;
  jobStepId?: string | null;
  actorAccountId?: string | null;
  producerType: 'SERVER' | 'ROBOT' | 'ADMIN' | 'STAFF' | 'SCHEDULER';
  eventType: string;
  newStatus?: string;
  previousStatus?: string;
  eventDataJson?: any;
  occurredAt?: string;
}

// ----- 10. Hospital Information Types (Staff Operations /createHospital) -----
export interface HospitalInformationRequest {
  title: string;
  content: string;
  infoCategory: 'GENERAL' | 'HOSPITAL_PROFILE' | string;
  languageCode?: string;
  keywordsJson?: string[];
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
}

export interface HospitalInformationResponse {
  hospitalInformationId: string;
  title: string;
  content: string;
  infoCategory: string;
  languageCode: string;
  keywordsJson?: string[];
  status?: string;
  publicVisible?: boolean;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
  // Legacy / convenience fields
  hospitalCode?: string;
  hospitalName?: string;
  phone?: string;
  address?: string;
  website?: string;
  active?: boolean;
}

// ----- 11. Staff Profile & Shifts Types -----
export interface StaffProfileSummary {
  staffProfileId: string;
  staffCode: string;
  departmentCode: string;
  jobTitle: string;
  contactExtension?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SlotResponse {
  slotId?: string;
  slotCode?: string;
  slotName?: string;
  startTime?: string;
  endTime?: string;
}

export interface ShiftResponse {
  shiftId: string;
  staffProfileId: string;
  staffCode: string;
  roomId?: string | null;
  roomCode?: string | null;
  shiftCode: string;
  shiftName: string;
  startsAt: string;
  endsAt: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  note?: string | null;
  slots?: SlotResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface StaffMeResponse {
  account: UserProfileResponse;
  staffProfile: StaffProfileSummary;
  activeShifts: ShiftResponse[];
}

export interface ShiftQueryParams {
  status?: 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  page?: number;
  size?: number;
}

// ----- 12. Service Request Types -----
export type ServiceRequestStatus = 'DRAFT' | 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export interface ServiceRequestResponse {
  serviceRequestId: string;
  requestedByAccountId: string;
  requestedRobotId?: string | null;
  requestCode: string;
  requestType: 'NAVIGATION' | 'ESCORT' | 'DELIVERY' | 'OPERATIONAL';
  sourceType: string;
  priority: number;
  status: ServiceRequestStatus;
  requestNote?: string | null;
  requestDataJson?: any;
  idempotencyKey?: string;
  requestedAt: string;
  scheduledAt?: string | null;
  cancelledAt?: string | null;
  completedAt?: string | null;
  rowVersion?: number;
  updatedAt?: string;
}

// ----- 13. Navigation & Escort Dispatch Types -----
export interface NavigationCreateRequest {
  mapId: string;
  navigationMode: 'STANDARD' | 'ACCESSIBLE';
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  destinationEndpointId?: string | null;
  destinationGroupId?: string | null;
  roomId?: string | null;
  originEndpointId?: string | null;
  accessibilityNeed?: string | null;
  passengerCount: number;
  arrivalInstruction?: string | null;
  priority?: number;
  note?: string | null;
  data?: any;
}

export interface NavigationResponse {
  request: ServiceRequestResponse;
  mapId: string;
  workflowId?: string | null;
  roomId?: string | null;
  originEndpointId?: string | null;
  destinationEndpointId?: string | null;
  destinationGroupId?: string | null;
  resolvedEndpointId?: string | null;
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  navigationMode: 'STANDARD' | 'ACCESSIBLE';
  accessibilityNeed?: string | null;
  passengerCount: number;
  arrivalInstruction?: string | null;
}

export interface EscortCreateRequest {
  mapId: string;
  escortMode: 'GUIDED' | 'ASSISTED';
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  walkingSpeedMps: number; // 0.1 - 0.3
  originRoomId?: string | null;
  destinationRoomId?: string | null;
  originEndpointId?: string | null;
  destinationEndpointId?: string | null;
  destinationGroupId?: string | null;
  patientReference?: string | null;
  confirmationTimeoutSec?: number;
  escortNote?: string | null;
  priority?: number;
  note?: string | null;
  data?: any;
}

export interface EscortResponse {
  request: ServiceRequestResponse;
  mapId: string;
  originRoomId?: string | null;
  destinationRoomId?: string | null;
  originEndpointId?: string | null;
  destinationEndpointId?: string | null;
  destinationGroupId?: string | null;
  resolvedEndpointId?: string | null;
  targetMode: 'ENDPOINT' | 'ENDPOINT_GROUP';
  patientReference?: string | null;
  escortMode: 'GUIDED' | 'ASSISTED';
  walkingSpeedMps: number;
  confirmationTimeoutSec?: number;
  escortNote?: string | null;
}

// ----- 14. Job Operations & Lifecycle Types -----
export type JobStatus =
  | 'QUEUED'
  | 'ACCEPTED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'RECOVERY_REQUIRED';

export interface JobResponse {
  jobId: string;
  workflowId?: string | null;
  serviceRequestId?: string | null;
  scheduleId?: string | null;
  robotId?: string | null;
  mapId: string;
  assignedStaffAccountId?: string | null;
  jobCode: string;
  status: JobStatus;
  priority: number;
  inputJson?: any;
  contextJson?: any;
  resultJson?: any;
  workflowHash?: string;
  protocolVersion?: number;
  schemaVersion?: number;
  graphVersion?: number;
  dispatchCommandId?: string | null;
  dispatchExpiresAt?: string | null;
  queuedAt?: string | null;
  acceptedAt?: string | null;
  startedAt?: string | null;
  cancelCommandId?: string | null;
  cancelRequestedAt?: string | null;
  endedAt?: string | null;
  errorCode?: string | null;
  failureReason?: string | null;
  reconciledAt?: string | null;
  reconciliationNote?: string | null;
  rowVersion?: number;
  beOrchestrated?: boolean;
  selectedJobStepId?: string | null;
}

export interface CancelJobRequest {
  reason: string;
}

export interface JobQueryParams {
  status?: JobStatus;
  workflowId?: string;
  requestId?: string;
  robotId?: string;
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

