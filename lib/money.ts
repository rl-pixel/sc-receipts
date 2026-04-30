export function dollarsToCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n = typeof input === "string" ? Number(input.replace(/[^0-9.\-]/g, "")) : input;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatUSD(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
