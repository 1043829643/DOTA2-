import Papa from "papaparse";

export interface DetailRow {
  league_id: string;
  league_name: string;
  match_id: string;
  team: string;
  opponent: string;
  side: string;
  result: string;
  win: number;
  pos1_player: string;
  pos1_hero: string;
  pos1_lh_5m: number;
  pos1_networth_10m: number;
  enemy_pos1_player: string;
  enemy_pos1_hero: string;
  enemy_pos1_networth_10m: number;
  pos1_vs_enemy_pos1_diff_10m: number;
  enemy_pos3_player: string;
  enemy_pos3_hero: string;
  enemy_pos3_networth_10m: number;
  pos1_vs_enemy_pos3_diff_10m: number;
  team_networth_10m: number;
  enemy_team_networth_10m: number;
  team_networth_diff_10m: number;
  pos1_kda_10m: string;
}

export interface SummaryRow {
  indicator: EconomyIndicator;
  bucket: string;
  sampleCount: number;
  wins: number;
  winRate: number;
  avgDiff: number;
}

export type EconomyIndicator = "pos1_vs_pos1" | "pos1_vs_pos3" | "team_total";

export const INDICATOR_LABELS: Record<EconomyIndicator, string> = {
  pos1_vs_pos1: "1号位-对方1号位经济差",
  pos1_vs_pos3: "1号位-对方3号位经济差",
  team_total: "团队总经济差",
};

export const INDICATOR_FIELD: Record<EconomyIndicator, keyof DetailRow> = {
  pos1_vs_pos1: "pos1_vs_enemy_pos1_diff_10m",
  pos1_vs_pos3: "pos1_vs_enemy_pos3_diff_10m",
  team_total: "team_networth_diff_10m",
};

export interface LeagueOption {
  id: string;
  name: string;
}

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Parse a CSV string (from uploaded file) into DetailRow[].
 * Uses papaparse for robust CSV handling (BOM, quoted fields, etc.)
 * Supports both:
 *  - CSV with league_id,league_name columns
 *  - CSV without league columns (will default league_id="0", league_name="自定义")
 */
export function parseDetailCsv(text: string): DetailRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.replace(/^\uFEFF/, "").trim(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors.slice(0, 5));
  }

  return result.data.map((row) => ({
    league_id: row.league_id || "0",
    league_name: row.league_name || "自定义联赛",
    match_id: row.match_id || "",
    team: row.team || "",
    opponent: row.opponent || "",
    side: row.side || "",
    result: row.result || "",
    win: toNumber(row.win),
    pos1_player: row.pos1_player || "",
    pos1_hero: row.pos1_hero || "",
    pos1_lh_5m: toNumber(row.pos1_lh_5m),
    pos1_networth_10m: toNumber(row.pos1_networth_10m),
    enemy_pos1_player: row.enemy_pos1_player || "",
    enemy_pos1_hero: row.enemy_pos1_hero || "",
    enemy_pos1_networth_10m: toNumber(row.enemy_pos1_networth_10m),
    pos1_vs_enemy_pos1_diff_10m: toNumber(row.pos1_vs_enemy_pos1_diff_10m),
    enemy_pos3_player: row.enemy_pos3_player || "",
    enemy_pos3_hero: row.enemy_pos3_hero || "",
    enemy_pos3_networth_10m: toNumber(row.enemy_pos3_networth_10m),
    pos1_vs_enemy_pos3_diff_10m: toNumber(row.pos1_vs_enemy_pos3_diff_10m),
    team_networth_10m: toNumber(row.team_networth_10m),
    enemy_team_networth_10m: toNumber(row.enemy_team_networth_10m),
    team_networth_diff_10m: toNumber(row.team_networth_diff_10m),
    pos1_kda_10m: row.pos1_kda_10m || "",
  }));
}

/** 内置明细表路径（对应 public/data/detail.csv） */
export const DEFAULT_DETAIL_CSV_PATH = "/data/detail.csv";

export async function fetchDefaultDetailCsv(): Promise<string> {
  const res = await fetch(DEFAULT_DETAIL_CSV_PATH);
  if (!res.ok) {
    throw new Error(`无法加载默认数据 (${res.status})`);
  }
  return res.text();
}

export function getLeagues(rows: DetailRow[]): LeagueOption[] {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.league_id && !map.has(r.league_id)) {
      map.set(r.league_id, r.league_name);
    }
  }
  return Array.from(map.entries())
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
