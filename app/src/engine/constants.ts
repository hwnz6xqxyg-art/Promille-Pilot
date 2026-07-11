/**
 * Physikalische, physiologische und rechtliche Konstanten der Promille-Berechnung.
 *
 * Reine Daten – kein React/React-Native/DOM-Import, damit dieses Modul in Node
 * (Tests) genauso läuft wie in der App. Quellen siehe DEVELOPMENT_SPEC.md, Anhang.
 */

/** Dichte von Ethanol in g/ml – deutsche forensische Konvention (0,8 statt 0,789). */
export const ETHANOL_DENSITY = 0.8;

/**
 * Resorptionsdefizit: nur ~90 % des getrunkenen Alkohols erreichen das Blut
 * (First-Pass-Metabolismus). Konservativ als flacher Faktor angesetzt.
 */
export const RESORPTION_FACTOR = 0.9;

/**
 * Eliminationsrate β in ‰/h.
 * BETA_CONSERVATIVE (langsam) ist der sicherheitsrelevante Default: so meldet die
 * App niemals zu früh "nüchtern". BETA_AVERAGE dient nur einer optionalen
 * Momentanschätzung und darf NIE für die "fahrtüchtig ab"-Prognose genutzt werden.
 */
export const BETA_CONSERVATIVE = 0.1;
export const BETA_AVERAGE = 0.15;

/** Deutsche Grenzwerte in ‰ (Stand bis 2026). */
export const LIMIT_ABSOLUTE = 1.1; // absolute Fahruntüchtigkeit (Straftat, §316 StGB)
export const LIMIT_GENERAL = 0.5; // allgemeine Grenze (Ordnungswidrigkeit)
export const LIMIT_RELATIVE = 0.3; // relative Fahruntüchtigkeit (Straftat bei Ausfallerscheinungen)
export const LIMIT_NOVICE = 0.0; // Probezeit / unter 21

/** Schwellen, für die das Dashboard die "unter X ab HH:MM"-Prognose zeigt (höchste zuerst). */
export const FORECAST_THRESHOLDS = [LIMIT_GENERAL, LIMIT_RELATIVE, LIMIT_NOVICE];

/** Simulations-Defaults. */
export const DEFAULT_ABSORPTION_MINUTES = 45; // Zeit bis zum Peak pro Getränk (linear-Modell)
export const DEFAULT_STEP_MINUTES = 1; // Auflösung der Vorwärts-Simulation

/** Verteilungsfaktor r – einfache Konstanten (Fallback ohne Körpergröße). */
export const R_SIMPLE_MALE = 0.7;
export const R_SIMPLE_FEMALE = 0.6;

/** Plausibilitäts-Klammer für r, um pathologische Seidl-Ausgaben abzufangen. */
export const R_MIN = 0.4;
export const R_MAX = 0.9;

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_MINUTE = 60_000;

/** Sicherheitskappe für die Anzahl der Simulationsschritte. */
export const MAX_SIM_STEPS = 100_000;
