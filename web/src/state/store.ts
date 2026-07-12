/**
 * App state + mutations. BAC is never stored — always derived from drinks + profile.
 * Mutations persist synchronously and notify the app loop via onInvalidate.
 */
import type { Profile } from '../engine';
import type { CustomDrink, DrinkPreset } from '../data/presets';
import {
  StoredDrink,
  loadCustomDrinks,
  loadDrinks,
  loadOnboarded,
  loadProfile,
  saveCustomDrinks,
  saveDrinks,
  saveOnboarded,
  saveProfile,
} from './persistence';

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
  onboarded: boolean;

  /** transient UI state */
  shiftMin = 0; // minutes from real now; tick strip sets 0..720 (future), chart may set negative (past)
  agoMin = 0;
  sheetOpen = false;
  profileOpen = false;

  private listeners: Array<() => void> = [];

  constructor(now: number) {
    this.profile = loadProfile();
    this.drinks = loadDrinks(now);
    this.customDrinks = loadCustomDrinks();
    this.onboarded = loadOnboarded();
    this.profileOpen = !this.onboarded;
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
    this.invalidate();
    return drink;
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
