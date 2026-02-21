import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatAmount, formatCompactCurrency } from "@/lib/utils";

interface YoYData {
  month: string;
  currentYear: number;
  previousYear: number;
}

interface YoYComparisonChartProps {
  revenueData: YoYData[];
  expenseData: YoYData[];
  currentYearLabel?: string;
  previousYearLabel?: string;
  currency?: string;
}

const CustomTooltip = ({ active, payload, label, currency = "USD" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/95 backdrop-blur-sm border border-border rounded-lg shadow-xl p-4 animate-in fade-in-0 zoom-in-95">
        <p className="text-sm font-medium text-muted-foreground mb-2">{label}</p>
        <div className="space-y-2">
          {payload.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: item.fill }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-bold text-foreground">
                {formatAmount(item.value, currency)}
              </span>
            </div>
          ))}
        </div>
        {payload.length >= 2 && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Change</span>
              {(() => {
                const change = ((payload[0].value - payload[1].value) / (payload[1].value || 1)) * 100;
                const isPositive = change >= 0;
                return (
                  <span className={`text-sm font-bold flex items-center gap-1 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                    {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    {Math.abs(change).toFixed(1)}%
                  </span>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

function calculateGrowth(currentData: YoYData[]) {
  const currentTotal = currentData.reduce((sum, d) => sum + d.currentYear, 0);
  const previousTotal = currentData.reduce((sum, d) => sum + d.previousYear, 0);
  const growth = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;
  return { currentTotal, previousTotal, growth };
}

export function YoYComparisonChart({
  revenueData,
  expenseData,
  currentYearLabel = "2024",
  previousYearLabel = "2023",
  currency = "USD",
}: YoYComparisonChartProps) {
  const revenueStats = calculateGrowth(revenueData);
  const expenseStats = calculateGrowth(expenseData);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          Year-over-Year Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 bg-gradient-to-br from-green-500/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Revenue Growth</h4>
              <div className={`flex items-center gap-1 text-sm font-bold ${revenueStats.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {revenueStats.growth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(revenueStats.growth).toFixed(1)}%
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatAmount(revenueStats.currentTotal, currency)}</span>
              <span className="text-sm text-muted-foreground">vs {formatAmount(revenueStats.previousTotal, currency)}</span>
            </div>
          </div>
          
          <div className="rounded-lg border p-4 bg-gradient-to-br from-red-500/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-muted-foreground">Expense Change</h4>
              <div className={`flex items-center gap-1 text-sm font-bold ${expenseStats.growth <= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {expenseStats.growth >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {Math.abs(expenseStats.growth).toFixed(1)}%
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{formatAmount(expenseStats.currentTotal, currency)}</span>
              <span className="text-sm text-muted-foreground">vs {formatAmount(expenseStats.previousTotal, currency)}</span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Revenue Comparison</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="currentRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={1} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="previousRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v, currency)} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Bar dataKey="currentYear" name={currentYearLabel} fill="url(#currentRevenue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="previousYear" name={previousYearLabel} fill="url(#previousRevenue)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Expense Chart */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Expense Comparison</h4>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={expenseData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="currentExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.danger} stopOpacity={1} />
                    <stop offset="100%" stopColor={CHART_COLORS.danger} stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="previousExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.danger} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={CHART_COLORS.danger} stopOpacity={0.2} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} tickFormatter={(v) => formatCompactCurrency(v, currency)} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Bar dataKey="currentYear" name={currentYearLabel} fill="url(#currentExpense)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="previousYear" name={previousYearLabel} fill="url(#previousExpense)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded" style={{ background: CHART_COLORS.primary }} />
            <span className="text-sm text-muted-foreground">{currentYearLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 rounded opacity-40" style={{ background: CHART_COLORS.primary }} />
            <span className="text-sm text-muted-foreground">{previousYearLabel}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
