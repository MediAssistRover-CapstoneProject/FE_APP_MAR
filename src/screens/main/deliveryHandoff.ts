import type {
  AuthVerificationPurpose,
  AuthVerificationResponse,
  DeliveryCreateRequest,
  DeliveryResponse,
  JobStepResponsePayload,
} from '../../api/modules/delivery.api';
import type { JobResponse, JobStepResponse, ServiceRequestResponse } from '../../api/types';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DeliveryPhase = 'sender' | 'receiver';

export interface DeliveryScanContext {
  jobId: string;
  stepId: string;
  purpose: AuthVerificationPurpose;
  accountId: string;
}

export function selectedRunningStep(job: JobResponse | null): JobStepResponse | undefined {
  if (job?.status !== 'RUNNING' || !job.selectedJobStepId || job.cancelRequestedAt) return;
  return job.steps?.find(step => step.jobStepId === job.selectedJobStepId && step.status === 'RUNNING' && !step.interruptionRequestedAt);
}

export function deliveryPhase(step?: JobStepResponse): DeliveryPhase | undefined {
  const purpose = step?.resolvedInputsJson?.purpose;
  if (purpose === 'DELIVERY_SENDER') return 'sender';
  if (purpose === 'DELIVERY_RECEIVER') return 'receiver';
  const code = step?.stepCodeSnapshot;
  if (code?.endsWith('_SENDER')) return 'sender';
  if (code?.endsWith('_RECEIVER')) return 'receiver';
  if (step?.stepTypeSnapshot === 'HANDLE_PAYLOAD') {
    if (step.resolvedInputsJson?.action === 'LOAD') return 'sender';
    if (step.resolvedInputsJson?.action === 'UNLOAD') return 'receiver';
  }
  const prompt = step?.resolvedInputsJson?.prompt_key;
  if (typeof prompt === 'string' && prompt.endsWith('_SENDER')) return 'sender';
  if (typeof prompt === 'string' && prompt.endsWith('_RECEIVER')) return 'receiver';
}

export function expectedDeliveryAccount(
  job: JobResponse | null,
  phase?: DeliveryPhase,
  delivery?: DeliveryResponse,
): string | undefined {
  if (!job || !phase) return;
  const runtimeAccount = job.inputJson?.[`expected_${phase}_account_id`];
  const assignedAccount = delivery?.request.serviceRequestId === job.serviceRequestId
    ? phase === 'sender' ? delivery?.expectedSenderAccountId : delivery?.expectedReceiverAccountId
    : undefined;
  if (typeof runtimeAccount === 'string' && UUID_PATTERN.test(runtimeAccount)) {
    if (assignedAccount && runtimeAccount.toLowerCase() !== assignedAccount.toLowerCase()) return;
    return runtimeAccount.toLowerCase();
  }
  if (assignedAccount && UUID_PATTERN.test(assignedAccount)) return assignedAccount.toLowerCase();
}

export function scanContext(
  job: JobResponse | null,
  accountId?: string,
  delivery?: DeliveryResponse,
): DeliveryScanContext | undefined {
  const step = selectedRunningStep(job);
  const phase = deliveryPhase(step);
  if (!job || !step || !phase || !accountId || job.schemaVersion !== 3 || !job.beOrchestrated) return;
  const purpose = phase === 'sender' ? 'DELIVERY_SENDER' : 'DELIVERY_RECEIVER';
  if (
    step.stepTypeSnapshot !== 'AUTHENTICATE' ||
    step.resolvedInputsJson?.method !== 'QR_CODE' ||
    (step.resolvedInputsJson?.purpose != null && step.resolvedInputsJson.purpose !== purpose) ||
    expectedDeliveryAccount(job, phase, delivery) !== accountId.toLowerCase()
  ) return;
  return { jobId: job.jobId, stepId: step.jobStepId, purpose, accountId };
}

