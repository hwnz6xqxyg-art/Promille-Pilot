# Promille-Pilot — Development Spec

> **Language note:** This spec is maintained in English (stakeholder decision, Change B). German
> appears only as verbatim product copy (UI strings, safety texts) — those are quoted, not
> translated, because they are the shipped wording per the design handoff.
>
> **Status:** Engine + Expo app phases 0–2 implemented and tested. Change A (multi-threshold
> forecast + quick add) and Change B deliverable 1 (web PWA) implemented. Next: iOS restyle (§B.6).

## Context & Goal

**Promille-Pilot** is an offline-capable blood-alcohol (BAC / "Promille") estimator for festival
use. The user asks: *"If I drink 3 beers now — what is my BAC, and from when (or with what value)
could I drive again?"* The product has commercial intent.

This is the project's dedicated repo (`hwnz6xqxyg-art/Promille-Pilot`): `web/` (PWA, deliverable 1),
`app/` (Expo app, deliverable 2), `design/` (authoritative designer handoff). The project was
migrated here from `hwnz6xqxyg-art/Excitement-Engine` (branch `claude/festival-bac-calculator-aciobp`,
up to commit `f39c4c7`), where its earlier history remains.

### Decisions

| Topic | Decision |
|---|---|
| Deliverables & order | **1) Standalone mobile web app (PWA, GitHub Pages)** → **2) iOS app (restyled Expo app)**; Android stays compatible, launches after iOS |
| Design | **Designer handoff, variation 1b "Forecast"** — see `../design/` (its README.md is authoritative for tokens, copy, motion physics) |
| Native stack | **Expo (React Native, managed) + TypeScript**, Expo Router |
| Web stack | **Vanilla TypeScript + esbuild**, no framework (design physics is imperative frame-based code; designer's prototype is vanilla) |
| Core feature | Drink log over time, live BAC, forecast "below limit at HH:MM" for 0.5/0.3/0.0 ‰ simultaneously, BAC curve |
| Profile | Stored locally (AsyncStorage / localStorage), no server |
| Accuracy | **Individualized: Seidl formula** (weight + height + sex; age optional) |
| Languages | App: German (default) + English (i18n-ready). Web app v1: German only (design copy) |
| Monetization | **Free with ads (Google AdMob)** — native app only, with compliance constraints (§9/§10); not in the web app v1 |
| Working title | **Promille-Pilot** |

---

## 1. Product & Scope

The user sets up a profile once, logs drinks (with timestamps), and the app shows:
- the **currently estimated BAC** (live, self-updating),
- a **forecast** of when the value drops below each driving threshold
  (0.5 ‰ / 0.3 ‰ / 0.0 ‰ — each with clock time + remaining duration),
- a **BAC-over-time curve** with limit line and "now" marker.

**Not in MVP:** push reminders, accounts/cloud sync, multiple profiles, wearables.

**Platform order:** Web app first (Change B), then iOS as the primary native target; Android is kept
compatible throughout (one Expo codebase, no iOS-only native modules; platform differences isolated
via `Platform.select` / `.ios.tsx` / `.android.tsx`) and finalized after the iOS launch. The pure
**BAC engine, state and i18n are platform-neutral**.

**Non-negotiable stance:** The app is an **estimation tool, not a measuring device**, and must
**never serve as the basis for a decision to drive**. Math is always conservative (slow
elimination); copy never says "you are safe / you may drive".

---

## 2. Tech Stack & Libraries (native app)

| Purpose | Library | Why |
|---|---|---|
| Framework | `expo` (managed, current SDK) | One codebase iOS+Android, EAS build to both stores, no eject |
| Navigation | `expo-router` | File-based routing, official |
| State | `zustand` (+ `persist`) | Minimal, hook-based, built-in persistence |
| Persistence | `@react-native-async-storage/async-storage` | Offline, no native config in managed workflow |
| Chart | inline SVG via `react-native-svg` | Line chart with horizontal limit line, no chart framework needed |
| Date/time | `@react-native-community/datetimepicker` | Editable drink timestamps |
| i18n | `i18next` + `react-i18next` + `expo-localization` | German default, de-DE formatting, EN included |
| IDs | `expo-crypto` / `crypto.randomUUID()` | Stable drink IDs |
| Tests | `jest-expo` + plain `tsx` runner | Pure unit tests of the engine |
| Ads | `react-native-google-mobile-ads` (incl. UMP consent) | AdMob banner + GDPR consent (mandatory in the EU) |

TypeScript `strict: true`, path alias `@/… → src/…`.

The web app's stack is defined in **Change B** below.

---

## 3. Project Structure

```
Promille-Pilot/
  .github/workflows/pages.yml   # GitHub Pages deploy of web/dist (push to main)
  design/               # design handoff (authoritative reference — see Change B)
  web/                  # deliverable 1: mobile web app (PWA)   — see Change B
  app/                  # deliverable 2: Expo app (iOS first, Android after)
    app.json  package.json  tsconfig.json  babel.config.js  eas.json  .gitignore  README.md
    assets/                      # icon, splash, adaptive-icon
    app/                         # expo-router routes
      _layout.tsx                # root stack, providers, onboarding gating
      index.tsx                  # redirect: onboarding vs (tabs) based on flags
      onboarding/ disclaimer.tsx age-gate.tsx profile.tsx
      (tabs)/ _layout.tsx index.tsx log.tsx chart.tsx settings.tsx
      add-drink.tsx  methodology.tsx  privacy.tsx
    src/
      engine/ bac.ts constants.ts bac.test.ts    # PURE engine (no RN/DOM imports)
      storage/ keys.ts persist.ts
      state/ profileStore.ts drinksStore.ts useNow.ts
      components/ BacGauge.tsx ForecastCard.tsx DisclaimerBanner.tsx DrinkListItem.tsx
                  DrinkForm.tsx BacChart.tsx PresetPicker.tsx PrimaryButton.tsx Field.tsx
      presets/ drinkPresets.ts
      i18n/ index.ts de.ts en.ts
      theme/ colors.ts spacing.ts typography.ts
      utils/ time.ts format.ts number.ts
    scripts/ run-engine-tests.ts # plain-node runner in the style of root engine-core.test.js
```

Style & test philosophy: pure functions, DOM-free engine, `approx()` float comparison,
`ok()/pass/fail` runner (inherited from the tooling conventions of the original host repo).

---

## 4. BAC Engine — `src/engine/bac.ts` (the core)

Pure, deterministic, RN-/DOM-free TypeScript module. **BAC is never stored — always derived from
`drinks + profile`.** Implemented and covered by 43 tests.

### Formulas (implemented exactly like this)
- **Grams of alcohol per drink:** `A = volumeMl × (abvPercent/100) × 0.8`
  (0.8 g/ml ethanol density, German forensic convention). Example: 500 ml @ 5 % = 20 g.
- **Widmark:** `BAC(‰) = A / (r × body_mass_kg)`, elimination `C(t) = A/(r·m) − β·t`.
- **Distribution factor r — two modes:**
  - `simple`: male r = 0.7, female r = 0.6.
  - `seidl` (default, individualized; uses weight kg + height cm):
    - Male:   `r = 0.31608 − 0.004821·w + 0.004432·h`
    - Female: `r = 0.31223 − 0.006446·w + 0.004466·h`
  - (Watson TBW variant documented as a comment; Seidl is primary.)
- **Elimination rate β:** **0.1 ‰/h (conservative/slow)** for all safety-relevant outputs
  (the "below limit at" forecast), so the app **never reports sober too early**. 0.15 ‰/h exists
  only as an optional "average momentary estimate" — never for the driving forecast.
- **Resorption deficit:** ingested alcohol × 0.9 (10 % deficit) as a documented constant.
- **Absorption:** time-to-peak ~30–60 min. **Default is a linear ~45-min ramp per drink**
  (`absorption: 'linear'`); the original MVP step-change model stays available via
  `absorption: 'instant'`. The default changed without touching any caller.

### Types & Constants
```ts
export type Sex = 'male' | 'female';
export type DistributionMode = 'simple' | 'seidl';
export type AbsorptionModel = 'instant' | 'linear';

export interface Profile {
  weightKg: number; sex: Sex;
  heightCm?: number;            // required when distributionMode === 'seidl'
  ageYears?: number;            // reserved (Watson / future)
  distributionMode: DistributionMode;
  eliminationRate: number;      // β ‰/h — default 0.1
  targetLimitPromille: number;  // 0.0 / 0.3 / 0.5
  isNovice: boolean;            // probation period / <21 -> forces 0.0
}
export interface Drink { id: string; timestamp: number; volumeMl: number; abvPercent: number; label?: string; }
export interface BacPoint { t: number; bac: number; }
export interface SimulationResult { points: BacPoint[]; peakBac: number; peakTime: number; soberTime: number | null; }
export interface EngineOptions { absorption?: AbsorptionModel; absorptionMinutes?: number; stepMinutes?: number; horizonHours?: number; }
export interface ThresholdForecast { limit: number; time: number | null; alreadyBelow: boolean; }

export const ETHANOL_DENSITY = 0.8;
export const RESORPTION_FACTOR = 0.9;
export const BETA_CONSERVATIVE = 0.1;   // safety-relevant default
export const BETA_AVERAGE = 0.15;       // optional momentary estimate only
export const LIMIT_ABSOLUTE = 1.1;      // absolute unfitness to drive (criminal offence)
export const LIMIT_GENERAL  = 0.5;      // general limit (administrative offence)
export const LIMIT_RELATIVE = 0.3;      // relative unfitness to drive
export const LIMIT_NOVICE   = 0.0;      // probation period / <21
export const FORECAST_THRESHOLDS = [LIMIT_GENERAL, LIMIT_RELATIVE, LIMIT_NOVICE]; // [0.5, 0.3, 0]
```

### Function API
```ts
gramsOfAlcohol(volumeMl, abvPercent): number
simpleR(sex): number
seidlR(sex, weightKg, heightCm): number
distributionFactor(profile): number         // dispatch simple|seidl
applicableLimit(profile): number            // isNovice ? 0.0 : targetLimitPromille
simulate(drinks, profile, opts?): SimulationResult   // ONE forward simulation
bacAtTime(drinks, profile, t, opts?): number
currentBac(drinks, profile, now, opts?): number
timeUntilBelow(drinks, profile, limit, from, opts?): number | null  // epoch ms; null if already below
forecastThresholds(drinks, profile, limits, now, opts?): ThresholdForecast[]
bacCurve(drinks, profile, from, to, stepMinutes, opts?): BacPoint[] // for the chart
```

### Algorithm (the central design decision)
Elimination β is **zero-order and whole-body**, not per drink, and must not push BAC below 0.
Absorption is per drink. Therefore **one single forward simulation** from which every output is
derived (NOT "per-drink peak minus β·Δt summed" — that is wrong across sober gaps):

```
peak_i = gramsOfAlcohol(v_i, abv_i) * RESORPTION_FACTOR / (r * weightKg)
bac = 0
for each minute step from min(timestamp) to horizon (dt = stepMinutes/60 h):
    bac += Σ_i absorbedDelta_i(step)   // instant: whole peak_i at the drink's step; linear: ramp over absorptionMinutes
    bac  = max(0, bac - β * dt)        // clamp at 0 -> sober gaps handled correctly
    points.push({ t, bac })
```

Cost is trivial (~960 iterations for 16 h @ 1 min). `simulate()` runs once; `currentBac` /
`timeUntilBelow` / `bacCurve` read the series (scan/interpolate) — no re-simulation per query.

---

## 5. German Legal Limits (current through 2026, coded as constants)

- **0.5 ‰** general limit (administrative offence, from €500 fine).
- **0.3 ‰** relative unfitness to drive (criminal offence when combined with driving errors/accident).
- **1.1 ‰** absolute unfitness to drive (criminal offence, §316 StGB).
- **0.0 ‰** for novice drivers (probation period) **and everyone under 21** — the app **enforces**
  0.0 when the user sets the novice flag.
- The default target steers toward 0.0–0.3, never "up to 0.5". The user picks their limit
  (0.0 / 0.3 / 0.5); novice overrides to 0.0.

---

## 6. Screens & Navigation (Expo app, pre-Change-B layout)

> Note: Change B replaces the visual design with the designer's variation 1b. The gating logic and
> route inventory below remain valid; the tab layout will be consolidated during the iOS restyle.

Root stack (expo-router); a tab group after the gate. `_layout.tsx` reads profile flags and
redirects: `disclaimerAcceptedAt == null → onboarding/disclaimer → ageConfirmed == false →
age-gate → profileComplete == false → onboarding/profile → else (tabs)`.

| Route | Purpose |
|---|---|
| `onboarding/disclaimer` | Mandatory safety notice, not skippable; acceptance persists a timestamp |
| `onboarding/age-gate` | ≥18 confirmation, no consumption-encouraging language |
| `onboarding/profile` | Weight, sex, height (for Seidl), age, novice toggle (→ 0.0), limit |
| `(tabs)/index` dashboard | Live BAC + threshold forecast list (0.5/0.3/0.0) + disclaimer banner + quick "+ Bier" + `useNow` tick |
| `(tabs)/log` | Drink list, newest first, delete, "new session" |
| `(tabs)/chart` | SVG curve from `simulate()`, limit line, "now" marker |
| `(tabs)/settings` | Edit profile, methodology/privacy links, delete all data |
| `add-drink` (modal) | Preset picker + volume/ABV/time; timestamp defaults to now, editable |
| `methodology` | Widmark + Seidl, 0.8 g/ml, β=0.1, resorption 0.9 — disclosure for Apple 1.4.1 |
| `privacy` | All on-device, no collection, no network (except AdMob later — see §9) |

---

## 7. State & Persistence (Expo app)

- `profileStore` (zustand+persist): `{ profile, disclaimerAcceptedAt, ageConfirmed, profileComplete, schemaVersion }`.
- `drinksStore` (zustand+persist): `{ drinks: Drink[] }` + `addDrink/updateDrink/removeDrink/resetSession`, sorted by time.
- `useNow`: `setInterval` (30–60 s) → current epoch ms so the dashboard recomputes without user action.
- Persistence: **AsyncStorage** (structured JSON, no native config). `schemaVersion` + migration hook from day one.

---

## 8. i18n

`i18next` + `react-i18next` + `expo-localization`, default `de`. All UI strings in `de.ts` (primary)
and `en.ts`. Numbers/per-mille via de-DE formatting ("0,53 ‰"). German legal terms stay German with
an explanation; the EN version translates the meaning and keeps the German limits (the legal
situation is German — noted in the EN copy). The web app v1 ships German only (design copy).

---

## 9. Monetization — Google AdMob (free with ads; native app only)

- **Banner** via `react-native-google-mobile-ads`, rendered through `components/AdBanner.tsx`,
  controlled by `monetization/useAdsEnabled.ts` (`showAds` flag). MVP: banners at the bottom of
  `log` and `chart`.
- **AdMob keys** via `app.config.ts` `extra{}` / env — never hardcoded.
- **GDPR (EU/Germany):** initialize Google **UMP consent** before the first ad load; without
  consent only non-personalized ads.
- **Compliance constraints due to the alcohol context:**
  - Set ad content filters / `maxAdContentRating` restrictively; exclude sensitive categories
    (alcohol, gambling) as far as AdMob allows.
  - **No ads on safety-critical surfaces** — the forecast ("below limit at") and the disclaimer
    stay ad-free so the safety message is never diluted.
  - Age rating accordingly high (17+/USK 18); privacy policy names AdMob data processing.
- **Extension point:** everything routes through `useAdsEnabled`; a later "remove ads" IAP
  (RevenueCat / `react-native-purchases`) just sets `showAds=false` — no UI rework.

---

## 10. Store Compliance & Disclaimer (critical: commercial + ads)

Checklist that must be satisfied in code/store listing:

1. **Prominent disclaimer** (onboarding gate + permanent banner + store description, 1st paragraph).
   German product copy (verbatim): *"Nur Schätzung. Kein Medizinprodukt, misst nicht den echten
   Blutalkohol. Niemals zur Entscheidung verwenden, ob du fährst. Im Zweifel: nicht fahren."*
2. **Methodology disclosure** (`methodology` screen): Widmark + Seidl, 0.8 g/ml, β=0.1,
   resorption 0.9 — satisfies Apple guideline 1.4.1 (accuracy/validation) since no "measurement"
   is claimed.
3. **"Not a medical device / no basis for medical or legal decisions"** in the app copy and (per
   Google Play Health policy, as of Jan 2026) in the **first paragraph of the store description**.
4. **Age gate ≥18** + honest IARC/Apple age rating with alcohol flag (expect 17+/USK 18).
5. **No consumption encouragement/gamification** — no "drink more", no leaderboards, no rewarding consumption.
6. **Conservative math** (β=0.1, resorption deficit) — the forecast errs toward caution.
7. **Privacy label / Data safety** honest: on-device; name AdMob as the only external processing.
8. Recommendation: have the disclaimer wording legally reviewed before launch (liability of the
   "below limit at" forecast).

---

## 11. Tests

Mirror the style of the root `engine-core.test.js` (pure fixtures, `approx()`).

- `npx tsx app/scripts/run-engine-tests.ts` — framework-free runner, 43 cases, and
  `src/engine/bac.test.ts` under jest-expo (`npm test`).
- Fixtures include: `gramsOfAlcohol(500,5)≈20`; `seidlR` against hand-computed values; 0.5 l/5 %
  beer for an 80 kg male (simple r=0.7) peak ≈ (20·0.9)/(0.7·80) ≈ 0.32 ‰; `currentBac` decays
  ~0.1 ‰/h, clamps at 0; `timeUntilBelow` null when already below, correct & monotonic;
  multi-drink summation + **sober gap** (BAC=0, later drink inherits no negative history); novice
  override (`applicableLimit`=0.0 despite targetLimit); `forecastThresholds` (3 beers → ascending
  times for 0.5 → 0.3 → 0.0; "already below" → time null).

---

## 12. Build & Deploy — native app (EAS, managed, no eject) — iOS first

1. Expo scaffold with expo-router (done).
2. `npx eas-cli build:configure` → `eas.json` (profiles `development`/`preview`/`production`) (done).
3. `app.json`: **both** IDs set from the start — `ios.bundleIdentifier` (`com.promillepilot.app`)
   and `android.package` — plus version/build, icons/splash, category Health & Fitness/Lifestyle,
   age rating 17+/USK 18, **no** location/camera/microphone permissions; AdMob app IDs per
   platform via config plugin (Phase 4).
4. **Dev (iOS-first):** primarily iOS simulator + `eas build --profile development --platform ios`
   on a real iPhone (Expo Dev Client). Boot the Android emulator regularly as a compatibility check.
5. **Internal:** iOS via TestFlight (`--profile preview --platform ios`) first; Android preview APK
   in parallel as a smoke test.
6. **Prod (staggered):** iOS first — bump version → `eas build --profile production --platform ios`
   → `eas submit -p ios`. Android launch (`--platform android` → `eas submit -p android`) follows
   after Android adaptation/QA.
7. Review prep: Apple review notes point to the `methodology` screen (first); then Google Data
   Safety (on-device + AdMob) and IARC alcohol rating; confirm target API level.

---

## 13. Phase Plan (native app)

- **Phase 0 — Scaffold** ✅: Expo + expo-router, strict tsconfig + `@/` alias, app.json IDs,
  zustand+AsyncStorage, i18n `de` default.
- **Phase 1 — MVP** ✅: `bac.ts` (`instant`, β=0.1, simple+Seidl) + full tests; profile/drinks
  stores; onboarding gate; dashboard; `add-drink` modal with presets; `log` list.
- **Phase 2 — Chart** ✅: `simulate()` → SVG chart with limit line + now marker.
- **Change A** ✅: multi-threshold forecast (0.5/0.3/0.0) + one-tap "+ Bier" quick add.
- **Phase 3 — Compliance & polish** (open): ~~absorption default to `linear` (45-min ramp)~~ ✅,
  accessibility, icons/splash, copy review ("never 'safe to drive'"), empty/error states, migration.
- **Phase 4 — Monetization** (open): AdMob + UMP consent, banners on `log`/`chart` (not on safety
  surfaces), `useAdsEnabled` flag, restrictive ad categories.
- **Phase 5 — Build & submit (iOS first)** (open): EAS dev → TestFlight → App Store prod; then
  **Phase 5b — Android adaptation & launch**: Android QA (hardware back, SafeArea/StatusBar,
  datetimepicker dialog, elevation, AdMob), Data Safety/IARC, Play prod.
- **iOS restyle to design 1b** — see Change B §6; slots in before Phase 3 polish.

**Test priority across all phases:** develop and verify primarily on iOS (simulator/device);
boot/smoke-test Android in each phase in the emulator to avoid iOS-only drift.

---

## Change A — Multi-threshold forecast + one-tap "+ Bier" (implemented ✅)

The user drinks e.g. 3 beers over ~1.5 h and wants to know **simultaneously** when they drop below
**0.5 ‰** AND **0.3 ‰** (and "fully sober" 0.0 ‰) — not just below a single pre-chosen limit.

- Engine: `forecastThresholds(drinks, profile, limits, now)` (pure helper over
  `currentBac` + `timeUntilBelow`) + `FORECAST_THRESHOLDS = [0.5, 0.3, 0]`.
- Dashboard shows the three thresholds as a list (each with clock time + remaining duration;
  "✓ already below" when reached); one-tap "+ Bier (0,5 l)" quick add; the detail form (with
  backdating) remains as the secondary path.
- Covered by 6 additional engine tests (43 total).

---

## Change B (v2) — Design adoption "1b Forecast" & deliverable order Web → iOS (active)

### B.1 Decisions
- The designer delivered a high-fidelity handoff with three Apple-style variations of the main
  screen. Stakeholder picked **variation 1b "Forecast"**: hero card "UNTER DEINEM LIMIT AB" with a
  huge clock time, the three driving-threshold rows in the same card, a time scrubber, the drinks
  list, and a FAB opening a spring bottom sheet with a "vor X min" backdating stepper.
- **Deliverable 1 (first): standalone mobile web app** — installable, offline-capable PWA,
  deployed to **GitHub Pages** via GitHub Actions.
- **Deliverable 2 (second): restyle the existing Expo app** to the same design (outline in §B.6).
- Web tech: **vanilla TypeScript + esbuild, no framework** — the design's motion physics is
  imperative frame-based code and the designer's prototype is vanilla JS; a framework adds nothing.
- The **engine is reused 1:1** via direct TS import from `app/src/engine/` (the handoff's
  `engine.js` is literally our esbuild bundle — API confirmed identical). No copy, no port.
- Web app v1 language: German; safety strings verbatim from the handoff, never hidden.
- Persistence: localStorage keys `pp.web.v1.profile / drinks / onboarded` (validated on load,
  defaults on failure; drinks older than ~48 h pruned on load).

### B.2 Design source (authoritative)
`../design/` — committed verbatim from the designer's bundle:
- `README.md` — **the authoritative spec** for tokens, copy, spacing, and motion physics.
- `Promille Pilot.html` — runnable prototype = behavioral reference (open in a browser).
- `Promille iOS.dc.html` — design source (markup + interaction script worth reading).
- `engine.js` — designer's engine copy (= our bundle; kept for provenance).
- `ios-frame.jsx` — prototype device chrome; ignore for implementation.

Key tokens (from the handoff README): accent `#007AFF` (pressed `#0063CC`); status green `#34C759`
/ orange `#FF9500` / red `#FF3B30` with 12–14 % alpha pill backgrounds; screen bg `#F2F2F7`; cards
`#FFF`; text `#000` / `rgba(60,60,67,.6/.45/.35)`; fills `rgba(120,120,128,.16/.12)`; hairlines
`0.5px rgba(60,60,67,.12)`; system font, **tabular numerals for all numbers**; radii: cards 20–24,
sheet 28, buttons 13–14, segments 10/8, pills 999; min hit target 44 px.

Motion physics (must be implemented exactly; honor `prefers-reduced-motion` by snapping):
1. Displayed BAC chases the engine value with a spring: per frame `a = 130·(target−displayed) −
   21·v`, integrated at ≤50 ms substeps; snap when |Δ|<0.0004 and |v|<0.002.
2. Limit-cross pulse on the hero number: scale 1→1.09 (35 %)→0.985 (70 %)→1, 450 ms
   `cubic-bezier(.3,1.5,.5,1)`; both directions; only while drinks exist.
3. Time scrubbing: 0.85 min per px (drag left = future), range 0…+720 min, overflow ×0.3 rubber
   band, on release spring back with `a = 95·Δ − 19·v`; "Zurück" springs to 0; **all derived
   values update live during scrubbing**.
4. Bottom sheet: `translateY(110%)→0`, 550 ms `cubic-bezier(.32,1.22,.42,1)`; backdrop 35 % black,
   400 ms fade; profile cover slides with `cubic-bezier(.32,1.25,.45,1)`.
5. Press states: tiles .92, buttons .96, icon buttons .85–.88, FAB .88 + 90° rotation.
6. Live ticking ≥1 Hz.

### B.3 Web app architecture — `web/`
```
web/
  package.json (+lockfile; pinned esbuild, typescript)   tsconfig.json (strict, DOM lib)
  build.mjs        # esbuild JS API: src/main.ts + src/styles.css → dist/ with [hash] names,
                   # HTML placeholder injection, sw.js with __CACHE_NAME__=pp-web-<hash> and
                   # __PRECACHE__ file list; ALL asset paths relative (./) for the Pages subpath
  assets/ icon.svg, icon-192/512/512-maskable/apple-touch-icon.png, manifest.webmanifest
  src/
    index.html     # static app shell with id hooks (no vdom; fine-grained DOM updates)
    styles.css     # all tokens as CSS custom properties
    main.ts        # boot + service-worker registration
    app.ts         # composition root: recompute(), rAF-while-animating + 1 Hz tick loop
    engine.ts      # barrel re-export of ../../app/src/engine/{bac,constants}
    data/presets.ts            # the 8 presets (Bier 0,5/0,3, Weizen, Radler, Wein, Sekt, Longdrink, Shot)
    state/store.ts persistence.ts
    lib/springs.ts format.ts dom.ts motion.ts
    ui/header.ts hero.ts scrubber.ts drinks.ts sheet.ts fab.ts onboarding.ts
    sw.ts          # offline-first app shell: cache-first, navigate→index.html, old caches purged
```
- Update loop: `recompute()` derives `effectiveNow = Date.now() + shiftMin·60000`, calls
  `currentBac` / `forecastThresholds` / `applicableLimit`, pushes into the DOM via
  `setTextIfChanged`. rAF runs only while springs/pointer/pulse are active; a 1 Hz interval keeps
  live decay ticking and wakes rAF when the displayed value must move.
- Status colors: ≥limit red, >0 orange, ≈0 green ("Nüchtern"); hero shows gray "—" without drinks
  and green "Jetzt" when already below the limit.
- PWA/iOS: manifest (standalone, `lang: de`, theme `#F2F2F7`), apple-touch-icon +
  `apple-mobile-web-app-*` metas, `viewport-fit=cover` + `env(safe-area-inset-*)` for FAB/footer;
  service worker requires http(s) — local static server script for verification.

### B.4 GitHub Pages deployment
`.github/workflows/pages.yml`: checkout → setup-node 22 → `npm ci`, `npm run typecheck`,
`npm run build` in `web/` → `upload-pages-artifact` (web/dist) → `deploy-pages`; permissions
`pages: write`, `id-token: write`; concurrency group. Trigger: push to `main` (path-filtered to
`web/**`, `app/src/engine/**`, the workflow file) plus `workflow_dispatch`.
**User action required once:** Settings → Pages → Source = "GitHub Actions". The site is served at
`https://hwnz6xqxyg-art.github.io/Promille-Pilot/` (all asset paths are relative, so the subpath
just works).

### B.5 Demo retirement
`app/demo/` is deleted in the **final** commit of Change B (after the web app passes
verification — until then it serves as a regression reference). Spec/README references updated.

### B.6 iOS restyle (deliverable 2 — outline; separate follow-up)
Expo app: derive a light-theme token file from `design`, rebuild screens to the 1b layout
(hero card, time scrubber, bottom sheet with `react-native-reanimated` springs instead of CSS
beziers, FAB), identical physics constants, engine/stores/i18n unchanged, EAS phases (§12/§13)
unchanged.

### B.7 Verification (Change B)
- Engine tests stay green (43/43); `npm run typecheck` in `web`; build produces a complete
  `dist/` (index.html, hashed app.js/css, sw.js with correct precache list, manifest, icons; only
  relative `./` paths).
- Chromium smoke test (playwright-core, 390×844, hasTouch, dist served over local HTTP):
  onboarding → "Los geht's" → FAB → sheet → stepper "vor 45 min" → "Bier 0,5 l" → row appears
  backdated, hero shows time + thresholds, pill colored; scrubbing updates everything live incl.
  rubber band + spring-back + "Zurück"; reload → persistence; offline reload works (SW);
  reduced-motion → values snap. Screenshots compared against the prototype at the same viewport.

---

## Appendix — Sources for formulas & limits

- **Widmark / gram conversion (0.8 g/ml):** forensic standard convention;
  cf. NIH/PMC "Alcohol calculations and their uncertainty" (PMC4361698).
- **Seidl factors (2000):** Seidl et al., "The calculation of blood ethanol concentrations in males
  and females" (PubMed 11197633) — used by commercial calculators (Seidl + Widmark).
- **Elimination rate β 0.1–0.2 ‰/h**, conservative 0.1 ‰/h for driving-related statements.
- **German limits 0.0 / 0.3 / 0.5 / 1.1 ‰:** ADAC "Promillegrenze Auto", Bußgeldkatalog;
  unchanged through 2026 (only the THC limit of 3.5 ng/ml was added in 2024).
- **Store policies:** Apple App Store Review Guidelines 1.4.1 / 1.4.3 (accuracy, no "measuring",
  no consumption encouragement), Google Play Health Content & Services (disclaimer in the first
  paragraph of the store description), IARC age rating (alcohol reference).
