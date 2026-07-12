/**
 * Create / edit a custom drink — a small form sheet reached from the add-sheet's
 * "＋ Eigenes Getränk" row (create) or a custom row's ✎ (edit). Emoji from a
 * curated grid, name via the app's only text input, amount + strength via the
 * same steppers as the editor. Saving persists to store.customDrinks; onChange
 * refreshes the add-sheet list. No swipe-to-dismiss (a form shouldn't lose typed
 * text to a stray drag) — backdrop / Escape / Löschen close it.
 */
import type { Store } from '../state/store';
import { qs, setText } from '../lib/dom';
import { fmtN1, fmtDrinkDetail } from '../lib/format';

const EMOJIS = ['🍺', '🍷', '🍸', '🍹', '🥃', '🍾', '🥂', '🍶', '🧉', '🍻', '🌾', '🍋', '☕', '🥤', '🧃'];
const VOL_MIN = 10;
const VOL_MAX = 2000;
const ABV_MIN = 0.5;
const ABV_MAX = 60;
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export type CustomMode = 'create' | 'edit';

export class CustomForm {
  private sheet = qs<HTMLElement>('#customSheet');
  private backdrop = qs<HTMLElement>('#customBackdrop');
  private title = qs<HTMLElement>('#customTitle');
  private grid = qs<HTMLElement>('#customEmojiGrid');
  private nameInput = qs<HTMLInputElement>('#customName');
  private volLabel = qs<HTMLElement>('#customVolLabel');
  private volMinus = qs<HTMLButtonElement>('#customVolMinus');
  private volPlus = qs<HTMLButtonElement>('#customVolPlus');
  private abvLabel = qs<HTMLElement>('#customAbvLabel');
  private abvMinus = qs<HTMLButtonElement>('#customAbvMinus');
  private abvPlus = qs<HTMLButtonElement>('#customAbvPlus');
  private saveBtn = qs<HTMLButtonElement>('#customSave');
  private deleteBtn = qs<HTMLButtonElement>('#customDelete');
  private emojiBtns = new Map<string, HTMLButtonElement>();

  private editingId: string | null = null;
  private e = EMOJIS[2]; // 🍸
  private vol = 200;
  private abv = 10;

  constructor(
    private store: Store,
    private onChange: () => void,
  ) {
    for (const emoji of EMOJIS) {
      const btn = document.createElement('button');
      btn.className = 'emoji-opt';
      btn.type = 'button';
      btn.textContent = emoji;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-label', emoji);
      btn.addEventListener('click', () => {
        this.e = emoji;
        this.syncEmoji();
      });
      this.grid.appendChild(btn);
      this.emojiBtns.set(emoji, btn);
    }

    this.volMinus.addEventListener('click', () => this.stepVol(-50));
    this.volPlus.addEventListener('click', () => this.stepVol(50));
    this.abvMinus.addEventListener('click', () => this.stepAbv(-0.5));
    this.abvPlus.addEventListener('click', () => this.stepAbv(0.5));

    this.nameInput.addEventListener('input', () => this.syncSaveEnabled());
    this.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !this.saveBtn.disabled) {
        e.preventDefault();
        this.save();
      }
    });

    this.saveBtn.addEventListener('click', () => this.save());
    this.deleteBtn.addEventListener('click', () => {
      if (this.editingId) this.store.removeCustomDrink(this.editingId);
      this.onChange();
      this.close();
    });
    this.backdrop.addEventListener('click', () => this.close());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.sheet.classList.contains('is-open')) this.close();
    });
  }

  open(mode: CustomMode, id?: string): void {
    if (mode === 'edit' && id) {
      const d = this.store.customDrinks.find((x) => x.id === id);
      if (!d) return;
      this.editingId = id;
      this.e = d.e;
      this.vol = d.vol;
      this.abv = d.abv;
      this.nameInput.value = d.name;
      setText(this.title, 'Getränk bearbeiten');
      this.deleteBtn.hidden = false;
    } else {
      this.editingId = null;
      this.e = EMOJIS[2];
      this.vol = 200;
      this.abv = 10;
      this.nameInput.value = '';
      setText(this.title, 'Eigenes Getränk');
      this.deleteBtn.hidden = true;
    }
    this.syncEmoji();
    this.syncSteppers();
    this.syncSaveEnabled();
    this.sheet.classList.add('is-open');
    this.backdrop.classList.add('is-open');
    this.nameInput.focus({ preventScroll: true });
  }

  close(): void {
    this.editingId = null;
    this.nameInput.blur();
    this.sheet.classList.remove('is-open');
    this.backdrop.classList.remove('is-open');
  }

  private save(): void {
    const name = this.nameInput.value.trim();
    if (!name) return;
    const fields = { e: this.e, name, detail: fmtDrinkDetail(this.vol, this.abv), vol: this.vol, abv: this.abv };
    if (this.editingId) this.store.updateCustomDrink(this.editingId, fields);
    else this.store.addCustomDrink(fields);
    this.onChange();
    this.close();
  }

  private stepVol(delta: number): void {
    this.vol = clamp(Math.round((this.vol + delta) / 10) * 10, VOL_MIN, VOL_MAX);
    this.syncSteppers();
  }

  private stepAbv(delta: number): void {
    this.abv = clamp(Math.round((this.abv + delta) * 10) / 10, ABV_MIN, ABV_MAX);
    this.syncSteppers();
  }

  private syncEmoji(): void {
    for (const [emoji, btn] of this.emojiBtns) {
      const on = emoji === this.e;
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  private syncSteppers(): void {
    setText(this.volLabel, `${fmtN1(this.vol)} ml`);
    setText(this.abvLabel, `${fmtN1(this.abv)} %`);
    this.volMinus.disabled = this.vol <= VOL_MIN;
    this.volPlus.disabled = this.vol >= VOL_MAX;
    this.abvMinus.disabled = this.abv <= ABV_MIN;
    this.abvPlus.disabled = this.abv >= ABV_MAX;
  }

  private syncSaveEnabled(): void {
    this.saveBtn.disabled = this.nameInput.value.trim() === '';
  }
}
