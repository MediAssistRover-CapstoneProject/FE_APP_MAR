/**
 * quantityHelper.ts
 * Logic kiểm tra và chuẩn hóa số lượng vật phẩm trong form tạo giao nhận MediAssist.
 * Ràng buộc: Số nguyên dương từ 1 đến 2.147.483.647 (Int32 max).
 */

export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 2147483647;

export type ItemCategory = 'MEDICATION' | 'LAB_SAMPLE' | 'SUPPLIES' | 'DOCUMENT';

export interface QuantityValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Kiểm tra chuỗi nhập số lượng.
 * Chỉ chấp nhận chuỗi số nguyên thuần túy (digits only).
 * Từ chối: rỗng, số 0, âm, số thập phân, số mũ, hex, ký tự chữ, NaN, Infinity hoặc vượt quá MAX_QUANTITY.
 */
export function validateQuantity(raw: string): QuantityValidationResult {
  const trimmed = (raw ?? '').trim();

  if (trimmed === '') {
    return { valid: false, error: 'Vui lòng nhập số lượng' };
  }

  // Chặn số âm
  if (trimmed.startsWith('-')) {
    return { valid: false, error: 'Số lượng phải lớn hơn 0' };
  }

  // Chặn số thập phân
  if (trimmed.includes('.') || trimmed.includes(',')) {
    return { valid: false, error: 'Số lượng phải là số nguyên' };
  }

  // Chặn ký tự chữ, số mũ (1e3), hex (0x10)
  if (!/^\d+$/.test(trimmed)) {
    return { valid: false, error: 'Số lượng chỉ được chứa chữ số' };
  }

  // Chặn trường hợp toàn số 0 ("0", "00")
  if (/^0+$/.test(trimmed)) {
    return { valid: false, error: 'Số lượng tối thiểu là 1' };
  }

  // Kiểm tra độ dài chữ số để tránh parse overflow
  if (trimmed.replace(/^0+/, '').length > 10) {
    return { valid: false, error: 'Số lượng vượt quá giới hạn cho phép (tối đa 2.147.483.647)' };
  }

  const num = parseInt(trimmed, 10);

  if (isNaN(num) || !Number.isFinite(num)) {
    return { valid: false, error: 'Số lượng không hợp lệ' };
  }

  if (num < MIN_QUANTITY) {
    return { valid: false, error: `Số lượng tối thiểu là ${MIN_QUANTITY}` };
  }

  if (num > MAX_QUANTITY) {
    return { valid: false, error: 'Số lượng vượt quá giới hạn cho phép (tối đa 2.147.483.647)' };
  }

  return { valid: true, value: num };
}

/**
 * Chuẩn hóa chuỗi khi commit (blur).
 * Loại bỏ các số 0 ở đầu (ví dụ: "05" -> "5"). Nếu không hợp lệ, giữ nguyên chuỗi để người dùng sửa.
 */
export function normalizeQuantityOnCommit(raw: string): string {
  const check = validateQuantity(raw);
  if (check.valid && check.value !== undefined) {
    return String(check.value);
  }
  return raw;
}

/**
 * Tăng số lượng lên 1 đơn vị.
 */
export function incrementQuantity(raw: string): string {
  const check = validateQuantity(raw);
  if (!check.valid || check.value === undefined) {
    return '1';
  }
  if (check.value >= MAX_QUANTITY) {
    return String(MAX_QUANTITY);
  }
  return String(check.value + 1);
}

/**
 * Giảm số lượng đi 1 đơn vị (tối thiểu là 1).
 */
export function decrementQuantity(raw: string): string {
  const check = validateQuantity(raw);
  if (!check.valid || check.value === undefined) {
    return '1';
  }
  if (check.value <= MIN_QUANTITY) {
    return String(MIN_QUANTITY);
  }
  return String(check.value - 1);
}

/**
 * Ánh xạ loại nhiệm vụ sang nhóm hàng (itemCategory) và đơn vị tính (unit).
 */
export function getItemCategoryAndUnit(tasks: string[]): { category: ItemCategory; unit: string } {
  if (tasks.includes('van_chuyen_thuoc')) {
    return { category: 'MEDICATION', unit: 'Hộp' };
  }
  if (tasks.includes('van_chuyen_mau')) {
    return { category: 'LAB_SAMPLE', unit: 'Ống nghiệm' };
  }
  if (tasks.includes('van_chuyen_vat_tu')) {
    return { category: 'SUPPLIES', unit: 'Gói' };
  }
  return { category: 'DOCUMENT', unit: 'Bộ' };
}
