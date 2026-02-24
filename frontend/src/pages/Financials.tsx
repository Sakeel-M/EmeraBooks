import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, PieChart, BarChart3, AlertTriangle, FileUp, Upload } from "lucide-react";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { EmptyState } from "@/components/shared/EmptyState";
import { exportToCSV, formatCurrency, formatDate } from "@/lib/export";
import { GradientBarChart } from "@/components/charts/GradientBarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { FinancialRatiosCard } from "@/components/financials/FinancialRatiosCard";
import { AgingReportCard } from "@/components/financials/AgingReportCard";
import { YoYComparisonChart } from "@/components/financials/YoYComparisonChart";
import { RevenueExpenseTrend } from "@/components/financials/RevenueExpenseTrend";
import { PLDetailTable } from "@/components/financials/PLDetailTable";
import { CategoryDetailPanel } from "@/components/financials/CategoryDetailPanel";
import { TaxationReport } from "@/components/financials/TaxationReport";
import { FinancialDetailSheet, type FinancialDetailType } from "@/components/financials/FinancialDetailSheet";
import { QuarterNavigator, getCurrentQuarter, useQuarterDates } from "@/components/dashboard/QuarterNavigator";
import { CHART_COLORS, formatCurrencyValue } from "@/lib/chartColors";
import { startOfMonth, endOfMonth, format, subMonths, getMonth, getYear, parseISO } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { database } from "@/lib/database";
import { resolveCategory } from "@/lib/sectorMapping";

// Cash flow category classifiers (module-level, compiled once)
const INVESTING_PATTERN = /invest|capital expenditure|capex|asset purchase|equipment|machinery|acquisition|securities|real estate purchase|property purchase|fixed asset|plant|depreciation credit|r&d|patent|trademark/i;
const FINANCING_PATTERN = /loan|borrow|repay|mortgage|debt|bank loan|credit facility|dividend paid|equity issue|share capital|capital injection|interest payment|principal|shareholder|stock buyback/i;

// Exclude internal transfers and ATM withdrawals from P&L (not real income/expenses)
// Must be module-level — used inside useMemo callbacks before it was defined inside the component (TDZ bug)
const NON_PL_CATEGORIES = new Set([
  "internal transfer", "atm & cash withdrawals", "atm", "cash withdrawals",
  "transfer", "atm withdrawal", "cash withdrawal", "cash advance",
  "bank transfer", "wire transfer", "inter-account transfer",
  "opening balance", "closing balance",
]);

// Paginate through all rows to avoid the 1000-row default limit
async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => any,
  batchSize = 1000
): Promise<T[]> {
  const allData: T[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await buildQuery(offset, offset + batchSize - 1);
    if (error) throw error;
    if (data) allData.push(...data);
    if (!data || data.length < batchSize) break;
    offset += batchSize;
  }
  return allData;
}

