"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type DetailRow, type EconomyIndicator, INDICATOR_FIELD, INDICATOR_LABELS } from "@/lib/data";

interface EconomyScatterChartProps {
  data: DetailRow[];
  indicator: EconomyIndicator;
}

const chartConfig = {
  win: { label: "胜", color: "#10b981" },
  loss: { label: "负", color: "#f43f5e" },
} satisfies ChartConfig;

interface ScatterPoint {
  x: number;
  y: number;
  team: string;
  opponent: string;
  hero: string;
  side: string;
  result: string;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d28] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-[#e2e8f0]">
        {d.team} vs {d.opponent}
      </p>
      <p className="text-[#94a3b8]">
        英雄: <span className="text-[#e2e8f0]">{d.hero}</span>
      </p>
      <p className="text-[#94a3b8]">
        阵营: <span className="text-[#e2e8f0]">{d.side}</span>
      </p>
      <p className="text-[#94a3b8]">
        结果: <span className={d.result === "胜" ? "text-[#10b981]" : "text-[#f43f5e]"}>{d.result}</span>
      </p>
      <p className="text-[#94a3b8]">
        经济差: <span className="font-mono tabular-nums text-[#22d3ee]">{d.x > 0 ? "+" : ""}{d.x}</span>
      </p>
    </div>
  );
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

  const winPoints: ScatterPoint[] = [];
  const lossPoints: ScatterPoint[] = [];

  for (const row of data) {
    const point: ScatterPoint = {
      x: row[field] as number,
      y: row.win,
      team: row.team,
      opponent: row.opponent,
      hero: row.pos1_hero,
      side: row.side,
      result: row.result,
    };
    if (row.win === 1) {
      winPoints.push(point);
    } else {
      lossPoints.push(point);
    }
  }

  return (
    <ChartContainer config={chartConfig} className="min-h-[320px] w-full">
      <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" />
        <XAxis
          type="number"
          dataKey="x"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "#2a2d3a" }}
          tickLine={false}
          label={{ value: label, position: "insideBottom", offset: -16, fill: "#64748b", fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "#2a2d3a" }}
          tickLine={false}
          domain={[-0.2, 1.2]}
          ticks={[0, 1]}
          tickFormatter={(v: number) => (v === 0 ? "负" : v === 1 ? "胜" : "")}
        />
        <ZAxis range={[36, 36]} />
        <ReferenceLine x={0} stroke="#4a5568" strokeDasharray="4 4" />
        <Tooltip content={<CustomTooltip />} />
        <Scatter name="负" data={lossPoints} fill="#f43f5e" fillOpacity={0.7} />
        <Scatter name="胜" data={winPoints} fill="#10b981" fillOpacity={0.7} />
      </ScatterChart>
    </ChartContainer>
  );
}
