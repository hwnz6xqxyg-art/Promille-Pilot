# Handoff: Promille-Pilot — iOS BAC Tracker (Apple-Style Redesign)

## Overview
Promille-Pilot is a German-language blood-alcohol-content (BAC) estimation app. The user sets up a profile once (weight, height, biological sex, legal limit, novice-driver flag), logs drinks via presets or a custom composer, and sees a live BAC estimate, driving-limit forecasts ("when am I under 0.5 / 0.3 / 0.0 ‰?"), and a BAC-over-time curve. The design deliverable contains **three variations of the main screen** that share one engine and one state; the final app should implement **one** of them (or a hybrid the stakeholder specifies):

- **1a "Ring"** — Activity-ring hero + one-tap preset tile grid + draggable timeline
- **1b "Forecast"** — "Under your limit at HH:MM" hero + FAB + spring bottom sheet with "X min ago" stepper
- **1c "Curve"** — Scrubbable BAC chart (finger on curve) + slider-based drink composer

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing intended look and behavior, NOT production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (SwiftUI is the natural fit for an iOS app; React Native / Flutter also work) using its established patterns. If no environment exists yet, SwiftUI is recommended — the design deliberately uses native iOS idioms (SF-style system font, iOS system colors, sheets, segmented controls, switches).

**Exception:** `engine.js` is real, tested domain logic (Widmark + Seidl BAC model). Port it 1:1 to the target language — do not redesign the math.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, copy, and motion parameters are final and should be matched precisely (using native equivalents, e.g. SF Pro instead of `-apple-system`).

## Files
- `Promille iOS.dc.html` — the design source. The template section (inside `<x-dc>`) contains all three screens with exact inline styles; the `<script data-dc-script>` class contains all interaction/state logic worth reading (spring physics, scrubbing, slider math, forecast formatting).
- `engine.js` — the BAC engine (port this). API summary below.
- `ios-frame.jsx` — device-frame chrome for the prototype only; ignore for implementation.
- `Promille Pilot.html` — self-contained runnable bundle. Open in any browser to interact with all three variations. Use this as the behavioral reference.

## Engine API (`engine.js`, global `PPEngine`)
Port these functions and their semantics exactly:
- `currentBac(drinks, profile, atMs) -> ‰` — BAC at a timestamp.
- `simulate(drinks, profile) -> { points: [{t, bac}], peakBac }` — full curve from first drink until sober.
- `forecastThresholds(drinks, profile, [0.5, 0.3, 0], nowMs) -> [{limit, time|null, alreadyBelow}]`
- `applicableLimit(profile) -> ‰` — 0 if `isNovice`, else `targetLimitPromille`.
- Drink: `{ timestamp(ms), volumeMl, abvPercent }`. Profile: `{ weightKg, heightCm, sex('male'|'female'), distributionMode:'seidl', eliminationRate(‰/h, default 0.1), targetLimitPromille, isNovice }`.
- Model: Widmark with Seidl body-water distribution, linear elimination, conservative defaults. Keep elimination rate configurable (0.08–0.2 ‰/h).

## Design Tokens
Colors (iOS system palette):
- Accent / interactive: `#007AFF` (iOS blue); pressed link `#0063CC`
- Status: safe/sober `#34C759` (green), drinking-under-limit `#FF9500` (orange), over limit `#FF3B30` (red)
- Status pill backgrounds: same hue at 12–14% alpha (`rgba(255,59,48,0.12)`, `rgba(255,149,0,0.14)`, `rgba(52,199,89,0.14)`)
- Screen background: `#F2F2F7` (iOS systemGroupedBackground); cards: `#FFF`
- Primary text: `#000`; secondary: `rgba(60,60,67,0.6)`; tertiary: `rgba(60,60,67,0.45)`; quaternary/disabled: `rgba(60,60,67,0.35)`
- Fills: `rgba(120,120,128,0.16)` (control bg), `rgba(120,120,128,0.12)` (chips/buttons), hairline separators `0.5px solid rgba(60,60,67,0.12)`
- Warning banner: bg `rgba(255,149,0,0.1)`, text `#8a5200`

Typography (system font, SF Pro on iOS):
- Screen title: 28–30px / 800 / letter-spacing −0.6px
- Hero BAC number: 44–56px / 800 / −1.4 to −2px, **tabular numerals** (all numbers in the app use tabular-nums)
- Card section labels: 11px / 700 / letter-spacing 1–1.2px / UPPERCASE / secondary color
- Row title: 15px / 600; row detail: 12–13px / 400 / secondary
- Primary button: 17px / 700

Spacing & shape:
- Card horizontal margin 16px; card padding 14–20px
- Radii: cards 20–24px, sheet top 28px, buttons 13–14px, segmented controls 10px (thumb 8px), pills/chips 999px
- Card shadow: `0 1px 2px rgba(0,0,0,0.05)`; sheet shadow `0 -8px 40px rgba(0,0,0,0.18)`
- Minimum hit target 44px (icon buttons are 36px visual inside larger tap areas — enlarge tap areas natively)

## Screens / Views

