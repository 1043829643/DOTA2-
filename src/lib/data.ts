import Papa from "papaparse";

export type GameMinute = 6 | 10;

export const GAME_MINUTE_LABELS: Record<GameMinute, string> = {
  6: "6 分钟",
  10: "10 分钟",
};

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
  pos1_networth: number;
  enemy_pos1_player: string;
  enemy_pos1_hero: string;
  enemy_pos1_networth: number;
  pos1_vs_enemy_pos1_diff: number;
  enemy_pos3_player: string;
  enemy_pos3_hero: string;
  enemy_pos3_networth: number;
  pos1_vs_enemy_pos3_diff: number;
  team_networth: number;
  enemy_team_networth: number;
  team_networth_diff: number;
  pos1_kda: string;
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
  pos1_vs_pos1: "pos1_vs_enemy_pos1_diff",
  pos1_vs_pos3: "pos1_vs_enemy_pos3_diff",
  team_total: "team_networth_diff",
};

export interface LeagueOption {
  id: string;
  name: string;
}

export const DETAIL_CSV_BY_MINUTE: Record<GameMinute, string> = {
  6: "/data/detail-6m.csv",
  10: "/data/detail-10m.csv",
};

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

function minuteSuffix(minute: GameMinute): "6m" | "10m" {
  return minute === 6 ? "6m" : "10m";
}

function detectMinuteFromHeaders(fields: string[]): GameMinute {
  return fields.some((f) => f.includes("_6m")) ? 6 : 10;
}

export function detectGameMinuteFromCsv(text: string): GameMinute {
  const header = text.split(/\r?\n/)[0] ?? "";
  return header.includes("_6m") ? 6 : 10;
}

/**
 * Parse detail CSV into normalized DetailRow[] (_6m / _10m columns → canonical fields).
 */
export function parseDetailCsv(text: string, minute?: GameMinute): DetailRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.replace(/^\uFEFF/, "").trim(),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors.slice(0, 5));
  }

  const fields = result.meta.fields ?? [];
  const resolvedMinute = minute ?? detectMinuteFromHeaders(fields);
  const s = minuteSuffix(resolvedMinute);

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
    pos1_networth: toNumber(row[`pos1_networth_${s}`]),
    enemy_pos1_player: row.enemy_pos1_player || "",
    enemy_pos1_hero: row.enemy_pos1_hero || "",
    enemy_pos1_networth: toNumber(row[`enemy_pos1_networth_${s}`]),
    pos1_vs_enemy_pos1_diff: toNumber(row[`pos1_vs_enemy_pos1_diff_${s}`]),
    enemy_pos3_player: row.enemy_pos3_player || "",
    enemy_pos3_hero: row.enemy_pos3_hero || "",
    enemy_pos3_networth: toNumber(row[`enemy_pos3_networth_${s}`]),
    pos1_vs_enemy_pos3_diff: toNumber(row[`pos1_vs_enemy_pos3_diff_${s}`]),
    team_networth: toNumber(row[`team_networth_${s}`]),
    enemy_team_networth: toNumber(row[`enemy_team_networth_${s}`]),
    team_networth_diff: toNumber(row[`team_networth_diff_${s}`]),
    pos1_kda: row[`pos1_kda_${s}`] || "",
  }));
}

export async function fetchDetailCsv(minute: GameMinute): Promise<string> {
  const path = DETAIL_CSV_BY_MINUTE[minute];
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`无法加载 ${GAME_MINUTE_LABELS[minute]} 数据 (${res.status})`);
  }
  return res.text();
}

/** @deprecated use fetchDetailCsv(10) */
export async function fetchDefaultDetailCsv(): Promise<string> {
  return fetchDetailCsv(10);
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
