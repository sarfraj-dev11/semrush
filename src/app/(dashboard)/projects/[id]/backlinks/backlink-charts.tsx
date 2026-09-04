"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export function FollowRatioDonut({
  followCount,
  nofollowCount,
}: {
  followCount: number;
  nofollowCount: number;
}) {
  const data = [
    { name: "Follow", value: followCount, color: "#0071e3" },
    { name: "Nofollow", value: nofollowCount, color: "#8e8e93" },
  ].filter((d) => d.value > 0);

  if (data.length === 0) return null;

  return (
    <div className="flex h-36 items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={36}
            outerRadius={56}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
              borderRadius: "10px",
              boxShadow: "var(--shadow-sm)",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
