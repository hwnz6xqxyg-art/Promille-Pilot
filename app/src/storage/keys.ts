/** Zentrale Storage-Keys und Schema-Version (für Migrationen). */
export const STORAGE_KEYS = {
  profile: 'pp.profile.v1',
  drinks: 'pp.drinks.v1',
} as const;

/** Wird bei Breaking-Changes am persistierten Format erhöht (siehe migrate-Hooks in den Stores). */
export const SCHEMA_VERSION = 1;
