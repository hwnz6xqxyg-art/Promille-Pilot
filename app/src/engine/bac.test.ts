/**
 * Jest-Tests der BAC-Engine (laufen unter `npm test` via jest-expo).
 * Dieselben Fälle wie scripts/run-engine-tests.ts, hier in Jest-Syntax.
 */

import {
  gramsOfAlcohol,
  simpleR,
  seidlR,
  distributionFactor,
  applicableLimit,
  peakBacForDrink,
  simulate,
  currentBac,
  bacAtTime,
  timeUntilBelow,
  forecastThresholds,
  bacCurve,
  type Profile,
  type Drink,
} from './bac';
import { MS_PER_HOUR, MS_PER_MINUTE, FORECAST_THRESHOLDS } from './constants';

const T0 = 1_600_000_000_000;

function maleSimple(weightKg = 80): Profile {
  return {
    weightKg,
    sex: 'male',
    distributionMode: 'simple',
    eliminationRate: 0.1,
    targetLimitPromille: 0.5,
    isNovice: false,
  };
}
const drink = (id: string, tMin: number, ml: number, abv: number): Drink => ({
  id,
  timestamp: T0 + tMin * MS_PER_MINUTE,
  volumeMl: ml,
  abvPercent: abv,
});

// Default absorption is 'linear' (30-min ramp). Cases asserting the MVP
// step-change numbers pin the instant model explicitly.
// Konservative Basis: Resorption 1,0 (kein Abzug) und r = min(Seidl, simple).
const INSTANT = { absorption: 'instant' } as const;

describe('Grundformeln', () => {
  test('gramsOfAlcohol', () => {
    expect(gramsOfAlcohol(500, 5)).toBeCloseTo(20, 6);
    expect(gramsOfAlcohol(200, 12)).toBeCloseTo(19.2, 6);
    expect(gramsOfAlcohol(0, 5)).toBe(0);
  });
  test('simpleR', () => {
    expect(simpleR('male')).toBe(0.7);
    expect(simpleR('female')).toBe(0.6);
  });
  test('seidlR', () => {
    expect(seidlR('male', 80, 180)).toBeCloseTo(0.72816, 4);
    expect(seidlR('female', 65, 168)).toBeCloseTo(0.643528, 4);
  });
  test('peakBacForDrink 0,5L/5%/80kg ≈ 0,36 (volle Anrechnung)', () => {
    expect(peakBacForDrink(drink('a', 0, 500, 5), maleSimple())).toBeCloseTo(0.3571429, 5);
  });
});

describe('distributionFactor & Limit', () => {
  test('seidl darf nur erhöhen: auf klassisches r geklammert, ohne Größe simple', () => {
    // 80/180: Seidl 0.728 wäre GÜNSTIGER als klassisch 0.7 → geklammert auf 0.7.
    expect(distributionFactor({ ...maleSimple(), distributionMode: 'seidl', heightCm: 180 })).toBeCloseTo(0.7, 6);
    // 90/180: Seidl 0.680 < 0.7 → bleibt (Personalisierung erhöht die Schätzung).
    expect(distributionFactor({ ...maleSimple(90), distributionMode: 'seidl', heightCm: 180 })).toBeCloseTo(0.67995, 4);
    expect(distributionFactor({ ...maleSimple(), distributionMode: 'seidl' })).toBeCloseTo(0.7, 6);
  });
  test('Fahranfänger erzwingt 0,0', () => {
    expect(applicableLimit({ ...maleSimple(), isNovice: true, targetLimitPromille: 0.5 })).toBe(0);
    expect(applicableLimit({ ...maleSimple(), targetLimitPromille: 0.3 })).toBe(0.3);
  });
});

describe('Simulation: ein Bier', () => {
  const drinks = [drink('a', 0, 500, 5)];
  const p = maleSimple();
  test('Peak ~0,36 ‰ (instant)', () => {
    expect(simulate(drinks, p, INSTANT).peakBac).toBeCloseTo(0.36, 1);
  });
  test('Elimination ~0,1 ‰/h (instant, im Abbau-Ast)', () => {
    const b30 = bacAtTime(drinks, p, T0 + 30 * MS_PER_MINUTE, INSTANT);
    const b90 = bacAtTime(drinks, p, T0 + 90 * MS_PER_MINUTE, INSTANT);
    expect(b30 - b90).toBeCloseTo(0.1, 2);
  });
  test('nüchtern nach ~3,6 h', () => {
    const sober = simulate(drinks, p).soberTime;
    expect(sober).not.toBeNull();
    expect(((sober as number) - T0) / MS_PER_HOUR).toBeCloseTo(3.571, 1);
  });
  test('vor dem Trinken und 6 h später = 0', () => {
    expect(bacAtTime(drinks, p, T0 - 10 * MS_PER_MINUTE)).toBe(0);
    expect(bacAtTime(drinks, p, T0 + 6 * MS_PER_HOUR)).toBeCloseTo(0, 6);
  });
});

