/**
 * BAC-Engine (Blood Alcohol Concentration / Promille) – das Herzstück von Promille-Pilot.
 *
 * Reine, deterministische, RN-/DOM-freie Funktionen. Der aktuelle Promillewert wird
 * NIE gespeichert, sondern immer aus `drinks + profile` berechnet.
 *
 * Modell: Widmark mit Seidl-Verteilungsfaktor (konservativ auf max. klassisches r
 * geklammert), voller Anrechnung ohne Resorptionsabzug, konservativer Elimination und
 * einer EINZIGEN Vorwärts-Simulation, aus der alle Ausgaben abgeleitet werden. Elimination
 * ist ganzkörperbezogen (null-ter Ordnung) und wird bei 0 geklammert – deshalb ist
 * "pro Getränk Peak minus β·Δt summieren" falsch (bricht über nüchterne Lücken),
 * und wir simulieren stattdessen Schritt für Schritt vorwärts.
 */

import {
  ETHANOL_DENSITY,
  RESORPTION_FACTOR,
  BETA_CONSERVATIVE,
  R_SIMPLE_MALE,
  R_SIMPLE_FEMALE,
  R_MIN,
  R_MAX,
  DEFAULT_ABSORPTION_MINUTES,
  DEFAULT_STEP_MINUTES,
  MS_PER_HOUR,
  MS_PER_MINUTE,
  MAX_SIM_STEPS,
} from './constants';

// ---------------------------------------------------------------------------
// Typen
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female';
export type DistributionMode = 'simple' | 'seidl';
export type AbsorptionModel = 'instant' | 'linear';

export interface Profile {
  weightKg: number;
  sex: Sex;
  /** Pflicht, wenn distributionMode === 'seidl'. */
  heightCm?: number;
  /** Reserviert (Watson-TBW-Variante / Zukunft). */
  ageYears?: number;
  distributionMode: DistributionMode;
  /** β in ‰/h – Default 0.1 (konservativ). */
  eliminationRate: number;
  /** Persönlicher Zielwert in ‰ (0.0 / 0.3 / 0.5). */
  targetLimitPromille: number;
  /** Probezeit / unter 21 -> erzwingt 0,0. */
  isNovice: boolean;
}

export interface Drink {
  id: string;
  /** Epoch ms – Beginn des Konsums (Default jetzt, editierbar). */
  timestamp: number;
  volumeMl: number;
  /** Vol.-% (0..100). */
  abvPercent: number;
  label?: string;
}

export interface BacPoint {
  /** Epoch ms. */
  t: number;
  /** Promille (‰). */
  bac: number;
}

export interface SimulationResult {
  points: BacPoint[];
  peakBac: number;
  /** Epoch ms des Peaks (NaN wenn keine Getränke). */
  peakTime: number;
  /** Epoch ms, ab dem der Nutzer wieder bei 0 ‰ ist – null wenn im Horizont nicht erreicht. */
  soberTime: number | null;
}

export interface EngineOptions {
  absorption?: AbsorptionModel;
  absorptionMinutes?: number;
  stepMinutes?: number;
  /** Überschreibt das natürliche Ende (bis nüchtern) mit einem festen Horizont ab erstem Getränk. */
  horizonHours?: number;
}

const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Grundformeln
// ---------------------------------------------------------------------------

/** Reiner Alkohol in Gramm: volumeMl × (abv/100) × 0,8. */
export function gramsOfAlcohol(volumeMl: number, abvPercent: number): number {
  if (!(volumeMl > 0) || !(abvPercent > 0)) return 0;
  return volumeMl * (abvPercent / 100) * ETHANOL_DENSITY;
}

/** Einfacher Verteilungsfaktor r nach Geschlecht. */
export function simpleR(sex: Sex): number {
  return sex === 'male' ? R_SIMPLE_MALE : R_SIMPLE_FEMALE;
}

/**
 * Individualisierter Verteilungsfaktor r nach Seidl et al. (2000), aus Gewicht (kg)
 * und Körpergröße (cm).
 *   Mann:  r = 0.31608 − 0.004821·w + 0.004432·h
 *   Frau:  r = 0.31223 − 0.006446·w + 0.004466·h
 *
 * (Alternative: Watson-TBW → r = TBW / (0.8·w). Seidl ist hier primär, weil er ohne
 *  Alter auskommt und von kommerziellen Rechnern genutzt wird.)
 */
