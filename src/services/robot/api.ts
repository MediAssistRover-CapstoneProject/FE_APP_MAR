import {
  NavigationTask,
  RobotService,
  RobotServiceError,
} from './types';
import {
  requiredInput,
  validateDestinations,
  validateNavigation,
  validateReply,
  validateSos,
  validateStatus,
} from './validation';

export interface ApiRobotServiceOptions {
  baseUrl: string;
  robotId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  // Wire this to a secure authentication provider when the backend is ready.
  getAccessToken?: () => Promise<string | null>;
}

let requestSequence = 0;

function createRequestId(): string {
  requestSequence += 1;
  return [
    'app',
    Date.now().toString(36),
    requestSequence.toString(36),
    Math.random().toString(36).slice(2, 10),
  ].join('-');
}

function normalizeBaseUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error('Invalid URL');
    }
    return url.toString().replace(/\/+$/, '');
  } catch {
    throw new RobotServiceError(
      'configuration',
      'Chưa cấu hình địa chỉ API robot hợp lệ. Vui lòng kiểm tra EXPO_PUBLIC_ROBOT_API_URL.',
    );
  }
}

function httpError(status: number, requestId: string): RobotServiceError {
  const details = { httpStatus: status, requestId };
  if (status === 401 || status === 403) {
    return new RobotServiceError(
      'unauthorized',
      'Phiên kết nối chưa được cấp quyền. Vui lòng liên hệ nhân viên hỗ trợ.',
      details,
    );
  }
  if (status === 404) {
    return new RobotServiceError(
      'not_found',
      'Không tìm thấy robot hoặc tác vụ được yêu cầu.',
      details,
    );
  }
  if (status === 409) {
    return new RobotServiceError(
      'conflict',
      'Robot chưa thể nhận yêu cầu này. Vui lòng kiểm tra trạng thái robot.',
      details,
    );
  }
  return new RobotServiceError(
    'server',
    'Hệ thống chưa xác nhận yêu cầu. Vui lòng kiểm tra kết nối hoặc liên hệ nhân viên hỗ trợ.',
    details,
  );
}

function matchingNavigation(
  value: unknown,
  expected: Partial<Pick<NavigationTask, 'id' | 'destinationId' | 'mode'>>,
): NavigationTask {
  const task = validateNavigation(value);
  if (
    (expected.id !== undefined && task.id !== expected.id) ||
    (expected.destinationId !== undefined &&
      task.destinationId !== expected.destinationId) ||
    (expected.mode !== undefined && task.mode !== expected.mode)
  ) {
    throw new RobotServiceError(
      'invalid_response',
      'Phản hồi không khớp với hành trình đã yêu cầu. Vui lòng kiểm tra với nhân viên hỗ trợ.',
    );
  }
  return task;
}

export function createApiRobotService(
  options: ApiRobotServiceOptions,
): RobotService {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 12_000;

  async function request<T>(
    path: string,
    validate: (value: unknown) => T,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const baseUrl = normalizeBaseUrl(options.baseUrl);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RobotServiceError(
        'configuration',
        'Thời gian chờ kết nối API phải lớn hơn 0.',
      );
    }
    const requestId = createRequestId();
    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    const operation = async (): Promise<T> => {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Request-ID': requestId,
      };
      if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
        // Backend must persist this key and de-duplicate mutations.
        headers['Idempotency-Key'] = requestId;
      }
      const token = await options.getAccessToken?.();
      if (controller.signal.aborted) {
        throw new RobotServiceError('timeout', 'Đã hết thời gian chờ kết nối.');
      }
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetchImpl(`${baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw httpError(response.status, requestId);

      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw new RobotServiceError(
          'invalid_response',
          'Phản hồi từ robot không đúng định dạng. Vui lòng liên hệ nhân viên hỗ trợ.',
          { requestId },
        );
      }
      return validate(value);
    };

    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(
              new RobotServiceError(
                'timeout',
                'Hết thời gian chờ. Chưa xác nhận được kết quả yêu cầu; vui lòng kiểm tra trạng thái trước khi thử lại.',
                { requestId },
              ),
            );
          }, timeoutMs);
        }),
      ]);
    } catch (error) {
      if (timedOut) {
        throw new RobotServiceError(
          'timeout',
          'Hết thời gian chờ. Chưa xác nhận được kết quả yêu cầu; vui lòng kiểm tra trạng thái trước khi thử lại.',
          { requestId },
        );
      }
      if (error instanceof RobotServiceError) {
        if (error.requestId) throw error;
        throw new RobotServiceError(error.code, error.message, {
          requestId,
          httpStatus: error.httpStatus,
        });
      }
      throw new RobotServiceError(
        'network',
        'Không kết nối được với hệ thống. Chưa xác nhận được yêu cầu; vui lòng liên hệ trực tiếp nhân viên khi cần hỗ trợ khẩn cấp.',
        { requestId },
      );
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }

  function robotPath(): string {
    return `/robots/${encodeURIComponent(requiredInput(options.robotId, 'Mã robot'))}`;
  }

  return {
    async getStatus() {
      return request(`${robotPath()}/status`, validateStatus);
    },
    async getDestinations() {
      return request('/destinations', validateDestinations);
    },
    async getActiveNavigation() {
      return request(`${robotPath()}/navigation/active`, (value) => {
        if (value === null) return null;
        const task = validateNavigation(value);
        if (task.status === 'stopped' || task.status === 'arrived') {
          throw new RobotServiceError(
            'invalid_response',
            'Tác vụ đang hoạt động có trạng thái chưa hợp lệ. Vui lòng kiểm tra với nhân viên hỗ trợ.',
          );
        }
        return task;
      });
    },
    async startNavigation(destinationId, mode) {
      const id = requiredInput(destinationId, 'Điểm đến');
      if (mode !== 'directions' && mode !== 'escort') {
        throw new RobotServiceError(
          'validation',
          'Chế độ điều hướng không hợp lệ.',
        );
      }
      return request(
        `${robotPath()}/navigation`,
        (value) => matchingNavigation(value, { destinationId: id, mode }),
        { destinationId: id, mode },
      );
    },
    async getNavigation(taskId) {
      const id = requiredInput(taskId, 'Mã tác vụ');
      return request(
        `/navigation/${encodeURIComponent(id)}`,
        (value) => matchingNavigation(value, { id }),
      );
    },
    async stopNavigation(taskId) {
      const id = requiredInput(taskId, 'Mã tác vụ');
      return request(
        `/navigation/${encodeURIComponent(id)}/stop`,
        (value) => matchingNavigation(value, { id }),
        {},
      );
    },
    async sendMessage(message) {
      const text = requiredInput(message, 'Câu hỏi');
      if (text.length > 2_000) {
        throw new RobotServiceError(
          'validation',
          'Vui lòng rút gọn câu hỏi còn tối đa 2.000 ký tự.',
        );
      }
      return request('/assistant/messages', validateReply, {
        robotId: requiredInput(options.robotId, 'Mã robot'),
        message: text,
      });
    },
    async requestSos() {
      return request(`${robotPath()}/sos`, validateSos, {});
    },
  };
}
