import { TrendingUp, TrendingDown, PiggyBank, Calculator } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: amount >= 1000 ? 1 : 2,
      notation: amount >= 10000 ? "compact" : "standard",
    }).format(amount);

  const cards = [
    {
      label: "Total Income",
      value: fmt(totalIncome),
      badge: `${incomeCount} txns`,
      icon: TrendingUp,
      borderColor: "border-l-green-500",
      iconBg: "bg-green-100 text-green-600",
      type: "income",
    },
    {
      label: "Total Expenses",
      value: fmt(totalExpenses),
      badge: `${expenseCount} txns`,
      icon: TrendingDown,
      borderColor: "border-l-red-500",
      iconBg: "bg-red-100 text-red-600",
      type: "expenses",
    },
    {
      label: "Net Savings",
      value: fmt(netSavings),
      badge: `${savingsRate.toFixed(1)}%`,
      icon: PiggyBank,
      borderColor: "border-l-green-500",
      iconBg: "bg-green-100 text-green-600",
      type: "savings",
    },
    {
      label: "Avg Transaction",
      value: fmt(avgTransaction),
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
        </Card>
      ))}
    </div>
  );
};

export default MetricCards;
