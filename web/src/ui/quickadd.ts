/**
 * Radial quick-add — long-press (~450 ms) the + FAB and circular bubbles fan
 * out on an arc around it (painting-app colour-picker style): repeat the last
 * added drink, one-tap Bier / Wein, or "Mehr …" for the full sheet. While the
 * finger stays down you can SLIDE onto a bubble (it grows) and release to
 * select. Releasing over nothing leaves the fan open for normal taps; a plain
 * tap on the FAB still opens the sheet. Quick-adds are logged "jetzt" (real
 * clock), same rule as the sheet. This module owns ALL FAB pointer interaction.
 */
import type { Store } from '../state/store';
import type { DrinkPreset } from '../data/presets';
import { PRESETS } from '../data/presets';
import { qs, setText } from '../lib/dom';

const HOLD_MS = 450;
const RADIUS = 112; // arc radius around the FAB centre, px (adjacent bubbles ~58 px apart at 30°)
const HIT_SLOP = 34; // pointer-to-bubble-centre distance that counts as "on it", px
const QUICK_BEER = PRESETS[0]; // 🍺 Bier 0,5 l · 5 %
const QUICK_WINE = PRESETS[4]; // 🍷 Wein 0,2 l · 12 %

interface Bubble {
  el: HTMLButtonElement;
  action: () => void;
  cx: number; // viewport centre while open
  cy: number;
}

export class QuickAdd {
  private fab = qs<HTMLButtonElement>('#fab');
  private palette = qs<HTMLElement>('#quickPalette');
  private lastBtn = qs<HTMLButtonElement>('#quickLast');
  private holdTimer: number | null = null;
  private held = false;
  private open = false;
  private sliding = false;
  private bubbles: Bubble[] = [];
  private hot: Bubble | null = null;

  constructor(
    private store: Store,
    private openSheet: () => void,
  ) {
    this.palette.hidden = false; // base state is invisible + inert via CSS

    const addPreset = (p: DrinkPreset) => (): void => {
      this.store.addDrink(p, 0, Date.now());
    };
    const actions = new Map<HTMLButtonElement, () => void>([
      [
        this.lastBtn,
        (): void => {
          const last = this.store.drinks[this.store.drinks.length - 1];
          if (!last) return;
          addPreset({ e: last.e, name: last.label, detail: last.detail, vol: last.volumeMl, abv: last.abvPercent })();
        },
      ],
      [qs<HTMLButtonElement>('#quickBeer'), addPreset(QUICK_BEER)],
      [qs<HTMLButtonElement>('#quickWine'), addPreset(QUICK_WINE)],
      [qs<HTMLButtonElement>('#quickMore'), (): void => this.openSheet()],
    ]);
    for (const [el, action] of actions) {
      el.addEventListener('click', () => this.select({ el, action, cx: 0, cy: 0 })); // tap mode
    }
    this.allButtons = [...actions.entries()];

    this.fab.addEventListener('pointerdown', (e) => {
      if (this.open) {
        this.close();
        this.held = true; // swallow the release of this press
        return;
      }
      this.held = false;
      const pid = e.pointerId;
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null;
        this.held = true;
        this.openPalette();
        this.sliding = true;
        try {
          this.fab.setPointerCapture(pid); // mouse; touch captures implicitly
        } catch {
          // pointer already gone — palette stays in tap mode
        }
      }, HOLD_MS);
    });
    this.fab.addEventListener('pointermove', (e) => {
      if (!this.sliding || !this.open) return;
      this.setHot(this.hitTest(e.clientX, e.clientY));
    });
    this.fab.addEventListener('pointerup', () => {
      const wasPending = this.holdTimer !== null;
      this.cancelHold();
      if (this.sliding) {
        this.sliding = false;
        if (this.hot) this.select(this.hot);
        // no hot bubble → fan stays open for tap mode
        return;
      }
      if (wasPending && !this.held) this.openSheet(); // plain tap
    });
    this.fab.addEventListener('pointerleave', () => {
      if (!this.sliding) this.cancelHold(); // captured slides never "leave"
    });
    this.fab.addEventListener('pointercancel', () => {
      this.cancelHold();
      if (this.sliding) {
        this.sliding = false;
        this.close();
      }
    });
    this.fab.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      const t = e.target as Node;
      if (!this.palette.contains(t) && !this.fab.contains(t)) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    });
  }

  private allButtons: Array<[HTMLButtonElement, () => void]> = [];

  private cancelHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  private openPalette(): void {
    const last = this.store.drinks[this.store.drinks.length - 1];
    this.lastBtn.hidden = !last;
    if (last) {
      setText(qs<HTMLElement>('#quickLast .quick-emoji'), last.e);
      setText(qs<HTMLElement>('#quickLast .quick-label'), last.label);
      this.lastBtn.setAttribute('aria-label', `Zuletzt hinzufügen: ${last.label} ${last.detail}`);
    }

    // Fan the visible bubbles on an arc from straight-up (90°) to straight-left (180°).
    const visible = this.allButtons.filter(([el]) => !el.hidden);
    const anchor = this.palette.getBoundingClientRect(); // the 0x0 anchor at the FAB centre
    this.bubbles = visible.map(([el, action], i) => {
      const a = ((90 + (90 * i) / Math.max(1, visible.length - 1)) * Math.PI) / 180;
      const x = Math.cos(a) * RADIUS;
      const y = -Math.sin(a) * RADIUS; // screen y grows downward
      el.style.left = `${x.toFixed(1)}px`;
      el.style.top = `${y.toFixed(1)}px`;
      return { el, action, cx: anchor.left + x, cy: anchor.top + y };
    });

    this.open = true;
    this.palette.classList.add('is-open');
    this.fab.classList.remove('is-pressed');
  }

  private hitTest(px: number, py: number): Bubble | null {
    let best: Bubble | null = null;
    let bestD = HIT_SLOP;
    for (const b of this.bubbles) {
      const d = Math.hypot(px - b.cx, py - b.cy);
      if (d <= bestD) {
        bestD = d;
        best = b;
      }
    }
    return best;
  }

  private setHot(b: Bubble | null): void {
    if (this.hot === b) return;
    this.hot?.el.classList.remove('is-hot');
    this.hot = b;
    b?.el.classList.add('is-hot');
  }

  private select(b: Bubble): void {
    this.close();
    b.action();
  }

  private close(): void {
    this.open = false;
    this.setHot(null);
    this.palette.classList.remove('is-open');
  }
}
