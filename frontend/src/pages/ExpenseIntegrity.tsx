import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Wallet,
  BarChart3,
  Eye,
  ShieldAlert,
  Store,
  CreditCard,
  Scale,
  Ban,
  ArrowRightLeft,
  Zap,
  FileWarning,
  Flame,
  Calendar,
  Plus,
  Copy,
  Merge,
  Trash2,
  Loader2,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { format, subMonths, addDays, differenceInDays, isAfter, parseISO } from "date-fns";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { toast } from "sonner";
import { useDateRange } from "@/hooks/useDateRange";
import { TransactionDetailSheet } from "@/components/shared/TransactionDetailSheet";

// ── Expense Overview Tab ─────────────────────────────────────────────────

function ExpenseOverviewTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: bills = [], isFetching: _billsLoad } = useQuery({
    queryKey: ["expense-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["expense-vendors", clientId],
    queryFn: () => database.getVendors(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [], isFetching: _txLoad } = useQuery({
    queryKey: ["expense-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const _isLoading = (_billsLoad || _txLoad) && transactions.length === 0;

  // ── Derived Metrics ──

  const expenseTxns = useMemo(
    () => transactions.filter((t: any) => t.amount < 0),
    [transactions],
  );

  const totalExpenses = useMemo(
    () => expenseTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    [expenseTxns],
  );

  const totalBilled = useMemo(
    () => bills.reduce((s: number, b: any) => s + (b.total || 0), 0),
    [bills],
  );

  const paidBills = useMemo(
    () => bills.filter((b: any) => b.status === "paid"),
    [bills],
  );
  const overdueBills = useMemo(
    () =>
      bills.filter((b: any) => {
        if (b.status === "paid" || b.status === "cancelled") return false;
        if (!b.due_date) return false;
        return isAfter(new Date(), parseISO(b.due_date));
      }),
    [bills],
  );
  const pendingBills = useMemo(
    () =>
      bills.filter(
        (b: any) =>
          b.status !== "paid" && b.status !== "cancelled",
      ),
    [bills],
  );

  const pendingAmount = useMemo(
    () => pendingBills.reduce((s: number, b: any) => s + (b.total || 0), 0),
    [pendingBills],
  );

  const overdueAmount = useMemo(
    () => overdueBills.reduce((s: number, b: any) => s + (b.total || 0), 0),
    [overdueBills],
  );

  const paymentRate = useMemo(() => {
    if (bills.length === 0) return 0;
    return (paidBills.length / bills.length) * 100;
  }, [bills, paidBills]);

  // Monthly expense trend (12 months)
  const monthlyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    expenseTxns.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key) months[key] = (months[key] || 0) + Math.abs(t.amount);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        expense: amount,
      }));
  }, [expenseTxns]);

  // Expense this month vs last month
  const thisMonth = format(new Date(), "yyyy-MM");
  const lastMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const expenseThisMonth = useMemo(
    () =>
      expenseTxns
        .filter((t: any) => t.transaction_date?.startsWith(thisMonth))
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    [expenseTxns, thisMonth],
  );
  const expenseLastMonth = useMemo(
    () =>
      expenseTxns
        .filter((t: any) => t.transaction_date?.startsWith(lastMonth))
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    [expenseTxns, lastMonth],
  );
  const monthTrend =
    expenseLastMonth > 0
      ? ((expenseThisMonth - expenseLastMonth) / expenseLastMonth) * 100
      : 0;

  // Bill status donut
  const statusDonutConfig: ChartConfig = {
    paid: { label: "Paid", color: "hsl(143 44% 28%)" },
    pending: { label: "Pending", color: "hsl(210 80% 55%)" },
    overdue: { label: "Overdue", color: "hsl(0 84% 60%)" },
    partial: { label: "Partial", color: "hsl(45 93% 47%)" },
  };
  const statusDonutData = useMemo(() => {
    const counts: Record<string, number> = {};
    bills.forEach((b: any) => {
      const s = b.status || "pending";
      counts[s] = (counts[s] || 0) + 1;
    });
    const colors: Record<string, string> = {
      paid: "hsl(143 44% 28%)",
      pending: "hsl(210 80% 55%)",
      overdue: "hsl(0 84% 60%)",
      partial: "hsl(45 93% 47%)",
      cancelled: "hsl(0 0% 70%)",
      draft: "hsl(215 20% 65%)",
    };
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: colors[name] || "hsl(215 20% 65%)",
    }));
  }, [bills]);

  // Top vendors by spend
  const topVendors = useMemo(() => {
    const map: Record<
      string,
      { name: string; total: number; count: number; pending: number }
    > = {};
    bills.forEach((b: any) => {
      const name = b.v2_vendors?.name || "Unknown";
      if (!map[name]) map[name] = { name, total: 0, count: 0, pending: 0 };
      map[name].total += b.total || 0;
      map[name].count += 1;
      if (b.status !== "paid" && b.status !== "cancelled") {
        map[name].pending += b.total || 0;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [bills]);

  // Expense by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    bills.forEach((b: any) => {
      const cat =
        getCanonicalCategory(b.category, b.v2_vendors?.name, b.notes) ||
        "Other";
      map[cat] = (map[cat] || 0) + (b.total || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [bills]);

  const categoryChartConfig: ChartConfig = {
    value: { label: "Expense", color: "hsl(0 84% 50%)" },
  };

  const trendChartConfig: ChartConfig = {
    expense: { label: "Expense", color: "hsl(0 84% 50%)" },
  };

  // ── Drill-down state ──
  const [drillDown, setDrillDown] = useState<{
    title: string;
    description?: string;
    transactions: any[];
  } | null>(null);

  const hasData = bills.length > 0 || expenseTxns.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <TrendingDown className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Expense Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Upload a bank statement or create bills to see your expense overview,
            trends, and vendor insights.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (_isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading expense data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Expenses"
          value={formatAmount(totalExpenses, currency)}
          icon={DollarSign}
          color="text-red-600"
          trend={monthTrend}
          trendInverse
          onClick={() =>
            setDrillDown({
              title: "All Expenses",
              description: "All expense transactions in period",
              transactions: expenseTxns,
            })
          }
        />
        <KPICard
          label="Outstanding"
          value={formatAmount(pendingAmount, currency)}
          icon={Clock}
          color={pendingAmount > 0 ? "text-amber-500" : "text-green-600"}
          sub={`${pendingBills.length} bills`}
          onClick={() =>
            setDrillDown({
              title: "Outstanding Bills",
              description: "Unpaid/overdue bills",
              transactions: bills.filter(
                (b: any) =>
                  b.status !== "paid" && b.status !== "cancelled",
              ),
            })
          }
        />
        <KPICard
          label="Overdue"
          value={formatAmount(overdueAmount, currency)}
          icon={AlertTriangle}
          color={overdueAmount > 0 ? "text-red-500" : "text-green-600"}
          sub={`${overdueBills.length} overdue`}
          onClick={() =>
            setDrillDown({
              title: "Overdue Bills",
              description: "Bills past their due date",
              transactions: overdueBills,
            })
          }
        />
        <KPICard
          label="Payment Rate"
          value={`${paymentRate.toFixed(0)}%`}
          icon={CheckCircle2}
          color={
            paymentRate >= 80
              ? "text-green-600"
              : paymentRate >= 50
                ? "text-amber-500"
                : "text-red-500"
          }
          sub={`${paidBills.length} of ${bills.length} paid`}
          onClick={() =>
            setDrillDown({
              title: "All Bills",
              description: `${paidBills.length} paid of ${bills.length} total`,
              transactions: bills,
            })
          }
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Expense Trend */}
        <Card className="md:col-span-2 stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Expense Trend
              </CardTitle>
              <Badge variant="outline" className="text-[10px] font-normal">
                12 months
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyTrend.length === 0 ? (
              <EmptyChart text="No transaction data for trend" />
            ) : (
              <ChartContainer
                config={trendChartConfig}
                className="h-[220px] w-full !aspect-auto"
              >
                <AreaChart data={monthlyTrend}>
                  <defs>
                    <linearGradient
                      id="expIntGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="hsl(0 84% 50%)"
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="100%"
                        stopColor="hsl(0 84% 50%)"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    className="text-[10px]"
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={65}
                    className="text-[10px]"
                    tickFormatter={(v) =>
                      v >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : v.toString()
                    }
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          formatAmount(Number(value), currency)
                        }
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    stroke="hsl(0 84% 50%)"
                    strokeWidth={2.5}
                    fill="url(#expIntGrad)"
                    dot={{
                      r: 3,
                      fill: "hsl(0 84% 50%)",
                      strokeWidth: 0,
                    }}
                    activeDot={{
                      r: 5,
                      stroke: "hsl(0 84% 50%)",
                      strokeWidth: 2,
                      fill: "white",
                    }}
                  />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Bill Status Donut */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bill Status</CardTitle>
          </CardHeader>
          <CardContent>
            {bills.length === 0 ? (
              <EmptyChart text="No bills" />
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer
                  config={statusDonutConfig}
                  className="h-[140px] w-[140px] !aspect-square"
                >
                  <PieChart>
                    <Pie
                      data={statusDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full">
                  {statusDonutData.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Expense by Category + Top Vendors ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Expense by Category */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Expense by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseByCategory.length === 0 ? (
              <EmptyChart text="No category data" />
            ) : (
              <ChartContainer
                config={categoryChartConfig}
                className="h-[200px] w-full !aspect-auto"
              >
                <BarChart data={expenseByCategory} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    className="text-[10px]"
                    tickFormatter={(v) =>
                      v >= 1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : v.toString()
                    }
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    width={110}
                    className="text-[10px]"
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) =>
                          formatAmount(Number(value), currency)
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(0 84% 50%)"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Vendors */}
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Top Vendors
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {vendors.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topVendors.length === 0 ? (
              <EmptyChart text="No vendor data" />
            ) : (
              <div className="space-y-3">
                {topVendors.map((v, idx) => {
                  const maxTotal = topVendors[0]?.total || 1;
                  const pct = (v.total / maxTotal) * 100;
                  return (
                    <div key={v.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono w-4">
                            {idx + 1}
                          </span>
                          <span className="font-medium truncate">
                            {v.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {v.pending > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[9px] h-4 text-amber-600 border-amber-200"
                            >
                              <FC amount={v.pending} currency={currency} /> due
                            </Badge>
                          )}
                          <span className="font-semibold text-xs">
                            <FC amount={v.total} currency={currency} />
                          </span>
                        </div>
                      </div>
                      <Progress value={pct} className="h-1" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department Spend (Category proxy) */}
      {expenseByCategory.length > 0 && (
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Department / Category Spend</CardTitle>
              <Badge variant="outline" className="text-[10px]">Category proxy</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actual Spend</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                  <TableHead>Trend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseByCategory.map((cat) => {
                  const pctOfTotal = totalExpenses > 0 ? (cat.value / totalExpenses) * 100 : 0;
                  return (
                    <TableRow key={cat.name}>
                      <TableCell className="text-sm font-medium">{cat.name}</TableCell>
                      <TableCell className="text-right text-sm font-semibold"><FC amount={cat.value} currency={currency} /></TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{pctOfTotal.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Progress value={pctOfTotal} className="h-1.5 w-16" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Category Donut */}
      {expenseByCategory.length > 0 && (
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6 flex-wrap">
              <ChartContainer
                config={{ value: { label: "Expense", color: "hsl(0 84% 50%)" } }}
                className="h-[160px] w-[160px] !aspect-square shrink-0"
              >
                <PieChart>
                  <Pie
                    data={expenseByCategory.map((c, i) => ({
                      ...c,
                      fill: [`hsl(0 84% 50%)`, `hsl(25 95% 53%)`, `hsl(45 93% 47%)`, `hsl(143 44% 28%)`, `hsl(210 80% 55%)`, `hsl(270 60% 55%)`][i % 6],
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {expenseByCategory.map((_, i) => (
                      <Cell key={i} fill={[`hsl(0 84% 50%)`, `hsl(25 95% 53%)`, `hsl(45 93% 47%)`, `hsl(143 44% 28%)`, `hsl(210 80% 55%)`, `hsl(270 60% 55%)`][i % 6]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                </PieChart>
              </ChartContainer>
              <div className="flex-1 space-y-2">
                {expenseByCategory.map((c, i) => {
                  const pct = totalExpenses > 0 ? (c.value / totalExpenses) * 100 : 0;
                  const color = [`hsl(0 84% 50%)`, `hsl(25 95% 53%)`, `hsl(45 93% 47%)`, `hsl(143 44% 28%)`, `hsl(210 80% 55%)`, `hsl(270 60% 55%)`][i % 6];
                  return (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                      <span className="font-semibold"><FC amount={c.value} currency={currency} /></span>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drill-down sheet */}
      <TransactionDetailSheet
        open={!!drillDown}
        onOpenChange={(open) => !open && setDrillDown(null)}
        title={drillDown?.title || ""}
        description={drillDown?.description}
        transactions={drillDown?.transactions || []}
        currency={currency}
      />
    </div>
  );
}

// ── Bills Tab ──────────────────────────────────────────────────────────────

function BillsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bill form state
  const [billForm, setBillForm] = useState({
    vendor_name: "",
    bill_number: "",
    bill_date: format(new Date(), "yyyy-MM-dd"),
    due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    description: "",
    quantity: "1",
    unit_price: "",
    tax_rate: "5",
    notes: "",
    category: "Other",
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["expense-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ["expense-vendors-bt", clientId],
    queryFn: () => database.getVendors(clientId!),
    enabled: !!clientId,
  });

  // Duplicate vendor detection (fuzzy matching)
  const duplicateVendors = useMemo(() => {
    if (vendors.length < 2) return [];
    const dups: { a: any; b: any; score: number }[] = [];
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

    for (let i = 0; i < vendors.length; i++) {
      for (let j = i + 1; j < vendors.length; j++) {
        const na = normalize(vendors[i].name || "");
        const nb = normalize(vendors[j].name || "");
        if (!na || !nb) continue;
        // Simple Levenshtein-like check: one is substring of the other, or very short edit distance
        if (na === nb) continue; // exact match, probably same
        const shorter = na.length <= nb.length ? na : nb;
        const longer = na.length > nb.length ? na : nb;
        if (longer.includes(shorter) && shorter.length >= 3) {
          dups.push({ a: vendors[i], b: vendors[j], score: Math.round((shorter.length / longer.length) * 100) });
        }
      }
    }
    return dups.slice(0, 5);
  }, [vendors]);

  // Computed form totals
  const billQty = parseFloat(billForm.quantity) || 0;
  const billPrice = parseFloat(billForm.unit_price) || 0;
  const billTaxRate = parseFloat(billForm.tax_rate) || 0;
  const billSubtotal = billQty * billPrice;
  const billTaxAmount = billSubtotal * (billTaxRate / 100);
  const billTotal = billSubtotal + billTaxAmount;

  const handleSaveBill = async () => {
    if (!clientId || !billForm.vendor_name || !billForm.unit_price) {
      toast.error("Please fill in vendor and amount");
      return;
    }
    setSaving(true);
    try {
      const billNumber = billForm.bill_number || `BILL-${format(new Date(), "yyyyMM")}-${String(bills.length + 1).padStart(3, "0")}`;
      await database.createBill(clientId, {
        vendor_name: billForm.vendor_name,
        bill_number: billNumber,
        bill_date: billForm.bill_date,
        due_date: billForm.due_date,
        subtotal: billSubtotal,
        tax_amount: billTaxAmount,
        total: billTotal,
        notes: billForm.notes,
        category: billForm.category,
        status: "pending",
      } as any);
      queryClient.invalidateQueries({ queryKey: ["expense-bills", clientId] });
      queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
      queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
      queryClient.invalidateQueries({ queryKey: ["cash-bills"] });
      queryClient.invalidateQueries({ queryKey: ["ai-score-bills"] });
      queryClient.invalidateQueries({ queryKey: ["ai-risk-score"] });
      setShowCreateForm(false);
      setBillForm({
        vendor_name: "", bill_number: "",
        bill_date: format(new Date(), "yyyy-MM-dd"),
        due_date: format(addDays(new Date(), 30), "yyyy-MM-dd"),
        description: "", quantity: "1", unit_price: "", tax_rate: "5", notes: "", category: "Other",
      });
      toast.success(`Bill ${billNumber} created`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create bill");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "all") return bills;
    if (statusFilter === "overdue") {
      return bills.filter((b: any) => {
        if (b.status === "paid" || b.status === "cancelled") return false;
        if (!b.due_date) return false;
        return isAfter(new Date(), parseISO(b.due_date));
      });
    }
    return bills.filter((b: any) => b.status === statusFilter);
  }, [bills, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: bills.length };
    bills.forEach((b: any) => {
      counts[b.status] = (counts[b.status] || 0) + 1;
    });
    // compute overdue count
    counts.overdue = bills.filter((b: any) => {
      if (b.status === "paid" || b.status === "cancelled") return false;
      if (!b.due_date) return false;
      return isAfter(new Date(), parseISO(b.due_date));
    }).length;
    return counts;
  }, [bills]);

  if (bills.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Receipt className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Bills Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Bills will appear here after uploading bank statements or syncing
            from your ERP system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Duplicate Vendor Detection Banner */}
      {duplicateVendors.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <Copy className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">
              {duplicateVendors.length} potential duplicate vendor{duplicateVendors.length !== 1 ? "s" : ""} detected
            </p>
            <div className="mt-1 space-y-1">
              {duplicateVendors.map((d, i) => (
                <p key={i} className="text-xs text-amber-600">
                  "{d.a.name}" ↔ "{d.b.name}" ({d.score}% match)
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter buttons + Create */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          {["all", "pending", "paid", "overdue", "partial", "cancelled"].map(
            (s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 gap-1"
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
                {(statusCounts[s] || 0) > 0 && (
                  <Badge
                    variant={statusFilter === s ? "secondary" : "outline"}
                    className="text-[10px] h-4 px-1"
                  >
                    {statusCounts[s]}
                  </Badge>
                )}
              </Button>
            ),
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} bill{filtered.length !== 1 && "s"}
          </span>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowCreateForm(true)}>
            <Plus className="h-3.5 w-3.5" />
            Create Bill
          </Button>
        </CardContent>
      </Card>

      {/* Bill table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Bill #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((bill: any) => {
                const isOverdue =
                  bill.due_date &&
                  bill.status !== "paid" &&
                  bill.status !== "cancelled" &&
                  isAfter(new Date(), parseISO(bill.due_date));
                return (
                  <TableRow
                    key={bill.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedBill(bill)}
                  >
                    <TableCell className="font-mono text-xs">
                      {bill.bill_number || "—"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {bill.v2_vendors?.name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {getCanonicalCategory(
                          bill.category,
                          bill.v2_vendors?.name,
                          bill.notes,
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {bill.bill_date
                        ? format(new Date(bill.bill_date), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}
                    >
                      {bill.due_date
                        ? format(new Date(bill.due_date), "dd MMM yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      <FC amount={bill.total || 0} currency={currency} />
                    </TableCell>
                    <TableCell>
                      <BillStatusBadge
                        status={isOverdue ? "overdue" : bill.status}
                      />
                    </TableCell>
                    <TableCell>
                      <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet
        open={!!selectedBill}
        onOpenChange={() => setSelectedBill(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Bill Details</SheetTitle>
            <SheetDescription>
              {selectedBill?.bill_number || "Bill"}
            </SheetDescription>
          </SheetHeader>
          {selectedBill && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  onClick={async () => {
                    try {
                      await flaskApi.del(`/bills/${selectedBill.id}`);
                      queryClient.invalidateQueries({ queryKey: ["expense-bills", clientId] });
                      queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
                      queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
                      setSelectedBill(null);
                      toast.success("Bill deleted");
                    } catch (err: any) {
                      toast.error(err.message || "Failed to delete bill");
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={selectedBill.status}
                    onValueChange={async (newStatus) => {
                      try {
                        await flaskApi.patch(`/bills/${selectedBill.id}`, { status: newStatus });
                        setSelectedBill({ ...selectedBill, status: newStatus });
                        queryClient.invalidateQueries({ queryKey: ["expense-bills", clientId] });
                        queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
                        queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
                        queryClient.invalidateQueries({ queryKey: ["cash-bills"] });
                        queryClient.invalidateQueries({ queryKey: ["ai-score-bills"] });
                        toast.success(`Status updated to ${newStatus}`);
                      } catch (err: any) {
                        toast.error(err.message || "Failed to update status");
                      }
                    }}
                  >
                    <SelectTrigger className="h-7 w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["open", "pending", "paid", "overdue", "cancelled"].map((s) => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <BillDetail bill={selectedBill} currency={currency} />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Bill Sheet */}
      <Sheet open={showCreateForm} onOpenChange={setShowCreateForm}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Create Bill
            </SheetTitle>
            <SheetDescription>Fill in the details to create a new expense bill.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label className="text-xs">Vendor</Label>
              <Select value={billForm.vendor_name} onValueChange={(v) => setBillForm({ ...billForm, vendor_name: v })}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select vendor..." />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v: any) => (
                    <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Bill Number</Label>
                <Input
                  placeholder={`BILL-${format(new Date(), "yyyyMM")}-${String(bills.length + 1).padStart(3, "0")}`}
                  value={billForm.bill_number}
                  onChange={(e) => setBillForm({ ...billForm, bill_number: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Category</Label>
                <Select value={billForm.category} onValueChange={(v) => setBillForm({ ...billForm, category: v })}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Utilities", "Rent & Real Estate", "Transportation & Logistics", "Technology", "Food & Beverage", "Retail & Shopping", "Professional Services", "Other"].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Bill Date</Label>
                <Input type="date" value={billForm.bill_date} onChange={(e) => setBillForm({ ...billForm, bill_date: e.target.value })} className="text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={billForm.due_date} onChange={(e) => setBillForm({ ...billForm, due_date: e.target.value })} className="text-sm" />
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Line Item</Label>
              <Input placeholder="Description" value={billForm.description} onChange={(e) => setBillForm({ ...billForm, description: e.target.value })} className="text-sm" />
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Qty</Label>
                  <Input type="number" min="1" value={billForm.quantity} onChange={(e) => setBillForm({ ...billForm, quantity: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Unit Price</Label>
                  <Input type="number" step="0.01" placeholder="0.00" value={billForm.unit_price} onChange={(e) => setBillForm({ ...billForm, unit_price: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Tax %</Label>
                  <Input type="number" min="0" max="100" value={billForm.tax_rate} onChange={(e) => setBillForm({ ...billForm, tax_rate: e.target.value })} className="text-sm" />
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span><FC amount={billSubtotal} currency={currency} /></span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({billTaxRate}%)</span><span><FC amount={billTaxAmount} currency={currency} /></span></div>
              <Separator />
              <div className="flex justify-between font-semibold text-base"><span>Total</span><span className="text-red-500"><FC amount={billTotal} currency={currency} /></span></div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Input placeholder="Payment terms, notes..." value={billForm.notes} onChange={(e) => setBillForm({ ...billForm, notes: e.target.value })} className="text-sm" />
            </div>
            <Button className="w-full gap-2" onClick={handleSaveBill} disabled={saving}>
              {saving ? "Creating..." : "Create Bill"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── AP Aging Tab ──────────────────────────────────────────────────────────

function APAgingTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: bills = [] } = useQuery({
    queryKey: ["expense-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const unpaidBills = useMemo(
    () =>
      bills.filter(
        (b: any) => b.status !== "paid" && b.status !== "cancelled",
      ),
    [bills],
  );

  const agingBuckets = useMemo(() => {
    const now = new Date();
    const buckets = {
      current: {
        label: "Current",
        count: 0,
        total: 0,
        color: "bg-green-500",
      },
      "1-30": {
        label: "1–30 days",
        count: 0,
        total: 0,
        color: "bg-amber-400",
      },
      "31-60": {
        label: "31–60 days",
        count: 0,
        total: 0,
        color: "bg-orange-500",
      },
      "61-90": {
        label: "61–90 days",
        count: 0,
        total: 0,
        color: "bg-red-400",
      },
      "90+": { label: "90+ days", count: 0, total: 0, color: "bg-red-600" },
    };

    unpaidBills.forEach((bill: any) => {
      const dueDate = bill.due_date
        ? new Date(bill.due_date)
        : new Date(bill.bill_date);
      const days = differenceInDays(now, dueDate);
      const amount = bill.total || 0;

      if (days <= 0) {
        buckets.current.count++;
        buckets.current.total += amount;
      } else if (days <= 30) {
        buckets["1-30"].count++;
        buckets["1-30"].total += amount;
      } else if (days <= 60) {
        buckets["31-60"].count++;
        buckets["31-60"].total += amount;
      } else if (days <= 90) {
        buckets["61-90"].count++;
        buckets["61-90"].total += amount;
      } else {
        buckets["90+"].count++;
        buckets["90+"].total += amount;
      }
    });

    return Object.values(buckets);
  }, [unpaidBills]);

  const totalUnpaid = agingBuckets.reduce((s, b) => s + b.total, 0);

  if (unpaidBills.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-50 p-4 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-green-600">
            All Bills Paid
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No outstanding payables. All vendor bills have been settled.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label="Total AP"
          value={formatAmount(totalUnpaid, currency)}
          icon={Wallet}
          color="text-primary"
          sub={`${unpaidBills.length} bills`}
        />
        <KPICard
          label="Overdue Amount"
          value={formatAmount(
            agingBuckets.slice(1).reduce((s, b) => s + b.total, 0),
            currency,
          )}
          icon={AlertTriangle}
          color="text-red-500"
          sub={`${agingBuckets.slice(1).reduce((s, b) => s + b.count, 0)} bills`}
        />
        <KPICard
          label="90+ Days"
          value={formatAmount(agingBuckets[4].total, currency)}
          icon={ShieldAlert}
          color={
            agingBuckets[4].total > 0 ? "text-red-600" : "text-green-600"
          }
          sub={`${agingBuckets[4].count} at risk`}
        />
      </div>

      {/* Aging bars */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            AP Aging Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agingBuckets.map((bucket) => {
              const pct =
                totalUnpaid > 0 ? (bucket.total / totalUnpaid) * 100 : 0;
              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded ${bucket.color}`}
                      />
                      <span>{bucket.label}</span>
                      <Badge variant="outline" className="text-[10px] h-4">
                        {bucket.count}
                      </Badge>
                    </div>
                    <span className="font-semibold">
                      <FC amount={bucket.total} currency={currency} />
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${bucket.color}`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Overdue bills list */}
      {unpaidBills.filter((b: any) => {
        const dueDate = b.due_date
          ? new Date(b.due_date)
          : new Date(b.bill_date);
        return differenceInDays(new Date(), dueDate) > 0;
      }).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Overdue Bills
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidBills
                  .map((bill: any) => {
                    const dueDate = bill.due_date
                      ? new Date(bill.due_date)
                      : new Date(bill.bill_date);
                    const daysOverdue = differenceInDays(new Date(), dueDate);
                    return { ...bill, daysOverdue };
                  })
                  .filter((bill: any) => bill.daysOverdue > 0)
                  .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)
                  .map((bill: any) => (
                    <TableRow key={bill.id}>
                      <TableCell className="font-medium text-sm">
                        {bill.v2_vendors?.name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {bill.bill_number || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-red-500">
                        {bill.due_date
                          ? format(new Date(bill.due_date), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="destructive"
                          className="text-[10px]"
                        >
                          {bill.daysOverdue}d overdue
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        <FC amount={bill.total || 0} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Vendors Tab ───────────────────────────────────────────────────────────

const cleanVendorName = (raw: string) => {
  let s = raw.trim();
  // Strip "Pos-DD/MM/YY-" prefix
  s = s.replace(/^Pos-\d{2}\/\d{2}\/\d{2,4}-/i, "");
  // Strip "Upos Purchase DD/MM/YYYY HH:MM " prefix
  s = s.replace(/^Upos\s+Purchase\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}\s*/i, "");
  // Strip "POS-DD/MM/YY-" prefix
  s = s.replace(/^POS-\d{2}\/\d{2}\/\d{2,4}-/i, "");
  return s.trim();
};

function VendorsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: vendors = [] } = useQuery({
    queryKey: ["expense-vendors", clientId],
    queryFn: () => database.getVendors(clientId!),
    enabled: !!clientId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["expense-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const queryClient = useQueryClient();
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newVendor, setNewVendor] = useState({
    name: "",
    email: "",
    phone: "",
    trn: "",
    category: "",
    payment_terms: 30,
  });

  const handleAddVendor = async () => {
    if (!newVendor.name.trim()) {
      toast.error("Vendor name is required");
      return;
    }
    setSaving(true);
    try {
      await database.createVendor(clientId!, {
        name: newVendor.name.trim(),
        email: newVendor.email.trim() || undefined,
        phone: newVendor.phone.trim() || undefined,
        trn: newVendor.trn.trim() || undefined,
        category: newVendor.category.trim() || undefined,
        payment_terms: newVendor.payment_terms,
      });
      toast.success(`Vendor "${newVendor.name}" added`);
      queryClient.invalidateQueries({ queryKey: ["expense-vendors"] });
      setShowAddDialog(false);
      setNewVendor({ name: "", email: "", phone: "", trn: "", category: "", payment_terms: 30 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create vendor");
    } finally {
      setSaving(false);
    }
  };

  // Group vendors by cleaned name (merge duplicates like Customers tab)
  const groupedVendors = useMemo(() => {
    const dateLike = /^\d{1,4}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|^\d{2}:\d{2}|^\d{6,}$/;
    const groups: Record<string, { name: string; ids: string[]; email?: string; is_active?: boolean }> = {};

    vendors.forEach((v: any) => {
      const raw = (v.name || "").trim();
      if (!raw || raw.length < 3) return;
      const clean = cleanVendorName(raw);
      if (!clean || clean.length < 3) return;
      if (dateLike.test(clean)) return;
      const alphaCount = [...clean].filter((c) => /[a-zA-Z]/.test(c)).length;
      if (alphaCount < 2) return;

      const key = clean.toLowerCase();
      if (!groups[key]) {
        groups[key] = { name: clean, ids: [], email: v.email, is_active: v.is_active };
      }
      groups[key].ids.push(v.id);
      if (!groups[key].email && v.email) groups[key].email = v.email;
    });

    return Object.values(groups);
  }, [vendors]);

  const vendorStats = useMemo(() => {
    return groupedVendors
      .map((g) => {
        const idSet = new Set(g.ids);
        const vendorBills = bills.filter((b: any) => idSet.has(b.vendor_id));
        const totalBilled = vendorBills.reduce(
          (s: number, b: any) => s + (b.total || 0),
          0,
        );
        const totalPaid = vendorBills
          .filter((b: any) => b.status === "paid")
          .reduce((s: number, b: any) => s + (b.total || 0), 0);
        const outstanding = totalBilled - totalPaid;
        const overdueCount = vendorBills.filter((b: any) => {
          if (b.status === "paid" || b.status === "cancelled") return false;
          if (!b.due_date) return false;
          return isAfter(new Date(), parseISO(b.due_date));
        }).length;
        return {
          ...g,
          billCount: vendorBills.length,
          totalBilled,
          totalPaid,
          outstanding,
          overdueCount,
        };
      })
      .sort((a: any, b: any) => b.totalBilled - a.totalBilled);
  }, [groupedVendors, bills]);

  if (groupedVendors.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Store className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Vendors Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Vendors are created automatically when bills are synced from your
            bank statements.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label="Total Vendors"
          value={groupedVendors.length.toString()}
          icon={Store}
          color="text-primary"
          sub={`${vendorStats.reduce((s: number, v: any) => s + v.billCount, 0)} bills`}
        />
        <KPICard
          label="With Outstanding"
          value={vendorStats
            .filter((v: any) => v.outstanding > 0)
            .length.toString()}
          icon={Clock}
          color="text-amber-500"
          sub="have unpaid bills"
        />
        <KPICard
          label="With Overdue"
          value={vendorStats
            .filter((v: any) => v.overdueCount > 0)
            .length.toString()}
          icon={AlertTriangle}
          color={
            vendorStats.some((v: any) => v.overdueCount > 0)
              ? "text-red-500"
              : "text-green-600"
          }
          sub="need attention"
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Vendor
        </Button>
      </div>

      {/* Add Vendor Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
            <DialogDescription>
              Enter vendor details. Only name is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="vendor-name">Name *</Label>
              <Input
                id="vendor-name"
                placeholder="Vendor / Company name"
                value={newVendor.name}
                onChange={(e) => setNewVendor((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vendor-email">Email</Label>
                <Input
                  id="vendor-email"
                  type="email"
                  placeholder="vendor@example.com"
                  value={newVendor.email}
                  onChange={(e) => setNewVendor((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor-phone">Phone</Label>
                <Input
                  id="vendor-phone"
                  placeholder="+971 50 123 4567"
                  value={newVendor.phone}
                  onChange={(e) => setNewVendor((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="vendor-trn">TRN (Tax Reg. No.)</Label>
                <Input
                  id="vendor-trn"
                  placeholder="100XXXXXXXXX"
                  value={newVendor.trn}
                  onChange={(e) => setNewVendor((p) => ({ ...p, trn: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="vendor-terms">Payment Terms (days)</Label>
                <Input
                  id="vendor-terms"
                  type="number"
                  min={0}
                  value={newVendor.payment_terms}
                  onChange={(e) => setNewVendor((p) => ({ ...p, payment_terms: Math.max(0, parseInt(e.target.value) || 0) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="vendor-category">Category</Label>
              <Input
                id="vendor-category"
                placeholder="e.g. Office Supplies, IT Services, Logistics"
                value={newVendor.category}
                onChange={(e) => setNewVendor((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddVendor} disabled={saving || !newVendor.name.trim()}>
                {saving ? "Saving..." : "Add Vendor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Bills</TableHead>
                <TableHead className="text-right">Total Billed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendorStats.map((v: any, idx: number) => (
                <TableRow
                  key={v.name + idx}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedVendor(v)}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{v.name}</p>
                      {v.email && (
                        <p className="text-xs text-muted-foreground">
                          {v.email}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{v.billCount}</TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    <FC amount={v.totalBilled} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600">
                    <FC amount={v.totalPaid} currency={currency} />
                  </TableCell>
                  <TableCell
                    className={`text-right text-sm font-semibold ${v.outstanding > 0 ? "text-amber-600" : ""}`}
                  >
                    <FC amount={v.outstanding} currency={currency} />
                  </TableCell>
                  <TableCell>
                    {v.overdueCount > 0 ? (
                      <Badge
                        variant="destructive"
                        className="text-[10px]"
                      >
                        {v.overdueCount} overdue
                      </Badge>
                    ) : v.outstanding > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Pending
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-green-600 border-green-200"
                      >
                        Settled
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Vendor Detail Sheet */}
      <Sheet open={!!selectedVendor} onOpenChange={(open) => { if (!open) setSelectedVendor(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedVendor && (() => {
            const idSet = new Set(selectedVendor.ids || []);
            const vendorBills = bills
              .filter((b: any) => idSet.has(b.vendor_id))
              .sort((a: any, b: any) => (b.bill_date || "").localeCompare(a.bill_date || ""));
            const totalBilled = vendorBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
            const totalPaid = vendorBills.filter((b: any) => b.status === "paid").reduce((s: number, b: any) => s + (b.total || 0), 0);
            const outstanding = totalBilled - totalPaid;

            return (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedVendor.name}</SheetTitle>
                  <SheetDescription>
                    {selectedVendor.email || "Vendor details"}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-4 pt-4">
                  {/* Summary stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Billed</p>
                      <p className="text-sm font-semibold mt-0.5"><FC amount={totalBilled} currency={currency} /></p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid</p>
                      <p className="text-sm font-semibold mt-0.5 text-green-600"><FC amount={totalPaid} currency={currency} /></p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Outstanding</p>
                      <p className={`text-sm font-semibold mt-0.5 ${outstanding > 0 ? "text-amber-600" : ""}`}>
                        <FC amount={outstanding} currency={currency} />
                      </p>
                    </div>
                  </div>

                  <Separator />

                  {/* Bills list */}
                  {vendorBills.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No bills for this vendor</p>
                    </div>
                  ) : (
                    <div className="rounded-md border max-h-[55vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Vendor Name</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Due</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vendorBills.map((b: any, idx: number) => {
                            const isOverdue =
                              b.status !== "paid" &&
                              b.status !== "cancelled" &&
                              b.due_date &&
                              isAfter(new Date(), parseISO(b.due_date));
                            return (
                              <TableRow key={b.id || idx}>
                                <TableCell className="text-xs font-medium py-2">
                                  {b.vendor_name || b.description || `BILL-${idx + 1}`}
                                </TableCell>
                                <TableCell className="text-xs py-2 whitespace-nowrap">
                                  {b.bill_date
                                    ? format(new Date(b.bill_date + "T00:00:00"), "MMM d, yyyy")
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-xs py-2 whitespace-nowrap">
                                  {b.due_date
                                    ? format(new Date(b.due_date + "T00:00:00"), "MMM d, yyyy")
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-xs text-right py-2 font-medium">
                                  <FC amount={b.total || 0} currency={currency} />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Badge
                                    variant={
                                      b.status === "paid"
                                        ? "outline"
                                        : isOverdue
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className={`text-[9px] capitalize ${
                                      b.status === "paid" ? "text-green-600 border-green-200" : ""
                                    }`}
                                  >
                                    {isOverdue ? "overdue" : b.status || "draft"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  trendInverse,
  sub,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: number;
  trendInverse?: boolean;
  sub?: string;
  onClick?: () => void;
}) {
  // For expenses, going UP is bad (red) and going DOWN is good (green)
  const isPositive = trendInverse
    ? trend !== undefined && trend < 0
    : trend !== undefined && trend > 0;
  return (
    <Card className={`stat-card-hover${onClick ? " cursor-pointer" : ""}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <div className="flex items-end gap-2">
          <span className={`text-xl font-bold ${color}`}>{value}</span>
          {trend !== undefined && trend !== 0 && (
            <span
              className={`text-xs flex items-center gap-0.5 ${isPositive ? "text-green-600" : "text-red-500"}`}
            >
              {trend > 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-muted p-3 mb-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground/50" />
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

function BillStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: any; className: string }> = {
    paid: {
      variant: "default",
      className:
        "bg-green-100 text-green-700 border-green-200 hover:bg-green-100",
    },
    pending: { variant: "outline", className: "text-blue-600 border-blue-200" },
    overdue: { variant: "destructive", className: "" },
    partial: {
      variant: "outline",
      className: "text-amber-600 border-amber-200",
    },
    draft: { variant: "outline", className: "text-muted-foreground" },
    cancelled: {
      variant: "outline",
      className: "text-muted-foreground line-through",
    },
  };
  const v = variants[status] || variants.pending;
  return (
    <Badge variant={v.variant} className={`text-[10px] ${v.className}`}>
      {status}
    </Badge>
  );
}

function BillDetail({
  bill,
  currency,
}: {
  bill: any;
  currency: string;
}) {
  return (
    <div className="space-y-5 pt-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Bill Number
          </p>
          <p className="font-mono font-medium">
            {bill.bill_number || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Status
          </p>
          <BillStatusBadge status={bill.status} />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Vendor
          </p>
          <p className="font-medium">{bill.v2_vendors?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Category
          </p>
          <Badge variant="outline" className="text-[10px]">
            {getCanonicalCategory(
              bill.category,
              bill.v2_vendors?.name,
              bill.notes,
            )}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Bill Date
          </p>
          <p className="text-sm">
            {bill.bill_date
              ? format(new Date(bill.bill_date), "dd MMM yyyy")
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Due Date
          </p>
          <p className="text-sm">
            {bill.due_date
              ? format(new Date(bill.due_date), "dd MMM yyyy")
              : "—"}
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span><FC amount={bill.subtotal || 0} currency={currency} /></span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span><FC amount={bill.tax_amount || 0} currency={currency} /></span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="text-red-600">
            <FC amount={bill.total || 0} currency={currency} />
          </span>
        </div>
      </div>

      {bill.notes && (
        <>
          <Separator />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Notes
            </p>
            <p className="text-sm">{bill.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Payments Tab ─────────────────────────────────────────────────────────

function PaymentsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const [drillDown, setDrillDown] = useState<{ type: string; title: string; description: string } | null>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["exp-txns-pay", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["exp-bills-pay", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const expenseTxns = useMemo(() => {
    // Exclude non-vendor-payment expenses: internal transfers, ATM withdrawals, loan payments, etc.
    const NON_PAYMENT_RE = /\b(transfer|tfr|ibft|mobn|internal|own account|between accounts|neft|rtgs|atm\s*(withdrawal|w\/d|wd)|cash\s*withdrawal|loan\s*(repayment|emi|installment)|credit\s*card\s*payment)\b/i;
    const NON_PAYMENT_CATS = new Set(["internal transfer", "finance & banking", "atm & withdrawals", "atm & cash deposits", "salary & wages"]);

    return transactions
      .filter((t: any) => {
        if (t.amount >= 0) return false;
        const desc = (t.description || "").toLowerCase();
        const cat = (t.category || "").toLowerCase();
        if (NON_PAYMENT_RE.test(desc)) return false;
        if (NON_PAYMENT_CATS.has(cat)) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.transaction_date || "").localeCompare(a.transaction_date || ""));
  }, [transactions]);

  // Allocate payments to bills and detect large transactions
  const { allocated, unallocated, largeTransactions } = useMemo(() => {
    const alloc: { txn: any; bill: any }[] = [];
    const unalloc: any[] = [];
    const matchedBillIds = new Set<string>();

    // Stats for large transaction detection
    const amounts = expenseTxns.map((t: any) => Math.abs(t.amount));
    const mean = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
    const stdDev = amounts.length > 1 ? Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length) : 0;
    const threshold = mean + 3 * stdDev;

    expenseTxns.forEach((txn: any) => {
      let bestMatch: any = null;
      let bestDiff = Infinity;
      bills.forEach((bill: any) => {
        if (matchedBillIds.has(bill.id)) return;
        const amtDiff = Math.abs(Math.abs(txn.amount) - (bill.total || 0));
        const pctDiff = bill.total ? amtDiff / bill.total : 1;
        if (pctDiff > 0.10) return;
        const daysDiff = bill.bill_date
          ? Math.abs(differenceInDays(new Date(txn.transaction_date), new Date(bill.bill_date)))
          : 999;
        if (daysDiff > 30) return;
        if (daysDiff < bestDiff) { bestDiff = daysDiff; bestMatch = bill; }
      });
      if (bestMatch) {
        matchedBillIds.add(bestMatch.id);
        alloc.push({ txn, bill: bestMatch });
      } else {
        unalloc.push(txn);
      }
    });

    const large = expenseTxns
      .filter((t: any) => Math.abs(t.amount) > threshold && threshold > 0)
      .map((t: any) => ({ ...t, multiple: mean > 0 ? (Math.abs(t.amount) / mean).toFixed(1) : "N/A" }))
      .slice(0, 20);

    return { allocated: alloc, unallocated: unalloc, largeTransactions: large };
  }, [expenseTxns, bills]);

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Payment Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">Upload bank statements to track expense payments.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Payments" value={expenseTxns.length.toString()} icon={CreditCard} color="text-primary" sub="expense txns"
          onClick={() => setDrillDown({ type: "total", title: "Total Payments", description: `${expenseTxns.length} expense transactions · ${formatAmount(expenseTxns.reduce((s, t: any) => s + Math.abs(t.amount), 0), currency)} total` })} />
        <KPICard label="Allocated" value={allocated.length.toString()} icon={CheckCircle2} color="text-green-600" sub="matched to bills"
          onClick={() => setDrillDown({ type: "allocated", title: "Allocated Payments", description: `${allocated.length} payments matched to bills · ${formatAmount(allocated.reduce((s, a) => s + Math.abs(a.txn.amount), 0), currency)} total` })} />
        <KPICard label="Unallocated" value={unallocated.length.toString()} icon={AlertTriangle} color={unallocated.length > 0 ? "text-amber-500" : "text-green-600"} sub="no matching bill"
          onClick={() => setDrillDown({ type: "unallocated", title: "Unallocated Payments", description: `${unallocated.length} payments with no matching bill · ${formatAmount(unallocated.reduce((s, t: any) => s + Math.abs(t.amount), 0), currency)} total` })} />
        <KPICard label="Large Txns" value={largeTransactions.length.toString()} icon={Flame} color={largeTransactions.length > 0 ? "text-red-500" : "text-green-600"} sub=">3σ from mean"
          onClick={() => setDrillDown({ type: "large", title: "Large Transaction Alerts", description: `${largeTransactions.length} transactions exceed 3 standard deviations from the mean` })} />
      </div>

      {/* Payment Tracking Table */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Payment Tracking</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Allocated To</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allocated.slice(0, 20).map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {a.txn.transaction_date ? format(new Date(a.txn.transaction_date), "dd MMM yy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{a.txn.description || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-sm text-red-500"><FC amount={Math.abs(a.txn.amount)} currency={currency} /></TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline" className="text-[10px]">{a.bill.vendor_name || a.bill.bill_number || "Bill"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getCanonicalCategory(a.txn.category, a.txn.description, a.txn.description) || "—"}</TableCell>
                  <TableCell><Badge variant="default" className="text-[9px]">Allocated</Badge></TableCell>
                </TableRow>
              ))}
              {unallocated.slice(0, 15).map((txn: any, i: number) => (
                <TableRow key={`u-${i}`} className="bg-amber-50/30">
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {txn.transaction_date ? format(new Date(txn.transaction_date), "dd MMM yy") : "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{txn.description || "—"}</TableCell>
                  <TableCell className="text-right font-semibold text-sm text-red-500"><FC amount={Math.abs(txn.amount)} currency={currency} /></TableCell>
                  <TableCell>—</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{getCanonicalCategory(txn.category, txn.description, txn.description) || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px] text-amber-500 border-amber-200">Unallocated</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Large Transaction Alerts */}
      {largeTransactions.length > 0 && (
        <Card className="stat-card-hover border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500 flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Large Transaction Alerts ({largeTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor/Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>vs Average</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {largeTransactions.map((txn: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {txn.transaction_date ? format(new Date(txn.transaction_date), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[250px] truncate">{txn.description || "—"}</TableCell>
                    <TableCell className="text-right font-bold text-red-500"><FC amount={Math.abs(txn.amount)} currency={currency} /></TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-[9px]">{txn.multiple}x avg</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Drill-Down Sheet ── */}
      <Sheet open={!!drillDown} onOpenChange={(open) => !open && setDrillDown(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drillDown?.title}</SheetTitle>
            {drillDown?.description && <SheetDescription>{drillDown.description}</SheetDescription>}
          </SheetHeader>

          <div className="mt-4 space-y-4">
            {/* ── Total Payments ── */}
            {drillDown?.type === "total" && (() => {
              const catBreakdown: Record<string, { count: number; total: number }> = {};
              expenseTxns.forEach((t: any) => {
                const cat = getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "Other";
                if (!catBreakdown[cat]) catBreakdown[cat] = { count: 0, total: 0 };
                catBreakdown[cat].count++;
                catBreakdown[cat].total += Math.abs(t.amount);
              });
              const sorted = Object.entries(catBreakdown).sort(([, a], [, b]) => b.total - a.total);
              const grandTotal = expenseTxns.reduce((s, t: any) => s + Math.abs(t.amount), 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-bold">{expenseTxns.length}</p>
                      <p className="text-[10px] text-muted-foreground">Transactions</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-bold text-red-500"><FC amount={grandTotal} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Total Spent</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-bold">{sorted.length}</p>
                      <p className="text-[10px] text-muted-foreground">Categories</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Spending by Category</p>
                  <div className="space-y-2">
                    {sorted.map(([cat, data]) => (
                      <div key={cat} className="flex items-center justify-between p-2 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{cat}</p>
                          <p className="text-[10px] text-muted-foreground">{data.count} txn{data.count !== 1 ? "s" : ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-red-500"><FC amount={data.total} currency={currency} /></p>
                          <p className="text-[10px] text-muted-foreground">{grandTotal > 0 ? ((data.total / grandTotal) * 100).toFixed(1) : 0}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}

            {/* ── Allocated Payments ── */}
            {drillDown?.type === "allocated" && (() => {
              const totalAllocated = allocated.reduce((s, a) => s + Math.abs(a.txn.amount), 0);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-lg font-bold text-green-600">{allocated.length}</p>
                      <p className="text-[10px] text-muted-foreground">Matched</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-lg font-bold text-green-600"><FC amount={totalAllocated} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Total Allocated</p>
                    </div>
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-lg font-bold text-green-600">{expenseTxns.length > 0 ? ((allocated.length / expenseTxns.length) * 100).toFixed(0) : 0}%</p>
                      <p className="text-[10px] text-muted-foreground">Match Rate</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matched Payments</p>
                  <div className="space-y-2">
                    {allocated.slice(0, 30).map((a, i) => (
                      <div key={i} className="p-2.5 rounded-lg border space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate max-w-[200px]">{a.txn.description || "—"}</p>
                          <p className="text-sm font-semibold text-red-500"><FC amount={Math.abs(a.txn.amount)} currency={currency} /></p>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{a.txn.transaction_date ? format(new Date(a.txn.transaction_date), "dd MMM yyyy") : "—"}</span>
                          <Badge variant="outline" className="text-[9px] text-green-600 border-green-200">
                            {a.bill.vendor_name || a.bill.bill_number || "Bill"} — <FC amount={a.bill.total || 0} currency={currency} />
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {allocated.length > 30 && <p className="text-xs text-center text-muted-foreground">+{allocated.length - 30} more</p>}
                  </div>
                </>
              );
            })()}

            {/* ── Unallocated Payments ── */}
            {drillDown?.type === "unallocated" && (() => {
              const totalUnalloc = unallocated.reduce((s, t: any) => s + Math.abs(t.amount), 0);
              const catBreakdown: Record<string, { count: number; total: number }> = {};
              unallocated.forEach((t: any) => {
                const cat = getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "Other";
                if (!catBreakdown[cat]) catBreakdown[cat] = { count: 0, total: 0 };
                catBreakdown[cat].count++;
                catBreakdown[cat].total += Math.abs(t.amount);
              });
              const sorted = Object.entries(catBreakdown).sort(([, a], [, b]) => b.total - a.total);
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-lg font-bold text-amber-500">{unallocated.length}</p>
                      <p className="text-[10px] text-muted-foreground">Unmatched</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-lg font-bold text-amber-500"><FC amount={totalUnalloc} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Unallocated Total</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3">
                      <p className="text-lg font-bold text-amber-500">{sorted.length}</p>
                      <p className="text-[10px] text-muted-foreground">Categories</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <p className="text-xs text-amber-700">These payments have no matching bill within 10% amount and 30 days. They may be ad-hoc purchases, recurring expenses without invoices, or bills not yet entered.</p>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">By Category</p>
                  <div className="space-y-1.5">
                    {sorted.map(([cat, data]) => (
                      <div key={cat} className="flex items-center justify-between p-2 rounded-lg border">
                        <div>
                          <p className="text-sm font-medium">{cat}</p>
                          <p className="text-[10px] text-muted-foreground">{data.count} txn{data.count !== 1 ? "s" : ""}</p>
                        </div>
                        <p className="text-sm font-semibold text-amber-500"><FC amount={data.total} currency={currency} /></p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">All Unallocated</p>
                  <div className="space-y-2">
                    {unallocated.slice(0, 40).map((txn: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg border">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{txn.description || "—"}</p>
                          <p className="text-[10px] text-muted-foreground">{txn.transaction_date ? format(new Date(txn.transaction_date), "dd MMM yyyy") : "—"}</p>
                        </div>
                        <p className="text-sm font-semibold text-red-500 shrink-0 ml-2"><FC amount={Math.abs(txn.amount)} currency={currency} /></p>
                      </div>
                    ))}
                    {unallocated.length > 40 && <p className="text-xs text-center text-muted-foreground">+{unallocated.length - 40} more</p>}
                  </div>
                </>
              );
            })()}

            {/* ── Large Transactions ── */}
            {drillDown?.type === "large" && (() => {
              const amounts = expenseTxns.map((t: any) => Math.abs(t.amount));
              const mean = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
              const stdDev = amounts.length > 1 ? Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length) : 0;
              const threshold = mean + 3 * stdDev;
              return (
                <>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-lg font-bold text-red-500">{largeTransactions.length}</p>
                      <p className="text-[10px] text-muted-foreground">Outliers</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-bold"><FC amount={mean} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Avg Payment</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3">
                      <p className="text-lg font-bold"><FC amount={threshold} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">3σ Threshold</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                    <p className="text-xs text-red-700">These transactions exceed 3 standard deviations from the mean expense amount (<FC amount={mean} currency={currency} /> avg ± <FC amount={stdDev} currency={currency} /> σ). They may warrant review for unusual activity, duplicate charges, or one-off large purchases.</p>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Flagged Transactions</p>
                  <div className="space-y-2">
                    {largeTransactions.map((txn: any, i: number) => (
                      <div key={i} className="p-3 rounded-lg border border-red-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate max-w-[220px]">{txn.description || "—"}</p>
                          <p className="text-sm font-bold text-red-500"><FC amount={Math.abs(txn.amount)} currency={currency} /></p>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{txn.transaction_date ? format(new Date(txn.transaction_date), "dd MMM yyyy") : "—"}</span>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="destructive" className="text-[9px]">{txn.multiple}x avg</Badge>
                            <Badge variant="outline" className="text-[9px]">{getCanonicalCategory(txn.category, txn.counterparty_name || txn.description, txn.description) || "Other"}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Expense Variance Tab ─────────────────────────────────────────────────

function guessExpenseAnomalyReasons(
  category: string,
  variance: number,
  zScore: number,
  monthCats: Record<string, Record<string, number>>,
  expTxns: any[],
  currency: string,
): { reason: string; detail: string; icon: string }[] {
  const reasons: { reason: string; detail: string; icon: string }[] = [];
  const catMonths = monthCats[category] || {};
  const sortedMs = Object.keys(catMonths).sort();
  if (sortedMs.length < 2) return [{ reason: "Insufficient Data", detail: "Need at least 2 months", icon: "info" }];
  const latestMonth = sortedMs[sortedMs.length - 1];
  const prevMonth = sortedMs[sortedMs.length - 2];
  const latestTxns = expTxns.filter((t: any) => t.transaction_date?.startsWith(latestMonth) && (getCanonicalCategory(t.category, t.description, t.description) || "Other") === category);
  const prevTxns = expTxns.filter((t: any) => t.transaction_date?.startsWith(prevMonth) && (getCanonicalCategory(t.category, t.description, t.description) || "Other") === category);

  // Transaction count change
  if (latestTxns.length > prevTxns.length * 1.5 && prevTxns.length > 0) {
    reasons.push({ reason: "Volume Increase", detail: `${latestTxns.length} transactions vs ${prevTxns.length} previous month (+${((latestTxns.length / prevTxns.length - 1) * 100).toFixed(0)}%)`, icon: "volume" });
  } else if (latestTxns.length < prevTxns.length * 0.5 && prevTxns.length > 0) {
    reasons.push({ reason: "Volume Decrease", detail: `${latestTxns.length} transactions vs ${prevTxns.length} previous month`, icon: "volume" });
  }

  // Large single transaction
  const largestLatest = latestTxns.sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0];
  const totalLatest = latestTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  if (largestLatest && totalLatest > 0 && Math.abs(largestLatest.amount) / totalLatest > 0.5) {
    reasons.push({ reason: "Single Large Transaction", detail: `"${largestLatest.description?.slice(0, 40)}" = ${formatAmount(Math.abs(largestLatest.amount), currency)} (${((Math.abs(largestLatest.amount) / totalLatest) * 100).toFixed(0)}% of category)`, icon: "large" });
  }

  // New vendors/payees
  const prevDescs = new Set(prevTxns.map((t: any) => (t.counterparty_name || t.description || "").toLowerCase().trim()));
  const newPayees = latestTxns.filter((t: any) => !prevDescs.has((t.counterparty_name || t.description || "").toLowerCase().trim()));
  if (newPayees.length > 0 && latestTxns.length > 0) {
    const newTotal = newPayees.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    reasons.push({ reason: "New Payees", detail: `${newPayees.length} new payee(s) accounting for ${formatAmount(newTotal, currency)}`, icon: "new" });
  }

  // High z-score
  if (Math.abs(zScore) > 2) {
    reasons.push({ reason: "Statistical Outlier", detail: `Z-score of ${zScore.toFixed(2)} — spending is ${Math.abs(zScore).toFixed(1)} standard deviations from mean`, icon: "stat" });
  }

  // Seasonal pattern (same month last year)
  const latestDate = new Date(latestMonth + "-01");
  const sameMonthLastYear = `${latestDate.getFullYear() - 1}-${String(latestDate.getMonth() + 1).padStart(2, "0")}`;
  if (catMonths[sameMonthLastYear]) {
    const yoyChange = ((catMonths[latestMonth] - catMonths[sameMonthLastYear]) / catMonths[sameMonthLastYear]) * 100;
    if (Math.abs(yoyChange) > 30) {
      reasons.push({ reason: "Year-over-Year Change", detail: `${yoyChange > 0 ? "+" : ""}${yoyChange.toFixed(0)}% vs same month last year`, icon: "yoy" });
    }
  }

  if (reasons.length === 0) {
    reasons.push({ reason: variance > 0 ? "Gradual Increase" : "Gradual Decrease", detail: `Spending shifted ${variance > 0 ? "up" : "down"} by ${Math.abs(variance).toFixed(0)}% vs rolling average`, icon: "trend" });
  }
  return reasons;
}

function ExpenseVarianceTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: transactions = [] } = useQuery({
    queryKey: ["exp-txns-var", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const [drillDown, setDrillDown] = useState<{
    type: "categories" | "spike" | "drop" | "flags" | "category-detail";
    title: string;
    description?: string;
    category?: string;
  } | null>(null);

  const { categoryVariance, historicalData, unusualFlags, monthCats, expTxns } = useMemo(() => {
    if (transactions.length === 0) return { categoryVariance: [], historicalData: [], unusualFlags: [], monthCats: {} as Record<string, Record<string, number>>, expTxns: [] as any[] };

    const eTxns = transactions.filter((t: any) => t.amount < 0);

    // Monthly by category
    const mCats: Record<string, Record<string, number>> = {};
    const monthTotals: Record<string, number> = {};
    eTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      const month = t.transaction_date?.slice(0, 7);
      if (!month) return;
      if (!mCats[cat]) mCats[cat] = {};
      mCats[cat][month] = (mCats[cat][month] || 0) + Math.abs(t.amount);
      monthTotals[month] = (monthTotals[month] || 0) + Math.abs(t.amount);
    });

    // Category variance
    const catVar = Object.entries(mCats)
      .map(([cat, months]) => {
        const sortedMs = Object.keys(months).sort();
        const vals = sortedMs.map((m) => months[m]);
        if (vals.length < 2) return null;
        const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
        const std = Math.sqrt(vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length);
        const latest = vals[vals.length - 1];
        const variance = avg > 0 ? ((latest - avg) / avg) * 100 : 0;
        const zScore = std > 0 ? (latest - avg) / std : 0;
        return { category: cat, avg, latest, variance, zScore, std, monthlyData: sortedMs.map((m) => ({ month: m, amount: months[m] })) };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    // Historical: current vs previous period
    const sortedMonths = Object.keys(monthTotals).sort();
    const half = Math.floor(sortedMonths.length / 2);
    const prevMonths = sortedMonths.slice(0, half);
    const currMonths = sortedMonths.slice(half);

    const prevByCat: Record<string, number> = {};
    const currByCat: Record<string, number> = {};
    Object.entries(mCats).forEach(([cat, months]) => {
      prevMonths.forEach((m) => { prevByCat[cat] = (prevByCat[cat] || 0) + (months[m] || 0); });
      currMonths.forEach((m) => { currByCat[cat] = (currByCat[cat] || 0) + (months[m] || 0); });
    });

    const histData = Object.keys({ ...prevByCat, ...currByCat })
      .map((cat) => ({
        category: cat.length > 15 ? cat.slice(0, 14) + "…" : cat,
        fullCategory: cat,
        previous: prevByCat[cat] || 0,
        current: currByCat[cat] || 0,
      }))
      .sort((a, b) => b.current - a.current)
      .slice(0, 10);

    // Unusual flags
    const flags: { type: string; description: string; detail: string; transactions?: any[] }[] = [];

    const weekendTxns = eTxns.filter((t: any) => {
      const d = new Date(t.transaction_date);
      return d.getDay() === 0 || d.getDay() === 6;
    });
    if (weekendTxns.length > 0) {
      flags.push({ type: "timing", description: "Weekend Transactions", detail: `${weekendTxns.length} transactions on Saturday/Sunday`, transactions: weekendTxns.slice(0, 20) });
    }

    Object.keys(currByCat).forEach((cat) => {
      const prev = prevByCat[cat] || 0;
      const curr = currByCat[cat] || 0;
      if (prev > 0 && curr > prev * 2) {
        const catTxns = eTxns.filter((t: any) => (getCanonicalCategory(t.category, t.description, t.description) || "Other") === cat);
        flags.push({ type: "spike", description: `${cat} — Sudden Increase`, detail: `${((curr / prev - 1) * 100).toFixed(0)}% increase vs previous period`, transactions: catTxns.slice(0, 20) });
      }
    });

    // New categories in current period
    Object.keys(currByCat).forEach((cat) => {
      if (!prevByCat[cat] || prevByCat[cat] === 0) {
        flags.push({ type: "new", description: `${cat} — New Category`, detail: `${formatAmount(currByCat[cat], currency)} spent in a category with no prior history` });
      }
    });

    return { categoryVariance: catVar, historicalData: histData, unusualFlags: flags, monthCats: mCats, expTxns: eTxns };
  }, [transactions, currency]);

  // Drill-down helpers
  const spikeCategory = useMemo(() => categoryVariance.filter((v) => v.variance > 0).sort((a, b) => b.variance - a.variance)[0], [categoryVariance]);
  const dropCategory = useMemo(() => categoryVariance.filter((v) => v.variance < 0).sort((a, b) => a.variance - b.variance)[0], [categoryVariance]);

  const getCategoryTxns = (cat: string) =>
    expTxns.filter((t: any) => (getCanonicalCategory(t.category, t.description, t.description) || "Other") === cat)
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 25);

  const barConfig: ChartConfig = {
    previous: { label: "Previous Period", color: "hsl(210 20% 70%)" },
    current: { label: "Current Period", color: "hsl(0 84% 55%)" },
  };

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileWarning className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Expense Variance Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">Need at least 2 months of transaction data for variance analysis.</p>
        </CardContent>
      </Card>
    );
  }

  const renderDrillDown = () => {
    if (!drillDown) return null;

    if (drillDown.type === "categories") {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">All {categoryVariance.length} tracked expense categories with variance analysis.</p>
          {categoryVariance.map((v) => (
            <div
              key={v.category}
              className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setDrillDown({ type: "category-detail", title: v.category, category: v.category })}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">{v.category}</span>
                <span className={`text-sm font-bold ${v.variance > 0 ? "text-red-500" : "text-green-600"}`}>
                  {v.variance > 0 ? "+" : ""}{v.variance.toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Avg: <FC amount={v.avg} currency={currency} /> → Latest: <FC amount={v.latest} currency={currency} /></span>
                <Badge variant={Math.abs(v.zScore) > 2 ? "destructive" : Math.abs(v.variance) > 25 ? "outline" : "secondary"} className="text-[9px]">
                  {Math.abs(v.zScore) > 2 ? "High" : Math.abs(v.variance) > 25 ? "Watch" : "Normal"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (drillDown.type === "spike" || drillDown.type === "drop") {
      const target = drillDown.type === "spike" ? spikeCategory : dropCategory;
      if (!target) return <p className="text-sm text-muted-foreground">No data available.</p>;
      const reasons = guessExpenseAnomalyReasons(target.category, target.variance, target.zScore, monthCats, expTxns, currency);
      const txns = getCategoryTxns(target.category);
      return (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Baseline</p>
              <p className="text-sm font-bold"><FC amount={target.avg} currency={currency} /></p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Latest</p>
              <p className="text-sm font-bold"><FC amount={target.latest} currency={currency} /></p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Z-Score</p>
              <p className="text-sm font-bold">{target.zScore.toFixed(2)}</p>
            </div>
          </div>

          {/* Monthly trend mini chart */}
          {target.monthlyData.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Trend</p>
              <div className="flex items-end gap-1 h-16">
                {target.monthlyData.map((m) => {
                  const maxVal = Math.max(...target.monthlyData.map((d) => d.amount));
                  const pct = maxVal > 0 ? (m.amount / maxVal) * 100 : 0;
                  const isLatest = m.month === target.monthlyData[target.monthlyData.length - 1].month;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                      <div className={`w-full rounded-t ${isLatest ? (drillDown.type === "spike" ? "bg-red-400" : "bg-green-400") : "bg-muted-foreground/20"}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                      <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reasons */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Detected Reasons</p>
            <div className="space-y-2">
              {reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50">
                  {r.icon === "volume" ? <BarChart3 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /> :
                   r.icon === "large" ? <Flame className="h-4 w-4 text-red-500 shrink-0 mt-0.5" /> :
                   r.icon === "new" ? <Plus className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" /> :
                   r.icon === "stat" ? <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> :
                   r.icon === "yoy" ? <Calendar className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" /> :
                   <TrendingUp className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />}
                  <div>
                    <p className="text-sm font-medium">{r.reason}</p>
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top transactions */}
          {txns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Top Transactions</p>
              <div className="space-y-1">
                {txns.slice(0, 10).map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                      <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "flags") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{unusualFlags.length} unusual patterns detected in your expense data.</p>
          {unusualFlags.map((flag, i) => (
            <div key={i} className="p-3 rounded-lg border">
              <div className="flex items-center gap-2.5 mb-2">
                {flag.type === "timing" ? <Clock className="h-4 w-4 text-blue-500" /> :
                 flag.type === "new" ? <Plus className="h-4 w-4 text-purple-500" /> :
                 <TrendingUp className="h-4 w-4 text-red-500" />}
                <div>
                  <p className="text-sm font-semibold">{flag.description}</p>
                  <p className="text-xs text-muted-foreground">{flag.detail}</p>
                </div>
              </div>
              {flag.transactions && flag.transactions.length > 0 && (
                <div className="mt-2 pt-2 border-t space-y-1">
                  {flag.transactions.slice(0, 8).map((t: any, j: number) => (
                    <div key={j} className="flex items-center justify-between text-xs py-1 px-1.5 rounded hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <span className="font-medium">{t.counterparty_name || t.description?.slice(0, 35)}</span>
                        <span className="text-muted-foreground ml-2">{t.transaction_date}</span>
                      </div>
                      <span className="font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
                    </div>
                  ))}
                  {flag.transactions.length > 8 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">+{flag.transactions.length - 8} more</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (drillDown.type === "category-detail") {
      const cat = drillDown.category || "";
      const varData = categoryVariance.find((v) => v.category === cat);
      const txns = getCategoryTxns(cat);
      const reasons = varData ? guessExpenseAnomalyReasons(cat, varData.variance, varData.zScore, monthCats, expTxns, currency) : [];
      return (
        <div className="space-y-4">
          {varData && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Variance</p>
                  <p className={`text-lg font-bold ${varData.variance > 0 ? "text-red-500" : "text-green-600"}`}>
                    {varData.variance > 0 ? "+" : ""}{varData.variance.toFixed(0)}%
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Z-Score</p>
                  <p className="text-lg font-bold">{varData.zScore.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Baseline Avg</p>
                  <p className="text-sm font-bold"><FC amount={varData.avg} currency={currency} /></p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Latest Month</p>
                  <p className="text-sm font-bold"><FC amount={varData.latest} currency={currency} /></p>
                </div>
              </div>

              {/* Monthly trend */}
              {varData.monthlyData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Trend</p>
                  <div className="flex items-end gap-1 h-20">
                    {varData.monthlyData.map((m) => {
                      const maxVal = Math.max(...varData.monthlyData.map((d) => d.amount));
                      const pct = maxVal > 0 ? (m.amount / maxVal) * 100 : 0;
                      const isLatest = m.month === varData.monthlyData[varData.monthlyData.length - 1].month;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                          <span className="text-[8px] text-muted-foreground"><FC amount={m.amount} currency={currency} /></span>
                          <div className={`w-full rounded-t ${isLatest ? (varData.variance > 0 ? "bg-red-400" : "bg-green-400") : "bg-muted-foreground/20"}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reasons */}
              {reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Detected Reasons</p>
                  <div className="space-y-2">
                    {reasons.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                        {r.icon === "volume" ? <BarChart3 className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5" /> :
                         r.icon === "large" ? <Flame className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" /> :
                         r.icon === "new" ? <Plus className="h-3.5 w-3.5 text-purple-500 shrink-0 mt-0.5" /> :
                         r.icon === "stat" ? <ShieldAlert className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" /> :
                         r.icon === "yoy" ? <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" /> :
                         <TrendingUp className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
                        <div>
                          <p className="text-xs font-medium">{r.reason}</p>
                          <p className="text-[10px] text-muted-foreground">{r.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Transactions */}
          {txns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Transactions ({txns.length})</p>
              <div className="space-y-1">
                {txns.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                      <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Categories"
          value={categoryVariance.length.toString()}
          icon={BarChart3}
          color="text-primary"
          sub="tracked"
          onClick={() => setDrillDown({ type: "categories", title: "Expense Categories", description: "All tracked categories with variance analysis" })}
        />
        <KPICard
          label="Highest Spike"
          value={spikeCategory ? `+${spikeCategory.variance.toFixed(0)}%` : "—"}
          icon={TrendingUp}
          color="text-red-500"
          onClick={spikeCategory ? () => setDrillDown({ type: "spike", title: `Highest Spike: ${spikeCategory.category}`, description: `+${spikeCategory.variance.toFixed(0)}% above rolling average`, category: spikeCategory.category }) : undefined}
        />
        <KPICard
          label="Biggest Drop"
          value={dropCategory ? `${dropCategory.variance.toFixed(0)}%` : "—"}
          icon={TrendingDown}
          color="text-red-500"
          onClick={dropCategory ? () => setDrillDown({ type: "drop", title: `Biggest Drop: ${dropCategory.category}`, description: `${dropCategory.variance.toFixed(0)}% below rolling average`, category: dropCategory.category }) : undefined}
        />
        <KPICard
          label="Unusual Flags"
          value={unusualFlags.length.toString()}
          icon={Zap}
          color={unusualFlags.length > 0 ? "text-amber-500" : "text-green-600"}
          onClick={unusualFlags.length > 0 ? () => setDrillDown({ type: "flags", title: "Unusual Expense Flags", description: `${unusualFlags.length} anomalies detected` }) : undefined}
        />
      </div>

      {/* Historical Comparison Chart */}
      {historicalData.length > 0 && (
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current vs Previous Period (by Category)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={barConfig} className="h-[240px] w-full !aspect-auto">
              <BarChart data={historicalData} layout="vertical" onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.fullCategory) {
                  const cat = e.activePayload[0].payload.fullCategory;
                  setDrillDown({ type: "category-detail", title: cat, category: cat });
                }
              }} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={false} />
                <XAxis type="number" axisLine={false} tickLine={false} className="text-[10px]" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()} />
                <YAxis type="category" dataKey="category" axisLine={false} tickLine={false} width={100} className="text-[10px]" />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Bar dataKey="previous" fill="hsl(210 20% 70%)" radius={[0, 3, 3, 0]} barSize={10} />
                <Bar dataKey="current" fill="hsl(0 84% 55%)" radius={[0, 3, 3, 0]} barSize={10} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Category Variance Table */}
      {categoryVariance.length > 0 && (
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Variance (vs Rolling Average)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Baseline (Avg)</TableHead>
                  <TableHead className="text-right">Latest</TableHead>
                  <TableHead className="text-right">Variance %</TableHead>
                  <TableHead className="text-right">Z-Score</TableHead>
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryVariance.map((v) => (
                  <TableRow
                    key={v.category}
                    className={`cursor-pointer hover:bg-muted/50 transition-colors ${Math.abs(v.zScore) > 2 ? "bg-red-50/30" : ""}`}
                    onClick={() => setDrillDown({ type: "category-detail", title: v.category, category: v.category })}
                  >
                    <TableCell className="text-sm font-medium">{v.category}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground"><FC amount={v.avg} currency={currency} /></TableCell>
                    <TableCell className="text-right text-sm font-semibold"><FC amount={v.latest} currency={currency} /></TableCell>
                    <TableCell className={`text-right text-sm font-bold ${v.variance > 0 ? "text-red-500" : "text-green-600"}`}>
                      {v.variance > 0 ? "+" : ""}{v.variance.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{v.zScore.toFixed(2)}</TableCell>
                    <TableCell>
                      {Math.abs(v.zScore) > 2 ? (
                        <Badge variant="destructive" className="text-[9px]">High</Badge>
                      ) : Math.abs(v.variance) > 25 ? (
                        <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-200">Watch</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-green-600 border-green-200">Normal</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Unusual Expense Flags */}
      {unusualFlags.length > 0 && (
        <Card className="stat-card-hover border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Unusual Expense Flags ({unusualFlags.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              {unusualFlags.map((flag, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                  onClick={() => setDrillDown({ type: "flags", title: "Unusual Expense Flags", description: `${unusualFlags.length} anomalies detected` })}
                >
                  {flag.type === "timing" ? (
                    <Clock className="h-4 w-4 text-blue-500 shrink-0" />
                  ) : flag.type === "new" ? (
                    <Plus className="h-4 w-4 text-purple-500 shrink-0" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium">{flag.description}</p>
                    <p className="text-xs text-muted-foreground">{flag.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drill-down Sheet */}
      <Sheet open={!!drillDown} onOpenChange={(open) => !open && setDrillDown(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drillDown?.title}</SheetTitle>
            {drillDown?.description && <SheetDescription>{drillDown.description}</SheetDescription>}
          </SheetHeader>
          <div className="mt-4">
            {renderDrillDown()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ExpenseIntegrity() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Expense Integrity
          </h1>
          <p className="text-muted-foreground">
            Control outflows — track payments, monitor AP, detect duplicate
            vendors, and flag variance.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="bills" className="gap-1.5">
              <Receipt className="h-3.5 w-3.5" />
              Bills
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              AP Aging
            </TabsTrigger>
            <TabsTrigger value="vendors" className="gap-1.5">
              <Store className="h-3.5 w-3.5" />
              Vendors
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="variance" className="gap-1.5">
              <FileWarning className="h-3.5 w-3.5" />
              Variance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <ExpenseOverviewTab />
          </TabsContent>
          <TabsContent value="bills" className="mt-4">
            <BillsTab />
          </TabsContent>
          <TabsContent value="aging" className="mt-4">
            <APAgingTab />
          </TabsContent>
          <TabsContent value="vendors" className="mt-4">
            <VendorsTab />
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <PaymentsTab />
          </TabsContent>
          <TabsContent value="variance" className="mt-4">
            <ExpenseVarianceTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
