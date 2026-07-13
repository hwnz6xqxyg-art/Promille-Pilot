/**
 * Drinks card — newest first, row-in animation for freshly added rows,
 * 26 px remove buttons (enlarged tap area via CSS), "Alle löschen".
 */
import type { Store } from '../state/store';
import { el, qs, setText } from '../lib/dom';
import { fmtClock, fmtN1 } from '../lib/format';

export class Drinks {
  private list = qs<HTMLElement>('#drinkList');
  private empty = qs<HTMLElement>('#drinkEmpty');
  private clearBtn = qs<HTMLButtonElement>('#btnClearAll');
  private closeSessionBtn = qs<HTMLButtonElement>('#btnCloseSession');
  private confirmBackdrop = qs<HTMLElement>('#confirmBackdrop');
  private confirmDialog = qs<HTMLElement>('#confirmDialog');
  private confirmText = qs<HTMLElement>('#confirmText');
  private confirmOk = qs<HTMLButtonElement>('#confirmOk');
  private confirmCancel = qs<HTMLButtonElement>('#confirmCancel');
  private knownIds = new Set<string>();

  constructor(
    private store: Store,
    private onEdit: (id: string) => void,
  ) {
    // Closing the evening is non-destructive (it moves to history) → no confirm.
    this.closeSessionBtn.addEventListener('click', () => this.store.closeSession(Date.now()));
    // "Alle löschen" is destructive → confirm before clearing.
    this.clearBtn.addEventListener('click', () => this.openConfirm());
    this.confirmCancel.addEventListener('click', () => this.closeConfirm());
    this.confirmBackdrop.addEventListener('click', () => this.closeConfirm());
    this.confirmOk.addEventListener('click', () => {
      this.store.clearDrinks();
      this.closeConfirm();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.confirmDialog.classList.contains('is-open')) this.closeConfirm();
    });
    this.render(false);
  }

  private openConfirm(): void {
    const n = this.store.drinks.length;
    setText(
      this.confirmText,
      `${n === 1 ? '1 Getränk wird' : `Alle ${n} Getränke werden`} entfernt. Das lässt sich nicht rückgängig machen.`,
    );
    this.confirmBackdrop.classList.add('is-open');
    this.confirmDialog.classList.add('is-open');
    this.confirmCancel.focus({ preventScroll: true }); // default to the safe action
  }

  private closeConfirm(): void {
    this.confirmBackdrop.classList.remove('is-open');
    this.confirmDialog.classList.remove('is-open');
  }

  /** Re-render on drinks mutation (not per frame). */
  render(animateNew = true): void {
    const drinks = this.store.drinks.slice().sort((a, b) => b.timestamp - a.timestamp);
    this.empty.hidden = drinks.length > 0;
    this.clearBtn.hidden = drinks.length === 0;
    this.closeSessionBtn.hidden = drinks.length === 0;
    this.list.textContent = '';

    const currentIds = new Set<string>();
    for (const d of drinks) {
      currentIds.add(d.id);
      const row = el('div', 'drink-row');
      if (animateNew && !this.knownIds.has(d.id)) row.classList.add('is-new');
      // Tapping the row (everything but the ✕) opens the editor.
      const open = el('button', 'drink-open');
      open.setAttribute('aria-label', `Bearbeiten: ${d.label}, ${fmtClock(d.timestamp)}`);
      open.appendChild(el('div', 'drink-emoji', d.e));
      const info = el('div', 'drink-info');
      info.appendChild(el('div', 'drink-label', d.label));
      info.appendChild(el('div', 'drink-detail', `${fmtN1(d.volumeMl)} ml · ${fmtN1(d.abvPercent)} %`));
      open.appendChild(info);
      open.appendChild(el('div', 'drink-time num', fmtClock(d.timestamp)));
      open.addEventListener('click', () => this.onEdit(d.id));
      row.appendChild(open);
      const remove = el('button', 'drink-remove');
      remove.setAttribute('aria-label', `Entfernen: ${d.label}, ${fmtClock(d.timestamp)}`);
      remove.dataset.press = 'icon';
      remove.innerHTML =
        '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="rgba(60,60,67,0.6)" stroke-width="1.8" stroke-linecap="round"/></svg>';
      remove.addEventListener('click', () => this.store.removeDrink(d.id));
      row.appendChild(remove);
      this.list.appendChild(row);
    }
    this.knownIds = currentIds;
  }
}
