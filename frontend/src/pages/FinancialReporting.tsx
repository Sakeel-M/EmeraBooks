import { useState, useMemo, useEffect, Fragment } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  FileText,
  Landmark,
  ArrowRightLeft,
  Scale,
  Calendar,
  Printer,
  Filter,
  Search,
  X,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Loader2,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useDateRange } from "@/hooks/useDateRange";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { getCanonicalCategory, resolveIncomeCategory } from "@/lib/sectorMapping";
import { TransactionDetailSheet } from "@/components/shared/TransactionDetailSheet";
import {
  format,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subYears,
} from "date-fns";

// ── NON P&L categories (transfers, internal) ─────────────────────────────

const NON_PL_CATEGORIES = [
  "internal transfer",
  "transfer",
  "wire transfer",
  "cash advance",
  "credit card payment",
  "loan payment",
  "owner draw",
  "owner contribution",
  "opening balance",
  "atm & cash deposits",
  "atm & withdrawals",
  "finance & banking",
];

function isPlCategory(cat: string): boolean {
  return !NON_PL_CATEGORIES.includes(cat.toLowerCase());
}

// ── Period helpers ────────────────────────────────────────────────────────

type PeriodKey = "this-month" | "last-month" | "this-quarter" | "last-quarter" | "this-year" | "last-year" | "last-12";

function getPeriodDates(key: PeriodKey): { start: string; end: string; label: string } {
  const now = new Date();
  switch (key) {
    case "this-month":
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
        label: format(now, "MMMM yyyy"),
      };
    case "last-month": {
      const lm = subMonths(now, 1);
      return {
        start: format(startOfMonth(lm), "yyyy-MM-dd"),
        end: format(endOfMonth(lm), "yyyy-MM-dd"),
        label: format(lm, "MMMM yyyy"),
      };
    }
    case "this-quarter": {
      const q = Math.floor(now.getMonth() / 3);
      const qs = new Date(now.getFullYear(), q * 3, 1);
      const qe = new Date(now.getFullYear(), q * 3 + 3, 0);
      return {
        start: format(qs, "yyyy-MM-dd"),
        end: format(qe, "yyyy-MM-dd"),
        label: `Q${q + 1} ${now.getFullYear()}`,
      };
    }
    case "last-quarter": {
      const q = Math.floor(now.getMonth() / 3) - 1;
      const year = q < 0 ? now.getFullYear() - 1 : now.getFullYear();
      const qAdj = q < 0 ? 3 : q;
      const qs = new Date(year, qAdj * 3, 1);
      const qe = new Date(year, qAdj * 3 + 3, 0);
      return {
        start: format(qs, "yyyy-MM-dd"),
        end: format(qe, "yyyy-MM-dd"),
        label: `Q${qAdj + 1} ${year}`,
      };
    }
    case "this-year":
      return {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(endOfYear(now), "yyyy-MM-dd"),
        label: `${now.getFullYear()}`,
      };
    case "last-year": {
      const ly = subYears(now, 1);
      return {
        start: format(startOfYear(ly), "yyyy-MM-dd"),
        end: format(endOfYear(ly), "yyyy-MM-dd"),
        label: `${ly.getFullYear()}`,
      };
    }
    case "last-12":
      return {
        start: format(subMonths(now, 12), "yyyy-MM-dd"),
        end: format(now, "yyyy-MM-dd"),
        label: "Last 12 Months",
      };
    default:
      return {
        start: format(startOfYear(now), "yyyy-MM-dd"),
        end: format(endOfYear(now), "yyyy-MM-dd"),
        label: `${now.getFullYear()}`,
      };
  }
}

// ── CSV export helper ─────────────────────────────────────────────────────

