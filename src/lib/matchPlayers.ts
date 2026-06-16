import Papa from "papaparse";
import { type DetailRow, type GameMinute, type SummaryRow, normalizeTeamName } from "@/lib/data";
import { getEconomyBucketLabel } from "@/lib/dashboard";

export type Side = "radiant" | "dire";
export type Position = 1 | 2 | 3 | 4 | 5;

export const SIDE_LABELS: Record<Side, string> = {
  radiant: "天辉",
  dire: "夜魇",
};

export const POSITIONS: Position[] = [1, 2, 3, 4, 5];

export interface PlayerSlot {
  player: string;
  hero: string;
  networth6m: number;
  networth10m: number;
}

export interface MatchPlayersRow {
  match_id: string;
  league_id?: string;
  radiant_team?: string;
  dire_team?: string;
  /** index 0..4 == pos1..pos5 */
  radiant: PlayerSlot[];
  dire: PlayerSlot[];
  radiantWin: number | null;
}

export const MATCH_PLAYERS_CSV_PATH = "/data/match-players.csv";

function toNumber(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

function readSlots(row: Record<string, string>, side: Side): PlayerSlot[] {
  return POSITIONS.map((pos) => ({
    player: row[`${side}_pos${pos}_player`] || "",
    hero: row[`${side}_pos${pos}_hero`] || "",
    networth6m: toNumber(row[`${side}_pos${pos}_networth_6m`]),
    networth10m: toNumber(row[`${side}_pos${pos}_networth_10m`]),
  }));
}

/**
 * Parse the per-match table (one row per match, both teams' 10 players by position).
 */
export function parseMatchPlayersCsv(text: string): MatchPlayersRow[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.replace(/^\uFEFF/, "").trim(),
  });

  if (result.errors.length > 0) {
    console.warn("Match players CSV parse warnings:", result.errors.slice(0, 5));
  }

  return result.data.map((row) => {
    const radiant_team = row.radiant_team ? normalizeTeamName(row.radiant_team) : undefined;
    const dire_team = row.dire_team ? normalizeTeamName(row.dire_team) : undefined;
    return {
      match_id: row.match_id || "",
      league_id: row.league_id || undefined,
      radiant_team,
      dire_team,
      radiant: readSlots(row, "radiant"),
      dire: readSlots(row, "dire"),
      radiantWin: winnerToRadiantWin(row.winner, radiant_team, dire_team),
    };
  });
}

/** Resolve radiantWin (0/1) from a winner team name; null when unresolved. */
function winnerToRadiantWin(
  winner: string | undefined,
  radiantTeam: string | undefined,
  direTeam: string | undefined
): number | null {
  if (!winner) return null;
  const w = normalizeTeamName(winner);
  if (radiantTeam && w === radiantTeam) return 1;
  if (direTeam && w === direTeam) return 0;
  return null;
}

/** Build a match_id -> radiantWin(0/1) map from the existing detail rows. */
export function buildRadiantWinMap(detailRows: DetailRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of detailRows) {
    if (!r.match_id || map.has(r.match_id)) continue;
    const isRadiant = r.side === "Radiant";
    const radiantWin = isRadiant ? r.win : 1 - r.win;
    map.set(r.match_id, radiantWin);
  }
  return map;
}

/**
 * Fill radiantWin for rows still unknown (null) via match_id join with detail.
 * Rows that already resolved their winner (e.g. from the CSV's winner column) are kept.
 */
export function joinWin(rows: MatchPlayersRow[], winMap: Map<string, number>): MatchPlayersRow[] {
  return rows.map((row) => {
    if (row.radiantWin !== null) return row;
    const radiantWin = winMap.get(row.match_id);
    return { ...row, radiantWin: radiantWin === undefined ? null : radiantWin };
  });
}

export async function fetchMatchPlayersCsv(): Promise<string> {
  const res = await fetch(MATCH_PLAYERS_CSV_PATH);
  if (!res.ok) {
    throw new Error(`无法加载全位置经济数据 (${res.status})`);
  }
  return res.text();
}

