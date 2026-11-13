/** JSON telemetry can omit coordinates even when the HTTP request succeeds. */
export function finitePoseNumber(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeRobotPose<T extends { xM?: unknown; yM?: unknown; yawRad?: unknown }>(
  pose: T | null | undefined,
): (T & { xM: number; yM: number; yawRad: number }) | null {
  if (!pose) return null;
  const xM = finitePoseNumber(pose.xM);
  const yM = finitePoseNumber(pose.yM);
  if (xM === null || yM === null) return null;
  // Retain the map's existing heading fallback only after validating position.
  return { ...pose, xM, yM, yawRad: finitePoseNumber(pose.yawRad) ?? 0 };
}
