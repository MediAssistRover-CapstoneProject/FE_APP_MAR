import AsyncStorage from '@react-native-async-storage/async-storage';
import { type DeliveryAttempt, UUID_PATTERN } from './deliveryHandoff';

const keyFor = (scope: string) => 'mar.delivery.pending.v1:' + scope;
export async function saveDeliveryAttempt(scope: string, attempt: DeliveryAttempt | null) {
  if (attempt) await AsyncStorage.setItem(keyFor(scope), JSON.stringify(attempt));
  else await AsyncStorage.removeItem(keyFor(scope));
}
export async function loadDeliveryAttempt(scope: string): Promise<DeliveryAttempt | null> {
  const raw = await AsyncStorage.getItem(keyFor(scope));
  if (!raw) return null;
  const value = JSON.parse(raw) as DeliveryAttempt;
  if (!value || typeof value.key !== 'string' || !value.payload || !UUID_PATTERN.test(value.payload.mapId) ||
      !Array.isArray(value.payload.items) || (value.requestId && !UUID_PATTERN.test(value.requestId))) {
    throw new Error('Không đọc được yêu cầu đang chờ. Kiểm tra lịch sử delivery trước khi tạo yêu cầu mới.');
  }
  return value;
}
