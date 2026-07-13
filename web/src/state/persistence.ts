/**
 * localStorage persistence — versioned keys, validated on load, defaults on any failure.
 * A future schema change bumps to pp.web.v2.* with a one-time read of the v1 keys.
 */
import type { Profile } from '../engine';
import { BETA_CONSERVATIVE, LIMIT_GENERAL } from '../engine';
import type { CustomDrink } from '../data/presets';

export interface StoredDrink {
  id: string;
  timestamp: number;
  volumeMl: number;
  abvPercent: number;
  label: string;
  detail: string;
  e: string;
}

/** A closed evening: its drinks plus a summary frozen at close time. */
export interface DrinkSession {
  id: string;
  startedAt: number;
  endedAt: number;
  closedAt: number;
  /** Peak ‰ computed with the profile at close time — later profile edits don't rewrite history. */
  peakBac: number;
  drinks: StoredDrink[];
}

const KEY_PROFILE = 'pp.web.v1.profile';
const KEY_DRINKS = 'pp.web.v1.drinks';
const KEY_ONBOARDED = 'pp.web.v1.onboarded';
const KEY_CUSTOM = 'pp.web.v1.customDrinks';
const KEY_SESSIONS = 'pp.web.v1.sessions';
const KEY_EDITING = 'pp.web.v1.editing';

/** An archived evening reopened for editing, with the live evening set aside. */
export interface EditingState {
  session: DrinkSession;
  stash: StoredDrink[];
}

/** History cap — newest first; the oldest evenings fall off. */
const MAX_SESSIONS = 30;

// Note: drinks are NOT age-pruned anymore — the store's 12 h auto-archive moves
// finished evenings into the session history instead (nothing silently vanishes,
// and a reopened old evening survives reloads).

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

export function loadDrinks(): StoredDrink[] {
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
      (x as StoredDrink).abvPercent > 0,
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

export function loadCustomDrinks(): CustomDrink[] {
  const arr = read(KEY_CUSTOM);
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (x): x is CustomDrink =>
        !!x &&
        typeof x === 'object' &&
        typeof (x as CustomDrink).id === 'string' &&
        typeof (x as CustomDrink).e === 'string' &&
        typeof (x as CustomDrink).name === 'string' &&
        typeof (x as CustomDrink).vol === 'number' &&
        (x as CustomDrink).vol > 0 &&
        typeof (x as CustomDrink).abv === 'number' &&
        (x as CustomDrink).abv > 0,
    )
    .map((x) => ({
      id: x.id,
      e: x.e,
      name: x.name,
      detail: typeof x.detail === 'string' ? x.detail : '',
      vol: x.vol,
      abv: x.abv,
    }));
}

export function saveCustomDrinks(drinks: CustomDrink[]): void {
  write(KEY_CUSTOM, drinks);
}

/** Same shape checks as loadDrinks, but WITHOUT the age prune — history keeps old drinks. */
function sanitizeSessionDrink(x: unknown): StoredDrink | null {
  const d = x as StoredDrink;
  if (
    !d ||
    typeof d !== 'object' ||
    typeof d.id !== 'string' ||
    typeof d.timestamp !== 'number' ||
    !isFinite(d.timestamp) ||
    typeof d.volumeMl !== 'number' ||
    !(d.volumeMl > 0) ||
    typeof d.abvPercent !== 'number' ||
    !(d.abvPercent > 0)
  ) {
    return null;
  }
  return {
    id: d.id,
    timestamp: d.timestamp,
    volumeMl: d.volumeMl,
    abvPercent: d.abvPercent,
    label: typeof d.label === 'string' ? d.label : 'Getränk',
    detail: typeof d.detail === 'string' ? d.detail : '',
    e: typeof d.e === 'string' ? d.e : '🥤',
  };
}

function sanitizeSession(x: unknown): DrinkSession | null {
  const s = x as DrinkSession;
  if (
    !s ||
    typeof s !== 'object' ||
    typeof s.id !== 'string' ||
    typeof s.startedAt !== 'number' ||
    !isFinite(s.startedAt) ||
    typeof s.endedAt !== 'number' ||
    !isFinite(s.endedAt) ||
    typeof s.closedAt !== 'number' ||
    !isFinite(s.closedAt) ||
    typeof s.peakBac !== 'number' ||
    !isFinite(s.peakBac) ||
    !Array.isArray(s.drinks)
  ) {
    return null;
  }
  const drinks = s.drinks.map(sanitizeSessionDrink).filter((d): d is StoredDrink => d !== null);
  if (drinks.length === 0) return null;
  return { id: s.id, startedAt: s.startedAt, endedAt: s.endedAt, closedAt: s.closedAt, peakBac: s.peakBac, drinks };
}

export function loadSessions(): DrinkSession[] {
  const arr = read(KEY_SESSIONS);
  if (!Array.isArray(arr)) return [];
  const out: DrinkSession[] = [];
  for (const x of arr) {
    const s = sanitizeSession(x);
    if (s) out.push(s);
    if (out.length >= MAX_SESSIONS) break;
  }
  return out;
}

export function saveSessions(sessions: DrinkSession[]): void {
  write(KEY_SESSIONS, sessions.slice(0, MAX_SESSIONS));
}

export function loadEditing(): EditingState | null {
  const v = read(KEY_EDITING) as EditingState | null;
  if (!v || typeof v !== 'object') return null;
  const session = sanitizeSession(v.session);
  if (!session || !Array.isArray(v.stash)) return null;
  const stash = v.stash.map(sanitizeSessionDrink).filter((d): d is StoredDrink => d !== null);
  return { session, stash };
}

export function saveEditing(v: EditingState | null): void {
  if (v === null) {
    try {
      localStorage.removeItem(KEY_EDITING);
    } catch {
      // ignore
    }
    return;
  }
  write(KEY_EDITING, v);
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