/* ------------------------------------------------------------------ */
/*  Position-based filters                                             */
/* ------------------------------------------------------------------ */
export type SlotField = "hero" | "player";

export interface PositionCondition {
  id: string;
  side: Side;
  pos: Position;
  field: SlotField;
  value: string;
}

function slotOf(row: MatchPlayersRow, side: Side, pos: Position): PlayerSlot {
  return (side === "radiant" ? row.radiant : row.dire)[pos - 1];
}

/** Unique non-empty hero/player options for a given side+position. */
export function getSlotOptions(
  rows: MatchPlayersRow[],
  side: Side,
  pos: Position,
  field: SlotField
): string[] {
  const set = new Set<string>();
  for (const row of rows) {
    const v = slotOf(row, side, pos)[field];
    if (v) set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Apply position conditions as AND filters. */
export function applyConditions(
  rows: MatchPlayersRow[],
  conditions: PositionCondition[]
): MatchPlayersRow[] {
  if (conditions.length === 0) return rows;
  return rows.filter((row) =>
    conditions.every((c) => slotOf(row, c.side, c.pos)[c.field] === c.value)
  );
}

/* ------------------------------------------------------------------ */
/*  Economy diff builder                                               */
/* ------------------------------------------------------------------ */
function networthAt(slot: PlayerSlot, minute: GameMinute): number {
  return minute === 6 ? slot.networth6m : slot.networth10m;
}

/** Sum networth for a side over the selected positions at a given minute. */
export function sumGroup(
  row: MatchPlayersRow,
  minute: GameMinute,
  side: Side,
  positions: Position[]
): number {
  return positions.reduce((sum, pos) => sum + networthAt(slotOf(row, side, pos), minute), 0);
}

export interface DiffGroup {
  side: Side;
  positions: Position[];
}

export interface MatchDiffResult {
  row: MatchPlayersRow;
  leftSum: number;
  rightSum: number;
  diff: number;
  /** win from the left group's side perspective (0/1), null when unknown */
  win: number | null;
}

/**
 * Compute Σleft - Σright per match. win is from the left group's side perspective.
 */
export function computeDiffs(
  rows: MatchPlayersRow[],
  minute: GameMinute,
  left: DiffGroup,
  right: DiffGroup
): MatchDiffResult[] {
  return rows.map((row) => {
    const leftSum = sumGroup(row, minute, left.side, left.positions);
    const rightSum = sumGroup(row, minute, right.side, right.positions);
    let win: number | null = null;
    if (row.radiantWin !== null) {
      win = left.side === "radiant" ? row.radiantWin : 1 - row.radiantWin;
    }
    return { row, leftSum, rightSum, diff: leftSum - rightSum, win };
  });
}

/**
 * Bucket diff values by size and produce SummaryRow[] for WinRateBarChart.
 * Only results with a known win are counted toward win rate.
 */
export function buildDiffSummary(
  results: MatchDiffResult[],
  bucketSize: number
): SummaryRow[] {
  const bucketMap = new Map<
    string,
    { total: number; wins: number; diffSum: number; sortKey: number }
  >();

  for (const r of results) {
    if (r.win === null) continue;
    const { label, sortKey } = getEconomyBucketLabel(r.diff, bucketSize);
    const existing = bucketMap.get(label);
    if (existing) {
      existing.total += 1;
      existing.wins += r.win;
      existing.diffSum += r.diff;
    } else {
      bucketMap.set(label, { total: 1, wins: r.win, diffSum: r.diff, sortKey });
    }
  }

  return [...bucketMap.entries()]
    .sort((a, b) => a[1].sortKey - b[1].sortKey)
    .map(([bucket, data]) => ({
      indicator: "team_total" as const,
      bucket,
      sampleCount: data.total,
      wins: data.wins,
      winRate: data.total > 0 ? Number((data.wins / data.total).toFixed(3)) : 0,
      avgDiff: data.total > 0 ? Number((data.diffSum / data.total).toFixed(1)) : 0,
    }));
}
