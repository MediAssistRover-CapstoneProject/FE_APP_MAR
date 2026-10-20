import { env } from '../../config/env';
import { createApiRobotService } from './api';
import { createMockRobotService } from './mock';

export * from './types';
export { createApiRobotService } from './api';
export type { ApiRobotServiceOptions } from './api';
export { createMockRobotService } from './mock';

export const isDemoMode = env.useMock;

export const robotService = isDemoMode
  ? createMockRobotService(env.robotId)
  : createApiRobotService({
      baseUrl: env.robotApiUrl,
      robotId: env.robotId,
    });