describe('timeUntilBelow', () => {
  const drinks = [drink('a', 0, 500, 5)];
  const p = maleSimple();
  test('0,5 → null (nie darüber)', () => {
    expect(timeUntilBelow(drinks, p, 0.5, T0)).toBeNull();
  });
  test('0,0 → ~3,6 h', () => {
    const t = timeUntilBelow(drinks, p, 0.0, T0);
    expect(t).not.toBeNull();
    expect(((t as number) - T0) / MS_PER_HOUR).toBeCloseTo(3.571, 1);
  });
});

describe('Mehrere Getränke & nüchterne Lücke', () => {
  test('3 Bier: Peak 0,95–1,08 (instant)', () => {
    const drinks = [drink('a', 0, 500, 5), drink('b', 20, 500, 5), drink('c', 40, 500, 5)];
    const peak = simulate(drinks, maleSimple(), INSTANT).peakBac;
    expect(peak).toBeGreaterThan(0.95);
    expect(peak).toBeLessThan(1.08);
  });
  test('zweites Bier 8 h später erbt kein negatives Gedächtnis (instant)', () => {
    const drinks = [drink('a', 0, 500, 5), drink('b', 8 * 60, 500, 5)];
    const p = maleSimple();
    expect(bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR - MS_PER_MINUTE)).toBeCloseTo(0, 3);
    const after = bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR + MS_PER_MINUTE, INSTANT);
    expect(after).toBeGreaterThan(0.31);
    expect(after).toBeLessThan(0.37);
  });
});

describe('bacCurve & Randfälle', () => {
  test('Kurve nicht negativ, fällt nach Peak (instant)', () => {
    const curve = bacCurve([drink('a', 0, 500, 5)], maleSimple(), T0, T0 + 4 * MS_PER_HOUR, 15);
    expect(curve.length).toBe(17);
    expect(curve.every((pt) => pt.bac >= 0)).toBe(true);
    // Peak bei t=0 nur im Sprung-Modell → dort über die Stützpunkte nicht steigend.
    const curveInstant = bacCurve([drink('a', 0, 500, 5)], maleSimple(), T0, T0 + 4 * MS_PER_HOUR, 15, INSTANT);
    expect(curveInstant[2].bac).toBeGreaterThanOrEqual(curveInstant[6].bac);
  });
  test('leer / Gewicht 0 → 0, kein Crash', () => {
    expect(currentBac([], maleSimple(), T0)).toBe(0);
    expect(currentBac([drink('a', 0, 500, 5)], { ...maleSimple(), weightKg: 0 }, T0)).toBe(0);
  });
  test('Frau > Mann bei gleichem Konsum/Gewicht', () => {
    const beer = [drink('a', 0, 500, 5)];
    const male = simulate(beer, maleSimple(70)).peakBac;
    const female = simulate(beer, { ...maleSimple(70), sex: 'female' }).peakBac;
    expect(female).toBeGreaterThan(male);
  });
});

