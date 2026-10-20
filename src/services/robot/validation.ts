import {
  AssistantReply,
  Destination,
  DestinationCategory,
  NavigationTask,
  RobotServiceError,
  RobotStatus,
  SosReceipt,
} from './types';

type JsonObject = Record<string, unknown>;

function invalid(): never {
  throw new RobotServiceError(
    'invalid_response',
    'Dữ liệu từ robot chưa hợp lệ. Vui lòng liên hệ nhân viên hỗ trợ.',
  );
}

function object(value: unknown): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return invalid();
  }
  return value as JsonObject;
}

function string(value: unknown, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim())) {
    return invalid();
  }
  return value;
}

function enumeration<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    return invalid();
  }
  return value as T;
}

export function validateStatus(value: unknown): RobotStatus {
  const item = object(value);
  if (
    typeof item.battery !== 'number' ||
    !Number.isFinite(item.battery) ||
    item.battery < 0 ||
    item.battery > 100
  ) {
    return invalid();
  }
  return {
    id: string(item.id),
    name: string(item.name),
    battery: item.battery,
    location: string(item.location),
    availability: enumeration(item.availability, [
      'available',
      'busy',
      'offline',
    ] as const),
  };
}

export function validateDestinations(value: unknown): Destination[] {
  if (!Array.isArray(value)) return invalid();
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    const item = object(entry);
    const id = string(item.id);
    if (ids.has(id)) return invalid();
    ids.add(id);
    return {
      id,
      name: string(item.name),
      category: enumeration<DestinationCategory>(item.category, [
        'clinic',
        'lab',
        'pharmacy',
        'payment',
        'service',
      ]),
      floor: string(item.floor),
      description: string(item.description, true),
    };
  });
}

export function validateNavigation(value: unknown): NavigationTask {
  const item = object(value);
  if (
    !Array.isArray(item.steps) ||
    typeof item.currentStep !== 'number' ||
    !Number.isInteger(item.currentStep) ||
    item.currentStep < 0 ||
    (item.steps.length === 0
      ? item.currentStep !== 0
      : item.currentStep >= item.steps.length)
  ) {
    return invalid();
  }
  return {
    id: string(item.id),
    destinationId: string(item.destinationId),
    destinationName: string(item.destinationName),
    mode: enumeration(item.mode, ['directions', 'escort'] as const),
    status: enumeration(item.status, [
      'active',
      'stopped',
      'arrived',
      'blocked',
      'pending',
    ] as const),
    steps: item.steps.map((step: unknown) => string(step)),
    currentStep: item.currentStep,
  };
}

export function validateReply(value: unknown): AssistantReply {
  const item = object(value);
  return { message: string(item.message) };
}

export function validateSos(value: unknown): SosReceipt {
  const item = object(value);
  const createdAt = string(item.createdAt);
  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(createdAt) ||
    !Number.isFinite(Date.parse(createdAt))
  ) {
    return invalid();
  }
  return {
    id: string(item.id),
    status: enumeration(item.status, ['received'] as const),
    createdAt,
  };
}

export function requiredInput(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new RobotServiceError('validation', `${label} không được để trống.`);
  }
  return value.trim();
}
