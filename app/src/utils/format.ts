/** Zahlen-/Einheiten-Formatierung, locale-abhängig (Default de-DE → "0,53 ‰"). */

export function formatPromille(value: number, locale = 'de-DE'): string {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)} ‰`;
}

export function formatAbv(abvPercent: number, locale = 'de-DE'): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(abvPercent)} %`;
}

export function formatVolume(volumeMl: number, locale = 'de-DE'): string {
  if (volumeMl >= 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(volumeMl / 1000)} l`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(volumeMl)} ml`;
}
