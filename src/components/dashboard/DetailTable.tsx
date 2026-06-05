"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type DetailRow,
  type EconomyIndicator,
  type GameMinute,
  INDICATOR_FIELD,
  INDICATOR_LABELS,
  PICK_ORDER_LABELS,
} from "@/lib/data";

interface DetailTableProps {
  data: DetailRow[];
  indicator: EconomyIndicator;
  gameMinute: GameMinute;
}

type SortField = "team" | "pos1_hero" | "side" | "result" | "pickOrder" | "economyDiff" | "pos1_networth" | "pos1_lh_5m";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 100;

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`ml-1 inline-block text-[10px] ${active ? "text-[#22d3ee]" : "text-[#4a5568]"}`}>
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function DetailTable({ data, indicator, gameMinute }: DetailTableProps) {
  const [sortField, setSortField] = useState<SortField>("economyDiff");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [data, sortField, sortDir, indicator, gameMinute]);

  function toggleSort(f: SortField) {
    if (sortField === f) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(f);
      setSortDir("desc");
    }
  }

  return (
    <div className="rounded-lg border border-[#2a2d3a]">
      <div className="overflow-auto max-h-[420px]">
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
            <TableHead className="text-[#94a3b8] cursor-pointer select-none" onClick={() => toggleSort("pickOrder")}>
              BP顺序 <SortIcon active={sortField === "pickOrder"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("economyDiff")}>
              {INDICATOR_LABELS[indicator]} <SortIcon active={sortField === "economyDiff"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("pos1_networth")}>
              {gameMinute}分钟经济 <SortIcon active={sortField === "pos1_networth"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] cursor-pointer select-none text-right font-mono" onClick={() => toggleSort("pos1_lh_5m")}>
              5分钟补刀 <SortIcon active={sortField === "pos1_lh_5m"} dir={sortDir} />
            </TableHead>
            <TableHead className="text-[#94a3b8] text-right">KDA</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
            const diff = row[field] as number;
            return (
              <TableRow key={`${row.league_id}-${row.match_id}-${row.team}`} className="border-[#2a2d3a] hover:bg-[#1e2230]">
                <TableCell className="font-medium text-[#e2e8f0]">{row.team}</TableCell>
                <TableCell className="text-[#94a3b8]">{row.pos1_hero}</TableCell>
                <TableCell className="text-[#94a3b8]">{row.side}</TableCell>
                <TableCell>
                  <span className={row.win === 1 ? "text-[#10b981] font-medium" : "text-[#f43f5e] font-medium"}>
                    {row.result}
                  </span>
                </TableCell>
                <TableCell className="text-[#94a3b8]">
                  {row.pickOrder === "unknown" ? "-" : PICK_ORDER_LABELS[row.pickOrder]}
                </TableCell>
                <TableCell className={`text-right font-mono tabular-nums ${diff >= 0 ? "text-[#10b981]" : "text-[#f43f5e]"}`}>
                  {diff > 0 ? "+" : ""}{diff}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">
                  {row.pos1_networth}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#e2e8f0]">
                  {row.pos1_lh_5m}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-[#94a3b8]">{row.pos1_kda}</TableCell>
              </TableRow>
            );
          })}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2a2d3a] px-3 py-2 text-xs text-[#64748b]">
        <span>
          共 {sorted.length} 条记录 · 每页 {PAGE_SIZE} 条 · 第 {currentPage} / {totalPages} 页
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-[#2a2d3a] px-2 py-1 text-[#94a3b8] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#2a2d3a] disabled:hover:text-[#94a3b8]"
          >
            上一页
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-[#2a2d3a] px-2 py-1 text-[#94a3b8] transition-colors hover:border-[#22d3ee] hover:text-[#22d3ee] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[#2a2d3a] disabled:hover:text-[#94a3b8]"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
