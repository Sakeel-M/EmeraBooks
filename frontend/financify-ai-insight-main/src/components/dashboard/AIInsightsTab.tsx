import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, CheckCircle, TrendingUp, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Transaction } from "@/lib/database";

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

  const generateInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      // Prepare summary for AI
      const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
      const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

      const categoryMap = new Map<string, number>();
      transactions.forEach((t) => {
        if (t.amount < 0) {
          const cat = t.category || "Uncategorized";
          categoryMap.set(cat, (categoryMap.get(cat) || 0) + Math.abs(t.amount));
        }
      });
      const topCategories = Array.from(categoryMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([name, amount]) => ({ name, amount }));

      const { data, error: fnError } = await supabase.functions.invoke("ai-financial-insights", {
        body: {
          totalIncome,
          totalExpenses,
          netSavings: totalIncome - totalExpenses,
          transactionCount: transactions.length,
          topCategories,
          currency,
        },
      });

      if (fnError) throw new Error(fnError.message || "Failed to get AI insights");
      if (data?.error) throw new Error(data.error);

      setInsights(data);
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

  if (!insights && !loading) {
    return (
      <Card className="p-12 text-center">
        <Brain className="w-16 h-16 mx-auto mb-4 text-primary" />
        <h3 className="text-xl font-bold text-foreground mb-2">AI-Powered Financial Insights</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Get personalized financial analysis powered by AI. Includes health score, spending patterns, and recommendations.
        </p>
        <Button onClick={generateInsights} size="lg">
          <Brain className="w-4 h-4 mr-2" />
          Generate AI Insights
        </Button>
        {error && (
          <div className="mt-4 flex items-center justify-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <p className="text-sm">{error}</p>
          </div>
        )}
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-12 text-center">
        <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-lg font-medium text-foreground">Generating AI Insights...</p>
        <p className="text-sm text-muted-foreground">Analyzing your financial data</p>
      </Card>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-6">
      {/* Health Score Banner */}
      <Card className={`p-6 ${getScoreColor(insights.financial_health_score)} text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">AI Financial Health Score</p>
            <p className="text-4xl font-bold">{insights.financial_health_score}/100</p>
            <p className="text-sm mt-1 opacity-90">{insights.score_category}</p>
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
        <Button variant="outline" onClick={generateInsights} disabled={loading}>
          <Brain className="w-4 h-4 mr-2" />
          Regenerate Insights
        </Button>
      </div>
    </div>
  );
};

export default AIInsightsTab;
