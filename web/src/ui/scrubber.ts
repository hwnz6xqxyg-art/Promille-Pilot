/**
 * Time pill / scrubber — drag maps 0.85 min per px (drag left = future),
 * range 0…+720 min with ×0.3 rubber band; tick strip moves 11 px per 15 min.
 */
import type { Store } from '../state/store';
import { qs, setText } from '../lib/dom';
import { fmtClock, fmtDur } from '../lib/format';

const MIN = 0;
const MAX = 720;

export interface ScrubHooks {
  onChange(): void;
  springShiftTo(target: number): void;
  cancelShiftAnim(): void;
}

function rubber(raw: number): number {
  if (raw < MIN) return MIN + (raw - MIN) * 0.3;
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
      this.store.shiftMin = rubber(raw);
      this.hooks.onChange();
    });
    const release = () => {
      if (!this.drag) return;
      this.drag = null;
      const s = this.store.shiftMin;
      const clamped = Math.max(MIN, Math.min(MAX, s));
      if (Math.abs(clamped - s) > 0.01) this.hooks.springShiftTo(clamped);
    };
    this.card.addEventListener('pointerup', release);
    this.card.addEventListener('pointercancel', release);

    this.zurueck.addEventListener('click', () => this.hooks.springShiftTo(0));
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
