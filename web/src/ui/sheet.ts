/**
 * Add-drink bottom sheet + FAB — spring presentation via CSS transition
 * (cubic-bezier(.32,1.22,.42,1) 550ms), backdrop fade, time stepper
 * ("vor X min" · "jetzt" · "in X min").
 */
import { PRESETS } from '../data/presets';
import type { Store } from '../state/store';
import { el, qs, setText } from '../lib/dom';
import { attachSwipeToDismiss } from './sheetSwipe';
import { CreatePanel, type CustomMode } from './customform';

const EDIT_ICON =
  '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(60,60,67,0.6)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

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
  private presetList = qs<HTMLElement>('#presetList');
  private firstRow: HTMLButtonElement | null = null;
  // The "create custom drink" view lives inside this same sheet (#sheet.is-creating).
  private create = new CreatePanel(this.store, () => this.showBrowse());

  constructor(private store: Store) {
    // FAB interaction (tap vs. long-press) is owned by QuickAdd, which calls open().
    this.backdrop.addEventListener('click', () => this.close());
    // − steps back in time (higher agoMin → "vor X min"),
    // + steps forward in time (lower agoMin → "jetzt" → "in X min").
    this.agoMinus.addEventListener('click', () => this.setAgo(this.store.agoMin + 15));
    this.agoPlus.addEventListener('click', () => this.setAgo(this.store.agoMin - 15));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.store.sheetOpen) this.close();
    });
    attachSwipeToDismiss(this.sheet, this.backdrop, () => this.close());
  }

  /** Rebuild the preset list: built-ins, then the user's custom drinks, then "＋ Eigenes". */
  renderPresets(): void {
    const list = this.presetList;
    list.textContent = '';
    this.firstRow = null;

    for (const p of PRESETS) {
      const row = el('button', 'preset-row');
      row.appendChild(el('div', 'preset-emoji', p.e));
      const text = el('div', 'preset-text');
      text.append(el('span', 'preset-name', p.name), el('span', 'preset-detail', ` · ${p.detail}`));
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

    if (this.store.customDrinks.length) {
      list.appendChild(el('div', 'preset-group-label', 'Meine Getränke'));
      for (const c of this.store.customDrinks) {
        const row = el('div', 'preset-row is-custom');
        const main = el('button', 'preset-main');
        main.appendChild(el('div', 'preset-emoji', c.e));
        const text = el('div', 'preset-text');
        text.append(el('span', 'preset-name', c.name), el('span', 'preset-detail', ` · ${c.detail}`));
        main.appendChild(text);
        main.addEventListener('click', () => {
          this.store.addDrink(c, this.store.agoMin, Date.now());
          this.close();
        });
        row.appendChild(main);
        const edit = el('button', 'preset-edit');
        edit.setAttribute('aria-label', `Bearbeiten: ${c.name}`);
        edit.dataset.press = 'icon';
        edit.innerHTML = EDIT_ICON;
        edit.addEventListener('click', () => this.showCreate('edit', c.id));
        row.appendChild(edit);
        list.appendChild(row);
      }
    }

    const create = el('button', 'preset-row preset-create');
    create.innerHTML = '<span class="preset-create-plus">＋</span>Eigenes Getränk';
    create.addEventListener('click', () => this.showCreate('create'));
    list.appendChild(create);
  }

  /** Swap this sheet to the create/edit form view. */
  showCreate(mode: CustomMode, id?: string): void {
    this.create.load(mode, id);
    this.sheet.classList.add('is-creating');
    this.create.focusName();
  }

  /** Swap back to the drink-list view (also refreshes it after a custom change). */
  showBrowse(): void {
    this.sheet.classList.remove('is-creating');
    this.renderPresets();
    this.firstRow?.focus({ preventScroll: true });
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
    this.sheet.classList.remove('is-creating'); // always open on the browse view
    this.renderPresets();
    this.setAgo(0);
    this.sheet.classList.add('is-open');
    this.backdrop.classList.add('is-open');
    this.firstRow?.focus({ preventScroll: true });
  }

  close(): void {
    this.store.sheetOpen = false;
    this.sheet.classList.remove('is-open', 'is-creating'); // reset view for next open
    this.backdrop.classList.remove('is-open');
    this.fab.focus({ preventScroll: true });
  }
}
