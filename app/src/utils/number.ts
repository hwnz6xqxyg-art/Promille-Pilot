/** Parst eine Nutzereingabe (mit Komma oder Punkt) zu einer Zahl oder null. */
export function parseDecimal(input: string): number | null {
  if (input == null) return null;
  const normalized = String(input).trim().replace(',', '.');
  if (normalized === '') return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function clampNumber(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
