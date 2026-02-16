import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, PieChart, BarChart3 } from "lucide-react";
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
import { QuarterNavigator, getCurrentQuarter, useQuarterDates } from "@/components/dashboard/QuarterNavigator";
import { CHART_COLORS, formatCurrencyValue } from "@/lib/chartColors";
import { startOfMonth, endOfMonth, format, subMonths, getMonth, getYear } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";

export default function Financials() {
  const { currency } = useCurrency();
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: endOfMonth(new Date()),
  });

  // P&L detail state
  const [selectedPLCategory, setSelectedPLCategory] = useState<string | null>(null);
  const { quarter: initQ, year: initY } = getCurrentQuarter();
  const [plQuarter, setPlQuarter] = useState(initQ);
  const [plYear, setPlYear] = useState(initY);

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name)")
        .gte("invoice_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("invoice_date", format(dateRange.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["bills", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, vendors(name)")
        .gte("bill_date", format(dateRange.from, "yyyy-MM-dd"))
        .lte("bill_date", format(dateRange.to, "yyyy-MM-dd"));
      if (error) throw error;
      return data || [];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-for-financials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts")
        .select("account_type, balance");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all invoices/bills (no date filter) for YoY
  const { data: allInvoices = [] } = useQuery({
    queryKey: ["all-invoices-yoy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("invoice_date, total_amount, category, customers(name)");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["all-bills-yoy"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("bill_date, total_amount, category, vendors(name)");
      if (error) throw error;
      return data || [];
    },
  });

  const hasData = invoices.length > 0 || bills.length > 0;

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

  // Core calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const totalExpenses = bills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
  const netIncome = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Real assets/liabilities from accounts table
  const totalAssets = accounts
    .filter(a => a.account_type === "asset")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const totalLiabilities = accounts
    .filter(a => a.account_type === "liability")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const equity = accounts
    .filter(a => a.account_type === "equity")
    .reduce((sum, a) => sum + Number(a.balance || 0), 0) || (totalAssets - totalLiabilities);

  const cashFromOperations = netIncome;
  const cashFromInvesting = 0;
  const cashFromFinancing = 0;

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

  // Chart data
  const plData = [
    { name: "Revenue", value: totalRevenue, color: CHART_COLORS.success },
    { name: "Expenses", value: totalExpenses, color: CHART_COLORS.danger },
    { name: "Net Income", value: Math.abs(netIncome), color: netIncome >= 0 ? CHART_COLORS.info : CHART_COLORS.danger },
  ];

  const balanceData = [
    { name: "Assets", value: totalAssets, color: CHART_COLORS.success },
    { name: "Liabilities", value: totalLiabilities, color: CHART_COLORS.danger },
    { name: "Equity", value: Math.abs(equity), color: CHART_COLORS.purple },
  ];

  const cashFlowData = [
    { name: "Operating", value: Math.abs(cashFromOperations), color: CHART_COLORS.success },
    { name: "Investing", value: cashFromInvesting, color: CHART_COLORS.info },
    { name: "Financing", value: cashFromFinancing, color: CHART_COLORS.purple },
  ];

  // Monthly trend data
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, { revenue: number; expenses: number; netIncome: number }> = {};
    invoices.forEach((inv) => {
      const monthKey = format(new Date(inv.invoice_date), "MMM");
      if (!months[monthKey]) months[monthKey] = { revenue: 0, expenses: 0, netIncome: 0 };
      months[monthKey].revenue += Number(inv.total_amount || 0);
    });
    bills.forEach((bill) => {
      const monthKey = format(new Date(bill.bill_date), "MMM");
      if (!months[monthKey]) months[monthKey] = { revenue: 0, expenses: 0, netIncome: 0 };
      months[monthKey].expenses += Number(bill.total_amount || 0);
    });
    Object.keys(months).forEach((key) => {
      months[key].netIncome = months[key].revenue - months[key].expenses;
    });
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Object.entries(months)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
  }, [invoices, bills]);

  // Real YoY data from all invoices/bills
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

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

  const StatCard = ({ title, value, icon: Icon, trend, trendValue, colorClass }: {
    title: string;
    value: string;
    icon: any;
    trend?: "up" | "down";
    trendValue?: string;
    colorClass?: string;
  }) => (
    <Card className="stat-card-hover overflow-hidden">
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
            <TabsTrigger value="aging" className="py-2.5">Aging</TabsTrigger>
            <TabsTrigger value="yoy" className="py-2.5">YoY</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {!hasData ? (
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
                  />
                  <StatCard
                    title="Total Expenses"
                    value={formatCurrencyValue(totalExpenses, currency)}
                    icon={Wallet}
                    trend={trends.expenses !== null ? (trends.expenses >= 0 ? "up" : "down") : undefined}
                    trendValue={trends.expenses !== null ? `${trends.expenses >= 0 ? "+" : ""}${trends.expenses.toFixed(1)}%` : undefined}
                    colorClass="text-destructive"
                  />
                  <StatCard
                    title="Net Income"
                    value={formatCurrencyValue(netIncome, currency)}
                    icon={netIncome >= 0 ? TrendingUp : TrendingDown}
                    trend={netIncome >= 0 ? "up" : "down"}
                    trendValue={`${Math.abs(profitMargin).toFixed(1)}% margin`}
                    colorClass={netIncome >= 0 ? "text-blue-600" : "text-destructive"}
                  />
                  <StatCard
                    title="Profit Margin"
                    value={`${profitMargin.toFixed(1)}%`}
                    icon={PieChart}
                    colorClass={profitMargin >= 20 ? "text-green-600" : profitMargin >= 10 ? "text-amber-500" : "text-destructive"}
                  />
                </div>

                <RevenueExpenseTrend data={monthlyTrendData} />

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
            {!hasData ? (
              <EmptyState icon={BarChart3} title="No P&L data" description="Create invoices and bills to generate your Profit & Loss statement." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-4">
                  <StatCard title="Total Revenue" value={formatCurrencyValue(totalRevenue, currency)} icon={DollarSign} colorClass="text-green-600" />
                  <StatCard title="Total Expenses" value={formatCurrencyValue(totalExpenses, currency)} icon={Wallet} colorClass="text-destructive" />
                  <StatCard title="Net Income" value={formatCurrencyValue(netIncome, currency)} icon={TrendingUp} colorClass={netIncome >= 0 ? "text-blue-600" : "text-destructive"} />
                  <StatCard title="Profit Margin" value={`${profitMargin.toFixed(1)}%`} icon={PieChart} />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Profit & Loss Breakdown</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={plData} height={300} isCurrency={true} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Revenue Distribution</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={plData} centerValue={totalRevenue} centerLabel="Total" height={280} isCurrency={true} />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance" className="space-y-6 mt-6">
            {totalAssets === 0 && totalLiabilities === 0 && equity === 0 ? (
              <EmptyState icon={BarChart3} title="No balance sheet data" description="Set up your Chart of Accounts to see your balance sheet." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard title="Total Assets" value={formatCurrencyValue(totalAssets, currency)} icon={DollarSign} colorClass="text-green-600" />
                  <StatCard title="Total Liabilities" value={formatCurrencyValue(totalLiabilities, currency)} icon={Wallet} colorClass="text-destructive" />
                  <StatCard title="Equity" value={formatCurrencyValue(equity, currency)} icon={TrendingUp} colorClass="text-purple-600" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Balance Sheet Overview</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={balanceData} height={300} isCurrency={true} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Asset Composition</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={balanceData} centerValue={totalAssets} centerLabel="Total Assets" height={280} isCurrency={true} />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-6 mt-6">
            {!hasData ? (
              <EmptyState icon={BarChart3} title="No cash flow data" description="Create invoices and bills to see your cash flow statement." />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard title="Operating Activities" value={formatCurrencyValue(cashFromOperations, currency)} icon={TrendingUp} colorClass={cashFromOperations >= 0 ? "text-green-600" : "text-destructive"} />
                  <StatCard title="Investing Activities" value={formatCurrencyValue(cashFromInvesting, currency)} icon={Wallet} colorClass="text-blue-600" />
                  <StatCard title="Financing Activities" value={formatCurrencyValue(cashFromFinancing, currency)} icon={DollarSign} colorClass="text-purple-600" />
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Cash Flow Statement</CardTitle></CardHeader>
                    <CardContent><GradientBarChart data={cashFlowData} height={300} isCurrency={true} /></CardContent>
                  </Card>
                  <Card className="chart-enter">
                    <CardHeader><CardTitle className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-primary" />Cash Flow Distribution</CardTitle></CardHeader>
                    <CardContent className="flex items-center justify-center">
                      <DonutChart data={cashFlowData} centerValue={cashFromOperations + cashFromInvesting + cashFromFinancing} centerLabel="Net Cash" height={280} isCurrency={true} />
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* P&L Detail Tab */}
          <TabsContent value="pl-detail" className="space-y-6 mt-6">
            {!hasData ? (
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
                  invoices={allInvoices}
                  bills={allBills}
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
                  invoices={allInvoices}
                  bills={allBills}
                  quarterLabels={plQuarterLabels}
                  quarterRanges={plQuarterRanges}
                  currency={currency}
                />
              </>
            )}
          </TabsContent>

          {/* Aging Tab */}
          <TabsContent value="aging" className="space-y-6 mt-6">
            <AgingReportCard invoices={agingInvoices} bills={agingBills} />
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
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
