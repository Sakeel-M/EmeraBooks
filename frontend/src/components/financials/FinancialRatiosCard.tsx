import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { TrendingUp, TrendingDown, Activity, Scale, Percent, DollarSign } from "lucide-react";
import { formatCurrencyValue } from "@/lib/chartColors";

interface FinancialRatiosCardProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

export function FinancialRatiosCard({
  totalRevenue,
  totalExpenses,
  netIncome,
  totalAssets,
  totalLiabilities,
  equity,
}: FinancialRatiosCardProps) {
  // Calculate financial ratios
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;
  const currentRatio = totalLiabilities > 0 ? (totalAssets * 0.4) / totalLiabilities : 0;
  const quickRatio = totalLiabilities > 0 ? (totalAssets * 0.3) / totalLiabilities : 0;
  const debtToEquity = equity > 0 ? totalLiabilities / equity : 0;
  const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : 0;
  const roe = equity > 0 ? (netIncome / equity) * 100 : 0;

  const ratios = [
    {
      label: "Profit Margin",
      value: profitMargin,
      maxValue: 100,
      icon: Percent,
      description: "Net income as % of revenue",
      colorClass: profitMargin >= 20 ? "text-green-500" : profitMargin >= 10 ? "text-amber-500" : "text-red-500",
    },
    {
      label: "Current Ratio",
      value: currentRatio,
      maxValue: 3,
      icon: Scale,
      description: "Ability to pay short-term obligations",
      colorClass: currentRatio >= 1.5 ? "text-green-500" : currentRatio >= 1 ? "text-amber-500" : "text-red-500",
      suffix: "",
    },
    {
      label: "Quick Ratio",
      value: quickRatio,
      maxValue: 3,
      icon: Activity,
      description: "Liquid assets vs liabilities",
      colorClass: quickRatio >= 1 ? "text-green-500" : quickRatio >= 0.5 ? "text-amber-500" : "text-red-500",
      suffix: "",
    },
    {
      label: "Debt to Equity",
      value: debtToEquity,
      maxValue: 2,
      icon: TrendingDown,
      description: "Financial leverage",
      colorClass: debtToEquity <= 0.5 ? "text-green-500" : debtToEquity <= 1 ? "text-amber-500" : "text-red-500",
      suffix: "",
    },
    {
      label: "ROA",
      value: Math.abs(roa),
      maxValue: 30,
      icon: TrendingUp,
      description: "Return on assets",
      colorClass: roa >= 10 ? "text-green-500" : roa >= 5 ? "text-amber-500" : "text-red-500",
    },
    {
      label: "ROE",
      value: Math.abs(roe),
      maxValue: 50,
      icon: DollarSign,
      description: "Return on equity",
      colorClass: roe >= 15 ? "text-green-500" : roe >= 8 ? "text-amber-500" : "text-red-500",
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Financial Ratios
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {ratios.map((ratio) => (
            <div key={ratio.label} className="flex flex-col items-center">
              <RadialGauge
                value={ratio.value}
                maxValue={ratio.maxValue}
                label={ratio.label}
                colorClass={ratio.colorClass}
                size={100}
                strokeWidth={10}
                suffix={ratio.suffix ?? "%"}
                showPercentage={true}
              />
              <p className="text-xs text-muted-foreground text-center mt-2 max-w-[120px]">
                {ratio.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