function downloadCSV(rows: string[][], filename: string) {
  const sanitize = (v: string) => {
    if (/^[=+\-@\t\r]/.test(v)) return `'${v}`;
    return v.includes(",") || v.includes('"')
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  };
  const csv = rows.map((r) => r.map(sanitize).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── P&L Tab ───────────────────────────────────────────────────────────────

function getSmartDefaultPeriod(globalStart: string): PeriodKey {
  if (!globalStart) return "this-year";
  const dataYear = parseInt(globalStart.slice(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (dataYear < currentYear) return "last-year";
  return "this-year";
}

function ProfitLossTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate: globalStart } = useDateRange();
  const [period, setPeriod] = useState<PeriodKey>(() => getSmartDefaultPeriod(globalStart));
  const [periodInitialized, setPeriodInitialized] = useState(!!globalStart);
  const [showExplain, setShowExplain] = useState(false);
  const [drillDown, setDrillDown] = useState<{title: string; description?: string; transactions: any[]} | null>(null);
  const { start, end, label } = getPeriodDates(period);

  // Re-initialize period once global date range resolves from backend
  useEffect(() => {
    if (globalStart && !periodInitialized) {
      setPeriod(getSmartDefaultPeriod(globalStart));
      setPeriodInitialized(true);
    }
  }, [globalStart, periodInitialized]);

  // Previous period dates (same duration, shifted back)
  const prevPeriod = useMemo(() => {
    const s = new Date(start);
    const e = new Date(end);
    const days = Math.round((e.getTime() - s.getTime()) / 86400000);
    const prevEnd = new Date(s.getTime() - 86400000); // day before current start
    const prevStart = new Date(prevEnd.getTime() - days * 86400000);
    return { start: format(prevStart, "yyyy-MM-dd"), end: format(prevEnd, "yyyy-MM-dd") };
  }, [start, end]);

  const { data: transactions = [], isFetching: _frLoad } = useQuery({
    queryKey: ["fr-txns", clientId, start, end],
    queryFn: () =>
      database.getTransactions(clientId!, {
        startDate: start,
        endDate: end,
        limit: 5000,
      }),
    enabled: !!clientId,
  });

  const { data: prevTransactions = [] } = useQuery({
    queryKey: ["fr-txns-prev", clientId, prevPeriod.start, prevPeriod.end],
    queryFn: () =>
      database.getTransactions(clientId!, {
        startDate: prevPeriod.start,
        endDate: prevPeriod.end,
        limit: 5000,
      }),
    enabled: !!clientId,
  });

  const _frLoading = _frLoad && transactions.length === 0;

  // Previous period totals
  const prevTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    prevTransactions.forEach((t: any) => {
      const entity = t.counterparty_name || t.description;
      const cat = t.amount > 0
        ? resolveIncomeCategory(t.category, entity, businessSector)
        : getCanonicalCategory(t.category, entity, t.description) || "Other";
      if (!isPlCategory(cat)) return;
      if (t.amount > 0) inc += t.amount;
      else exp += Math.abs(t.amount);
    });
    return { income: inc, expenses: exp, net: inc - exp };
  }, [prevTransactions]);

  const { income, expenses, incomeByCategory, expenseByCategory, monthlyData } =
    useMemo(() => {
      let inc = 0;
      let exp = 0;
      const incByCat: Record<string, number> = {};
      const expByCat: Record<string, number> = {};
      const monthly: Record<string, { income: number; expense: number }> = {};

      transactions.forEach((t: any) => {
        const entity = t.counterparty_name || t.description;
        const cat = t.amount > 0
          ? resolveIncomeCategory(t.category, entity, businessSector)
          : getCanonicalCategory(t.category, entity, t.description) || "Other";
        if (!isPlCategory(cat)) return;

        const month = t.transaction_date?.slice(0, 7);
        if (month) {
          if (!monthly[month]) monthly[month] = { income: 0, expense: 0 };
        }

        if (t.amount > 0) {
          inc += t.amount;
          incByCat[cat] = (incByCat[cat] || 0) + t.amount;
          if (month) monthly[month].income += t.amount;
        } else {
          const abs = Math.abs(t.amount);
          exp += abs;
          expByCat[cat] = (expByCat[cat] || 0) + abs;
          if (month) monthly[month].expense += abs;
        }
      });

      const monthlyArr = Object.entries(monthly)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([m, d]) => ({
          month: format(new Date(m + "-01"), "MMM yy"),
          income: d.income,
          expense: d.expense,
          net: d.income - d.expense,
        }));

      return {
        income: inc,
        expenses: exp,
        incomeByCategory: Object.entries(incByCat).sort(([, a], [, b]) => b - a),
        expenseByCategory: Object.entries(expByCat).sort(([, a], [, b]) => b - a),
        monthlyData: monthlyArr,
      };
    }, [transactions, businessSector]);

  const netIncome = income - expenses;
  const margin = income > 0 ? (netIncome / income) * 100 : 0;

  const chartConfig: ChartConfig = {
    income: { label: "Revenue", color: "hsl(143 44% 28%)" },
    expense: { label: "Expenses", color: "hsl(0 84% 55%)" },
  };

  const handleExport = () => {
    const rows: string[][] = [
      ["Profit & Loss Statement", label],
      [],
      ["REVENUE"],
      ...incomeByCategory.map(([cat, amt]) => [cat, formatAmount(amt, currency)]),
      ["Total Revenue", formatAmount(income, currency)],
      [],
      ["EXPENSES"],
      ...expenseByCategory.map(([cat, amt]) => [cat, formatAmount(amt, currency)]),
      ["Total Expenses", formatAmount(expenses, currency)],
      [],
      ["NET INCOME", formatAmount(netIncome, currency)],
      ["Margin", `${margin.toFixed(1)}%`],
    ];
    downloadCSV(rows, `PnL_${label.replace(/\s/g, "_")}.csv`);
  };

  if (transactions.length === 0) {
    return <EmptyState text="No transactions for this period" icon={BarChart3} />;
  }

  if (_frLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading financial data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Period + Export + Explain */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={() => setShowExplain(!showExplain)}>
            <Info className="h-3.5 w-3.5" />
            Explain
            {showExplain ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Explain Panel */}
      {showExplain && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 text-sm space-y-2">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
              <Info className="h-4 w-4" />
              P&L Calculation Methodology
            </h4>
            <ul className="list-disc list-inside text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <li><strong>Revenue</strong>: Sum of all positive transactions (credits/deposits) in the selected period, excluding internal transfers and non-P&L categories.</li>
              <li><strong>Expenses</strong>: Sum of all negative transactions (debits/payments) in the selected period, excluding internal transfers, wire transfers, cash advances, and loan payments.</li>
              <li><strong>Net Income</strong>: Revenue minus Expenses. Green indicates profit; red indicates loss.</li>
              <li><strong>Margin</strong>: Net Income divided by Revenue, expressed as a percentage.</li>
              <li><strong>Category Classification</strong>: Each transaction is classified using merchant name and description matching against 20+ industry categories.</li>
              <li><strong>Previous Period</strong>: Comparison uses the same duration shifted backwards (e.g., "This Year" compares to "Last Year").</li>
              <li><strong>Excluded Categories</strong>: Internal Transfer, Wire Transfer, Cash Advance, Credit Card Payment, Loan Payment, Owner Draw/Contribution, Opening Balance.</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Revenue" value={<FC amount={income} currency={currency} />} icon={TrendingUp} color="text-green-600" sub={prevTotals.income > 0 ? `vs ${formatAmount(prevTotals.income, currency)} prev` : undefined} onClick={() => setDrillDown({ title: "Revenue Transactions", description: `${label} — all income`, transactions: transactions.filter((t: any) => t.amount > 0) })} />
        <KPICard label="Expenses" value={<FC amount={expenses} currency={currency} />} icon={TrendingDown} color="text-red-500" sub={prevTotals.expenses > 0 ? `vs ${formatAmount(prevTotals.expenses, currency)} prev` : undefined} onClick={() => setDrillDown({ title: "Expense Transactions", description: `${label} — all expenses`, transactions: transactions.filter((t: any) => t.amount < 0) })} />
        <KPICard
          label="Net Income"
          value={<FC amount={Math.abs(netIncome)} currency={currency} />}
          icon={DollarSign}
          color={netIncome >= 0 ? "text-green-600" : "text-red-500"}
          sub={netIncome >= 0 ? "Profit" : "Loss"}
          onClick={() => setDrillDown({ title: "All P&L Transactions", description: label, transactions })}
        />
        <KPICard
          label="Margin"
          value={`${margin.toFixed(1)}%`}
          icon={Scale}
          color={margin >= 20 ? "text-green-600" : margin >= 0 ? "text-amber-500" : "text-red-500"}
        />
      </div>

      {/* Previous Period Comparison */}
      {prevTotals.income > 0 || prevTotals.expenses > 0 ? (
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Period Comparison</CardTitle>
            <CardDescription className="text-xs">Current period vs previous period</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Metric</TableHead>
                  <TableHead className="text-right text-xs">Current</TableHead>
                  <TableHead className="text-right text-xs">Previous</TableHead>
                  <TableHead className="text-right text-xs">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "Revenue", current: income, prev: prevTotals.income },
                  { label: "Expenses", current: expenses, prev: prevTotals.expenses },
                  { label: "Net Income", current: netIncome, prev: prevTotals.net },
                ].map((row) => {
                  const change = row.prev > 0 ? ((row.current - row.prev) / row.prev) * 100 : 0;
                  const isGood = row.label === "Expenses" ? change < 0 : change > 0;
                  return (
                    <TableRow key={row.label}>
                      <TableCell className="text-sm font-medium">{row.label}</TableCell>
                      <TableCell className="text-right text-sm font-semibold"><FC amount={Math.abs(row.current)} currency={currency} /></TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground"><FC amount={Math.abs(row.prev)} currency={currency} /></TableCell>
                      <TableCell className="text-right">
                        {row.prev > 0 ? (
                          <Badge variant="outline" className={`text-[10px] ${isGood ? "text-green-600 border-green-200" : "text-red-500 border-red-200"}`}>
                            {change > 0 ? "+" : ""}{change.toFixed(1)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {/* Revenue vs Expense Chart */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Revenue vs Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyData.length === 0 ? (
            <EmptyChartPlaceholder />
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full !aspect-auto">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  className="text-[10px]"
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString())}
                />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Bar dataKey="income" fill="hsl(143 44% 28%)" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="expense" fill="hsl(0 84% 55%)" radius={[3, 3, 0, 0]} barSize={14} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        <CategoryTable title="Revenue by Category" rows={incomeByCategory} currency={currency} color="text-green-600" total={income} onRowClick={(cat) => setDrillDown({ title: `Revenue — ${cat}`, transactions: transactions.filter((t: any) => t.amount > 0 && resolveIncomeCategory(t.category, t.counterparty_name || t.description, businessSector) === cat) })} />
        <CategoryTable title="Expenses by Category" rows={expenseByCategory} currency={currency} color="text-red-500" total={expenses} onRowClick={(cat) => setDrillDown({ title: `Expenses — ${cat}`, transactions: transactions.filter((t: any) => t.amount < 0 && (getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "Other") === cat) })} />
      </div>

      <TransactionDetailSheet
        open={!!drillDown}
        onOpenChange={(open) => { if (!open) setDrillDown(null); }}
        title={drillDown?.title || ""}
        description={drillDown?.description}
        transactions={drillDown?.transactions || []}
        currency={currency}
      />
    </div>
  );
}

// ── Balance Sheet Tab ─────────────────────────────────────────────────────

function BalanceSheetTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate: globalStart, endDate: globalEnd } = useDateRange();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodKey>("this-year");
  const { start, end, label } = getPeriodDates(period);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["fr-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["fr-invoices", clientId, globalStart, globalEnd],
    queryFn: () => database.getInvoices(clientId!, { startDate: globalStart, endDate: globalEnd }),
    enabled: !!clientId && !!globalStart,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["fr-bills", clientId, globalStart, globalEnd],
    queryFn: () => database.getBills(clientId!, { startDate: globalStart, endDate: globalEnd }),
    enabled: !!clientId && !!globalStart,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["fr-txns", clientId, start, end],
    queryFn: () =>
      database.getTransactions(clientId!, { startDate: start, endDate: end, limit: 5000 }),
    enabled: !!clientId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["fr-coa", clientId],
    queryFn: () => database.getAccounts(clientId!),
    enabled: !!clientId,
  });

  const hasCoA = accounts.length > 0;

  const cashAndBank = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );

  const accountsReceivable = useMemo(
    () =>
      invoices
        .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((s: number, i: any) => s + (i.total || 0), 0),
    [invoices],
  );

  const accountsPayable = useMemo(
    () =>
      bills
        .filter((b: any) => b.status !== "paid" && b.status !== "cancelled")
        .reduce((s: number, b: any) => s + (b.total || 0), 0),
    [bills],
  );

  // P&L from transactions
  const { income, expenses } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    transactions.forEach((t: any) => {
      const entity = t.counterparty_name || t.description;
      const cat = t.amount > 0
        ? resolveIncomeCategory(t.category, entity, businessSector)
        : getCanonicalCategory(t.category, entity, t.description) || "Other";
      if (!isPlCategory(cat)) return;
      if (t.amount > 0) inc += t.amount;
      else exp += Math.abs(t.amount);
    });
    return { income: inc, expenses: exp };
  }, [transactions]);

  const retainedEarnings = income - expenses;
  const totalAssets = cashAndBank + accountsReceivable;
  const totalLiabilities = accountsPayable;
  const equity = totalAssets - totalLiabilities;

  const assetRows: [string, number][] = [
    ["Cash & Bank Balances", cashAndBank],
    ["Accounts Receivable", accountsReceivable],
  ];
  const liabilityRows: [string, number][] = [
    ["Accounts Payable", accountsPayable],
  ];
  const equityRows: [string, number][] = [
    ["Retained Earnings", retainedEarnings],
    ["Total Equity", equity],
  ];

  const handleExport = () => {
    const rows: string[][] = [
      ["Balance Sheet", label],
      [],
      ["ASSETS"],
      ...assetRows.map(([n, v]) => [n, formatAmount(v, currency)]),
      ["Total Assets", formatAmount(totalAssets, currency)],
      [],
      ["LIABILITIES"],
      ...liabilityRows.map(([n, v]) => [n, formatAmount(v, currency)]),
      ["Total Liabilities", formatAmount(totalLiabilities, currency)],
      [],
      ["EQUITY"],
      ...equityRows.map(([n, v]) => [n, formatAmount(v, currency)]),
    ];
    downloadCSV(rows, `BalanceSheet_${label.replace(/\s/g, "_")}.csv`);
  };

  const hasData = bankAccounts.length > 0 || invoices.length > 0 || bills.length > 0;

  if (!hasData) {
    return <EmptyState text="No financial data available" icon={Landmark} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Estimated badge if no CoA */}
      {!hasCoA && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <Badge variant="outline" className="text-[10px] mr-1.5 text-amber-600 border-amber-300">Estimated</Badge>
              This balance sheet is estimated from bank data. Set up a Chart of Accounts for accurate reporting.
            </p>
          </div>
          <Button size="sm" variant="outline" className="shrink-0 gap-1.5 text-xs" onClick={() => navigate("/settings")}>
            <Settings className="h-3 w-3" />
            Set Up CoA
          </Button>
        </div>
      )}

      {/* Balance Check: Assets = Liabilities + Equity */}
      {(() => {
        const liabPlusEquity = totalLiabilities + equity;
        const balanced = Math.abs(totalAssets - liabPlusEquity) < 0.01;
        return (
          <Card className={`stat-card-hover ${balanced ? "border-green-200 dark:border-green-800" : "border-red-200 dark:border-red-800"}`}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {balanced ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm font-medium">
                  Balance Check: Assets = Liabilities + Equity
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span><FC amount={totalAssets} currency={currency} /></span>
                <span className="text-muted-foreground">{balanced ? "=" : "≠"}</span>
                <span><FC amount={liabPlusEquity} currency={currency} /></span>
                <Badge variant={balanced ? "default" : "destructive"} className="text-[9px]">
                  {balanced ? "Balanced" : `Diff: ${formatAmount(Math.abs(totalAssets - liabPlusEquity), currency)}`}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Assets" value={<FC amount={totalAssets} currency={currency} />} icon={TrendingUp} color="text-primary" />
        <KPICard label="Total Liabilities" value={<FC amount={totalLiabilities} currency={currency} />} icon={TrendingDown} color="text-red-500" />
        <KPICard
          label="Equity"
          value={<FC amount={Math.abs(equity)} currency={currency} />}
          icon={Scale}
          color={equity >= 0 ? "text-green-600" : "text-red-500"}
          sub={equity >= 0 ? "Positive" : "Negative"}
        />
        <KPICard label="Retained Earnings" value={<FC amount={Math.abs(retainedEarnings)} currency={currency} />} icon={DollarSign} color={retainedEarnings >= 0 ? "text-green-600" : "text-red-500"} />
      </div>

      {/* Balance Sheet Table */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Assets */}
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Assets</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableBody>
                {assetRows.map(([name, val]) => (
                  <TableRow key={name}>
                    <TableCell className="text-sm">{name}</TableCell>
                    <TableCell className="text-right font-semibold text-sm"><FC amount={val} currency={currency} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell className="text-sm">Total Assets</TableCell>
                  <TableCell className="text-right text-sm text-green-600"><FC amount={totalAssets} currency={currency} /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Liabilities & Equity</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableBody>
                {liabilityRows.map(([name, val]) => (
                  <TableRow key={name}>
                    <TableCell className="text-sm">{name}</TableCell>
                    <TableCell className="text-right font-semibold text-sm"><FC amount={val} currency={currency} /></TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30">
                  <TableCell className="text-sm font-bold">Total Liabilities</TableCell>
                  <TableCell className="text-right text-sm font-bold text-red-500"><FC amount={totalLiabilities} currency={currency} /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={2} className="h-1 p-0"><Separator /></TableCell>
                </TableRow>
                {equityRows.map(([name, val]) => (
                  <TableRow key={name} className={name === "Total Equity" ? "bg-muted/30 font-bold" : ""}>
                    <TableCell className="text-sm">{name}</TableCell>
                    <TableCell className={`text-right font-semibold text-sm ${name === "Total Equity" ? "text-primary" : ""}`}><FC amount={val} currency={currency} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Cash Flow Statement Tab ───────────────────────────────────────────────

const INVESTING_PATTERN = /invest|property|equipment|asset|acquisition|capital expenditure|fixed asset|land|building|vehicle/i;
const FINANCING_PATTERN = /loan|borrow|repay|dividend|equity|share|capital|draw|contribution|mortgage|debenture/i;

function CashFlowTab() {
  const { clientId, currency } = useActiveClient();
  const [period, setPeriod] = useState<PeriodKey>("this-year");
  const { start, end, label } = getPeriodDates(period);

  const { data: transactions = [] } = useQuery({
    queryKey: ["fr-txns", clientId, start, end],
    queryFn: () =>
      database.getTransactions(clientId!, { startDate: start, endDate: end, limit: 5000 }),
    enabled: !!clientId,
  });

  // All transactions before period start (for beginning balance)
  const { data: priorTransactions = [] } = useQuery({
    queryKey: ["fr-txns-prior", clientId, start],
    queryFn: () =>
      database.getTransactions(clientId!, { endDate: start, limit: 10000 }),
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["fr-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const currentBankBalance = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );

  // Beginning balance estimated from prior transactions
  const beginningCash = useMemo(
    () => priorTransactions.reduce((s: number, t: any) => s + (t.amount || 0), 0),
    [priorTransactions],
  );

  const { operating, investing, financing, monthlyNet } = useMemo(() => {
    let investAmt = 0;
    let financeAmt = 0;
    let total = 0;
    const monthly: Record<string, number> = {};

    transactions.forEach((t: any) => {
      const desc = (t.description || "").toLowerCase();
      const cat = (t.category || "").toLowerCase();
      const combined = `${desc} ${cat}`;
      const month = t.transaction_date?.slice(0, 7);

      total += t.amount;
      if (month) monthly[month] = (monthly[month] || 0) + t.amount;

      if (INVESTING_PATTERN.test(combined)) {
        investAmt += t.amount;
      } else if (FINANCING_PATTERN.test(combined)) {
        financeAmt += t.amount;
      }
    });

    const operatingAmt = total - investAmt - financeAmt;

    const monthlyArr = Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, net]) => ({
        month: format(new Date(m + "-01"), "MMM yy"),
        net,
      }));

    return {
      operating: operatingAmt,
      investing: investAmt,
      financing: financeAmt,
      monthlyNet: monthlyArr,
    };
  }, [transactions]);

  const netCashFlow = operating + investing + financing;

  const netChartConfig: ChartConfig = {
    net: { label: "Net Cash Flow", color: "hsl(210 80% 55%)" },
  };

  const handleExport = () => {
    const rows: string[][] = [
      ["Cash Flow Statement", label],
      [],
      ["Cash from Operations", formatAmount(operating, currency)],
      ["Cash from Investing", formatAmount(investing, currency)],
      ["Cash from Financing", formatAmount(financing, currency)],
      [],
      ["Net Cash Flow", formatAmount(netCashFlow, currency)],
    ];
    downloadCSV(rows, `CashFlow_${label.replace(/\s/g, "_")}.csv`);
  };

  if (transactions.length === 0) {
    return <EmptyState text="No transactions for this period" icon={ArrowRightLeft} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PeriodSelector value={period} onChange={setPeriod} />
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Operating"
          value={<FC amount={Math.abs(operating)} currency={currency} />}
          icon={TrendingUp}
          color={operating >= 0 ? "text-green-600" : "text-red-500"}
          sub={operating >= 0 ? "Inflow" : "Outflow"}
        />
        <KPICard
          label="Investing"
          value={<FC amount={Math.abs(investing)} currency={currency} />}
          icon={Landmark}
          color={investing >= 0 ? "text-green-600" : "text-red-500"}
          sub={investing >= 0 ? "Inflow" : "Outflow"}
        />
        <KPICard
          label="Financing"
          value={<FC amount={Math.abs(financing)} currency={currency} />}
          icon={Scale}
          color={financing >= 0 ? "text-green-600" : "text-red-500"}
          sub={financing >= 0 ? "Inflow" : "Outflow"}
        />
        <KPICard
          label="Net Cash Flow"
          value={<FC amount={Math.abs(netCashFlow)} currency={currency} />}
          icon={DollarSign}
          color={netCashFlow >= 0 ? "text-green-600" : "text-red-500"}
          sub={netCashFlow >= 0 ? "Positive" : "Negative"}
        />
      </div>

      {/* Summary Card */}
      <Card className="stat-card-hover">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Cash from Operating Activities</TableCell>
                <TableCell className={`text-right font-semibold ${operating >= 0 ? "text-green-600" : "text-red-500"}`}>
                  <FC amount={operating} currency={currency} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash from Investing Activities</TableCell>
                <TableCell className={`text-right font-semibold ${investing >= 0 ? "text-green-600" : "text-red-500"}`}>
                  <FC amount={investing} currency={currency} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Cash from Financing Activities</TableCell>
                <TableCell className={`text-right font-semibold ${financing >= 0 ? "text-green-600" : "text-red-500"}`}>
                  <FC amount={financing} currency={currency} />
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/30 font-bold">
                <TableCell>Net Increase (Decrease) in Cash</TableCell>
                <TableCell className={`text-right ${netCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                  <FC amount={netCashFlow} currency={currency} />
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} className="h-1 p-0"><Separator /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">Beginning Cash</TableCell>
                <TableCell className="text-right font-semibold"><FC amount={beginningCash} currency={currency} /></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium text-muted-foreground">+ Net Change</TableCell>
                <TableCell className={`text-right font-semibold ${netCashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                  <FC amount={netCashFlow} currency={currency} />
                </TableCell>
              </TableRow>
              <TableRow className="bg-muted/30 font-bold">
                <TableCell>Ending Cash (Calculated)</TableCell>
                <TableCell className="text-right"><FC amount={beginningCash + netCashFlow} currency={currency} /></TableCell>
              </TableRow>
              {currentBankBalance > 0 && (
                <TableRow>
                  <TableCell className="font-medium text-muted-foreground">
                    Current Bank Balance
                    {Math.abs((beginningCash + netCashFlow) - currentBankBalance) < 1 ? (
                      <Badge variant="default" className="ml-2 text-[9px]">Reconciled</Badge>
                    ) : (
                      <Badge variant="outline" className="ml-2 text-[9px] text-amber-600 border-amber-200">
                        Diff: <FC amount={Math.abs((beginningCash + netCashFlow) - currentBankBalance)} currency={currency} />
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary"><FC amount={currentBankBalance} currency={currency} /></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Net Cash Flow Trend */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Monthly Net Cash Flow</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyNet.length === 0 ? (
            <EmptyChartPlaceholder />
          ) : (
            <ChartContainer config={netChartConfig} className="h-[200px] w-full !aspect-auto">
              <AreaChart data={monthlyNet}>
                <defs>
                  <linearGradient id="frCashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(210 80% 55%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(210 80% 55%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={65}
                  className="text-[10px]"
                  tickFormatter={(v) =>
                    Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()
                  }
                />
                <ReferenceLine y={0} stroke="hsl(0 0% 70%)" strokeDasharray="3 3" />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="hsl(210 80% 55%)"
                  strokeWidth={2.5}
                  fill="url(#frCashGrad)"
                  dot={{ r: 3, fill: "hsl(210 80% 55%)", strokeWidth: 0 }}
                  activeDot={{ r: 5, stroke: "hsl(210 80% 55%)", strokeWidth: 2, fill: "white" }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Ratios Tab ────────────────────────────────────────────────────────────

function RatiosTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate: globalStart, endDate: globalEnd } = useDateRange();

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["fr-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["fr-invoices", clientId, globalStart, globalEnd],
    queryFn: () => database.getInvoices(clientId!, { startDate: globalStart, endDate: globalEnd }),
    enabled: !!clientId && !!globalStart,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["fr-bills", clientId, globalStart, globalEnd],
    queryFn: () => database.getBills(clientId!, { startDate: globalStart, endDate: globalEnd }),
    enabled: !!clientId && !!globalStart,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["fr-txns-12", clientId, globalStart, globalEnd],
    queryFn: () =>
      database.getTransactions(clientId!, { startDate: globalStart, endDate: globalEnd, limit: 5000 }),
    enabled: !!clientId && !!globalStart,
  });

  const cashBalance = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );
  const ar = useMemo(
    () =>
      invoices
        .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((s: number, i: any) => s + (i.total || 0), 0),
    [invoices],
  );
  const ap = useMemo(
    () =>
      bills
        .filter((b: any) => b.status !== "paid" && b.status !== "cancelled")
        .reduce((s: number, b: any) => s + (b.total || 0), 0),
    [bills],
  );

  const { revenue, costOfGoods, grossProfit, netIncome, totalExpenses } = useMemo(() => {
    let rev = 0;
    let exp = 0;
    transactions.forEach((t: any) => {
      const entity = t.counterparty_name || t.description;
      const cat = t.amount > 0
        ? resolveIncomeCategory(t.category, entity, businessSector)
        : getCanonicalCategory(t.category, entity, t.description) || "Other";
      if (!isPlCategory(cat)) return;
      if (t.amount > 0) rev += t.amount;
      else exp += Math.abs(t.amount);
    });
    return {
      revenue: rev,
      costOfGoods: exp * 0.6, // estimate
      grossProfit: rev - exp * 0.6,
      netIncome: rev - exp,
      totalExpenses: exp,
    };
  }, [transactions]);

  const currentAssets = cashBalance + ar;
  const currentLiabilities = ap || 1;

  const ratios = [
    {
      category: "Profitability",
      items: [
        { name: "Gross Profit Margin", value: revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) + "%" : "N/A", good: revenue > 0 && grossProfit / revenue >= 0.3 },
        { name: "Net Profit Margin", value: revenue > 0 ? ((netIncome / revenue) * 100).toFixed(1) + "%" : "N/A", good: revenue > 0 && netIncome / revenue >= 0.1 },
        { name: "Return on Assets", value: currentAssets > 0 ? ((netIncome / currentAssets) * 100).toFixed(1) + "%" : "N/A", good: currentAssets > 0 && netIncome / currentAssets >= 0.05 },
      ],
    },
    {
      category: "Liquidity",
      items: [
        { name: "Current Ratio", value: (currentAssets / currentLiabilities).toFixed(2) + "x", good: currentAssets / currentLiabilities >= 1.5 },
        { name: "Quick Ratio", value: ((cashBalance + ar) / currentLiabilities).toFixed(2) + "x", good: (cashBalance + ar) / currentLiabilities >= 1 },
        { name: "Cash Ratio", value: (cashBalance / currentLiabilities).toFixed(2) + "x", good: cashBalance / currentLiabilities >= 0.5 },
      ],
    },
    {
      category: "Efficiency",
      items: [
        { name: "Revenue per Month", value: <FC amount={revenue / 12} currency={currency} />, good: true },
        { name: "Expense Ratio", value: revenue > 0 ? ((totalExpenses / revenue) * 100).toFixed(1) + "%" : "N/A", good: revenue > 0 && totalExpenses / revenue < 0.8 },
        { name: "AR to Revenue", value: revenue > 0 ? ((ar / revenue) * 100).toFixed(1) + "%" : "N/A", good: revenue > 0 && ar / revenue < 0.15 },
      ],
    },
  ];

  const hasData = transactions.length > 0 || bankAccounts.length > 0;

  if (!hasData) {
    return <EmptyState text="Upload data to calculate financial ratios" icon={Scale} />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Cash" value={<FC amount={cashBalance} currency={currency} />} icon={DollarSign} color="text-primary" />
        <KPICard label="Receivables" value={<FC amount={ar} currency={currency} />} icon={TrendingUp} color="text-green-600" />
        <KPICard label="Payables" value={<FC amount={ap} currency={currency} />} icon={TrendingDown} color="text-red-500" />
        <KPICard label="Net Income" value={<FC amount={Math.abs(netIncome)} currency={currency} />} icon={Scale} color={netIncome >= 0 ? "text-green-600" : "text-red-500"} sub="12 months" />
      </div>

      {ratios.map((group) => (
        <Card key={group.category} className="stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{group.category} Ratios</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ratio</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-[80px] text-center">Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.items.map((item) => (
                  <TableRow key={item.name}>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{item.value}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={item.good ? "default" : "destructive"}
                        className="text-[9px]"
                      >
                        {item.good ? "Good" : "Review"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Custom Filters Tab ────────────────────────────────────────────────────

function CustomFiltersTab() {
  const { clientId, currency } = useActiveClient();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [txnType, setTxnType] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "bank_upload" | "erp" | "pos" | "manual">("all");
  const [applied, setApplied] = useState(false);

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["fr-filter-txns", clientId],
    queryFn: () => database.getTransactions(clientId!, { limit: 10000 }),
    enabled: !!clientId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["fr-vendors", clientId],
    queryFn: () => database.getVendors(clientId!),
    enabled: !!clientId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["fr-customers", clientId],
    queryFn: () => database.getCustomers(clientId!),
    enabled: !!clientId,
  });

  const filtered = useMemo(() => {
    if (!applied) return [];
    let list = [...allTransactions];

    if (dateFrom) list = list.filter((t: any) => t.transaction_date >= dateFrom);
    if (dateTo) list = list.filter((t: any) => t.transaction_date <= dateTo);
    if (txnType === "income") list = list.filter((t: any) => t.amount > 0);
    if (txnType === "expense") list = list.filter((t: any) => t.amount < 0);
    if (txnType === "transfer") {
      list = list.filter((t: any) => {
        const cat = getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "";
        return !isPlCategory(cat);
      });
    }
    if (amountMin) list = list.filter((t: any) => Math.abs(t.amount) >= parseFloat(amountMin));
    if (amountMax) list = list.filter((t: any) => Math.abs(t.amount) <= parseFloat(amountMax));
    if (categoryFilter) {
      const catLower = categoryFilter.toLowerCase();
      list = list.filter((t: any) => {
        const cat = getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "";
        return cat.toLowerCase().includes(catLower);
      });
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      list = list.filter((t: any) => (t.description || "").toLowerCase().includes(q));
    }
    if (vendorFilter) {
      const q = vendorFilter.toLowerCase();
      list = list.filter((t: any) => (t.counterparty_name || t.description || "").toLowerCase().includes(q));
    }
    if (customerFilter) {
      const q = customerFilter.toLowerCase();
      list = list.filter((t: any) => (t.counterparty_name || t.description || "").toLowerCase().includes(q));
    }
    if (sourceFilter !== "all") {
      list = list.filter((t: any) => (t.source || "").toLowerCase() === sourceFilter);
    }

    return list.sort((a: any, b: any) => (b.transaction_date || "").localeCompare(a.transaction_date || ""));
  }, [allTransactions, applied, dateFrom, dateTo, txnType, amountMin, amountMax, categoryFilter, searchText, vendorFilter, customerFilter, sourceFilter]);

  const aggregates = useMemo(() => {
    if (filtered.length === 0) return null;
    const amounts = filtered.map((t: any) => t.amount);
    const total = amounts.reduce((s: number, a: number) => s + a, 0);
    const absAmounts = amounts.map(Math.abs);
    return {
      total,
      count: filtered.length,
      average: total / filtered.length,
      min: Math.min(...absAmounts),
      max: Math.max(...absAmounts),
    };
  }, [filtered]);

  const handleApply = () => setApplied(true);
  const handleClear = () => {
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setTxnType("all");
    setCategoryFilter("");
    setSearchText("");
    setVendorFilter("");
    setCustomerFilter("");
    setSourceFilter("all");
    setApplied(false);
  };

  const handleExport = () => {
    const rows: string[][] = [
      ["Date", "Description", "Category", "Amount", "Type"],
      ...filtered.map((t: any) => [
        t.transaction_date || "",
        t.description || "",
        getCanonicalCategory(t.category, t.description, t.description) || "Other",
        (t.amount || 0).toFixed(2),
        t.amount > 0 ? "Income" : "Expense",
      ]),
    ];
    downloadCSV(rows, `Filtered_Transactions_${format(new Date(), "yyyy-MM-dd")}.csv`);
  };

  return (
    <div className="space-y-5">
      {/* Filter Builder */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Filter className="h-4 w-4" />
            Transaction Filters
          </CardTitle>
          <CardDescription className="text-xs">Build custom filters to slice your financial data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Date From</Label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date To</Label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Min Amount</Label>
              <Input type="number" placeholder="0" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max Amount</Label>
              <Input type="number" placeholder="∞" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Transaction Type</Label>
              <Select value={txnType} onValueChange={(v) => setTxnType(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Category</Label>
              <Input placeholder="e.g. Food & Beverage" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Source</Label>
              <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="bank_upload">Bank Upload</SelectItem>
                  <SelectItem value="erp">ERP</SelectItem>
                  <SelectItem value="pos">POS</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search..." value={searchText} onChange={(e) => setSearchText(e.target.value)} className="h-8 text-xs pl-7" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Vendor</Label>
              <Input
                placeholder="Filter by vendor name..."
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
                className="h-8 text-xs"
                list="vendor-suggestions"
              />
              {vendors.length > 0 && (
                <datalist id="vendor-suggestions">
                  {vendors.map((v: any) => <option key={v.id} value={v.name} />)}
                </datalist>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Input
                placeholder="Filter by customer name..."
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className="h-8 text-xs"
                list="customer-suggestions"
              />
              {customers.length > 0 && (
                <datalist id="customer-suggestions">
                  {customers.map((c: any) => <option key={c.id} value={c.name} />)}
                </datalist>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1.5 text-xs" onClick={handleApply}>
              <Filter className="h-3.5 w-3.5" />
              Apply Filters
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleClear}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
            {filtered.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1.5 text-xs ml-auto" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Bar */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="stat-card-hover">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Total</p>
              <p className={`text-sm font-bold ${aggregates.total >= 0 ? "text-green-600" : "text-red-500"}`}>
                <FC amount={aggregates.total} currency={currency} />
              </p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Count</p>
              <p className="text-sm font-bold">{aggregates.count}</p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Average</p>
              <p className="text-sm font-bold"><FC amount={aggregates.average} currency={currency} /></p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Min</p>
              <p className="text-sm font-bold"><FC amount={aggregates.min} currency={currency} /></p>
            </CardContent>
          </Card>
          <Card className="stat-card-hover">
            <CardContent className="p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Max</p>
              <p className="text-sm font-bold"><FC amount={aggregates.max} currency={currency} /></p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Results */}
      {!applied ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Filter className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Set Filters & Apply</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Configure the filters above and click "Apply Filters" to see matching transactions.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Search className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Matching Transactions</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Try adjusting your filters to find transactions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Results ({filtered.length} transaction{filtered.length !== 1 ? "s" : ""})
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <div className="max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs">Category</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 200).map((t: any, i: number) => (
                    <TableRow key={t.id || i}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-sm max-w-[280px] truncate">{t.description || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {getCanonicalCategory(t.category, t.description, t.description) || "Other"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-semibold text-sm ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {t.amount >= 0 ? "+" : ""}<FC amount={Math.abs(t.amount)} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 200 && (
              <div className="p-3 text-center text-xs text-muted-foreground border-t">
                Showing 200 of {filtered.length} results. Export to see all.
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────

function KPICard({
  label, value, icon: Icon, color, sub, onClick,
}: {
  label: string; value: React.ReactNode; icon: React.ComponentType<{ className?: string }>; color: string; sub?: string; onClick?: () => void;
}) {
  return (
    <Card className={`stat-card-hover ${onClick ? "cursor-pointer" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text, icon: Icon }: { text: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Icon className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{text}</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Upload bank statements or connect an ERP to populate financial reports.
        </p>
      </CardContent>
    </Card>
  );
}

function EmptyChartPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-muted p-3 mb-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-xs text-muted-foreground">No chart data</p>
    </div>
  );
}

function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as PeriodKey)}>
        <SelectTrigger className="w-full sm:w-[180px] h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="this-month">This Month</SelectItem>
          <SelectItem value="last-month">Last Month</SelectItem>
          <SelectItem value="this-quarter">This Quarter</SelectItem>
          <SelectItem value="last-quarter">Last Quarter</SelectItem>
          <SelectItem value="this-year">This Year</SelectItem>
          <SelectItem value="last-year">Last Year</SelectItem>
          <SelectItem value="last-12">Last 12 Months</SelectItem>
        </SelectContent>
      </Select>
      <Badge variant="outline" className="text-[10px]">
        {getPeriodDates(value).label}
      </Badge>
    </div>
  );
}

function CategoryTable({
  title,
  rows,
  currency,
  color,
  total,
  onRowClick,
}: {
  title: string;
  rows: [string, number][];
  currency: string;
  color: string;
  total: number;
  onRowClick?: (category: string) => void;
}) {
  return (
    <Card className="stat-card-hover">
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${color}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableBody>
            {rows.map(([cat, amt]) => {
              const pct = total > 0 ? (amt / total) * 100 : 0;
              return (
                <TableRow
                  key={cat}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => onRowClick?.(cat)}
                >
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2">
                      <span>{cat}</span>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {pct.toFixed(0)}%
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    <FC amount={amt} currency={currency} />
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/30 font-bold">
              <TableCell className="text-sm">Total</TableCell>
              <TableCell className={`text-right text-sm ${color}`}>
                <FC amount={total} currency={currency} />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Trial Balance Tab ─────────────────────────────────────────────────────

function TrialBalanceTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate: globalStart, endDate: globalEnd } = useDateRange();

  const { data: tbData, isFetching: tbLoading } = useQuery({
    queryKey: ["trial-balance", clientId, globalStart || "all", globalEnd || "all"],
    queryFn: () => database.getTrialBalance(clientId!, {
      startDate: globalStart || undefined,
      endDate: globalEnd || undefined,
    }),
    enabled: !!clientId,
  });

  const accounts = tbData?.accounts ?? [];
  const totals = tbData?.totals ?? { opening_debit: 0, opening_credit: 0, period_debit: 0, period_credit: 0, closing_debit: 0, closing_credit: 0 };

  // Group by account type
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    accounts.forEach((a: any) => {
      const t = a.type || "Other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    });
    const order = ["Asset", "Liability", "Equity", "Revenue", "Expense", "Other"];
    return order.filter((t) => groups[t]?.length).map((t) => ({ type: t, items: groups[t] }));
  }, [accounts]);

  const isBalanced = Math.abs(totals.closing_debit - totals.closing_credit) < 0.02;

  const fmt = (v: number) => v ? formatAmount(v, currency) : "—";

  const handleExportCSV = () => {
    const lines = ["Account Code,Account Name,Type,Opening Dr,Opening Cr,Period Dr,Period Cr,Closing Dr,Closing Cr"];
    accounts.forEach((a: any) => {
      lines.push([a.code, `"${a.name}"`, a.type, a.opening_debit, a.opening_credit, a.period_debit, a.period_credit, a.closing_debit, a.closing_credit].join(","));
    });
    lines.push(["", "TOTALS", "", totals.opening_debit, totals.opening_credit, totals.period_debit, totals.period_credit, totals.closing_debit, totals.closing_credit].join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Trial_Balance_${globalStart || "all"}_${globalEnd || "all"}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (tbLoading && accounts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading trial balance...</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No Trial Balance Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements or set up your Chart of Accounts to generate a Trial Balance.
          </p>
        </CardContent>
      </Card>
    );
  }

  const typeColors: Record<string, string> = {
    Asset: "text-blue-600 bg-blue-50",
    Liability: "text-red-500 bg-red-50",
    Equity: "text-purple-600 bg-purple-50",
    Revenue: "text-green-600 bg-green-50",
    Expense: "text-orange-500 bg-orange-50",
    Other: "text-gray-500 bg-gray-50",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">Trial Balance</h3>
          {isBalanced ? (
            <Badge className="gap-1 bg-green-600 text-[10px]">
              <CheckCircle2 className="h-3 w-3" />
              Balanced
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <AlertTriangle className="h-3 w-3" />
              Unbalanced ({formatAmount(Math.abs(totals.closing_debit - totals.closing_credit), currency)})
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{accounts.length} accounts</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportCSV}>
          <Download className="h-3 w-3" />
          Export CSV
        </Button>
      </div>

      {/* Trial Balance Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/60 border-b">
                <th className="text-left p-2.5 font-semibold w-[60px]">Code</th>
                <th className="text-left p-2.5 font-semibold">Account Name</th>
                <th className="text-center p-2.5 font-semibold" colSpan={2}>Opening Balance</th>
                <th className="text-center p-2.5 font-semibold" colSpan={2}>Period Movement</th>
                <th className="text-center p-2.5 font-semibold" colSpan={2}>Closing Balance</th>
              </tr>
              <tr className="bg-muted/30 border-b text-[10px] text-muted-foreground">
                <th className="p-1.5"></th>
                <th className="p-1.5"></th>
                <th className="text-right p-1.5 font-medium">Debit</th>
                <th className="text-right p-1.5 font-medium">Credit</th>
                <th className="text-right p-1.5 font-medium">Debit</th>
                <th className="text-right p-1.5 font-medium">Credit</th>
                <th className="text-right p-1.5 font-medium">Debit</th>
                <th className="text-right p-1.5 font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(({ type, items }) => (
                <Fragment key={type}>
                  {/* Section header */}
                  <tr className="bg-muted/20">
                    <td colSpan={8} className="p-2 font-semibold text-xs">
                      <Badge variant="outline" className={`text-[9px] mr-2 ${typeColors[type] || ""}`}>
                        {type}
                      </Badge>
                      {items.length} account{items.length !== 1 ? "s" : ""}
                    </td>
                  </tr>
                  {/* Account rows */}
                  {items.map((a: any, i: number) => (
                    <tr key={`${a.code}-${a.name}-${i}`} className="border-b border-muted/30 hover:bg-muted/20">
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{a.code || "—"}</td>
                      <td className="p-2 font-medium">{a.name}</td>
                      <td className="p-2 text-right tabular-nums">{a.opening_debit > 0 ? fmt(a.opening_debit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{a.opening_credit > 0 ? fmt(a.opening_credit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{a.period_debit > 0 ? fmt(a.period_debit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums">{a.period_credit > 0 ? fmt(a.period_credit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{a.closing_debit > 0 ? fmt(a.closing_debit) : "—"}</td>
                      <td className="p-2 text-right tabular-nums font-medium">{a.closing_credit > 0 ? fmt(a.closing_credit) : "—"}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {/* Totals row */}
              <tr className="bg-primary/5 border-t-2 border-primary/20 font-bold text-xs">
                <td className="p-2.5" colSpan={2}>TOTALS</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.opening_debit)}</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.opening_credit)}</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.period_debit)}</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.period_credit)}</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.closing_debit)}</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(totals.closing_credit)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function FinancialReporting() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Financial Reporting
          </h1>
          <p className="text-muted-foreground">
            Structured financial visibility — P&L, Balance Sheet, Cash Flow, and
            key ratios.
          </p>
        </div>

        <Tabs defaultValue="pnl">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="pnl" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Profit & Loss
            </TabsTrigger>
            <TabsTrigger value="balance" className="gap-1.5">
              <Scale className="h-3.5 w-3.5" />
              Balance Sheet
            </TabsTrigger>
            <TabsTrigger value="cashflow" className="gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Cash Flow
            </TabsTrigger>
            <TabsTrigger value="ratios" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Ratios
            </TabsTrigger>
            <TabsTrigger value="trial-balance" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Trial Balance
            </TabsTrigger>
            <TabsTrigger value="filters" className="gap-1.5">
              <Filter className="h-3.5 w-3.5" />
              Custom Filters
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pnl" className="mt-4">
            <ProfitLossTab />
          </TabsContent>
          <TabsContent value="balance" className="mt-4">
            <BalanceSheetTab />
          </TabsContent>
          <TabsContent value="cashflow" className="mt-4">
            <CashFlowTab />
          </TabsContent>
          <TabsContent value="ratios" className="mt-4">
            <RatiosTab />
          </TabsContent>
          <TabsContent value="trial-balance" className="mt-4">
            <TrialBalanceTab />
          </TabsContent>
          <TabsContent value="filters" className="mt-4">
            <CustomFiltersTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
