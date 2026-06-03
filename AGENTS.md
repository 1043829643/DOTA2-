# 项目上下文

## 项目概览
BLAST Slam VII Dota 2 赛事数据看板，分析10分钟1号位经济差与胜率的关系。

### 版本技术栈
- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **图表库**: recharts (已集成 shadcn/ui chart 组件)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                     # 静态资源（数据由用户上传 CSV，页面内动态汇总）
├── src/
│   ├── app/
│   │   ├── globals.css         # 全局样式（含暗色主题变量）
│   │   ├── layout.tsx          # 根布局（强制 dark 类名）
│   │   └── page.tsx            # 主看板页面（上传 CSV + 客户端筛选/汇总）
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── WinRateBarChart.tsx   # 胜率-经济差分档柱状图
│   │   │   ├── EconomyScatterChart.tsx # 散点图（经济差 vs 胜负）
│   │   │   ├── DetailTable.tsx       # 明细数据表格（可排序）
│   │   │   ├── StatsCards.tsx        # 顶部统计卡片
│   │   │   └── FilterBar.tsx         # 筛选器（队伍/英雄/阵营/指标）
│   │   └── ui/                       # shadcn/ui 组件库
│   └── lib/
│       ├── data.ts             # 数据类型定义 + CSV 解析 (papaparse)
│       ├── dashboard.ts        # 筛选逻辑 + 动态分档汇总 + 胜率计算
│       └── utils.ts            # 通用工具函数 (cn)
├── DESIGN.md                   # 设计规范
└── package.json
```

## 数据模型

### DetailRow (detail.csv)
每队每局记录，包含 match_id, team, opponent, side, result, win, pos1_player, pos1_hero, pos1_lh_5m, pos1_networth_10m, enemy_pos1_player, enemy_pos1_hero, enemy_pos1_networth_10m, pos1_vs_enemy_pos1_diff_10m, enemy_pos3_player, enemy_pos3_hero, enemy_pos3_networth_10m, pos1_vs_enemy_pos3_diff_10m, team_networth_10m, enemy_team_networth_10m, team_networth_diff_10m, pos1_kda_10m

### SummaryRow (summary.csv)
按经济差指标分档汇总，包含 indicator, bucket, sampleCount, wins, winRate, avgDiff

### EconomyIndicator
- `pos1_vs_pos1`: 1号位-对方1号位经济差
- `pos1_vs_pos3`: 1号位-对方3号位经济差
- `team_total`: 团队总经济差

## 包管理规范
**仅允许使用 pnpm**，严禁 npm 或 yarn。

## 开发规范
- TypeScript strict 模式，禁止隐式 any
- 组件定义在渲染函数外部，禁止在 render 内创建组件
- 数据数字使用 tabular-nums 等宽对齐
- 暗色主题强制通过 html className="dark" 启用
