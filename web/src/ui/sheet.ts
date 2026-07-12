/**
 * Add-drink bottom sheet + FAB — spring presentation via CSS transition
 * (cubic-bezier(.32,1.22,.42,1) 550ms), backdrop fade, time stepper
 * ("vor X min" · "jetzt" · "in X min").
 */
import { PRESETS } from '../data/presets';
import type { Store } from '../state/store';
import { el, qs, setText } from '../lib/dom';

/** Stepper range: up to 10 h into the past, 3 h into the future, in 15 min steps. */
const PAST_MAX_MIN = 600;
const FUTURE_MAX_MIN = 180;

export class Sheet {
  private sheet = qs<HTMLElement>('#sheet');
  private backdrop = qs<HTMLElement>('#backdrop');
  private fab = qs<HTMLButtonElement>('#fab');
  private agoLabel = qs<HTMLElement>('#agoLabel');
  private agoMinus = qs<HTMLButtonElement>('#agoMinus');
  private agoPlus = qs<HTMLButtonElement>('#agoPlus');
  private firstRow: HTMLButtonElement | null = null;
  /** Active swipe-to-dismiss drag, or null. `ty` = current translateY, `vy` = px/ms downward. */
  private drag: { y: number; h: number; ty: number; vy: number; lastY: number; lastT: number } | null = null;

  constructor(private store: Store) {
    const list = qs<HTMLElement>('#presetList');
    for (const p of PRESETS) {
      const row = el('button', 'preset-row');
      row.appendChild(el('div', 'preset-emoji', p.e));
      const text = el('div', 'preset-text');
      const name = el('span', 'preset-name', p.name);
      const detail = el('span', 'preset-detail', ` · ${p.detail}`);
      text.append(name, detail);
      row.appendChild(text);
      row.insertAdjacentHTML(
        'beforeend',
        '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="rgba(0,122,255,0.12)"/><path d="M10 6v8M6 10h8" stroke="#007AFF" stroke-width="1.8" stroke-linecap="round"/></svg>',
      );
      row.addEventListener('click', () => {
        // "vor / in X min" is relative to the real clock, never the scrubbed view time.
        this.store.addDrink(p, this.store.agoMin, Date.now());
        this.close();
      });
      list.appendChild(row);
      if (!this.firstRow) this.firstRow = row;
    }

    // FAB interaction (tap vs. long-press) is owned by QuickAdd, which calls open().
    this.backdrop.addEventListener('click', () => this.close());
    // − steps back in time (higher agoMin → "vor X min"),
    // + steps forward in time (lower agoMin → "jetzt" → "in X min").
    this.agoMinus.addEventListener('click', () => this.setAgo(this.store.agoMin + 15));
    this.agoPlus.addEventListener('click', () => this.setAgo(this.store.agoMin - 15));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.store.sheetOpen) this.close();
    });
    this.wireSwipeToDismiss();
  }

  /**
   * Pull the sheet (grab-handle or head) downward to dismiss; a short drag springs
   * back. During the drag the CSS transform-transition is suspended so the sheet
   * tracks the finger 1:1, then handed back to CSS for the release animation.
   */
  private wireSwipeToDismiss(): void {
    this.sheet.addEventListener('pointerdown', (e) => {
      // Preset rows and the +/− steppers stay pure taps — never start a drag on them.
      if ((e.target as HTMLElement).closest('button')) return;
      this.sheet.setPointerCapture(e.pointerId);
      this.drag = { y: e.clientY, h: this.sheet.offsetHeight, ty: 0, vy: 0, lastY: e.clientY, lastT: e.timeStamp };
      this.sheet.style.transition = 'none';
    });
    this.sheet.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const ty = Math.max(0, e.clientY - d.y); // down is positive; can't drag above the open position
      d.vy = (e.clientY - d.lastY) / Math.max(1, e.timeStamp - d.lastT);
      d.lastY = e.clientY;
      d.lastT = e.timeStamp;
      d.ty = ty;
      this.sheet.style.transform = `translateY(${ty}px)`;
      this.backdrop.style.opacity = String(Math.max(0, 1 - ty / d.h)); // dim lightens as the sheet pulls away
    });
    const release = (): void => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      // Hand animation back to the CSS transition, arming it with a reflow before the transform clears.
      this.sheet.style.transition = '';
      void this.sheet.offsetHeight;
      this.sheet.style.transform = '';
      this.backdrop.style.opacity = '';
      // Past ~30 % of the sheet height, or a firm downward flick, commits the dismiss.
      if (d.ty > d.h * 0.3 || d.vy > 0.6) this.close();
    };
    this.sheet.addEventListener('pointerup', release);
    this.sheet.addEventListener('pointercancel', release);
  }

  private setAgo(v: number): void {
    const m = Math.max(-FUTURE_MAX_MIN, Math.min(PAST_MAX_MIN, v));
    this.store.agoMin = m;
    setText(this.agoLabel, m === 0 ? 'jetzt' : m > 0 ? `vor ${m} min` : `in ${-m} min`);
    this.agoMinus.disabled = m === PAST_MAX_MIN;
    this.agoPlus.disabled = m === -FUTURE_MAX_MIN;
  }

  open(): void {
    this.store.sheetOpen = true;
    this.setAgo(0);
    this.sheet.classList.add('is-open');
    this.backdrop.classList.add('is-open');
    this.firstRow?.focus({ preventScroll: true });
  }

  close(): void {
    this.store.sheetOpen = false;
    this.sheet.classList.remove('is-open');
    this.backdrop.classList.remove('is-open');
    this.fab.focus({ preventScroll: true });
  }
}
