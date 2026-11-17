import type { RobotBatteryResponse, RobotDto } from '../../api/types';

export interface NormalizedRobotBattery {
  robotId: string | null;
  percent: number | null;
  voltageV: number | null;
  batteryRaw: number | null;
  batteryUnit: string | null;
  fresh: boolean | null;
  ageSec: number | null;
  source: string | null;
  estimateMethod: string | null;
  estimateStatus: string | null;
  profileId: string | null;
  curveCalibrated: boolean | null;
  capturedAt: string | null;
  receivedAt: string | null;
  seriesCells: number | null;
  parallelCells: number | null;
  nominalCapacityMah: number | null;
  nominalVoltageV: number | null;
  isFromBatteryApi: boolean;
}

export interface RobotBatteryDisplay {
  normalized: NormalizedRobotBattery;
  percentText: string;
  voltageText: string;
  rawText: string;
  badgeText: string;
  detailText: string;
  subText: string;
  freshnessText: string;
  tintColor: string;
}

/** Chuyển giá trị số hoặc chuỗi số JSON sang number hữu hạn, trả null nếu không hợp lệ. */
export function finiteBatteryNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampPercent(value: unknown): number | null {
  const num = finiteBatteryNumber(value);
  if (num === null || num < 0 || num > 100) return null;
  return num;
}

function normalizePositive(value: unknown): number | null {
  const num = finiteBatteryNumber(value);
  if (num === null || num <= 0) return null;
  return num;
}

function normalizeNonNegative(value: unknown): number | null {
  const num = finiteBatteryNumber(value);
  if (num === null || num < 0) return null;
  return num;
}

function cleanString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseTimestampMs(iso?: string | null): number {
  if (!iso) return -1;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : -1;
}

/** Chọn bản ghi BatteryResponse mới hơn cho cùng robotId giữa prop cha và poll cục bộ. */
export function pickNewerRobotBattery(
  first?: RobotBatteryResponse | null,
  second?: RobotBatteryResponse | null,
  robotId?: string | null
): RobotBatteryResponse | null {
  const validFirst =
    first && (!robotId || !first.robotId || first.robotId === robotId) ? first : null;
  const validSecond =
    second && (!robotId || !second.robotId || second.robotId === robotId) ? second : null;

  if (!validFirst) return validSecond;
  if (!validSecond) return validFirst;

  const firstTs = Math.max(
    parseTimestampMs(validFirst.receivedAt),
    parseTimestampMs(validFirst.capturedAt)
  );
  const secondTs = Math.max(
    parseTimestampMs(validSecond.receivedAt),
    parseTimestampMs(validSecond.capturedAt)
  );

  return secondTs > firstTs ? validSecond : validFirst;
}

/**
 * Chuẩn hóa thông số pin ưu tiên từ `GET /api/v1/robots/{id}/battery`.
 * Không suy diễn `%` từ `batteryRaw` millivolt/ADC khi BE trả `batteryPercent = null` (stale/chưa hiệu chuẩn).
 */
export function normalizeRobotBattery(
  battery?: RobotBatteryResponse | null,
  robot?: RobotDto | null
): NormalizedRobotBattery {
  const expectedRobotId = robot?.robotId ?? battery?.robotId ?? null;
  const batteryMatchesRobot = Boolean(
    battery && (!battery.robotId || !robot?.robotId || battery.robotId === robot.robotId)
  );

  if (battery && batteryMatchesRobot) {
    const unit = cleanString(battery.batteryUnit) ?? cleanString(robot?.batteryUnit);
    const raw = finiteBatteryNumber(battery.batteryRaw);
    const voltageV = normalizePositive(battery.voltageV);
    const percent = clampPercent(battery.batteryPercent);

    return {
      robotId: battery.robotId || expectedRobotId,
      percent,
      voltageV,
      batteryRaw: raw,
      batteryUnit: unit,
      fresh: typeof battery.fresh === 'boolean' ? battery.fresh : null,
      ageSec: normalizeNonNegative(battery.ageSec),
      source: cleanString(battery.source),
      estimateMethod: cleanString(battery.estimateMethod),
      estimateStatus: cleanString(battery.estimateStatus),
      profileId: cleanString(battery.profileId),
      curveCalibrated:
        typeof battery.curveCalibrated === 'boolean' ? battery.curveCalibrated : null,
      capturedAt: cleanString(battery.capturedAt),
      receivedAt: cleanString(battery.receivedAt),
      seriesCells: normalizePositive(battery.seriesCells),
      parallelCells: normalizePositive(battery.parallelCells),
      nominalCapacityMah: normalizePositive(battery.nominalCapacityMah),
      nominalVoltageV: normalizePositive(battery.nominalVoltageV),
      isFromBatteryApi: true,
    };
  }

  // Fallback chỉ dùng khi chưa nhận được phản hồi `/robots/{id}/battery`
  const unit = cleanString(robot?.batteryUnit);
  const raw = finiteBatteryNumber(robot?.batteryRaw);
  const percent = clampPercent(robot?.batteryPercent);
  const voltageV = unit === 'MILLIVOLT' && raw !== null && raw > 0 ? raw / 1000 : null;

  return {
    robotId: expectedRobotId,
    percent,
    voltageV,
    batteryRaw: raw,
    batteryUnit: unit,
    fresh: null,
    ageSec: null,
    source: null,
    estimateMethod: null,
    estimateStatus: null,
    profileId: null,
    curveCalibrated: null,
    capturedAt: cleanString(robot?.batteryCapturedAt),
    receivedAt: null,
    seriesCells: null,
    parallelCells: null,
    nominalCapacityMah: null,
    nominalVoltageV: null,
    isFromBatteryApi: false,
  };
}

