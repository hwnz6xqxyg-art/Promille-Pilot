/** Dunkles Farbschema (festival-tauglich, abends gut ablesbar). */
export const colors = {
  bg: '#0E1116',
  surface: '#171B22',
  surfaceAlt: '#1F252E',
  border: '#2A313C',
  text: '#F2F5F9',
  textMuted: '#9AA5B4',
  primary: '#4C8DFF',
  primaryText: '#FFFFFF',

  // Promille-Statusfarben
  safe: '#3FB950', // deutlich unter Grenzwert
  caution: '#E3B341', // nahe am Grenzwert
  danger: '#F85149', // über Grenzwert

  overlay: 'rgba(0,0,0,0.5)',
} as const;

export type ColorName = keyof typeof colors;