### 0. Onboarding / Profile (shared by all variations)
Full-screen cover (slides up/down, spring). Shown on first launch; afterwards reachable via profile button (top-right circle, 36px, person glyph) and dismissible (X button appears only after onboarding).
- Title "Dein Profil" (30/800) + subtitle "Für eine realistische Schätzung."
- Card 1: **Gewicht** slider 40–160 kg step 1 (default 80) and **Größe** slider 140–210 cm step 1 (default 180). Custom slider: 6px track (`rgba(120,120,128,0.2)`), filled portion blue, 28px white thumb with shadow `0 1px 5px rgba(0,0,0,0.3)`. Value shown right-aligned in blue 15/700.
- Card 2: **Geschlecht (biologisch)** — 2-segment control (Männlich/Weiblich), white thumb slides with spring `cubic-bezier(.3,1.4,.5,1)` 400ms. **Dein Grenzwert** — 3-segment (0,0 ‰ / 0,3 ‰ / 0,5 ‰; default 0,5). **Fahranfänger / unter 21** toggle (iOS switch, 51×31, green when on) — when on, forces limit to 0.0 ‰ and dims the limit control to 40% opacity.
- Orange disclaimer banner: "Diese App schätzt nur. Sie ist kein Medizinprodukt und niemals eine Grundlage für die Entscheidung, ob du fährst."
- CTA button (blue, 50px, radius 14): "Los geht's" first run, "Fertig" afterwards.

### 1a — Ring
- Header: "Promille" title + profile button; below: caption "Nur Schätzung — keine Fahrentscheidung." (12px secondary).
- **Hero ring**: 212×212. Track circle r=88, stroke 17, `rgba(120,120,128,0.14)`; progress arc in status color, round caps, fill fraction = BAC / 1.2 (clamped). Centered: BAC value 48/800 in status color (e.g. "0,52") over label "PROMILLE" (13/700, letter-spacing 2px, secondary). Below ring: status pill (colored text on tinted bg): "Nüchtern" / "Unter deinem Limit" / "Über deinem Limit"; then "Dein Limit: 0,50 ‰" caption.
- **Preset tiles**: 2-column grid, gap 10. White cards radius 18, padding 12×14: emoji 22px + name (14/600) + detail (12 secondary). Eight presets (see Data below). Tap = add drink at current time.
- **Time pill** (see Shared components).
- **Fahrgrenzen card**: rows "unter 0,50 ‰ / 0,30 ‰ / 0,00 ‰" with right-aligned time (15 tabular) + "in 2 h 10 min" (12 secondary); already-passed rows show "✓ jetzt" in green.
- **Getränke list** (see Shared components), footer disclaimer (11px tertiary, centered): "Widmark + Seidl · Abbau 0,1 ‰/h (konservativ) · Kein Medizinprodukt…"

### 1b — Forecast
- Header: "Heute Abend" title; right side: live BAC pill ("0,52 ‰", status colors) + profile button.
- **Hero card** (radius 24): label "UNTER DEINEM LIMIT AB", huge time "23:41" 56/800/−2px (green "Jetzt" when already under; gray "—" when empty), subtitle "in 3 h 12 min · Limit 0,50 ‰". Below, the three Fahrgrenzen rows inside the same card.
- Time pill, Getränke list, disclaimer as shared.
- **FAB**: 58px blue circle, bottom-right (20px right, 44px above home indicator), white plus, shadow `0 8px 24px rgba(0,122,255,0.4)`. Press: scale .88 + rotate 90°.
- **Add-drink bottom sheet**: dark 35% backdrop (fades 400ms); sheet bg `#F7F7FA`, top radius 28, grab handle 38×5. Header "Getränk hinzufügen" + a "time ago" stepper (− / "jetzt" or "vor 45 min" / +, steps of 15 min, max 600). Preset list rows (emoji, name · detail, blue plus glyph) with hairline separators; tap adds drink backdated by the stepper value and dismisses.

### 1c — Curve
- Header "Verlauf" + profile button; inline hero: BAC 44/800 in status color + "‰" + status pill right-aligned.
- **Chart card** (radius 22): SVG plot of `simulate()` curve. Blue 2.6px line, blue→transparent vertical gradient area fill, red dashed limit line with label "Limit 0,50 ‰", dashed vertical "now" cursor with 7px white dot ringed in status color (3.5px). X-axis start/end times (11px). Empty state: "Noch keine Kurve" + hint.
- Under chart: current scrub label ("Jetzt · 21:30" or "+1 h 15 min · 22:45") + "Zurück" reset link (fades in when scrubbed).
- **Composer card**: label "GETRÄNK ZUSAMMENSTELLEN" + live summary ("500 ml · 5 %", blue). Sliders: Menge 20–1000 ml step 10; Alkohol 0.5–45 Vol.-% step 0.5. Horizontal scroll row of preset chips (pill, `rgba(120,120,128,0.12)`, 13/600) that set the sliders. CTA "Jetzt getrunken" (blue, 46px).
- Getränke list + disclaimer as shared.

