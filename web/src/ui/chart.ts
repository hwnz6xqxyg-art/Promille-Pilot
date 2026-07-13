/**
 * Verlauf card — BAC curve (design variation 1c) + drink-timeline markers.
 *
 * Geometry (paths, limit line, axis labels, emoji markers) is rebuilt only when
 * drinks/profile change — detected by object identity, since the store replaces both
 * wholesale on every mutation. Per-recompute updates touch only the now-cursor, the
 * per-cluster future dimming and the aria label. Dragging the SVG scrubs time
 * absolutely (tap = jump), reaching into the past (back to the first drink) as well as
 * the future — this is the "backtracking" view of the evening.
 */
import type { Store } from '../state/store';
import type { StoredDrink } from '../state/persistence';
import { applicableLimit, simulate, type BacPoint, type Profile } from '../engine';
import { qs, setText } from '../lib/dom';
import { fmtClock, fmtP } from '../lib/format';
import type { ScrubHooks } from './scrubber';

// Geometry — mirrors design/Promille iOS.dc.html (1c, lines 429-443, 831-849).
const W = 370;
const PADL = 36;
const PADR = 14;
const PADT = 16;
const PADB = 36;
const PLOT_W = W - PADL - PADR; // 320
const PLOT_H = 232 - PADT - PADB; // 180
const BASE_Y = PADT + PLOT_H; // 196
const X_MAX = W - PADR; // 356
const CLUSTER_GAP = 18; // svg px: consecutive drinks closer than this merge into one marker
const MAX_SHIFT = 720; // matches Scrubber MAX (12 h forward)

// Status colours — keep in sync with styles.css :root --red / --orange / --green.
const RED = '#ff3b30';
const ORANGE = '#ff9500';
const GREEN = '#34c759';

const SVGNS = 'http://www.w3.org/2000/svg';

interface Geom {
  points: BacPoint[];
  tMin: number;
  tMax: number;
  tSpan: number;
  yMax: number;
  limit: number;
  peakBac: number;
  peakTime: number;
}

interface Cluster {
  g: SVGGElement;
  t: number; // anchor (earliest) timestamp, for future dimming
}

const xOf = (t: number, g: Geom): number => PADL + ((t - g.tMin) / g.tSpan) * PLOT_W;
const yOf = (v: number, g: Geom): number => PADT + (1 - Math.max(0, v) / g.yMax) * PLOT_H;

/** Linear interpolation over the cached curve — mirrors the engine's private sampleAt. */
function sampleAt(points: BacPoint[], t: number): number {
  if (points.length === 0) return 0;
  if (t <= points[0].t) return t < points[0].t ? 0 : points[0].bac;
  const last = points[points.length - 1];
  if (t >= last.t) return 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t;
      if (span <= 0) return a.bac;
      return a.bac + ((t - a.t) / span) * (b.bac - a.bac);
    }
  }
  return 0;
}

function svgEl(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, String(attrs[k]));
  if (text !== undefined) n.textContent = text;
  return n;
}

/**
 * Smooth path through all points via monotone cubic interpolation
 * (Fritsch–Carlson tangents, à la d3 curveMonotoneX). Rounds the corners of the
 * estimate curve WITHOUT overshooting: it passes through every sample, never
 * bulges above the true peak or below zero, and keeps rising/falling segments
 * monotone — soft, but never claims more than the data.
 */
