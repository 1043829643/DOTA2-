"use client";

import { useMemo, useRef, useState } from "react";
import { type DetailRow, type GameMinute, type Position } from "@/lib/data";
import { fitLogistic, normalTwoSidedP, predictProbability } from "@/lib/logit";

interface WinRatePredictorProps {
  rows: DetailRow[];
  gameMinute: GameMinute;
}

interface Matchup {
  id: number;
  ownPositions: Position[];
  enemyPositions: Position[];
}

const POSITIONS: Position[] = [1, 2, 3, 4, 5];
const MAX_VARIABLES = 6;
const SLIDER_STEP = 50;

function groupLabel(positions: Position[]): string {
  if (positions.length === 0) return "—";
  return `${[...positions].sort((a, b) => a - b).join("+")}号位`;
}

function matchupLabel(m: Matchup): string {
  return `本方${groupLabel(m.ownPositions)} - 对方${groupLabel(m.enemyPositions)}`;
}

function significance(p: number): string {
  if (!Number.isFinite(p)) return "";
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}

function togglePosition(positions: Position[], pos: Position): Position[] {
  return positions.includes(pos)
    ? positions.filter((p) => p !== pos)
    : [...positions, pos].sort((a, b) => a - b);
}

function featureOf(row: DetailRow, m: Matchup): number {
  const own = m.ownPositions.reduce((sum, p) => sum + (row.ownNetworth[p - 1] ?? 0), 0);
  const enemy = m.enemyPositions.reduce((sum, p) => sum + (row.enemyNetworth[p - 1] ?? 0), 0);
  return own - enemy;
}

