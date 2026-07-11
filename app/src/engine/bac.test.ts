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
  test('peakBacForDrink 0,5L/5%/80kg ≈ 0,32', () => {
    expect(peakBacForDrink(drink('a', 0, 500, 5), maleSimple())).toBeCloseTo(0.3214286, 5);
  });
});

describe('distributionFactor & Limit', () => {
  test('seidl nutzt Größe, fällt ohne Größe auf simple zurück', () => {
    expect(distributionFactor({ ...maleSimple(), distributionMode: 'seidl', heightCm: 180 })).toBeCloseTo(0.72816, 4);
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
  test('Peak ~0,32 ‰', () => {
    expect(simulate(drinks, p).peakBac).toBeCloseTo(0.32, 1);
  });
  test('Elimination ~0,1 ‰/h', () => {
    const b30 = bacAtTime(drinks, p, T0 + 30 * MS_PER_MINUTE);
    const b90 = bacAtTime(drinks, p, T0 + 90 * MS_PER_MINUTE);
    expect(b30 - b90).toBeCloseTo(0.1, 2);
  });
  test('nüchtern nach ~3,2 h', () => {
    const sober = simulate(drinks, p).soberTime;
    expect(sober).not.toBeNull();
    expect(((sober as number) - T0) / MS_PER_HOUR).toBeCloseTo(3.214, 1);
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
  test('0,0 → ~3,2 h', () => {
    const t = timeUntilBelow(drinks, p, 0.0, T0);
    expect(t).not.toBeNull();
    expect(((t as number) - T0) / MS_PER_HOUR).toBeCloseTo(3.214, 1);
  });
});

describe('Mehrere Getränke & nüchterne Lücke', () => {
  test('3 Bier: Peak 0,85–0,97', () => {
    const drinks = [drink('a', 0, 500, 5), drink('b', 20, 500, 5), drink('c', 40, 500, 5)];
    const peak = simulate(drinks, maleSimple()).peakBac;
    expect(peak).toBeGreaterThan(0.85);
    expect(peak).toBeLessThan(0.97);
  });
  test('zweites Bier 8 h später erbt kein negatives Gedächtnis', () => {
    const drinks = [drink('a', 0, 500, 5), drink('b', 8 * 60, 500, 5)];
    const p = maleSimple();
    expect(bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR - MS_PER_MINUTE)).toBeCloseTo(0, 3);
    const after = bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR + MS_PER_MINUTE);
    expect(after).toBeGreaterThan(0.28);
    expect(after).toBeLessThan(0.34);
  });
});

describe('bacCurve & Randfälle', () => {
  test('Kurve nicht negativ, fällt nach Peak', () => {
    const curve = bacCurve([drink('a', 0, 500, 5)], maleSimple(), T0, T0 + 4 * MS_PER_HOUR, 15);
    expect(curve.length).toBe(17);
    expect(curve.every((pt) => pt.bac >= 0)).toBe(true);
    expect(curve[2].bac).toBeGreaterThanOrEqual(curve[6].bac);
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

  test('3 Bier über 1,5 h: 3 Zeilen, aufsteigende Zeiten, alle über Limit', () => {
    const fc = forecastThresholds(drinks, seidl, FORECAST_THRESHOLDS, T0 + 90 * MS_PER_MINUTE);
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

  test('Getränk zwischen Simulationsschritten zählt sofort voll', () => {
    const p = maleSimple();
    const two = [drink('a', 0, 500, 5), { id: 'b', timestamp: T0 + 45.5 * MS_PER_MINUTE, volumeMl: 500, abvPercent: 5 }];
    expect(bacAtTime(two, p, T0 + 45.5 * MS_PER_MINUTE + 1000)).toBeGreaterThan(0.5);
  });
});
