/**
 * Profil- und Onboarding-State (persistiert).
 * Enthält KEINE Promillewerte – die werden immer aus drinks+profile berechnet.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { zustandStorage } from '@/storage/persist';
import { STORAGE_KEYS, SCHEMA_VERSION } from '@/storage/keys';
import { BETA_CONSERVATIVE, LIMIT_GENERAL } from '@/engine/constants';
import type { Profile } from '@/engine/bac';

export const defaultProfile: Profile = {
  weightKg: 80,
  sex: 'male',
  heightCm: 180,
  ageYears: undefined,
  distributionMode: 'seidl',
  eliminationRate: BETA_CONSERVATIVE,
  targetLimitPromille: LIMIT_GENERAL,
  isNovice: false,
};

interface ProfileState {
  profile: Profile;
  disclaimerAcceptedAt: number | null;
  ageConfirmed: boolean;
  profileComplete: boolean;
  hasHydrated: boolean;

  setProfile: (patch: Partial<Profile>) => void;
  acceptDisclaimer: (at: number) => void;
  confirmAge: () => void;
  completeProfile: () => void;
  resetAll: () => void;
  setHasHydrated: (v: boolean) => void;
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profile: defaultProfile,
      disclaimerAcceptedAt: null,
      ageConfirmed: false,
      profileComplete: false,
      hasHydrated: false,

      setProfile: (patch) =>
        set((s) => {
          const profile = { ...s.profile, ...patch };
          // Fahranfänger erzwingt 0,0 ‰ als Zielwert.
          if (profile.isNovice) profile.targetLimitPromille = 0;
          return { profile };
        }),
      acceptDisclaimer: (at) => set({ disclaimerAcceptedAt: at }),
      confirmAge: () => set({ ageConfirmed: true }),
      completeProfile: () => set({ profileComplete: true }),
      resetAll: () =>
        set({
          profile: defaultProfile,
          disclaimerAcceptedAt: null,
          ageConfirmed: false,
          profileComplete: false,
        }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: STORAGE_KEYS.profile,
      version: SCHEMA_VERSION,
      storage: zustandStorage,
      partialize: (s) => ({
        profile: s.profile,
        disclaimerAcceptedAt: s.disclaimerAcceptedAt,
        ageConfirmed: s.ageConfirmed,
        profileComplete: s.profileComplete,
      }),
      migrate: (persisted, _version) => {
        // Bei künftigen Schema-Änderungen hier je nach _version transformieren.
        return persisted as ProfileState;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
