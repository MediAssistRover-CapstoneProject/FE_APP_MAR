import { apiClient } from '../client';
import { ENDPOINTS } from '../endpoints';
import {
  MapResponse,
  FloorResponse,
  RoomDto,
  ZoneDto,
  EndpointResponse,
  EndpointGroupResponse,
  JobEventResponse,
  PageResponse,
  HospitalInformationRequest,
  HospitalInformationResponse,
} from '../types';

/**
 * Facility & Operations API Module (Staff Operations)
 * Truy vấn bản đồ, tầng, phòng, zone, tọa độ điểm đến (waypoints), nhóm điểm đến và sự kiện nhiệm vụ
 * Khớp 100% với Swagger Backend MediAssistRover
 */

export const facilityApi = {
  // 1. Bản đồ (Maps)
  async getMaps(page = 0, size = 10): Promise<PageResponse<MapResponse>> {
    return apiClient.get<PageResponse<MapResponse>>(
      `${ENDPOINTS.FACILITY.MAPS}?page=${page}&size=${size}`
    );
  },

  async getMapDetail(id: string): Promise<MapResponse> {
    return apiClient.get<MapResponse>(ENDPOINTS.FACILITY.MAP_DETAIL(id));
  },

  // 2. Tầng (Floors)
  async getFloors(page = 0, size = 10): Promise<PageResponse<FloorResponse>> {
    return apiClient.get<PageResponse<FloorResponse>>(
      `${ENDPOINTS.FACILITY.FLOORS}?page=${page}&size=${size}`
    );
  },

  async getFloorDetail(id: string): Promise<FloorResponse> {
    return apiClient.get<FloorResponse>(ENDPOINTS.FACILITY.FLOOR_DETAIL(id));
  },

  // 3. Phòng (Rooms)
  async getRooms(page = 0, size = 10): Promise<PageResponse<RoomDto>> {
    return apiClient.get<PageResponse<RoomDto>>(
      `${ENDPOINTS.FACILITY.ROOMS}?page=${page}&size=${size}`
    );
  },

  async getRoomDetail(id: string): Promise<RoomDto> {
    return apiClient.get<RoomDto>(ENDPOINTS.FACILITY.ROOM_DETAIL(id));
  },

  // 4. Phân khu (Zones)
  async getZones(page = 0, size = 10): Promise<PageResponse<ZoneDto>> {
    return apiClient.get<PageResponse<ZoneDto>>(
      `${ENDPOINTS.FACILITY.ZONES}?page=${page}&size=${size}`
    );
  },

  async getZoneDetail(id: string): Promise<ZoneDto> {
    return apiClient.get<ZoneDto>(ENDPOINTS.FACILITY.ZONE_DETAIL(id));
  },

  // 5. Tọa độ điểm đến / Waypoints (Endpoints)
  async getEndpoints(page = 0, size = 10): Promise<PageResponse<EndpointResponse>> {
    return apiClient.get<PageResponse<EndpointResponse>>(
      `${ENDPOINTS.FACILITY.ENDPOINTS}?page=${page}&size=${size}`
    );
  },

  async getEndpointDetail(id: string): Promise<EndpointResponse> {
    return apiClient.get<EndpointResponse>(ENDPOINTS.FACILITY.ENDPOINT_DETAIL(id));
  },

  // 6. Nhóm điểm đến (Endpoint Groups)
  async getEndpointGroups(page = 0, size = 10): Promise<PageResponse<EndpointGroupResponse>> {
    return apiClient.get<PageResponse<EndpointGroupResponse>>(
      `${ENDPOINTS.FACILITY.ENDPOINT_GROUPS}?page=${page}&size=${size}`
    );
  },

  // 7. Lịch sử sự kiện tiến trình của nhiệm vụ (Job Events)
  async getJobEvents(jobId: string): Promise<JobEventResponse[]> {
    return apiClient.get<JobEventResponse[]>(ENDPOINTS.JOBS.EVENTS(jobId));
  },

  // 8. Các loại bước quy trình (Step Types)
  async getStepTypes(): Promise<string[]> {
    return apiClient.get<string[]>(ENDPOINTS.WORKFLOWS.STEP_TYPES);
  },

  // 9. Thông tin Bệnh viện (Hospital Information - Staff Operations)
  async getHospitalInformation(page = 0, size = 10): Promise<PageResponse<HospitalInformationResponse>> {
    return apiClient.get<PageResponse<HospitalInformationResponse>>(
      `${ENDPOINTS.FACILITY.HOSPITAL_INFO}?page=${page}&size=${size}`
    );
  },

  async createHospitalInformation(data: HospitalInformationRequest): Promise<HospitalInformationResponse> {
    return apiClient.post<HospitalInformationResponse>(
      ENDPOINTS.FACILITY.HOSPITAL_INFO,
      data
    );
  },
};