export function verificationMatches(result: AuthVerificationResponse, context: DeliveryScanContext): boolean {
  return result.method === 'QR_CODE' &&
    result.jobId === context.jobId &&
    result.authJobStepId === context.stepId &&
    result.purpose === context.purpose &&
    result.actorAccountId?.toLowerCase() === context.accountId.toLowerCase();
}

export function handoffResponse(step?: JobStepResponse): JobStepResponsePayload | undefined {
  const phase = deliveryPhase(step);
  if (!step || !phase || step.status !== 'RUNNING' || step.interruptionRequestedAt) return;
  const codeSuffix = phase.toUpperCase();
  const inputs = step.resolvedInputsJson;
  if (!inputs) return;
  if (
    step.stepTypeSnapshot === 'HANDLE_PAYLOAD' &&
    inputs.action === (phase === 'sender' ? 'LOAD' : 'UNLOAD') &&
    Array.isArray(inputs.items) && inputs.items.length > 0
  ) {
    return { responseType: 'PAYLOAD_CONFIRMED', data: { confirmed: true, items: inputs.items } };
  }
  if (step.stepTypeSnapshot !== 'INTERACT') return;
  if ([`CLOSE_${codeSuffix}`, 'CONFIRM_COMPARTMENT_CLOSED', 'STAFF_CLOSE_DOOR_AND_CLEAR_MECHANISM'].includes(String(inputs.prompt_key))) {
    return { responseType: 'DOOR_CLOSED', data: { closed: true } };
  }
  if ([`VERIFY_${codeSuffix}`, 'VERIFY_COMPARTMENT_LOCKED', 'STAFF_PHYSICALLY_VERIFY_LOCK'].includes(String(inputs.prompt_key))) {
    return { responseType: 'LOCK_CHECKED', data: { locked: true } };
  }
}

export function handoffResponseKey(stepId: string, accountId: string, responseType: string): string {
  return `delivery:${stepId}:${accountId.toLowerCase()}:${responseType}`;
}

export interface DeliveryAttempt {
  key: string;
  payload: DeliveryCreateRequest;
  requestId?: string;
  submitted?: boolean;
}

interface DeliverySubmissionApi {
  create: (payload: DeliveryCreateRequest, key: string) => Promise<DeliveryResponse>;
  submit: (requestId: string) => Promise<ServiceRequestResponse>;
  getRequest: (requestId: string) => Promise<ServiceRequestResponse>;
  findJob: (requestId: string) => Promise<JobResponse | undefined>;
}

export async function continueDeliverySubmission(
  attempt: DeliveryAttempt,
  api: DeliverySubmissionApi,
  stillCurrent: () => boolean,
  onProgress: () => Promise<void> = async () => {},
): Promise<JobResponse | undefined> {
  if (!attempt.requestId) {
    const created = await api.create(attempt.payload, attempt.key);
    attempt.requestId = created.request?.serviceRequestId;
    if (!attempt.requestId) throw new Error('Máy chủ chưa trả về ID yêu cầu giao hàng.');
    await onProgress();
  }
  if (!stillCurrent()) return;
  if (!attempt.submitted) {
    try {
      await api.submit(attempt.requestId);
      attempt.submitted = true;
      await onProgress();
    } catch (submitError) {
      if (!stillCurrent()) return;
      const job = await api.findJob(attempt.requestId).catch(() => undefined);
      if (job) {
        attempt.submitted = true;
        await onProgress();
        return stillCurrent() ? job : undefined;
      }
      if (!stillCurrent()) return;
      const request = await api.getRequest(attempt.requestId).catch(() => undefined);
      if (request && ['SUBMITTED', 'QUEUED', 'RUNNING', 'IN_PROGRESS', 'COMPLETED'].includes(request.status)) {
        attempt.submitted = true;
        await onProgress();
      } else {
        throw submitError;
      }
    }
  }
  if (!stillCurrent()) return;
  return api.findJob(attempt.requestId);
}
