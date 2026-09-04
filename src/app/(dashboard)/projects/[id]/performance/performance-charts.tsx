"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatDateTime } from "@/lib/utils";

interface ScoreHistoryPoint {
  date: string;
  formattedDate: string;
  performance: number | null;
  seo: number | null;
  accessibility: number | null;
  bestPractices: number | null;
}

export function ScoreGauge({
  score,
  label,
  size = 84,
}: {
  score: number | null;
  label: string;
  size?: number;
}) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center gap-1.5 text-center">
        <div
          className="flex items-center justify-center rounded-full border border-border bg-surface-muted text-[16px] font-semibold text-muted-foreground"
          style={{ width: size, height: size }}
        >
          —
        </div>
        <span className="text-[13px] font-medium text-muted-foreground">
          {label}
        </span>
      </div>
    );
  }

  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const colorClass =
    score >= 90
      ? "text-success stroke-success"
      : score >= 50
      ? "text-warning stroke-warning"
      : "text-critical stroke-critical";

  const bgStroke = "var(--border)";

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="-rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={bgStroke}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className={`${colorClass} transition-all duration-700 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute text-[18px] font-bold tabular-nums">
          {score}
        </span>
      </div>
      <span className="text-[13px] font-medium text-foreground">{label}</span>
    </div>
  );
}

export function PerformanceTrendChart({
  data,
}: {
  data: ScoreHistoryPoint[];
}) {
  if (!data || data.length === 0) return null;

  return (
    <div className="h-64 w-full">
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
            domain={[0, 100]}
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
          <Line
            type="monotone"
            dataKey="performance"
            name="Performance"
            stroke="#0071e3"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#0071e3" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="seo"
            name="SEO"
            stroke="#34c759"
            strokeWidth={2}
            dot={{ r: 3, fill: "#34c759" }}
          />
          <Line
            type="monotone"
            dataKey="accessibility"
            name="Accessibility"
            stroke="#ff9500"
            strokeWidth={2}
            dot={{ r: 3, fill: "#ff9500" }}
          />
          <Line
            type="monotone"
            dataKey="bestPractices"
            name="Best Practices"
            stroke="#af52de"
            strokeWidth={2}
            dot={{ r: 3, fill: "#af52de" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
