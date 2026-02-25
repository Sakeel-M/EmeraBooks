import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";
import { CurrencyAxisTick } from "@/components/shared/CurrencyAxisTick";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface AreaTrendChartProps {
  data: Array<Record<string, any>>;
  areas: Array<{
    dataKey: string;
    name: string;
    gradientId: string;
    color: string;
  }>;
  height?: number;
  isCurrency?: boolean;
  currency?: string;
}

const CustomTooltip = ({ active, payload, label, isCurrency, currency = "USD" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95">
        <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-bold" style={{ color: item.color }}>
                {isCurrency ? <FormattedCurrency amount={item.value} currency={currency} /> : item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function AreaTrendChart({
  data,
  areas,
  height = 300,
  isCurrency = true,
  currency = "USD",
}: AreaTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <defs>
          {areas.map((area) => (
            <linearGradient
              key={area.gradientId}
              id={area.gradientId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor={area.color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={area.color} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={isCurrency ? <CurrencyAxisTick currency={currency} anchor="end" /> : { fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
        <Tooltip content={<CustomTooltip isCurrency={isCurrency} currency={currency} />} />
        <Legend
          wrapperStyle={{ paddingTop: 20 }}
          formatter={(value) => (
            <span className="text-sm text-muted-foreground">{value}</span>
          )}
        />
        {areas.map((area) => (
          <Area
            key={area.dataKey}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name}
            stroke={area.color}
            strokeWidth={2}
            fill={`url(#${area.gradientId})`}
            animationBegin={0}
            animationDuration={1000}
            animationEasing="ease-out"
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
