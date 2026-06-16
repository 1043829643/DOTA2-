"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  type BpFirstPickRow,
  type DetailRow,
  type LeagueOption,
  type GameMinute,
  GAME_MINUTE_LABELS,
  INDICATOR_FIELD,
  applyPickOrder,
  parseDetailCsv,
  fetchDetailCsv,
  fetchBpFirstPickCsv,
  detectGameMinuteFromCsv,
  parseBpFirstPickCsv,
} from "@/lib/data";
import {
  type FilterState,
  DEFAULT_FILTER,
  filterDetailRows,
  computeSummaryFromDetail,
  computeTeamWinRate,
  filterAfterUpload,
  filterAfterMinuteSwitch,
  getUniqueTeams,
  getUniqueHeroes,
} from "@/lib/dashboard";
import {
  type MatchPlayersRow,
  buildRadiantWinMap,
  fetchMatchPlayersCsv,
  joinWin,
  parseMatchPlayersCsv,
} from "@/lib/matchPlayers";
import { FilterBar, LeagueSelector } from "@/components/dashboard/FilterBar";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { WinRateBarChart } from "@/components/dashboard/WinRateBarChart";
import { WinRateCurveChart } from "@/components/dashboard/WinRateCurveChart";
import { EconomyScatterChart } from "@/components/dashboard/EconomyScatterChart";
import { DetailTable } from "@/components/dashboard/DetailTable";
import { PositionEconomySection } from "@/components/dashboard/PositionEconomySection";

const GAME_MINUTES: GameMinute[] = [6, 10];

