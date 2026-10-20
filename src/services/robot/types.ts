export type DestinationCategory =
  | 'clinic'
  | 'lab'
  | 'pharmacy'
  | 'payment'
  | 'service';

export interface Destination {
  id: string;
  name: string;
  category: DestinationCategory;
  floor: string;
  description: string;
}

export interface RobotStatus {
  id: string;
  name: string;
  battery: number;
  location: string;
  availability: 'available' | 'busy' | 'offline';
}

export interface NavigationTask {
  id: string;
  destinationId: string;
  destinationName: string;
  mode: 'directions' | 'escort';
  status: 'active' | 'stopped' | 'arrived' | 'blocked' | 'pending';
  steps: string[];
  currentStep: number;
}

export interface AssistantReply {
  message: string;
}

export interface SosReceipt {
  id: string;
  status: 'received';
  createdAt: string;
}

export interface RobotService {
  getStatus(): Promise<RobotStatus>;
  getDestinations(): Promise<Destination[]>;
  getActiveNavigation(): Promise<NavigationTask | null>;
  startNavigation(
    destinationId: string,
    mode: NavigationTask['mode'],
  ): Promise<NavigationTask>;
  getNavigation(taskId: string): Promise<NavigationTask>;
  stopNavigation(taskId: string): Promise<NavigationTask>;
  sendMessage(message: string): Promise<AssistantReply>;
  requestSos(): Promise<SosReceipt>;
}

export type RobotErrorCode =
  | 'configuration'
  | 'validation'
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'not_found'
  | 'conflict'
  | 'server'
  | 'invalid_response';

export class RobotServiceError extends Error {
  readonly code: RobotErrorCode;
  readonly requestId?: string;
  readonly httpStatus?: number;

  constructor(
    code: RobotErrorCode,
    message: string,
    details?: { requestId?: string; httpStatus?: number },
  ) {
    super(message);
    this.name = 'RobotServiceError';
    this.code = code;
    this.requestId = details?.requestId;
    this.httpStatus = details?.httpStatus;
  }
}
