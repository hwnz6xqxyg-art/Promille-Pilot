/**
 * Time pill / scrubber — drag maps 0.85 min per px (drag left = future),
 * range first-drink…+720 min with ×0.3 rubber band beyond either end;
 * tick strip moves 11 px per 15 min.
 */
import type { Store } from '../state/store';
import { qs, setText } from '../lib/dom';
import { fmtClock, fmtDur } from '../lib/format';

const MAX = 720;

export interface ScrubHooks {
  onChange(): void;
  springShiftTo(target: number): void;
  cancelShiftAnim(): void;
}

function rubber(raw: number, lo: number): number {
  if (raw < lo) return lo + (raw - lo) * 0.3;
  if (raw > MAX) return MAX + (raw - MAX) * 0.3;
  return raw;
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
      const raw = this.drag.s - (e.clientX - this.drag.x) * 0.85;
      this.store.shiftMin = rubber(raw, this.lowerBound());
      this.hooks.onChange();
    });
    const release = () => {
      if (!this.drag) return;
      this.drag = null;
      const s = this.store.shiftMin;
      const clamped = Math.max(this.lowerBound(), Math.min(MAX, s));
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
