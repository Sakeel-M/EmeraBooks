import { TrendingUp, TrendingDown, PiggyBank, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface MetricCardsProps {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  avgTransaction: number;
  incomeCount: number;
  expenseCount: number;
  savingsRate: number;
  totalCount: number;
  currency: string;
  onCardClick?: (type: string) => void;
}

const MetricCards = ({
  totalIncome, totalExpenses, netSavings, avgTransaction,
  incomeCount, expenseCount, savingsRate, totalCount, currency, onCardClick,
}: MetricCardsProps) => {
  const cards = [
    {
      label: "Total Income",
      value: <FormattedCurrency amount={totalIncome} currency={currency} compact={totalIncome >= 10000} />,
      badge: `${incomeCount} txns`,
      icon: TrendingUp,
      borderColor: "border-l-green-500",
      iconBg: "bg-green-100 text-green-600",
      type: "income",
    },
    {
      label: "Total Expenses",
      value: <FormattedCurrency amount={totalExpenses} currency={currency} compact={totalExpenses >= 10000} />,
      badge: `${expenseCount} txns`,
      icon: TrendingDown,
      borderColor: "border-l-red-500",
      iconBg: "bg-red-100 text-red-600",
      type: "expenses",
    },
    {
      label: "Profit",
      value: <FormattedCurrency amount={netSavings} currency={currency} compact={netSavings >= 10000} />,
      badge: `${savingsRate.toFixed(1)}%`,
      icon: PiggyBank,
      borderColor: "border-l-green-500",
      iconBg: "bg-green-100 text-green-600",
      type: "savings",
    },
    {
      label: "Avg Transaction",
      value: <FormattedCurrency amount={avgTransaction} currency={currency} compact={avgTransaction >= 10000} />,
      badge: `${totalCount} txns`,
      icon: Calculator,
      borderColor: "border-l-blue-500",
      iconBg: "bg-blue-100 text-blue-600",
      type: "average",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className={`p-4 border-l-4 ${card.borderColor} cursor-pointer hover:shadow-md transition-shadow`} onClick={() => onCardClick?.(card.type)}>
          <div className="flex items-center justify-between mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
              <card.icon className="w-4 h-4" />
            </div>
            <Badge variant="secondary" className="text-xs">{card.badge}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className="text-xl font-bold text-foreground mt-1">{card.value}</p>
          {card.type === "income" && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              After VAT (5%): <FormattedCurrency amount={totalIncome * 0.95} currency={currency} compact={totalIncome * 0.95 >= 10000} />
            </p>
          )}
          {card.type === "savings" && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              After Corp. Tax (9%): <FormattedCurrency amount={netSavings * 0.91} currency={currency} compact={netSavings * 0.91 >= 10000} />
            </p>
          )}
        </Card>
      ))}
    </div>
  );
};

export default MetricCards;