export function seidlR(sex: Sex, weightKg: number, heightCm: number): number {
  const r =
    sex === 'male'
      ? 0.31608 - 0.004821 * weightKg + 0.004432 * heightCm
      : 0.31223 - 0.006446 * weightKg + 0.004466 * heightCm;
  return clamp(r, R_MIN, R_MAX);
}

/**
 * Wählt den Verteilungsfaktor je nach Profil; fällt ohne Größe auf `simple` zurück.
 * Konservativ geklammert: Seidl darf die Schätzung nur ERHÖHEN (kleineres r),
 * nie unter den klassischen Widmark-Wert senken — sonst würden z. B. große
 * schlanke Nutzer niedrigere Werte sehen als jeder Standard-Promillerechner.
 */
export function distributionFactor(profile: Profile): number {
  const simple = simpleR(profile.sex);
  if (profile.distributionMode === 'seidl' && profile.heightCm && profile.heightCm > 0) {
    return Math.min(seidlR(profile.sex, profile.weightKg, profile.heightCm), simple);
  }
  return simple;
}

/** Der tatsächlich anzuwendende Grenzwert: Fahranfänger erzwingt 0,0 ‰. */
export function applicableLimit(profile: Profile): number {
  return profile.isNovice ? 0 : profile.targetLimitPromille;
}

/**
 * Voll resorbierter Promille-Beitrag EINES Getränks (ohne Elimination).
 * peak = grams × RESORPTION_FACTOR / (r × masse).
 */
export function peakBacForDrink(drink: Drink, profile: Profile): number {
  const r = distributionFactor(profile);
  const m = profile.weightKg;
  if (!(r > 0) || !(m > 0)) return 0;
  return (gramsOfAlcohol(drink.volumeMl, drink.abvPercent) * RESORPTION_FACTOR) / (r * m);
}

// ---------------------------------------------------------------------------
// Kern: eine Vorwärts-Simulation
// ---------------------------------------------------------------------------

/**
 * Simuliert den Promilleverlauf vom ersten Getränk bis zur Nüchternheit (oder bis
 * zum expliziten Horizont). Liefert die Zeitreihe plus Peak und Nüchtern-Zeitpunkt.
 */
export function simulate(
  drinks: Drink[],
  profile: Profile,
  opts: EngineOptions = {},
): SimulationResult {
  const valid = drinks.filter((d) => d.volumeMl > 0 && d.abvPercent > 0 && isFinite(d.timestamp));
  if (valid.length === 0 || !(profile.weightKg > 0)) {
    return { points: [], peakBac: 0, peakTime: NaN, soberTime: null };
  }

  // Default: linear 45-min ramp (physiological time-to-peak). Callers can still
  // pass { absorption: 'instant' } for the MVP step-change model.
  const absorption: AbsorptionModel = opts.absorption ?? 'linear';
  const absMinutes = opts.absorptionMinutes ?? DEFAULT_ABSORPTION_MINUTES;
  const stepMinutes = Math.max(0.25, opts.stepMinutes ?? DEFAULT_STEP_MINUTES);
  const beta = profile.eliminationRate > 0 ? profile.eliminationRate : BETA_CONSERVATIVE;

  const absMs = absorption === 'linear' ? absMinutes * MS_PER_MINUTE : 0;
  let stepMs = stepMinutes * MS_PER_MINUTE;
  const dtH = stepMs / MS_PER_HOUR;

  const peaks = valid.map((d) => peakBacForDrink(d, profile));
  const totalPeak = peaks.reduce((a, b) => a + b, 0);

  const tStart = Math.min(...valid.map((d) => d.timestamp));
  const lastStart = Math.max(...valid.map((d) => d.timestamp));

  // Natürliches Ende: letzte Aufnahme + Zeit, um alles bei β wieder abzubauen (+ Puffer).
  const naturalEnd = lastStart + absMs + (totalPeak / beta) * MS_PER_HOUR + stepMs;
  let tEnd = opts.horizonHours ? tStart + opts.horizonHours * MS_PER_HOUR : naturalEnd;
  if (tEnd < tStart) tEnd = tStart;

  // Schritt-Anzahl kappen (Auflösung notfalls vergröbern).
  let steps = Math.ceil((tEnd - tStart) / stepMs);
  if (steps > MAX_SIM_STEPS) {
    stepMs = Math.ceil((tEnd - tStart) / MAX_SIM_STEPS);
    steps = Math.ceil((tEnd - tStart) / stepMs);
  }
  const dt = stepMs / MS_PER_HOUR;

  const points: BacPoint[] = [];
  const prevCum = new Array(valid.length).fill(0);
  let bac = 0;
  let peakBac = 0;
  let peakTime = tStart;

  for (let k = 0; k <= steps; k++) {
    const t = tStart + k * stepMs;
    let absorbed = 0;
    for (let i = 0; i < valid.length; i++) {
      const cum = absorbedFraction(t, valid[i].timestamp, absMs, stepMs);
      absorbed += peaks[i] * (cum - prevCum[i]);
      prevCum[i] = cum;
    }
    bac += absorbed;
    bac = Math.max(0, bac - beta * dt);
    points.push({ t, bac });
    if (bac > peakBac) {
      peakBac = bac;
      peakTime = t;
    }
  }

  const soberTime = firstCrossingDown(points, 0, peakTime);
  return { points, peakBac, peakTime, soberTime };
}

