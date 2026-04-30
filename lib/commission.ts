export function resolveCommissionCents(
  type: "percent" | "flat" | null | undefined,
  value: number | null | undefined,
  totalCents: number,
): number | null {
  if (!type || value == null || !Number.isFinite(value)) return null;
  if (type === "flat") return Math.round(value * 100);
  if (type === "percent") return Math.round((totalCents * value) / 100);
  return null;
}