### Shared components
- **Getränke card**: header "GETRÄNKE" + red "Alle löschen" (only when non-empty). Rows newest-first: emoji 20px, label 15/600, detail "500 ml · 5 %" (12 secondary), timestamp HH:MM (13 secondary, tabular), 26px circular remove button (X glyph on `rgba(120,120,128,0.12)`). Empty state copy per screen. New rows animate in: translateY(14px)+scale(.97) → overshoot −2px/1.005 → settle, 450ms `cubic-bezier(.3,1.3,.5,1)`.
- **Time pill / scrubber**: white card. Row: label "ZEIT", center value "Jetzt · 21:30" / "+2 h · 23:30" (14/700 tabular), "Zurück" link (opacity 0→1 when shifted). Below: 18px-tall tick strip (repeating 1.5px vertical lines every 11px, `rgba(60,60,67,0.3)`) that translates with drag; fixed orange (#FF9500) 2.5px center needle. Hint: "Ziehen, um in die Zukunft zu blicken."

## Interactions & Behavior ("physics" — the core of this design)
1. **Animated number roll-up**: the displayed BAC is NOT set directly. It chases the engine value with a critically-damped-ish spring: per frame `a = 130·(target − displayed) − 21·velocity`, integrated at ≤50ms steps, snap when |Δ|<0.0004 and |v|<0.002. Adding/removing a drink makes the number roll up/down over ~0.5s. In SwiftUI: `spring(response: ~0.55, dampingFraction: ~0.9)` on a numeric interpolation, or replicate the integrator.
2. **Haptic-style limit pulse**: whenever the displayed BAC crosses the applicable limit (either direction, only while drinks exist), the hero number pops: scale 1 → 1.09 (35%) → 0.985 (70%) → 1, 450ms `cubic-bezier(.3,1.5,.5,1)`. On device, pair with `UIImpactFeedbackGenerator(.medium)`.
3. **Time scrubbing with rubber-banding**: dragging the tick strip maps 0.85 min per horizontal px (drag left = future). Valid range 0…+720 min; beyond range, excess is multiplied by 0.3 (rubber band). On release outside range, spring back (spring: `a = 95·Δ − 19·v`). "Zurück" springs shift to 0. **All derived values (BAC, status, forecasts, chart cursor) update live during scrub.**
4. **Chart scrubbing (1c)**: touch anywhere on the chart and drag; finger x maps through the chart's time scale to the time shift, clamped to the simulated curve's span with the same 0.3 rubber-band + spring-back. Cursor dot and BAC follow the finger.
5. **Bottom sheet (1b)**: slides from translateY(110%) to 0 with overshooting spring `cubic-bezier(.32,1.22,.42,1)` 550ms; backdrop fades in parallel; tap backdrop to dismiss. Profile cover uses the same treatment vertically (`cubic-bezier(.32,1.25,.45,1)`).
6. **Press states**: preset tiles scale to .92 on press (fast .08s down, springy .45s release); buttons scale .96; icon buttons .85–.88; FAB .88 + 90° rotation. Segmented thumbs and the switch knob move with overshoot springs (see tokens above).
7. **Live ticking**: engine time is real; re-evaluate BAC every frame (or ≥1 Hz) so values decay in real time.
8. **Reduce Motion**: honor the system setting — numbers snap instead of springing, pulses off.

## State Management
- `profile { weightKg, heightCm, sex, limit, novice }` — persist (UserDefaults / local storage). `onboarded: Bool` persisted; gates the onboarding cover.
- `drinks: [Drink]` — persist; append on add (timestamp = now − agoMin), remove by id, clear all.
- `timeShiftMin: Double` (transient, 0…720 with rubber-band overflow) and its spring animator.
- `displayedBac: Double` (spring-follower of engine value) + last over/under-limit flag for pulse triggering.
- Sheet/cover presentation state.
- Derived per frame: `applicableLimit`, status (sober / under / over), forecasts, curve points.

## Data — the 8 presets
🍺 Bier 0,5 l · 5 % — 🍺 Bier 0,3 l · 5 % — 🌾 Weizen 0,5 l · 5,4 % — 🍋 Radler 0,5 l · 2,5 % — 🍷 Wein 0,2 l · 12 % — 🥂 Sekt 0,1 l · 11 % — 🍹 Longdrink 0,3 l · 10 % — 🥃 Shot 2 cl · 40 %

## Copy & Formatting rules
- Language: German. Decimal comma everywhere (`Intl` de-DE / German locale formatters). BAC always 2 decimals ("0,52"). Times 24h "HH:MM". Durations "45 min", "2 h", "2 h 10 min".
- Persistent safety framing (legal/ethical requirement, keep verbatim): header caption "Nur Schätzung — keine Fahrentscheidung."; footer "…Kein Medizinprodukt, keine Entscheidungsgrundlage. Sicher ist nur 0,0 ‰."; onboarding banner (see above). These must never be hidden.

## Assets
No image assets. Icons are simple inline vectors (person, plus, X) — use SF Symbols (`person.fill`, `plus`, `xmark`) natively. Drink glyphs are emoji.

## Non-goals / open decisions for the dev thread
- Which variation ships (or hybrid) — confirm with stakeholder before building.
- Persistence beyond local (none designed). No accounts, no HealthKit.
- Dark mode not designed yet.
