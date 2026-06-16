"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import {
  type DetailRow,
  type EconomySelection,
  type SummaryRow,
  getEconomyDiff,
} from "@/lib/data";

interface WinRateCurveChartProps {
  summaryData: SummaryRow[];
  detailData: DetailRow[];
  economy: EconomySelection;
}

interface CurveDatum {
  bucket: string;
  avgDiff: number;
  sampleCount: number;
  wins: number;
  winRate: number;
  logisticWinRate: number;
}

interface ThresholdHit {
  rate: number;
  bucket: string;
  avgDiff: number;
  logisticWinRate: number;
}

interface DotProps {
  cx?: number;
  cy?: number;
  payload?: CurveDatum;
}

const chartConfig = {
  sampleCount: { label: "样本数", color: "#334155" },
  logisticWinRate: { label: "Logistic 预测胜率", color: "#22d3ee" },
} satisfies ChartConfig;

const TARGET_RATES = [40, 50, 60, 70];

function formatDiff(value: number): string {
  const rounded = Math.round(value);
  return rounded > 0 ? `+${rounded}` : String(rounded);
}

interface LogisticModel {
  intercept: number;
  slope: number;
}

function sigmoid(value: number): number {
  if (value >= 35) return 1;
  if (value <= -35) return 0;
  return 1 / (1 + Math.exp(-value));
}

function logit(probability: number): number {
  return Math.log(probability / (1 - probability));
}

function buildBaseData(data: SummaryRow[]): CurveDatum[] {
  return data.map((row) => ({
    bucket: row.bucket,
    avgDiff: row.avgDiff,
    sampleCount: row.sampleCount,
    wins: row.wins,
    winRate: Number((row.winRate * 100).toFixed(1)),
    logisticWinRate: 0,
  }));
}

function fitLogisticFromPoints(
  rows: DetailRow[],
  economy: EconomySelection
): LogisticModel | null {
  const usableRows = rows
    .map((row) => ({
      x: getEconomyDiff(row, economy) / 1000,
      y: row.win,
    }))
    .filter((row) => Number.isFinite(row.x) && (row.y === 0 || row.y === 1));
  const totalSamples = usableRows.length;
  const totalWins = usableRows.reduce((sum, row) => sum + row.y, 0);

  if (
    totalSamples < 2 ||
    totalSamples === 0 ||
    totalWins === 0 ||
    totalWins === totalSamples
  ) {
    return null;
  }

  let intercept = logit(Math.min(0.99, Math.max(0.01, totalWins / totalSamples)));
  let slope = 0;

  for (let iter = 0; iter < 50; iter += 1) {
    let score0 = 0;
    let score1 = 0;
    let info00 = 1e-6;
    let info01 = 0;
    let info11 = 1e-6;

    for (const row of usableRows) {
      const x = row.x;
      const p = Math.min(0.999999, Math.max(0.000001, sigmoid(intercept + slope * x)));
      const residual = row.y - p;
      const weight = p * (1 - p);

      score0 += residual;
      score1 += residual * x;
      info00 += weight;
      info01 += weight * x;
      info11 += weight * x * x;
    }

    const determinant = info00 * info11 - info01 * info01;
    if (Math.abs(determinant) < 1e-12) break;

    const delta0 = (info11 * score0 - info01 * score1) / determinant;
    const delta1 = (-info01 * score0 + info00 * score1) / determinant;
    intercept += delta0;
    slope += delta1;

    if (Math.abs(delta0) + Math.abs(delta1) < 1e-7) break;
  }

  return { intercept, slope };
}

function applyLogisticPrediction(rows: CurveDatum[], model: LogisticModel | null): CurveDatum[] {
  return rows.map((row) => ({
    ...row,
    logisticWinRate: model
      ? Number((sigmoid(model.intercept + model.slope * (row.avgDiff / 1000)) * 100).toFixed(1))
      : row.winRate,
  }));
}

function findThresholdHits(rows: CurveDatum[], model: LogisticModel | null): ThresholdHit[] {
  if (!model || Math.abs(model.slope) < 1e-8 || rows.length === 0) return [];
  const minDiff = Math.min(...rows.map((row) => row.avgDiff));
  const maxDiff = Math.max(...rows.map((row) => row.avgDiff));

  return TARGET_RATES.flatMap((rate) => {
    const targetProbability = rate / 100;
    const avgDiff = ((logit(targetProbability) - model.intercept) / model.slope) * 1000;
    if (!Number.isFinite(avgDiff) || avgDiff < minDiff || avgDiff > maxDiff) return [];
    const hit = rows.reduce((closest, row) =>
      Math.abs(row.avgDiff - avgDiff) < Math.abs(closest.avgDiff - avgDiff) ? row : closest
    , rows[0]);
    return [{
      rate,
      bucket: hit.bucket,
      avgDiff,
      logisticWinRate: rate,
    }];
  });
}

function CurveTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurveDatum }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#2a2d3a] bg-[#1a1d28] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-[#e2e8f0]">{row.bucket}</p>
      <p className="text-[#94a3b8]">
        样本：<span className="font-mono tabular-nums text-[#e2e8f0]">{row.sampleCount}</span>
      </p>
      <p className="text-[#94a3b8]">
        胜场：<span className="font-mono tabular-nums text-[#10b981]">{row.wins}</span>
      </p>
      <p className="text-[#94a3b8]">
        原始胜率：<span className="font-mono tabular-nums text-[#22d3ee]">{row.winRate}%</span>
      </p>
      <p className="text-[#94a3b8]">
        Logistic：<span className="font-mono tabular-nums text-[#22d3ee]">{row.logisticWinRate}%</span>
      </p>
    </div>
  );
}

export function WinRateCurveChart({ summaryData, detailData, economy }: WinRateCurveChartProps) {
  if (summaryData.length === 0 || detailData.length === 0) {
    return (
      <div className="flex min-h-[230px] w-full items-center justify-center rounded-lg border border-[#2a2d3a] bg-[#1a1d28] text-sm text-[#64748b]">
        当前筛选无数据
      </div>
    );
  }

  const baseData = buildBaseData(summaryData);
  const logisticModel = fitLogisticFromPoints(detailData, economy);
  const chartData = applyLogisticPrediction(baseData, logisticModel);
  const thresholdHits = findThresholdHits(chartData, logisticModel);
  const thresholdByBucket = new Map<string, number[]>();
  for (const hit of thresholdHits) {
    thresholdByBucket.set(hit.bucket, [...(thresholdByBucket.get(hit.bucket) ?? []), hit.rate]);
  }
  const maxSampleCount = Math.max(1, ...chartData.map((row) => row.sampleCount));

  const renderWinRateDot = ({ cx, cy, payload }: DotProps) => {
    if (cx === undefined || cy === undefined || !payload) return <g />;
    const hitRates = thresholdByBucket.get(payload.bucket);
    if (!hitRates) {
      return <circle key={`logistic-dot-${payload.bucket}`} cx={cx} cy={cy} r={2.5} fill="#22d3ee" />;
    }
    return (
      <g key={`logistic-threshold-dot-${payload.bucket}`}>
        <circle cx={cx} cy={cy} r={5} fill="#ef4444" stroke="#0f1117" strokeWidth={2} />
        <text x={cx} y={cy - 9} fill="#ef4444" fontSize={10} textAnchor="middle">
          {hitRates.join("/")}%
        </text>
      </g>
    );
  };

  return (
    <div className="rounded-lg border border-[#2a2d3a] bg-[#0f1117] px-3 pt-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-[#e2e8f0]">经济差胜率曲线</p>
          <p className="text-[10px] text-[#64748b]">
            灰柱=样本数，青线=Logistic 回归预测胜率
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {TARGET_RATES.map((rate) => {
            const hit = thresholdHits.find((item) => item.rate === rate);
            return (
              <span
                key={`threshold-card-${rate}`}
                className="rounded-md border border-[#2a2d3a] bg-[#1a1d28] px-1.5 py-0.5 text-[#94a3b8]"
              >
                {rate}%：{hit ? `约 ${formatDiff(hit.avgDiff)}` : "未达到"}
              </span>
            );
          })}
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-[610px] w-full">
        <ComposedChart data={chartData} margin={{ top: 26, right: 18, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2d3a" vertical={false} />
          <XAxis
            dataKey="bucket"
            tick={{ fill: "#94a3b8", fontSize: 9 }}
            axisLine={{ stroke: "#2a2d3a" }}
            tickLine={false}
            angle={-30}
            textAnchor="end"
            interval={chartData.length > 12 ? 2 : 1}
            height={42}
          />
          <YAxis
            yAxisId="rate"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={{ stroke: "#2a2d3a" }}
            tickLine={false}
            tickFormatter={(value: number) => `${value}%`}
          />
          <YAxis
            yAxisId="count"
            orientation="right"
            domain={[0, Math.ceil(maxSampleCount * 1.2)]}
            tick={{ fill: "#64748b", fontSize: 10 }}
            axisLine={{ stroke: "#2a2d3a" }}
            tickLine={false}
          />
          {TARGET_RATES.map((rate) => (
            <ReferenceLine
              key={`target-rate-line-${rate}`}
              yAxisId="rate"
              y={rate}
              stroke={rate === 50 ? "#64748b" : "#475569"}
              strokeDasharray="4 4"
            />
          ))}
          {thresholdHits.map((hit) => (
            <ReferenceLine
              key={`threshold-hit-line-${hit.rate}`}
              x={hit.bucket}
              yAxisId="rate"
              stroke="#22d3ee"
              strokeOpacity={0.55}
              strokeDasharray="3 3"
              label={{
                value: `${hit.rate}%≈${formatDiff(hit.avgDiff)}`,
                fill: "#22d3ee",
                fontSize: 9,
                position: "top",
              }}
            />
          ))}
          <Tooltip content={<CurveTooltip />} />
          <Bar
            yAxisId="count"
            dataKey="sampleCount"
            fill="#334155"
            fillOpacity={0.58}
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="rate"
            type="monotone"
            dataKey="logisticWinRate"
            stroke="#22d3ee"
            strokeWidth={2}
            dot={renderWinRateDot}
            activeDot={{ r: 4, fill: "#22d3ee", stroke: "#0f1117", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ChartContainer>
    </div>
  );
}
