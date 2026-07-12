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

/**
 * Preset-style volume·strength subtitle: liters for clean 100 ml multiples
 * ("0,5 l · 5 %"), cl for clean shots ("2 cl · 40 %"), else exact ml
 * ("250 ml · 9,5 %") — never rounds the volume misleadingly.
 */
export function fmtDrinkDetail(vol: number, abv: number): string {
  let volStr: string;
  if (vol >= 100 && vol % 100 === 0) volStr = `${fmtN1(vol / 1000)} l`;
  else if (vol < 100 && vol % 10 === 0) volStr = `${fmtN1(vol / 10)} cl`;
  else volStr = `${fmtN1(vol)} ml`;
  return `${volStr} · ${fmtN1(abv)} %`;
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
