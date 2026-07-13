/**
 * "Vergangener Abend" banner — visible only while a reopened past evening is
 * being edited (store.editingPast). Shows the evening's date and a Fertig button
 * that saves the edits back to history and restores the stashed live evening.
 */
import type { Store } from '../state/store';
import { qs, setText } from '../lib/dom';
import { fmtDate } from '../lib/format';

export class EditBanner {
  private banner = qs<HTMLElement>('#editBanner');
  private date = qs<HTMLElement>('#editBannerDate');
  private done = qs<HTMLButtonElement>('#editBannerDone');

  constructor(private store: Store) {
    this.done.addEventListener('click', () => this.store.finishEditing(Date.now()));
    this.store.onInvalidate(() => this.render());
    this.render();
  }

  private render(): void {
    const e = this.store.editing;
    this.banner.hidden = e === null;
    if (e) setText(this.date, `· ${fmtDate(e.session.startedAt)}`);
  }
}
