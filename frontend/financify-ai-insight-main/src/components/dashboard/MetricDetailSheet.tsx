import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, TrendingUp, TrendingDown, PiggyBank, Calculator, ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { Transaction } from "@/lib/database";

type MetricType = "income" | "expenses" | "savings" | "average" | null;

interface MetricDetailSheetProps {
  metricType: MetricType;
  transactions: Transaction[];
  currency: string;
  onClose: () => void;
}

const fmt = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

const MetricDetailSheet = ({ metricType, transactions, currency, onClose }: MetricDetailSheetProps) => {
  const [search, setSearch] = useState("");

  const titles: Record<string, { title: string; icon: React.ElementType; description: string }> = {
    income: { title: "Total Income", icon: TrendingUp, description: "Breakdown of all income transactions" },
    expenses: { title: "Total Expenses", icon: TrendingDown, description: "Breakdown of all expense transactions" },
    savings: { title: "Profit", icon: PiggyBank, description: "Monthly income vs expenses analysis" },
    average: { title: "Avg Transaction", icon: Calculator, description: "Transaction statistics and distribution" },
  };

  const config = metricType ? titles[metricType] : null;

  return (
    <Sheet open={!!metricType} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        {config && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <config.icon className="w-5 h-5 text-primary" />
                <SheetTitle>{config.title}</SheetTitle>
              </div>
              <SheetDescription>{config.description}</SheetDescription>
            </SheetHeader>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <ScrollArea className="flex-1 mt-4 -mx-6 px-6">
              {metricType === "income" && <IncomeView transactions={transactions} currency={currency} search={search} />}
              {metricType === "expenses" && <ExpensesView transactions={transactions} currency={currency} search={search} />}
              {metricType === "savings" && <SavingsView transactions={transactions} currency={currency} search={search} />}
              {metricType === "average" && <AverageView transactions={transactions} currency={currency} search={search} />}
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

// --- Income View ---
const IncomeView = ({ transactions, currency, search }: { transactions: Transaction[]; currency: string; search: string }) => {
  const incomeTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.amount > 0)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, search]);

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    incomeTransactions.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + t.amount));
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [incomeTransactions]);

  const total = incomeTransactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-4 pb-6">
      <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
        <p className="text-sm text-muted-foreground">Total Income</p>
        <p className="text-2xl font-bold text-green-600">{fmt(total, currency)}</p>
        <p className="text-xs text-muted-foreground mt-1">{incomeTransactions.length} transactions</p>
      </Card>

      {topSources.length > 0 && (
        <>
          <h4 className="text-sm font-semibold text-foreground">Top Sources</h4>
          <div className="space-y-2">
            {topSources.map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="w-3 h-3 text-green-500" />
                  <span className="text-sm text-foreground">{category}</span>
                </div>
                <span className="text-sm font-medium text-foreground">{fmt(amount, currency)}</span>
              </div>
            ))}
          </div>
          <Separator />
        </>
      )}

      <h4 className="text-sm font-semibold text-foreground">All Income Transactions</h4>
      <TransactionList transactions={incomeTransactions} currency={currency} type="income" />
    </div>
  );
};

// --- Expenses View ---
const ExpensesView = ({ transactions, currency, search }: { transactions: Transaction[]; currency: string; search: string }) => {
  const expenseTransactions = useMemo(() => {
    return transactions
      .filter((t) => t.amount < 0)
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.category.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.amount - b.amount);
  }, [transactions, search]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    expenseTransactions.forEach((t) => map.set(t.category, (map.get(t.category) || 0) + Math.abs(t.amount)));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenseTransactions]);

  const total = expenseTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-4 pb-6">
      <Card className="p-4 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
        <p className="text-sm text-muted-foreground">Total Expenses</p>
        <p className="text-2xl font-bold text-red-600">{fmt(total, currency)}</p>
        <p className="text-xs text-muted-foreground mt-1">{expenseTransactions.length} transactions</p>
      </Card>

      {categoryBreakdown.length > 0 && (
        <>
          <h4 className="text-sm font-semibold text-foreground">By Category</h4>
          <div className="space-y-2">
            {categoryBreakdown.map(([category, amount]) => {
              const pct = total > 0 ? ((amount / total) * 100).toFixed(1) : "0";
              return (
                <div key={category} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                    <span className="text-sm text-foreground">{category}</span>
                    <Badge variant="secondary" className="text-xs">{pct}%</Badge>
                  </div>
                  <span className="text-sm font-medium text-foreground">{fmt(amount, currency)}</span>
                </div>
              );
            })}
          </div>
          <Separator />
        </>
      )}

      <h4 className="text-sm font-semibold text-foreground">All Expense Transactions</h4>
      <TransactionList transactions={expenseTransactions} currency={currency} type="expense" />
    </div>
  );
};

