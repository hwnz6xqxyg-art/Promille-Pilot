/**
 * Quick-add palette — long-press (~450 ms) on the + FAB opens a small menu just
 * above it: repeat the last added drink, one-tap Bier / Wein, or "Mehr …" for
 * the full sheet. A plain tap on the FAB still opens the sheet, so the palette
 * is purely an accelerator. Quick-adds are logged "jetzt" (real clock), same
 * rule as the sheet. This module owns ALL FAB pointer interaction — nothing
 * listens for FAB clicks, so a long-press can't ghost-trigger the sheet.
 */
import type { Store } from '../state/store';
import type { DrinkPreset } from '../data/presets';
import { PRESETS } from '../data/presets';
import { qs, setText } from '../lib/dom';

const HOLD_MS = 450;
const QUICK_BEER = PRESETS[0]; // 🍺 Bier 0,5 l · 5 %
const QUICK_WINE = PRESETS[4]; // 🍷 Wein 0,2 l · 12 %

export class QuickAdd {
  private fab = qs<HTMLButtonElement>('#fab');
  private palette = qs<HTMLElement>('#quickPalette');
  private lastBtn = qs<HTMLButtonElement>('#quickLast');
  private beerBtn = qs<HTMLButtonElement>('#quickBeer');
  private wineBtn = qs<HTMLButtonElement>('#quickWine');
  private moreBtn = qs<HTMLButtonElement>('#quickMore');
  private holdTimer: number | null = null;
  private held = false;
  private open = false;

  constructor(
    private store: Store,
    private openSheet: () => void,
  ) {
    this.palette.hidden = false; // base state is already invisible + inert via CSS

    this.fab.addEventListener('pointerdown', () => {
      if (this.open) {
        this.close();
        this.held = true; // swallow the release of this press
        return;
      }
      this.held = false;
      this.holdTimer = window.setTimeout(() => {
        this.holdTimer = null;
        this.held = true;
        this.openPalette();
      }, HOLD_MS);
    });
    const cancelHold = (): void => {
      if (this.holdTimer !== null) {
        clearTimeout(this.holdTimer);
        this.holdTimer = null;
      }
    };
    this.fab.addEventListener('pointerup', () => {
      const wasPending = this.holdTimer !== null;
      cancelHold();
      if (wasPending && !this.held) this.openSheet(); // plain tap
    });
    this.fab.addEventListener('pointerleave', cancelHold);
    this.fab.addEventListener('pointercancel', cancelHold);
    this.fab.addEventListener('contextmenu', (e) => e.preventDefault());

    const add = (p: DrinkPreset): void => {
      this.store.addDrink(p, 0, Date.now());
      this.close();
    };
    this.beerBtn.addEventListener('click', () => add(QUICK_BEER));
    this.wineBtn.addEventListener('click', () => add(QUICK_WINE));
    this.lastBtn.addEventListener('click', () => {
      const last = this.store.drinks[this.store.drinks.length - 1];
      if (!last) return;
      add({ e: last.e, name: last.label, detail: last.detail, vol: last.volumeMl, abv: last.abvPercent });
    });
    this.moreBtn.addEventListener('click', () => {
      this.close();
      this.openSheet();
    });

    document.addEventListener('pointerdown', (e) => {
      if (!this.open) return;
      const t = e.target as Node;
      if (!this.palette.contains(t) && !this.fab.contains(t)) this.close();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    });
  }

  private openPalette(): void {
    const last = this.store.drinks[this.store.drinks.length - 1];
    this.lastBtn.hidden = !last;
    if (last) setText(this.lastBtn, `Zuletzt: ${last.e} ${last.label} · ${last.detail}`);
    this.open = true;
    this.palette.classList.add('is-open');
    this.fab.classList.remove('is-pressed'); // release the press-scale under the open menu
  }

  private close(): void {
    this.open = false;
    this.palette.classList.remove('is-open');
  }
}
