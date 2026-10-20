import { PiEnvelope } from './types';
import { generateUuid, getNextSequence } from './config';

interface EnvelopeOptions {
  robotId?: string;
  jobId?: string;
  jobStepId?: string;
  correlationId?: string;
  operationKey?: string;
}

export function createPiEnvelope<T>(
  messageType: string,
  payload: T,
  options?: EnvelopeOptions,
): PiEnvelope<T> {
  return {
    protocolVersion: '1.0',
    messageId: generateUuid(),
    operationKey: options?.operationKey || `op-${Date.now().toString(36)}`,
    correlationId: options?.correlationId || generateUuid(),
    robotId: options?.robotId,
    jobId: options?.jobId,
    jobStepId: options?.jobStepId,
    messageType,
    occurredAt: new Date().toISOString(),
    producerSessionId: generateUuid(),
    sequenceNo: getNextSequence(),
    payload,
  };
}
