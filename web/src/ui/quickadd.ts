/**
 * Radial quick-add — long-press (~450 ms) the + FAB and circular bubbles fan
 * out on an arc around it (painting-app colour-picker style). The bubbles are
 * the user's MOST-RECENTLY-ADDED drinks: the last one sits at the top of the
 * fan, the one before it below, up to three, then a "Mehr …" bubble opens the
 * full sheet. While the finger stays down you can SLIDE onto a bubble (it grows)
 * and release to select. Releasing over nothing leaves the fan open for normal
 * taps; a plain tap on the FAB still opens the sheet. Quick-adds are logged
 * "jetzt" (real clock), same rule as the sheet. This module owns ALL FAB
 * pointer interaction.
 */
import type { Store } from '../state/store';
import type { DrinkPreset } from '../data/presets';
import { PRESETS } from '../data/presets';
import { el, qs } from '../lib/dom';

const HOLD_MS = 450;
const RADIUS = 112; // arc radius around the FAB centre, px (adjacent bubbles ~58 px apart at 30°)
const HIT_SLOP = 34; // pointer-to-bubble-centre distance that counts as "on it", px
const MAX_RECENT = 3; // recent-drink bubbles shown before the "Mehr" bubble
/** Fallback bubbles before any drink has been logged: 🍺 0,5 l and 🍷 0,2 l. */
const FALLBACK: DrinkPreset[] = [PRESETS[0], PRESETS[4]];

interface Bubble {
  el: HTMLButtonElement;
  action: () => void;
  cx: number; // viewport centre while open
  cy: number;
}

export class QuickAdd {
  private fab = qs<HTMLButtonElement>('#fab');
  private palette = qs<HTMLElement>('#quickPalette');
  private moreBtn = qs<HTMLButtonElement>('#quickMore');
  private recentEls: HTMLButtonElement[] = []; // generated per open, removed on next open
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

    // "Mehr …" is static; tapping it (once the fan is open) opens the full sheet.
    this.moreBtn.addEventListener('click', () =>
      this.select({ el: this.moreBtn, action: () => this.openSheet(), cx: 0, cy: 0 }),
    );

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

  private cancelHold(): void {
    if (this.holdTimer !== null) {
      clearTimeout(this.holdTimer);
      this.holdTimer = null;
    }
  }

  /** The up-to-3 drinks the fan shows, newest first; a fixed pair before any add. */
  private recentPresets(): DrinkPreset[] {
    const recent = this.store.recentDrinks.slice(0, MAX_RECENT);
    return recent.length ? recent : FALLBACK;
  }

  /** Build one recent-drink bubble (emoji + short label) with its tap-mode handler. */
  private makeBubble(p: DrinkPreset): HTMLButtonElement {
    const btn = el('button', 'quick-bubble');
    btn.type = 'button';
    btn.setAttribute('role', 'menuitem');
    btn.setAttribute('aria-label', `${p.name} ${p.detail} hinzufügen`.trim());
    btn.append(el('span', 'quick-emoji', p.e), el('span', 'quick-label', p.name));
    btn.addEventListener('click', () =>
      this.select({ el: btn, action: () => this.store.addDrink(p, 0, Date.now()), cx: 0, cy: 0 }),
    );
    return btn;
  }

  private openPalette(): void {
    // Rebuild the recent-drink bubbles: most recent first, inserted before "Mehr"
    // so the newest sits at the TOP of the arc (90°) and older ones fan downward.
    for (const b of this.recentEls) b.remove();
    this.recentEls = [];
    const built: Array<[HTMLButtonElement, () => void]> = [];
    for (const p of this.recentPresets()) {
      const btn = this.makeBubble(p);
      this.palette.insertBefore(btn, this.moreBtn);
      this.recentEls.push(btn);
      built.push([btn, () => this.store.addDrink(p, 0, Date.now())]);
    }
    built.push([this.moreBtn, () => this.openSheet()]);

    // Fan them on an arc from straight-up (90°) to straight-left (180°).
    const anchor = this.palette.getBoundingClientRect(); // the 0x0 anchor at the FAB centre
    this.bubbles = built.map(([node, action], i) => {
      const a = ((90 + (90 * i) / Math.max(1, built.length - 1)) * Math.PI) / 180;
      const x = Math.cos(a) * RADIUS;
      const y = -Math.sin(a) * RADIUS; // screen y grows downward
      node.style.left = `${x.toFixed(1)}px`;
      node.style.top = `${y.toFixed(1)}px`;
      return { el: node, action, cx: anchor.left + x, cy: anchor.top + y };
    });

    void this.palette.offsetWidth; // flush the from-state so freshly-added bubbles animate in
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
