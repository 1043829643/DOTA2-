"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type EconomyIndicator,
  type GameMinute,
  GAME_MINUTE_LABELS,
  INDICATOR_LABELS,
  PICK_ORDER_LABELS,
  type LeagueOption,
} from "@/lib/data";
import { type FilterState } from "@/lib/dashboard";

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (filter: FilterState) => void;
  teams: string[];
  heroes: string[];
  leagues: LeagueOption[];
}

export function FilterBar({ filter, onFilterChange, teams, heroes, leagues }: FilterBarProps) {
  const update = (partial: Partial<FilterState>) => {
    onFilterChange({ ...filter, ...partial });
  };

  const toggleLeague = (id: string) => {
    const current = filter.leagues;
    if (current.includes(id)) {
      update({ leagues: current.filter((l) => l !== id) });
    } else {
      update({ leagues: [...current, id] });
    }
  };

  const selectAllLeagues = () => {
    update({ leagues: leagues.map((l) => l.id) });
  };

  const clearAllLeagues = () => {
    update({ leagues: [] });
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <Select
        value={String(filter.gameMinute)}
        onValueChange={(v) => update({ gameMinute: Number(v) as GameMinute })}
      >
        <SelectTrigger className="w-[110px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="时间点" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          {([6, 10] as const).map((m) => (
            <SelectItem
              key={m}
              value={String(m)}
              className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]"
            >
              {GAME_MINUTE_LABELS[m]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* League checkboxes */}
      <div className="flex items-center gap-2 bg-[#1a1d28] border border-[#2a2d3a] rounded-md px-3 py-1.5">
        <span className="text-xs text-[#94a3b8] shrink-0">联赛</span>
        <div className="flex items-center gap-2">
          {leagues.map((league) => (
            <label
              key={league.id}
              className="flex items-center gap-1.5 cursor-pointer select-none group"
            >
              <input
                type="checkbox"
                checked={filter.leagues.includes(league.id)}
                onChange={() => toggleLeague(league.id)}
                className="w-3.5 h-3.5 rounded border-[#4a5568] bg-[#0f1117] text-[#22d3ee] accent-[#22d3ee] cursor-pointer"
              />
              <span
                className={`text-xs whitespace-nowrap ${
                  filter.leagues.includes(league.id)
                    ? "text-[#22d3ee]"
                    : "text-[#94a3b8] group-hover:text-[#e2e8f0]"
                }`}
              >
                {league.name}
              </span>
            </label>
          ))}
          <button
            onClick={filter.leagues.length === leagues.length ? clearAllLeagues : selectAllLeagues}
            className="text-[10px] text-[#4a5568] hover:text-[#22d3ee] ml-1 transition-colors"
          >
            {filter.leagues.length === leagues.length ? "清除" : "全选"}
          </button>
        </div>
      </div>

      <Select value={filter.indicator} onValueChange={(v) => update({ indicator: v as EconomyIndicator })}>
        <SelectTrigger className="w-[220px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="经济差指标" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          {(Object.entries(INDICATOR_LABELS) as [EconomyIndicator, string][]).map(([key, label]) => (
            <SelectItem key={key} value={key} className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filter.team} onValueChange={(v) => update({ team: v })}>
        <SelectTrigger className="w-[140px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="队伍" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          <SelectItem value="all" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">全部队伍</SelectItem>
          {teams.map((t) => (
            <SelectItem key={t} value={t} className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filter.hero} onValueChange={(v) => update({ hero: v })}>
        <SelectTrigger className="w-[160px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="1号位英雄" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          <SelectItem value="all" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">全部英雄</SelectItem>
          {heroes.map((h) => (
            <SelectItem key={h} value={h} className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filter.side} onValueChange={(v) => update({ side: v })}>
        <SelectTrigger className="w-[120px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="阵营" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          <SelectItem value="all" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">全部</SelectItem>
          <SelectItem value="Radiant" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">天辉</SelectItem>
          <SelectItem value="Dire" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">夜魇</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filter.pickOrder} onValueChange={(v) => update({ pickOrder: v as typeof filter.pickOrder })}>
        <SelectTrigger className="w-[120px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="选序" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          {(["all", "first", "second"] as const).map((key) => (
            <SelectItem
              key={key}
              value={key}
              className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]"
            >
              {PICK_ORDER_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(filter.bucketSize)}
        onValueChange={(v) => update({ bucketSize: Number(v) })}
      >
        <SelectTrigger className="w-[120px] bg-[#1a1d28] border-[#2a2d3a] text-[#e2e8f0] text-sm">
          <SelectValue placeholder="分档宽度" />
        </SelectTrigger>
        <SelectContent className="bg-[#1a1d28] border-[#2a2d3a]">
          <SelectItem value="300" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">分档 300</SelectItem>
          <SelectItem value="500" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">分档 500</SelectItem>
          <SelectItem value="1000" className="text-[#e2e8f0] focus:bg-[#2a2d3a] focus:text-[#22d3ee]">分档 1000</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
