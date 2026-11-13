import type { DeliveryResponse } from '../../api/modules/delivery.api';
import type { JobResponse } from '../../api/types';

export interface CancellationSnapshot {
  job: JobResponse;
  delivery?: DeliveryResponse;
}

const sameId = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

// Presentation gate for the requested sender action. BE remains the authorization authority.
export function ownsDelivery(snapshot: CancellationSnapshot, accountId?: string): boolean {
  const delivery = snapshot.delivery;
  if (!delivery || delivery.request.requestType !== 'DELIVERY' ||
      !sameId(snapshot.job.serviceRequestId, delivery.request.serviceRequestId)) return false;
  return sameId(accountId, delivery.request.requestedByAccountId) ||
    sameId(accountId, delivery.expectedSenderAccountId) || sameId(accountId, delivery.senderAccountId);
}

export function canCancelDelivery(snapshot: CancellationSnapshot, accountId?: string): boolean {
  return ownsDelivery(snapshot, accountId) &&
    ['QUEUED', 'ACCEPTED', 'RUNNING'].includes(snapshot.job.status) &&
    !snapshot.job.cancelRequestedAt &&
    !['COMPLETED', 'FAILED', 'CANCELLED', 'RECOVERY_REQUIRED'].includes(snapshot.delivery!.request.status);
}

export function cancellationReason(value: string): string {
  const reason = value.trim();
  if (!reason || reason.length > 1000) throw new Error('Nhập lý do hủy từ 1 đến 1.000 ký tự.');
  return reason;
}

export function cancellationMessage(snapshot: CancellationSnapshot): string {
  const { job, delivery } = snapshot;
  if (job.status === 'RECOVERY_REQUIRED' || String(delivery?.request.status) === 'RECOVERY_REQUIRED') {
    return 'Cần nhân viên điều phối kiểm tra robot và hàng trong thùng. Chưa xác nhận robot đã dừng an toàn.';
  }
  if (job.status === 'CANCELLED') return 'BE đã xác nhận nhiệm vụ đã hủy. Nếu còn hàng trong thùng, liên hệ người điều phối để thu hồi.';
  if (job.status === 'SUCCEEDED') return 'Nhiệm vụ đã hoàn tất, không thể hủy.';
  if (job.status === 'FAILED') return 'Nhiệm vụ đã kết thúc với lỗi. Hãy kiểm tra trạng thái robot trước khi xử lý hàng.';
  return 'Đã gửi yêu cầu hủy. Đang chờ BE và robot xử lý; chưa xác nhận robot đã dừng. Không gửi thêm thao tác giao nhận.';
}

export async function requestDeliveryCancellation(options: {
  jobId: string;
  accountId: string;
  reason: string;
  stillCurrent: () => boolean;
  loadLatest: (jobId: string) => Promise<CancellationSnapshot>;
  cancelJob: (jobId: string, reason: string) => Promise<JobResponse>;
}): Promise<JobResponse> {
  const reason = cancellationReason(options.reason);
  if (!options.stillCurrent()) throw new Error('Tài khoản hoặc nhiệm vụ đã thay đổi.');
  const latest = await options.loadLatest(options.jobId);
  if (!options.stillCurrent()) throw new Error('Tài khoản hoặc nhiệm vụ đã thay đổi.');
  if (!sameId(latest.job.jobId, options.jobId) || !ownsDelivery(latest, options.accountId)) {
    throw new Error('Chỉ người tạo hoặc người gửi của giao hàng này được dùng thao tác hủy.');
  }
  // A previous POST may have succeeded even when its response was lost.
  if (latest.job.cancelRequestedAt || latest.job.status === 'CANCELLED') return latest.job;
  if (!canCancelDelivery(latest, options.accountId)) {
    throw new Error('Nhiệm vụ đã kết thúc hoặc cần điều phối xử lý; không thể gửi lệnh hủy mới.');
  }
  const result = await options.cancelJob(options.jobId, reason);
  if (!sameId(result.jobId, options.jobId)) throw new Error('BE trả kết quả cho nhiệm vụ khác. Hãy làm mới trạng thái.');
  return result;
}
