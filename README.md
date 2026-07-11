# Promille-Pilot 🍺

**Promille-Pilot** estimates your blood alcohol concentration (BAC / "Promille") at a festival:
log your drinks, watch the live estimate, and see a conservative forecast of when you drop below
the German driving thresholds (0.5 / 0.3 / 0.0 ‰) — each with a clock time and remaining duration.

> ⚠️ **Estimate only — not a medical device.** The app does not measure real blood alcohol and must
> never be the basis for a decision to drive. When in doubt: don't drive.
> (Product copy, German: *"Nur Schätzung. Kein Medizinprodukt. Niemals zur Entscheidung verwenden,
> ob du fährst. Im Zweifel: nicht fahren."*)

**Live web app:** https://hwnz6xqxyg-art.github.io/Promille-Pilot/ — installable PWA
(open on your phone → "Add to Home Screen"), works offline.

## Repository layout

| Folder | What it is |
|---|---|
| [`web/`](./web/) | **Deliverable 1** — mobile web app (PWA). Vanilla TypeScript + esbuild, no framework. Deployed to GitHub Pages via [`.github/workflows/pages.yml`](./.github/workflows/pages.yml). |
| [`app/`](./app/) | **Deliverable 2** — Expo/React Native app (iOS first, Android after). Also home of the shared, tested **BAC engine** (`app/src/engine/`), which `web/` imports directly. |
| [`design/`](./design/) | The designer's authoritative handoff (tokens, copy, motion physics, runnable prototype). The shipped design is variation **1b "Forecast"**. |

The full development spec (formulas, architecture, store compliance, phase plan) lives in
[`app/DEVELOPMENT_SPEC.md`](./app/DEVELOPMENT_SPEC.md).

## Quickstart

Web app (build + serve locally):

```bash
cd web
npm install
npm run build
npm run serve        # http://localhost:8788/
npm run typecheck    # TypeScript strict
```

Engine tests (44 cases, framework-free):

```bash
npx tsx app/scripts/run-engine-tests.ts
```

Expo app (best on a Mac for iOS):

```bash
cd app
npm install
npx expo install --fix
npm run ios          # iOS simulator (requires Xcode)
```

## The BAC model (summary)

Widmark formula with the individualized Seidl (2000) body-water distribution factor
(weight + height + sex), a 10 % absorption deficit, and a deliberately **conservative elimination
rate of 0.1 ‰/h** — the app errs toward showing "sober" too late, never too early. One forward
simulation drives the live value, all threshold forecasts and the curve. Details and sources:
spec §4 and the methodology screen in the apps.

## Provenance

Migrated from [`hwnz6xqxyg-art/Excitement-Engine`](https://github.com/hwnz6xqxyg-art/Excitement-Engine)
(branch `claude/festival-bac-calculator-aciobp`, up to commit `f39c4c7`), where the earlier commit
history remains.
