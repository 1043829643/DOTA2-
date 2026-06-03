"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { type SummaryRow } from "@/lib/data";

interface WinRateBarChartProps {
  data: SummaryRow[];
}

const chartConfig = {
  winRate: { label: "胜率", color: "#22d3ee" },
  sampleCount: { label: "样本数", color: "#94a3b8" },
} satisfies ChartConfig;

function getBarColor(winRate: number): string {
  if (winRate >= 0.7) return "#10b981";
  if (winRate >= 0.5) return "#22d3ee";
  if (winRate >= 0.3) return "#f59e0b";
  return "#f43f5e";
}

export function WinRateBarChart({ data }: WinRateBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex min-h-[320px] w-full items-center justify-center rounded-lg border border-[#2a2d3a] bg-[#1a1d28] text-sm text-[#64748b]">
        当前筛选无数据
      </div>
    );
  }

  const chartData = data.map((row) => ({
    bucket: row.bucket,
    winRate: Number((row.winRate * 100).toFixed(1)),
    sampleCount: row.sampleCount,
    wins: row.wins,
    avgDiff: row.avgDiff,
  }));

  return (
    <ChartContainer config={chartConfig} className="min-h-[320px] w-full">
      <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 32, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
        <XAxis
          dataKey="bucket"
          tick={{ fill: "#94a3b8", fontSize: 10 }}
          axisLine={{ stroke: "#2a2d3a" }}
          tickLine={false}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={56}
        />
        <YAxis
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          axisLine={{ stroke: "#2a2d3a" }}
          tickLine={false}
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ReferenceLine y={50} stroke="#4a5568" strokeDasharray="4 4" label={{ value: "50%", fill: "#64748b", fontSize: 10, position: "left" }} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => {
                if (name === "winRate") return [`${value}%`, "胜率"];
                return [value, name];
              }}
            />
          }
        />
        <Bar dataKey="winRate" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={getBarColor(entry.winRate / 100)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
