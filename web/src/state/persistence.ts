/**
 * localStorage persistence — versioned keys, validated on load, defaults on any failure.
 * A future schema change bumps to pp.web.v2.* with a one-time read of the v1 keys.
 */
import type { Profile } from '../engine';
import { BETA_CONSERVATIVE, LIMIT_GENERAL } from '../engine';

export interface StoredDrink {
  id: string;
  timestamp: number;
  volumeMl: number;
  abvPercent: number;
  label: string;
  detail: string;
  e: string;
}

const KEY_PROFILE = 'pp.web.v1.profile';
const KEY_DRINKS = 'pp.web.v1.drinks';
const KEY_ONBOARDED = 'pp.web.v1.onboarded';

/** Drinks older than this are pruned on load ("Heute Abend" framing, bounded storage). */
const MAX_DRINK_AGE_MS = 48 * 3600 * 1000;

export function defaultProfile(): Profile {
  return {
    weightKg: 80,
    heightCm: 180,
    sex: 'male',
    distributionMode: 'seidl',
    eliminationRate: BETA_CONSERVATIVE,
    targetLimitPromille: LIMIT_GENERAL,
    isNovice: false,
  };
}

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode — the app still works, just without persistence
  }
}

export function loadProfile(): Profile {
  const p = read(KEY_PROFILE) as Partial<Profile> | null;
  const d = defaultProfile();
  if (!p || typeof p !== 'object') return d;
  const weightKg = typeof p.weightKg === 'number' && p.weightKg >= 40 && p.weightKg <= 160 ? p.weightKg : d.weightKg;
  const heightCm = typeof p.heightCm === 'number' && p.heightCm >= 140 && p.heightCm <= 210 ? p.heightCm : d.heightCm;
  const sex = p.sex === 'male' || p.sex === 'female' ? p.sex : d.sex;
  const limit = p.targetLimitPromille === 0 || p.targetLimitPromille === 0.3 || p.targetLimitPromille === 0.5
    ? p.targetLimitPromille
    : d.targetLimitPromille;
  const isNovice = typeof p.isNovice === 'boolean' ? p.isNovice : d.isNovice;
  // targetLimitPromille keeps the stored choice even for novices — the engine's
  // applicableLimit() enforces 0.0 while isNovice is set.
  return {
    ...d,
    weightKg,
    heightCm,
    sex,
    targetLimitPromille: limit,
    isNovice,
  };
}

export function saveProfile(p: Profile): void {
  write(KEY_PROFILE, p);
}

export function loadDrinks(now: number): StoredDrink[] {
  const arr = read(KEY_DRINKS);
  if (!Array.isArray(arr)) return [];
  return arr.filter(
    (x): x is StoredDrink =>
      !!x &&
      typeof x === 'object' &&
      typeof (x as StoredDrink).id === 'string' &&
      typeof (x as StoredDrink).timestamp === 'number' &&
      isFinite((x as StoredDrink).timestamp) &&
      typeof (x as StoredDrink).volumeMl === 'number' &&
      (x as StoredDrink).volumeMl > 0 &&
      typeof (x as StoredDrink).abvPercent === 'number' &&
      (x as StoredDrink).abvPercent > 0 &&
      now - (x as StoredDrink).timestamp < MAX_DRINK_AGE_MS,
  ).map((x) => ({
    id: x.id,
    timestamp: x.timestamp,
    volumeMl: x.volumeMl,
    abvPercent: x.abvPercent,
    label: typeof x.label === 'string' ? x.label : 'Getränk',
    detail: typeof x.detail === 'string' ? x.detail : '',
    e: typeof x.e === 'string' ? x.e : '🥤',
  }));
}

export function saveDrinks(drinks: StoredDrink[]): void {
  write(KEY_DRINKS, drinks);
}

export function loadOnboarded(): boolean {
  try {
    return localStorage.getItem(KEY_ONBOARDED) === '1';
  } catch {
    return false;
  }
}

export function saveOnboarded(): void {
  try {
    localStorage.setItem(KEY_ONBOARDED, '1');
  } catch {
    // ignore
  }
}
