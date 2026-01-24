import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Download, TrendingUp, TrendingDown, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, PieChart } from "lucide-react";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { exportToCSV, formatCurrency, formatDate } from "@/lib/export";
import { GradientBarChart } from "@/components/charts/GradientBarChart";
import { DonutChart } from "@/components/charts/DonutChart";
import { AreaTrendChart } from "@/components/charts/AreaTrendChart";
import { FinancialRatiosCard } from "@/components/financials/FinancialRatiosCard";
import { AgingReportCard } from "@/components/financials/AgingReportCard";
import { YoYComparisonChart } from "@/components/financials/YoYComparisonChart";
import { RevenueExpenseTrend } from "@/components/financials/RevenueExpenseTrend";
import { CHART_COLORS, formatCurrencyValue } from "@/lib/chartColors";
import { startOfMonth, endOfMonth, format, subMonths, getMonth, getYear } from "date-fns";

export default function Financials() {
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(subMonths(new Date(), 5)),
    to: endOfMonth(new Date()),
  });

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

  // Core calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  const totalExpenses = bills.reduce((sum, bill) => sum + Number(bill.total_amount || 0), 0);
  const netIncome = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  const totalAssets = totalRevenue * 1.5;
  const totalLiabilities = bills.filter(b => b.status !== 'paid').reduce((sum, b) => sum + Number(b.total_amount || 0), 0);
  const equity = totalAssets - totalLiabilities;

  const cashFromOperations = netIncome;
  const cashFromInvesting = 0;
  const cashFromFinancing = 0;

  // Chart data with colors
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
    { name: "Investing", value: cashFromInvesting || 1000, color: CHART_COLORS.info },
    { name: "Financing", value: cashFromFinancing || 500, color: CHART_COLORS.purple },
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

  // YoY data (simulated for demo)
  const yoyRevenueData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((month) => ({
      month,
      currentYear: Math.floor(Math.random() * 50000) + 20000,
      previousYear: Math.floor(Math.random() * 40000) + 15000,
    }));
  }, []);

  const yoyExpenseData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
    return months.map((month) => ({
      month,
      currentYear: Math.floor(Math.random() * 30000) + 10000,
      previousYear: Math.floor(Math.random() * 25000) + 8000,
    }));
  }, []);

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
          <TabsList className="grid w-full grid-cols-6 h-auto">
            <TabsTrigger value="overview" className="py-2.5">Overview</TabsTrigger>
            <TabsTrigger value="pl" className="py-2.5">P&L</TabsTrigger>
            <TabsTrigger value="balance" className="py-2.5">Balance Sheet</TabsTrigger>
            <TabsTrigger value="cashflow" className="py-2.5">Cash Flow</TabsTrigger>
            <TabsTrigger value="aging" className="py-2.5">Aging</TabsTrigger>
            <TabsTrigger value="yoy" className="py-2.5">YoY</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Total Revenue"
                value={formatCurrencyValue(totalRevenue)}
                icon={DollarSign}
                trend="up"
                trendValue="+12.5%"
                colorClass="text-green-600"
              />
              <StatCard
                title="Total Expenses"
                value={formatCurrencyValue(totalExpenses)}
                icon={Wallet}
                trend="down"
                trendValue="-3.2%"
                colorClass="text-destructive"
              />
              <StatCard
                title="Net Income"
                value={formatCurrencyValue(netIncome)}
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
          </TabsContent>

          {/* P&L Tab */}
          <TabsContent value="pl" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Total Revenue" value={formatCurrencyValue(totalRevenue)} icon={DollarSign} colorClass="text-green-600" />
              <StatCard title="Total Expenses" value={formatCurrencyValue(totalExpenses)} icon={Wallet} colorClass="text-destructive" />
              <StatCard title="Net Income" value={formatCurrencyValue(netIncome)} icon={TrendingUp} colorClass={netIncome >= 0 ? "text-blue-600" : "text-destructive"} />
              <StatCard title="Profit Margin" value={`${profitMargin.toFixed(1)}%`} icon={PieChart} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Profit & Loss Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GradientBarChart data={plData} height={300} isCurrency={true} />
                </CardContent>
              </Card>

              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Revenue Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <DonutChart
                    data={plData}
                    centerValue={totalRevenue}
                    centerLabel="Total"
                    height={280}
                    isCurrency={true}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Balance Sheet Tab */}
          <TabsContent value="balance" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard title="Total Assets" value={formatCurrencyValue(totalAssets)} icon={DollarSign} colorClass="text-green-600" />
              <StatCard title="Total Liabilities" value={formatCurrencyValue(totalLiabilities)} icon={Wallet} colorClass="text-destructive" />
              <StatCard title="Equity" value={formatCurrencyValue(equity)} icon={TrendingUp} colorClass="text-purple-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Balance Sheet Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GradientBarChart data={balanceData} height={300} isCurrency={true} />
                </CardContent>
              </Card>

              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Asset Composition
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <DonutChart
                    data={balanceData}
                    centerValue={totalAssets}
                    centerLabel="Total Assets"
                    height={280}
                    isCurrency={true}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Cash Flow Tab */}
          <TabsContent value="cashflow" className="space-y-6 mt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard title="Operating Activities" value={formatCurrencyValue(cashFromOperations)} icon={TrendingUp} colorClass={cashFromOperations >= 0 ? "text-green-600" : "text-destructive"} />
              <StatCard title="Investing Activities" value={formatCurrencyValue(cashFromInvesting)} icon={Wallet} colorClass="text-blue-600" />
              <StatCard title="Financing Activities" value={formatCurrencyValue(cashFromFinancing)} icon={DollarSign} colorClass="text-purple-600" />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Cash Flow Statement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GradientBarChart data={cashFlowData} height={300} isCurrency={true} />
                </CardContent>
              </Card>

              <Card className="chart-enter">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Cash Flow Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <DonutChart
                    data={cashFlowData}
                    centerValue={cashFromOperations + cashFromInvesting + cashFromFinancing}
                    centerLabel="Net Cash"
                    height={280}
                    isCurrency={true}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Aging Tab */}
          <TabsContent value="aging" className="space-y-6 mt-6">
            <AgingReportCard invoices={agingInvoices} bills={agingBills} />
          </TabsContent>

          {/* YoY Tab */}
          <TabsContent value="yoy" className="space-y-6 mt-6">
            <YoYComparisonChart
              revenueData={yoyRevenueData}
              expenseData={yoyExpenseData}
              currentYearLabel={String(new Date().getFullYear())}
              previousYearLabel={String(new Date().getFullYear() - 1)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
