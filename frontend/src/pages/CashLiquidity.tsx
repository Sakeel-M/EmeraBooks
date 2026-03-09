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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  Landmark,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
  Wallet,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Banknote,
  PiggyBank,
  Activity,
  Droplets,
  Plus,
  Save,
  Loader2,
  Sparkles,
  Upload,
  Eye,
  ArrowRight,
  Flame,
  Calendar,
  Zap,
  FileWarning,
  Info,
  BookOpen,
  ChevronDown,
  Search,
  Building2,
  Utensils,
  ShoppingCart,
  Bus,
  Coins,
  Shuffle,
  HelpCircle,
  CreditCard,
  Home,
  Heart,
  Briefcase,
  GraduationCap,
  Plane,
  Wrench,
  Phone,
  Monitor,
  Shield,
  Package,
  Factory,
  Music,
  Stethoscope,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { formatAmount } from "@/lib/utils";
import { format, subMonths, subDays, differenceInDays, isAfter, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { useDateRange } from "@/hooks/useDateRange";
import { TransactionDetailSheet } from "@/components/shared/TransactionDetailSheet";
import { getCanonicalCategory, resolveIncomeCategory } from "@/lib/sectorMapping";
import { PREDEFINED_SECTORS } from "@/lib/predefinedSectors";
import { flaskApi } from "@/lib/flaskApi";

// ── Cash Overview Tab ─────────────────────────────────────────────────────

function CashOverviewTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const [granularity, setGranularity] = useState<"monthly" | "weekly" | "daily">("monthly");
  const [drillDown, setDrillDown] = useState<{title: string; description?: string; transactions: any[]} | null>(null);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["cash-bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["cash-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  // ── Derived Metrics ──

  const totalBalance = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );

  const inflows = useMemo(
    () => transactions.filter((t: any) => t.amount > 0),
    [transactions],
  );
  const outflows = useMemo(
    () => transactions.filter((t: any) => t.amount < 0),
    [transactions],
  );

  const totalInflow = useMemo(
    () => inflows.reduce((s: number, t: any) => s + t.amount, 0),
    [inflows],
  );
  const totalOutflow = useMemo(
    () => outflows.reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    [outflows],
  );
  const netCashFlow = totalInflow - totalOutflow;

  // Monthly cash flow (12 months)
  const monthlyCashFlow = useMemo(() => {
    const months: Record<string, { inflow: number; outflow: number }> = {};
    transactions.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (!key) return;
      if (!months[key]) months[key] = { inflow: 0, outflow: 0 };
      if (t.amount > 0) {
        months[key].inflow += t.amount;
      } else {
        months[key].outflow += Math.abs(t.amount);
      }
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }));
  }, [transactions]);

  // Weekly cash flow
  const weeklyCashFlow = useMemo(() => {
    const weeks: Record<string, { inflow: number; outflow: number }> = {};
    transactions.forEach((t: any) => {
      const d = t.transaction_date ? new Date(t.transaction_date) : null;
      if (!d) return;
      // Week key: year + ISO week number
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
      const key = `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
      if (!weeks[key]) weeks[key] = { inflow: 0, outflow: 0 };
      if (t.amount > 0) weeks[key].inflow += t.amount;
      else weeks[key].outflow += Math.abs(t.amount);
    });
    return Object.entries(weeks)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([week, data]) => ({
        month: week,
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }));
  }, [transactions]);

  // Daily cash flow
  const dailyCashFlow = useMemo(() => {
    const days: Record<string, { inflow: number; outflow: number }> = {};
    transactions.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 10);
      if (!key) return;
      if (!days[key]) days[key] = { inflow: 0, outflow: 0 };
      if (t.amount > 0) days[key].inflow += t.amount;
      else days[key].outflow += Math.abs(t.amount);
    });
    return Object.entries(days)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-60)
      .map(([day, data]) => ({
        month: format(new Date(day), "dd MMM"),
        inflow: data.inflow,
        outflow: data.outflow,
        net: data.inflow - data.outflow,
      }));
  }, [transactions]);

  // Active chart data based on granularity
  const activeChartData = granularity === "weekly" ? weeklyCashFlow : granularity === "daily" ? dailyCashFlow : monthlyCashFlow;

  // This month vs last month
  const thisMonth = format(new Date(), "yyyy-MM");
  const lastMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const inflowThisMonth = useMemo(
    () =>
      inflows
        .filter((t: any) => t.transaction_date?.startsWith(thisMonth))
        .reduce((s: number, t: any) => s + t.amount, 0),
    [inflows, thisMonth],
  );
  const inflowLastMonth = useMemo(
    () =>
      inflows
        .filter((t: any) => t.transaction_date?.startsWith(lastMonth))
        .reduce((s: number, t: any) => s + t.amount, 0),
    [inflows, lastMonth],
  );
  const inflowTrend =
    inflowLastMonth > 0
      ? ((inflowThisMonth - inflowLastMonth) / inflowLastMonth) * 100
      : 0;

  // Burn rate (avg monthly outflow over last 3 months)
  const burnRate = useMemo(() => {
    const last3 = monthlyCashFlow.slice(-3);
    if (last3.length === 0) return 0;
    return last3.reduce((s, m) => s + m.outflow, 0) / last3.length;
  }, [monthlyCashFlow]);

  // Runway in months
  const runway = burnRate > 0 ? totalBalance / burnRate : Infinity;

  // Cash flow chart config
  const flowChartConfig: ChartConfig = {
    inflow: { label: "Inflow", color: "hsl(143 44% 28%)" },
    outflow: { label: "Outflow", color: "hsl(0 84% 55%)" },
  };

  // Net cash flow area config
  const netChartConfig: ChartConfig = {
    net: { label: "Net Cash Flow", color: "hsl(210 80% 55%)" },
  };

  // Inflow vs outflow donut
  const flowDonutData = useMemo(
    () => [
      { name: "Inflow", value: totalInflow, fill: "hsl(143 44% 28%)" },
      { name: "Outflow", value: totalOutflow, fill: "hsl(0 84% 55%)" },
    ],
    [totalInflow, totalOutflow],
  );
  const flowDonutConfig: ChartConfig = {
    inflow: { label: "Inflow", color: "hsl(143 44% 28%)" },
    outflow: { label: "Outflow", color: "hsl(0 84% 55%)" },
  };

  const hasData = transactions.length > 0 || bankAccounts.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Landmark className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Cash Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Upload a bank statement or add bank accounts to see your cash
            position, flow analysis, and liquidity metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Balance"
          value={formatAmount(totalBalance, currency)}
          icon={Wallet}
          color="text-primary"
          onClick={() => setDrillDown({ title: "All Transactions", description: "All transactions contributing to the total balance", transactions })}
        />
        <KPICard
          label="Total Inflow"
          value={formatAmount(totalInflow, currency)}
          icon={TrendingUp}
          color="text-green-600"
          trend={inflowTrend}
          sub="12 months"
          onClick={() => setDrillDown({ title: "Inflows", description: "All income transactions", transactions: inflows })}
        />
        <KPICard
          label="Total Outflow"
          value={formatAmount(totalOutflow, currency)}
          icon={TrendingDown}
          color="text-red-500"
          sub="12 months"
          onClick={() => setDrillDown({ title: "Outflows", description: "All expense transactions", transactions: outflows })}
        />
        <KPICard
          label="Net Cash Flow"
          value={formatAmount(Math.abs(netCashFlow), currency)}
          icon={ArrowRightLeft}
          color={netCashFlow >= 0 ? "text-green-600" : "text-red-500"}
          sub={netCashFlow >= 0 ? "Positive" : "Negative"}
          onClick={() => setDrillDown({ title: "Net Cash Flow", description: "All transactions (inflows and outflows)", transactions })}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Cash Flow Bar Chart */}
        <Card className="md:col-span-2 stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Cash Flow
              </CardTitle>
              <div className="flex items-center gap-1">
                {(["monthly", "weekly", "daily"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                      granularity === g
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {activeChartData.length === 0 ? (
              <EmptyChart text="No transaction data" />
            ) : (
              <ChartContainer
                config={flowChartConfig}
                className="h-[220px] w-full !aspect-auto"
              >
                <BarChart data={activeChartData}>
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
                  <Bar
                    dataKey="inflow"
                    fill="hsl(143 44% 28%)"
                    radius={[3, 3, 0, 0]}
                    barSize={14}
                  />
                  <Bar
                    dataKey="outflow"
                    fill="hsl(0 84% 55%)"
                    radius={[3, 3, 0, 0]}
                    barSize={14}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Inflow / Outflow Donut */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Inflow vs Outflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalInflow === 0 && totalOutflow === 0 ? (
              <EmptyChart text="No flow data" />
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer
                  config={flowDonutConfig}
                  className="h-[140px] w-[140px] !aspect-square"
                >
                  <PieChart>
                    <Pie
                      data={flowDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {flowDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            formatAmount(Number(value), currency)
                          }
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-1.5 mt-3 w-full">
                  {flowDonutData.map((d) => {
                    const pct =
                      totalInflow + totalOutflow > 0
                        ? (d.value / (totalInflow + totalOutflow)) * 100
                        : 0;
                    return (
                      <div
                        key={d.name}
                        className="flex items-center gap-1.5 text-xs"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: d.fill }}
                        />
                        <span className="text-muted-foreground">
                          {d.name}
                        </span>
                        <span className="font-semibold ml-auto">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                  <Separator className="my-1" />
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span>Ratio</span>
                    <span
                      className={
                        totalInflow >= totalOutflow
                          ? "text-green-600"
                          : "text-red-500"
                      }
                    >
                      {totalOutflow > 0
                        ? (totalInflow / totalOutflow).toFixed(2)
                        : "∞"}
                      x
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Forecast Coming Soon ── */}
      <Card className="stat-card-hover border-dashed">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2.5">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Cash Flow Forecast</p>
              <p className="text-xs text-muted-foreground">
                Coming Soon — ML-powered cash flow forecasting based on historical patterns, upcoming receivables, and scheduled payables.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">Coming Soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Net Cash Flow Trend ── */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Net Cash Flow Trend
            </CardTitle>
            <Badge
              variant={netCashFlow >= 0 ? "default" : "destructive"}
              className="text-[10px]"
            >
              {netCashFlow >= 0 ? "Net Positive" : "Net Negative"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {monthlyCashFlow.length === 0 ? (
            <EmptyChart text="No trend data" />
          ) : (
            <ChartContainer
              config={netChartConfig}
              className="h-[180px] w-full !aspect-auto"
            >
              <AreaChart data={monthlyCashFlow}>
                <defs>
                  <linearGradient
                    id="cashNetGrad"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="hsl(210 80% 55%)"
                      stopOpacity={0.2}
                    />
                    <stop
                      offset="100%"
                      stopColor="hsl(210 80% 55%)"
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
                      : v < -1000
                        ? `${(v / 1000).toFixed(0)}k`
                        : v.toString()
                  }
                />
                <ReferenceLine y={0} stroke="hsl(0 0% 70%)" strokeDasharray="3 3" />
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
                  dataKey="net"
                  stroke="hsl(210 80% 55%)"
                  strokeWidth={2.5}
                  fill="url(#cashNetGrad)"
                  dot={{ r: 3, fill: "hsl(210 80% 55%)", strokeWidth: 0 }}
                  activeDot={{
                    r: 5,
                    stroke: "hsl(210 80% 55%)",
                    strokeWidth: 2,
                    fill: "white",
                  }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Drill-Down Sheet ── */}
      <TransactionDetailSheet
        open={!!drillDown}
        onOpenChange={(open) => { if (!open) setDrillDown(null); }}
        title={drillDown?.title ?? ""}
        description={drillDown?.description}
        transactions={drillDown?.transactions ?? []}
        currency={currency}
      />
    </div>
  );
}

// ── Bank Accounts Tab ─────────────────────────────────────────────────────

function BankAccountsTab() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    account_name: "",
    bank_name: "",
    account_number: "",
    currency: "AED",
    opening_balance: "",
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["cash-bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["cash-txns-all", clientId],
    queryFn: () =>
      database.getTransactions(clientId!, { limit: 5000 }),
    enabled: !!clientId,
  });

  const { data: reconSessions = [] } = useQuery({
    queryKey: ["cash-recon-sessions", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
  });

  // Reconciliation status per account
  const reconStatus = useMemo(() => {
    const map: Record<string, { status: string; lastDate: string | null }> = {};
    bankAccounts.forEach((acc: any) => {
      const sessions = reconSessions.filter((s: any) => s.bank_account_id === acc.id);
      if (sessions.length === 0) {
        map[acc.id] = { status: "unreconciled", lastDate: null };
      } else {
        const latest = sessions.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
        const daysSince = latest.created_at ? differenceInDays(new Date(), new Date(latest.created_at)) : 999;
        map[acc.id] = {
          status: daysSince <= 30 ? "reconciled" : "pending",
          lastDate: latest.created_at,
        };
      }
    });
    return map;
  }, [bankAccounts, reconSessions]);

  // Stale account warning
  const staleAccounts = useMemo(
    () => bankAccounts.filter((a: any) => {
      const s = reconStatus[a.id];
      return !s || s.status !== "reconciled";
    }),
    [bankAccounts, reconStatus],
  );

  const handleAddAccount = async () => {
    if (!clientId || !addForm.account_name.trim()) return;
    setAddSaving(true);
    try {
      await database.createBankAccount(clientId, {
        account_name: addForm.account_name.trim(),
        bank_name: addForm.bank_name.trim(),
        account_number: addForm.account_number.trim(),
        currency: addForm.currency,
        current_balance: parseFloat(addForm.opening_balance) || 0,
        is_active: true,
      });
      queryClient.invalidateQueries({ queryKey: ["cash-bank-accounts", clientId] });
      toast.success("Bank account added");
      setShowAddDialog(false);
      setAddForm({ account_name: "", bank_name: "", account_number: "", currency: "AED", opening_balance: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to add account");
    } finally {
      setAddSaving(false);
    }
  };

  const totalBalance = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );

  // Per-account recent activity
  const accountStats = useMemo(() => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
    return bankAccounts.map((acc: any) => {
      const accTxns = transactions.filter(
        (t: any) =>
          t.bank_account_id === acc.id &&
          t.transaction_date >= thirtyDaysAgo,
      );
      const recentInflow = accTxns
        .filter((t: any) => t.amount > 0)
        .reduce((s: number, t: any) => s + t.amount, 0);
      const recentOutflow = accTxns
        .filter((t: any) => t.amount < 0)
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      return {
        ...acc,
        recentInflow,
        recentOutflow,
        recentNet: recentInflow - recentOutflow,
        txnCount: accTxns.length,
        balancePct:
          totalBalance > 0
            ? ((acc.current_balance || 0) / totalBalance) * 100
            : 0,
      };
    });
  }, [bankAccounts, transactions, totalBalance]);

  // Balance distribution donut
  const balanceDonutData = useMemo(() => {
    const colors = [
      "hsl(143 44% 28%)",
      "hsl(210 80% 55%)",
      "hsl(45 93% 47%)",
      "hsl(280 60% 50%)",
      "hsl(0 84% 55%)",
      "hsl(170 60% 40%)",
    ];
    return bankAccounts.map((acc: any, i: number) => ({
      name: acc.account_name || acc.bank_name || `Account ${i + 1}`,
      value: Math.max(acc.current_balance || 0, 0),
      fill: colors[i % colors.length],
    }));
  }, [bankAccounts]);

  const donutConfig: ChartConfig = {
    value: { label: "Balance", color: "hsl(143 44% 28%)" },
  };

  if (bankAccounts.length === 0) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Landmark className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Bank Accounts</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Bank accounts are created when you upload bank statements, or you can add one manually.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => setShowAddDialog(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
              <Button variant="outline" onClick={() => navigate("/integrations")} className="gap-1.5">
                Upload Statement
              </Button>
            </div>
          </CardContent>
        </Card>
        <AddAccountDialog open={showAddDialog} onOpenChange={setShowAddDialog} form={addForm} setForm={setAddForm} saving={addSaving} onSave={handleAddAccount} />
      </>
    );
  }

  return (
    <div className="space-y-5">
      {/* Stale account warning */}
      {staleAccounts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {staleAccounts.length} account{staleAccounts.length !== 1 ? "s" : ""} not reconciled in over 30 days.
            <button onClick={() => navigate("/reconciliation")} className="underline ml-1 font-medium">Reconcile now</button>
          </p>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          label="Total Balance"
          value={formatAmount(totalBalance, currency)}
          icon={Wallet}
          color="text-primary"
          sub={`${bankAccounts.length} account${bankAccounts.length !== 1 ? "s" : ""}`}
        />
        <KPICard
          label="Highest Balance"
          value={formatAmount(
            Math.max(...bankAccounts.map((a: any) => a.current_balance || 0)),
            currency,
          )}
          icon={TrendingUp}
          color="text-green-600"
        />
        <KPICard
          label="Lowest Balance"
          value={formatAmount(
            Math.min(...bankAccounts.map((a: any) => a.current_balance || 0)),
            currency,
          )}
          icon={
            Math.min(...bankAccounts.map((a: any) => a.current_balance || 0)) < 0
              ? AlertTriangle
              : Banknote
          }
          color={
            Math.min(...bankAccounts.map((a: any) => a.current_balance || 0)) < 0
              ? "text-red-500"
              : "text-primary"
          }
        />
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Add Account
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Account Cards */}
        <div className="md:col-span-2 space-y-3">
          {accountStats.map((acc: any) => {
            const rs = reconStatus[acc.id];
            const statusLabel = rs?.status === "reconciled" ? "Reconciled" : rs?.status === "pending" ? "Pending" : "Unreconciled";
            const statusColor = rs?.status === "reconciled" ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400" : rs?.status === "pending" ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" : "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400";
            return (
            <Card key={acc.id} className="stat-card-hover">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-sm">
                        {acc.account_name || "Untitled Account"}
                      </p>
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${statusColor}`}>
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {acc.bank_name}
                      {acc.account_number && ` · ···${acc.account_number.slice(-4)}`}
                      {rs?.lastDate && (
                        <span className="ml-1.5">· Last reconciled {format(new Date(rs.lastDate), "dd MMM yyyy")}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">
                      {formatAmount(acc.current_balance || 0, acc.currency || currency)}
                    </p>
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                    >
                      {acc.currency || currency}
                    </Badge>
                  </div>
                </div>

                {/* Balance share bar */}
                <Progress value={acc.balancePct} className="h-1.5 mb-3" />

                {/* 30-day activity */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">30d Inflow</span>
                    <p className="font-semibold text-green-600">
                      {formatAmount(acc.recentInflow, acc.currency || currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">30d Outflow</span>
                    <p className="font-semibold text-red-500">
                      {formatAmount(acc.recentOutflow, acc.currency || currency)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transactions</span>
                    <p className="font-semibold">{acc.txnCount}</p>
                  </div>
                </div>

                {/* Quick Actions */}
                <Separator className="my-3" />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => navigate("/integrations")}>
                    <Upload className="h-3 w-3" />
                    Upload
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => navigate("/cash?tab=transactions")}>
                    <Eye className="h-3 w-3" />
                    Transactions
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => navigate("/reconciliation")}>
                    <ArrowRight className="h-3 w-3" />
                    Reconcile
                  </Button>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>

        {/* Balance Distribution Donut */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Balance Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {balanceDonutData.length === 0 ? (
              <EmptyChart text="No accounts" />
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer
                  config={donutConfig}
                  className="h-[160px] w-[160px] !aspect-square"
                >
                  <PieChart>
                    <Pie
                      data={balanceDonutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {balanceDonutData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            formatAmount(Number(value), currency)
                          }
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
                <div className="space-y-1 mt-3 w-full">
                  {balanceDonutData.map((d) => (
                    <div
                      key={d.name}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: d.fill }}
                      />
                      <span className="text-muted-foreground truncate">
                        {d.name}
                      </span>
                      <span className="font-semibold ml-auto">
                        {formatAmount(d.value, currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AddAccountDialog open={showAddDialog} onOpenChange={setShowAddDialog} form={addForm} setForm={setAddForm} saving={addSaving} onSave={handleAddAccount} />
    </div>
  );
}

// ── Add Account Dialog ──────────────────────────────────────────────────

function AddAccountDialog({ open, onOpenChange, form, setForm, saving, onSave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  form: { account_name: string; bank_name: string; account_number: string; currency: string; opening_balance: string };
  setForm: (f: any) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Bank Account</DialogTitle>
          <DialogDescription>Manually add a bank account to track balances.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Account Name *</Label>
            <Input placeholder="e.g. Current Account" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Input placeholder="e.g. ADCB" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Account # (last 4)</Label>
              <Input placeholder="e.g. 1234" maxLength={4} value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AED">AED</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="INR">INR</SelectItem>
                  <SelectItem value="SAR">SAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Opening Balance</Label>
              <Input type="number" placeholder="0.00" value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !form.account_name.trim()} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Add Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Liquidity Risk Tab ────────────────────────────────────────────────────

function LiquidityRiskTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["cash-bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["cash-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["cash-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["cash-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const [drillDown, setDrillDown] = useState<{
    type: "risk-level" | "cash" | "coverage" | "quick-ratio" | "burn" | "obligations" | "receivables" | "burn-month" | "obligation-item";
    title: string;
    description?: string;
    data?: any;
  } | null>(null);

  const totalBalance = useMemo(
    () => bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0),
    [bankAccounts],
  );

  // Monthly outflow for burn rate
  const monthlyOutflows = useMemo(() => {
    const months: Record<string, number> = {};
    transactions.forEach((t: any) => {
      if (t.amount >= 0) return;
      const key = t.transaction_date?.slice(0, 7);
      if (key) months[key] = (months[key] || 0) + Math.abs(t.amount);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [transactions]);

  // Monthly inflow
  const monthlyInflows = useMemo(() => {
    const months: Record<string, number> = {};
    transactions.forEach((t: any) => {
      if (t.amount <= 0) return;
      const key = t.transaction_date?.slice(0, 7);
      if (key) months[key] = (months[key] || 0) + t.amount;
    });
    return months;
  }, [transactions]);

  const avgMonthlyBurn = useMemo(() => {
    if (monthlyOutflows.length === 0) return 0;
    return (
      monthlyOutflows.reduce((s, [, v]) => s + v, 0) / monthlyOutflows.length
    );
  }, [monthlyOutflows]);

  const runway = avgMonthlyBurn > 0 ? totalBalance / avgMonthlyBurn : Infinity;

  // Upcoming obligations (unpaid bills in next 90 days)
  const upcomingObligations = useMemo(() => {
    const now = new Date();
    return bills
      .filter((b: any) => {
        if (b.status === "paid" || b.status === "cancelled") return false;
        return true;
      })
      .map((b: any) => ({
        ...b,
        daysUntilDue: b.due_date
          ? differenceInDays(parseISO(b.due_date), now)
          : 999,
      }))
      .sort((a: any, b: any) => a.daysUntilDue - b.daysUntilDue);
  }, [bills]);

  const totalObligations = upcomingObligations.reduce(
    (s: number, b: any) => s + (b.total || 0),
    0,
  );

  // Expected receivables (unpaid invoices)
  const unpaidInvoices = useMemo(() => {
    return invoices.filter(
      (i: any) => i.status !== "paid" && i.status !== "cancelled",
    );
  }, [invoices]);

  const expectedReceivables = useMemo(() => {
    return unpaidInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
  }, [unpaidInvoices]);

  // Coverage ratio
  const coverageRatio =
    totalObligations > 0 ? totalBalance / totalObligations : Infinity;

  // Quick ratio: (cash + receivables) / payables
  const quickRatio =
    totalObligations > 0
      ? (totalBalance + expectedReceivables) / totalObligations
      : Infinity;

  // Risk level
  const riskLevel = useMemo(() => {
    if (runway < 2 || coverageRatio < 0.5)
      return { label: "Critical", color: "text-red-600", bg: "bg-red-500" };
    if (runway < 4 || coverageRatio < 1)
      return { label: "High", color: "text-orange-500", bg: "bg-orange-500" };
    if (runway < 6 || coverageRatio < 1.5)
      return { label: "Medium", color: "text-amber-500", bg: "bg-amber-500" };
    return { label: "Low", color: "text-green-600", bg: "bg-green-500" };
  }, [runway, coverageRatio]);

  // ── Risk Reasons ──
  const riskReasons = useMemo(() => {
    const reasons: { reason: string; detail: string; severity: "critical" | "warning" | "info"; icon: string }[] = [];

    // Runway reasons
    if (runway === 0) {
      reasons.push({ reason: "Zero Cash Runway", detail: "Current cash balance cannot cover even 1 month of expenses at the current burn rate", severity: "critical", icon: "runway" });
    } else if (runway < 1) {
      reasons.push({ reason: "Less Than 1 Month Runway", detail: `Only ${(runway * 30).toFixed(0)} days of cash remaining at current burn rate of ${formatAmount(avgMonthlyBurn, currency)}/mo`, severity: "critical", icon: "runway" });
    } else if (runway < 2) {
      reasons.push({ reason: "Low Cash Runway", detail: `Only ${runway.toFixed(1)} months of cash remaining. Industry standard minimum is 3-6 months`, severity: "critical", icon: "runway" });
    } else if (runway < 4) {
      reasons.push({ reason: "Below-Target Runway", detail: `${runway.toFixed(1)} months runway is below the recommended 6-month safety buffer`, severity: "warning", icon: "runway" });
    }

    // Cash vs burn
    if (totalBalance > 0 && avgMonthlyBurn > 0 && totalBalance < avgMonthlyBurn) {
      reasons.push({ reason: "Cash Below Monthly Burn", detail: `Cash on hand (${formatAmount(totalBalance, currency)}) is less than one month's average outflow (${formatAmount(avgMonthlyBurn, currency)})`, severity: "critical", icon: "cash" });
    }

    // Burn rate trend
    if (monthlyOutflows.length >= 3) {
      const recent3 = monthlyOutflows.slice(-3).map(([, v]) => v);
      const older = monthlyOutflows.slice(0, -3).map(([, v]) => v);
      const recentAvg = recent3.reduce((s, v) => s + v, 0) / recent3.length;
      const olderAvg = older.length > 0 ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
      if (olderAvg > 0 && recentAvg > olderAvg * 1.3) {
        reasons.push({ reason: "Accelerating Burn Rate", detail: `Recent 3-month avg (${formatAmount(recentAvg, currency)}) is ${((recentAvg / olderAvg - 1) * 100).toFixed(0)}% higher than earlier period`, severity: "warning", icon: "burn" });
      }
    }

    // Highest single-month burn
    if (monthlyOutflows.length > 0) {
      const maxBurn = Math.max(...monthlyOutflows.map(([, v]) => v));
      const maxMonth = monthlyOutflows.find(([, v]) => v === maxBurn);
      if (maxBurn > avgMonthlyBurn * 1.5 && maxMonth) {
        reasons.push({ reason: "Burn Rate Spike", detail: `${format(new Date(maxMonth[0] + "-01"), "MMM yyyy")} had ${formatAmount(maxBurn, currency)} outflow — ${((maxBurn / avgMonthlyBurn - 1) * 100).toFixed(0)}% above average`, severity: "warning", icon: "spike" });
      }
    }

    // Coverage ratio
    if (coverageRatio !== Infinity && coverageRatio < 0.5) {
      reasons.push({ reason: "Critically Low Coverage", detail: `Coverage ratio of ${coverageRatio.toFixed(2)}x means cash covers less than half of outstanding payables`, severity: "critical", icon: "coverage" });
    } else if (coverageRatio !== Infinity && coverageRatio < 1) {
      reasons.push({ reason: "Insufficient Coverage", detail: `Coverage ratio of ${coverageRatio.toFixed(2)}x — cash cannot fully cover outstanding payables (${formatAmount(totalObligations, currency)})`, severity: "warning", icon: "coverage" });
    }

    // Overdue bills
    const overdueBills = upcomingObligations.filter((b: any) => b.daysUntilDue < 0);
    if (overdueBills.length > 0) {
      const overdueTotal = overdueBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      reasons.push({ reason: "Overdue Payables", detail: `${overdueBills.length} bill(s) totaling ${formatAmount(overdueTotal, currency)} are past due date`, severity: "critical", icon: "overdue" });
    }

    // No inflow
    const avgMonthlyInflow = Object.values(monthlyInflows).length > 0
      ? Object.values(monthlyInflows).reduce((s, v) => s + v, 0) / Object.values(monthlyInflows).length
      : 0;
    if (avgMonthlyInflow > 0 && avgMonthlyBurn > 0 && avgMonthlyInflow < avgMonthlyBurn * 0.8) {
      reasons.push({ reason: "Inflow Below Outflow", detail: `Average monthly inflow (${formatAmount(avgMonthlyInflow, currency)}) is ${((1 - avgMonthlyInflow / avgMonthlyBurn) * 100).toFixed(0)}% below average outflow — net cash drain`, severity: "warning", icon: "inflow" });
    }

    // Concentration risk — top category spending
    const catSpend: Record<string, number> = {};
    transactions.filter((t: any) => t.amount < 0).forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      catSpend[cat] = (catSpend[cat] || 0) + Math.abs(t.amount);
    });
    const totalSpend = Object.values(catSpend).reduce((s, v) => s + v, 0);
    const topCat = Object.entries(catSpend).sort((a, b) => b[1] - a[1])[0];
    if (topCat && totalSpend > 0 && topCat[1] / totalSpend > 0.5) {
      reasons.push({ reason: "Expense Concentration", detail: `${topCat[0]} accounts for ${((topCat[1] / totalSpend) * 100).toFixed(0)}% of total spending (${formatAmount(topCat[1], currency)})`, severity: "info", icon: "concentration" });
    }

    if (reasons.length === 0) {
      reasons.push({ reason: "Healthy Liquidity", detail: "No significant liquidity risks detected. Cash position and ratios are within acceptable ranges", severity: "info", icon: "healthy" });
    }

    return reasons;
  }, [runway, avgMonthlyBurn, totalBalance, coverageRatio, totalObligations, monthlyOutflows, monthlyInflows, upcomingObligations, transactions, currency]);

  // ── Obligations Timeline (next 90 days projected cash) ──
  const obligationsTimeline = useMemo(() => {
    const now = new Date();
    const points: { day: number; date: string; balance: number; obligation: number }[] = [];

    const dueMap: Record<number, number> = {};
    upcomingObligations.forEach((b: any) => {
      const d = b.daysUntilDue;
      if (d >= 0 && d <= 90) {
        dueMap[d] = (dueMap[d] || 0) + (b.total || 0);
      }
    });

    for (let d = 0; d <= 90; d += 3) {
      let cumulObligation = 0;
      for (let i = 0; i <= d; i++) {
        cumulObligation += dueMap[i] || 0;
      }
      const projBalance = totalBalance - cumulObligation;
      const dateLabel = format(subDays(now, -d), "dd MMM");
      points.push({
        day: d,
        date: dateLabel,
        balance: Math.round(projBalance * 100) / 100,
        obligation: Math.round(cumulObligation * 100) / 100,
      });
    }
    return points;
  }, [totalBalance, upcomingObligations]);

  const dangerDate = useMemo(() => {
    const pt = obligationsTimeline.find((p) => p.balance < 0);
    return pt ? pt.date : null;
  }, [obligationsTimeline]);

  const timelineConfig: ChartConfig = {
    balance: { label: "Projected Balance", color: "hsl(143 44% 28%)" },
    obligation: { label: "Cumulative Obligations", color: "hsl(0 84% 55%)" },
  };

  // ── Coverage Ratio Trend (12 months) ──
  const coverageHistory = useMemo(() => {
    const now = new Date();
    const months = eachMonthOfInterval({
      start: subMonths(startOfMonth(now), 11),
      end: startOfMonth(now),
    });

    return months.map((m) => {
      const end = endOfMonth(m);
      const endStr = format(end, "yyyy-MM-dd");
      const startStr = format(m, "yyyy-MM-dd");

      const monthTxns = transactions.filter(
        (t: any) => t.transaction_date <= endStr,
      );
      const approxBalance = monthTxns.reduce(
        (s: number, t: any) => s + (t.amount || 0),
        0,
      );

      const obligations = bills
        .filter((b: any) => {
          if (b.status === "paid" || b.status === "cancelled") return false;
          if (!b.due_date) return false;
          const dd = b.due_date;
          return dd >= startStr && dd <= endStr;
        })
        .reduce((s: number, b: any) => s + (b.total || 0), 0);

      const ratio = obligations > 0 ? approxBalance / obligations : null;

      return {
        month: format(m, "MMM yy"),
        ratio: ratio !== null ? Math.round(ratio * 100) / 100 : null,
      };
    });
  }, [transactions, bills]);

  const coverageConfig: ChartConfig = {
    ratio: { label: "Coverage Ratio", color: "hsl(210 80% 55%)" },
  };

  // ── Burn month transactions helper ──
  const getMonthExpenses = (month: string) => {
    return transactions
      .filter((t: any) => t.amount < 0 && t.transaction_date?.startsWith(month))
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 25);
  };

  const hasData = transactions.length > 0 || bankAccounts.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            No Data for Risk Analysis
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements to calculate liquidity ratios, burn rate, and
            cash runway.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Drill-down render ──
  const renderDrillDown = () => {
    if (!drillDown) return null;

    if (drillDown.type === "risk-level") {
      const criticalReasons = riskReasons.filter((r) => r.severity === "critical");
      const warningReasons = riskReasons.filter((r) => r.severity === "warning");
      const infoReasons = riskReasons.filter((r) => r.severity === "info");
      return (
        <div className="space-y-4">
          {/* Summary metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Cash Runway</p>
              <p className={`text-lg font-bold ${runway >= 6 ? "text-green-600" : runway >= 3 ? "text-amber-500" : "text-red-500"}`}>
                {runway === Infinity ? "∞" : runway >= 1 ? `1:${Math.round(runway)}` : `1:${runway.toFixed(1)}`}
              </p>
              <p className="text-[9px] text-muted-foreground">Burn : Months Covered</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Coverage</p>
              <p className={`text-lg font-bold ${coverageRatio >= 1.5 ? "text-green-600" : coverageRatio >= 1 ? "text-amber-500" : "text-red-500"}`}>
                {coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Cash on Hand</p>
              <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Monthly Burn</p>
              <p className="text-sm font-bold text-red-500">{formatAmount(avgMonthlyBurn, currency)}</p>
            </div>
          </div>

          {/* Risk Level explanation */}
          <div className={`p-3 rounded-lg border-2 ${
            riskLevel.label === "Critical" ? "border-red-300 bg-red-50/50" :
            riskLevel.label === "High" ? "border-orange-300 bg-orange-50/50" :
            riskLevel.label === "Medium" ? "border-amber-300 bg-amber-50/50" :
            "border-green-300 bg-green-50/50"
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <div className={`w-3 h-3 rounded-full ${riskLevel.bg}`} />
              <span className={`text-sm font-bold ${riskLevel.color}`}>{riskLevel.label} Risk</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {riskLevel.label === "Critical" ? "Immediate action required. Cash position is dangerously low relative to burn rate and obligations." :
               riskLevel.label === "High" ? "Urgent attention needed. Cash reserves are below safe thresholds." :
               riskLevel.label === "Medium" ? "Monitor closely. Cash position is adequate but below optimal levels." :
               "Healthy liquidity. Cash reserves provide comfortable buffer against obligations."}
            </p>
          </div>

          {/* Reasons grouped by severity */}
          {criticalReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-2 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Critical Issues ({criticalReasons.length})
              </p>
              <div className="space-y-2">
                {criticalReasons.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-red-50/60 border border-red-200">
                    <p className="text-sm font-semibold text-red-700">{r.reason}</p>
                    <p className="text-xs text-red-600/80 mt-0.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {warningReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-600 mb-2 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" /> Warnings ({warningReasons.length})
              </p>
              <div className="space-y-2">
                {warningReasons.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200">
                    <p className="text-sm font-semibold text-amber-700">{r.reason}</p>
                    <p className="text-xs text-amber-600/80 mt-0.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {infoReasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-2 flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> Observations ({infoReasons.length})
              </p>
              <div className="space-y-2">
                {infoReasons.map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200">
                    <p className="text-sm font-semibold text-blue-700">{r.reason}</p>
                    <p className="text-xs text-blue-600/80 mt-0.5">{r.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thresholds reference */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <p className="text-xs font-medium mb-2">Risk Level Thresholds</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /><span><b>Critical:</b> Runway &lt; 2 months OR Coverage &lt; 0.5x</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500" /><span><b>High:</b> Runway &lt; 4 months OR Coverage &lt; 1.0x</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span><b>Medium:</b> Runway &lt; 6 months OR Coverage &lt; 1.5x</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /><span><b>Low:</b> Runway ≥ 6 months AND Coverage ≥ 1.5x</span></div>
            </div>
          </div>
        </div>
      );
    }

    if (drillDown.type === "cash") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total Cash on Hand</p>
            <p className="text-2xl font-bold text-primary">{formatAmount(totalBalance, currency)}</p>
          </div>
          {bankAccounts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Bank Accounts Breakdown</p>
              <div className="space-y-2">
                {bankAccounts.map((acc: any) => (
                  <div key={acc.id} className="flex items-center justify-between p-2.5 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{acc.account_name || acc.bank_name || "Account"}</p>
                      <p className="text-[10px] text-muted-foreground">{acc.bank_name} · {acc.account_number ? `···${acc.account_number.slice(-4)}` : ""}</p>
                    </div>
                    <span className="text-sm font-bold">{formatAmount(acc.current_balance || 0, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Cash Runway Ratio</p>
              <p className="text-sm font-bold">{runway === Infinity ? "∞" : runway >= 1 ? `1:${Math.round(runway)}` : `1:${runway.toFixed(1)}`}</p>
              <p className="text-[9px] text-muted-foreground">≈ {runway === Infinity ? "∞" : `${runway.toFixed(1)} months`}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Net Position</p>
              <p className={`text-sm font-bold ${totalBalance - totalObligations >= 0 ? "text-green-600" : "text-red-500"}`}>
                {formatAmount(totalBalance - totalObligations, currency)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (drillDown.type === "coverage") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Coverage Ratio (Cash / Payables)</p>
            <p className={`text-2xl font-bold ${coverageRatio >= 1.5 ? "text-green-600" : coverageRatio >= 1 ? "text-amber-500" : "text-red-500"}`}>
              {coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Cash (Numerator)</p>
              <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Payables (Denominator)</p>
              <p className="text-sm font-bold text-red-500">{formatAmount(totalObligations, currency)}</p>
            </div>
          </div>
          <div className={`p-3 rounded-lg border ${coverageRatio >= 1.5 ? "border-green-200 bg-green-50/50" : coverageRatio >= 1 ? "border-amber-200 bg-amber-50/50" : "border-red-200 bg-red-50/50"}`}>
            <p className="text-xs font-medium mb-1">What This Means</p>
            <p className="text-xs text-muted-foreground">
              {coverageRatio === Infinity ? "No outstanding payables — infinite coverage. Your cash is not tied to any upcoming obligations." :
               coverageRatio >= 1.5 ? `For every ${currency} 1 in payables, you have ${currency} ${coverageRatio.toFixed(2)} in cash. Strong position.` :
               coverageRatio >= 1 ? `Cash just barely covers payables. Any unexpected expense could create a shortfall.` :
               `Cash is insufficient to cover payables. You need ${formatAmount(totalObligations - totalBalance, currency)} more to fully cover outstanding obligations.`}
            </p>
          </div>
          {upcomingObligations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Outstanding Payables ({upcomingObligations.length})</p>
              <div className="space-y-1">
                {upcomingObligations.slice(0, 15).map((bill: any) => (
                  <div key={bill.id} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{bill.v2_vendors?.name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">{bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "No due date"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bill.daysUntilDue < 0 && <Badge variant="destructive" className="text-[9px]">{Math.abs(bill.daysUntilDue)}d late</Badge>}
                      <span className="font-semibold text-xs">{formatAmount(bill.total || 0, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "quick-ratio") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Quick Ratio (Cash + AR) / AP</p>
            <p className={`text-2xl font-bold ${quickRatio >= 1.5 ? "text-green-600" : quickRatio >= 1 ? "text-amber-500" : "text-red-500"}`}>
              {quickRatio === Infinity ? "∞" : `${quickRatio.toFixed(2)}x`}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Cash</p>
              <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Receivables</p>
              <p className="text-sm font-bold text-green-600">{formatAmount(expectedReceivables, currency)}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Payables</p>
              <p className="text-sm font-bold text-red-500">{formatAmount(totalObligations, currency)}</p>
            </div>
          </div>
          <div className="p-3 rounded-lg border bg-muted/30">
            <p className="text-xs font-medium mb-1">Formula</p>
            <p className="text-xs text-muted-foreground font-mono">
              ({formatAmount(totalBalance, currency)} + {formatAmount(expectedReceivables, currency)}) / {formatAmount(totalObligations || 1, currency)} = {quickRatio === Infinity ? "∞" : quickRatio.toFixed(2)}x
            </p>
          </div>
          <div className={`p-3 rounded-lg border ${quickRatio >= 1 ? "border-green-200 bg-green-50/50" : "border-red-200 bg-red-50/50"}`}>
            <p className="text-xs text-muted-foreground">
              {quickRatio === Infinity ? "No payables to cover — infinite quick ratio." :
               quickRatio >= 1.5 ? "Strong quick ratio. Liquid assets comfortably exceed current liabilities." :
               quickRatio >= 1 ? "Adequate quick ratio, but limited buffer for unexpected obligations." :
               `Quick ratio below 1.0x — even with all receivables collected, there's a ${formatAmount(totalObligations - totalBalance - expectedReceivables, currency)} shortfall.`}
            </p>
          </div>
          {unpaidInvoices.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Outstanding Receivables ({unpaidInvoices.length})</p>
              <div className="space-y-1">
                {unpaidInvoices.sort((a: any, b: any) => (b.total || 0) - (a.total || 0)).slice(0, 10).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{inv.v2_customers?.name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.invoice_number || "—"} · {inv.due_date ? format(new Date(inv.due_date), "dd MMM") : "No due date"}</p>
                    </div>
                    <span className="font-semibold text-xs text-green-600 shrink-0">{formatAmount(inv.total || 0, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "burn") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Average Monthly Burn</p>
            <p className="text-2xl font-bold text-red-500">{formatAmount(avgMonthlyBurn, currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Breakdown (last {monthlyOutflows.length} months)</p>
            <div className="space-y-2">
              {monthlyOutflows.map(([month, amount]) => {
                const inflow = monthlyInflows[month] || 0;
                const net = inflow - amount;
                return (
                  <div
                    key={month}
                    className="p-2.5 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setDrillDown({ type: "burn-month", title: format(new Date(month + "-01"), "MMMM yyyy"), description: "Monthly expense breakdown", data: { month } })}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{format(new Date(month + "-01"), "MMM yyyy")}</span>
                      <span className="text-sm font-bold text-red-500">{formatAmount(amount, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Inflow: {formatAmount(inflow, currency)}</span>
                      <span className={net >= 0 ? "text-green-600" : "text-red-500"}>Net: {net >= 0 ? "+" : ""}{formatAmount(net, currency)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 mt-1.5 overflow-hidden">
                      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.max((amount / Math.max(...monthlyOutflows.map(([, v]) => v))) * 100, 2)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Burn trend */}
          {monthlyOutflows.length >= 3 && (() => {
            const recent = monthlyOutflows.slice(-3).map(([, v]) => v);
            const older = monthlyOutflows.slice(0, -3).map(([, v]) => v);
            const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
            const olderAvg = older.length > 0 ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;
            const trendPct = olderAvg > 0 ? ((recentAvg / olderAvg - 1) * 100) : 0;
            return (
              <div className={`p-3 rounded-lg border ${trendPct > 20 ? "border-red-200 bg-red-50/50" : trendPct < -10 ? "border-green-200 bg-green-50/50" : "border-muted"}`}>
                <p className="text-xs font-medium mb-1">Burn Rate Trend</p>
                <p className="text-xs text-muted-foreground">
                  Recent 3-month avg: {formatAmount(recentAvg, currency)} ({trendPct > 0 ? "+" : ""}{trendPct.toFixed(0)}% vs earlier)
                </p>
              </div>
            );
          })()}
        </div>
      );
    }

    if (drillDown.type === "burn-month") {
      const month = drillDown.data?.month;
      if (!month) return null;
      const txns = getMonthExpenses(month);
      const catBreakdown: Record<string, number> = {};
      txns.forEach((t: any) => {
        const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
        catBreakdown[cat] = (catBreakdown[cat] || 0) + Math.abs(t.amount);
      });
      const totalMonth = Object.values(catBreakdown).reduce((s, v) => s + v, 0);
      const sortedCats = Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]);

      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500">{formatAmount(totalMonth, currency)}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Category Breakdown</p>
            <div className="space-y-2">
              {sortedCats.map(([cat, amt]) => (
                <div key={cat} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-medium truncate">{cat}</span>
                    <span className="text-[10px] text-muted-foreground">{totalMonth > 0 ? ((amt / totalMonth) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <span className="text-xs font-semibold text-red-500 shrink-0">{formatAmount(amt, currency)}</span>
                </div>
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Top Transactions ({txns.length})</p>
            <div className="space-y-1">
              {txns.map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                    <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-500 ml-2">{formatAmount(Math.abs(t.amount), currency)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    if (drillDown.type === "obligations") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total Outstanding</p>
            <p className="text-2xl font-bold text-red-500">{formatAmount(totalObligations, currency)}</p>
          </div>
          {upcomingObligations.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
              <p className="text-sm text-green-600 font-medium">No outstanding obligations</p>
            </div>
          ) : (
            <>
              {/* Aging summary */}
              {(() => {
                const overdue = upcomingObligations.filter((b: any) => b.daysUntilDue < 0);
                const within7 = upcomingObligations.filter((b: any) => b.daysUntilDue >= 0 && b.daysUntilDue <= 7);
                const within30 = upcomingObligations.filter((b: any) => b.daysUntilDue > 7 && b.daysUntilDue <= 30);
                const later = upcomingObligations.filter((b: any) => b.daysUntilDue > 30);
                return (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-red-50/60 border border-red-200 text-center">
                      <p className="text-[10px] text-red-600 uppercase">Overdue</p>
                      <p className="text-sm font-bold text-red-600">{overdue.length} ({formatAmount(overdue.reduce((s: number, b: any) => s + (b.total || 0), 0), currency)})</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200 text-center">
                      <p className="text-[10px] text-amber-600 uppercase">Due ≤ 7 days</p>
                      <p className="text-sm font-bold text-amber-600">{within7.length} ({formatAmount(within7.reduce((s: number, b: any) => s + (b.total || 0), 0), currency)})</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-blue-50/60 border border-blue-200 text-center">
                      <p className="text-[10px] text-blue-600 uppercase">Due ≤ 30 days</p>
                      <p className="text-sm font-bold text-blue-600">{within30.length} ({formatAmount(within30.reduce((s: number, b: any) => s + (b.total || 0), 0), currency)})</p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50 text-center">
                      <p className="text-[10px] text-muted-foreground uppercase">Due &gt; 30 days</p>
                      <p className="text-sm font-bold">{later.length} ({formatAmount(later.reduce((s: number, b: any) => s + (b.total || 0), 0), currency)})</p>
                    </div>
                  </div>
                );
              })()}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">All Obligations ({upcomingObligations.length})</p>
                <div className="space-y-1.5">
                  {upcomingObligations.map((bill: any) => (
                    <div key={bill.id} className="flex items-center justify-between py-1.5 px-2 rounded border hover:bg-muted/30">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate text-xs">{bill.v2_vendors?.name || "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground">{bill.due_date ? format(new Date(bill.due_date), "dd MMM yyyy") : "No due date"}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {bill.daysUntilDue < 0 ? (
                          <Badge variant="destructive" className="text-[9px]">{Math.abs(bill.daysUntilDue)}d late</Badge>
                        ) : bill.daysUntilDue <= 7 ? (
                          <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">{bill.daysUntilDue}d</Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{bill.daysUntilDue}d</span>
                        )}
                        <span className="font-semibold text-xs">{formatAmount(bill.total || 0, currency)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      );
    }

    if (drillDown.type === "receivables") {
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total Expected</p>
            <p className="text-2xl font-bold text-green-600">{formatAmount(expectedReceivables, currency)}</p>
          </div>
          {unpaidInvoices.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-center">
              <Banknote className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No outstanding receivables</p>
            </div>
          ) : (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Outstanding Invoices ({unpaidInvoices.length})</p>
              <div className="space-y-1.5">
                {unpaidInvoices.sort((a: any, b: any) => (b.total || 0) - (a.total || 0)).map((inv: any) => (
                  <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded border hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{inv.v2_customers?.name || "Unknown"}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.invoice_number || "—"} · Due: {inv.due_date ? format(new Date(inv.due_date), "dd MMM yyyy") : "N/A"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[9px]">{inv.status}</Badge>
                      <span className="font-semibold text-xs text-green-600">{formatAmount(inv.total || 0, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "obligations-timeline") {
      const overdueBills = upcomingObligations.filter((b: any) => b.daysUntilDue < 0);
      const dueSoon = upcomingObligations.filter((b: any) => b.daysUntilDue >= 0 && b.daysUntilDue <= 30);
      const dueLater = upcomingObligations.filter((b: any) => b.daysUntilDue > 30);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Cash on Hand</p>
              <p className="text-lg font-bold">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Total Due</p>
              <p className="text-lg font-bold text-red-500">{formatAmount(totalObligations, currency)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Net After Bills</p>
              <p className={`text-lg font-bold ${totalBalance - totalObligations >= 0 ? "text-green-600" : "text-red-500"}`}>
                {formatAmount(totalBalance - totalObligations, currency)}
              </p>
            </div>
          </div>

          {upcomingObligations.length === 0 ? (
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-green-700">No Outstanding Obligations</p>
                <p className="text-xs text-green-600 mt-1">
                  There are no unpaid bills or pending payables. Your entire cash balance of {formatAmount(totalBalance, currency)} is unencumbered and available.
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 border">
                <p className="text-xs font-medium mb-2">What This Means</p>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li>- All bills have been paid or are not yet due</li>
                  <li>- Cash runway is based purely on burn rate ({formatAmount(avgMonthlyBurn, currency)}/mo avg)</li>
                  <li>- At current burn rate, cash covers {runway === Infinity ? "unlimited" : `${runway.toFixed(1)} months`} of operations</li>
                  <li>- No immediate cash flow pressure from payables</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {overdueBills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-1.5">Overdue ({overdueBills.length})</p>
                  {overdueBills.map((b: any) => (
                    <div key={b.id} className="flex justify-between py-1.5 px-2 rounded border border-red-100 bg-red-50/50 mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{b.v2_vendors?.name || b.notes || "Bill"}</p>
                        <p className="text-[10px] text-red-500">{Math.abs(b.daysUntilDue)} days overdue</p>
                      </div>
                      <span className="text-xs font-bold text-red-600 shrink-0">{formatAmount(b.total || 0, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
              {dueSoon.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-600 mb-1.5">Due Within 30 Days ({dueSoon.length})</p>
                  {dueSoon.map((b: any) => (
                    <div key={b.id} className="flex justify-between py-1.5 px-2 rounded border mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{b.v2_vendors?.name || b.notes || "Bill"}</p>
                        <p className="text-[10px] text-muted-foreground">Due in {b.daysUntilDue} days</p>
                      </div>
                      <span className="text-xs font-bold shrink-0">{formatAmount(b.total || 0, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
              {dueLater.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Due Later ({dueLater.length})</p>
                  {dueLater.map((b: any) => (
                    <div key={b.id} className="flex justify-between py-1.5 px-2 rounded border mb-1">
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{b.v2_vendors?.name || b.notes || "Bill"}</p>
                        <p className="text-[10px] text-muted-foreground">Due in {b.daysUntilDue} days</p>
                      </div>
                      <span className="text-xs font-bold shrink-0">{formatAmount(b.total || 0, currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "coverage-trend") {
      const hasHistory = coverageHistory.filter((p) => p.ratio !== null).length > 0;
      const avgRatio = hasHistory
        ? coverageHistory.filter((p) => p.ratio !== null).reduce((s, p) => s + (p.ratio || 0), 0) / coverageHistory.filter((p) => p.ratio !== null).length
        : null;
      const minRatio = hasHistory
        ? Math.min(...coverageHistory.filter((p) => p.ratio !== null).map((p) => p.ratio!))
        : null;
      const maxRatio = hasHistory
        ? Math.max(...coverageHistory.filter((p) => p.ratio !== null).map((p) => p.ratio!))
        : null;

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Current</p>
              <p className={`text-lg font-bold ${coverageRatio >= 1.5 ? "text-green-600" : coverageRatio >= 1 ? "text-amber-500" : coverageRatio === Infinity ? "text-green-600" : "text-red-500"}`}>
                {coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
              </p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Cash</p>
              <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-[10px] text-muted-foreground uppercase">Payables</p>
              <p className="text-sm font-bold">{formatAmount(totalObligations, currency)}</p>
            </div>
          </div>

          {/* Explanation */}
          <div className={`p-3 rounded-lg border ${coverageRatio >= 1.5 ? "bg-green-50 border-green-200" : coverageRatio >= 1 ? "bg-amber-50 border-amber-200" : totalObligations === 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <p className="text-xs font-medium mb-1">
              {coverageRatio === Infinity ? "Full Coverage — No Payables" :
               coverageRatio >= 1.5 ? "Strong Coverage" :
               coverageRatio >= 1 ? "Adequate Coverage" :
               "Insufficient Coverage"}
            </p>
            <p className="text-xs text-muted-foreground">
              {totalObligations === 0
                ? `No outstanding payables. Your full cash balance of ${formatAmount(totalBalance, currency)} is available. Coverage ratio is infinite because there are no liabilities to cover.`
                : coverageRatio >= 1.5
                  ? `Cash of ${formatAmount(totalBalance, currency)} covers payables of ${formatAmount(totalObligations, currency)} ${coverageRatio.toFixed(1)} times over. This provides a healthy safety margin.`
                  : coverageRatio >= 1
                    ? `Cash of ${formatAmount(totalBalance, currency)} just covers payables of ${formatAmount(totalObligations, currency)}, but the safety margin is thin at ${coverageRatio.toFixed(2)}x. Target is 1.5x or above.`
                    : `Cash of ${formatAmount(totalBalance, currency)} is insufficient to cover payables of ${formatAmount(totalObligations, currency)}. Shortfall of ${formatAmount(totalObligations - totalBalance, currency)}. Immediate action needed.`}
            </p>
          </div>

          {/* Trend history */}
          {hasHistory && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">12-Month Trend</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded bg-muted/40">
                  <p className="text-[9px] text-muted-foreground uppercase">Avg</p>
                  <p className="text-xs font-bold">{avgRatio!.toFixed(2)}x</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/40">
                  <p className="text-[9px] text-muted-foreground uppercase">Min</p>
                  <p className="text-xs font-bold text-red-500">{minRatio!.toFixed(2)}x</p>
                </div>
                <div className="text-center p-2 rounded bg-muted/40">
                  <p className="text-[9px] text-muted-foreground uppercase">Max</p>
                  <p className="text-xs font-bold text-green-600">{maxRatio!.toFixed(2)}x</p>
                </div>
              </div>
              <div className="space-y-1">
                {coverageHistory.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/30">
                    <span className="text-muted-foreground">{p.month}</span>
                    <span className={`font-medium ${p.ratio === null ? "text-muted-foreground" : p.ratio >= 1.5 ? "text-green-600" : p.ratio >= 1 ? "text-amber-500" : "text-red-500"}`}>
                      {p.ratio !== null ? `${p.ratio.toFixed(2)}x` : "N/A"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thresholds reference */}
          <div className="p-3 rounded-lg bg-muted/30 border">
            <p className="text-xs font-medium mb-2">Coverage Ratio Guide</p>
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500" /><span><b>1.5x+</b> Strong — comfortable safety buffer</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /><span><b>1.0–1.5x</b> Adequate — can cover but tight</span></div>
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /><span><b>&lt;1.0x</b> Insufficient — cash cannot cover payables</span></div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      {/* Risk Summary — clickable */}
      <Card
        className="stat-card-hover cursor-pointer"
        onClick={() => setDrillDown({ type: "risk-level", title: `Liquidity Risk: ${riskLevel.label}`, description: "Detailed risk analysis with reasons" })}
      >
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Liquidity Risk Level
              </p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${riskLevel.bg}`} />
                <span className={`text-2xl font-bold ${riskLevel.color}`}>
                  {riskLevel.label}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">
                Cash Runway
              </p>
              <span
                className={`text-2xl font-bold ${runway >= 6 ? "text-green-600" : runway >= 3 ? "text-amber-500" : "text-red-500"}`}
              >
                {runway === Infinity
                  ? "∞"
                  : runway >= 1
                    ? `1:${Math.round(runway)}`
                    : `1:${runway.toFixed(1)}`}
              </span>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Burn : Months Covered
              </p>
            </div>
          </div>
          <Progress
            value={Math.min((runway / 12) * 100, 100)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Based on avg monthly burn of{" "}
            {formatAmount(avgMonthlyBurn, currency)} over last{" "}
            {monthlyOutflows.length} months
          </p>
          {/* Inline risk reason pills */}
          {riskReasons.filter((r) => r.severity !== "info").length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {riskReasons.filter((r) => r.severity === "critical").map((r, i) => (
                <Badge key={i} variant="destructive" className="text-[9px]">{r.reason}</Badge>
              ))}
              {riskReasons.filter((r) => r.severity === "warning").map((r, i) => (
                <Badge key={i} className="text-[9px] bg-amber-500 text-white hover:bg-amber-600 border-amber-500">{r.reason}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ratios — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Cash on Hand"
          value={formatAmount(totalBalance, currency)}
          icon={Wallet}
          color="text-primary"
          onClick={() => setDrillDown({ type: "cash", title: "Cash on Hand", description: "Bank account balances and cash position" })}
        />
        <KPICard
          label="Coverage Ratio"
          value={coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
          icon={ShieldAlert}
          color={coverageRatio >= 1.5 ? "text-green-600" : coverageRatio >= 1 ? "text-amber-500" : "text-red-500"}
          sub="Cash / Payables"
          onClick={() => setDrillDown({ type: "coverage", title: "Coverage Ratio", description: "Cash vs outstanding payables" })}
        />
        <KPICard
          label="Quick Ratio"
          value={quickRatio === Infinity ? "∞" : `${quickRatio.toFixed(2)}x`}
          icon={Activity}
          color={quickRatio >= 1.5 ? "text-green-600" : quickRatio >= 1 ? "text-amber-500" : "text-red-500"}
          sub="(Cash + AR) / AP"
          onClick={() => setDrillDown({ type: "quick-ratio", title: "Quick Ratio", description: "(Cash + Receivables) / Payables" })}
        />
        <KPICard
          label="Monthly Burn"
          value={formatAmount(avgMonthlyBurn, currency)}
          icon={TrendingDown}
          color="text-red-500"
          sub={`${monthlyOutflows.length}-month avg`}
          onClick={() => setDrillDown({ type: "burn", title: "Monthly Burn Rate", description: `${monthlyOutflows.length}-month average: ${formatAmount(avgMonthlyBurn, currency)}` })}
        />
      </div>

      {/* Obligations & Receivables — clickable */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          className="stat-card-hover cursor-pointer"
          onClick={() => setDrillDown({ type: "obligations", title: "Upcoming Obligations", description: `${upcomingObligations.length} outstanding payables` })}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-red-600">
                Upcoming Obligations
              </CardTitle>
              <Badge variant="destructive" className="text-[10px]">
                {formatAmount(totalObligations, currency)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {upcomingObligations.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-green-600 font-medium">
                  No outstanding obligations
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {upcomingObligations.slice(0, 10).map((bill: any) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between text-sm py-1.5 border-b border-muted last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-xs truncate">
                        {bill.v2_vendors?.name || "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {bill.due_date
                          ? format(new Date(bill.due_date), "dd MMM yyyy")
                          : "No due date"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {bill.daysUntilDue < 0 ? (
                        <Badge variant="destructive" className="text-[9px]">
                          {Math.abs(bill.daysUntilDue)}d late
                        </Badge>
                      ) : bill.daysUntilDue <= 7 ? (
                        <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">
                          {bill.daysUntilDue}d
                        </Badge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {bill.daysUntilDue}d
                        </span>
                      )}
                      <span className="font-semibold text-xs">
                        {formatAmount(bill.total || 0, currency)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          className="stat-card-hover cursor-pointer"
          onClick={() => setDrillDown({ type: "receivables", title: "Expected Receivables", description: `${unpaidInvoices.length} outstanding invoices` })}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-green-600">
                Expected Receivables
              </CardTitle>
              <Badge
                variant="outline"
                className="text-[10px] text-green-600 border-green-200"
              >
                {formatAmount(expectedReceivables, currency)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {unpaidInvoices.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <Banknote className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No outstanding receivables
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {unpaidInvoices
                  .sort((a: any, b: any) => (b.total || 0) - (a.total || 0))
                  .slice(0, 10)
                  .map((inv: any) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between text-sm py-1.5 border-b border-muted last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-xs truncate">
                          {inv.v2_customers?.name || "Unknown"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {inv.invoice_number || "—"} ·{" "}
                          {inv.due_date
                            ? format(new Date(inv.due_date), "dd MMM")
                            : "No due date"}
                        </p>
                      </div>
                      <span className="font-semibold text-xs text-green-600 shrink-0">
                        {formatAmount(inv.total || 0, currency)}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Burn Rate Trend — clickable bars */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Monthly Burn Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlyOutflows.length === 0 ? (
            <EmptyChart text="No outflow data" />
          ) : (
            <div className="space-y-2">
              {monthlyOutflows.map(([month, amount]) => {
                const maxBurn = Math.max(
                  ...monthlyOutflows.map(([, v]) => v),
                );
                const pct = maxBurn > 0 ? (amount / maxBurn) * 100 : 0;
                return (
                  <div
                    key={month}
                    className="space-y-1 cursor-pointer hover:bg-muted/30 rounded-lg p-1 -m-1 transition-colors"
                    onClick={() => setDrillDown({ type: "burn-month", title: format(new Date(month + "-01"), "MMMM yyyy"), description: "Monthly expense breakdown", data: { month } })}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(month + "-01"), "MMM yyyy")}
                      </span>
                      <span className="font-semibold text-xs">
                        {formatAmount(amount, currency)}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all bg-red-400"
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <Separator className="my-2" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Average</span>
                <span className="font-bold text-red-500">
                  {formatAmount(avgMonthlyBurn, currency)}/mo
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Obligations Timeline (90-day projected cash) */}
      <Card
        className="stat-card-hover chart-enter cursor-pointer"
        onClick={() => setDrillDown({ type: "obligations-timeline", title: "90-Day Obligations Timeline", description: "Projected cash position over next 90 days" })}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              90-Day Obligations Timeline
            </CardTitle>
            {dangerDate ? (
              <Badge variant="destructive" className="text-[10px]">
                Balance goes negative: {dangerDate}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                {upcomingObligations.length === 0 ? "No upcoming bills" : `${upcomingObligations.length} pending`}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {upcomingObligations.length === 0 ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-green-50 border border-green-100">
                  <p className="text-[10px] text-muted-foreground uppercase">Obligations</p>
                  <p className="text-lg font-bold text-green-600">0</p>
                  <p className="text-[10px] text-muted-foreground">next 90 days</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Cash on Hand</p>
                  <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Runway</p>
                  <p className="text-sm font-bold">{runway === Infinity ? "∞" : runway >= 1 ? `1:${Math.round(runway)}` : `1:${runway.toFixed(1)}`}</p>
                </div>
              </div>
              <p className="text-xs text-green-600 text-center">
                No outstanding bills due in the next 90 days. Cash position is unencumbered.
              </p>
            </div>
          ) : (
            <ChartContainer config={timelineConfig} className="h-[220px] w-full">
              <AreaChart data={obligationsTimeline} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(143 44% 28%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(143 44% 28%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dangerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 84% 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0 84% 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatAmount(Number(value), currency)} />} />
                <ReferenceLine y={0} stroke="hsl(0 84% 55%)" strokeDasharray="4 4" strokeWidth={2} />
                <Area type="monotone" dataKey="balance" stroke="hsl(143 44% 28%)" fill="url(#balanceGrad)" strokeWidth={2} name="Projected Balance" />
                <Area type="monotone" dataKey="obligation" stroke="hsl(0 84% 55%)" fill="url(#dangerGrad)" strokeWidth={1.5} strokeDasharray="4 4" name="Cumulative Obligations" />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Coverage Ratio Trend (12 months) */}
      <Card
        className="stat-card-hover chart-enter cursor-pointer"
        onClick={() => setDrillDown({ type: "coverage-trend", title: "Coverage Ratio Trend", description: "12-month trend of Cash / Payables ratio" })}
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Coverage Ratio Trend (12 Months)
            </CardTitle>
            <Badge variant="outline" className={`text-[10px] ${coverageRatio >= 1.5 ? "text-green-600 border-green-200" : coverageRatio >= 1 ? "text-amber-500 border-amber-200" : "text-red-500 border-red-200"}`}>
              Current: {coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {coverageHistory.filter((p) => p.ratio !== null).length === 0 ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Cash</p>
                  <p className="text-sm font-bold">{formatAmount(totalBalance, currency)}</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Payables</p>
                  <p className="text-sm font-bold">{formatAmount(totalObligations, currency)}</p>
                </div>
                <div className="text-center p-2.5 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase">Ratio</p>
                  <p className={`text-sm font-bold ${coverageRatio >= 1.5 ? "text-green-600" : coverageRatio >= 1 ? "text-amber-500" : coverageRatio === Infinity ? "text-green-600" : "text-red-500"}`}>
                    {coverageRatio === Infinity ? "∞" : `${coverageRatio.toFixed(2)}x`}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {totalObligations === 0
                  ? "No outstanding payables — coverage ratio is infinite. Cash is fully available."
                  : `Coverage of ${coverageRatio.toFixed(2)}x means cash ${coverageRatio >= 1 ? "can" : "cannot"} fully cover outstanding payables.`}
              </p>
            </div>
          ) : (
            <ChartContainer config={coverageConfig} className="h-[200px] w-full">
              <LineChart data={coverageHistory} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, "auto"]} tickFormatter={(v) => `${v}x`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => value !== null ? `${Number(value).toFixed(2)}x` : "N/A"} />} />
                <ReferenceLine y={1} stroke="hsl(0 84% 55%)" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: "1.0x Min", position: "right", fontSize: 10, fill: "hsl(0 84% 55%)" }} />
                <Line type="monotone" dataKey="ratio" stroke="hsl(210 80% 55%)" strokeWidth={2} dot={{ r: 3 }} connectNulls name="Coverage Ratio" />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

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

// ── Transactions Tab ──────────────────────────────────────────────────────

function RecentTransactionsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [drillDown, setDrillDown] = useState<{title: string; description?: string; transactions: any[]} | null>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["cash-recent-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const sorted = useMemo(() => {
    let list = [...transactions].sort((a: any, b: any) =>
      (b.transaction_date || "").localeCompare(a.transaction_date || ""),
    );
    if (filter === "in") list = list.filter((t: any) => t.amount > 0);
    if (filter === "out") list = list.filter((t: any) => t.amount < 0);
    return list.slice(0, 100);
  }, [transactions, filter]);

  const totalIn = useMemo(
    () =>
      transactions
        .filter((t: any) => t.amount > 0)
        .reduce((s: number, t: any) => s + t.amount, 0),
    [transactions],
  );
  const totalOut = useMemo(
    () =>
      transactions
        .filter((t: any) => t.amount < 0)
        .reduce((s: number, t: any) => s + Math.abs(t.amount), 0),
    [transactions],
  );

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Transactions</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Transactions appear after uploading bank statements.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary + Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total Inflow"
          value={formatAmount(totalIn, currency)}
          icon={TrendingUp}
          color="text-green-600"
          onClick={() => setDrillDown({ title: "Inflows", description: "All income transactions", transactions: transactions.filter((t: any) => t.amount > 0) })}
        />
        <KPICard
          label="Total Outflow"
          value={formatAmount(totalOut, currency)}
          icon={TrendingDown}
          color="text-red-500"
          onClick={() => setDrillDown({ title: "Outflows", description: "All expense transactions", transactions: transactions.filter((t: any) => t.amount < 0) })}
        />
        <KPICard
          label="Transactions"
          value={transactions.length.toString()}
          icon={ArrowRightLeft}
          color="text-primary"
          sub={`${sorted.length} shown`}
          onClick={() => setDrillDown({ title: "All Transactions", description: "Complete transaction list", transactions })}
        />
      </div>

      <Card>
        <CardContent className="p-3 flex items-center gap-3">
          {(
            [
              { key: "all", label: "All" },
              { key: "in", label: "Inflows" },
              { key: "out", label: "Outflows" },
            ] as const
          ).map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">
            {sorted.length} transaction{sorted.length !== 1 && "s"}
          </span>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((t: any, idx: number) => (
                <TableRow key={t.id || idx}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {t.transaction_date
                      ? format(new Date(t.transaction_date), "dd MMM yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[280px] truncate">
                    {t.description || "—"}
                  </TableCell>
                  <TableCell>
                    {t.category && (
                      <Badge variant="outline" className="text-[10px]">
                        {t.category}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold text-sm ${
                      t.amount >= 0 ? "text-green-600" : "text-red-500"
                    }`}
                  >
                    {t.amount >= 0 ? "+" : ""}
                    {formatAmount(Math.abs(t.amount), currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <TransactionDetailSheet
        open={!!drillDown}
        onOpenChange={(open) => !open && setDrillDown(null)}
        title={drillDown?.title ?? ""}
        description={drillDown?.description}
        transactions={drillDown?.transactions ?? []}
      />
    </div>
  );
}

// ── Cash Ledger Tab ──────────────────────────────────────────────────────

// Category icon + color mapping for ledger
const CATEGORY_STYLE: Record<string, { icon: React.ComponentType<{className?: string}>; border: string; bg: string }> = {
  "ATM & Cash Deposits": { icon: Coins, border: "border-l-teal-400", bg: "bg-teal-50" },
  "ATM & Withdrawals": { icon: Banknote, border: "border-l-red-400", bg: "bg-red-50" },
  "Business Income": { icon: Building2, border: "border-l-emerald-500", bg: "bg-emerald-50" },
  "Finance & Banking": { icon: Landmark, border: "border-l-green-500", bg: "bg-green-50" },
  "Food & Beverage": { icon: Utensils, border: "border-l-rose-400", bg: "bg-rose-50" },
  "Internal Transfer": { icon: Shuffle, border: "border-l-gray-400", bg: "bg-gray-50" },
  "Retail & Shopping": { icon: ShoppingCart, border: "border-l-blue-500", bg: "bg-blue-50" },
  "Transportation & Logistics": { icon: Bus, border: "border-l-orange-400", bg: "bg-orange-50" },
  "Utilities": { icon: Zap, border: "border-l-yellow-500", bg: "bg-yellow-50" },
  "Technology": { icon: Monitor, border: "border-l-purple-500", bg: "bg-purple-50" },
  "Healthcare": { icon: Stethoscope, border: "border-l-pink-400", bg: "bg-pink-50" },
  "Entertainment & Media": { icon: Music, border: "border-l-indigo-400", bg: "bg-indigo-50" },
  "Education": { icon: GraduationCap, border: "border-l-cyan-500", bg: "bg-cyan-50" },
  "Travel & Hospitality": { icon: Plane, border: "border-l-sky-400", bg: "bg-sky-50" },
  "Real Estate": { icon: Home, border: "border-l-amber-500", bg: "bg-amber-50" },
  "Insurance": { icon: Shield, border: "border-l-slate-400", bg: "bg-slate-50" },
  "Professional Services": { icon: Briefcase, border: "border-l-violet-400", bg: "bg-violet-50" },
  "Manufacturing": { icon: Factory, border: "border-l-stone-500", bg: "bg-stone-50" },
  "Government": { icon: Building2, border: "border-l-red-400", bg: "bg-red-50" },
  "Salary & Wages": { icon: CreditCard, border: "border-l-lime-500", bg: "bg-lime-50" },
  "Other": { icon: HelpCircle, border: "border-l-neutral-400", bg: "bg-neutral-50" },
};

function getCategoryStyle(name: string) {
  return CATEGORY_STYLE[name] || { icon: HelpCircle, border: "border-l-neutral-400", bg: "bg-neutral-50" };
}

function CashLedgerTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [searchFilter, setSearchFilter] = useState("");
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryStep, setAddCategoryStep] = useState<"input" | "sync">("input");
  const [syncing, setSyncing] = useState(false);

  const { data: customCategories = [] } = useQuery({
    queryKey: ["custom-categories"],
    queryFn: () => flaskApi.get<any[]>("/categories"),
  });

  const allCategories = useMemo(() => {
    const predefined = PREDEFINED_SECTORS.map((s) => s.name);
    const custom = customCategories.map((c: any) => c.name);
    return [...new Set([...predefined, ...custom])].sort();
  }, [customCategories]);

  const handleChangeCategory = async (txnId: string, newCategory: string) => {
    try {
      await database.updateTransactionCategory(txnId, newCategory);
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-txns"] });
      toast.success("Category updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update category");
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      await flaskApi.post("/categories", { name: newCategoryName.trim(), type: "all" });
      queryClient.invalidateQueries({ queryKey: ["custom-categories"] });
      setAddCategoryStep("sync");
    } catch (err: any) {
      toast.error(err.message || "Failed to create category");
    }
  };

  const handleSyncCategory = async () => {
    if (!clientId || !newCategoryName.trim()) return;
    setSyncing(true);
    try {
      const result = await database.syncCategoryByKeywords(
        clientId,
        newCategoryName.trim(),
        [newCategoryName.trim().toLowerCase()],
      );
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-txns"] });
      toast.success(
        `Synced: ${result.transactions_updated} transactions, ${result.bills_updated} bills moved to "${newCategoryName.trim()}"`,
      );
      setShowAddCategory(false);
      setNewCategoryName("");
      setAddCategoryStep("input");
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const { data: transactions = [] } = useQuery({
    queryKey: ["cash-ledger-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 10000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const ledger = useMemo(() => {
    const accounts: Record<string, { inflow: number; outflow: number; net: number; txns: any[] }> = {};

    transactions.forEach((t: any) => {
      let cat: string;
      if (t.amount > 0) {
        // Income: use resolveIncomeCategory (matches Revenue Integrity page)
        cat = resolveIncomeCategory(t.category, t.description, businessSector) || "Business Income";
      } else {
        // Expense: use getCanonicalCategory (matches Expense Integrity page)
        cat = getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "Uncategorized";
      }
      if (!accounts[cat]) accounts[cat] = { inflow: 0, outflow: 0, net: 0, txns: [] };
      if (t.amount > 0) {
        accounts[cat].inflow += t.amount;
      } else {
        accounts[cat].outflow += Math.abs(t.amount);
      }
      accounts[cat].net += t.amount;
      accounts[cat].txns.push(t);
    });

    return Object.entries(accounts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!searchFilter.trim()) return ledger;
    const q = searchFilter.toLowerCase();
    return ledger.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.txns.some((t: any) => (t.description || "").toLowerCase().includes(q))
    );
  }, [ledger, searchFilter]);

  const totalInflow = useMemo(() => ledger.reduce((s, a) => s + a.inflow, 0), [ledger]);
  const totalOutflow = useMemo(() => ledger.reduce((s, a) => s + a.outflow, 0), [ledger]);
  const totalNet = totalInflow - totalOutflow;
  const totalEntries = transactions.length;

  const toggleAccount = (name: string) => {
    setExpandedAccounts((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Ledger Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements to see your cash flow ledger by category.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Left Sidebar — Summary KPIs */}
      <div className="w-full lg:w-[280px] shrink-0 space-y-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Entries</span>
              <BookOpen className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-bold">{totalEntries}</p>
            <p className="text-xs text-muted-foreground">in date range</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Debits</span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-bold">{formatAmount(totalOutflow, currency)}</p>
            <p className="text-xs text-muted-foreground">Db side</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Total Credits</span>
              <ArrowDownRight className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className="text-2xl font-bold text-green-600">{formatAmount(totalInflow, currency)}</p>
            <p className="text-xs text-muted-foreground">Cr side</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">Net Balance</span>
              <Activity className="h-4 w-4 text-muted-foreground/60" />
            </div>
            <p className={`text-2xl font-bold ${totalNet >= 0 ? "text-green-600" : "text-red-500"}`}>
              {formatAmount(Math.abs(totalNet), currency)}
              <span className="text-sm font-normal ml-1">{totalNet >= 0 ? "Cr" : "Db"}</span>
            </p>
            <p className="text-xs text-muted-foreground">Db - Cr</p>
          </CardContent>
        </Card>
      </div>

      {/* Right Content — Category Cards */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Search + Count */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Filter ${totalEntries} entries...`}
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5 shrink-0"
            onClick={() => { setShowAddCategory(true); setAddCategoryStep("input"); setNewCategoryName(""); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Category
          </Button>
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {filtered.reduce((s, a) => s + a.txns.length, 0)} entries
          </span>
        </div>

        {/* Category Rows */}
        <div className="space-y-2">
          {filtered.map((account) => {
            const style = getCategoryStyle(account.name);
            const Icon = style.icon;
            const isExpanded = expandedAccounts[account.name];

            return (
              <div key={account.name}>
                <div
                  className={`rounded-lg border-l-4 ${style.border} bg-card shadow-sm cursor-pointer hover:shadow-md transition-shadow`}
                  onClick={() => toggleAccount(account.name)}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    {/* Icon */}
                    <div className={`rounded-md p-1.5 ${style.bg}`}>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>

                    {/* Category Name + Badge */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{account.name}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {account.txns.length} txns
                      </Badge>
                    </div>

                    {/* Db / Cr amounts */}
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      <Badge variant="outline" className="text-xs font-mono">
                        Db {account.outflow > 0 ? formatAmount(account.outflow, currency) : "—"}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-mono text-green-600 border-green-200">
                        Cr {account.inflow > 0 ? formatAmount(account.inflow, currency) : "—"}
                      </Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>

                {/* Expanded Transactions */}
                {isExpanded && (
                  <Card className="mt-1 ml-6 border-dashed">
                    <CardContent className="p-0 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-xs text-right">Debit (Db)</TableHead>
                            <TableHead className="text-xs text-right">Credit (Cr)</TableHead>
                            <TableHead className="text-xs">Category</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {account.txns
                            .sort((a: any, b: any) => (b.transaction_date || "").localeCompare(a.transaction_date || ""))
                            .slice(0, 50)
                            .map((t: any, idx: number) => (
                            <TableRow key={t.id || idx} className="hover:bg-muted/30">
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-2">
                                {t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yyyy") : "—"}
                              </TableCell>
                              <TableCell className="text-xs py-2 max-w-[280px] truncate">
                                {t.description || "—"}
                              </TableCell>
                              <TableCell className="text-xs text-right py-2 font-mono">
                                {t.amount < 0 ? <span className="text-foreground">{formatAmount(Math.abs(t.amount), currency)}</span> : ""}
                              </TableCell>
                              <TableCell className="text-xs text-right py-2 font-mono">
                                {t.amount > 0 ? <span className="text-green-600">{formatAmount(t.amount, currency)}</span> : ""}
                              </TableCell>
                              <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                                <Select
                                  value={account.name}
                                  onValueChange={(val) => handleChangeCategory(t.id, val)}
                                >
                                  <SelectTrigger className="h-7 text-[10px] w-[130px] border-dashed">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allCategories.map((cat) => (
                                      <SelectItem key={cat} value={cat} className="text-xs">
                                        {cat}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                          {account.txns.length > 50 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-2">
                                +{account.txns.length - 50} more transactions
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals Row */}
        <div className="rounded-lg bg-muted/30 border px-4 py-3 flex items-center justify-end gap-3">
          <span className="text-sm font-semibold mr-auto">Totals</span>
          <Badge variant="outline" className="text-xs font-mono font-semibold">
            Db {formatAmount(totalOutflow, currency)}
          </Badge>
          <Badge variant="outline" className="text-xs font-mono font-semibold text-green-600 border-green-200">
            Cr {formatAmount(totalInflow, currency)}
          </Badge>
        </div>
      </div>

      {/* Add Category Dialog */}
      <Dialog open={showAddCategory} onOpenChange={(open) => {
        if (!open) { setShowAddCategory(false); setAddCategoryStep("input"); setNewCategoryName(""); }
      }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{addCategoryStep === "input" ? "Add New Category" : "Sync Data?"}</DialogTitle>
            <DialogDescription>
              {addCategoryStep === "input"
                ? "Enter a category name. After creation you can sync matching transactions."
                : `Category "${newCategoryName}" created. Sync existing transactions that match "${newCategoryName.toLowerCase()}" in their description?`}
            </DialogDescription>
          </DialogHeader>
          {addCategoryStep === "input" ? (
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-cat-name">Category Name</Label>
                <Input
                  id="new-cat-name"
                  placeholder="e.g. Cafe, Printing, Parking"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddCategory(false)}>Cancel</Button>
                <Button size="sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-muted-foreground">
                This will search all transactions for &quot;{newCategoryName.toLowerCase()}&quot; in descriptions
                and move them to the <strong>{newCategoryName}</strong> category.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  setShowAddCategory(false); setAddCategoryStep("input"); setNewCategoryName("");
                  toast.success(`Category "${newCategoryName}" created`);
                }}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleSyncCategory} disabled={syncing}>
                  {syncing ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Syncing...</> : "Sync Now"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
  sub,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  trend?: number;
  sub?: string;
  onClick?: () => void;
}) {
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
              className={`text-xs flex items-center gap-0.5 ${trend > 0 ? "text-green-600" : "text-red-500"}`}
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

// ── Main Page ─────────────────────────────────────────────────────────────

export default function CashLiquidity() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Cash & Liquidity
          </h1>
          <p className="text-muted-foreground">
            Financial stability monitoring — bank balances, cash flow analysis,
            and liquidity risk.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <Droplets className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-1.5">
              <Landmark className="h-3.5 w-3.5" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="risk" className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Liquidity Risk
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-1.5">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="ledger" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Ledger
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <CashOverviewTab />
          </TabsContent>
          <TabsContent value="accounts" className="mt-4">
            <BankAccountsTab />
          </TabsContent>
          <TabsContent value="risk" className="mt-4">
            <LiquidityRiskTab />
          </TabsContent>
          <TabsContent value="transactions" className="mt-4">
            <RecentTransactionsTab />
          </TabsContent>
          <TabsContent value="ledger" className="mt-4">
            <CashLedgerTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