function PositionToggles({
  selected,
  onToggle,
}: {
  selected: Position[];
  onToggle: (pos: Position) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {POSITIONS.map((pos) => {
        const active = selected.includes(pos);
        return (
          <button
            key={pos}
            type="button"
            onClick={() => onToggle(pos)}
            className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
              active
                ? "bg-[#22d3ee]/15 text-[#22d3ee]"
                : "text-[#94a3b8] hover:text-[#e2e8f0]"
            }`}
          >
            {pos}
          </button>
        );
      })}
    </div>
  );
}

export function WinRatePredictor({ rows, gameMinute }: WinRatePredictorProps) {
  const idRef = useRef(3);
  const [matchups, setMatchups] = useState<Matchup[]>([
    { id: 1, ownPositions: [1], enemyPositions: [3] },
    { id: 2, ownPositions: [2], enemyPositions: [2] },
  ]);
  const [values, setValues] = useState<Record<number, number>>({ 1: 0, 2: 0 });

  const usableRows = useMemo(
    () => rows.filter((r) => r.ownNetworth.length === 5 && r.enemyNetworth.length === 5),
    [rows]
  );

  // only variables that select at least one position on either side are estimable
  const activeMatchups = useMemo(
    () => matchups.filter((m) => m.ownPositions.length > 0 || m.enemyPositions.length > 0),
    [matchups]
  );

  const { fit, bounds } = useMemo(() => {
    if (usableRows.length === 0 || activeMatchups.length === 0) {
      return { fit: null, bounds: [] as number[] };
    }
    const x: number[][] = [];
    const y: number[] = [];
    const maxAbs = new Array<number>(activeMatchups.length).fill(0);
    for (const row of usableRows) {
      const features = activeMatchups.map((m) => featureOf(row, m));
      features.forEach((value, index) => {
        maxAbs[index] = Math.max(maxAbs[index], Math.abs(value));
      });
      x.push(features);
      y.push(row.win === 1 ? 1 : 0);
    }
    const computedBounds = maxAbs.map((value) => Math.max(1000, Math.ceil(value / 500) * 500));
    return { fit: fitLogistic(x, y), bounds: computedBounds };
  }, [usableRows, activeMatchups]);

  const predicted = useMemo(() => {
    if (!fit) return null;
    const inputs = activeMatchups.map((m) => values[m.id] ?? 0);
    return predictProbability(fit.beta, inputs);
  }, [fit, activeMatchups, values]);

  function toggleOwn(id: number, pos: Position) {
    setMatchups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ownPositions: togglePosition(m.ownPositions, pos) } : m))
    );
  }

  function toggleEnemy(id: number, pos: Position) {
    setMatchups((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enemyPositions: togglePosition(m.enemyPositions, pos) } : m))
    );
  }

  function addMatchup() {
    if (matchups.length >= MAX_VARIABLES) return;
    const id = idRef.current;
    idRef.current += 1;
    setMatchups((prev) => [...prev, { id, ownPositions: [1], enemyPositions: [1] }]);
    setValues((prev) => ({ ...prev, [id]: 0 }));
  }

  function removeMatchup(id: number) {
    setMatchups((prev) => prev.filter((m) => m.id !== id));
  }

  function resetValues() {
    setValues(() => {
      const next: Record<number, number> = {};
      for (const m of matchups) next[m.id] = 0;
      return next;
    });
  }

  return (
    <section className="mt-6 rounded-lg border border-[#2a2d3a] bg-[#1a1d28] p-4">
      <div className="mb-3">
        <h2 className="text-lg font-bold text-[#e2e8f0]">胜率预测器（自选对位 Logistic 回归）</h2>
        <p className="text-xs text-[#94a3b8]">
          每个变量可选多个位置相加再相减（本方位置之和 − 对方位置之和）；模型基于当前筛选的 {gameMinute} 分钟数据实时拟合，拖动滑块即可预测胜率
        </p>
      </div>

      {/* Variable selectors */}
      <div className="mb-3 space-y-2">
        {matchups.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-[#2a2d3a] bg-[#0f1117] px-2 py-1.5"
          >
            <span className="text-xs text-[#94a3b8]">本方</span>
            <PositionToggles selected={m.ownPositions} onToggle={(pos) => toggleOwn(m.id, pos)} />
            <span className="px-1 text-sm text-[#64748b]">减</span>
            <span className="text-xs text-[#94a3b8]">对方</span>
            <PositionToggles selected={m.enemyPositions} onToggle={(pos) => toggleEnemy(m.id, pos)} />
            <span className="ml-auto text-xs text-[#64748b]">{matchupLabel(m)}</span>
            <button
              type="button"
              onClick={() => removeMatchup(m.id)}
              disabled={matchups.length <= 1}
              className="rounded-md border border-[#2a2d3a] px-2 py-1 text-xs text-[#94a3b8] transition-colors hover:border-[#f43f5e] hover:text-[#f43f5e] disabled:cursor-not-allowed disabled:opacity-40"
            >
              移除
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addMatchup}
          disabled={matchups.length >= MAX_VARIABLES}
          className="rounded-md border border-[#2a2d3a] px-3 py-1.5 text-xs text-[#94a3b8] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-40"
        >
          + 添加变量
        </button>
      </div>

      {!fit ? (
        <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-4 text-center text-sm text-[#64748b]">
          {usableRows.length === 0
            ? "当前数据缺少位置经济，无法拟合（请使用内置默认数据）。"
            : "当前筛选样本不足、因变量单一或未选择任何位置，无法拟合模型。"}
        </div>
      ) : (
        <>
          {/* Model report */}
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="样本数" value={String(fit.sampleCount)} />
            <Stat label="胜率基线" value={`${(fit.positiveRate * 100).toFixed(1)}%`} />
            <Stat label="AUC" value={Number.isFinite(fit.auc) ? fit.auc.toFixed(3) : "-"} />
            <Stat label="McFadden R²" value={Number.isFinite(fit.mcfaddenR2) ? fit.mcfaddenR2.toFixed(3) : "-"} />
          </div>

          <div className="mb-4 overflow-x-auto rounded-md border border-[#2a2d3a]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#2a2d3a] text-[#94a3b8]">
                  <th className="px-3 py-2 text-left font-medium">变量</th>
                  <th className="px-3 py-2 text-right font-medium font-mono">系数/千金</th>
                  <th className="px-3 py-2 text-right font-medium font-mono">p 值</th>
                  <th className="px-3 py-2 text-right font-medium font-mono">OR/千金</th>
                </tr>
              </thead>
              <tbody>
                <CoefRow
                  name="截距"
                  estimate={fit.beta[0]}
                  standardError={fit.standardErrors[0]}
                  perThousand={false}
                />
                {activeMatchups.map((m, index) => (
                  <CoefRow
                    key={m.id}
                    name={matchupLabel(m)}
                    estimate={fit.beta[index + 1]}
                    standardError={fit.standardErrors[index + 1]}
                    perThousand
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* What-if sliders */}
          <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium text-[#e2e8f0]">试算：拖动各变量经济差</span>
              <button
                type="button"
                onClick={resetValues}
                className="text-xs text-[#64748b] transition-colors hover:text-[#22d3ee]"
              >
                全部归零
              </button>
            </div>

            <div className="space-y-3">
              {activeMatchups.map((m, index) => {
                const bound = bounds[index] ?? 5000;
                const value = values[m.id] ?? 0;
                return (
                  <div key={m.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-[#94a3b8]">{matchupLabel(m)}</span>
                      <span
                        className={`font-mono tabular-nums ${
                          value >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"
                        }`}
                      >
                        {value > 0 ? "+" : ""}
                        {value}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-bound}
                      max={bound}
                      step={SLIDER_STEP}
                      value={value}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [m.id]: Number(e.target.value) }))
                      }
                      className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#2a2d3a] accent-[#22d3ee]"
                    />
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-end justify-between border-t border-[#2a2d3a] pt-3">
              <span className="text-sm text-[#94a3b8]">预测胜率</span>
              <span className="font-mono text-3xl font-bold tabular-nums text-[#22d3ee]">
                {predicted !== null ? `${(predicted * 100).toFixed(1)}%` : "-"}
              </span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
      <p className="text-xs text-[#64748b]">{label}</p>
      <p className="font-mono text-lg tabular-nums text-[#e2e8f0]">{value}</p>
    </div>
  );
}

function CoefRow({
  name,
  estimate,
  standardError,
  perThousand,
}: {
  name: string;
  estimate: number;
  standardError: number;
  perThousand: boolean;
}) {
  const scale = perThousand ? 1000 : 1;
  const z = standardError > 0 ? estimate / standardError : Number.NaN;
  const p = Number.isFinite(z) ? normalTwoSidedP(z) : Number.NaN;
  const scaled = estimate * scale;
  const oddsRatio = perThousand ? Math.exp(Math.max(-700, Math.min(700, scaled))) : Number.NaN;
  const pDisplay = !Number.isFinite(p)
    ? "-"
    : p >= 1e-4
      ? p.toFixed(4)
      : p > 0
        ? p.toExponential(2)
        : "<1e-300";
  return (
    <tr className="border-b border-[#2a2d3a] last:border-0 text-[#e2e8f0]">
      <td className="px-3 py-1.5 text-left">{name}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">{scaled.toFixed(3)}</td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
        {pDisplay}
        <span className="ml-1 text-[#22d3ee]">{significance(p)}</span>
      </td>
      <td className="px-3 py-1.5 text-right font-mono tabular-nums">
        {perThousand && Number.isFinite(oddsRatio) ? oddsRatio.toFixed(3) : "-"}
      </td>
    </tr>
  );
}
