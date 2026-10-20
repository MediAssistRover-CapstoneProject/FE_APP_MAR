import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApiRobotService } from '../src/services/robot/api';
import { createMockRobotService } from '../src/services/robot/mock';

const validStatus = {
  id: 'MAR-01',
  name: 'Robot hỗ trợ ngoại trú',
  battery: 86,
  location: 'Sảnh tiếp đón',
  availability: 'available',
};

const validTask = {
  id: 'nav-001',
  destinationId: 'reception',
  destinationName: 'Quầy tiếp đón',
  mode: 'escort',
  status: 'active',
  steps: ['Bắt đầu tại sảnh tiếp đón.', 'Đến quầy tiếp đón.'],
  currentStep: 0,
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function apiWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return createApiRobotService({
    baseUrl: 'https://hospital.example/api/v1/',
    robotId: 'MAR-01',
    fetchImpl,
    timeoutMs,
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe('API adapter', () => {
  it('uses a normalized base URL, encoded robot ID, and optional auth provider', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(validStatus));
    const service = createApiRobotService({
      baseUrl: 'https://hospital.example/api/v1///',
      robotId: 'robot/01',
      fetchImpl,
      getAccessToken: async () => 'session-token',
    });

    await expect(service.getStatus()).resolves.toEqual(validStatus);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://hospital.example/api/v1/robots/robot%2F01/status',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer session-token',
          'X-Request-ID': expect.any(String),
        }),
      }),
    );
    const headers = fetchImpl.mock.calls[0]![1]?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeUndefined();
  });

  it('adds a request and idempotency key to mutations without retrying them', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(validTask));
    const service = apiWith(fetchImpl);

    await service.startNavigation(' reception ', 'escort');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0]!;
    const headers = options?.headers as Record<string, string>;
    expect(url).toBe('https://hospital.example/api/v1/robots/MAR-01/navigation');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(options?.body as string)).toEqual({
      destinationId: 'reception',
      mode: 'escort',
    });
    expect(headers['Idempotency-Key']).toBe(headers['X-Request-ID']);
    expect(headers['Idempotency-Key']).toBeTruthy();
  });

  it('encodes task IDs and accepts a stop only after a valid response', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ ...validTask, id: 'nav/id', status: 'stopped' }))
      .mockResolvedValueOnce(jsonResponse({ ...validTask, id: 'nav/id', status: 'stopped' }));
    const service = apiWith(fetchImpl);
    await service.stopNavigation('nav/id');
    await service.getNavigation('nav/id');
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://hospital.example/api/v1/navigation/nav%2Fid/stop',
    );
    expect(fetchImpl.mock.calls[1]![0]).toBe(
      'https://hospital.example/api/v1/navigation/nav%2Fid',
    );
    expect(fetchImpl.mock.calls[0]![1]?.method).toBe('POST');
    expect(fetchImpl.mock.calls[1]![1]?.method).toBe('GET');
  });

  it.each(['', 'ftp://hospital.example', 'https://user:secret@hospital.example'])(
    'rejects an invalid API address before sending: %s',
    async (baseUrl) => {
      const fetchImpl = vi.fn<typeof fetch>();
      const service = createApiRobotService({
        baseUrl,
        robotId: 'MAR-01',
        fetchImpl,
      });
      await expect(service.getStatus()).rejects.toMatchObject({
        code: 'configuration',
      });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it('rejects malformed status data instead of showing a false status', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ ...validStatus, battery: 132 }));
    await expect(apiWith(fetchImpl).getStatus()).rejects.toMatchObject({
      code: 'invalid_response',
      requestId: expect.any(String),
    });
  });

  it('rejects duplicate destination IDs and invalid task step indexes', async () => {
    const destination = {
      id: 'reception',
      name: 'Quầy tiếp đón',
      category: 'service',
      floor: 'Tầng trệt',
      description: '',
    };
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse([destination, destination]))
      .mockResolvedValueOnce(jsonResponse({ ...validTask, currentStep: 2 }));
    const service = apiWith(fetchImpl);
    await expect(service.getDestinations()).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(service.getNavigation('nav-001')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('rejects a navigation response for a different task or destination', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(validTask))
      .mockResolvedValueOnce(jsonResponse(validTask))
      .mockResolvedValueOnce(jsonResponse(validTask));
    const service = apiWith(fetchImpl);
    await expect(service.getNavigation('nav-other')).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(service.stopNavigation('nav-other')).rejects.toMatchObject({
      code: 'invalid_response',
    });
    await expect(service.startNavigation('pharmacy', 'escort')).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('preserves an active response to a stop request instead of inventing a stopped state', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(validTask));
    await expect(apiWith(fetchImpl).stopNavigation('nav-001')).resolves.toMatchObject({
      status: 'active',
    });
  });

  it('reconciles the current active journey and accepts an explicit JSON null', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(validTask))
      .mockResolvedValueOnce(jsonResponse(null));
    const service = apiWith(fetchImpl);
    await expect(service.getActiveNavigation()).resolves.toEqual(validTask);
    await expect(service.getActiveNavigation()).resolves.toBeNull();
    expect(fetchImpl.mock.calls[0]![0]).toBe(
      'https://hospital.example/api/v1/robots/MAR-01/navigation/active',
    );
    expect(fetchImpl.mock.calls[0]![1]?.method).toBe('GET');
  });

  it('does not confuse an active-journey lookup failure with no active journey', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404))
      .mockResolvedValueOnce(jsonResponse({ ...validTask, status: 'arrived' }));
    const service = apiWith(fetchImpl);
    await expect(service.getActiveNavigation()).rejects.toMatchObject({
      code: 'not_found',
    });
    await expect(service.getActiveNavigation()).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });

  it('does not expose a server response or secrets in the displayed error', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse({ message: 'private-secret-stack' }, 401));
    const error = await apiWith(fetchImpl).getStatus().catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'unauthorized', httpStatus: 401 });
    expect((error as Error).message).not.toContain('private-secret-stack');
  });

  it('does not acknowledge SOS or retry when the network is unavailable', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Offline'));
    await expect(apiWith(fetchImpl).requestSos()).rejects.toMatchObject({
      code: 'network',
      requestId: expect.any(String),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not acknowledge SOS on server failure or a malformed receipt', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ status: 'received' }, 503))
      .mockResolvedValueOnce(
        jsonResponse({ id: 'sos-1', status: 'received', createdAt: 'invalid-date' }),
      );
    const service = apiWith(fetchImpl);
    await expect(service.requestSos()).rejects.toMatchObject({ code: 'server' });
    await expect(service.requestSos()).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('accepts SOS only with a valid received receipt', async () => {
    const receipt = {
      id: 'sos-1',
      status: 'received',
      createdAt: '2026-10-20T03:00:00.000Z',
    };
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(receipt));
    await expect(apiWith(fetchImpl).requestSos()).resolves.toEqual(receipt);
  });

  it('times out and aborts even if fetch never settles', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(
      () => new Promise<Response>(() => {}),
    );
    const result = apiWith(fetchImpl, 50).requestSos();
    const rejection = expect(result).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![1]?.signal?.aborted).toBe(true);
  });

  it('covers response parsing with the same timeout', async () => {
    vi.useFakeTimers();
    const response = jsonResponse(validStatus);
    vi.spyOn(response, 'json').mockImplementation(
      () => new Promise<unknown>(() => {}),
    );
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response);
    const rejection = expect(apiWith(fetchImpl, 50).getStatus()).rejects.toMatchObject({
      code: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
  });

  it('does not send a mutation after its auth lookup has timed out', async () => {
    vi.useFakeTimers();
    let resolveToken: ((token: string) => void) | undefined;
    const fetchImpl = vi.fn<typeof fetch>();
    const service = createApiRobotService({
      baseUrl: 'https://hospital.example',
      robotId: 'MAR-01',
      timeoutMs: 50,
      fetchImpl,
      getAccessToken: () =>
        new Promise<string>((resolve) => {
          resolveToken = resolve;
        }),
    });
    const rejection = expect(service.requestSos()).rejects.toMatchObject({
      code: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(51);
    await rejection;
    resolveToken?.('late-token');
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects blank and excessively long messages before network access', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const service = apiWith(fetchImpl);
    await expect(service.sendMessage(' ')).rejects.toMatchObject({ code: 'validation' });
    await expect(service.sendMessage('a'.repeat(2_001))).rejects.toMatchObject({
      code: 'validation',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('demo adapter', () => {
  it('keeps navigation active until stopped and never invents physical arrival', async () => {
    const service = createMockRobotService();
    const task = await service.startNavigation('reception', 'escort');
    expect(task.id).toBe('demo-nav-0001');
    expect((await service.getStatus()).availability).toBe('busy');
    for (let check = 0; check < 5; check += 1) {
      expect(await service.getNavigation(task.id)).toMatchObject({
        status: 'active',
        currentStep: 0,
      });
    }
    await expect(service.stopNavigation(task.id)).resolves.toMatchObject({
      status: 'stopped',
    });
    expect((await service.getStatus()).availability).toBe('available');
  });

  it('prevents simultaneous journeys and allows a new one after stopping', async () => {
    const service = createMockRobotService();
    const first = await service.startNavigation('reception', 'directions');
    await expect(service.startNavigation('pharmacy', 'escort')).rejects.toMatchObject({
      code: 'conflict',
    });
    await service.stopNavigation(first.id);
    const second = await service.startNavigation('pharmacy', 'escort');
    expect(second.id).toBe('demo-nav-0002');
  });

  it('isolates returned objects and each demo session', async () => {
    const service = createMockRobotService();
    const destinations = await service.getDestinations();
    destinations[0]!.name = 'Changed';
    expect((await service.getDestinations())[0]!.name).toBe('Quầy tiếp đón');
    const task = await service.startNavigation('reception', 'escort');
    task.steps[0] = 'Changed';
    task.status = 'arrived';
    const current = await service.getNavigation(task.id);
    expect(current.status).toBe('active');
    expect(current.steps[0]).not.toBe('Changed');
    await expect(createMockRobotService().getNavigation(task.id)).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('limits the assistant to information and does not prescribe treatment', async () => {
    const service = createMockRobotService();
    const reply = await service.sendMessage('Tôi bị sốt, nên uống thuốc gì?');
    expect(reply.message).toContain('chưa thể đánh giá triệu chứng');
    expect(reply.message).toContain('minh họa');
  });

  it('recognizes registration questions without mistaking “đâu” for “đau”', async () => {
    const service = createMockRobotService();
    const reply = await service.sendMessage('Đăng ký khám ở đâu?');
    expect(reply.message).toContain('quầy tiếp đón');
    expect(reply.message).not.toContain('đánh giá triệu chứng');
  });

  it('returns the active mock journey until it is stopped', async () => {
    const service = createMockRobotService();
    expect(await service.getActiveNavigation()).toBeNull();
    const task = await service.startNavigation('reception', 'escort');
    expect(await service.getActiveNavigation()).toEqual(task);
    await service.stopNavigation(task.id);
    expect(await service.getActiveNavigation()).toBeNull();
  });

  it('marks demo SOS receipts with a demo ID', async () => {
    const service = createMockRobotService();
    await expect(service.requestSos()).resolves.toMatchObject({
      id: 'demo-sos-0001',
      status: 'received',
    });
  });
});
