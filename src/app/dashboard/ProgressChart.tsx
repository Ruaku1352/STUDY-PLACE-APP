"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMinutesAsHM } from "@/lib/formatMinutes";

export interface SubjectProgress {
  subjectId: string;
  name: string;
  quotaMin: number;
  actualMin: number;
  percent: number;
  status: "good" | "critical";
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SubjectProgress }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "0.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.85rem",
      }}
    >
      <div style={{ fontWeight: 600 }}>{d.name}</div>
      <div className="muted">
        {formatMinutesAsHM(d.actualMin)} / {formatMinutesAsHM(d.quotaMin)}（{d.percent}%）
      </div>
    </div>
  );
}

export function ProgressChart({
  data,
  idealPacePercent,
}: {
  data: SubjectProgress[];
  idealPacePercent: number;
}) {
  const maxPercent = Math.max(100, ...data.map((d) => d.percent));

  return (
    <div>
      <div className="row" style={{ gap: "0.5rem 1rem", marginBottom: "0.5rem", fontSize: "0.8rem", flexWrap: "wrap" }}>
        <span className="row" style={{ gap: "0.35rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "0.65rem",
              height: "0.65rem",
              borderRadius: "999px",
              background: "var(--status-good)",
            }}
          />
          順調
        </span>
        <span className="row" style={{ gap: "0.35rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "0.65rem",
              height: "0.65rem",
              borderRadius: "999px",
              background: "var(--status-critical)",
            }}
          />
          遅れている
        </span>
        <span className="row" style={{ gap: "0.35rem" }}>
          <span
            style={{
              display: "inline-block",
              width: "0.9rem",
              height: 0,
              borderTop: "2px dashed var(--chart-reference)",
            }}
          />
          理想ペース
        </span>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 56)}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
          <XAxis
            type="number"
            domain={[0, maxPercent]}
            tickFormatter={(v: number) => `${v}%`}
            stroke="var(--muted)"
            fontSize={12}
          />
          <YAxis type="category" dataKey="name" width={90} stroke="var(--muted)" fontSize={12} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--border)", opacity: 0.3 }} />
          <ReferenceLine x={idealPacePercent} stroke="var(--chart-reference)" strokeDasharray="4 4" />
          <Bar dataKey="percent" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell key={d.subjectId} fill={d.status === "good" ? "var(--status-good)" : "var(--status-critical)"} />
            ))}
            <LabelList
              dataKey="percent"
              position="right"
              formatter={(v) => `${v}%`}
              fill="var(--foreground)"
              fontSize={12}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table style={{ width: "100%", marginTop: "1rem", fontSize: "0.85rem", borderCollapse: "collapse" }}>
        <caption className="muted" style={{ textAlign: "left", marginBottom: "0.4rem" }}>
          データ表（グラフの代替）
        </caption>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "0.3rem 0" }}>科目</th>
            <th style={{ textAlign: "right", padding: "0.3rem 0" }}>実績</th>
            <th style={{ textAlign: "right", padding: "0.3rem 0" }}>ノルマ</th>
            <th style={{ textAlign: "right", padding: "0.3rem 0" }}>達成率</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.subjectId} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "0.3rem 0" }}>{d.name}</td>
              <td style={{ textAlign: "right", padding: "0.3rem 0" }}>{formatMinutesAsHM(d.actualMin)}</td>
              <td style={{ textAlign: "right", padding: "0.3rem 0" }}>{formatMinutesAsHM(d.quotaMin)}</td>
              <td
                style={{
                  textAlign: "right",
                  padding: "0.3rem 0",
                  color: d.status === "good" ? "var(--status-good)" : "var(--status-critical)",
                  fontWeight: 600,
                }}
              >
                {d.percent}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
