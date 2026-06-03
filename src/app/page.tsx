"use client";

import { useState, useMemo, useCallback } from "react";
import {
  type DetailRow,
  type LeagueOption,
  INDICATOR_FIELD,
  parseDetailCsv,
} from "@/lib/data";
import {
  type FilterState,
  DEFAULT_FILTER,
  filterDetailRows,
  computeSummaryFromDetail,
  computeTeamWinRate,
  filterAfterUpload,
  getUniqueTeams,
  getUniqueHeroes,
} from "@/lib/dashboard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { WinRateBarChart } from "@/components/dashboard/WinRateBarChart";
import { EconomyScatterChart } from "@/components/dashboard/EconomyScatterChart";
import { DetailTable } from "@/components/dashboard/DetailTable";

export default function DashboardPage() {
  const [rows, setRows] = useState<DetailRow[]>([]);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Parse uploaded CSV
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);
      setParseError(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === "string") {
          try {
            const parsed = parseDetailCsv(text);
            if (parsed.length === 0) {
              setParseError("CSV 解析结果为空，请检查文件格式");
              return;
            }
            setRows(parsed);
            const leagueIds = [...new Set(parsed.map((r) => r.league_id))];
            setFilter(filterAfterUpload(leagueIds));
          } catch (err) {
            setParseError(`解析失败: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      };
      reader.onerror = () => setParseError("文件读取失败");
      reader.readAsText(file, "utf-8");
    },
    []
  );

  // Derived data
  const leagues = useMemo<LeagueOption[]>(
    () =>
      [
        ...new Map(
          rows.map((r) => [r.league_id, { id: r.league_id, name: r.league_name }])
        ).values(),
      ],
    [rows]
  );

  const filtered = useMemo(
    () => filterDetailRows(rows, filter),
    [rows, filter]
  );

  const teams = useMemo(() => getUniqueTeams(filtered), [filtered]);
  const heroes = useMemo(() => getUniqueHeroes(filtered), [filtered]);

  const summaryData = useMemo(
    () => computeSummaryFromDetail(filtered, filter.indicator, filter.bucketSize),
    [filtered, filter.indicator, filter.bucketSize]
  );

  // Stats
  const totalRows = filtered.length;
  const uniqueMatches = useMemo(
    () => new Set(filtered.map((r) => `${r.league_id}-${r.match_id}`)).size,
    [filtered]
  );
  const teamWinRate = computeTeamWinRate(filtered, filter.team);

  const economyDiffField = INDICATOR_FIELD[filter.indicator];
  const avgEconomyDiff =
    totalRows > 0
      ? Math.round(
          filtered.reduce(
            (s, r) => s + (r[economyDiffField] as number),
            0
          ) / totalRows
        )
      : 0;

  const threshold = filter.economyThreshold;
  const ahead = filtered.filter(
    (r) => (r[economyDiffField] as number) > threshold
  );
  const behind = filtered.filter(
    (r) => (r[economyDiffField] as number) < -threshold
  );
  const aheadWins = ahead.filter((r) => r.win === 1).length;
  const behindWins = behind.filter((r) => r.win === 1).length;
  const aheadMatches = new Set(ahead.map((r) => `${r.league_id}-${r.match_id}`)).size;
  const behindMatches = new Set(behind.map((r) => `${r.league_id}-${r.match_id}`)).size;

  const leagueNames = leagues
    .filter((l) => filter.leagues.includes(l.id))
    .map((l) => l.name)
    .join(" + ");

  // No data state
  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
              10min Economy vs Win Rate
            </h1>
            <p className="text-[#94a3b8] text-sm">
              1号位经济差与胜率关系分析
            </p>
          </div>
          <label className="group flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-[#2a2d3a] rounded-lg cursor-pointer hover:border-[#22d3ee] transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg
                className="w-10 h-10 mb-3 text-[#4a5568] group-hover:text-[#22d3ee] transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p className="mb-1 text-sm text-[#94a3b8]">
                <span className="font-semibold text-[#22d3ee]">点击上传</span> CSV 文件
              </p>
              <p className="text-xs text-[#4a5568]">
                仅需上传明细表 (detail CSV)，汇总数据将自动计算
              </p>
              {fileName && (
                <p className="mt-2 text-xs text-[#10b981]">
                  已选择: {fileName}
                </p>
              )}
              {parseError && (
                <p className="mt-2 text-xs text-[#f43f5e]">
                  {parseError}
                </p>
              )}
            </div>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <div className="mt-4 p-3 rounded-lg bg-[#1a1d28] border border-[#2a2d3a]">
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              CSV 需包含以下列: league_id, league_name, match_id, team, opponent, side, result, win, pos1_player, pos1_hero, pos1_lh_5m, pos1_networth_10m, enemy_pos1_player, enemy_pos1_hero, enemy_pos1_networth_10m, pos1_vs_enemy_pos1_diff_10m, enemy_pos3_player, enemy_pos3_hero, enemy_pos3_networth_10m, pos1_vs_enemy_pos3_diff_10m, team_networth_10m, enemy_team_networth_10m, team_networth_diff_10m, pos1_kda_10m
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#e2e8f0]">
            {leagueNames
              ? `${leagueNames} 10min Economy vs Win Rate`
              : "10min Economy vs Win Rate"}
          </h1>
          <p className="text-sm text-[#94a3b8]">
            1号位经济差与胜率关系分析
          </p>
        </div>
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2d3a] hover:border-[#22d3ee] cursor-pointer transition-colors text-xs text-[#94a3b8] hover:text-[#22d3ee]">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          换文件
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>

      {/* Filter */}
      <FilterBar
        filter={filter}
        onFilterChange={setFilter}
        leagues={leagues}
        teams={teams}
        heroes={heroes}
      />

      {/* Stats Cards */}
      <StatsCards
        totalMatches={uniqueMatches}
        totalRows={totalRows}
        teamWinRate={teamWinRate}
        selectedTeam={filter.team}
        avgEconomyDiff={avgEconomyDiff}
        winRateWhenAhead={ahead.length > 0 ? aheadWins / ahead.length : 0}
        winRateWhenBehind={behind.length > 0 ? behindWins / behind.length : 0}
        economyThreshold={threshold}
        aheadCount={ahead.length}
        behindCount={behind.length}
        aheadMatches={aheadMatches}
        behindMatches={behindMatches}
        onEconomyThresholdChange={(v: number) =>
          setFilter((prev: FilterState) => ({ ...prev, economyThreshold: v }))
        }
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WinRateBarChart data={summaryData} />
        <EconomyScatterChart data={filtered} indicator={filter.indicator} />
      </div>

      {/* Detail Table */}
      <DetailTable data={filtered} indicator={filter.indicator} />
    </div>
  );
}
