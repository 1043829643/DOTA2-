"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface StatsCardsProps {
  totalMatches: number;
  totalRows: number;
  teamWinRate: number | null;
  selectedTeam: string;
  avgEconomyDiff: number;
  winRateWhenAhead: number;
  winRateWhenBehind: number;
  economyThreshold: number;
  aheadWins: number;
  behindWins: number;
  aheadCount: number;
  behindCount: number;
  onEconomyThresholdChange: (v: number) => void;
}

export function StatsCards({
  totalMatches,
  totalRows,
  teamWinRate,
  selectedTeam,
  avgEconomyDiff,
  winRateWhenAhead,
  winRateWhenBehind,
  economyThreshold,
  aheadWins,
  behindWins,
  aheadCount,
  behindCount,
  onEconomyThresholdChange,
}: StatsCardsProps) {
  const diffDisplay = avgEconomyDiff > 0 ? `+${avgEconomyDiff.toFixed(0)}` : avgEconomyDiff.toFixed(0);
  const winRateLabel = selectedTeam !== "all" ? `${selectedTeam} 胜率` : "队伍胜率";

  // Local string state for controlled input
  const [thresholdText, setThresholdText] = useState(String(economyThreshold));

  useEffect(() => {
    setThresholdText(String(economyThreshold));
  }, [economyThreshold]);

  const commitThreshold = () => {
    const parsed = parseInt(thresholdText, 10);
    onEconomyThresholdChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 总场次 */}
      <Card className="border-[#2a2d3a] bg-[#1a1d28] shadow-none hover:border-[#3a3f52] transition-colors">
        <CardContent className="p-4">
          <p className="text-xs text-[#64748b] mb-1">总场次</p>
          <p className="text-xl font-semibold font-mono tabular-nums text-[#22d3ee]">
            {totalMatches}
          </p>
          <p className="text-[10px] text-[#4a5568] mt-0.5">{totalRows} 条记录</p>
        </CardContent>
      </Card>

      {/* 队伍胜率（需筛选具体队伍） */}
      <Card className="border-[#2a2d3a] bg-[#1a1d28] shadow-none hover:border-[#3a3f52] transition-colors">
        <CardContent className="p-4">
          <p className="text-xs text-[#64748b] mb-1">{winRateLabel}</p>
          {teamWinRate !== null ? (
            <p className="text-xl font-semibold font-mono tabular-nums text-[#e2e8f0]">
              {(teamWinRate * 100).toFixed(1)}%
            </p>
          ) : (
            <>
              <p className="text-xl font-semibold font-mono tabular-nums text-[#4a5568]">—</p>
              <p className="text-[10px] text-[#4a5568] mt-0.5">选择队伍后显示</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 平均经济差 */}
      <Card className="border-[#2a2d3a] bg-[#1a1d28] shadow-none hover:border-[#3a3f52] transition-colors">
        <CardContent className="p-4">
          <p className="text-xs text-[#64748b] mb-1">平均经济差</p>
          <p className={`text-xl font-semibold font-mono tabular-nums ${avgEconomyDiff >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}>
            {diffDisplay}
          </p>
        </CardContent>
      </Card>

      {/* 领先时胜率 */}
      <Card className="border-[#2a2d3a] bg-[#1a1d28] shadow-none hover:border-[#10b981]/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[#64748b]">
              领先时胜率
              <span className="text-[#4a5568] ml-1">({aheadWins}场胜利 / {aheadCount}场领先)</span>
            </p>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-[#10b981]">
            {(winRateWhenAhead * 100).toFixed(1)}%
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-[#4a5568] whitespace-nowrap">经济差 &gt;</span>
            <Input
              type="number"
              value={thresholdText}
              onChange={(e) => setThresholdText(e.target.value)}
              onBlur={commitThreshold}
              onKeyDown={(e) => { if (e.key === "Enter") commitThreshold(); }}
              className="h-5 w-16 text-[10px] bg-[#0f1117] border-[#2a2d3a] text-[#94a3b8] px-1.5 py-0 font-mono tabular-nums"
            />
          </div>
        </CardContent>
      </Card>

      {/* 落后时胜率 */}
      <Card className="border-[#2a2d3a] bg-[#1a1d28] shadow-none hover:border-[#f43f5e]/30 transition-colors">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs text-[#64748b]">
              落后时胜率
              <span className="text-[#4a5568] ml-1">({behindWins}场胜利 / {behindCount}场落后)</span>
            </p>
          </div>
          <p className="text-xl font-semibold font-mono tabular-nums text-[#f43f5e]">
            {(winRateWhenBehind * 100).toFixed(1)}%
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[10px] text-[#4a5568] whitespace-nowrap">经济差 &lt; -{economyThreshold}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
