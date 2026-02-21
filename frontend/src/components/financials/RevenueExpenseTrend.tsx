import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatAmount, formatCompactCurrency } from "@/lib/utils";

interface TrendData {
  month: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

interface RevenueExpenseTrendProps {
  data: TrendData[];
  currency?: string;
  onStatClick?: (type: "revenue" | "expenses" | "net-income") => void;
}

const CustomTooltip = ({ active, payload, label, currency = "USD" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95">
        <p className="text-sm font-medium text-muted-foreground mb-3">{label}</p>
        <div className="space-y-2">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color || item.stroke }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {formatAmount(item.value, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export function RevenueExpenseTrend({ data, currency = "USD", onStatClick }: RevenueExpenseTrendProps) {
  const totalRevenue = data.reduce((sum, d) => sum + d.revenue, 0);
  const totalExpenses = data.reduce((sum, d) => sum + d.expenses, 0);
  const totalNetIncome = data.reduce((sum, d) => sum + d.netIncome, 0);
  const avgMonthlyRevenue = data.length > 0 ? totalRevenue / data.length : 0;
  const profitMargin = totalRevenue > 0 ? (totalNetIncome / totalRevenue) * 100 : 0;

  // Calculate trend
  const firstHalf = data.slice(0, Math.ceil(data.length / 2));
  const secondHalf = data.slice(Math.ceil(data.length / 2));
  const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.revenue, 0);
  const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.revenue, 0);
  const trend = firstHalfRevenue > 0 ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100 : 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Revenue vs Expenses Trend
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className={`text-center p-3 rounded-lg bg-muted/30 transition-all ${onStatClick ? "cursor-pointer hover:ring-1 hover:ring-primary/30 hover:bg-muted/50" : ""}`}
            onClick={() => onStatClick?.("revenue")}
            title={onStatClick ? "Click for revenue details" : undefined}
          >
            <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-green-600">{formatAmount(totalRevenue, currency)}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg bg-muted/30 transition-all ${onStatClick ? "cursor-pointer hover:ring-1 hover:ring-primary/30 hover:bg-muted/50" : ""}`}
            onClick={() => onStatClick?.("expenses")}
            title={onStatClick ? "Click for expenses details" : undefined}
          >
            <p className="text-xs text-muted-foreground mb-1">Total Expenses</p>
            <p className="text-lg font-bold text-red-500">{formatAmount(totalExpenses, currency)}</p>
          </div>
          <div
            className={`text-center p-3 rounded-lg bg-muted/30 transition-all ${onStatClick ? "cursor-pointer hover:ring-1 hover:ring-primary/30 hover:bg-muted/50" : ""}`}
            onClick={() => onStatClick?.("net-income")}
            title={onStatClick ? "Click for net income details" : undefined}
          >
            <p className="text-xs text-muted-foreground mb-1">Net Income</p>
            <p className={`text-lg font-bold ${totalNetIncome >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
              {formatAmount(totalNetIncome, currency)}
            </p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">Trend</p>
            <p className={`text-lg font-bold flex items-center justify-center gap-1 ${trend >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(trend).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Main Chart */}
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.danger} stopOpacity={0.3} />
                <stop offset="100%" stopColor={CHART_COLORS.danger} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
              tickFormatter={(value) => formatCompactCurrency(value, currency)}
            />
            <Tooltip content={<CustomTooltip currency={currency} />} />
            <Legend
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke={CHART_COLORS.success}
              strokeWidth={2}
              fill="url(#revenueGradient)"
              animationBegin={0}
              animationDuration={1000}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              name="Expenses"
              stroke={CHART_COLORS.danger}
              strokeWidth={2}
              fill="url(#expenseGradient)"
              animationBegin={200}
              animationDuration={1000}
            />
            <Line
              type="monotone"
              dataKey="netIncome"
              name="Net Income"
              stroke={CHART_COLORS.info}
              strokeWidth={3}
              dot={{ fill: CHART_COLORS.info, strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, strokeWidth: 0 }}
              animationBegin={400}
              animationDuration={1000}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
