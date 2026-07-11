/**
 * Getränke-Log (persistiert). Immer nach Zeit sortiert.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import { zustandStorage } from '@/storage/persist';
import { STORAGE_KEYS, SCHEMA_VERSION } from '@/storage/keys';
import type { Drink } from '@/engine/bac';

export type DrinkInput = Omit<Drink, 'id'>;

interface DrinksState {
  drinks: Drink[];
  addDrink: (input: DrinkInput) => void;
  updateDrink: (id: string, patch: Partial<DrinkInput>) => void;
  removeDrink: (id: string) => void;
  resetSession: () => void;
}

const byTime = (a: Drink, b: Drink) => a.timestamp - b.timestamp;

function newId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    // Fallback, falls randomUUID nicht verfügbar ist.
    return `d_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }
}

export const useDrinksStore = create<DrinksState>()(
  persist(
    (set) => ({
      drinks: [],
      addDrink: (input) =>
        set((s) => ({ drinks: [...s.drinks, { ...input, id: newId() }].sort(byTime) })),
      updateDrink: (id, patch) =>
        set((s) => ({
          drinks: s.drinks.map((d) => (d.id === id ? { ...d, ...patch } : d)).sort(byTime),
        })),
      removeDrink: (id) => set((s) => ({ drinks: s.drinks.filter((d) => d.id !== id) })),
      resetSession: () => set({ drinks: [] }),
    }),
    {
      name: STORAGE_KEYS.drinks,
      version: SCHEMA_VERSION,
      storage: zustandStorage,
      migrate: (persisted, _version) => persisted as DrinksState,
    },
  ),
);
