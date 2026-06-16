import Papa from "papaparse";
import {
  type DetailRow,
  type GameMinute,
  type Position,
  normalizeTeamName,
} from "@/lib/data";

export type Side = "radiant" | "dire";

const POSITIONS: Position[] = [1, 2, 3, 4, 5];

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

function slotNetworth(slot: PlayerSlot, minute: GameMinute): number {
  return minute === 6 ? slot.networth6m : slot.networth10m;
}

/**
 * Attach per-position networth (own/enemy, minute-resolved) onto each DetailRow
 * by joining match-players on match_id + side.
 */
export function attachPositionNetworth(
  detailRows: DetailRow[],
  matchPlayersRows: MatchPlayersRow[],
  minute: GameMinute
): DetailRow[] {
  const byMatch = new Map(matchPlayersRows.map((m) => [m.match_id, m]));
  return detailRows.map((row) => {
    const match = byMatch.get(row.match_id);
    if (!match) return row;
    const isRadiant = row.side === "Radiant";
    const ownSlots = isRadiant ? match.radiant : match.dire;
    const enemySlots = isRadiant ? match.dire : match.radiant;
    return {
      ...row,
      ownNetworth: ownSlots.map((s) => slotNetworth(s, minute)),
      enemyNetworth: enemySlots.map((s) => slotNetworth(s, minute)),
    };
  });
}
