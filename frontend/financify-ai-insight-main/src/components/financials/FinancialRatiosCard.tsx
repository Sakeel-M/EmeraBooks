import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { TrendingUp, TrendingDown, Activity, Scale, Percent, DollarSign } from "lucide-react";
import { RatioDetailSheet } from "@/components/financials/RatioDetailSheet";

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
  const [selectedRatio, setSelectedRatio] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Current Ratio = Current Assets / Current Liabilities
  // totalAssets is already the outstanding receivables proxy from Financials.tsx
  const currentRatio = totalLiabilities > 0 ? totalAssets / totalLiabilities : null;

  // Quick Ratio = (Current Assets - Inventory) / Current Liabilities
  // For a service business, inventory ≈ 0, so quick assets ≈ 90% of current assets
  const quickRatio = totalLiabilities > 0 ? (totalAssets * 0.9) / totalLiabilities : null;

  // Debt to Equity — 0.0x is excellent (no debt), show gauge when equity exists
  const debtToEquity = equity > 0 ? totalLiabilities / equity : null;
  const debtToEquityDisplay = debtToEquity ?? 0;
  const debtToEquityAvailable = equity > 0;

  // ROA & ROE — use larger maxValues so gauge doesn't cap prematurely
  const roa = totalAssets > 0 ? (netIncome / totalAssets) * 100 : null;
  const roe = equity > 0 ? (netIncome / equity) * 100 : null;

  const ratios = [
    {
      label: "Profit Margin",
      value: profitMargin,
      maxValue: 100,
      icon: Percent,
      description: "Net income as % of revenue",
      benchmark: "Target: ≥ 20%",
      colorClass: profitMargin >= 20 ? "text-green-500" : profitMargin >= 10 ? "text-amber-500" : "text-red-500",
      isAvailable: totalRevenue > 0,
      suffix: "%",
    },
    {
      label: "Current Ratio",
      value: currentRatio ?? 0,
      maxValue: 4,
      icon: Scale,
      description: "Current assets vs liabilities",
      benchmark: "Target: ≥ 1.5x",
      colorClass: (currentRatio ?? 0) >= 1.5 ? "text-green-500" : (currentRatio ?? 0) >= 1 ? "text-amber-500" : "text-red-500",
      suffix: "x",
      isAvailable: currentRatio !== null,
    },
    {
      label: "Quick Ratio",
      value: quickRatio ?? 0,
      maxValue: 4,
      icon: Activity,
      description: "Liquid assets vs liabilities",
      benchmark: "Target: ≥ 1.0x",
      colorClass: (quickRatio ?? 0) >= 1 ? "text-green-500" : (quickRatio ?? 0) >= 0.5 ? "text-amber-500" : "text-red-500",
      suffix: "x",
      isAvailable: quickRatio !== null,
    },
    {
      label: "Debt to Equity",
      value: debtToEquityDisplay,
      maxValue: 3,
      icon: TrendingDown,
      description: "Financial leverage ratio",
      benchmark: "Good: ≤ 1.0x",
      colorClass: debtToEquityDisplay <= 0.5 ? "text-green-500" : debtToEquityDisplay <= 1 ? "text-amber-500" : "text-red-500",
      suffix: "x",
      isAvailable: debtToEquityAvailable,
    },
    {
      label: "ROA",
      value: Math.abs(roa ?? 0),
      maxValue: 100,
      icon: TrendingUp,
      description: "Return on assets",
      benchmark: "Good: ≥ 10%",
      colorClass: (roa ?? 0) >= 10 ? "text-green-500" : (roa ?? 0) >= 5 ? "text-amber-500" : "text-red-500",
      suffix: "%",
      isAvailable: roa !== null,
    },
    {
      label: "ROE",
      value: Math.abs(roe ?? 0),
      maxValue: 150,
      icon: DollarSign,
      description: "Return on equity",
      benchmark: "Good: ≥ 15%",
      colorClass: (roe ?? 0) >= 15 ? "text-green-500" : (roe ?? 0) >= 8 ? "text-amber-500" : "text-red-500",
      suffix: "%",
      isAvailable: roe !== null,
    },
  ];

  const selectedRatioData = ratios.find((r) => r.label === selectedRatio) ?? null;

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Financial Ratios
            <span className="text-xs font-normal text-muted-foreground ml-1">(click any gauge for details)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {ratios.map((ratio) => (
              <div
                key={ratio.label}
                className="flex flex-col items-center gap-1 cursor-pointer rounded-xl p-2 transition-all duration-200 hover:bg-muted/50 hover:ring-2 hover:ring-primary/20 hover:shadow-sm"
                onClick={() => {
                  setSelectedRatio(ratio.label);
                  setSheetOpen(true);
                }}
              >
                {ratio.isAvailable ? (
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
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                      <svg className="transform -rotate-90" width={100} height={100}>
                        <circle cx={50} cy={50} r={40} stroke="currentColor" strokeWidth={10} fill="none" className="text-muted/30" />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-lg font-semibold text-muted-foreground">N/A</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-muted-foreground">{ratio.label}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-center max-w-[100px] min-h-[32px] flex items-start justify-center leading-tight">
                  {ratio.description}
                </p>
                <span className="text-[10px] text-muted-foreground/60 text-center font-medium">
                  {ratio.benchmark}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <RatioDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        ratio={selectedRatioData}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        netIncome={netIncome}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        equity={equity}
      />
    </>
  );
}
