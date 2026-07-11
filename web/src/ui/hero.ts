/**
 * Hero card: "UNTER DEINEM LIMIT AB" + huge time + the three threshold rows.
 * Mirrors the prototype's renderVals() forecast branches exactly.
 */
import { FORECAST_THRESHOLDS, ThresholdForecast } from '../engine';
import { el, qs, setText } from '../lib/dom';
import { fmtClock, fmtDur, fmtP } from '../lib/format';

interface FcRowEls {
  main: HTMLElement;
  sub: HTMLElement;
}

export class Hero {
  private timeEl = qs<HTMLElement>('#heroTime');
  private subEl = qs<HTMLElement>('#heroSub');
  private rows: FcRowEls[] = [];
  private pulseFlip = false;

  constructor() {
    const wrap = qs<HTMLElement>('#fcRows');
    for (const limit of FORECAST_THRESHOLDS) {
      const row = el('div', 'fc-row');
      row.appendChild(el('span', 'fc-label', `unter ${fmtP(limit)} ‰`));
      const value = el('span', 'fc-value');
      const main = el('b', 'fc-main num', '—');
      const sub = el('span', 'fc-sub num', '');
      value.append(main, sub);
      row.appendChild(value);
      wrap.appendChild(row);
      this.rows.push({ main, sub });
    }
  }

  /** Per-frame/recompute update. forecasts is null when there are no drinks. */
  update(forecasts: ThresholdForecast[] | null, limit: number, effectiveNow: number): void {
    if (!forecasts) {
      setText(this.timeEl, '—');
      this.timeEl.className = 'hero-time num';
      setText(this.subEl, 'Füg ein Getränk hinzu.');
      for (const r of this.rows) {
        setText(r.main, '—');
        r.main.className = 'fc-main num is-empty';
        setText(r.sub, '');
      }
      return;
    }

    forecasts.forEach((f, i) => {
      const r = this.rows[i];
      if (f.alreadyBelow) {
        setText(r.main, '✓ jetzt');
        r.main.className = 'fc-main num is-reached';
        setText(r.sub, '');
      } else if (f.time != null) {
        setText(r.main, fmtClock(f.time));
        r.main.className = 'fc-main num';
        setText(r.sub, `in ${fmtDur(f.time - effectiveNow)}`);
      } else {
        setText(r.main, '—');
        r.main.className = 'fc-main num is-empty';
        setText(r.sub, '');
      }
    });

    const heroRow =
      forecasts.find((f) => Math.abs(f.limit - limit) < 1e-6) ?? forecasts[forecasts.length - 1];
    const pulseClass = this.timeEl.classList.contains('pulse-a')
      ? 'pulse-a'
      : this.timeEl.classList.contains('pulse-b')
        ? 'pulse-b'
        : '';
    if (heroRow.alreadyBelow) {
      setText(this.timeEl, 'Jetzt');
      this.timeEl.className = `hero-time num is-now ${pulseClass}`;
      setText(this.subEl, `unter deinem Limit von ${fmtP(limit)} ‰ — Restalkohol bleibt ein Risiko.`);
    } else if (heroRow.time != null) {
      setText(this.timeEl, fmtClock(heroRow.time));
      this.timeEl.className = `hero-time num is-set ${pulseClass}`;
      setText(this.subEl, `in ${fmtDur(heroRow.time - effectiveNow)} · Limit ${fmtP(limit)} ‰`);
    } else {
      setText(this.timeEl, '—');
      this.timeEl.className = `hero-time num ${pulseClass}`;
      setText(this.subEl, `Limit ${fmtP(limit)} ‰`);
    }
  }

  /** Limit-cross pulse — alternates between two identical keyframes to retrigger. */
  pulse(): void {
    this.pulseFlip = !this.pulseFlip;
    this.timeEl.classList.remove('pulse-a', 'pulse-b');
    this.timeEl.classList.add(this.pulseFlip ? 'pulse-a' : 'pulse-b');
  }
}
