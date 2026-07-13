/**
 * Time pill / scrubber — drag maps 0.85 min per px (drag left = future).
 * Future: 0…+720 min, holds on release (planning tool). Past: an ELASTIC PEEK
 * that always springs home to "Jetzt" on release. The past side auto-scales so
 * ONE comfortable stroke (~200 px) reaches the evening's first drink no matter
 * how long ago it was — without it, a 7-h-old evening would need ~480 px and
 * the peek could never get there. Rubber beyond the first drink keeps a
 * constant screen feel. Tick strip moves 11 px per 15 min.
 */
import type { Store } from '../state/store';
import { qs, setText } from '../lib/dom';
import { fmtClock, fmtDur } from '../lib/format';

const MAX = 720;
/** Base-minutes covered by one comfortable stroke (200 px × 0.85 min/px). */
const STROKE_MIN = 170;

export interface ScrubHooks {
  onChange(): void;
  springShiftTo(target: number): void;
  cancelShiftAnim(): void;
}

export class Scrubber {
  private card = qs<HTMLElement>('#scrubCard');
  private label = qs<HTMLElement>('#pillLabel');
  private strip = qs<HTMLElement>('#tickStrip');
  private zurueck = qs<HTMLButtonElement>('#btnZurueck');
  private drag: { x: number; s: number } | null = null;

  get dragging(): boolean {
    return this.drag !== null;
  }

  constructor(
    private store: Store,
    private hooks: ScrubHooks,
  ) {
    this.card.addEventListener('pointerdown', (e) => {
      if (e.target === this.zurueck) return;
      this.card.setPointerCapture(e.pointerId);
      this.drag = { x: e.clientX, s: this.store.shiftMin };
      this.hooks.cancelShiftAnim();
    });
    this.card.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      let raw = this.drag.s - (e.clientX - this.drag.x) * 0.85;
      if (raw < 0) {
        const lo = this.lowerBound();
        // Scale the below-zero segment so one stroke spans back to the first
        // drink; dividing the rubber by the same boost keeps the overshoot
        // stretch constant in SCREEN terms (same feel as the future side).
        const boost = Math.max(1, lo / -STROKE_MIN);
        raw *= boost;
        if (raw < lo) raw = lo + ((raw - lo) * 0.3) / boost;
      } else if (raw > MAX) {
        raw = MAX + (raw - MAX) * 0.3;
      }
      this.store.shiftMin = raw;
      this.hooks.onChange();
    });
    const release = () => {
      if (!this.drag) return;
      this.drag = null;
      const s = this.store.shiftMin;
      // Past peeks are elastic: any negative position springs home to "Jetzt".
      const clamped = s < 0 ? 0 : Math.min(MAX, s);
      if (Math.abs(clamped - s) > 0.01) this.hooks.springShiftTo(clamped);
    };
    this.card.addEventListener('pointerup', release);
    this.card.addEventListener('pointercancel', release);

    this.zurueck.addEventListener('click', () => this.hooks.springShiftTo(0));
  }

  /**
   * Dynamic lower bound: scrub back to the evening's first drink (in minutes,
   * negative), matching the chart drag; without drinks the strip stays at now.
   */
  private lowerBound(): number {
    const drinks = this.store.drinks;
    if (drinks.length === 0) return 0;
    const first = Math.min(...drinks.map((d) => d.timestamp));
    return Math.min(0, (first - Date.now()) / 60000);
  }

  /** Per-recompute update of label, tick position and "Zurück" visibility. */
  update(effectiveNow: number): void {
    const sh = this.store.shiftMin;
    let label: string;
    if (Math.abs(sh) < 0.5) label = `Jetzt · ${fmtClock(effectiveNow)}`;
    else if (sh > 0) label = `+${fmtDur(sh * 60000)} · ${fmtClock(effectiveNow)}`;
    else label = `−${fmtDur(-sh * 60000)} · ${fmtClock(effectiveNow)}`;
    setText(this.label, label);
    this.strip.style.backgroundPosition = `${(-(sh * (11 / 15))).toFixed(1)}px 0px`;
    this.zurueck.classList.toggle('is-visible', Math.abs(sh) > 0.5);
  }
}