function formatAgeVi(ageSec: number): string {
  const rounded = Math.round(ageSec);
  if (rounded < 60) return `${rounded}s trước`;
  const mins = Math.floor(rounded / 60);
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  return `${hours} giờ trước`;
}

function formatRawBattery(raw: number | null, unit: string | null): string {
  if (raw === null) return '--';
  const rounded = Math.round(raw);
  if (unit === 'MILLIVOLT') return `${rounded} mV`;
  if (unit === 'RAW_ADC') return `ADC ${rounded}`;
  return unit ? `${rounded} (${unit})` : `${rounded}`;
}

/** Tạo bộ chuỗi hiển thị đồng nhất cho Hero badge, Monitor modal và Telemetry sheet. */
export function formatRobotBatteryDisplay(
  battery?: RobotBatteryResponse | null,
  robot?: RobotDto | null
): RobotBatteryDisplay {
  const norm = normalizeRobotBattery(battery, robot);
  const roundedPercent = norm.percent !== null ? Math.round(norm.percent) : null;
  const percentText = roundedPercent !== null ? `${roundedPercent}%` : '--';
  const voltageText = norm.voltageV !== null ? `${norm.voltageV.toFixed(2)}V` : '--';
  const rawText = formatRawBattery(norm.batteryRaw, norm.batteryUnit);

  const staleSuffix = norm.fresh === false ? ' (cũ)' : '';

  let badgeText = '--';
  if (roundedPercent !== null && norm.voltageV !== null) {
    badgeText = `${roundedPercent}% · ${norm.voltageV.toFixed(1)}V${staleSuffix}`;
  } else if (roundedPercent !== null) {
    badgeText = `${roundedPercent}%${staleSuffix}`;
  } else if (norm.voltageV !== null) {
    badgeText = `${norm.voltageV.toFixed(2)}V${staleSuffix}`;
  } else if (norm.fresh === false) {
    badgeText = 'Cũ (--)';
  }

  let detailText = '--';
  if (roundedPercent !== null && norm.voltageV !== null) {
    detailText = `${roundedPercent}% (${norm.voltageV.toFixed(2)}V)`;
  } else if (roundedPercent !== null) {
    detailText = `${roundedPercent}%`;
  } else if (norm.voltageV !== null) {
    detailText = `${norm.voltageV.toFixed(2)}V`;
  }

  let subText = '';
  if (norm.fresh === false) {
    subText = norm.ageSec !== null ? `Dữ liệu cũ (${formatAgeVi(norm.ageSec)})` : 'Dữ liệu pin cũ';
  } else if (roundedPercent === null && norm.voltageV === null) {
    subText = norm.estimateStatus || (rawText !== '--' ? rawText : 'Chưa có dữ liệu');
  } else if (norm.ageSec !== null) {
    subText = `Mới đo · ${formatAgeVi(norm.ageSec)}`;
  } else if (norm.estimateStatus) {
    subText = norm.estimateStatus;
  }

  let freshnessText = 'Chưa có tín hiệu';
  if (norm.fresh === true) {
    freshnessText = norm.ageSec !== null ? `Mới đo (${formatAgeVi(norm.ageSec)})` : 'Còn mới';
  } else if (norm.fresh === false) {
    freshnessText = norm.ageSec !== null ? `Hết hạn (${formatAgeVi(norm.ageSec)})` : 'Hết hạn (stale)';
  } else if (norm.capturedAt) {
    freshnessText = 'Đã ghi nhận từ Robot';
  }

  let tintColor = '#94A3B8';
  if (roundedPercent !== null) {
    if (roundedPercent <= 20) tintColor = '#EF4444';
    else if (norm.fresh === false || roundedPercent <= 45) tintColor = '#F59E0B';
    else tintColor = '#10B981';
  } else if (norm.fresh === false) {
    tintColor = '#F59E0B';
  } else if (norm.voltageV !== null) {
    tintColor = '#10B981';
  }

  return {
    normalized: norm,
    percentText,
    voltageText,
    rawText,
    badgeText,
    detailText,
    subText,
    freshnessText,
    tintColor,
  };
}
