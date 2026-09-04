"use client";

import { useState } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface PositionHistoryPoint {
  date: string;
  formattedDate: string;
  top3: number;
  top10: number;
  top20: number;
  top50: number;
  top100: number;
  avgPosition: number;
}

export function PositionDistributionChart({
  data,
}: {
  data: PositionHistoryPoint[];
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            stroke="var(--subtle-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--subtle-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-md)",
              color: "var(--foreground)",
              fontSize: "13px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
          <Area
            type="monotone"
            dataKey="top3"
            name="Top 3 (Pos 1-3)"
            stackId="1"
            stroke="#34c759"
            fill="#34c759"
            fillOpacity={0.4}
          />
          <Area
            type="monotone"
            dataKey="top10"
            name="Top 4-10"
            stackId="1"
            stroke="#0071e3"
            fill="#0071e3"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="top20"
            name="Top 11-20"
            stackId="1"
            stroke="#ff9500"
            fill="#ff9500"
            fillOpacity={0.25}
          />
          <Area
            type="monotone"
            dataKey="top50"
            name="Top 21-50"
            stackId="1"
            stroke="#af52de"
            fill="#af52de"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SingleKeywordRankChart({
  data,
  keywordName,
}: {
  data: { date: string; formattedDate: string; position: number }[];
  keywordName: string;
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="formattedDate"
            stroke="var(--subtle-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            reversed
            domain={[1, "dataMax + 5"]}
            stroke="var(--subtle-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: "12px",
              boxShadow: "var(--shadow-md)",
              color: "var(--foreground)",
              fontSize: "13px",
            }}
            formatter={(val) => {
              const num = Number(val);
              const page = Math.ceil(num / 10);
              return [`#${num} (Google Page ${page})`, "Ranking"];
            }}
          />
          <Line
            type="monotone"
            dataKey="position"
            name={`Rank: ${keywordName}`}
            stroke="#0071e3"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#0071e3" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function KeywordMonthlyRankViewer({
  keywords,
  initialKeywordId,
}: {
  keywords: {
    id: number;
    keyword: string;
    latestPosition: number | null;
    history: { date: string; formattedDate: string; position: number }[];
  }[];
  initialKeywordId?: number;
}) {
  const [selectedId, setSelectedId] = useState<number>(() => {
    if (initialKeywordId) return initialKeywordId;
    const withHistory = keywords.find((k) => k.history.length > 0);
    return withHistory?.id ?? keywords[0]?.id ?? 0;
  });

  const selected = keywords.find((k) => k.id === selectedId) ?? keywords[0];

  if (!selected) return null;

  const positions = selected.history.map((h) => h.position);
  const bestRank = positions.length > 0 ? Math.min(...positions) : null;
  const latestRank = selected.latestPosition;
  const latestPage = latestRank != null ? Math.ceil(latestRank / 10) : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="kw-select" className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Select Keyword for Monthly Ranking Trajectory
          </label>
          <div className="mt-1 flex items-center gap-3">
            <select
              id="kw-select"
              value={selected.id}
              onChange={(e) => setSelectedId(Number(e.target.value))}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-semibold text-foreground transition-colors focus:border-accent focus:outline-none"
            >
              {keywords.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.keyword} {k.latestPosition != null ? `(#${k.latestPosition})` : "(No rank)"}
                </option>
              ))}
            </select>

            {latestRank != null ? (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                  latestPage === 1
                    ? "bg-emerald-500/10 text-emerald-500"
                    : latestPage && latestPage <= 3
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-amber-500/10 text-amber-500"
                }`}
              >
                Rank #{latestRank} · Google Page {latestPage} (Top 10 Pages)
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-[12px] font-medium text-muted-foreground">
                Not in Top 10 Pages (&gt;100)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-[12px]">
          <div>
            <span className="text-muted-foreground">Best Rank: </span>
            <span className="font-semibold text-foreground">
              {bestRank != null ? `#${bestRank} (Page ${Math.ceil(bestRank / 10)})` : "—"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Checks in 30 Days: </span>
            <span className="font-semibold text-foreground">{selected.history.length}</span>
          </div>
        </div>
      </div>

      {selected.history.length > 0 ? (
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={selected.history}
              margin={{ top: 15, right: 15, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="formattedDate"
                stroke="var(--subtle-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                reversed
                domain={[1, 100]}
                ticks={[1, 10, 20, 50, 100]}
                stroke="var(--subtle-foreground)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--surface)",
                  borderColor: "var(--border)",
                  borderRadius: "12px",
                  boxShadow: "var(--shadow-md)",
                  color: "var(--foreground)",
                  fontSize: "13px",
                }}
                formatter={(val) => {
                  const num = Number(val);
                  const page = Math.ceil(num / 10);
                  return [`#${num} (Google Page ${page} of 10)`, "Position"];
                }}
              />
              <Line
                type="monotone"
                dataKey="position"
                name={selected.keyword}
                stroke="#0071e3"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#0071e3" }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted/30 text-[13px] text-muted-foreground">
          No ranking checks recorded for this keyword yet. Run a daily check or click &quot;Check Rankings Now&quot;.
        </div>
      )}
    </div>
  );
}
