import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, CheckCircle, TrendingUp, Loader2, AlertCircle, CalendarRange } from "lucide-react";
import { api } from "@/lib/api";
import type { Transaction } from "@/lib/database";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { format } from "date-fns";

interface AIInsightsTabProps {
  transactions: Transaction[];
  currency: string;
}

interface AIInsightsData {
  financial_health_score: number;
  score_category: string;
  key_insights: string[];
  spending_patterns: string[];
  recommendations: string[];
}

const AIInsightsTab = ({ transactions, currency }: AIInsightsTabProps) => {
  const [insights, setInsights] = useState<AIInsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insightPeriod, setInsightPeriod] = useState<string | null>(null);

  // Derive default date range from the transactions passed in
  const defaultRange = useMemo(() => {
    if (transactions.length === 0) {
      const now = new Date();
      return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
    }
    const dates = transactions.map((t) => t.transaction_date).sort();
    const [y0, m0, d0] = dates[0].split("-").map(Number);
    const [y1, m1, d1] = dates[dates.length - 1].split("-").map(Number);
    return { from: new Date(y0, m0 - 1, d0), to: new Date(y1, m1 - 1, d1) };
  }, [transactions]);

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(defaultRange);

  // Filter transactions to the selected date range
  const filteredTxns = useMemo(() => {
    const fromStr = format(dateRange.from, "yyyy-MM-dd");
    const toStr = format(dateRange.to, "yyyy-MM-dd");
    return transactions.filter(
      (t) => t.transaction_date >= fromStr && t.transaction_date <= toStr
    );
  }, [transactions, dateRange]);

  const handleRangeChange = (from: Date, to: Date) => {
    setDateRange({ from, to });
    // Clear previous insights so user knows they need to regenerate for the new range
    setInsights(null);
    setInsightPeriod(null);
    setError(null);
  };

  const generateInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const totalIncome = filteredTxns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = filteredTxns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

      const categoryMap = new Map<string, number>();
      filteredTxns.forEach((t) => {
        if (t.amount < 0) {
          const cat = getCanonicalCategory(t.category, null, t.description);
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(t.amount));
        }
      });
      const topCategories = Array.from(categoryMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, amount]) => ({ name, amount }));

      const data = await api.aiInsights({
        totalIncome,
        totalExpenses,
        netSavings: totalIncome - totalExpenses,
        transactionCount: filteredTxns.length,
        topCategories,
        currency,
        periodFrom: format(dateRange.from, "MMM d, yyyy"),
        periodTo: format(dateRange.to, "MMM d, yyyy"),
      });

      if (data?.error) throw new Error(data.error);

      setInsights(data);
      setInsightPeriod(
        `${format(dateRange.from, "MMM d, yyyy")} – ${format(dateRange.to, "MMM d, yyyy")} · ${filteredTxns.length} transactions`
      );
    } catch (err: any) {
      console.error("AI insights error:", err);
      setError(err.message || "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-green-500";
    if (score >= 40) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Date picker is always shown at the top
  const datePicker = (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
            <CalendarRange className="w-4 h-4" />
            Date Range
          </div>
          <EnhancedDateRangePicker
            key={`${defaultRange.from.toISOString()}-${defaultRange.to.toISOString()}`}
            defaultRange={dateRange}
            onRangeChange={handleRangeChange}
          />
          <div className="text-xs text-muted-foreground shrink-0">
            {filteredTxns.length} transactions in range
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!insights && !loading) {
    return (
      <div className="space-y-4">
        {datePicker}
        <Card className="p-12 text-center">
          <Brain className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h3 className="text-xl font-bold text-foreground mb-2">AI-Powered Financial Insights</h3>
          <p className="text-muted-foreground mb-2 max-w-md mx-auto">
            Get personalized financial analysis powered by AI. Includes health score, spending patterns, and recommendations.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Selected period: <span className="font-medium text-foreground">
              {format(dateRange.from, "MMM d, yyyy")} – {format(dateRange.to, "MMM d, yyyy")}
            </span>
          </p>
          <Button onClick={generateInsights} size="lg" disabled={filteredTxns.length === 0}>
            <Brain className="w-4 h-4 mr-2" />
            Generate AI Insights
          </Button>
          {filteredTxns.length === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">No transactions in the selected date range.</p>
          )}
          {error && (
            <div className="mt-4 flex items-center justify-center gap-2 text-destructive">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {datePicker}
        <Card className="p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-lg font-medium text-foreground">Generating AI Insights...</p>
          <p className="text-sm text-muted-foreground">Analyzing your financial data</p>
        </Card>
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-6">
      {datePicker}

      {/* Health Score Banner */}
      <Card className={`p-6 ${getScoreColor(insights.financial_health_score)} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">AI Financial Health Score</p>
            <p className="text-4xl font-bold">{insights.financial_health_score}/100</p>
            <p className="text-sm mt-1 opacity-90">{insights.score_category}</p>
            {insightPeriod && (
              <p className="text-xs mt-2 opacity-70">{insightPeriod}</p>
            )}
          </div>
          <Brain className="w-16 h-16 opacity-30" />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Key Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-primary" />
              AI Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.key_insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{insight}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Spending Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Spending Patterns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.spending_patterns.map((pattern, i) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingUp className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground">{pattern}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personalized Recommendations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-primary-foreground">{i + 1}</span>
              </div>
              <p className="text-sm text-foreground">{rec}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center">
        <Button variant="outline" onClick={generateInsights} disabled={loading || filteredTxns.length === 0}>
          <Brain className="w-4 h-4 mr-2" />
          Regenerate Insights
        </Button>
      </div>
    </div>
  );
};

export default AIInsightsTab;
