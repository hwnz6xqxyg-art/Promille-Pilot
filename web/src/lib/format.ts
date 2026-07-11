/** German formatting — mirrors the prototype's formatting branches exactly. */

const nf2 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** "0,52" (clamped at 0, always 2 decimals). */
export function fmtP(v: number): string {
  return nf2.format(Math.max(0, v || 0));
}

/** "500" / "5,4" — one decimal max. */
export function fmtN1(v: number): string {
  return nf1.format(v);
}

/** "23:41" (24h). */
export function fmtClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

/** "45 min" / "2 h" / "2 h 10 min" (clamped at 0). */
export function fmtDur(ms: number): string {
  const m = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h <= 0) return `${mm} min`;
  if (mm === 0) return `${h} h`;
  return `${h} h ${mm} min`;
}