function monotonePathD(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return '';
  if (n === 1) return `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;

  // Secant slopes, then Fritsch–Carlson tangents.
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(Math.max(1e-9, xs[i + 1] - xs[i]));
    s.push((ys[i + 1] - ys[i]) / dx[i]);
  }
  const m: number[] = new Array(n);
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) {
      m[i] = 0; // local extremum → flat tangent (rounded crest at exact height)
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]); // weighted harmonic mean — no overshoot
    }
  }

  let d = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d +=
      ` C${(xs[i] + h).toFixed(1)},${(ys[i] + m[i] * h).toFixed(1)}` +
      ` ${(xs[i + 1] - h).toFixed(1)},${(ys[i + 1] - m[i + 1] * h).toFixed(1)}` +
      ` ${xs[i + 1].toFixed(1)},${ys[i + 1].toFixed(1)}`;
  }
  return d;
}

export class Chart {
  private body = qs<HTMLElement>('#chartBody');
  private empty = qs<HTMLElement>('#chartEmpty');
  private svg = qs<SVGSVGElement>('#chartSvg');
  private area = qs<SVGPathElement>('#chartArea');
  private curve = qs<SVGPathElement>('#chartCurve');
  private limitLine = qs<SVGLineElement>('#chartLimitLine');
  private limitLabel = qs<SVGTextElement>('#chartLimitLabel');
  private marks = qs<SVGGElement>('#chartMarks');
  private nowLine = qs<SVGLineElement>('#chartNowLine');
  private nowDot = qs<SVGCircleElement>('#chartNowDot');
  private t0 = qs<SVGTextElement>('#chartT0');
  private t1 = qs<SVGTextElement>('#chartT1');

  private cachedDrinks: StoredDrink[] | null = null;
  private cachedProfile: Profile | null = null;
  private geom: Geom | null = null;
  private clusters: Cluster[] = [];
  private lastAria = '';
  private drag: { rect: DOMRect } | null = null;

  get dragging(): boolean {
    return this.drag !== null;
  }

  constructor(
    private store: Store,
    private hooks: ScrubHooks,
  ) {
    this.svg.addEventListener('pointerdown', (e) => {
      if (!this.geom) return;
      this.svg.setPointerCapture(e.pointerId);
      this.drag = { rect: this.svg.getBoundingClientRect() };
      this.hooks.cancelShiftAnim();
      this.jumpTo(e.clientX);
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (this.drag) this.jumpTo(e.clientX);
    });
    const release = (): void => {
      const g = this.geom;
      if (!this.drag || !g) {
        this.drag = null;
        return;
      }
      this.drag = null;
      const now = Date.now();
      const lo = Math.min(0, (g.tMin - now) / 60000);
      const hi = Math.min(MAX_SHIFT, (g.tMax - now) / 60000);
      const s = this.store.shiftMin;
      const c = Math.max(lo, Math.min(hi, s));
      if (Math.abs(c - s) > 0.01) this.hooks.springShiftTo(c);
    };
    this.svg.addEventListener('pointerup', release);
    this.svg.addEventListener('pointercancel', release);
  }

  update(effectiveNow: number): void {
    const drinks = this.store.drinks;
    const profile = this.store.profile;
    if (drinks.length === 0) {
      this.showEmpty();
      return;
    }
    if (drinks !== this.cachedDrinks || profile !== this.cachedProfile) {
      const geom = this.computeGeom(drinks, profile);
      if (!geom) {
        this.showEmpty();
        return;
      }
      this.geom = geom;
      this.cachedDrinks = drinks;
      this.cachedProfile = profile;
      this.renderGeom(geom, drinks);
      this.body.hidden = false;
      this.empty.hidden = true;
    }
    if (this.geom) this.renderNow(effectiveNow);
  }

  private showEmpty(): void {
    if (!this.body.hidden) this.body.hidden = true;
    if (this.empty.hidden) this.empty.hidden = false;
    this.geom = null;
    this.cachedDrinks = null;
    this.cachedProfile = null;
  }

  private computeGeom(drinks: StoredDrink[], profile: Profile): Geom | null {
    const limit = applicableLimit(profile);
    const sim = simulate(drinks, profile);
    if (sim.points.length < 2) return null;
    const pts = sim.points;
    const tMin = pts[0].t;
    const tMax = pts[pts.length - 1].t;
    return {
      points: pts,
      tMin,
      tMax,
      tSpan: tMax - tMin || 1,
      yMax: Math.max(limit, sim.peakBac, 0.1) * 1.18,
      limit,
      peakBac: sim.peakBac,
      peakTime: sim.peakTime,
    };
  }

  private renderGeom(g: Geom, drinks: StoredDrink[]): void {
    const pts = g.points;
    // Coarse anchors on purpose: the monotone spline can only round corners within
    // one segment, so ~48 anchors ≈ 7 px segments give the visibly soft, "estimate,
    // not measurement" look. The exact peak is spliced back in below.
    const step = Math.max(1, Math.floor(pts.length / 48));
    const seg: BacPoint[] = [];
    for (let i = 0; i < pts.length; i += step) seg.push(pts[i]);
    if (seg[seg.length - 1] !== pts[pts.length - 1]) seg.push(pts[pts.length - 1]);
    // Downsampling must not skip the true crest — splice the peak sample back in.
    if (isFinite(g.peakTime) && !seg.some((pt) => pt.t === g.peakTime)) {
      const at = seg.findIndex((pt) => pt.t > g.peakTime);
      if (at > 0) seg.splice(at, 0, { t: g.peakTime, bac: g.peakBac });
    }
    const curveD = monotonePathD(
      seg.map((pt) => xOf(pt.t, g)),
      seg.map((pt) => yOf(pt.bac, g)),
    );
    this.curve.setAttribute('d', curveD);
    this.area.setAttribute(
      'd',
      `${curveD} L${xOf(g.tMax, g).toFixed(1)},${BASE_Y} L${PADL},${BASE_Y} Z`,
    );

    const limitY = yOf(g.limit, g);
    this.limitLine.setAttribute('y1', limitY.toFixed(1));
    this.limitLine.setAttribute('y2', limitY.toFixed(1));
    setText(this.limitLabel, `Limit ${fmtP(g.limit)} ‰`);
    this.limitLabel.setAttribute('y', (limitY - 6).toFixed(1));
    // A low limit line (e.g. 0,00 for novices) would put the label in the marker band at
    // the left, where the first drink always sits — flip it to the clear right edge.
    if (limitY > 165) {
      this.limitLabel.setAttribute('x', String(X_MAX - 4));
      this.limitLabel.setAttribute('text-anchor', 'end');
    } else {
      this.limitLabel.setAttribute('x', String(PADL + 4));
      this.limitLabel.setAttribute('text-anchor', 'start');
    }

    setText(this.t0, fmtClock(g.tMin));
    setText(this.t1, fmtClock(g.tMax));

    this.buildMarkers(drinks, g);
  }

  private buildMarkers(drinks: StoredDrink[], g: Geom): void {
    const sorted = drinks.slice().sort((a, b) => a.timestamp - b.timestamp);
    interface Group {
      members: StoredDrink[];
      lastX: number;
    }
    const groups: Group[] = [];
    for (const d of sorted) {
      const x = xOf(d.timestamp, g);
      const last = groups[groups.length - 1];
      if (last && x - last.lastX < CLUSTER_GAP) {
        last.members.push(d);
        last.lastX = x;
      } else {
        groups.push({ members: [d], lastX: x });
      }
    }

    const clamp = (x: number): number => Math.max(PADL, Math.min(X_MAX, x));
    const nodes: SVGGElement[] = [];
    const clusters: Cluster[] = [];
    for (const group of groups) {
      const anchor = group.members[0];
      const ax = clamp(xOf(anchor.timestamp, g));
      const el = document.createElementNS(SVGNS, 'g');
      el.setAttribute('class', 'chart-mark');
      // Honest per-drink baseline ticks (exact times survive clustering).
      for (const m of group.members) {
        const mx = clamp(xOf(m.timestamp, g));
        el.appendChild(
          svgEl('line', {
            x1: mx.toFixed(1),
            x2: mx.toFixed(1),
            y1: BASE_Y,
            y2: BASE_Y + 4,
            stroke: 'rgba(60,60,67,0.3)',
            'stroke-width': 1,
          }),
        );
      }
      el.appendChild(
        svgEl('text', { x: ax.toFixed(1), y: 192, 'text-anchor': 'middle', 'font-size': 14 }, anchor.e),
      );
      if (group.members.length > 1) {
        const badge = svgEl(
          'text',
          {
            x: ax.toFixed(1),
            y: 178,
            'text-anchor': 'middle',
            'font-size': 9,
            'font-weight': 700,
            fill: 'rgba(60,60,67,0.6)',
          },
          `×${group.members.length}`,
        );
        badge.setAttribute('class', 'num');
        el.appendChild(badge);
      }
      nodes.push(el);
      clusters.push({ g: el, t: anchor.timestamp });
    }
    this.marks.replaceChildren(...nodes);
    this.clusters = clusters;
  }

  private renderNow(effectiveNow: number): void {
    const g = this.geom;
    if (!g) return;
    const clampedNow = Math.max(g.tMin, Math.min(g.tMax, effectiveNow));
    const nowX = xOf(clampedNow, g);
    // Value from the true (unclamped) time so the dot's height + colour match the hero:
    // scrubbing before the first drink / past sober reads 0, not the clamped curve edge.
    const bacNow = sampleAt(g.points, effectiveNow);
    const nowY = yOf(bacNow, g);
    this.nowLine.setAttribute('x1', nowX.toFixed(1));
    this.nowLine.setAttribute('x2', nowX.toFixed(1));
    this.nowDot.setAttribute('cx', nowX.toFixed(1));
    this.nowDot.setAttribute('cy', nowY.toFixed(1));
    const over = bacNow > g.limit + 1e-6;
    const drinking = bacNow > 0.004;
    this.nowDot.setAttribute('stroke', over ? RED : drinking ? ORANGE : GREEN);

    for (const c of this.clusters) c.g.classList.toggle('is-future', c.t > effectiveNow);

    let aria = `Promilleverlauf: aktuell ${fmtP(bacNow)} ‰`;
    if (g.peakBac > 0.004 && isFinite(g.peakTime)) {
      aria += `, Höchstwert ${fmtP(g.peakBac)} ‰ um ${fmtClock(g.peakTime)}`;
    }
    if (aria !== this.lastAria) {
      this.lastAria = aria;
      this.svg.setAttribute('aria-label', aria);
    }
  }

  private jumpTo(clientX: number): void {
    const g = this.geom;
    const d = this.drag;
    if (!g || !d) return;
    const xsvg = ((clientX - d.rect.left) / Math.max(1, d.rect.width)) * W;
    const t = g.tMin + ((xsvg - PADL) / PLOT_W) * g.tSpan;
    const now = Date.now();
    let raw = (t - now) / 60000;
    const lo = Math.min(0, (g.tMin - now) / 60000);
    const hi = Math.min(MAX_SHIFT, (g.tMax - now) / 60000);
    if (raw < lo) raw = lo + (raw - lo) * 0.3;
    if (raw > hi) raw = hi + (raw - hi) * 0.3;
    this.store.shiftMin = raw;
    this.hooks.onChange();
  }
}
