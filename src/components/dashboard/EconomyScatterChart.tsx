"use client";

import { type DetailRow, type EconomyIndicator, INDICATOR_FIELD, INDICATOR_LABELS } from "@/lib/data";

interface EconomyScatterChartProps {
  data: DetailRow[];
  indicator: EconomyIndicator;
}

interface BoxStats {
  label: "胜" | "负";
  values: number[];
  color: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
}

const SVG_WIDTH = 820;
const SVG_HEIGHT = 320;
const PLOT = {
  left: 58,
  right: 24,
  top: 28,
  bottom: 58,
};

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function getBoxStats(values: number[], label: "胜" | "负", color: string): BoxStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lowFence = q1 - 1.5 * iqr;
  const highFence = q3 + 1.5 * iqr;
  const nonOutliers = sorted.filter((v) => v >= lowFence && v <= highFence);

  return {
    label,
    values,
    color,
    min: sorted[0],
    q1,
    median,
    q3,
    max: sorted[sorted.length - 1],
    whiskerLow: nonOutliers[0] ?? sorted[0],
    whiskerHigh: nonOutliers[nonOutliers.length - 1] ?? sorted[sorted.length - 1],
    outliers: sorted.filter((v) => v < lowFence || v > highFence),
  };
}

function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / Math.max(1, count - 1);
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / power;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = niceNormalized * power;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step * 0.5; v += step) {
    ticks.push(Object.is(v, -0) ? 0 : v);
  }
  return ticks;
}

function formatSigned(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

export function EconomyScatterChart({ data, indicator }: EconomyScatterChartProps) {
  const field = INDICATOR_FIELD[indicator];
  const label = INDICATOR_LABELS[indicator];

  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-[#2a2d3a] bg-[#1a1d28] text-sm text-[#64748b]">
        当前筛选无数据
      </div>
    );
  }

  const winValues: number[] = [];
  const lossValues: number[] = [];
  for (const row of data) {
    const value = row[field] as number;
    if (row.win === 1) {
      winValues.push(value);
    } else {
      lossValues.push(value);
    }
  }

  const groups = [
    getBoxStats(winValues, "胜", "#10b981"),
    getBoxStats(lossValues, "负", "#f43f5e"),
  ].filter((v): v is BoxStats => v !== null);

  if (groups.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-[#2a2d3a] bg-[#1a1d28] text-sm text-[#64748b]">
        当前筛选无胜负分组数据
      </div>
    );
  }

  const allValues = groups.flatMap((g) => g.values);
  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 0);
  const span = Math.max(1, rawMax - rawMin);
  const domainMin = rawMin - span * 0.08;
  const domainMax = rawMax + span * 0.08;
  const ticks = niceTicks(domainMin, domainMax);
  const tickMin = Math.min(...ticks);
  const tickMax = Math.max(...ticks);
  const plotWidth = SVG_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = SVG_HEIGHT - PLOT.top - PLOT.bottom;
  const x = (value: number) => PLOT.left + ((value - tickMin) / (tickMax - tickMin || 1)) * plotWidth;
  const yByLabel: Record<"胜" | "负", number> = {
    胜: PLOT.top + plotHeight * 0.28,
    负: PLOT.top + plotHeight * 0.72,
  };
  const boxHeight = 34;
  const capHeight = 24;

  return (
    <div className="min-h-[320px] w-full rounded-lg border border-[#2a2d3a] bg-[#0f1117]">
      <svg
        className="h-[320px] w-full"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label={`${label} 胜负箱线图`}
      >
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#0f1117" />
        {ticks.map((tick) => {
          const tickX = x(tick);
          return (
            <g key={tick}>
              <line
                x1={tickX}
                y1={PLOT.top}
                x2={tickX}
                y2={SVG_HEIGHT - PLOT.bottom}
                stroke={tick === 0 ? "#4a5568" : "#2a2d3a"}
                strokeDasharray={tick === 0 ? "4 4" : "3 3"}
              />
              <text
                x={tickX}
                y={SVG_HEIGHT - PLOT.bottom + 24}
                fill="#94a3b8"
                fontSize={11}
                textAnchor="middle"
                className="tabular-nums"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {(["胜", "负"] as const).map((groupLabel) => (
          <g key={groupLabel}>
            <line
              x1={PLOT.left}
              y1={yByLabel[groupLabel]}
              x2={SVG_WIDTH - PLOT.right}
              y2={yByLabel[groupLabel]}
              stroke="#2a2d3a"
              strokeDasharray="3 3"
            />
            <text
              x={PLOT.left - 26}
              y={yByLabel[groupLabel] + 4}
              fill="#94a3b8"
              fontSize={13}
              textAnchor="middle"
            >
              {groupLabel}
            </text>
          </g>
        ))}

        {groups.map((group) => {
          const y = yByLabel[group.label];
          const q1X = x(group.q1);
          const q3X = x(group.q3);
          const medianX = x(group.median);
          const lowX = x(group.whiskerLow);
          const highX = x(group.whiskerHigh);
          return (
            <g key={group.label}>
              <title>
                {`${group.label}｜样本 ${group.values.length}｜最小 ${formatSigned(group.min)}｜Q1 ${formatSigned(group.q1)}｜中位数 ${formatSigned(group.median)}｜Q3 ${formatSigned(group.q3)}｜最大 ${formatSigned(group.max)}`}
              </title>
              <line x1={lowX} y1={y} x2={highX} y2={y} stroke={group.color} strokeWidth={2} />
              <line x1={lowX} y1={y - capHeight / 2} x2={lowX} y2={y + capHeight / 2} stroke={group.color} strokeWidth={2} />
              <line x1={highX} y1={y - capHeight / 2} x2={highX} y2={y + capHeight / 2} stroke={group.color} strokeWidth={2} />
              <rect
                x={Math.min(q1X, q3X)}
                y={y - boxHeight / 2}
                width={Math.max(2, Math.abs(q3X - q1X))}
                height={boxHeight}
                fill={group.color}
                fillOpacity={0.18}
                stroke={group.color}
                strokeWidth={2}
                rx={4}
              />
              <line x1={medianX} y1={y - boxHeight / 2} x2={medianX} y2={y + boxHeight / 2} stroke="#e2e8f0" strokeWidth={2} />
              {group.outliers.map((value, index) => (
                <circle
                  key={`${value}-${index}`}
                  cx={x(value)}
                  cy={y}
                  r={3}
                  fill={group.color}
                  fillOpacity={0.8}
                />
              ))}
              <text
                x={SVG_WIDTH - PLOT.right}
                y={y - boxHeight / 2 - 10}
                fill="#64748b"
                fontSize={11}
                textAnchor="end"
              >
                {`n=${group.values.length} 中位数 ${formatSigned(group.median)}`}
              </text>
            </g>
          );
        })}

        <line
          x1={PLOT.left}
          y1={SVG_HEIGHT - PLOT.bottom}
          x2={SVG_WIDTH - PLOT.right}
          y2={SVG_HEIGHT - PLOT.bottom}
          stroke="#2a2d3a"
        />
        <text
          x={PLOT.left + plotWidth / 2}
          y={SVG_HEIGHT - 18}
          fill="#64748b"
          fontSize={12}
          textAnchor="middle"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
