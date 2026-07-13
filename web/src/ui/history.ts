/**
 * "Vergangene Abende" — session history card in the profile cover. Each closed
 * evening is a collapsible row (date + time range · count + peak) that expands
 * into its read-only drink list. Swipe the row leftward (Apple-Mail style) for
 * Bearbeiten (reopen into the current log) | Löschen.
 */
import type { Store } from '../state/store';
import { el, qs } from '../lib/dom';
import { fmtClock, fmtDate, fmtN1, fmtP } from '../lib/format';
import { attachSwipeActions } from './rowSwipe';

export class History {
  private list = qs<HTMLElement>('#historyList');
  private empty = qs<HTMLElement>('#historyEmpty');
  private expanded = new Set<string>();

  constructor(
    private store: Store,
    private onReopen: () => void,
  ) {
    this.store.onInvalidate(() => this.render());
    this.render();
  }

  render(): void {
    // Chronological history (a reopened + re-closed evening keeps its place).
    const sessions = this.store.sessions.slice().sort((a, b) => b.startedAt - a.startedAt);
    this.empty.hidden = sessions.length > 0;
    this.list.textContent = '';
    const ids = new Set(sessions.map((s) => s.id));
    for (const id of this.expanded) if (!ids.has(id)) this.expanded.delete(id);

    for (const s of sessions) {
      const row = el('div', 'history-row');

      // Swipeable header: tap expands, swipe reveals Bearbeiten | Löschen.
      const swipe = el('div', 'history-swipe swipe-row');
      const actions = el('div', 'row-actions');
      const edit = el('button', 'row-act is-edit history-edit', 'Bearbeiten');
      edit.setAttribute('aria-label', `Abend vom ${fmtDate(s.startedAt)} bearbeiten`);
      edit.addEventListener('click', () => {
        // Reopen into the current log (a non-empty current evening archives first);
        // close the profile so the user lands on the editable evening.
        this.store.reopenSession(s.id, Date.now());
        this.onReopen();
      });
      const del = el('button', 'row-act is-delete history-delete', 'Löschen');
      del.setAttribute('aria-label', `Abend vom ${fmtDate(s.startedAt)} löschen`);
      del.addEventListener('click', () => this.store.removeSession(s.id));
      actions.append(edit, del);
      swipe.appendChild(actions);

      const content = el('div', 'row-content');
      const head = el('button', 'history-head');
      head.setAttribute('aria-expanded', String(this.expanded.has(s.id)));
      const left = el('div', 'history-when');
      left.appendChild(el('div', 'history-date', fmtDate(s.startedAt)));
      left.appendChild(el('div', 'history-range num', `${fmtClock(s.startedAt)}–${fmtClock(s.endedAt)}`));
      head.appendChild(left);
      const meta = el('div', 'history-meta num');
      meta.append(
        el('div', 'history-count', `${s.drinks.length} ${s.drinks.length === 1 ? 'Getränk' : 'Getränke'}`),
        el('div', 'history-peak', `max ${fmtP(s.peakBac)} ‰`),
      );
      head.appendChild(meta);
      head.addEventListener('click', () => {
        if (this.expanded.has(s.id)) this.expanded.delete(s.id);
        else this.expanded.add(s.id);
        this.render();
      });
      content.appendChild(head);
      swipe.appendChild(content);
      attachSwipeActions(swipe, content, actions);
      row.appendChild(swipe);

      if (this.expanded.has(s.id)) {
        const details = el('div', 'history-drinks');
        for (const d of s.drinks.slice().sort((a, b) => a.timestamp - b.timestamp)) {
          const dr = el('div', 'history-drink');
          dr.appendChild(el('span', 'history-drink-emoji', d.e));
          dr.appendChild(el('span', 'history-drink-label', d.label));
          dr.appendChild(el('span', 'history-drink-detail', `${fmtN1(d.volumeMl)} ml · ${fmtN1(d.abvPercent)} %`));
          dr.appendChild(el('span', 'history-drink-time num', fmtClock(d.timestamp)));
          details.appendChild(dr);
        }
        row.appendChild(details);
      }

      this.list.appendChild(row);
    }
  }
}