/**
 * Kumulierter resorbierter Anteil (0..1) eines Getränks zum Zeitpunkt t.
 * `instant`: absorbiert im Simulationsschritt, der den Zeitstempel ENTHÄLT
 * (t + stepMs > timestamp) — sonst würde ein Getränk zwischen zwei Schritten
 * bis zu stepMinutes lang unsichtbar bleiben. Konservativ: eher etwas früher
 * sichtbar als zu spät.
 */
function absorbedFraction(t: number, timestamp: number, absMs: number, stepMs: number): number {
  if (absMs <= 0) return t + stepMs > timestamp ? 1 : 0; // instant
  if (t <= timestamp) return 0;
  if (t >= timestamp + absMs) return 1;
  return (t - timestamp) / absMs;
}

// ---------------------------------------------------------------------------
// Abgeleitete Abfragen (lesen die Simulation, keine Re-Simulation der Physik)
// ---------------------------------------------------------------------------

/** Interpolierter Promillewert zum Zeitpunkt t (0 außerhalb des Verlaufs). */
export function bacAtTime(
  drinks: Drink[],
  profile: Profile,
  t: number,
  opts: EngineOptions = {},
): number {
  const { points } = simulate(drinks, profile, opts);
  return sampleAt(points, t);
}

/** Aktuell geschätzter Promillewert (= bacAtTime für "jetzt"). */
export function currentBac(
  drinks: Drink[],
  profile: Profile,
  now: number,
  opts: EngineOptions = {},
): number {
  return bacAtTime(drinks, profile, now, opts);
}

/**
 * Erster Zeitpunkt ab `from`, ab dem der Promillewert dauerhaft ≤ limit bleibt.
 * null, wenn der Wert ab `from` nie über limit liegt (also schon/permanent darunter)
 * oder wenn der Horizont vorher endet.
 *
 * Robust gegen "steigt noch"-Fälle: wir suchen den LETZTEN Punkt über limit und
 * interpolieren den nachfolgenden Abwärts-Durchgang.
 */
export function timeUntilBelow(
  drinks: Drink[],
  profile: Profile,
  limitPromille: number,
  from: number,
  opts: EngineOptions = {},
): number | null {
  const { points } = simulate(drinks, profile, opts);
  if (points.length === 0) return null;

  let lastAbove = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].t >= from && points[i].bac > limitPromille + EPS) lastAbove = i;
  }
  if (lastAbove === -1) return null; // ab `from` nie über dem Limit
  if (lastAbove >= points.length - 1) return null; // Horizont endet noch über Limit

  return interpolateLevel(points[lastAbove], points[lastAbove + 1], limitPromille);
}

