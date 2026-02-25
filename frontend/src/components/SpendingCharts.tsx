import { Card } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AnalysisData } from "@/pages/Index";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface SpendingChartsProps {
  analysisData: AnalysisData;
}

const COLORS = ['#FF6B35', '#FF8C42', '#FFA552', '#FFB562', '#FFC872'];

const SpendingCharts = ({ analysisData }: SpendingChartsProps) => {
  const { ai_analysis, bank_info } = analysisData;
  const currency = bank_info.currency;

  // Category data for pie chart
  const categoryData = ai_analysis.top_categories?.map((cat: any) => ({
    name: cat.name,
    value: cat.amount,
    percentage: cat.percentage,
  })) || [];

  // Monthly trends for bar chart
  const monthlyData = Object.entries(ai_analysis.monthly_trends || {}).map(([month, amount]: [string, any]) => ({
    month: month.split(' ')[0].slice(0, 3), // Short month name
    amount: amount,
  }));

  const formatCurrency = (value: number) => <FormattedCurrency amount={value} currency={currency} />;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Monthly Spending Trend */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Monthly Spending Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Category Breakdown */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-foreground mb-6">Spending by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={(entry) => `${entry.name} (${entry.percentage.toFixed(0)}%)`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {categoryData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
          </PieChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
};

export default SpendingCharts;