export default function DashboardPage() {
  const [datasets, setDatasets] = useState<Partial<Record<GameMinute, DetailRow[]>>>({});
  const [bpRows, setBpRows] = useState<BpFirstPickRow[]>([]);
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayersRow[]>([]);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [fileName, setFileName] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const rows = datasets[filter.gameMinute] ?? [];

  const applyParsedRows = useCallback(
    (parsed: DetailRow[], name: string, minute: GameMinute) => {
      const rowsWithPickOrder = applyPickOrder(parsed, bpRows);
      if (rowsWithPickOrder.length === 0) {
        setParseError("CSV 解析结果为空，请检查文件格式");
        return;
      }
      setParseError(null);
      setDatasets((prev) => ({ ...prev, [minute]: rowsWithPickOrder }));
      setFileName(name);
      const leagueIds = [...new Set(rowsWithPickOrder.map((r) => r.league_id))];
      setFilter(filterAfterUpload(leagueIds, minute));
    },
    [bpRows]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const bpText = await fetchBpFirstPickCsv();
        if (cancelled) return;
        const loadedBpRows = parseBpFirstPickCsv(bpText);
        setBpRows(loadedBpRows);

        const loaded: Partial<Record<GameMinute, DetailRow[]>> = {};
        for (const minute of GAME_MINUTES) {
          const text = await fetchDetailCsv(minute);
          if (cancelled) return;
          loaded[minute] = applyPickOrder(parseDetailCsv(text, minute), loadedBpRows);
        }
        if (cancelled) return;
        setDatasets(loaded);
        const defaultRows = loaded[10] ?? loaded[6] ?? [];
        const leagueIds = [...new Set(defaultRows.map((r) => r.league_id))];
        setFilter(filterAfterUpload(leagueIds, 10));
        setFileName("内置默认数据");
        setParseError(null);

        try {
          const mpText = await fetchMatchPlayersCsv();
          if (cancelled) return;
          const winMap = buildRadiantWinMap(loaded[10] ?? loaded[6] ?? []);
          setMatchPlayers(joinWin(parseMatchPlayersCsv(mpText), winMap));
        } catch {
          if (!cancelled) setMatchPlayers([]);
        }
      } catch (err) {
        if (!cancelled) {
          setParseError(
            err instanceof Error ? err.message : "默认数据加载失败，请手动上传 CSV"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilterChange = useCallback(
    (next: FilterState) => {
      if (next.gameMinute !== filter.gameMinute) {
        const newRows = datasets[next.gameMinute] ?? [];
        const leagueIds = [...new Set(newRows.map((r) => r.league_id))];
        setFilter(filterAfterMinuteSwitch(leagueIds, next.gameMinute, next));
        return;
      }
      setFilter(next);
    },
    [filter.gameMinute, datasets]
  );

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setParseError(null);
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result;
        if (typeof text === "string") {
          try {
            const minute = detectGameMinuteFromCsv(text);
            const parsed = parseDetailCsv(text, minute);
            applyParsedRows(parsed, file.name, minute);
          } catch (err) {
            setParseError(`解析失败: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      };
      reader.onerror = () => setParseError("文件读取失败");
      reader.readAsText(file, "utf-8");
    },
    [applyParsedRows, filter.gameMinute]
  );

  const gameMinute = filter.gameMinute;

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

  const teams = useMemo(
    () => getUniqueTeams(filterDetailRows(rows, filter, ["team"])),
    [rows, filter]
  );
  const heroes = useMemo(
    () => getUniqueHeroes(filterDetailRows(rows, filter, ["hero"])),
    [rows, filter]
  );

  const summaryData = useMemo(
    () => computeSummaryFromDetail(filtered, filter.indicator, filter.bucketSize),
    [filtered, filter.indicator, filter.bucketSize]
  );

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

  const selectedLeagueCount = filter.leagues.length;

  const titleMinute = `${gameMinute}min`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <p className="text-sm text-[#94a3b8]">正在加载数据…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">
              {titleMinute} Economy vs Win Rate
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
                默认数据加载失败时可手动上传明细 CSV（支持 6/10 分钟列名）
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-4 md:p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div className="w-[360px] shrink-0">
          <h1 className="text-xl font-bold text-[#e2e8f0]">
            Dota 2 {titleMinute} Economy vs Win Rate
          </h1>
          <p className="text-sm text-[#94a3b8]">
            1号位 {GAME_MINUTE_LABELS[gameMinute]} 经济差与胜率关系分析 · 已选 {selectedLeagueCount}/{leagues.length} 个联赛
          </p>
        </div>
        <div className="flex min-w-0 flex-1 items-start justify-end gap-2">
          <div className="min-w-0 flex-1">
            <LeagueSelector
              filter={filter}
              onFilterChange={handleFilterChange}
              leagues={leagues}
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2a2d3a] hover:border-[#22d3ee] cursor-pointer transition-colors text-xs text-[#94a3b8] hover:text-[#22d3ee]">
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
      </div>

      <FilterBar
        filter={filter}
        onFilterChange={handleFilterChange}
        teams={teams}
        heroes={heroes}
      />

      <StatsCards
        totalMatches={uniqueMatches}
        totalRows={totalRows}
        teamWinRate={teamWinRate}
        selectedTeam={filter.team}
        avgEconomyDiff={avgEconomyDiff}
        winRateWhenAhead={ahead.length > 0 ? aheadWins / ahead.length : 0}
        winRateWhenBehind={behind.length > 0 ? behindWins / behind.length : 0}
        economyThreshold={threshold}
        aheadWins={aheadWins}
        behindWins={behindWins}
        aheadCount={ahead.length}
        behindCount={behind.length}
        onEconomyThresholdChange={(v: number) =>
          setFilter((prev: FilterState) => ({ ...prev, economyThreshold: v }))
        }
      />

      <div className="mb-4">
        <WinRateCurveChart
          summaryData={summaryData}
          detailData={filtered}
          indicator={filter.indicator}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <WinRateBarChart data={summaryData} />
        <EconomyScatterChart data={filtered} indicator={filter.indicator} />
      </div>

      <DetailTable data={filtered} indicator={filter.indicator} gameMinute={gameMinute} />

      <PositionEconomySection rows={matchPlayers} />
    </div>
  );
}
