"use client";

import {
  type DetailRow,
  type SummaryRow,
  type EconomyIndicator,
  type GameMinute,
  type PickOrderFilter,
  INDICATOR_FIELD,
} from "@/lib/data";

/* ------------------------------------------------------------------ */
/*  Filter state                                                       */
/* ------------------------------------------------------------------ */
export interface FilterState {
  gameMinute: GameMinute;
  leagues: string[];         // selected league_ids
  team: string;
  hero: string;
  side: string;
  pickOrder: PickOrderFilter;
  indicator: EconomyIndicator;
  economyThreshold: number;   // single threshold: ahead = diff > X, behind = diff < -X
  bucketSize: number;         // economy diff bucket size in gold (e.g. 300, 500, 1000)
}

export const DEFAULT_FILTER: FilterState = {
  gameMinute: 10,
  leagues: [],   // empty = all
  team: "all",
  hero: "all",
  side: "all",
  pickOrder: "all",
  indicator: "pos1_vs_pos1",
  economyThreshold: 0,
  bucketSize: 300,
};

/** 筛选时可跳过某一维，用于下拉选项（避免选中队伍后列表只剩当前队伍） */
export type FilterSkip = "team" | "hero";

/* ------------------------------------------------------------------ */
/*  Derived: filter detail rows                                        */
/* ------------------------------------------------------------------ */
export function filterDetailRows(
  rows: DetailRow[],
  filter: FilterState,
  skip: FilterSkip[] = []
): DetailRow[] {
  return rows.filter((r) => {
    if (filter.leagues.length > 0 && !filter.leagues.includes(String(r.league_id))) return false;
    if (!skip.includes("team") && filter.team !== "all" && r.team !== filter.team) return false;
    if (!skip.includes("hero") && filter.hero !== "all" && r.pos1_hero !== filter.hero) return false;
    if (filter.side !== "all" && r.side !== filter.side) return false;
    if (filter.pickOrder !== "all" && r.pickOrder !== filter.pickOrder) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ */
/*  Derived: compute summary from filtered detail (dynamic buckets)    */
/* ------------------------------------------------------------------ */
export function computeSummaryFromDetail(
  rows: DetailRow[],
  indicator: EconomyIndicator,
  bucketSize: number = 300
): SummaryRow[] {
  const field = INDICATOR_FIELD[indicator];
  const bucketMap = new Map<string, { total: number; wins: number; diffSum: number; sortKey: number }>();

  for (const row of rows) {
    const val = row[field] as number;
    const { label, sortKey } = getEconomyBucketLabel(val, bucketSize);
    const existing = bucketMap.get(label);
    if (existing) {
      existing.total += 1;
      existing.wins += row.win;
      existing.diffSum += val;
    } else {
      bucketMap.set(label, { total: 1, wins: row.win, diffSum: val, sortKey });
    }
  }

  // Sort by sortKey ascending
  const sorted = [...bucketMap.entries()].sort((a, b) => a[1].sortKey - b[1].sortKey);

  return sorted.map(([bucket, data]) => ({
    indicator,
    bucket,
    sampleCount: data.total,
    wins: data.wins,
    winRate: data.total > 0 ? Number((data.wins / data.total).toFixed(3)) : 0,
    avgDiff: data.total > 0 ? Number((data.diffSum / data.total).toFixed(1)) : 0,
  }));
}

/** 单队胜率；未选队伍时返回 null（全量双视角样本会恒约 50%） */
export function computeTeamWinRate(rows: DetailRow[], team: string): number | null {
  if (team === "all" || rows.length === 0) return null;
  const wins = rows.filter((r) => r.win === 1).length;
  return wins / rows.length;
}

/** 上传新 CSV 后的默认筛选：重置队伍/英雄等，并选中全部联赛 */
export function filterAfterUpload(leagueIds: string[], minute: GameMinute = 10): FilterState {
  return { ...DEFAULT_FILTER, gameMinute: minute, leagues: leagueIds };
}

/** 切换 6/10 分钟：保留指标与阈值，重置队伍/英雄并选中该数据集全部联赛 */
export function filterAfterMinuteSwitch(
  leagueIds: string[],
  minute: GameMinute,
  prev: FilterState
): FilterState {
  return {
    ...prev,
    gameMinute: minute,
    leagues: leagueIds,
    team: "all",
    hero: "all",
  };
}

/** Assign a value to a bucket label and sort key based on bucket size */
function getEconomyBucketLabel(value: number, bucketSize: number): { label: string; sortKey: number } {
  const half = Math.floor(bucketSize / 2);
  // Center-aligned buckets: [-bucketSize, 0), [0, bucketSize)
  // e.g. bucketSize=300 → [-300,0), [0,300), [300,600), [-600,-300)
  const bucketIndex = Math.floor((value + half) / bucketSize);
  const bucketStart = bucketIndex * bucketSize - half;
  const bucketEnd = bucketStart + bucketSize;
  return {
    label: `${bucketStart} ~ ${bucketEnd}`,
    sortKey: bucketStart,
  };
}

/* ------------------------------------------------------------------ */
/*  Derived: unique teams / heroes for filter dropdowns                */
/* ------------------------------------------------------------------ */
export function getUniqueTeams(rows: DetailRow[]): string[] {
  return [...new Set(rows.map((r) => r.team))].sort();
}

export function getUniqueHeroes(rows: DetailRow[]): string[] {
  return [...new Set(rows.map((r) => r.pos1_hero))].sort();
}