export default function Financials() {
  const { currency } = useCurrency();
  const currentFileId = database.getCurrentFile();
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 11)),
    to: endOfMonth(new Date()),
  });

  // P&L detail state
  const [selectedPLCategory, setSelectedPLCategory] = useState<string | null>(null);
  const { quarter: initQ, year: initY } = getCurrentQuarter();
  const [plQuarter, setPlQuarter] = useState(initQ);
  const [plYear, setPlYear] = useState(initY);

  // Financial detail sheet state
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState<FinancialDetailType | null>(null);

  const openDetail = (type: FinancialDetailType) => {
    setDetailType(type);
    setDetailOpen(true);
  };

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", dateRange, currentFileId],
    queryFn: () => fetchAllRows<any>((from, to) => {
      let q = supabase
        .from("invoices")
        .select("*, customers(name)")
        .gte("invoice_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("invoice_date", format(dateRange.to, "yyyy-MM-dd"))
        .range(from, to);
      if (currentFileId) q = q.eq("source_file_id", currentFileId);
      return q;
    }),
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", dateRange, currentFileId],
    queryFn: () => fetchAllRows<any>((from, to) => {
      let q = supabase
        .from("bills")
        .select("*, vendors(name)")
        .gte("bill_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("bill_date", format(dateRange.to, "yyyy-MM-dd"))
        .range(from, to);
      if (currentFileId) q = q.eq("source_file_id", currentFileId);
      return q;
    }),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-financials"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("accounts")
        .select("account_type, balance")
        .eq("user_id", user.id);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all invoices/bills (no date filter) for YoY — still scoped to current file
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["all-invoices-yoy", currentFileId],
    queryFn: () => fetchAllRows<any>((from, to) => {
      let q = supabase
        .from("invoices")
        .select("invoice_date, total_amount, category, customers(name)")
        .range(from, to);
      if (currentFileId) q = q.eq("source_file_id", currentFileId);
      return q;
    }),
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["all-bills-yoy", currentFileId],
    queryFn: () => fetchAllRows<any>((from, to) => {
      let q = supabase
        .from("bills")
        .select("bill_date, total_amount, category, vendors(name)")
        .range(from, to);
      if (currentFileId) q = q.eq("source_file_id", currentFileId);
      return q;
    }),
  });

  // Normalized all-time bills/invoices for PLDetailTable (quarterly P&L detail tab)
  const normalizedAllBills = useMemo(
    () => allBills.map(b => ({ ...b, category: resolveCategory(b.category, b.vendors?.name) || b.category })),
    [allBills]
  );
  const normalizedAllInvoices = useMemo(
    () => allInvoices.map(i => ({ ...i, category: resolveCategory(i.category, i.customers?.name) || i.category })),
    [allInvoices]
  );

  // ── PRIMARY P&L DATA SOURCE: all transactions (same as Home page) ───────────
  // This replaces bills/invoices table queries for P&L calculations, ensuring
  // categories and amounts EXACTLY match what the Home page shows.
  const { data: plTxns = [] } = useQuery({
    queryKey: ["pl-transactions", format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("amount, category, description, transaction_date")
        .eq("user_id", user.id)
        .gte("transaction_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("transaction_date", format(dateRange.to, "yyyy-MM-dd"));
      return (data || []).map((t: any) => ({
        ...t,
        resolvedCategory: resolveCategory(t.category, t.description) || "Other",
      }));
    },
  });

  // Transactions for cash flow classification (scoped to file + date range)
  const { data: cashFlowTxns = [] } = useQuery({
    queryKey: ["cf-txns", currentFileId, format(dateRange.from, "yyyy-MM-dd"), format(dateRange.to, "yyyy-MM-dd")],
    queryFn: async () => {
      if (!currentFileId) return [];
      const { data } = await supabase
        .from("transactions")
        .select("amount, category, description")
        .eq("file_id", currentFileId)
        .gte("transaction_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("transaction_date", format(dateRange.to, "yyyy-MM-dd"));
      return data || [];
    },
  });

  // Derived from already-loaded all-time queries — no extra DB calls needed
  const hasAnyBillsOrInvoices = allBills.length > 0 || allInvoices.length > 0;
  const hasData = plTxns.length > 0 || invoices.length > 0 || bills.length > 0;
  // True empty state: no transactions or bills/invoices at all
  const showEmptyState = plTxns.length === 0 && !hasAnyBillsOrInvoices;
  // Data exists but all outside current date range
  const dataOutsideDateRange = plTxns.length === 0 && hasAnyBillsOrInvoices;
  // Sync in progress: file selected but no bills/invoices/transactions yet loaded
  const syncInProgress = plTxns.length === 0 && !hasAnyBillsOrInvoices && !!currentFileId;

  // P&L income/expense split from transactions (NON_PL filtered)
  const plIncomeTxns = useMemo(() =>
    plTxns.filter((t: any) => t.amount > 0 && !NON_PL_CATEGORIES.has(t.resolvedCategory.toLowerCase())),
    [plTxns]
  );
  const plExpenseTxns = useMemo(() =>
    plTxns.filter((t: any) => t.amount < 0 && !NON_PL_CATEGORIES.has(t.resolvedCategory.toLowerCase())),
    [plTxns]
  );

  // P&L quarter ranges (4 quarters ending at selected)
  const plQuarterLabels = useMemo(() => {
    const labels: string[] = [];
    let q = plQuarter, y = plYear;
    for (let i = 3; i >= 0; i--) {
      let tq = q - i, ty = y;
      while (tq <= 0) { tq += 4; ty--; }
      labels.push(`Q${tq} '${String(ty).slice(-2)}`);
    }
    return labels;
  }, [plQuarter, plYear]);

  const plQuarterRanges = useMemo(() => {
    const ranges: { from: Date; to: Date }[] = [];
    let q = plQuarter, y = plYear;
    for (let i = 3; i >= 0; i--) {
      let tq = q - i, ty = y;
      while (tq <= 0) { tq += 4; ty--; }
      const startMonth = (tq - 1) * 3;
      ranges.push({ from: new Date(ty, startMonth, 1), to: new Date(ty, startMonth + 3, 0, 23, 59, 59) });
    }
    return ranges;
  }, [plQuarter, plYear]);

  // Core P&L calculations — from transactions directly (same source as Home page)
  // Gives IDENTICAL categories and amounts to what Home shows
  const totalRevenue = plIncomeTxns.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0);
  const totalExpenses = plExpenseTxns.reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount || 0)), 0);
  const netIncome = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Real assets/liabilities from accounts table, with fallback estimates
  const accountAssets = accounts
    .filter(a => a.account_type === "asset")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const accountLiabilities = accounts
    .filter(a => a.account_type === "liability")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const accountEquity = accounts
    .filter(a => a.account_type === "equity")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  // Fallback: estimate from invoices/bills + P&L net income when no Chart of Accounts
  const outstandingReceivables = invoices
    .filter(i => i.status !== 'paid')
    .reduce((s, i) => s + Number(i.total_amount || 0), 0);
  // Only count genuinely overdue bills as payables — bank-synced bills (status "pending")
  // represent already-cleared transactions and must NOT inflate liabilities.
  const outstandingPayables = bills
    .filter(b => b.status === 'overdue')
    .reduce((s, b) => s + Number(b.total_amount || 0), 0);
  // Assets = cash retained (net income from transactions) + any outstanding receivables
  const totalAssets = accountAssets > 0
    ? accountAssets
    : outstandingReceivables + Math.max(0, netIncome);
  const totalLiabilities = accountLiabilities > 0 ? accountLiabilities : outstandingPayables;
  // Equity = net income (retained earnings) when no Chart of Accounts
  const equity = accountEquity > 0 ? accountEquity : netIncome;

  const cashFlow = useMemo(() => {
    let investing = 0, financing = 0;
    for (const t of cashFlowTxns) {
      const text = `${t.category || ""} ${t.description || ""}`;
      const amt = Number(t.amount || 0);
      if (INVESTING_PATTERN.test(text)) investing += amt;
      else if (FINANCING_PATTERN.test(text)) financing += amt;
    }
    const total = cashFlowTxns.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    // Fall back to 0 if no transactions loaded — Net Income ≠ Cash from Operations
    const ops = cashFlowTxns.length > 0 ? total - investing - financing : 0;
    return { operations: ops, investing, financing };
  }, [cashFlowTxns]);
  const cashFromOperations = cashFlow.operations;
  const cashFromInvesting = cashFlow.investing;
  const cashFromFinancing = cashFlow.financing;

  // Calculate real trend percentages
  const trends = useMemo(() => {
    const midpoint = new Date((dateRange.from.getTime() + dateRange.to.getTime()) / 2);
    const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
    const prevFrom = new Date(dateRange.from.getTime() - periodLength);
    const prevTo = new Date(dateRange.from.getTime() - 1);

    const prevRevenue = allInvoices
      .filter(inv => {
        const d = new Date(inv.invoice_date);
        return d >= prevFrom && d <= prevTo;
      })
      .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);

    const prevExpenses = allBills
      .filter(bill => {
        const d = new Date(bill.bill_date);
        return d >= prevFrom && d <= prevTo;
      })
      .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);

    const calcTrend = (current: number, previous: number) => {
      if (previous === 0 && current === 0) return null;
      if (previous === 0) return null;
      return ((current - previous) / previous) * 100;
    };

    return {
      revenue: calcTrend(totalRevenue, prevRevenue),
      expenses: calcTrend(totalExpenses, prevExpenses),
    };
  }, [totalRevenue, totalExpenses, allInvoices, allBills, dateRange]);

  // Chart data — actual signed values so losses/negative equity display correctly
  const plData = [
    { name: "Revenue", value: totalRevenue, color: CHART_COLORS.success },
    { name: "Expenses", value: totalExpenses, color: CHART_COLORS.danger },
    { name: "Net Income", value: netIncome, color: netIncome >= 0 ? CHART_COLORS.info : CHART_COLORS.danger },
  ];

  const balanceData = [
    { name: "Assets", value: totalAssets, color: CHART_COLORS.success },
    { name: "Liabilities", value: totalLiabilities, color: CHART_COLORS.danger },
    { name: "Equity", value: equity, color: equity >= 0 ? CHART_COLORS.purple : CHART_COLORS.danger },
  ];

  const cashFlowData = [
    { name: "Operating", value: cashFromOperations, color: cashFromOperations >= 0 ? CHART_COLORS.success : CHART_COLORS.danger },
    { name: "Investing", value: cashFromInvesting, color: cashFromInvesting >= 0 ? CHART_COLORS.info : CHART_COLORS.amber },
    { name: "Financing", value: cashFromFinancing, color: cashFromFinancing >= 0 ? CHART_COLORS.purple : CHART_COLORS.danger },
  ];

  // Monthly trend data — from transactions (same source as Home), group by "yyyy-MM"
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { revenue: number; expenses: number; netIncome: number }> = {};
    plTxns.forEach((t: any) => {
      const monthKey = format(new Date(t.transaction_date), "yyyy-MM");
      if (!months[monthKey]) months[monthKey] = { revenue: 0, expenses: 0, netIncome: 0 };
      if (t.amount > 0 && !NON_PL_CATEGORIES.has(t.resolvedCategory.toLowerCase())) {
        months[monthKey].revenue += Number(t.amount);
      } else if (t.amount < 0 && !NON_PL_CATEGORIES.has(t.resolvedCategory.toLowerCase())) {
        months[monthKey].expenses += Math.abs(Number(t.amount));
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, data]) => ({
        month: format(parseISO(key + "-01"), "MMM yyyy"),
        revenue: data.revenue,
        expenses: data.expenses,
        netIncome: data.revenue - data.expenses,
      }));
  }, [plTxns]);

  // Auto-detect the two most recent years from actual data.
  // Prevents comparing 2026 (empty) vs 2025 (full data) when all data lives in a past year.
  const { currentYear, previousYear } = useMemo(() => {
    const years = new Set<number>();
    allInvoices.forEach(inv => { const y = getYear(new Date(inv.invoice_date)); if (y > 1970) years.add(y); });
    allBills.forEach(bill => { const y = getYear(new Date(bill.bill_date)); if (y > 1970) years.add(y); });
    const sorted = Array.from(years).sort((a, b) => b - a);
    const cy = sorted[0] ?? new Date().getFullYear();
    const py = sorted[1] ?? cy - 1;
    return { currentYear: cy, previousYear: py };
  }, [allInvoices, allBills]);

  const yoyRevenueData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month, idx) => {
      const curYearTotal = allInvoices
        .filter(inv => {
          const d = new Date(inv.invoice_date);
          return getYear(d) === currentYear && getMonth(d) === idx;
        })
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const prevYearTotal = allInvoices
        .filter(inv => {
          const d = new Date(inv.invoice_date);
          return getYear(d) === previousYear && getMonth(d) === idx;
        })
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      return { month, currentYear: curYearTotal, previousYear: prevYearTotal };
    });
  }, [allInvoices, currentYear, previousYear]);

  const yoyExpenseData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months.map((month, idx) => {
      const curYearTotal = allBills
        .filter(bill => {
          const d = new Date(bill.bill_date);
          return getYear(d) === currentYear && getMonth(d) === idx;
        })
        .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
      const prevYearTotal = allBills
        .filter(bill => {
          const d = new Date(bill.bill_date);
          return getYear(d) === previousYear && getMonth(d) === idx;
        })
        .reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
      return { month, currentYear: curYearTotal, previousYear: prevYearTotal };
    });
  }, [allBills, currentYear, previousYear]);

  const hasYoYData = allInvoices.length > 0 || allBills.length > 0;

  // Aging report data
  const agingInvoices = invoices
    .filter((inv) => inv.status !== "paid")
    .map((inv) => ({
      id: inv.id,
      name: (inv.customers as any)?.name || "Unknown",
      number: inv.invoice_number,
      amount: Number(inv.total_amount),
      dueDate: inv.due_date,
      type: "invoice" as const,
    }));

  const agingBills = bills
    .filter((bill) => bill.status !== "paid")
    .map((bill) => ({
      id: bill.id,
      name: (bill.vendors as any)?.name || "Unknown",
      number: bill.bill_number,
      amount: Number(bill.total_amount),
      dueDate: bill.due_date,
      type: "bill" as const,
    }));

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, colorClass, onClick }: {
    title: string;
    value: string;
    icon: any;
    trend?: "up" | "down";
    trendValue?: string;
    colorClass?: string;
    onClick?: () => void;
  }) => (
    <Card
      className={`stat-card-hover overflow-hidden transition-all ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary/30" : ""}`}
      onClick={onClick}
      title={onClick ? "Click for details" : undefined}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${colorClass || "text-foreground"}`}>{value}</p>
            {trend && trendValue && (
              <div className={`flex items-center gap-1 mt-2 text-sm ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
                {trend === "up" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                <span>{trendValue}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClass?.includes("destructive") ? "from-red-500/10 to-red-500/5" : "from-primary/10 to-primary/5"}`}>
            <Icon className={`w-5 h-5 ${colorClass || "text-primary"}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">Financials</h1>
            <p className="text-muted-foreground">Comprehensive financial overview and analysis</p>
          </div>
          <Button variant="outline" onClick={() => exportToCSV(plData, "financial-report")}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <EnhancedDateRangePicker
          onRangeChange={(from, to) => setDateRange({ from, to })}
          defaultRange={dateRange}
        />

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-7 h-auto">
            <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
            <TabsTrigger value="pl" className="py-2.5">P&L</TabsTrigger>
            <TabsTrigger value="pl-detail" className="py-2.5">P&L Detail</TabsTrigger>
            <TabsTrigger value="balance" className="py-2.5">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow" className="py-2.5">Cash Flow</TabsTrigger>
            <TabsTrigger value="taxation" className="py-2.5">Taxation</TabsTrigger>
            <TabsTrigger value="yoy" className="py-2.5">YoY</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {showEmptyState ? (
              <EmptyState
                icon={BarChart3}
                title="No financial data yet"
                description="Create invoices or bills to see your financial overview here."
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard
                    title="Total Revenue"
                    value={formatCurrencyValue(totalRevenue, currency)}
                    icon={DollarSign}
                    trend={trends.revenue !== null ? (trends.revenue >= 0 ? "up" : "down") : undefined}
                    trendValue={trends.revenue !== null ? `${trends.revenue >= 0 ? "+" : ""}${trends.revenue.toFixed(1)}%` : undefined}
                    colorClass="text-green-600"
                    onClick={() => openDetail("revenue")}
                  />
                  <StatCard
                    title="Total Expenses"
                    value={formatCurrencyValue(totalExpenses, currency)}
                    icon={Wallet}
                    trend={trends.expenses !== null ? (trends.expenses >= 0 ? "up" : "down") : undefined}
                    trendValue={trends.expenses !== null ? `${trends.expenses >= 0 ? "+" : ""}${trends.expenses.toFixed(1)}%` : undefined}
                    colorClass="text-destructive"
                    onClick={() => openDetail("expenses")}
                  />
                  <StatCard
                    title="Net Income"
                    value={formatCurrencyValue(netIncome, currency)}
                    icon={netIncome >= 0 ? TrendingUp : TrendingDown}
                    trend={netIncome >= 0 ? "up" : "down"}
                    trendValue={`${Math.abs(profitMargin).toFixed(1)}% margin`}
                    colorClass={netIncome >= 0 ? "text-blue-600" : "text-destructive"}
                    onClick={() => openDetail("net-income")}
                  />
                  <StatCard
                    title="Profit Margin"
                    value={`${profitMargin.toFixed(1)}%`}
                    icon={PieChart}
                    colorClass={profitMargin >= 20 ? "text-green-600" : profitMargin >= 10 ? "text-amber-500" : "text-destructive"}
                    onClick={() => openDetail("profit-margin")}
                  />
                </div>

                {dataOutsideDateRange && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Financial data exists but is outside the selected date range. Try extending the range above.
                  </div>
                )}
                {syncInProgress && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-sm">
                    <svg className="w-4 h-4 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
                    Sync in progress — Financial statements will populate shortly. Refresh to update.
                  </div>
                )}

                <RevenueExpenseTrend data={monthlyTrendData} currency={currency} onStatClick={openDetail} />

                <FinancialRatiosCard
                  totalRevenue={totalRevenue}
                  totalExpenses={totalExpenses}
                  netIncome={netIncome}
                  totalAssets={totalAssets}
                  totalLiabilities={totalLiabilities}
                  equity={equity}
                />
              </>
            )}
          </TabsContent>

          {/* P&L Tab */}
          <TabsContent value="pl" className="space-y-6 mt-6">
            {showEmptyState ? (
              <EmptyState icon={BarChart3} title="No P&L data" description="Create invoices and bills to generate your Profit & Loss statement." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard title="Total Revenue" value={formatCurrencyValue(totalRevenue, currency)} icon={DollarSign} colorClass="text-green-600" onClick={() => openDetail("revenue")} />
                  <StatCard title="Total Expenses" value={formatCurrencyValue(totalExpenses, currency)} icon={Wallet} colorClass="text-destructive" onClick={() => openDetail("expenses")} />
                  <StatCard title="Net Income" value={formatCurrencyValue(netIncome, currency)} icon={TrendingUp} colorClass={netIncome >= 0 ? "text-blue-600" : "text-destructive"} onClick={() => openDetail("net-income")} />
                  <StatCard title="Profit Margin" value={`${profitMargin.toFixed(1)}%`} icon={PieChart} onClick={() => openDetail("profit-margin")} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Profit & Loss Breakdown</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={plData} height={300} isCurrency={true} currency={currency} onBarClick={(item) => openDetail(item.name.toLowerCase().replace(/ /g, "-") as FinancialDetailType)} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Revenue Distribution</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={plData} centerValue={totalRevenue} centerLabel="Total" height={280} isCurrency={true} currency={currency} onSliceClick={(item) => openDetail(item.name.toLowerCase().replace(/ /g, "-") as FinancialDetailType)} />
                    </CardContent>
                  </Card>
                </div>

              </>
            )}
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance" className="space-y-6 mt-6">
            {plTxns.length === 0 ? (
              /* ── STATE 1: No uploaded document ── */
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-5">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                  <FileUp className="w-10 h-10 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">No financial data yet</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Upload a bank statement to generate financial reports, or connect your bank account for real-time balance sheet data.
                  </p>
                </div>
                <Button onClick={() => window.location.href = "/"}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Bank Statement
                </Button>
              </div>
            ) : accountAssets > 0 ? (
              /* ── STATE 2: Chart of Accounts set up — show real balance sheet ── */
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard title="Total Assets" value={formatCurrencyValue(totalAssets, currency)} icon={DollarSign} colorClass="text-green-600" onClick={() => openDetail("assets")} />
                  <StatCard title="Total Liabilities" value={formatCurrencyValue(totalLiabilities, currency)} icon={Wallet} colorClass="text-destructive" onClick={() => openDetail("liabilities")} />
                  <StatCard title="Equity" value={formatCurrencyValue(equity, currency)} icon={TrendingUp} colorClass="text-purple-600" onClick={() => openDetail("equity")} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Balance Sheet Overview</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={balanceData} height={300} isCurrency={true} currency={currency} onBarClick={(item) => openDetail(item.name.toLowerCase() as FinancialDetailType)} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Asset Composition</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={balanceData} centerValue={totalAssets} centerLabel="Total Assets" height={280} isCurrency={true} currency={currency} onSliceClick={(item) => openDetail(item.name.toLowerCase() as FinancialDetailType)} />
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              /* ── STATE 3: Bank statement uploaded, no Chart of Accounts — honest P&L summary ── */
              <>
                {/* Disclaimer banner */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Results from uploaded bank statement — not a certified balance sheet</p>
                    <p className="text-xs mt-1 opacity-80">
                      These figures are calculated from your uploaded document. Internal transfers are excluded from P&L.
                      For a real balance sheet, set up your Chart of Accounts in the Accounting page.
                    </p>
                  </div>
                </div>

                {/* P&L Summary Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard title="Total Revenue" value={formatCurrencyValue(totalRevenue, currency)} icon={DollarSign} colorClass="text-green-600" onClick={() => openDetail("revenue")} />
                  <StatCard title="Total Expenses" value={formatCurrencyValue(totalExpenses, currency)} icon={Wallet} colorClass="text-destructive" onClick={() => openDetail("expenses")} />
                  <StatCard title="Net Income (P&L)" value={formatCurrencyValue(netIncome, currency)} icon={netIncome >= 0 ? TrendingUp : TrendingDown} colorClass={netIncome >= 0 ? "text-purple-600" : "text-destructive"} onClick={() => openDetail("net-income")} />
                </div>

                {/* Statement Breakdown Table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Statement Summary</CardTitle>
                    <p className="text-xs text-muted-foreground">Derived from uploaded bank statement · Internal transfers excluded from P&L</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <table className="w-full text-sm">
                      <tbody>
                        {/* INCOME */}
                        <tr className="bg-muted/50">
                          <td colSpan={2} className="px-6 py-2 font-bold text-foreground text-xs uppercase tracking-wide">Income</td>
                        </tr>
                        <tr className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3 pl-10 text-muted-foreground">P&L Revenue (excl. internal transfers)</td>
                          <td className="px-6 py-3 text-right font-medium text-green-600">{formatCurrencyValue(totalRevenue, currency)}</td>
                        </tr>
                        <tr className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3 pl-10 text-muted-foreground">Accounts Receivable (Unpaid Invoices)</td>
                          <td className="px-6 py-3 text-right font-medium text-green-600">{formatCurrencyValue(outstandingReceivables, currency)}</td>
                        </tr>

                        {/* EXPENSES */}
                        <tr className="bg-muted/50 border-t-4 border-border">
                          <td colSpan={2} className="px-6 py-2 font-bold text-foreground text-xs uppercase tracking-wide">Expenses</td>
                        </tr>
                        <tr className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3 pl-10 text-muted-foreground">P&L Expenses (excl. internal transfers)</td>
                          <td className="px-6 py-3 text-right font-medium text-destructive">{formatCurrencyValue(totalExpenses, currency)}</td>
                        </tr>
                        <tr className="border-t border-border/40 hover:bg-muted/20">
                          <td className="px-6 py-3 pl-10 text-muted-foreground">Accounts Payable (Pending Bills)</td>
                          <td className="px-6 py-3 text-right font-medium text-destructive">{formatCurrencyValue(outstandingPayables, currency)}</td>
                        </tr>

                        {/* NET */}
                        <tr className="bg-muted/50 border-t-4 border-border">
                          <td colSpan={2} className="px-6 py-2 font-bold text-foreground text-xs uppercase tracking-wide">Net Position</td>
                        </tr>
                        <tr className="border-t-2 border-border font-bold bg-purple-50/30 dark:bg-purple-950/10">
                          <td className="px-6 py-3 text-foreground">Net Income (Revenue − Expenses)</td>
                          <td className={`px-6 py-3 text-right ${netIncome >= 0 ? "text-purple-600" : "text-destructive"}`}>{formatCurrencyValue(netIncome, currency)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* CTA */}
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium">Want an accurate balance sheet?</p>
                      <p className="text-xs text-muted-foreground mt-1">Set up your Chart of Accounts in the Accounting page for real assets, liabilities &amp; equity data.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => window.location.href = "/accounting"}>
                      Set Up Chart of Accounts
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-6 mt-6">
            {showEmptyState ? (
              <EmptyState icon={BarChart3} title="No cash flow data" description="Create invoices and bills to see your cash flow statement." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard title="Operating Activities" value={formatCurrencyValue(cashFromOperations, currency)} icon={TrendingUp} colorClass={cashFromOperations >= 0 ? "text-green-600" : "text-destructive"} onClick={() => openDetail("operating")} />
                  <StatCard title="Investing Activities" value={formatCurrencyValue(cashFromInvesting, currency)} icon={Wallet} colorClass="text-blue-600" onClick={() => openDetail("investing")} />
                  <StatCard title="Financing Activities" value={formatCurrencyValue(cashFromFinancing, currency)} icon={DollarSign} colorClass="text-purple-600" onClick={() => openDetail("financing")} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Cash Flow Statement</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={cashFlowData} height={300} isCurrency={true} currency={currency} onBarClick={(item) => openDetail(item.name.toLowerCase() as FinancialDetailType)} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Cash Flow Distribution</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={cashFlowData} centerValue={cashFromOperations + cashFromInvesting + cashFromFinancing} centerLabel="Net Cash" height={280} isCurrency={true} currency={currency} onSliceClick={(item) => openDetail(item.name.toLowerCase() as FinancialDetailType)} />
                    </CardContent>
                  </Card>
                </div>

              </>
            )}
          </TabsContent>

          {/* P&L Detail Tab */}
          <TabsContent value="pl-detail" className="space-y-6 mt-6">
            {showEmptyState ? (
              <EmptyState icon={BarChart3} title="No P&L data" description="Create invoices and bills to see your detailed P&L." />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <QuarterNavigator
                    currentQuarter={plQuarter}
                    currentYear={plYear}
                    onNavigate={(q, y) => { setPlQuarter(q); setPlYear(y); }}
                  />
                </div>
                <PLDetailTable
                  invoices={normalizedAllInvoices}
                  bills={normalizedAllBills}
                  accounts={accounts}
                  quarterLabels={plQuarterLabels}
                  quarterRanges={plQuarterRanges}
                  onRowClick={(row) => setSelectedPLCategory(row.label)}
                  currency={currency}
                />
                <CategoryDetailPanel
                  open={!!selectedPLCategory}
                  onClose={() => setSelectedPLCategory(null)}
                  category={selectedPLCategory || ""}
                  invoices={normalizedAllInvoices}
                  bills={normalizedAllBills}
                  quarterLabels={plQuarterLabels}
                  quarterRanges={plQuarterRanges}
                  currency={currency}
                />
              </>
            )}
          </TabsContent>

          {/* Taxation Tab */}
          <TabsContent value="taxation" className="space-y-6 mt-6">
            {showEmptyState ? (
              <EmptyState icon={BarChart3} title="No taxation data" description="Create invoices and bills to generate your tax report." />
            ) : (
              <TaxationReport
                totalRevenue={totalRevenue}
                totalExpenses={totalExpenses}
                netIncome={netIncome}
                currency={currency}
                invoices={invoices}
                bills={bills}
              />
            )}
          </TabsContent>

          {/* YoY Tab */}
          <TabsContent value="yoy" className="space-y-6 mt-6">
            {!hasYoYData ? (
              <EmptyState icon={BarChart3} title="No year-over-year data" description="Create invoices and bills across multiple years to see YoY comparisons." />
            ) : (
              <YoYComparisonChart
                revenueData={yoyRevenueData}
                expenseData={yoyExpenseData}
                currentYearLabel={String(currentYear)}
                previousYearLabel={String(previousYear)}
                currency={currency}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <FinancialDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        type={detailType}
        invoices={invoices as any[]}
        bills={bills as any[]}
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        netIncome={netIncome}
        profitMargin={profitMargin}
        totalAssets={totalAssets}
        totalLiabilities={totalLiabilities}
        equity={equity}
        outstandingReceivables={outstandingReceivables}
        outstandingPayables={outstandingPayables}
        currency={currency}
      />
    </Layout>
  );
}

