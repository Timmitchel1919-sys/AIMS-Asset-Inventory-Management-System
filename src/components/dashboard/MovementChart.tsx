import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function MovementChart({
  data,
}: {
  data: Array<{ d: string; issues: number; returns: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="issueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="d" tickLine={false} axisLine={false} />
        <YAxis tickLine={false} axisLine={false} />
        <Tooltip />
        <Area
          type="monotone"
          dataKey="issues"
          stroke="var(--color-primary)"
          fill="url(#issueFill)"
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="returns"
          stroke="var(--color-info)"
          fill="transparent"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
