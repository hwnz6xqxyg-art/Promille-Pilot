/**
 * "Vergangene Abende" — session history card in the profile cover. Each closed
 * evening is a collapsible row (date + time range · count + peak) that expands
 * into its read-only drink list. Deleting a session arms inline (✕ → "Löschen?"
 * for 3 s) instead of opening another overlay.
 */
import type { Store } from '../state/store';
import { el, qs, setText } from '../lib/dom';
import { fmtClock, fmtDate, fmtN1, fmtP } from '../lib/format';

export class History {
  private list = qs<HTMLElement>('#historyList');
  private empty = qs<HTMLElement>('#historyEmpty');
  private expanded = new Set<string>();
  private armedId: string | null = null;
  private armTimer: number | null = null;

  constructor(
    private store: Store,
    private onReopen: () => void,
  ) {
    this.store.onInvalidate(() => this.render());
    this.render();
  }

  private disarm(): void {
    if (this.armTimer !== null) {
      clearTimeout(this.armTimer);
      this.armTimer = null;
    }
    this.armedId = null;
  }

  render(): void {
    // Chronological history (a reopened + re-closed evening keeps its place).
    const sessions = this.store.sessions.slice().sort((a, b) => b.startedAt - a.startedAt);
    this.empty.hidden = sessions.length > 0;
    this.list.textContent = '';
    // Sessions no longer present can't stay expanded/armed.
    const ids = new Set(sessions.map((s) => s.id));
    for (const id of this.expanded) if (!ids.has(id)) this.expanded.delete(id);
    if (this.armedId && !ids.has(this.armedId)) this.disarm();

    for (const s of sessions) {
      const row = el('div', 'history-row');

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
        this.disarm();
        this.render();
      });
      row.appendChild(head);

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
        const actions = el('div', 'history-actions');
        const edit = el('button', 'history-edit');
        setText(edit, 'Abend bearbeiten');
        edit.addEventListener('click', () => {
          // Reopen into the current log (a non-empty current evening archives first);
          // close the profile so the user lands on the editable evening.
          this.disarm();
          this.store.reopenSession(s.id, Date.now());
          this.onReopen();
        });
        actions.appendChild(edit);
        const del = el('button', 'history-delete');
        if (this.armedId === s.id) {
          del.classList.add('is-armed');
          setText(del, 'Wirklich löschen?');
          del.addEventListener('click', () => {
            this.disarm();
            this.store.removeSession(s.id);
          });
        } else {
          setText(del, 'Abend löschen');
          del.addEventListener('click', () => {
            this.disarm();
            this.armedId = s.id;
            this.armTimer = window.setTimeout(() => {
              this.armedId = null;
              this.armTimer = null;
              this.render();
            }, 3000);
            this.render();
          });
        }
        actions.appendChild(del);
        details.appendChild(actions);
        row.appendChild(details);
      }

      this.list.appendChild(row);
    }
  }
}
