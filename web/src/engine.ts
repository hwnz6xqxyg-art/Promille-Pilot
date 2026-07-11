/**
 * Barrel re-export of the shared BAC engine (single source of truth).
 * The engine lives in the Expo app folder and is pure TS with zero deps —
 * esbuild bundles it straight into the web app.
 */
export * from '../../app/src/engine/bac';
export * from '../../app/src/engine/constants';
