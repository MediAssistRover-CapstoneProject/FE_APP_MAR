/**
 * Danh sách toàn bộ Endpoint của hệ thống MediAssistRover Backend (Railway)
 * Quản lý tập trung, khớp 100% với Swagger Backend API
 */

export const ENDPOINTS = {
  // 1. Xác thực & Tài khoản
  AUTH: {
    LOGIN: '/auth/login',
    CHANGE_PASSWORD: '/auth/change-password',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
  },

  // 2. Thông tin nhân viên & Ca trực (Staff Profile & Shifts)
  STAFF: {
    ME: '/staff/me',
    PROFILE: '/staff/profile',
    SHIFTS: '/staff/shifts',
    SHIFT_DETAIL: (shiftId: string) => `/staff/shifts/${shiftId}`,
  },

  // 3. Robot & Điều khiển
  ROBOTS: {
    LIST: '/robots',
    DETAIL: (id: string) => `/robots/${id}`,
    MAINTENANCE: (id: string) => `/robots/${id}/maintenance`,
    RECONCILE: (id: string) => `/robots/${id}/reconcile`,
  },

  // 4. Bản đồ, Tầng, Phòng, Zone, Endpoint & Thông tin bệnh viện (Staff Operations)
  FACILITY: {
    FLOORS: '/floors',
    FLOOR_DETAIL: (id: string) => `/floors/${id}`,
    ROOMS: '/rooms',
    ROOM_DETAIL: (id: string) => `/rooms/${id}`,
    ZONES: '/zones',
    ZONE_DETAIL: (id: string) => `/zones/${id}`,
    MAPS: '/maps',
    MAP_DETAIL: (id: string) => `/maps/${id}`,
    ENDPOINTS: '/endpoints',
    ENDPOINT_DETAIL: (id: string) => `/endpoints/${id}`,
    ENDPOINT_GROUPS: '/endpoint-groups',
    ENDPOINT_GROUP_DETAIL: (id: string) => `/endpoint-groups/${id}`,
    HOSPITAL_INFO: '/hospital-information',
    HOSPITAL_INFO_DETAIL: (id: string) => `/hospital-information/${id}`,
    HOSPITAL_ARTICLES: (hospitalId: string) => `/hospital-information/${hospitalId}/articles`,
    HOSPITAL_ARTICLE_DETAIL: (hospitalId: string, articleId: string) => `/hospital-information/${hospitalId}/articles/${articleId}`,
  },

  // 5. Nhiệm vụ & Giao hàng (Jobs & Delivery)
  JOBS: {
    LIST: '/jobs',
    DETAIL: (id: string) => `/jobs/${id}`,
    EVENTS: (id: string) => `/jobs/${id}/events`,
    CANCEL: (id: string) => `/jobs/${id}/cancel`,
    ASSIGN_ROBOT: (id: string) => `/jobs/${id}/assign-robot`,
    ASSIGN_STAFF: (id: string) => `/jobs/${id}/assign-staff`,
    RECOVERY: (jobId: string) => `/jobs/${jobId}/operations/recovery`,
  },

  SERVICE_REQUESTS: {
    LIST: '/service-requests',
    DETAIL: (id: string) => `/service-requests/${id}`,
    SUBMIT: (id: string) => `/service-requests/${id}/submit`,
    CANCEL: (id: string) => `/service-requests/${id}/cancel`,
  },

  DELIVERY: {
    REQUESTS: '/delivery-requests',
    REQUEST_DETAIL: (id: string) => `/delivery-requests/${id}`,
    OPERATIONAL_REQUESTS: '/operational-requests',
    NAVIGATION_REQUESTS: '/navigation-requests',
    ESCORT_REQUESTS: '/escort-requests',
    QR_CHALLENGE: (jobId: string) => `/jobs/${jobId}/qr-challenges`,
    QR_VERIFY: (jobId: string) => `/jobs/${jobId}/qr-verifications`,
    AUTH_VERIFY: (jobId: string) => `/jobs/${jobId}/auth-verifications`,
  },

  // 6. Cảnh báo (Alerts - Staff alert lifecycle)
  ALERTS: {
    LIST: '/alerts',
    DETAIL: (id: string) => `/alerts/${id}`,
    ACKNOWLEDGE: (id: string) => `/alerts/${id}/acknowledge`,
    RESOLVE: (id: string) => `/alerts/${id}/resolve`,
    CLOSE: (id: string) => `/alerts/${id}/close`,
    DISMISS: (id: string) => `/alerts/${id}/dismiss`,
  },

  // 7. Sự cố khẩn cấp (Emergency Incidents)
  INCIDENTS: {
    LIST: '/emergency-incidents',
    DETAIL: (id: string) => `/emergency-incidents/${id}`,
    ACKNOWLEDGE: (id: string) => `/emergency-incidents/${id}/acknowledge`,
    START: (id: string) => `/emergency-incidents/${id}/start`,
    RESOLVE: (id: string) => `/emergency-incidents/${id}/resolve`,
    FALSE_ALARM: (id: string) => `/emergency-incidents/${id}/false-alarm`,
    CLOSE: (id: string) => `/emergency-incidents/${id}/close`,
  },

  // 8. Workflows
  WORKFLOWS: {
    LIST: '/workflows',
    DETAIL: (id: string) => `/workflows/${id}`,
    STEP_TYPES: '/workflows/step-types',
  },

  // 9. Lịch trình định kỳ Robot (Schedules)
  SCHEDULES: {
    LIST: '/schedules',
    DETAIL: (id: string) => `/schedules/${id}`,
    ACTIVATE: (id: string) => `/schedules/${id}/activate`,
    PAUSE: (id: string) => `/schedules/${id}/pause`,
    RETIRE: (id: string) => `/schedules/${id}/retire`,
  },
};
