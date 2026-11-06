import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import { RobotDto, PageResponse } from '../types';

export interface RobotPoseDto {
  locationId?: string;
  robotLocationHistoryId?: string;
  robotId: string;
  mapId: string;
  jobId?: string | null;
  xM: number;
  yM: number;
  yawRad: number;
  localizationConfidence?: number;
  frameId?: string;
  source?: string;
  fresh?: boolean;
  capturedAt: string;
  receivedAt?: string;
}

export interface RobotNavigationPlanPointDto {
  xM: number;
  yM: number;
  yawRad?: number;
}

export interface RobotNavigationPlanDto {
  sessionId?: string;
  mapId?: string;
  mapAssetHash?: string;
  frameId?: string;
  initializationRevision?: number;
  jobId?: string;
  jobStepId?: string;
  points?: RobotNavigationPlanPointDto[];
}

export interface RobotSnapshotResponse {
  observedAt: string;
  robot: RobotDto;
  mqttConnected: boolean;
  heartbeatFresh: boolean;
  heartbeatAgeSeconds?: number;
  dispatchReady: boolean;
  sessionFailureReason?: string | null;
  activeJobId?: string | null;
  selectedJobStepId?: string | null;
  selectedStepType?: string | null;
  selectedStepCode?: string | null;
  latestPose?: RobotPoseDto | null;
  navigationSession?: Record<string, any> | null;
  navigationPlan?: RobotNavigationPlanDto | null;
}

export const robotApi = {
  // Lấy danh sách robot đang vận hành
  async getRobots(page = 0, size = 10, status?: string): Promise<PageResponse<RobotDto>> {
    const statusParam = status ? `&status=${status}` : '';
    return apiClient.get<PageResponse<RobotDto>>(
      `${ENDPOINTS.ROBOTS.LIST}?page=${page}&size=${size}${statusParam}`
    );
  },

  async getAllRobots(status?: string): Promise<RobotDto[]> {
    const first = await this.getRobots(0, 100, status);
    const robots = [...(first.content || [])];
    for (let page = 1; page < first.totalPages; page += 1) {
      const next = await this.getRobots(page, 100, status);
      robots.push(...(next.content || []));
    }
    return robots;
  },

  // Chi tiết robot theo ID
  async getRobotDetail(id: string): Promise<RobotDto> {
    return apiClient.get<RobotDto>(ENDPOINTS.ROBOTS.DETAIL(id));
  },

  // Lấy snapshot trạng thái + tọa độ định vị AMCL/Nav2 thời gian thực (GET /robots/{id}/snapshot)
  async getRobotSnapshot(id: string): Promise<RobotSnapshotResponse> {
    return apiClient.get<RobotSnapshotResponse>(ENDPOINTS.ROBOTS.SNAPSHOT(id));
  },

  // Lấy lịch sử tọa độ định vị của robot (GET /robots/{id}/location-history)
  async getRobotLocationHistory(
    id: string,
    page = 0,
    size = 5
  ): Promise<PageResponse<RobotPoseDto>> {
    return apiClient.get<PageResponse<RobotPoseDto>>(
      `${ENDPOINTS.ROBOTS.LOCATION_HISTORY(id)}?page=${page}&size=${size}`
    );
  },

  // Đưa robot vào chế độ bảo trì
  async setMaintenance(id: string, reason = 'Bảo trì theo yêu cầu của nhân viên'): Promise<RobotDto> {
    return apiClient.post<RobotDto>(ENDPOINTS.ROBOTS.MAINTENANCE(id), { reason });
  },

  // Đồng bộ trạng thái robot
  async reconcileRobot(id: string): Promise<RobotDto> {
    return apiClient.post<RobotDto>(ENDPOINTS.ROBOTS.RECONCILE(id), {});
  },
};
