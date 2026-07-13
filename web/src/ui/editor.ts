/**
 * Edit-drink bottom sheet — tap a logged drink to adjust its time, amount and
 * strength via the same +/− steppers as the add-sheet, or swap its type from the
 * preset list. Every change is applied live (store.updateDrink → invalidate), so
 * the list and BAC behind the sheet update immediately; no Save/Cancel.
 */
import { PRESETS } from '../data/presets';
import type { Store } from '../state/store';
import { el, qs, setText } from '../lib/dom';
import { fmtClock, fmtN1 } from '../lib/format';
import { attachSwipeToDismiss } from './sheetSwipe';

/** Sane time bounds: reopened evenings can be days old; future capped like the add-sheet. */
const PAST_MAX_MS = 14 * 24 * 3600 * 1000;
const FUTURE_MAX_MS = 3 * 3600 * 1000;
const VOL_MIN = 10;
const VOL_MAX = 2000;
const ABV_MIN = 0.5;
const ABV_MAX = 60;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export class DrinkEditor {
  private sheet = qs<HTMLElement>('#editSheet');
  private backdrop = qs<HTMLElement>('#editBackdrop');
  private emoji = qs<HTMLElement>('#editEmoji');
  private name = qs<HTMLElement>('#editName');
  private timeLabel = qs<HTMLElement>('#editTimeLabel');
  private timeMinus = qs<HTMLButtonElement>('#editTimeMinus');
  private timePlus = qs<HTMLButtonElement>('#editTimePlus');
  private volLabel = qs<HTMLElement>('#editVolLabel');
  private volMinus = qs<HTMLButtonElement>('#editVolMinus');
  private volPlus = qs<HTMLButtonElement>('#editVolPlus');
  private abvLabel = qs<HTMLElement>('#editAbvLabel');
  private abvMinus = qs<HTMLButtonElement>('#editAbvMinus');
  private abvPlus = qs<HTMLButtonElement>('#editAbvPlus');
  private doneBtn = qs<HTMLButtonElement>('#editDone');
  private deleteBtn = qs<HTMLButtonElement>('#editDelete');
  private editingId: string | null = null;

  private swapList = qs<HTMLElement>('#editPresetList');

  constructor(private store: Store) {
    this.timeMinus.addEventListener('click', () => this.stepTime(-15));
    this.timePlus.addEventListener('click', () => this.stepTime(15));
    this.volMinus.addEventListener('click', () => this.stepVol(-50));
    this.volPlus.addEventListener('click', () => this.stepVol(50));
    this.abvMinus.addEventListener('click', () => this.stepAbv(-0.5));
    this.abvPlus.addEventListener('click', () => this.stepAbv(0.5));

    this.deleteBtn.addEventListener('click', () => {
      if (this.editingId) this.store.removeDrink(this.editingId);
      this.close();
    });
    this.doneBtn.addEventListener('click', () => this.close());
    this.backdrop.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.editingId) this.close();
    });
    attachSwipeToDismiss(this.sheet, this.backdrop, () => this.close());
  }

  /** Build the "swap type" list: built-ins then the user's custom drinks. */
  private renderSwapList(): void {
    const list = this.swapList;
    list.textContent = '';
    for (const p of [...PRESETS, ...this.store.customDrinks]) {
      const row = el('button', 'preset-row');
      row.appendChild(el('div', 'preset-emoji', p.e));
      const text = el('div', 'preset-text');
      text.append(el('span', 'preset-name', p.name), el('span', 'preset-detail', ` · ${p.detail}`));
      row.appendChild(text);
      row.addEventListener('click', () => this.patch({ e: p.e, label: p.name, volumeMl: p.vol, abvPercent: p.abv }));
      list.appendChild(row);
    }
  }

  open(id: string): void {
    this.editingId = id;
    if (!this.syncFields()) return; // drink vanished — nothing to edit
    this.renderSwapList();
    this.sheet.classList.add('is-open');
    this.backdrop.classList.add('is-open');
    this.doneBtn.focus({ preventScroll: true });
  }

  close(): void {
    this.editingId = null;
    this.sheet.classList.remove('is-open');
    this.backdrop.classList.remove('is-open');
  }

  private current(): StoredLike | undefined {
    return this.editingId ? this.store.drinks.find((d) => d.id === this.editingId) : undefined;
  }

  /** Recompute `detail` so the stored display string stays consistent with the numbers. */
  private detailFor(volumeMl: number, abvPercent: number): string {
    return `${fmtN1(volumeMl)} ml · ${fmtN1(abvPercent)} %`;
  }

  private patch(fields: { e?: string; label?: string; volumeMl?: number; abvPercent?: number; timestamp?: number }): void {
    const d = this.current();
    if (!d) return;
    const volumeMl = fields.volumeMl ?? d.volumeMl;
    const abvPercent = fields.abvPercent ?? d.abvPercent;
    this.store.updateDrink(d.id, { ...fields, detail: this.detailFor(volumeMl, abvPercent) });
    this.syncFields();
  }

  private stepTime(deltaMin: number): void {
    const d = this.current();
    if (!d) return;
    const now = Date.now();
    const next = clamp(d.timestamp + deltaMin * 60000, now - PAST_MAX_MS, now + FUTURE_MAX_MS);
    this.patch({ timestamp: next });
  }

  private stepVol(delta: number): void {
    const d = this.current();
    if (!d) return;
    this.patch({ volumeMl: clamp(Math.round((d.volumeMl + delta) / 10) * 10, VOL_MIN, VOL_MAX) });
  }

  private stepAbv(delta: number): void {
    const d = this.current();
    if (!d) return;
    this.patch({ abvPercent: clamp(Math.round((d.abvPercent + delta) * 10) / 10, ABV_MIN, ABV_MAX) });
  }

  /** Reflect the drink's current values into the sheet; returns false if it's gone. */
  private syncFields(): boolean {
    const d = this.current();
    if (!d) return false;
    setText(this.emoji, d.e);
    setText(this.name, d.label);
    setText(this.timeLabel, fmtClock(d.timestamp));
    setText(this.volLabel, `${fmtN1(d.volumeMl)} ml`);
    setText(this.abvLabel, `${fmtN1(d.abvPercent)} %`);
    const now = Date.now();
    this.timeMinus.disabled = d.timestamp <= now - PAST_MAX_MS;
    this.timePlus.disabled = d.timestamp >= now + FUTURE_MAX_MS;
    this.volMinus.disabled = d.volumeMl <= VOL_MIN;
    this.volPlus.disabled = d.volumeMl >= VOL_MAX;
    this.abvMinus.disabled = d.abvPercent <= ABV_MIN;
    this.abvPlus.disabled = d.abvPercent >= ABV_MAX;
    return true;
  }
}

/** Minimal shape read from the store (avoids importing the persistence type). */
interface StoredLike {
  id: string;
  timestamp: number;
  volumeMl: number;
  abvPercent: number;
  label: string;
  e: string;
}
