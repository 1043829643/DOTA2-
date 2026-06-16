"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type GameMinute, GAME_MINUTE_LABELS } from "@/lib/data";
import {
  type DiffGroup,
  type MatchPlayersRow,
  type Position,
  type PositionCondition,
  type Side,
  type SlotField,
  POSITIONS,
  SIDE_LABELS,
  applyConditions,
  buildDiffSummary,
  computeDiffs,
  getSlotOptions,
} from "@/lib/matchPlayers";
import { WinRateBarChart } from "@/components/dashboard/WinRateBarChart";

interface PositionEconomySectionProps {
  rows: MatchPlayersRow[];
}

const MINUTES: GameMinute[] = [6, 10];
const BUCKET_SIZES = [300, 500, 1000];
const SIDES: Side[] = ["radiant", "dire"];
const TABLE_LIMIT = 100;

const selectTriggerCls =
  "bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm";
const selectContentCls = "bg-[#1a1d28] border-[#2a2d3a]";
const selectItemCls = "text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]";

function posLabel(pos: Position): string {
  return `${pos}号位`;
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
            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
              active
                ? "border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]"
                : "border-[#2a2d3a] text-[#94a3b8] hover:border-[#4a5568] hover:text-[#e2e8f0]"
            }`}
          >
            {pos}
          </button>
        );
      })}
    </div>
  );
}

function GroupEditor({
  title,
  group,
  onChange,
}: {
  title: string;
  group: DiffGroup;
  onChange: (next: DiffGroup) => void;
}) {
  const toggle = (pos: Position) => {
    const has = group.positions.includes(pos);
    const positions = has
      ? group.positions.filter((p) => p !== pos)
      : [...group.positions, pos].sort((a, b) => a - b);
    onChange({ ...group, positions });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[#2a2d3a] bg-[#1a1d28] px-3 py-2">
      <span className="text-xs font-medium text-[#94a3b8]">{title}</span>
      <Select value={group.side} onValueChange={(v) => onChange({ ...group, side: v as Side })}>
        <SelectTrigger className={`w-[96px] ${selectTriggerCls}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent className={selectContentCls}>
          {SIDES.map((s) => (
            <SelectItem key={s} value={s} className={selectItemCls}>
              {SIDE_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <PositionToggles selected={group.positions} onToggle={toggle} />
    </div>
  );
}

export function PositionEconomySection({ rows }: PositionEconomySectionProps) {
  const [minute, setMinute] = useState<GameMinute>(10);
  const [bucketSize, setBucketSize] = useState<number>(300);
  const [left, setLeft] = useState<DiffGroup>({ side: "radiant", positions: [1] });
  const [right, setRight] = useState<DiffGroup>({ side: "dire", positions: [1] });
  const [conditions, setConditions] = useState<PositionCondition[]>([]);

  // Draft condition builder state
  const [draftSide, setDraftSide] = useState<Side>("radiant");
  const [draftPos, setDraftPos] = useState<Position>(1);
  const [draftField, setDraftField] = useState<SlotField>("hero");
  const [draftValue, setDraftValue] = useState<string>("");

  const draftOptions = useMemo(
    () => getSlotOptions(rows, draftSide, draftPos, draftField),
    [rows, draftSide, draftPos, draftField]
  );

  const filteredRows = useMemo(
    () => applyConditions(rows, conditions),
    [rows, conditions]
  );

  const diffResults = useMemo(
    () => computeDiffs(filteredRows, minute, left, right),
    [filteredRows, minute, left, right]
  );

  const summary = useMemo(
    () => buildDiffSummary(diffResults, bucketSize),
    [diffResults, bucketSize]
  );

  const known = diffResults.filter((d) => d.win !== null);
  const sampleCount = known.length;
  const avgDiff =
    sampleCount > 0
      ? Math.round(known.reduce((s, d) => s + d.diff, 0) / sampleCount)
      : 0;
  const aheadWins = known.filter((d) => d.diff > 0 && d.win === 1).length;
  const aheadCount = known.filter((d) => d.diff > 0).length;
  const behindWins = known.filter((d) => d.diff < 0 && d.win === 1).length;
  const behindCount = known.filter((d) => d.diff < 0).length;

  const addCondition = () => {
    if (!draftValue) return;
    setConditions((prev) => [
      ...prev,
      {
        id: `${draftSide}-${draftPos}-${draftField}-${draftValue}-${Date.now()}`,
        side: draftSide,
        pos: draftPos,
        field: draftField,
        value: draftValue,
      },
    ]);
    setDraftValue("");
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  const leftPosText = left.positions.length > 0 ? left.positions.map(posLabel).join("+") : "无";
  const rightPosText = right.positions.length > 0 ? right.positions.map(posLabel).join("+") : "无";
  const diffTitle = `${SIDE_LABELS[left.side]} ${leftPosText} − ${SIDE_LABELS[right.side]} ${rightPosText}`;

  const tableRows = diffResults.slice(0, TABLE_LIMIT);

  if (rows.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-[#2a2d3a] bg-[#1a1d28] p-6 text-center text-sm text-[#64748b]">
        <p className="mb-1 text-[#94a3b8]">全位置经济分析</p>
        未检测到全位置数据，请将 <span className="text-[#22d3ee]">match-players.csv</span> 放入 public/data/ 后刷新。
      </div>
    );
  }

  return (
    <section className="mt-6 rounded-lg border border-[#2a2d3a] bg-[#1a1d28] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-[#e2e8f0]">全位置经济分析</h2>
          <p className="text-xs text-[#94a3b8]">自由组合任意位置经济差与位置英雄/选手筛选</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(minute)} onValueChange={(v) => setMinute(Number(v) as GameMinute)}>
            <SelectTrigger className={`w-[110px] ${selectTriggerCls}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              {MINUTES.map((m) => (
                <SelectItem key={m} value={String(m)} className={selectItemCls}>
                  {GAME_MINUTE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(bucketSize)} onValueChange={(v) => setBucketSize(Number(v))}>
            <SelectTrigger className={`w-[120px] ${selectTriggerCls}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentCls}>
              {BUCKET_SIZES.map((b) => (
                <SelectItem key={b} value={String(b)} className={selectItemCls}>
                  分档 {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Economy diff builder */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <GroupEditor title="左组" group={left} onChange={setLeft} />
        <span className="text-sm text-[#64748b]">减去</span>
        <GroupEditor title="右组" group={right} onChange={setRight} />
      </div>

      {/* Position condition filter */}
      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
        <span className="pb-1.5 text-xs font-medium text-[#94a3b8]">位置筛选</span>
        <Select value={draftSide} onValueChange={(v) => setDraftSide(v as Side)}>
          <SelectTrigger className={`w-[96px] ${selectTriggerCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {SIDES.map((s) => (
              <SelectItem key={s} value={s} className={selectItemCls}>
                {SIDE_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(draftPos)} onValueChange={(v) => setDraftPos(Number(v) as Position)}>
          <SelectTrigger className={`w-[96px] ${selectTriggerCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {POSITIONS.map((p) => (
              <SelectItem key={p} value={String(p)} className={selectItemCls}>
                {posLabel(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={draftField}
          onValueChange={(v) => {
            setDraftField(v as SlotField);
            setDraftValue("");
          }}
        >
          <SelectTrigger className={`w-[96px] ${selectTriggerCls}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            <SelectItem value="hero" className={selectItemCls}>英雄</SelectItem>
            <SelectItem value="player" className={selectItemCls}>选手</SelectItem>
          </SelectContent>
        </Select>
        <Select value={draftValue} onValueChange={setDraftValue}>
          <SelectTrigger className={`w-[180px] ${selectTriggerCls}`}>
            <SelectValue placeholder={draftField === "hero" ? "选择英雄" : "选择选手"} />
          </SelectTrigger>
          <SelectContent className={selectContentCls}>
            {draftOptions.map((o) => (
              <SelectItem key={o} value={o} className={selectItemCls}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          onClick={addCondition}
          disabled={!draftValue}
          className="rounded-md border border-[#2a2d3a] px-3 py-1.5 text-xs text-[#94a3b8] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#2a2d3a] disabled:hover:text-[#94a3b8]"
        >
          添加条件
        </button>
      </div>

      {conditions.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {conditions.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1.5 rounded-full border border-[#2a2d3a] bg-[#0f1117] px-2.5 py-1 text-xs text-[#e2e8f0]"
            >
              {SIDE_LABELS[c.side]} {posLabel(c.pos)} {c.field === "hero" ? "英雄" : "选手"} = {c.value}
              <button
                type="button"
                onClick={() => removeCondition(c.id)}
                className="text-[#64748b] transition-colors hover:text-[#f43f5e]"
                aria-label="移除条件"
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setConditions([])}
            className="text-[10px] text-[#4a5568] transition-colors hover:text-[#f43f5e]"
          >
            清空全部
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
          <p className="text-xs text-[#64748b]">样本场数</p>
          <p className="font-mono text-lg tabular-nums text-[#e2e8f0]">{sampleCount}</p>
        </div>
        <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
          <p className="text-xs text-[#64748b]">平均经济差</p>
          <p className={`font-mono text-lg tabular-nums ${avgDiff >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}>
            {avgDiff > 0 ? "+" : ""}
            {avgDiff}
          </p>
        </div>
        <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
          <p className="text-xs text-[#64748b]">领先时胜率</p>
          <p className="font-mono text-lg tabular-nums text-[#10b981]">
            {aheadCount > 0 ? `${((aheadWins / aheadCount) * 100).toFixed(1)}%` : "-"}
            <span className="ml-1 text-xs text-[#64748b]">({aheadWins}/{aheadCount})</span>
          </p>
        </div>
        <div className="rounded-md border border-[#2a2d3a] bg-[#0f1117] px-3 py-2">
          <p className="text-xs text-[#64748b]">落后时胜率</p>
          <p className="font-mono text-lg tabular-nums text-[#f43f5e]">
            {behindCount > 0 ? `${((behindWins / behindCount) * 100).toFixed(1)}%` : "-"}
            <span className="ml-1 text-xs text-[#64748b]">({behindWins}/{behindCount})</span>
          </p>
        </div>
      </div>

      <p className="mb-2 text-xs text-[#94a3b8]">
        经济差定义：<span className="text-[#e2e8f0]">{diffTitle}</span>（胜率取左组阵营视角）
      </p>

      <div className="mb-4">
        <WinRateBarChart data={summary} />
      </div>

      {/* Detail table */}
      <div className="rounded-lg border border-[#2a2d3a]">
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#2a2d3a] hover:bg-transparent">
                <TableHead className="text-[#94a3b8]">对阵</TableHead>
                <TableHead className="text-right text-[#94a3b8] font-mono">左组经济</TableHead>
                <TableHead className="text-right text-[#94a3b8] font-mono">右组经济</TableHead>
                <TableHead className="text-right text-[#94a3b8] font-mono">经济差</TableHead>
                <TableHead className="text-[#94a3b8]">结果(左组)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows.map((d) => (
                <TableRow key={d.row.match_id} className="border-[#2a2d3a] hover:bg-[#1e2230]">
                  <TableCell className="text-[#e2e8f0]">
                    {(d.row.radiant_team || "天辉")} <span className="text-[#64748b]">vs</span>{" "}
                    {(d.row.dire_team || "夜魇")}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">{d.leftSum}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">{d.rightSum}</TableCell>
                  <TableCell className={`text-right font-mono tabular-nums ${d.diff >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}>
                    {d.diff > 0 ? "+" : ""}
                    {d.diff}
                  </TableCell>
                  <TableCell>
                    {d.win === null ? (
                      <span className="text-[#64748b]">未知</span>
                    ) : (
                      <span className={d.win === 1 ? "font-medium text-[#10b981]" : "font-medium text-[#f43f5e]"}>
                        {d.win === 1 ? "胜" : "负"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t border-[#2a2d3a] px-3 py-2 text-xs text-[#64748b]">
          共 {diffResults.length} 场{diffResults.length > TABLE_LIMIT ? `（仅显示前 ${TABLE_LIMIT} 场）` : ""}
        </div>
      </div>
    </section>
  );
}
