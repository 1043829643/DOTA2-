"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type DetailRow, type EconomyIndicator, INDICATOR_FIELD, INDICATOR_LABELS } from "@/lib/data";

interface DetailTableProps {
  data: DetailRow[];
  indicator: EconomyIndicator;
}

type SortField = "team" | "pos1_hero" | "side" | "result" | "economyDiff" | "pos1_networth_10m" | "pos1_lh_5m";
type SortDir = "asc" | "desc";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block text-[10px] ${active ? "text-[#22d3ee]" : "text-[#4a5568]"}`}>
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function DetailTable({ data, indicator }: DetailTableProps) {
  const [sortField, setSortField] = useState<SortField>("economyDiff");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const field = INDICATOR_FIELD[indicator];

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      let va: string | number;
      let vb: string | number;
      if (sortField === "economyDiff") {
        va = a[field] as number;
        vb = b[field] as number;
      } else {
        va = a[sortField] as string;
        vb = b[sortField] as string;
      }
      if (typeof va === "number" && typeof vb === "number") {
        return sortDir === "asc" ? va - vb : vb - va;
      }
      const cmp = String(va).localeCompare(String(vb));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortField, sortDir, field]);

  function toggleSort(f: SortField) {
    if (sortField === f) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(f);
      setSortDir("desc");
    }
  }

  return (
    <div className="overflow-auto max-h-[420px] rounded-lg border border-[#2a2d3a]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-[#2a2d3a]">
            <TableHead className="text-[#94a3b8] cursor-pointer select-none" onClick={() => toggleSort("team")}>
              队伍 <SortIcon active={sortField === "team"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none" onClick={() => toggleSort("pos1_hero")}>
              1号位英雄 <SortIcon active={sortField === "pos1_hero"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none" onClick={() => toggleSort("side")}>
              阵营 <SortIcon active={sortField === "side"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none" onClick={() => toggleSort("result")}>
              结果 <SortIcon active={sortField === "result"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("economyDiff")}>
              {INDICATOR_LABELS[indicator]} <SortIcon active={sortField === "economyDiff"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("pos1_networth_10m")}>
              10分钟经济 <SortIcon active={sortField === "pos1_networth_10m"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("pos1_lh_5m")}>
              5分钟补刀 <SortIcon active={sortField === "pos1_lh_5m"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] text-right">KDA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((row, i) => {
            const diff = row[field] as number;
            return (
              <TableRow key={`${row.league_id}-${row.match_id}-${row.team}`} className="border-[#2a2d3a] hover:bg-[#1e2230]">
                <TableCell className="font-medium text-[#e2e8f0]">{row.team}</TableCell>
                <TableCell className="text-[#94a3b8]">{row.pos1_hero}</TableCell>
                <TableCell className="text-[#94a3b8]">{row.side}</TableCell>
                <TableCell>
                  <span className={row.result === "胜" ? "text-[#10b981] font-medium" : "text-[#f43f5e] font-medium"}>
                    {row.result}
                  </span>
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${diff >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}>
                  {diff > 0 ? "+" : ""}{diff}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">
                  {row.pos1_networth_10m}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">
                  {row.pos1_lh_5m}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#94a3b8]">{row.pos1_kda_10m}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
