import React from 'react';
import Svg, { Polyline, Line, Circle, Text as SvgText, G } from 'react-native-svg';
import type { BacPoint } from '@/engine/bac';
import { colors } from '@/theme/colors';
import { formatPromille } from '@/utils/format';
import { formatClock } from '@/utils/time';

interface Props {
  points: BacPoint[];
  limit: number;
  now: number;
  peakBac: number;
  width: number;
  height: number;
  locale?: string;
}

const PAD = { left: 44, right: 14, top: 14, bottom: 26 };

/** Leichter, eigenständiger SVG-Verlaufschart (kein externes Chart-Framework nötig). */
export function BacChart({ points, limit, now, peakBac, width, height, locale = 'de-DE' }: Props) {
  if (points.length < 2) return null;

  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = Math.max(1, height - PAD.top - PAD.bottom);
  const tMin = points[0].t;
  const tMax = points[points.length - 1].t;
  const tSpan = tMax - tMin || 1;
  const yMax = Math.max(limit, peakBac, 0.1) * 1.15;

  const xOf = (t: number) => PAD.left + ((t - tMin) / tSpan) * plotW;
  const yOf = (v: number) => PAD.top + (1 - v / yMax) * plotH;

  // Bei sehr vielen Punkten ausdünnen (Polyline bleibt flüssig).
  const step = Math.max(1, Math.floor(points.length / 240));
  const poly = points
    .filter((_, i) => i % step === 0 || i === points.length - 1)
    .map((p) => `${xOf(p.t).toFixed(1)},${yOf(p.bac).toFixed(1)}`)
    .join(' ');

  const limitY = yOf(limit);
  const nowInRange = now >= tMin && now <= tMax;
  const nowBac = nowInRange ? sample(points, now) : 0;

  return (
    <Svg width={width} height={height}>
      {/* Achsen */}
      <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} stroke={colors.border} strokeWidth={1} />
      <Line x1={PAD.left} y1={PAD.top + plotH} x2={PAD.left + plotW} y2={PAD.top + plotH} stroke={colors.border} strokeWidth={1} />

      {/* Grenzwert-Linie */}
      <Line x1={PAD.left} y1={limitY} x2={PAD.left + plotW} y2={limitY} stroke={colors.danger} strokeWidth={1} strokeDasharray="5,4" />
      <SvgText x={PAD.left + 2} y={limitY - 4} fill={colors.danger} fontSize={10}>
        {formatPromille(limit, locale)}
      </SvgText>

      {/* Verlaufskurve */}
      <Polyline points={poly} fill="none" stroke={colors.primary} strokeWidth={2} />

      {/* Jetzt-Marker */}
      {nowInRange ? (
        <G>
          <Line x1={xOf(now)} y1={PAD.top} x2={xOf(now)} y2={PAD.top + plotH} stroke={colors.textMuted} strokeWidth={1} strokeDasharray="2,3" />
          <Circle cx={xOf(now)} cy={yOf(nowBac)} r={4} fill={colors.text} />
        </G>
      ) : null}

      {/* Y-Beschriftung */}
      <SvgText x={4} y={yOf(0)} fill={colors.textMuted} fontSize={10}>0</SvgText>
      <SvgText x={4} y={yOf(yMax) + 8} fill={colors.textMuted} fontSize={10}>
        {formatPromille(yMax, locale).replace(' ‰', '')}
      </SvgText>

      {/* X-Beschriftung (Start / Ende) */}
      <SvgText x={PAD.left} y={height - 8} fill={colors.textMuted} fontSize={10}>
        {formatClock(tMin, locale)}
      </SvgText>
      <SvgText x={PAD.left + plotW} y={height - 8} fill={colors.textMuted} fontSize={10} textAnchor="end">
        {formatClock(tMax, locale)}
      </SvgText>
    </Svg>
  );
}

function sample(points: BacPoint[], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (t >= a.t && t <= b.t) {
      const span = b.t - a.t || 1;
      return a.bac + ((t - a.t) / span) * (b.bac - a.bac);
    }
  }
  return points[points.length - 1]?.bac ?? 0;
}