describe('forecastThresholds (0,5 / 0,3 / 0,0)', () => {
  const seidl: Profile = { ...maleSimple(), distributionMode: 'seidl', heightCm: 180 };
  const drinks = [drink('a', 0, 500, 5), drink('b', 45, 500, 5), drink('c', 90, 500, 5)];

  test('3 Bier über 1,5 h: 3 Zeilen, aufsteigende Zeiten, alle über Limit (instant)', () => {
    // Beim letzten Getränk ausgewertet — im Sprung-Modell sicher über 0,5.
    const fc = forecastThresholds(drinks, seidl, FORECAST_THRESHOLDS, T0 + 90 * MS_PER_MINUTE, INSTANT);
    expect(fc.map((f) => f.limit)).toEqual([0.5, 0.3, 0.0]);
    expect(fc.every((f) => f.alreadyBelow === false)).toBe(true);
    expect(fc.every((f) => f.time !== null)).toBe(true);
    expect(fc[0].time as number).toBeLessThan(fc[1].time as number);
    expect(fc[1].time as number).toBeLessThan(fc[2].time as number);
  });

  test('lange danach: alles bereits darunter, time null', () => {
    const later = forecastThresholds(drinks, seidl, FORECAST_THRESHOLDS, T0 + 20 * MS_PER_HOUR);
    expect(later.every((f) => f.alreadyBelow && f.time === null)).toBe(true);
  });

  test('Getränk zwischen Simulationsschritten zählt sofort voll (instant)', () => {
    const p = maleSimple();
    const two = [drink('a', 0, 500, 5), { id: 'b', timestamp: T0 + 45.5 * MS_PER_MINUTE, volumeMl: 500, abvPercent: 5 }];
    expect(bacAtTime(two, p, T0 + 45.5 * MS_PER_MINUTE + 1000, INSTANT)).toBeGreaterThan(0.5);
  });
});

describe('"Steigt noch": momentan unter Limit, Überschreitung steht bevor', () => {
  const p = maleSimple();
  const evalNow = T0 + 1 * MS_PER_MINUTE;

  test('3 frische Biere: kein alreadyBelow trotz Momentanwert ~0', () => {
    const drinks = [drink('a', 0, 500, 5), drink('b', 0, 500, 5), drink('c', 0, 500, 5)];
    const fc = forecastThresholds(drinks, p, FORECAST_THRESHOLDS, evalNow);
    expect(fc[0].currentlyBelow).toBe(true);
    expect(fc[0].alreadyBelow).toBe(false); // Überschreitung steht bevor
    expect(fc[0].time).not.toBeNull();
    expect(fc[0].time as number).toBeGreaterThan(T0 + 45 * MS_PER_MINUTE); // nach dem Peak
    expect(fc[2].alreadyBelow).toBe(false);
  });

  test('kleines Bier (Peak < 0,5): dauerhaft darunter → alreadyBelow', () => {
    const small = [drink('s', 0, 330, 5)];
    const fc = forecastThresholds(small, p, FORECAST_THRESHOLDS, evalNow);
    expect(fc[0].alreadyBelow).toBe(true);
    expect(fc[0].time).toBeNull();
    expect(fc[2].alreadyBelow).toBe(false); // 0,0 ‰ wird noch überschritten
    expect(fc[2].time).not.toBeNull();
  });
});

describe('Lineare Resorption (Default): sanfter Anstieg statt Sprung', () => {
  const drinks = [drink('a', 0, 500, 5)];
  const p = maleSimple();

  test('Peak (~0,307) etwas niedriger und ~30 min später als instant', () => {
    const sim = simulate(drinks, p); // Default = linear
    expect(sim.peakBac).toBeCloseTo(0.307, 2);
    expect(sim.peakBac).toBeLessThan(0.3571429);
    expect(Math.abs(sim.peakTime - (T0 + 30 * MS_PER_MINUTE))).toBeLessThanOrEqual(2 * MS_PER_MINUTE);
  });

  test('frisch geloggt: fast 0, dann steigend bis zum Peak', () => {
    const b1 = bacAtTime(drinks, p, T0 + 1 * MS_PER_MINUTE);
    const b10 = bacAtTime(drinks, p, T0 + 10 * MS_PER_MINUTE);
    const b20 = bacAtTime(drinks, p, T0 + 20 * MS_PER_MINUTE);
    const b30 = bacAtTime(drinks, p, T0 + 30 * MS_PER_MINUTE);
    expect(b1).toBeLessThan(0.05);
    expect(b10).toBeLessThan(b20);
    expect(b20).toBeLessThan(b30);
  });

  test('Getränk nach nüchterner Lücke rampt ebenfalls (kein Sofort-Sprung)', () => {
    const gap = [drink('a', 0, 500, 5), drink('b', 8 * 60, 500, 5)];
    expect(bacAtTime(gap, p, T0 + 8 * MS_PER_HOUR + 1 * MS_PER_MINUTE)).toBeLessThan(0.05);
    const fresh30 = bacAtTime(gap, p, T0 + 8 * MS_PER_HOUR + 30 * MS_PER_MINUTE);
    expect(fresh30).toBeGreaterThan(0.28);
    expect(fresh30).toBeLessThan(0.33);
  });
});
