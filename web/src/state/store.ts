/**
 * App state + mutations. BAC is never stored — always derived from drinks + profile.
 * Mutations persist synchronously and notify the app loop via onInvalidate.
 */
import { simulate, type Profile } from '../engine';
import type { CustomDrink, DrinkPreset } from '../data/presets';
import {
  DrinkSession,
  EditingState,
  StoredDrink,
  loadCustomDrinks,
  loadDrinks,
  loadEditing,
  loadOnboarded,
  loadProfile,
  loadRecentDrinks,
  loadSessions,
  saveCustomDrinks,
  saveDrinks,
  saveEditing,
  saveOnboarded,
  saveProfile,
  saveRecentDrinks,
  saveSessions,
} from './persistence';

/** A finished evening auto-archives once the newest drink is this old. */
const AUTO_CLOSE_MS = 12 * 3600 * 1000;
const MAX_SESSIONS = 30;
/** Recently-added drink templates kept for the quick-add fan (most recent first). */
const MAX_RECENT = 12;

/** Identity of a drink template for de-duping the recent list (ignores label text drift). */
function recentKey(p: DrinkPreset): string {
  return `${p.e}|${p.name}|${p.vol}|${p.abv}`;
}

function newId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `d${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

export class Store {
  profile: Profile;
  drinks: StoredDrink[];
  customDrinks: CustomDrink[];
  sessions: DrinkSession[];
  /** Drink templates in most-recently-added order — powers the quick-add fan. */
  recentDrinks: DrinkPreset[];
  /** Non-null while editing a reopened past evening; holds the stashed live evening. */
  editing: EditingState | null;
  onboarded: boolean;

  /** transient UI state */
  shiftMin = 0; // minutes from real now; tick strip sets 0..720 (future), chart may set negative (past)
  agoMin = 0;
  sheetOpen = false;
  profileOpen = false;

  private listeners: Array<() => void> = [];

  constructor(now: number) {
    this.profile = loadProfile();
    this.drinks = loadDrinks();
    this.customDrinks = loadCustomDrinks();
    this.sessions = loadSessions();
    this.recentDrinks = loadRecentDrinks();
    this.editing = loadEditing();
    this.onboarded = loadOnboarded();
    this.profileOpen = !this.onboarded;
    // Cold start for a returning user (no MRU yet): seed the fan from tonight's
    // log, newest first, so the quick-add offers real drinks right away.
    if (this.recentDrinks.length === 0 && this.drinks.length > 0) {
      const seen = new Set<string>();
      const seed: DrinkPreset[] = [];
      for (let i = this.drinks.length - 1; i >= 0 && seed.length < MAX_RECENT; i--) {
        const d = this.drinks[i];
        const p: DrinkPreset = { e: d.e, name: d.label, detail: d.detail, vol: d.volumeMl, abv: d.abvPercent };
        if (seen.has(recentKey(p))) continue;
        seen.add(recentKey(p));
        seed.push(p);
      }
      this.recentDrinks = seed;
      saveRecentDrinks(this.recentDrinks);
    }
    // Auto-archive a finished evening: the last drink is ≥ 12 h old → it belongs
    // to history, and the current view starts fresh (replaces silent pruning).
    // Skipped while editing a past evening — its drinks are old by definition.
    if (!this.editing && this.drinks.length > 0 && now - Math.max(...this.drinks.map((d) => d.timestamp)) >= AUTO_CLOSE_MS) {
      this.archiveCurrentDrinks(now, false);
    }
  }

  /** True while a reopened past evening is being edited (the live evening is stashed). */
  get editingPast(): boolean {
    return this.editing !== null;
  }

  onInvalidate(fn: () => void): void {
    this.listeners.push(fn);
  }

  invalidate(): void {
    for (const fn of this.listeners) fn();
  }

  addDrink(p: DrinkPreset, agoMin: number, effectiveNow: number): StoredDrink {
    const drink: StoredDrink = {
      id: newId(),
      timestamp: effectiveNow - agoMin * 60000,
      volumeMl: p.vol,
      abvPercent: p.abv,
      label: p.name,
      detail: p.detail,
      e: p.e,
    };
    this.drinks = this.drinks.concat(drink);
    saveDrinks(this.drinks);
    this.rememberRecent(p);
    this.invalidate();
    return drink;
  }

  /** Move a just-added drink template to the front of the quick-add fan's memory. */
  private rememberRecent(p: DrinkPreset): void {
    const entry: DrinkPreset = { e: p.e, name: p.name, detail: p.detail, vol: p.vol, abv: p.abv };
    const k = recentKey(entry);
    this.recentDrinks = [entry, ...this.recentDrinks.filter((d) => recentKey(d) !== k)].slice(0, MAX_RECENT);
    saveRecentDrinks(this.recentDrinks);
  }

  removeDrink(id: string): void {
    this.drinks = this.drinks.filter((d) => d.id !== id);
    saveDrinks(this.drinks);
    this.invalidate();
  }

  /** Patch a logged drink in place (time, amount, strength, or type) and persist. */
  updateDrink(id: string, patch: Partial<Omit<StoredDrink, 'id'>>): void {
    this.drinks = this.drinks.map((d) => (d.id === id ? { ...d, ...patch } : d));
    saveDrinks(this.drinks);
    this.invalidate();
  }

  clearDrinks(): void {
    this.drinks = [];
    saveDrinks(this.drinks);
    this.invalidate();
  }

  addCustomDrink(fields: Omit<CustomDrink, 'id'>): CustomDrink {
    const drink: CustomDrink = { ...fields, id: newId() };
    this.customDrinks = this.customDrinks.concat(drink);
    saveCustomDrinks(this.customDrinks);
    this.invalidate();
    return drink;
  }

  updateCustomDrink(id: string, patch: Partial<Omit<CustomDrink, 'id'>>): void {
    this.customDrinks = this.customDrinks.map((d) => (d.id === id ? { ...d, ...patch } : d));
    saveCustomDrinks(this.customDrinks);
    this.invalidate();
  }

  removeCustomDrink(id: string): void {
    this.customDrinks = this.customDrinks.filter((d) => d.id !== id);
    saveCustomDrinks(this.customDrinks);
    this.invalidate();
  }

  /** Close the current evening into history and reset the log. No-op without drinks. */
  closeSession(now: number): void {
    if (this.editing) {
      this.finishEditing(now); // a reopened past evening is never re-archived as a new session
      return;
    }
    if (this.drinks.length === 0) return;
    this.archiveCurrentDrinks(now, true);
  }

  removeSession(id: string): void {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    saveSessions(this.sessions);
    this.invalidate();
  }

  /**
   * Reopen an archived evening for editing WITHOUT touching the live evening:
   * the ongoing evening is stashed (never archived), the past evening becomes the
   * editable log, and a banner marks that you're editing the past. finishEditing()
   * writes the edits back to history and restores the stashed live evening intact.
   */
  reopenSession(id: string): void {
    const session = this.sessions.find((s) => s.id === id);
    if (!session) return;
    // Preserve the LIVE evening across successive legacy edits; commit prior edits first.
    const stash = this.editing ? this.editing.stash : this.drinks;
    if (this.editing) this.commitEditing();
    this.sessions = this.sessions.filter((s) => s.id !== id);
    this.editing = { session, stash };
    this.drinks = session.drinks;
    saveEditing(this.editing);
    saveSessions(this.sessions);
    saveDrinks(this.drinks);
    this.invalidate();
  }

  /** Leave editing mode: save the edited past evening back to history, restore the live evening. */
  finishEditing(now: number): void {
    if (!this.editing) return;
    this.commitEditing();
    this.drinks = this.editing.stash;
    this.editing = null;
    saveEditing(null);
    // The stashed evening may itself have gone stale while we were in the past
    // (e.g. editing started at night, finished days later) — same 12 h rule as boot.
    if (this.drinks.length > 0 && now - Math.max(...this.drinks.map((d) => d.timestamp)) >= AUTO_CLOSE_MS) {
      this.archiveCurrentDrinks(now, true); // saves sessions + drinks + notifies
      return;
    }
    saveSessions(this.sessions);
    saveDrinks(this.drinks);
    this.invalidate();
  }

  /** Rebuild the edited past evening back into `sessions` (dropped if emptied). No stash/log side effects. */
  private commitEditing(): void {
    const e = this.editing;
    if (!e) return;
    if (this.drinks.length > 0) {
      const rebuilt: DrinkSession = {
        id: e.session.id,
        startedAt: Math.min(...this.drinks.map((d) => d.timestamp)),
        endedAt: Math.max(...this.drinks.map((d) => d.timestamp)),
        closedAt: e.session.closedAt,
        peakBac: simulate(this.drinks, this.profile).peakBac,
        drinks: this.drinks,
      };
      this.sessions = [rebuilt, ...this.sessions].slice(0, MAX_SESSIONS);
    }
  }

  /** Shared close path — `notify` false during construction (no listeners yet). */
  private archiveCurrentDrinks(now: number, notify: boolean): void {
    const drinks = this.drinks;
    const session: DrinkSession = {
      id: newId(),
      startedAt: Math.min(...drinks.map((d) => d.timestamp)),
      endedAt: Math.max(...drinks.map((d) => d.timestamp)),
      closedAt: now,
      peakBac: simulate(drinks, this.profile).peakBac,
      drinks,
    };
    this.sessions = [session, ...this.sessions].slice(0, MAX_SESSIONS);
    this.drinks = [];
    saveSessions(this.sessions);
    saveDrinks(this.drinks);
    if (notify) this.invalidate();
  }

  // Note: targetLimitPromille keeps the user's choice even while isNovice is on —
  // the engine's applicableLimit() enforces 0.0 for novices, so toggling the
  // switch off restores the previously selected limit (prototype behavior).
  setProfile(patch: Partial<Profile>): void {
    this.profile = { ...this.profile, ...patch };
    saveProfile(this.profile);
    this.invalidate();
  }

  finishOnboarding(): void {
    this.onboarded = true;
    saveOnboarded();
    saveProfile(this.profile); // persist even when the user accepted all defaults
    this.profileOpen = false;
    this.invalidate();
  }
}