// --- Savings View ---
const SavingsView = ({ transactions, currency, search }: { transactions: Transaction[]; currency: string; search: string }) => {
  const totalIncome = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netSavings = totalIncome - totalExpenses;

  const monthlyData = useMemo(() => {
    const map = new Map<string, { income: number; expenses: number }>();
    transactions
      .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .forEach((t) => {
        const month = t.transaction_date.substring(0, 7); // YYYY-MM
        const entry = map.get(month) || { income: 0, expenses: 0 };
        if (t.amount > 0) entry.income += t.amount;
        else entry.expenses += Math.abs(t.amount);
        map.set(month, entry);
      });
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({ month, ...data, net: data.income - data.expenses }));
  }, [transactions, search]);

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Income</p>
          <p className="text-sm font-bold text-green-600">{fmt(totalIncome, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Expenses</p>
          <p className="text-sm font-bold text-red-600">{fmt(totalExpenses, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Net</p>
          <p className={`text-sm font-bold ${netSavings >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(netSavings, currency)}</p>
        </Card>
      </div>

      <h4 className="text-sm font-semibold text-foreground">Monthly Breakdown</h4>
      <div className="space-y-2">
        {monthlyData.map((m) => (
          <Card key={m.month} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-foreground">{m.month}</span>
              <span className={`text-sm font-bold ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                {m.net >= 0 ? "+" : ""}{fmt(m.net, currency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>In: {fmt(m.income, currency)}</span>
              <span>Out: {fmt(m.expenses, currency)}</span>
            </div>
          </Card>
        ))}
        {monthlyData.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No data found</p>}
      </div>
    </div>
  );
};

// --- Average View ---
const AverageView = ({ transactions, currency, search }: { transactions: Transaction[]; currency: string; search: string }) => {
  const filtered = useMemo(
    () => transactions.filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase())),
    [transactions, search]
  );

  const stats = useMemo(() => {
    if (filtered.length === 0) return null;
    const amounts = filtered.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
    const sum = amounts.reduce((s, a) => s + a, 0);
    const mean = sum / amounts.length;
    const median = amounts.length % 2 === 0
      ? (amounts[amounts.length / 2 - 1] + amounts[amounts.length / 2]) / 2
      : amounts[Math.floor(amounts.length / 2)];
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    const stdDev = Math.sqrt(variance);
    return { mean, median, min: amounts[0], max: amounts[amounts.length - 1], stdDev, count: amounts.length };
  }, [filtered]);

  // Distribution ranges
  const ranges = useMemo(() => {
    if (!stats) return [];
    const buckets = [
      { label: "< 100", min: 0, max: 100 },
      { label: "100 - 500", min: 100, max: 500 },
      { label: "500 - 1K", min: 500, max: 1000 },
      { label: "1K - 5K", min: 1000, max: 5000 },
      { label: "5K - 10K", min: 5000, max: 10000 },
      { label: "10K+", min: 10000, max: Infinity },
    ];
    return buckets.map((b) => ({
      ...b,
      count: filtered.filter((t) => { const a = Math.abs(t.amount); return a >= b.min && a < b.max; }).length,
    })).filter((b) => b.count > 0);
  }, [filtered, stats]);

  if (!stats) return <p className="text-sm text-muted-foreground text-center py-8">No transactions to analyze</p>;

  const maxCount = Math.max(...ranges.map((r) => r.count));

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Mean</p>
          <p className="text-sm font-bold text-foreground">{fmt(stats.mean, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Median</p>
          <p className="text-sm font-bold text-foreground">{fmt(stats.median, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Lowest</p>
          <p className="text-sm font-bold text-foreground">{fmt(stats.min, currency)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-xs text-muted-foreground">Highest</p>
          <p className="text-sm font-bold text-foreground">{fmt(stats.max, currency)}</p>
        </Card>
      </div>

      <Card className="p-3 text-center">
        <p className="text-xs text-muted-foreground">Std Deviation</p>
        <p className="text-sm font-bold text-foreground">{fmt(stats.stdDev, currency)}</p>
        <p className="text-xs text-muted-foreground mt-1">{stats.count} total transactions</p>
      </Card>

      <h4 className="text-sm font-semibold text-foreground">Distribution</h4>
      <div className="space-y-2">
        {ranges.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 text-right">{r.label}</span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(r.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="text-xs font-medium text-foreground w-8">{r.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Shared Transaction List ---
const TransactionList = ({ transactions, currency, type }: { transactions: Transaction[]; currency: string; type: "income" | "expense" }) => (
  <div className="space-y-1">
    {transactions.slice(0, 50).map((t) => (
      <div key={t.id} className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-foreground truncate">{t.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{t.transaction_date}</span>
            <Badge variant="outline" className="text-xs">{t.category}</Badge>
          </div>
        </div>
        <span className={`text-sm font-medium ml-2 ${type === "income" ? "text-green-600" : "text-red-600"}`}>
          {fmt(Math.abs(t.amount), currency)}
        </span>
      </div>
    ))}
    {transactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transactions found</p>}
    {transactions.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Showing first 50 of {transactions.length}</p>}
  </div>
);

export default MetricDetailSheet;
