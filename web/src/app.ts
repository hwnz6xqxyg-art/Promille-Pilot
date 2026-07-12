/**
 * Composition root: wires store, engine and UI; runs the animation/update loop.
 *
 * Loop design: requestAnimationFrame runs only while something animates (BAC
 * display spring, shift spring-back, pointer scrubbing). A 1 Hz interval keeps
 * the live decay ticking — real-time BAC change per second is far below the
 * spring's snap threshold, so it snaps silently without waking the rAF loop.
 */
import { applicableLimit, currentBac, forecastThresholds, FORECAST_THRESHOLDS } from './engine';
import { Store } from './state/store';
import { bacSpring, shiftSpring, SpringValue } from './lib/springs';
import { bindPressStates, reducedMotion } from './lib/motion';
import { qs, setText } from './lib/dom';
import { fmtP } from './lib/format';
import { Hero } from './ui/hero';
import { Scrubber, type ScrubHooks } from './ui/scrubber';
import { Chart } from './ui/chart';
import { Drinks } from './ui/drinks';
import { Sheet } from './ui/sheet';
import { Onboarding } from './ui/onboarding';
import { FlipCard } from './ui/flip';
import { QuickAdd } from './ui/quickadd';

export class App {
  private store = new Store(Date.now());
  private bac = bacSpring(0);
  private shiftAnim: SpringValue | null = null;
  private lastOver: boolean | null = null;
  private rafId: number | null = null;
  private lastTs = 0;

  private hero = new Hero();
  private drinks = new Drinks(this.store);
  private scrubber: Scrubber;
  private chart: Chart;
  private bacPill = qs<HTMLElement>('#bacPill');

  constructor() {
    const scrubHooks: ScrubHooks = {
      onChange: () => {
        this.recompute();
        this.wake();
      },
      springShiftTo: (target) => {
        this.shiftAnim = shiftSpring(this.store.shiftMin);
        this.shiftAnim.target = target;
        this.wake();
      },
      cancelShiftAnim: () => {
        this.shiftAnim = null;
      },
    };
    this.scrubber = new Scrubber(this.store, scrubHooks);
    this.chart = new Chart(this.store, scrubHooks);
    const sheet = new Sheet(this.store);
    new QuickAdd(this.store, () => sheet.open());
    new Onboarding(this.store);
    new FlipCard();
    bindPressStates();

    this.store.onInvalidate(() => {
      this.drinks.render();
      this.recompute();
      this.wake();
    });

    setInterval(() => {
      this.recompute();
      if (!this.rafId) {
        // Real-time decay: silently snap tiny deltas, wake the spring for big ones.
        if (Math.abs(this.bac.target - this.bac.value) < 0.002 || reducedMotion()) {
          this.bac.snap();
          this.applyDisplayed();
        } else {
          this.wake();
        }
      }
    }, 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.recompute();
        this.wake();
      }
    });

    this.recompute();
    this.bac.snap(); // initial render without roll-up from 0 on reload
    this.applyDisplayed();
  }

  effectiveNow(): number {
    return Date.now() + this.store.shiftMin * 60000;
  }

  /** Derive everything from state and push into the DOM. */
  private recompute(): void {
    const p = this.store.profile;
    const drinks = this.store.drinks;
    const now = this.effectiveNow();
    const limit = applicableLimit(p);

    this.bac.target = currentBac(drinks, p, now);
    if (reducedMotion()) this.bac.snap();

    const forecasts = drinks.length > 0 ? forecastThresholds(drinks, p, FORECAST_THRESHOLDS, now) : null;
    this.hero.update(forecasts, limit, now);
    this.scrubber.update(now);
    this.chart.update(now);
  }

  /** Push the spring-displayed BAC into pill + detect limit crossings (pulse). */
  private applyDisplayed(): void {
    const displayed = Math.max(0, this.bac.value);
    const limit = applicableLimit(this.store.profile);
    const over = displayed > limit + 1e-6;
    const drinking = displayed > 0.004;

    setText(this.bacPill, `${fmtP(displayed)} ‰`);
    this.bacPill.classList.toggle('is-over', over);
    this.bacPill.classList.toggle('is-drinking', !over && drinking);

    if (this.store.drinks.length > 0) {
      if (this.lastOver === null) this.lastOver = over;
      else if (over !== this.lastOver) {
        this.lastOver = over;
        if (!reducedMotion()) this.hero.pulse();
      }
    } else {
      this.lastOver = null;
    }
  }

  private wake(): void {
    if (this.rafId != null) return;
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame((ts) => this.frame(ts));
  }

  private frame(ts: number): void {
    const dt = Math.min(50, ts - this.lastTs);
    this.lastTs = ts;

    const bacAnimating = this.bac.tick(dt);
    const dragging = this.scrubber.dragging || this.chart.dragging;

    let shiftAnimating = false;
    if (this.shiftAnim && !dragging) {
      shiftAnimating = this.shiftAnim.tick(dt);
      this.store.shiftMin = this.shiftAnim.value;
      if (!shiftAnimating) this.shiftAnim = null;
      this.recompute();
    }

    this.applyDisplayed();

    if (bacAnimating || shiftAnimating || dragging) {
      this.rafId = requestAnimationFrame((t) => this.frame(t));
    } else {
      this.rafId = null;
    }
  }
}
