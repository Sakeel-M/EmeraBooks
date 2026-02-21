import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";

interface DonutChartProps {
  data: Array<{ name: string; value: number; color?: string }>;
  centerLabel?: string;
  centerValue?: string | number;
  height?: number;
  showLegend?: boolean;
  isCurrency?: boolean;
  currency?: string;
  onSliceClick?: (item: { name: string; value: number }) => void;
}

const CustomTooltip = ({ active, payload, isCurrency, currency = "USD" }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-3 animate-in fade-in-0 zoom-in-95">
        <p className="text-sm font-medium text-foreground">{data.name}</p>
        <p className="text-lg font-bold" style={{ color: data.payload.color }}>
          {isCurrency ? formatAmount(data.value, currency) : data.value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  height = 200,
  showLegend = true,
  isCurrency = false,
  currency = "USD",
  onSliceClick,
}: DonutChartProps) {
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || CHART_COLORS.series[index % CHART_COLORS.series.length],
  }));

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ height, width: height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithColors}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="value"
              animationBegin={0}
              animationDuration={1000}
              animationEasing="ease-out"
              onClick={(data) => onSliceClick?.({ name: data.name, value: data.value })}
            >
              {dataWithColors.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                  style={{
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.1))",
                    cursor: onSliceClick ? "pointer" : "default",
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip isCurrency={isCurrency} currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>
        {(centerLabel || centerValue) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            {centerValue && (
              <span className="text-2xl font-bold text-foreground">
              {typeof centerValue === "number"
                  ? isCurrency
                    ? formatAmount(centerValue, currency)
                    : centerValue.toLocaleString()
                  : centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-xs text-muted-foreground">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      {showLegend && (
        <div className="flex flex-wrap justify-center gap-4">
          {dataWithColors.map((item, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-muted-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
