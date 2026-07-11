/**
 * Plain-Node Test-Runner für die BAC-Engine – im Stil der vorhandenen
 * `engine-core.test.js` im Repo-Root (ok()/approx()/pass-fail/process.exit).
 *
 * Lauf:  npx tsx app/scripts/run-engine-tests.ts
 * (Die identischen Fälle laufen später auch unter jest-expo in src/engine/bac.test.ts.)
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
} from '../src/engine/bac';
import { MS_PER_HOUR, MS_PER_MINUTE, FORECAST_THRESHOLDS } from '../src/engine/constants';

let pass = 0;
let fail = 0;

function ok(name: string, cond: boolean, got?: unknown) {
  if (cond) {
    pass++;
    // console.log(`  ok  ${name}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}` + (got !== undefined ? `  (got: ${JSON.stringify(got)})` : ''));
  }
}

function approx(name: string, got: number, want: number, eps = 1e-6) {
  ok(`${name} ≈ ${want}`, Math.abs(got - want) <= eps, got);
}

const T0 = 1_600_000_000_000; // fester Referenz-Zeitpunkt (kein Date.now → deterministisch)

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

function drink(id: string, tOffsetMin: number, volumeMl: number, abvPercent: number): Drink {
  return { id, timestamp: T0 + tOffsetMin * MS_PER_MINUTE, volumeMl, abvPercent };
}

// --- 1. Grundformeln -------------------------------------------------------
approx('gramsOfAlcohol(500,5)', gramsOfAlcohol(500, 5), 20);
approx('gramsOfAlcohol(200,12)', gramsOfAlcohol(200, 12), 19.2);
approx('gramsOfAlcohol(40,40)', gramsOfAlcohol(40, 40), 12.8);
ok('gramsOfAlcohol(0,5)===0', gramsOfAlcohol(0, 5) === 0);

approx('simpleR(male)', simpleR('male'), 0.7);
approx('simpleR(female)', simpleR('female'), 0.6);

approx('seidlR(male,80,180)', seidlR('male', 80, 180), 0.72816, 1e-4);
approx('seidlR(female,65,168)', seidlR('female', 65, 168), 0.643528, 1e-4);
ok('seidlR clamps into [0.4,0.9]', seidlR('male', 200, 120) >= 0.4 && seidlR('male', 40, 210) <= 0.9);

// --- 2. distributionFactor / applicableLimit -------------------------------
ok(
  'distributionFactor simple → 0.7',
  Math.abs(distributionFactor(maleSimple()) - 0.7) < 1e-9,
);
{
  const seidlProfile: Profile = { ...maleSimple(), distributionMode: 'seidl', heightCm: 180 };
  approx('distributionFactor seidl uses height', distributionFactor(seidlProfile), 0.72816, 1e-4);
  const noHeight: Profile = { ...maleSimple(), distributionMode: 'seidl' };
  approx('distributionFactor seidl w/o height → simple', distributionFactor(noHeight), 0.7);
}
ok('applicableLimit novice forces 0.0', applicableLimit({ ...maleSimple(), isNovice: true, targetLimitPromille: 0.5 }) === 0);
ok('applicableLimit non-novice keeps target', applicableLimit({ ...maleSimple(), targetLimitPromille: 0.3 }) === 0.3);

// --- 3. Einzelbeitrag -------------------------------------------------------
// 0,5 L Bier @ 5 % für 80-kg-Mann (simple r=0,7): (20·0,9)/(0,7·80) = 0,32142857 ‰
approx('peakBacForDrink 0,5L/5%/80kg', peakBacForDrink(drink('a', 0, 500, 5), maleSimple()), 0.3214286, 1e-5);

// --- 4. Simulation: ein Bier -----------------------------------------------
{
  const drinks = [drink('a', 0, 500, 5)];
  const p = maleSimple();
  const sim = simulate(drinks, p);
  approx('single beer peakBac', sim.peakBac, 0.3214286, 0.01);
  ok('single beer peakTime ~ T0', Math.abs(sim.peakTime - T0) <= 2 * MS_PER_MINUTE, sim.peakTime - T0);

  // Elimination ~0,1 ‰/h: Abfall zwischen +30 min und +90 min ≈ 0,1
  const b30 = bacAtTime(drinks, p, T0 + 30 * MS_PER_MINUTE);
  const b90 = bacAtTime(drinks, p, T0 + 90 * MS_PER_MINUTE);
  approx('elimination ~0.1‰ per hour', b30 - b90, 0.1, 0.01);

  // nüchtern nach ~0,3214/0,1 = 3,214 h
  ok('single beer soberTime not null', sim.soberTime !== null);
  const soberH = ((sim.soberTime as number) - T0) / MS_PER_HOUR;
  approx('single beer soberTime ≈ 3.21h', soberH, 3.214, 0.1);

  // Vor dem Trinken und lange danach: 0
  ok('bac before first drink = 0', bacAtTime(drinks, p, T0 - 10 * MS_PER_MINUTE) === 0);
  approx('bac 6h later = 0', bacAtTime(drinks, p, T0 + 6 * MS_PER_HOUR), 0, 1e-6);
}

// --- 5. timeUntilBelow ------------------------------------------------------
{
  const drinks = [drink('a', 0, 500, 5)]; // Peak ~0,32 < 0,5
  const p = maleSimple();
  ok('timeUntilBelow 0.5 → null (nie drüber)', timeUntilBelow(drinks, p, 0.5, T0) === null);
  const tSober = timeUntilBelow(drinks, p, 0.0, T0);
  ok('timeUntilBelow 0.0 not null', tSober !== null);
  approx('timeUntilBelow 0.0 ≈ 3.21h', ((tSober as number) - T0) / MS_PER_HOUR, 3.214, 0.1);
}

// --- 6. Mehrere Getränke ----------------------------------------------------
{
  // 3 Bier 0,5 L / 5 % im 20-min-Abstand
  const drinks = [drink('a', 0, 500, 5), drink('b', 20, 500, 5), drink('c', 40, 500, 5)];
  const p = maleSimple();
  const sim = simulate(drinks, p);
  // Summe der Peaks 3×0,3214 = 0,964; minus etwas Elimination über 40 min
  ok('3 beers peak between 0.85 and 0.97', sim.peakBac > 0.85 && sim.peakBac < 0.97, sim.peakBac);
  ok('3 beers timeUntilBelow 0.5 > start', (timeUntilBelow(drinks, p, 0.5, T0) as number) > T0 + 40 * MS_PER_MINUTE);
  ok('3 beers soberTime after single-beer soberTime', (sim.soberTime as number) > T0 + 5 * MS_PER_HOUR);
}

// --- 7. Nüchterne Lücke (kein "negatives Gedächtnis") ----------------------
{
  const drinks = [drink('a', 0, 500, 5), drink('b', 8 * 60, 500, 5)]; // zweites Bier 8 h später
  const p = maleSimple();
  const justBefore = bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR - MS_PER_MINUTE);
  approx('bac ~0 right before second drink', justBefore, 0, 1e-3);
  const justAfter = bacAtTime(drinks, p, T0 + 8 * MS_PER_HOUR + MS_PER_MINUTE);
  // zweites Bier erreicht seinen eigenen Peak ~0,32, NICHT durch negatives Gedächtnis reduziert
  ok('second drink reaches its own peak ~0.32', justAfter > 0.28 && justAfter < 0.34, justAfter);
}

// --- 8. bacCurve ------------------------------------------------------------
{
  const drinks = [drink('a', 0, 500, 5)];
  const p = maleSimple();
  const curve = bacCurve(drinks, p, T0, T0 + 4 * MS_PER_HOUR, 15);
  ok('bacCurve produces points', curve.length === 17, curve.length);
  ok('bacCurve monotonic non-increasing after peak', curve[2].bac >= curve[6].bac);
  ok('bacCurve never negative', curve.every((pt) => pt.bac >= 0));
}

// --- 9. Randfälle -----------------------------------------------------------
{
  const p = maleSimple();
  const empty = simulate([], p);
  ok('empty drinks → no points', empty.points.length === 0 && empty.peakBac === 0 && empty.soberTime === null);
  ok('currentBac empty = 0', currentBac([], p, T0) === 0);
  const zeroWeight: Profile = { ...maleSimple(), weightKg: 0 };
  ok('zero weight → 0 (no crash)', currentBac([drink('a', 0, 500, 5)], zeroWeight, T0) === 0);
}

// --- 10. Frau vs. Mann (höhere Promille bei Frau, gleicher Konsum) ---------
{
  const beer = [drink('a', 0, 500, 5)];
  const male = simulate(beer, { ...maleSimple(70) });
  const female = simulate(beer, { ...maleSimple(70), sex: 'female' });
  ok('female peak > male peak (same weight/drink)', female.peakBac > male.peakBac, {
    male: male.peakBac,
    female: female.peakBac,
  });
}

// --- 11. forecastThresholds (0,5 / 0,3 / 0,0) -------------------------------
{
  const seidl: Profile = { ...maleSimple(), distributionMode: 'seidl', heightCm: 180 };
  // 3 Bier über 1,5 h (0 / 45 / 90 min)
  const drinks = [drink('a', 0, 500, 5), drink('b', 45, 500, 5), drink('c', 90, 500, 5)];
  const evalNow = T0 + 90 * MS_PER_MINUTE;
  const fc = forecastThresholds(drinks, seidl, FORECAST_THRESHOLDS, evalNow);

  ok('forecastThresholds returns 3 rows', fc.length === 3);
  ok('order 0.5 / 0.3 / 0.0', fc[0].limit === 0.5 && fc[1].limit === 0.3 && fc[2].limit === 0.0);
  ok('all above limit now → not alreadyBelow', fc.every((f) => f.alreadyBelow === false), fc);
  ok('all have a forecast time', fc.every((f) => f.time !== null));
  ok(
    'times ascending 0.5 < 0.3 < 0.0',
    (fc[0].time as number) < (fc[1].time as number) && (fc[1].time as number) < (fc[2].time as number),
    fc.map((f) => f.time),
  );

  // Lange danach: alles bereits darunter
  const later = forecastThresholds(drinks, seidl, FORECAST_THRESHOLDS, T0 + 20 * MS_PER_HOUR);
  ok('20h later: all alreadyBelow, time null', later.every((f) => f.alreadyBelow && f.time === null));
}

// --- 12. Getränk zwischen Simulationsschritten zählt sofort voll -------------
{
  const p = maleSimple();
  // Zweites Bier 45,5 min nach dem ersten (liegt ZWISCHEN den 1-min-Schritten).
  const drinks = [
    drink('a', 0, 500, 5),
    { id: 'b', timestamp: T0 + 45.5 * MS_PER_MINUTE, volumeMl: 500, abvPercent: 5 },
  ];
  const justAfter = bacAtTime(drinks, p, T0 + 45.5 * MS_PER_MINUTE + 1000);
  // Erwartung: Bier 1 (0,321 − 45min·0,1/60 ≈ 0,246) + Bier 2 voll (0,321) ≈ 0,57
  ok('off-grid drink counts immediately', justAfter > 0.5, justAfter);
}

console.log(`\n${pass}/${pass + fail} tests passed`);
process.exit(fail > 0 ? 1 : 0);
