# Promille-Pilot 🍺 (Expo app)

**Promille-Pilot** is an offline-capable blood-alcohol (BAC) estimator for festival use: log your
drinks, see a live BAC estimate, and get a conservative forecast of when you drop below the German
driving thresholds (0.5 / 0.3 / 0.0 ‰). This folder contains the **Expo/React Native app**
(deliverable 2, iOS first). The **mobile web app** (deliverable 1) lives in
[`../web/`](../web/), and the designer's authoritative handoff in
[`../design/`](../design/). This sub-project never touches the unrelated
Bundesliga tool in the repo root.

> ⚠️ **Estimate only — not a medical device.** The app does not measure real blood alcohol and must
> never be the basis for a decision to drive. When in doubt: don't drive.
> (German product copy: *"Nur Schätzung. Kein Medizinprodukt. Niemals zur Entscheidung verwenden,
> ob du fährst."*)

## What's built here

- **BAC engine** (`src/engine/bac.ts`) — Widmark + Seidl formula, conservative elimination
  (0.1 ‰/h), resorption deficit, one forward simulation powering the live value, the
  multi-threshold forecast (0.5/0.3/0.0 ‰) and the curve. **Pure, tested logic (43 tests).**
  The web app imports this engine directly — single source of truth.
- Onboarding gate (disclaimer → age gate → Seidl profile; novice flag forces 0.0 ‰), dashboard
  with live BAC + threshold forecasts + one-tap "+ Bier", drink log with presets, SVG timeline
  chart, settings with methodology/privacy, DE/EN i18n, local persistence (zustand + AsyncStorage).

Implemented: phases 0–2 + Change A of the spec. **Open:** iOS restyle to the design (Change B §B.6),
phase 3 polish, phase 4 (AdMob), phase 5 (EAS build & store launch, iOS first).

## Run locally (best on a Mac for iOS)

```bash
cd app
npm install
npx expo install --fix   # aligns native module versions with the Expo SDK
npm run ios              # iOS simulator (requires Xcode)   |  npm run android  |  npm start
```

## Tests

```bash
npm run test:engine   # fast framework-free engine check via tsx (43 cases)
npm test              # same cases under jest-expo
npm run typecheck     # TypeScript strict
```

The full development spec (formulas, architecture, compliance, phase plan, Change B design
adoption) is in [`DEVELOPMENT_SPEC.md`](./DEVELOPMENT_SPEC.md).
