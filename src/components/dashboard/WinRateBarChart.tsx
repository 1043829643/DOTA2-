"use client";

import { useState } from "react";
import { type SummaryRow } from "@/lib/data";

interface WinRateBarChartProps {
  data: SummaryRow[];
}

const SVG_WIDTH = 920;
const SVG_HEIGHT = 340;
const PLOT = {
  left: 58,
  right: 16,
  top: 24,
  bottom: 76,
};

interface TooltipState {
  x: number;
  y: number;
  bucket: string;
  wins: number;
  losses: number;
  sampleCount: number;
  winRate: number;
}

function niceTickStep(max: number): number {
  if (max <= 5) return 1;
  if (max <= 10) return 2;
  if (max <= 25) return 5;
  if (max <= 50) return 10;
  return 20;
}

export function WinRateBarChart({ data }: WinRateBarChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-[#2a2d3a] bg-[#1a1d28] text-sm text-[#64748b]">
        当前筛选无数据
      </div>
    );
  }

  const chartData = data.map((row) => ({
    bucket: row.bucket,
    sampleCount: row.sampleCount,
    wins: row.wins,
    losses: row.sampleCount - row.wins,
    winRate: Number((row.winRate * 100).toFixed(1)),
    avgDiff: row.avgDiff,
  }));
  const maxCount = Math.max(
    1,
    ...chartData.map((row) => Math.max(row.wins, row.losses))
  );
  const tickStep = niceTickStep(maxCount);
  const axisMax = Math.ceil(maxCount / tickStep) * tickStep;
  const plotWidth = SVG_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = SVG_HEIGHT - PLOT.top - PLOT.bottom;
  const zeroY = PLOT.top + plotHeight / 2;
  const barWidth = plotWidth / chartData.length;
  const yScale = (plotHeight / 2) / axisMax;
  const yTicks: number[] = [];
  for (let tick = -axisMax; tick <= axisMax; tick += tickStep) {
    yTicks.push(tick);
  }
  const y = (value: number) => zeroY - value * yScale;
  const maxWinRow = chartData.reduce((best, row) => (row.wins > best.wins ? row : best), chartData[0]);
  const maxLossRow = chartData.reduce((best, row) => (row.losses > best.losses ? row : best), chartData[0]);
  const labelInterval = chartData.length > 16 ? 2 : 1;

  return (
    <div className="relative min-h-[360px] w-full rounded-lg border border-[#2a2d3a] bg-[#0f1117] px-3 pt-3">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[#e2e8f0]">分档胜负场次</p>
          <p className="text-[11px] text-[#64748b]">
            绿色向上为胜场数，红色向下为负场数；柱高表示该经济差分档内的场次数量
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-[#94a3b8]">
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#10b981]" />
            胜场
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#f43f5e]" />
            负场
          </span>
        </div>
      </div>
      <svg
        className="h-[330px] w-full"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        role="img"
        aria-label="经济差分档胜负场次发散柱状图"
        onMouseLeave={() => setTooltip(null)}
      >
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="#0f1117" />

        {yTicks.map((tick) => {
          const tickY = y(tick);
          return (
            <g key={tick}>
              <line
                x1={PLOT.left}
                y1={tickY}
                x2={SVG_WIDTH - PLOT.right}
                y2={tickY}
                stroke={tick === 0 ? "#64748b" : "#2a2d3a"}
                strokeWidth={tick === 0 ? 1.5 : 1}
                strokeDasharray={tick === 0 ? undefined : "3 3"}
              />
              <text
                x={PLOT.left - 8}
                y={tickY + 4}
                fill="#94a3b8"
                fontSize={11}
                textAnchor="end"
                className="tabular-nums"
              >
                {Math.abs(tick)}
              </text>
            </g>
          );
        })}

        <text x={PLOT.left + 6} y={PLOT.top + 12} fill="#10b981" fontSize={11}>
          胜场 ↑
        </text>
        <text x={PLOT.left + 6} y={SVG_HEIGHT - PLOT.bottom - 8} fill="#f43f5e" fontSize={11}>
          负场 ↓
        </text>

        {chartData.map((row, index) => {
          const x = PLOT.left + index * barWidth;
          const winHeight = row.wins * yScale;
          const lossHeight = row.losses * yScale;
          const winY = zeroY - winHeight;
          const labelX = x + barWidth / 2;
          const showAxisLabel = index % labelInterval === 0 || index === chartData.length - 1;
          const isMaxWin = row.bucket === maxWinRow.bucket && row.wins > 0;
          const isMaxLoss = row.bucket === maxLossRow.bucket && row.losses > 0;
          const handlePointerMove = (event: React.PointerEvent<SVGRectElement>) => {
            const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
            if (!rect) return;
            setTooltip({
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              bucket: row.bucket,
              wins: row.wins,
              losses: row.losses,
              sampleCount: row.sampleCount,
              winRate: row.winRate,
            });
          };
          return (
            <g key={row.bucket}>
              {row.wins > 0 && (
                <rect
                  x={x}
                  y={winY}
                  width={barWidth}
                  height={Math.max(1, winHeight)}
                  fill="#10b981"
                  fillOpacity={0.88}
                  stroke="#0f1117"
                  strokeOpacity={0.3}
                  onPointerMove={handlePointerMove}
                />
              )}
              {row.losses > 0 && (
                <rect
                  x={x}
                  y={zeroY}
                  width={barWidth}
                  height={Math.max(1, lossHeight)}
                  fill="#f43f5e"
                  fillOpacity={0.88}
                  stroke="#0f1117"
                  strokeOpacity={0.3}
                  onPointerMove={handlePointerMove}
                />
              )}
              {isMaxWin && (
                <text x={labelX} y={winY - 6} fill="#10b981" fontSize={10} textAnchor="middle">
                  {row.wins}胜
                </text>
              )}
              {isMaxLoss && (
                <text x={labelX} y={zeroY + lossHeight + 14} fill="#f43f5e" fontSize={10} textAnchor="middle">
                  {row.losses}负
                </text>
              )}
              {showAxisLabel && (
                <text
                  x={labelX}
                  y={SVG_HEIGHT - PLOT.bottom + 18}
                  fill="#94a3b8"
                  fontSize={10}
                  textAnchor="end"
                  transform={`rotate(-45 ${labelX} ${SVG_HEIGHT - PLOT.bottom + 18})`}
                >
                  {row.bucket}
                </text>
              )}
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
      </svg>
      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-[#2a2d3a] bg-[#1a1d28] px-3 py-2 text-xs shadow-xl"
          style={{
            left: Math.min(tooltip.x + 18, SVG_WIDTH - 190),
            top: Math.max(tooltip.y + 44, 58),
          }}
        >
          <p className="mb-1 font-medium text-[#e2e8f0]">{tooltip.bucket}</p>
          <p className="text-[#94a3b8]">
            胜场：<span className="font-mono tabular-nums text-[#10b981]">{tooltip.wins}</span>
          </p>
          <p className="text-[#94a3b8]">
            负场：<span className="font-mono tabular-nums text-[#f43f5e]">{tooltip.losses}</span>
          </p>
          <p className="text-[#94a3b8]">
            样本：<span className="font-mono tabular-nums text-[#e2e8f0]">{tooltip.sampleCount}</span>
          </p>
          <p className="text-[#94a3b8]">
            胜率：<span className="font-mono tabular-nums text-[#22d3ee]">{tooltip.winRate}%</span>
          </p>
        </div>
      )}
    </div>
  );
}
