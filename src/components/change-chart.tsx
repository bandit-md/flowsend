import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ScanToken } from "@/lib/market/types";

export function ChangeChart({ token }: { token: ScanToken }) {
  const data = [
    { label: "5m", value: token.change5m ?? 0, missing: token.change5m == null },
    { label: "1h", value: token.change1h ?? 0, missing: token.change1h == null },
    { label: "6h", value: token.change6h ?? 0, missing: token.change6h == null },
    { label: "24h", value: token.change24h ?? 0, missing: token.change24h == null },
  ];
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" stroke="var(--color-faint)" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--color-raised)" }}
            contentStyle={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              color: "var(--color-fg)",
            }}
            formatter={(value, _name, item) => {
              const missing = (item.payload as { missing?: boolean }).missing;
              return missing ? "No print" : `${Number(value).toFixed(2)}%`;
            }}
          />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.missing ? "var(--color-line)" : entry.value >= 0 ? "var(--color-primary)" : "var(--color-danger)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
