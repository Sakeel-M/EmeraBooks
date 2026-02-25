import { TrendingUp, TrendingDown, PiggyBank, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnalysisData } from "@/pages/Index";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface MetricsCardsProps {
  analysisData: AnalysisData;
}

const MetricsCards = ({ analysisData }: MetricsCardsProps) => {
  const { ai_analysis, bank_info } = analysisData;
  const currency = bank_info.currency;
  const incomeVsExpenses = ai_analysis.income_vs_expenses;
  const healthScore = ai_analysis.financial_health?.score || 75;

  const formatCurrency = (amount: number) => <FormattedCurrency amount={amount} currency={currency} />;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="p-6 hover:shadow-orange transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Income</span>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(incomeVsExpenses.total_income)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Total earnings</p>
        </div>
      </Card>

      <Card className="p-6 hover:shadow-orange transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Expenses</span>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(incomeVsExpenses.total_expenses)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Total spending</p>
        </div>
      </Card>

      <Card className="p-6 hover:shadow-orange transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
            <PiggyBank className="w-6 h-6 text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">Profit</span>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(incomeVsExpenses.net_savings)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {incomeVsExpenses.savings_rate.toFixed(1)}% savings rate
          </p>
        </div>
      </Card>

      <Card className="p-6 bg-gradient-primary hover:shadow-orange transition-shadow">
        <div className="flex items-start justify-between mb-2">
          <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-xs font-medium text-primary-foreground/80">Health Score</span>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-bold text-primary-foreground">
            {healthScore}/100
          </p>
          <p className="text-sm text-primary-foreground/80 mt-1">
            {ai_analysis.financial_health?.category || 'Good'}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default MetricsCards;
