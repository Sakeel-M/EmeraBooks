import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { CHART_COLORS, formatCurrencyValue } from "@/lib/chartColors";

interface GradientBarChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  height?: number;
  showGrid?: boolean;
  isCurrency?: boolean;
  gradientId?: string;
  barRadius?: number;
}

const CustomTooltip = ({ active, payload, label, isCurrency }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
        <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-bold text-foreground">
          {isCurrency ? formatCurrencyValue(payload[0].value) : payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export function GradientBarChart({
  data,
  height = 300,
  showGrid = true,
  isCurrency = true,
  gradientId = "barGradient",
  barRadius = 8,
}: GradientBarChartProps) {
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || CHART_COLORS.series[index % CHART_COLORS.series.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={dataWithColors} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <defs>
          {dataWithColors.map((item, index) => (
            <linearGradient
              key={`gradient-${index}`}
              id={`${gradientId}-${index}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={item.color} stopOpacity={1} />
              <stop offset="100%" stopColor={item.color} stopOpacity={0.6} />
            </linearGradient>
          ))}
        </defs>
        {showGrid && (
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
        )}
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          tickFormatter={(value) =>
            isCurrency ? `$${(value / 1000).toFixed(0)}k` : value.toLocaleString()
          }
        />
        <Tooltip content={<CustomTooltip isCurrency={isCurrency} />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} />
        <Bar
          dataKey="value"
          radius={[barRadius, barRadius, 0, 0]}
          animationBegin={0}
          animationDuration={1000}
          animationEasing="ease-out"
        >
          {dataWithColors.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={`url(#${gradientId}-${index})`}
              style={{
                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))",
                cursor: "pointer",
              }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