export interface ThresholdForecast {
  /** Grenzwert in ‰. */
  limit: number;
  /** Epoch ms, ab dem der Wert dauerhaft ≤ limit bleibt; null wenn dauerhaft darunter oder kein Durchgang im Horizont. */
  time: number | null;
  /**
   * true, wenn aktuell ≤ limit UND der Wert auch nicht mehr darüber steigt (dauerhaft darunter).
   * Momentan-unter-Limit mit bevorstehender Überschreitung (Resorption läuft noch) zählt NICHT —
   * die App darf nie "unter dem Limit" melden, während die Kurve das Limit noch kreuzen wird.
   */
  alreadyBelow: boolean;
  /** true, wenn der Momentanwert ≤ limit ist (auch wenn er noch darüber steigen wird). */
  currentlyBelow: boolean;
}

/**
 * Prognose für mehrere Grenzwerte gleichzeitig (z.B. 0,5 / 0,3 / 0,0 ‰).
 * Reine Ableitung aus `currentBac` + `timeUntilBelow` – keine neue Physik.
 * Die Zukunft wird IMMER konsultiert: ohne `horizonHours` läuft die Simulation bis nüchtern,
 * daher gilt `time === null` ⇔ ab `now` nie (mehr) über dem Limit.
 */
export function forecastThresholds(
  drinks: Drink[],
  profile: Profile,
  limits: number[],
  now: number,
  opts: EngineOptions = {},
): ThresholdForecast[] {
  const bac = currentBac(drinks, profile, now, opts);
  return limits.map((limit) => {
    const currentlyBelow = bac <= limit + EPS;
    const time = timeUntilBelow(drinks, profile, limit, now, opts);
    const alreadyBelow = currentlyBelow && time === null;
    return { limit, time, alreadyBelow, currentlyBelow };
  });
}

/** Downgesampelte Zeitreihe [from..to] für die Chart-Darstellung. */
export function bacCurve(
  drinks: Drink[],
  profile: Profile,
  from: number,
  to: number,
  stepMinutes: number,
  opts: EngineOptions = {},
): BacPoint[] {
  const { points } = simulate(drinks, profile, opts);
  const out: BacPoint[] = [];
  if (to < from) return out;
  const stepMs = Math.max(0.25, stepMinutes) * MS_PER_MINUTE;
  for (let t = from; t <= to + EPS; t += stepMs) {
    out.push({ t, bac: sampleAt(points, t) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/** Linear interpolierter Wert der Zeitreihe bei t; 0 außerhalb des abgedeckten Bereichs. */
function sampleAt(points: BacPoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0].t) return t < points[0].t ? 0 : points[0].bac;
  const last = points[points.length - 1];
  if (t >= last.t) return 0; // nach Horizont: nüchtern (natürliches Ende liegt bei ~0)
  // binäre Suche wäre möglich; lineare reicht bei ~1000 Punkten
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return a.bac;
      const frac = (t - a.t) / span;
      return a.bac + frac * (b.bac - a.bac);
    }
  }
  return 0;
}

/**
 * Zeitpunkt des ersten Abwärts-Durchgangs auf `level` NACH `afterTime`.
 * Sucht den letzten Punkt über `level` und interpoliert zum nächsten.
 */
function firstCrossingDown(points: BacPoint[], level: number, afterTime: number): number | null {
  let lastAbove = -1;
  for (let i = 0; i < points.length; i++) {
    if (points[i].t >= afterTime && points[i].bac > level + EPS) lastAbove = i;
  }
  if (lastAbove === -1) return null;
  if (lastAbove >= points.length - 1) return null;
  return interpolateLevel(points[lastAbove], points[lastAbove + 1], level);
}

/** Linear interpolierter Zeitpunkt, an dem bac zwischen a und b den Wert `level` erreicht. */
function interpolateLevel(a: BacPoint, b: BacPoint, level: number): number {
  const denom = a.bac - b.bac;
  if (Math.abs(denom) < EPS) return b.t;
  const frac = clamp((a.bac - level) / denom, 0, 1);
  return a.t + frac * (b.t - a.t);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
