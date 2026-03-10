import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ReferenceLine,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Wallet,
  BarChart3,
  CircleDot,
  Eye,
  Calendar,
  ShieldAlert,
  ArrowRightLeft,
  Zap,
  FileWarning,
  Plus,
  Copy,
  Download,
  Trash2,
  Send,
  LayoutGrid,
  List,
  Pencil,
  Building2,
  Palette,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useDateRange } from "@/hooks/useDateRange";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { format, subMonths, differenceInDays, isAfter, parseISO } from "date-fns";
import { resolveIncomeCategory } from "@/lib/sectorMapping";
import { toast } from "sonner";
import { LineChart, Line } from "recharts";

// ── Revenue Overview Tab ──────────────────────────────────────────────────

function RevenueOverviewTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate, endDate } = useDateRange();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [drillDown, setDrillDown] = useState<{
    type: "revenue" | "outstanding" | "overdue" | "collection" | null;
    title: string;
    description?: string;
    transactions: any[];
  } | null>(null);
  const [chartDrill, setChartDrill] = useState<{ title: string; description?: string; items: any[] } | null>(null);

  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ["revenue-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: customers = [] } = useQuery({
    queryKey: ["revenue-customers", clientId],
    queryFn: () => database.getCustomers(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [], isLoading: txnLoading } = useQuery({
    queryKey: ["revenue-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string; limit: number } = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  // ── Derived Metrics ──

  const incomeTxns = useMemo(
    () => transactions.filter((t: any) => t.amount > 0),
    [transactions],
  );

  const totalRevenue = useMemo(
    () => incomeTxns.reduce((s: number, t: any) => s + t.amount, 0),
    [incomeTxns],
  );

  const totalInvoiced = useMemo(
    () => invoices.reduce((s: number, i: any) => s + (i.total || 0), 0),
    [invoices],
  );

  const paidInvoices = useMemo(
    () => invoices.filter((i: any) => i.status === "paid"),
    [invoices],
  );
  const overdueInvoices = useMemo(
    () => invoices.filter((i: any) => i.status === "overdue"),
    [invoices],
  );
  const pendingInvoices = useMemo(
    () => invoices.filter((i: any) => i.status === "sent" || i.status === "draft"),
    [invoices],
  );

  const pendingAmount = useMemo(
    () =>
      invoices
        .filter((i: any) => i.status !== "paid" && i.status !== "cancelled")
        .reduce((s: number, i: any) => s + (i.total || 0), 0),
    [invoices],
  );

  const overdueAmount = useMemo(
    () => overdueInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0),
    [overdueInvoices],
  );

  const collectionRate = useMemo(() => {
    if (invoices.length === 0) return 0;
    return (paidInvoices.length / invoices.length) * 100;
  }, [invoices, paidInvoices]);

  // Monthly revenue trend (12 months)
  const monthlyTrend = useMemo(() => {
    const months: Record<string, number> = {};
    incomeTxns.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key) months[key] = (months[key] || 0) + t.amount;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, amount]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        revenue: amount,
      }));
  }, [incomeTxns]);

  // Dual-line comparison: current period vs previous period
  const dualLineTrend = useMemo(() => {
    if (!startDate || !endDate) return [];
    const startD = new Date(startDate + "T00:00:00");
    const endD = new Date(endDate + "T00:00:00");
    if (isNaN(startD.getTime()) || isNaN(endD.getTime())) return [];
    const durationMs = endD.getTime() - startD.getTime();
    const prevStartD = new Date(startD.getTime() - durationMs);

    const currentMonths: Record<string, number> = {};
    const prevMonths: Record<string, number> = {};

    incomeTxns.forEach((t: any) => {
      const d = t.transaction_date;
      if (!d) return;
      const key = d.slice(0, 7);
      if (d >= startDate && d <= endDate) {
        currentMonths[key] = (currentMonths[key] || 0) + t.amount;
      }
      const prevEnd = format(startD, "yyyy-MM-dd");
      const prevStart = format(prevStartD, "yyyy-MM-dd");
      if (d >= prevStart && d < prevEnd) {
        prevMonths[key] = (prevMonths[key] || 0) + t.amount;
      }
    });

    const currentSorted = Object.entries(currentMonths).sort(([a], [b]) => a.localeCompare(b));
    const prevSorted = Object.entries(prevMonths).sort(([a], [b]) => a.localeCompare(b));

    const maxLen = Math.max(currentSorted.length, prevSorted.length);
    const data: { label: string; current: number; previous: number }[] = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        label: currentSorted[i] ? format(new Date(currentSorted[i][0] + "-01"), "MMM yy") : prevSorted[i] ? format(new Date(prevSorted[i][0] + "-01"), "MMM yy") : "",
        current: currentSorted[i]?.[1] || 0,
        previous: prevSorted[i]?.[1] || 0,
      });
    }
    return data;
  }, [incomeTxns, startDate, endDate]);

  // Revenue this month vs last month
  const thisMonth = format(new Date(), "yyyy-MM");
  const lastMonth = format(subMonths(new Date(), 1), "yyyy-MM");
  const revenueThisMonth = useMemo(
    () =>
      incomeTxns
        .filter((t: any) => t.transaction_date?.startsWith(thisMonth))
        .reduce((s: number, t: any) => s + t.amount, 0),
    [incomeTxns, thisMonth],
  );
  const revenueLastMonth = useMemo(
    () =>
      incomeTxns
        .filter((t: any) => t.transaction_date?.startsWith(lastMonth))
        .reduce((s: number, t: any) => s + t.amount, 0),
    [incomeTxns, lastMonth],
  );
  const monthTrend = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
    : 0;

  // Invoice status donut
  const statusDonutConfig: ChartConfig = {
    paid: { label: "Paid", color: "hsl(143 44% 28%)" },
    sent: { label: "Sent", color: "hsl(210 80% 55%)" },
    overdue: { label: "Overdue", color: "hsl(0 84% 60%)" },
    draft: { label: "Draft", color: "hsl(215 20% 65%)" },
  };
  const statusDonutData = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((i: any) => {
      const s = i.status || "draft";
      counts[s] = (counts[s] || 0) + 1;
    });
    const colors: Record<string, string> = {
      paid: "hsl(143 44% 28%)",
      sent: "hsl(210 80% 55%)",
      overdue: "hsl(0 84% 60%)",
      draft: "hsl(215 20% 65%)",
      cancelled: "hsl(0 0% 70%)",
    };
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: colors[name] || "hsl(215 20% 65%)",
    }));
  }, [invoices]);

  // Top customers by revenue
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; total: number; count: number; pending: number }> = {};
    invoices.forEach((i: any) => {
      const name = i.v2_customers?.name || "Unknown";
      if (!map[name]) map[name] = { name, total: 0, count: 0, pending: 0 };
      map[name].total += i.total || 0;
      map[name].count += 1;
      if (i.status !== "paid" && i.status !== "cancelled") {
        map[name].pending += i.total || 0;
      }
    });
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [invoices]);

  // Revenue by category
  const revenueByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((i: any) => {
      const cat = resolveIncomeCategory(i.category, i.v2_customers?.name, businessSector) || "Other";
      map[cat] = (map[cat] || 0) + (i.total || 0);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([name, value]) => ({ name, value }));
  }, [invoices, businessSector]);

  // Lookup: category → income transactions (for chart drill-down)
  const txnsByCategory = useMemo(() => {
    const map: Record<string, any[]> = {};
    incomeTxns.forEach((t: any) => {
      const cat = resolveIncomeCategory(t.category, t.counterparty_name || t.description, businessSector) || "Other";
      if (!map[cat]) map[cat] = [];
      map[cat].push(t);
    });
    return map;
  }, [incomeTxns]);

  // Lookup: month key → income transactions (for trend chart drill-down)
  const txnsByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    incomeTxns.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key) {
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [incomeTxns]);

  const categoryChartConfig: ChartConfig = {
    value: { label: "Revenue", color: "hsl(143 44% 22%)" },
  };

  const trendChartConfig: ChartConfig = {
    revenue: { label: "Revenue", color: "hsl(143 44% 22%)" },
  };

  const isLoading = invLoading || txnLoading;
  const hasData = invoices.length > 0 || incomeTxns.length > 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Revenue Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            Upload a bank statement or create invoices to see your revenue
            overview, trends, and customer insights.
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
          label="Total Revenue"
          value={formatAmount(totalRevenue, currency)}
          icon={DollarSign}
          color="text-primary"
          trend={monthTrend}
          onClick={() => setDrillDown({ type: "revenue", title: "Total Revenue Breakdown", description: `${incomeTxns.length} income transactions in period`, transactions: incomeTxns })}
        />
        <KPICard
          label="Outstanding"
          value={formatAmount(pendingAmount, currency)}
          icon={Clock}
          color={pendingAmount > 0 ? "text-amber-500" : "text-green-600"}
          sub={`${pendingInvoices.length} invoices`}
          onClick={() => setDrillDown({ type: "outstanding", title: "Outstanding Receivables", description: "Unpaid invoices awaiting collection", transactions: invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled") })}
        />
        <KPICard
          label="Overdue"
          value={formatAmount(overdueAmount, currency)}
          icon={AlertTriangle}
          color={overdueAmount > 0 ? "text-red-500" : "text-green-600"}
          sub={`${overdueInvoices.length} overdue`}
          onClick={() => setDrillDown({ type: "overdue", title: "Overdue Analysis", description: "Invoices past their due date", transactions: overdueInvoices })}
        />
        <KPICard
          label="Collection Rate"
          value={`${collectionRate.toFixed(0)}%`}
          icon={CheckCircle2}
          color={collectionRate >= 80 ? "text-green-600" : collectionRate >= 50 ? "text-amber-500" : "text-red-500"}
          sub={`${paidInvoices.length} of ${invoices.length} paid`}
          onClick={() => setDrillDown({ type: "collection", title: "Collection Performance", description: `${paidInvoices.length} paid of ${invoices.length} total invoices`, transactions: invoices })}
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Revenue Trend — dual line */}
        <Card className="md:col-span-2 stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Revenue Trend</CardTitle>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-[hsl(143,44%,22%)]" /> Current</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-dashed border-muted-foreground" /> Previous</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {dualLineTrend.length === 0 ? (
              <EmptyChart text="No transaction data for trend" />
            ) : (
              <ChartContainer
                config={{ current: { label: "Current", color: "hsl(143 44% 22%)" }, previous: { label: "Previous", color: "hsl(215 20% 65%)" } }}
                className="h-[220px] w-full !aspect-auto"
              >
                <LineChart data={dualLineTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} className="text-[10px]" />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    width={65}
                    className="text-[10px]"
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatAmount(Number(value), currency)}
                      />
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="hsl(143 44% 22%)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "hsl(143 44% 22%)", strokeWidth: 0 }}
                    activeDot={{
                      r: 6,
                      className: "cursor-pointer",
                      onClick: (_e: any, payload: any) => {
                        const label = payload?.payload?.label;
                        if (!label) return;
                        // Find matching month key (e.g. "Aug 25" → "2025-08")
                        const monthKeys = Object.keys(txnsByMonth).sort();
                        const matchKey = monthKeys.find((k) => {
                          try { return format(new Date(k + "-01"), "MMM yy") === label; } catch { return false; }
                        });
                        if (matchKey && txnsByMonth[matchKey]) {
                          setChartDrill({
                            title: format(new Date(matchKey + "-01"), "MMMM yyyy"),
                            description: `${txnsByMonth[matchKey].length} income transactions · ${formatAmount(payload?.payload?.current || 0, currency)}`,
                            items: txnsByMonth[matchKey],
                          });
                        }
                      },
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="previous"
                    stroke="hsl(215 20% 65%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 2, fill: "hsl(215 20% 65%)", strokeWidth: 0 }}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Invoice Status Donut */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Invoice Status</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <EmptyChart text="No invoices" />
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
                      className="cursor-pointer"
                      onClick={(_data: any, index: number) => {
                        const statusName = statusDonutData[index]?.name?.toLowerCase();
                        if (!statusName) return;
                        const items = invoices.filter((i: any) => (i.status || "draft") === statusName);
                        setChartDrill({
                          title: `${statusDonutData[index].name} Invoices`,
                          description: `${items.length} invoice${items.length !== 1 ? "s" : ""} with status "${statusName}"`,
                          items,
                        });
                      }}
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
                      className="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                      onClick={() => {
                        const statusName = d.name.toLowerCase();
                        const items = invoices.filter((i: any) => (i.status || "draft") === statusName);
                        setChartDrill({
                          title: `${d.name} Invoices`,
                          description: `${items.length} invoice${items.length !== 1 ? "s" : ""}`,
                          items,
                        });
                      }}
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

      {/* ── Revenue by Category + Top Customers ── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue by Category */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Revenue by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByCategory.length === 0 ? (
              <EmptyChart text="No category data" />
            ) : (
              <ChartContainer
                config={categoryChartConfig}
                className="h-[200px] w-full !aspect-auto"
              >
                <BarChart data={revenueByCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    className="text-[10px]"
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
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
                        formatter={(value) => formatAmount(Number(value), currency)}
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    fill="hsl(143 44% 22%)"
                    radius={[0, 4, 4, 0]}
                    barSize={16}
                    className="cursor-pointer"
                    onClick={(_data: any, index: number) => {
                      const cat = revenueByCategory[index]?.name;
                      if (!cat) return;
                      const items = txnsByCategory[cat] || invoices.filter((i: any) => (resolveIncomeCategory(i.category, i.v2_customers?.name, businessSector) || "Other") === cat);
                      setChartDrill({
                        title: cat,
                        description: `${items.length} transaction${items.length !== 1 ? "s" : ""} · ${formatAmount(revenueByCategory[index]?.value || 0, currency)}`,
                        items,
                      });
                    }}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="stat-card-hover">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Top Customers
              </CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {customers.length} total
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {topCustomers.length === 0 ? (
              <EmptyChart text="No customer data" />
            ) : (
              <div className="space-y-3">
                {topCustomers.map((c, idx) => {
                  const maxTotal = topCustomers[0]?.total || 1;
                  const pct = (c.total / maxTotal) * 100;
                  return (
                    <div
                      key={c.name}
                      className="space-y-1 cursor-pointer hover:bg-muted/50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors"
                      onClick={() => {
                        const custInvoices = invoices.filter((i: any) => (i.v2_customers?.name || "Unknown") === c.name);
                        setChartDrill({
                          title: c.name,
                          description: `${custInvoices.length} invoice${custInvoices.length !== 1 ? "s" : ""} · Total: ${formatAmount(c.total, currency)}${c.pending > 0 ? ` · ${formatAmount(c.pending, currency)} pending` : ""}`,
                          items: custInvoices,
                        });
                      }}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono w-4">
                            {idx + 1}
                          </span>
                          <span className="font-medium truncate">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.pending > 0 && (
                            <Badge variant="outline" className="text-[9px] h-4 text-amber-600 border-amber-200">
                              <FC amount={c.pending} currency={currency} /> due
                            </Badge>
                          )}
                          <span className="font-semibold text-xs">
                            <FC amount={c.total} currency={currency} />
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

      {/* ── Invoice Detail Sheet ── */}
      <Sheet open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Invoice Details</SheetTitle>
            <SheetDescription>
              {selectedInvoice?.invoice_number || "Invoice"}
            </SheetDescription>
          </SheetHeader>
          {selectedInvoice && (
            <InvoiceDetail invoice={selectedInvoice} currency={currency} />
          )}
        </SheetContent>
      </Sheet>

      {/* ── Rich Drill-Down Sheet ── */}
      <RevenueDrillDownSheet
        drillDown={drillDown}
        onClose={() => setDrillDown(null)}
        currency={currency}
        invoices={invoices}
        incomeTxns={incomeTxns}
        paidInvoices={paidInvoices}
        pendingInvoices={pendingInvoices}
        overdueInvoices={overdueInvoices}
      />

      {/* ── Chart Drill-Down Sheet ── */}
      <ChartDrillDownSheet
        chartDrill={chartDrill}
        onClose={() => setChartDrill(null)}
        currency={currency}
      />
    </div>
  );
}

// ── Invoices Tab ──────────────────────────────────────────────────────────

const ACCENT_COLORS = [
  { name: "Blue", value: "#2563eb" },
  { name: "Emerald", value: "#059669" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Slate", value: "#475569" },
];

interface InvoiceProfile {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  trn: string;
  logo_text: string;
  logo_url: string;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface InvoiceTemplate {
  accent_color: string;
  layout: "classic" | "modern" | "minimal";
  show_logo: boolean;
  show_trn: boolean;
  show_due_date: boolean;
  show_notes: boolean;
  show_payment_terms: boolean;
  footer_text: string;
  payment_terms: string;
}

const DEFAULT_PROFILE: InvoiceProfile = {
  company_name: "", address_line1: "", address_line2: "", city: "", country: "UAE",
  phone: "", email: "", trn: "", logo_text: "", logo_url: "",
};

const DEFAULT_TEMPLATE: InvoiceTemplate = {
  accent_color: "#2563eb", layout: "classic", show_logo: true, show_trn: true,
  show_due_date: true, show_notes: true, show_payment_terms: true,
  footer_text: "Thank you for your business!", payment_terms: "Net 30",
};

function InvoicesTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Profile & Template state
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [profile, setProfile] = useState<InvoiceProfile>(DEFAULT_PROFILE);
  const [template, setTemplate] = useState<InvoiceTemplate>(DEFAULT_TEMPLATE);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load saved profile & template
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const sp = await database.getControlSetting(clientId, "invoice_profile");
        if (sp) setProfile(sp);
        const st = await database.getControlSetting(clientId, "invoice_template");
        if (st) setTemplate(st);
      } catch { /* defaults */ }
      setProfileLoaded(true);
    })();
  }, [clientId]);

  const handleSaveProfile = async () => {
    if (!clientId) return;
    try {
      await database.setControlSetting(clientId, "invoice_profile", profile);
      toast.success("Invoice profile saved");
      setShowProfileDialog(false);
    } catch (err: any) { toast.error(err.message || "Failed to save profile"); }
  };

  const handleSaveTemplate = async () => {
    if (!clientId) return;
    try {
      await database.setControlSetting(clientId, "invoice_template", template);
      toast.success("Invoice template saved");
      setShowTemplateSheet(false);
    } catch (err: any) { toast.error(err.message || "Failed to save template"); }
  };

  const { data: invoices = [] } = useQuery({
    queryKey: ["revenue-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const totalAmount = useMemo(() => invoices.reduce((s: number, i: any) => s + (i.total || 0), 0), [invoices]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((i: any) => {
      const cat = resolveIncomeCategory(i.category, i.v2_customers?.name, businessSector) || "Other";
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [invoices, businessSector]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: invoices.length };
    invoices.forEach((i: any) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  }, [invoices]);

  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== "all") result = result.filter((i: any) => i.status === statusFilter);
    if (catFilter !== "all") result = result.filter((i: any) => (resolveIncomeCategory(i.category, i.v2_customers?.name, businessSector) || "Other") === catFilter);
    return result;
  }, [invoices, statusFilter, catFilter]);

  const handleDeleteInvoice = async (inv: any) => {
    if (!clientId) return;
    setDeleting(true);
    try {
      await flaskApi.del(`/invoices/${inv.id}`);
      queryClient.invalidateQueries({ queryKey: ["revenue-invoices", clientId] });
      setSelectedInvoice(null);
      toast.success(`Invoice ${inv.invoice_number || inv.id.slice(0, 8)} deleted`);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete invoice");
    } finally {
      setDeleting(false);
    }
  };

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {invoices.length} invoice{invoices.length !== 1 ? "s" : ""} · <FC amount={totalAmount} currency={currency} /> total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowProfileDialog(true)}>
            <Building2 className="h-3.5 w-3.5" />
            Invoice Profile
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTemplateSheet(true)}>
            <Palette className="h-3.5 w-3.5" />
            Customize
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => navigate("/revenue/invoices/new")}>
            <Plus className="h-3.5 w-3.5" />
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b pb-px">
        {["all", "draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
          <button
            key={s}
            className={`px-3 py-1.5 text-sm font-medium transition-colors border-b-2 -mb-px ${statusFilter === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            onClick={() => { setStatusFilter(s); setCatFilter("all"); }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} <span className="text-muted-foreground ml-1">{statusCounts[s] || 0}</span>
          </button>
        ))}
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={catFilter === "all" ? "default" : "outline"}
          size="sm"
          className="text-xs h-7 rounded-full"
          onClick={() => { setCatFilter("all"); setStatusFilter("all"); }}
        >
          All ({invoices.length})
        </Button>
        {Object.entries(categoryCounts).sort(([, a], [, b]) => b - a).map(([cat, count]) => (
          <Button
            key={cat}
            variant={catFilter === cat ? "default" : "outline"}
            size="sm"
            className="text-xs h-7 rounded-full"
            onClick={() => { setCatFilter(catFilter === cat ? "all" : cat); setStatusFilter("all"); }}
          >
            {cat} ({count})
          </Button>
        ))}
      </div>

      {/* View toggle */}
      <div className="flex justify-end">
        <div className="flex border rounded-md overflow-hidden">
          <button
            className={`px-2.5 py-1.5 ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            className={`px-2.5 py-1.5 ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No Invoices Found</h3>
            <p className="text-sm text-muted-foreground">No invoices match the current filters.</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((inv: any) => {
            const isOverdue = inv.due_date && inv.status !== "paid" && inv.status !== "cancelled" && isAfter(new Date(), parseISO(inv.due_date));
            return (
              <Card
                key={inv.id}
                className="cursor-pointer hover:shadow-md transition-shadow border-dashed"
                onClick={() => setSelectedInvoice(inv)}
              >
                <CardContent className="p-4 space-y-2.5">
                  {/* Top row: invoice # + status dropdown */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold font-mono truncate">{inv.invoice_number || "—"}</span>
                    <Select
                      value={isOverdue ? "overdue" : inv.status}
                      onValueChange={async (newStatus) => {
                        try {
                          await flaskApi.patch(`/invoices/${inv.id}`, { status: newStatus });
                          queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
                          queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
                          toast.success(`Status → ${newStatus}`);
                        } catch (err: any) {
                          toast.error(err.message || "Failed to update");
                        }
                      }}
                    >
                      <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent p-0 text-[10px] font-medium focus:ring-0 [&>svg]:h-3 [&>svg]:w-3" onClick={(e) => e.stopPropagation()}>
                        <InvoiceStatusBadge status={isOverdue ? "overdue" : inv.status} />
                      </SelectTrigger>
                      <SelectContent onClick={(e) => e.stopPropagation()}>
                        {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                          <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Customer name */}
                  <p className="text-sm font-medium leading-tight line-clamp-2 min-h-[2.5rem]">
                    {inv.v2_customers?.name || inv.customer_name || "—"}
                  </p>
                  {/* Dates row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{fmtDate(inv.invoice_date)}</span>
                    <span>Due: {fmtDate(inv.due_date)}</span>
                  </div>
                  {/* Amount */}
                  <p className="text-right text-lg font-bold">
                    <FC amount={inv.total || 0} currency={currency} />
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[130px]">Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv: any) => {
                  const isOverdue = inv.due_date && inv.status !== "paid" && inv.status !== "cancelled" && isAfter(new Date(), parseISO(inv.due_date));
                  return (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedInvoice(inv)}>
                      <TableCell className="font-mono text-xs">{inv.invoice_number || "—"}</TableCell>
                      <TableCell className="font-medium text-sm">{inv.v2_customers?.name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.invoice_date)}</TableCell>
                      <TableCell className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>{fmtDate(inv.due_date)}</TableCell>
                      <TableCell className="text-right font-semibold text-sm"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={isOverdue ? "overdue" : inv.status}
                          onValueChange={async (newStatus) => {
                            try {
                              await flaskApi.patch(`/invoices/${inv.id}`, { status: newStatus });
                              queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
                              queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
                              queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
                              toast.success(`Status → ${newStatus}`);
                            } catch (err: any) {
                              toast.error(err.message || "Failed to update");
                            }
                          }}
                        >
                          <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent p-0 text-[10px] font-medium focus:ring-0 [&>svg]:h-3 [&>svg]:w-3">
                            <InvoiceStatusBadge status={isOverdue ? "overdue" : inv.status} />
                          </SelectTrigger>
                          <SelectContent>
                            {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                              <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── Invoice Detail Sheet ── */}
      <Sheet open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between pr-4">
              <SheetTitle className="font-mono">{selectedInvoice?.invoice_number || "Invoice"}</SheetTitle>
              {selectedInvoice && <InvoiceStatusBadge status={selectedInvoice.status} />}
            </div>
          </SheetHeader>
          {selectedInvoice && (
            <div className="space-y-4 pt-4">
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => {
                    setSelectedInvoice(null);
                    navigate(`/revenue/invoices/new?edit=${selectedInvoice.id}`);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                  disabled={deleting}
                  onClick={() => handleDeleteInvoice(selectedInvoice)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {deleting ? "Deleting..." : "Delete"}
                </Button>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <Select
                    value={selectedInvoice.status}
                    onValueChange={async (newStatus) => {
                      try {
                        await flaskApi.patch(`/invoices/${selectedInvoice.id}`, { status: newStatus });
                        setSelectedInvoice({ ...selectedInvoice, status: newStatus });
                        queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["cash-invoices"] });
                        queryClient.invalidateQueries({ queryKey: ["ai-score-invoices"] });
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
                      {["draft", "sent", "paid", "overdue", "cancelled"].map((s) => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Invoice preview card — uses saved profile & template */}
              {(() => {
                const accent = template.accent_color || "#2563eb";
                const isModern = template.layout === "modern";
                const isMinimal = template.layout === "minimal";
                const inv = selectedInvoice;
                const invSubtotal = inv.subtotal || (inv.total || 0) / 1.05;
                const invTax = inv.tax_amount || (inv.total || 0) * 0.05 / 1.05;
                return (
                  <Card className="border shadow-sm overflow-hidden">
                    {!isMinimal && (
                      <div className={isModern ? "w-full h-2" : "w-full h-1"} style={{ backgroundColor: accent }} />
                    )}
                    <CardContent className="p-5 space-y-4 text-sm">
                      {/* Header: Company + INVOICE */}
                      <div className={`flex ${isModern ? "flex-col gap-3" : "justify-between items-start"}`}>
                        <div>
                          {template.show_logo && (
                            profile.logo_url ? (
                              <img src={profile.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-1" />
                            ) : profile.logo_text || profile.company_name ? (
                              <p className="font-bold text-lg" style={{ color: accent }}>{profile.logo_text || profile.company_name}</p>
                            ) : null
                          )}
                          {profile.company_name && (profile.logo_url || (profile.logo_text && profile.company_name !== profile.logo_text)) && (
                            <p className="text-xs font-medium">{profile.company_name}</p>
                          )}
                          {profile.address_line1 && <p className="text-[10px] text-muted-foreground">{profile.address_line1}</p>}
                          {profile.address_line2 && <p className="text-[10px] text-muted-foreground">{profile.address_line2}</p>}
                          {(profile.city || profile.country) && (
                            <p className="text-[10px] text-muted-foreground">{[profile.city, profile.country].filter(Boolean).join(", ")}</p>
                          )}
                          {profile.phone && <p className="text-[10px] text-muted-foreground">{profile.phone}</p>}
                          {profile.email && <p className="text-[10px] text-muted-foreground">{profile.email}</p>}
                          {template.show_trn && profile.trn && (
                            <p className="text-[10px] text-muted-foreground">TRN: {profile.trn}</p>
                          )}
                        </div>
                        <div className={isModern ? "" : "text-right"}>
                          <p className="font-bold text-xl tracking-tight" style={{ color: accent }}>INVOICE</p>
                          <p className="text-xs font-mono text-muted-foreground">{inv.invoice_number || "—"}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">Date: {fmtDate(inv.invoice_date)}</p>
                          {template.show_due_date && <p className="text-[10px] text-muted-foreground">Due: {fmtDate(inv.due_date)}</p>}
                          {template.show_payment_terms && <p className="text-[10px] text-muted-foreground">Terms: {template.payment_terms}</p>}
                        </div>
                      </div>

                      <Separator />

                      {/* Bill To */}
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>Bill To</p>
                        <p className="font-medium">{inv.v2_customers?.name || inv.customer_name || "—"}</p>
                      </div>

                      <Separator />

                      {/* Line items */}
                      <div>
                        <div className="grid grid-cols-12 text-[9px] font-semibold uppercase tracking-wider pb-1.5 mb-1 border-b-2" style={{ borderColor: accent, color: accent }}>
                          <div className="col-span-5">Description</div>
                          <div className="col-span-2 text-right">Qty</div>
                          <div className="col-span-2 text-right">Price</div>
                          <div className="col-span-1 text-right">Tax</div>
                          <div className="col-span-2 text-right">Amount</div>
                        </div>
                        <div className="grid grid-cols-12 text-xs py-1 border-b border-muted/50">
                          <div className="col-span-5 truncate">{inv.notes || inv.description || "Invoice item"}</div>
                          <div className="col-span-2 text-right">1</div>
                          <div className="col-span-2 text-right"><FC amount={invSubtotal} currency={currency} /></div>
                          <div className="col-span-1 text-right text-muted-foreground">5%</div>
                          <div className="col-span-2 text-right font-medium"><FC amount={inv.total || 0} currency={currency} /></div>
                        </div>
                      </div>

                      {/* Totals */}
                      <div className="space-y-1 max-w-[200px] ml-auto text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span><FC amount={invSubtotal} currency={currency} /></span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">VAT (5%)</span>
                          <span><FC amount={invTax} currency={currency} /></span>
                        </div>
                        <div className="flex justify-between font-bold text-sm pt-1 mt-1 border-t-2" style={{ borderColor: accent }}>
                          <span>Total</span>
                          <span style={{ color: accent }}><FC amount={inv.total || 0} currency={currency} /></span>
                        </div>
                      </div>

                      {/* Notes */}
                      {template.show_notes && inv.notes && (
                        <>
                          <Separator />
                          <div>
                            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>Notes</p>
                            <p className="text-xs text-muted-foreground whitespace-pre-line">{inv.notes}</p>
                          </div>
                        </>
                      )}

                      {/* Footer */}
                      {template.footer_text && (
                        <div className="text-center pt-2 border-t">
                          <p className="text-[10px] text-muted-foreground italic">{template.footer_text}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Invoice Profile Dialog ── */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Invoice Profile
            </DialogTitle>
            <DialogDescription>
              Your company details that appear on every invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Logo Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Company Logo</Label>
              <div className="flex items-center gap-3">
                {profile.logo_url ? (
                  <div className="relative group">
                    <img src={profile.logo_url} alt="Logo" className="h-14 w-14 object-contain rounded border bg-white p-1" />
                    <button
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setProfile({ ...profile, logo_url: "" })}
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <label className="cursor-pointer">
                    <span className="text-xs text-primary font-medium hover:underline">
                      {profile.logo_url ? "Change logo" : "Upload logo"}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          toast.error("Logo must be under 500 KB");
                          return;
                        }
                        try {
                          const dataUrl = await readFileAsDataURL(file);
                          setProfile({ ...profile, logo_url: dataUrl });
                        } catch {
                          toast.error("Failed to read image");
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG or WebP. Max 500 KB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Company / Business Name</Label>
              <Input value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} placeholder="Your Company Name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo Text (shown if no image uploaded)</Label>
              <Input value={profile.logo_text} onChange={(e) => setProfile({ ...profile, logo_text: e.target.value })} placeholder="e.g. ACME" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 1</Label>
                <Input value={profile.address_line1} onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })} placeholder="Street address" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 2</Label>
                <Input value={profile.address_line2} onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })} placeholder="Suite, floor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Dubai" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} placeholder="UAE" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+971 50 000 0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="billing@company.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TRN (Tax Registration Number)</Label>
              <Input value={profile.trn} onChange={(e) => setProfile({ ...profile, trn: e.target.value })} placeholder="100000000000003" />
            </div>
            <Button className="w-full mt-2" onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Customize Invoice Template Sheet ── */}
      <Sheet open={showTemplateSheet} onOpenChange={setShowTemplateSheet}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Customize Invoice
            </SheetTitle>
            <SheetDescription>
              Adjust the look and feel of your invoices.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 pt-4">
            {/* Layout */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Layout Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["classic", "modern", "minimal"] as const).map((layout) => (
                  <button
                    key={layout}
                    className={`rounded-lg border-2 p-3 text-center text-xs font-medium transition-colors ${
                      template.layout === layout
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setTemplate({ ...template, layout })}
                  >
                    <div className={`mx-auto mb-1.5 w-8 h-10 rounded border ${
                      layout === "classic" ? "border-t-4" : layout === "modern" ? "border-l-4" : ""
                    }`} style={{ borderColor: template.accent_color }} />
                    {layout.charAt(0).toUpperCase() + layout.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Accent Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      template.accent_color === c.value ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                    onClick={() => setTemplate({ ...template, accent_color: c.value })}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-2">
                  <Input
                    type="color"
                    value={template.accent_color}
                    onChange={(e) => setTemplate({ ...template, accent_color: e.target.value })}
                    className="w-8 h-8 p-0 border-0 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">Custom</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Toggle fields */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Show / Hide Fields</Label>
              {[
                { key: "show_logo" as const, label: "Company Logo / Name" },
                { key: "show_trn" as const, label: "TRN (Tax Registration)" },
                { key: "show_due_date" as const, label: "Due Date" },
                { key: "show_notes" as const, label: "Notes Section" },
                { key: "show_payment_terms" as const, label: "Payment Terms" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={template[key]}
                    onCheckedChange={(v) => setTemplate({ ...template, [key]: v })}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Footer text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Footer Text</Label>
              <Input
                value={template.footer_text}
                onChange={(e) => setTemplate({ ...template, footer_text: e.target.value })}
                placeholder="Thank you for your business!"
              />
            </div>

            {/* Payment terms */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Payment Terms</Label>
              <Select value={template.payment_terms} onValueChange={(v) => setTemplate({ ...template, payment_terms: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" onClick={handleSaveTemplate}>
              Save Template
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

// ── AR Aging Tab ──────────────────────────────────────────────────────────

function ARAgingTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();

  const { data: invoices = [] } = useQuery({
    queryKey: ["revenue-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const unpaidInvoices = useMemo(
    () => invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled"),
    [invoices],
  );

  const agingBuckets = useMemo(() => {
    const now = new Date();
    const buckets = {
      current: { label: "Current", count: 0, total: 0, color: "bg-green-500" },
      "1-30": { label: "1–30 days", count: 0, total: 0, color: "bg-amber-400" },
      "31-60": { label: "31–60 days", count: 0, total: 0, color: "bg-orange-500" },
      "61-90": { label: "61–90 days", count: 0, total: 0, color: "bg-red-400" },
      "90+": { label: "90+ days", count: 0, total: 0, color: "bg-red-600" },
    };

    unpaidInvoices.forEach((inv: any) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const days = differenceInDays(now, dueDate);
      const amount = inv.total || 0;

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
  }, [unpaidInvoices]);

  const totalUnpaid = agingBuckets.reduce((s, b) => s + b.total, 0);

  const agingBarConfig: ChartConfig = {
    total: { label: "Amount", color: "hsl(0 84% 60%)" },
  };

  if (unpaidInvoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-50 p-4 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-green-600">All Invoices Paid</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No outstanding receivables. All invoices have been collected.
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
          label="Total AR"
          value={formatAmount(totalUnpaid, currency)}
          icon={Wallet}
          color="text-primary"
          sub={`${unpaidInvoices.length} invoices`}
        />
        <KPICard
          label="Overdue Amount"
          value={formatAmount(
            agingBuckets.slice(1).reduce((s, b) => s + b.total, 0),
            currency,
          )}
          icon={AlertTriangle}
          color="text-red-500"
          sub={`${agingBuckets.slice(1).reduce((s, b) => s + b.count, 0)} invoices`}
        />
        <KPICard
          label="90+ Days"
          value={formatAmount(agingBuckets[4].total, currency)}
          icon={ShieldAlert}
          color={agingBuckets[4].total > 0 ? "text-red-600" : "text-green-600"}
          sub={`${agingBuckets[4].count} at risk`}
        />
      </div>

      {/* Aging bars */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">AR Aging Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agingBuckets.map((bucket) => {
              const pct = totalUnpaid > 0 ? (bucket.total / totalUnpaid) * 100 : 0;
              return (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded ${bucket.color}`} />
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

      {/* Overdue invoices list */}
      {unpaidInvoices.filter((i: any) => {
        const dueDate = i.due_date ? new Date(i.due_date) : new Date(i.invoice_date);
        return differenceInDays(new Date(), dueDate) > 0;
      }).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Days Overdue</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unpaidInvoices
                  .map((inv: any) => {
                    const dueDate = inv.due_date
                      ? new Date(inv.due_date)
                      : new Date(inv.invoice_date);
                    const daysOverdue = differenceInDays(new Date(), dueDate);
                    return { ...inv, daysOverdue };
                  })
                  .filter((inv: any) => inv.daysOverdue > 0)
                  .sort((a: any, b: any) => b.daysOverdue - a.daysOverdue)
                  .map((inv: any) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-sm">
                        {inv.v2_customers?.name || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {inv.invoice_number || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-red-500">
                        {inv.due_date
                          ? format(new Date(inv.due_date), "dd MMM yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="destructive"
                          className="text-[10px]"
                        >
                          {inv.daysOverdue}d overdue
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm">
                        <FC amount={inv.total || 0} currency={currency} />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Exposure by Customer (3.4.3) */}
      <ExposureByCustomerChart invoices={unpaidInvoices} currency={currency} totalUnpaid={totalUnpaid} />
    </div>
  );
}

// ── Exposure by Customer ──

function ExposureByCustomerChart({ invoices, currency, totalUnpaid }: { invoices: any[]; currency: string; totalUnpaid: number }) {
  const customerExposure = useMemo(() => {
    const now = new Date();
    const map: Record<string, { name: string; current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number; total: number }> = {};

    invoices.forEach((inv: any) => {
      const name = inv.v2_customers?.name || "Unknown";
      if (!map[name]) map[name] = { name, current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 };
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const days = differenceInDays(now, dueDate);
      const amount = inv.total || 0;
      map[name].total += amount;
      if (days <= 0) map[name].current += amount;
      else if (days <= 30) map[name].d1_30 += amount;
      else if (days <= 60) map[name].d31_60 += amount;
      else if (days <= 90) map[name].d61_90 += amount;
      else map[name].d90plus += amount;
    });

    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [invoices]);

  if (customerExposure.length === 0) return null;

  const concentrationRisk = customerExposure[0] && totalUnpaid > 0 && (customerExposure[0].total / totalUnpaid) > 0.3;

  return (
    <Card className="stat-card-hover">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Exposure by Customer</CardTitle>
          {concentrationRisk && (
            <Badge variant="destructive" className="text-[10px]">
              Concentration Risk
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-4">
          {customerExposure.map((c) => {
            const pct = totalUnpaid > 0 ? (c.total / totalUnpaid) * 100 : 0;
            return (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate max-w-[200px]">{c.name}</span>
                  <div className="flex items-center gap-2">
                    {pct > 30 && (
                      <Badge variant="outline" className="text-[9px] text-red-500 border-red-200">
                        {pct.toFixed(0)}% of AR
                      </Badge>
                    )}
                    <span className="font-semibold text-xs"><FC amount={c.total} currency={currency} /></span>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden flex bg-muted">
                  {c.current > 0 && <div className="h-full bg-green-500" style={{ width: `${(c.current / c.total) * 100}%` }} />}
                  {c.d1_30 > 0 && <div className="h-full bg-amber-400" style={{ width: `${(c.d1_30 / c.total) * 100}%` }} />}
                  {c.d31_60 > 0 && <div className="h-full bg-orange-500" style={{ width: `${(c.d31_60 / c.total) * 100}%` }} />}
                  {c.d61_90 > 0 && <div className="h-full bg-red-400" style={{ width: `${(c.d61_90 / c.total) * 100}%` }} />}
                  {c.d90plus > 0 && <div className="h-full bg-red-600" style={{ width: `${(c.d90plus / c.total) * 100}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground border-t pt-2">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-green-500" /> Current</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-400" /> 1-30</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-orange-500" /> 31-60</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-400" /> 61-90</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-600" /> 90+</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Customers Tab ─────────────────────────────────────────────────────────

function CustomersTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    trn: "",
    category: "",
    payment_terms: 30,
  });
  const [saving, setSaving] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ["revenue-customers", clientId],
    queryFn: () => database.getCustomers(clientId!),
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["revenue-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  // Strip UAE banking prefixes to get the real customer name
  const cleanName = (raw: string) => {
    let s = raw.trim();
    // Strip "Ln39885332324511:- " or "533567823:- " style reference prefixes
    s = s.replace(/^[A-Za-z]{0,4}\d{6,}[:\-]+\s*/, "");
    // Strip UAE WPS transfer type codes at start
    s = s.replace(/^(Fam|Com|Prr|Edu|Str|Sal|Msc)\s+/i, "");
    // Strip IBFT/MOBN/WPS style prefixes
    s = s.replace(/^(IBFT|MOBN|WPS|NEFT)[:\-]\s*/i, "");
    // Strip "Ccdm Deposit <ref> <datetime>" — not a real customer name
    if (/^Ccdm\s+Deposit/i.test(s)) return "";
    return s.trim();
  };

  // Group customers by clean name so "533567823:- Fam Arif..." and "513682115:- Fam Arif..." become one row
  const groupedCustomers = useMemo(() => {
    const dateLike = /^\d{1,4}[/\-\.]\d{1,2}[/\-\.]\d{2,4}|^\d{2}:\d{2}$/;
    const groups: Record<string, { name: string; ids: string[]; email?: string; phone?: string; trn?: string; category?: string; payment_terms?: number; is_active?: boolean }> = {};

    customers.forEach((c: any) => {
      const raw = (c.name || "").trim();
      if (!raw || raw.length < 3) return;
      const clean = cleanName(raw);
      if (!clean || clean.length < 3) return;
      if (dateLike.test(clean)) return;
      const alphaCount = [...clean].filter((ch) => /[a-zA-Z]/.test(ch)).length;
      if (alphaCount < 2) return;

      const key = clean.toLowerCase();
      if (!groups[key]) {
        groups[key] = {
          name: clean,
          ids: [],
          email: c.email,
          phone: c.phone,
          trn: c.trn,
          category: c.category,
          payment_terms: c.payment_terms,
          is_active: c.is_active,
        };
      }
      groups[key].ids.push(c.id);
      // Take the first non-empty detail
      if (!groups[key].email && c.email) groups[key].email = c.email;
      if (!groups[key].phone && c.phone) groups[key].phone = c.phone;
      if (!groups[key].trn && c.trn) groups[key].trn = c.trn;
    });

    return Object.values(groups);
  }, [customers]);

  const customerStats = useMemo(() => {
    return groupedCustomers.map((g) => {
      const idSet = new Set(g.ids);
      const custInvoices = invoices.filter((i: any) => idSet.has(i.customer_id));
      const totalBilled = custInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
      const totalPaid = custInvoices
        .filter((i: any) => i.status === "paid")
        .reduce((s: number, i: any) => s + (i.total || 0), 0);
      const outstanding = totalBilled - totalPaid;
      const overdueCount = custInvoices.filter((i: any) => {
        if (i.status === "paid" || i.status === "cancelled") return false;
        if (!i.due_date) return false;
        return isAfter(new Date(), parseISO(i.due_date));
      }).length;
      return {
        ...g,
        invoiceCount: custInvoices.length,
        totalBilled,
        totalPaid,
        outstanding,
        overdueCount,
      };
    }).sort((a: any, b: any) => b.totalBilled - a.totalBilled);
  }, [groupedCustomers, invoices]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    setSaving(true);
    try {
      await database.createCustomer(clientId!, {
        name: newCustomer.name.trim(),
        email: newCustomer.email.trim() || undefined,
        phone: newCustomer.phone.trim() || undefined,
        trn: newCustomer.trn.trim() || undefined,
        category: newCustomer.category.trim() || undefined,
        payment_terms: newCustomer.payment_terms,
      });
      toast.success(`Customer "${newCustomer.name}" added`);
      queryClient.invalidateQueries({ queryKey: ["revenue-customers"] });
      setShowAddDialog(false);
      setNewCustomer({ name: "", email: "", phone: "", trn: "", category: "", payment_terms: 30 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
          <KPICard
            label="Active Customers"
            value={(groupedCustomers.filter((c) => c.is_active).length || groupedCustomers.length).toString()}
            icon={Users}
            color="text-primary"
            sub={`${groupedCustomers.length} total`}
          />
          <KPICard
            label="With Outstanding"
            value={customerStats.filter((c: any) => c.outstanding > 0).length.toString()}
            icon={Clock}
            color="text-amber-500"
            sub="have unpaid invoices"
          />
          <KPICard
            label="With Overdue"
            value={customerStats.filter((c: any) => c.overdueCount > 0).length.toString()}
            icon={AlertTriangle}
            color={customerStats.some((c: any) => c.overdueCount > 0) ? "text-red-500" : "text-green-600"}
            sub="need follow-up"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* Add Customer Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Customer</DialogTitle>
            <DialogDescription>
              Enter customer details. Only name is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Name *</Label>
              <Input
                id="cust-name"
                placeholder="Customer / Company name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-email">Email</Label>
                <Input
                  id="cust-email"
                  type="email"
                  placeholder="customer@example.com"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-phone">Phone</Label>
                <Input
                  id="cust-phone"
                  placeholder="+971 50 123 4567"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cust-trn">TRN (Tax Reg. No.)</Label>
                <Input
                  id="cust-trn"
                  placeholder="100XXXXXXXXX"
                  value={newCustomer.trn}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, trn: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cust-terms">Payment Terms (days)</Label>
                <Input
                  id="cust-terms"
                  type="number"
                  min={0}
                  value={newCustomer.payment_terms}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, payment_terms: Math.max(0, parseInt(e.target.value) || 0) }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-category">Category</Label>
              <Input
                id="cust-category"
                placeholder="e.g. Retail, Consulting, Government"
                value={newCustomer.category}
                onChange={(e) => setNewCustomer((p) => ({ ...p, category: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAddCustomer} disabled={saving || !newCustomer.name.trim()}>
                {saving ? "Saving..." : "Add Customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {customerStats.length === 0 && groupedCustomers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Users className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Customers Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Click "Add Customer" above or customers will be created automatically
              when invoices are synced from your bank statements.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>TRN</TableHead>
                  <TableHead>Terms</TableHead>
                  <TableHead>Invoices</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerStats.map((c: any, idx: number) => (
                  <TableRow
                    key={c.name + idx}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedCustomer(c)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{c.name}</p>
                        {c.email && (
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        )}
                        {c.phone && (
                          <p className="text-xs text-muted-foreground">{c.phone}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.trn || "—"}</TableCell>
                    <TableCell className="text-xs">{c.payment_terms ?? 30}d</TableCell>
                    <TableCell className="text-sm">{c.invoiceCount}</TableCell>
                    <TableCell className="text-right text-sm font-medium">
                      <FC amount={c.totalBilled} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-600">
                      <FC amount={c.totalPaid} currency={currency} />
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold ${c.outstanding > 0 ? "text-amber-600" : ""}`}>
                      <FC amount={c.outstanding} currency={currency} />
                    </TableCell>
                    <TableCell>
                      {c.overdueCount > 0 ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {c.overdueCount} overdue
                        </Badge>
                      ) : c.outstanding > 0 ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Pending
                        </Badge>
                      ) : c.invoiceCount > 0 ? (
                        <Badge variant="outline" className="text-[10px] text-green-600 border-green-200">
                          Settled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          New
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Customer Detail Sheet — shows all invoices for selected customer */}
      <Sheet open={!!selectedCustomer} onOpenChange={(open) => { if (!open) setSelectedCustomer(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedCustomer && (() => {
            const idSet = new Set(selectedCustomer.ids || []);
            const custInvoices = invoices
              .filter((i: any) => idSet.has(i.customer_id))
              .sort((a: any, b: any) => (b.invoice_date || "").localeCompare(a.invoice_date || ""));
            const totalBilled = custInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
            const totalPaid = custInvoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + (i.total || 0), 0);
            const outstanding = totalBilled - totalPaid;

            return (
              <>
                <SheetHeader>
                  <SheetTitle>{selectedCustomer.name}</SheetTitle>
                  <SheetDescription>
                    {[selectedCustomer.email, selectedCustomer.phone].filter(Boolean).join(" · ") || "Customer details"}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-4 pt-4">
                  {/* Customer info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedCustomer.trn && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">TRN</p>
                        <p className="font-medium">{selectedCustomer.trn}</p>
                      </div>
                    )}
                    {selectedCustomer.category && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Category</p>
                        <p className="font-medium">{selectedCustomer.category}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Payment Terms</p>
                      <p className="font-medium">{selectedCustomer.payment_terms ?? 30} days</p>
                    </div>
                  </div>

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

                  {/* Invoices list */}
                  {custInvoices.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-muted-foreground">No invoices for this customer</p>
                    </div>
                  ) : (
                    <div className="rounded-md border max-h-[55vh] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Invoice #</TableHead>
                            <TableHead className="text-xs">Date</TableHead>
                            <TableHead className="text-xs">Due</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {custInvoices.map((inv: any, idx: number) => {
                            const isOverdue =
                              inv.status !== "paid" &&
                              inv.status !== "cancelled" &&
                              inv.due_date &&
                              isAfter(new Date(), parseISO(inv.due_date));
                            return (
                              <TableRow key={inv.id || idx}>
                                <TableCell className="text-xs font-medium py-2">
                                  {inv.invoice_number || `INV-${idx + 1}`}
                                </TableCell>
                                <TableCell className="text-xs py-2 whitespace-nowrap">
                                  {inv.invoice_date
                                    ? format(new Date(inv.invoice_date + "T00:00:00"), "MMM d, yyyy")
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-xs py-2 whitespace-nowrap">
                                  {inv.due_date
                                    ? format(new Date(inv.due_date + "T00:00:00"), "MMM d, yyyy")
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-xs text-right py-2 font-medium">
                                  <FC amount={inv.total || 0} currency={currency} />
                                </TableCell>
                                <TableCell className="py-2">
                                  <Badge
                                    variant={
                                      inv.status === "paid"
                                        ? "outline"
                                        : isOverdue
                                        ? "destructive"
                                        : "secondary"
                                    }
                                    className={`text-[9px] capitalize ${
                                      inv.status === "paid" ? "text-green-600 border-green-200" : ""
                                    }`}
                                  >
                                    {isOverdue ? "overdue" : inv.status || "draft"}
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

// ── Chart Drill-Down Sheet ────────────────────────────────────────────

function ChartDrillDownSheet({
  chartDrill,
  onClose,
  currency,
}: {
  chartDrill: { title: string; description?: string; items: any[] } | null;
  onClose: () => void;
  currency: string;
}) {
  if (!chartDrill) return null;

  const { title, description, items } = chartDrill;
  const isInvoice = items.length > 0 && ("invoice_number" in items[0] || "total" in items[0] && "status" in items[0]);

  // Monthly mini-trend for transactions
  const miniTrend = useMemo(() => {
    if (isInvoice) return [];
    const m: Record<string, number> = {};
    items.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key) m[key] = (m[key] || 0) + t.amount;
    });
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        amount,
      }));
  }, [items, isInvoice]);

  const totalAmt = items.reduce((s, t) => s + Math.abs(t.amount || t.total || 0), 0);
  const avgAmt = items.length > 0 ? totalAmt / items.length : 0;

  return (
    <Sheet open={!!chartDrill} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-primary/5 border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-sm font-bold text-primary mt-0.5"><FC amount={totalAmt} currency={currency} /></p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/50 border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Count</p>
              <p className="text-sm font-bold mt-0.5">{items.length}</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-muted/50 border">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
              <p className="text-sm font-bold mt-0.5"><FC amount={avgAmt} currency={currency} /></p>
            </div>
          </div>

          {/* Mini trend for transaction items */}
          {miniTrend.length > 1 && (
            <ChartContainer
              config={{ amount: { label: "Amount", color: "hsl(143 44% 22%)" } }}
              className="h-[100px] w-full !aspect-auto"
            >
              <BarChart data={miniTrend}>
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[9px]" />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Bar dataKey="amount" fill="hsl(143 44% 22%)" radius={[3, 3, 0, 0]} barSize={18} />
              </BarChart>
            </ChartContainer>
          )}

          <Separator />

          {/* Item list */}
          <div className="rounded-md border max-h-[55vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isInvoice ? (
                    <>
                      <TableHead className="text-xs">Invoice #</TableHead>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.slice(0, 200).map((item: any, i: number) => (
                  <TableRow key={item.id || i}>
                    {isInvoice ? (
                      <>
                        <TableCell className="text-xs font-mono py-2">{item.invoice_number || "—"}</TableCell>
                        <TableCell className="text-xs py-2">{item.v2_customers?.name || "—"}</TableCell>
                        <TableCell className="text-xs text-right py-2 font-semibold"><FC amount={item.total || 0} currency={currency} /></TableCell>
                        <TableCell className="py-2"><InvoiceStatusBadge status={item.status} /></TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-xs whitespace-nowrap py-2">
                          {item.transaction_date ? format(new Date(item.transaction_date), "dd MMM yy") : "—"}
                        </TableCell>
                        <TableCell className="text-xs py-2 max-w-[200px] truncate">
                          {item.description || item.counterparty_name || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 font-semibold text-emerald-600">
                          <FC amount={item.amount || 0} currency={currency} />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {items.length > 200 && (
                  <TableRow>
                    <TableCell colSpan={isInvoice ? 4 : 3} className="text-center text-xs text-muted-foreground py-2">
                      Showing 200 of {items.length}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Rich Drill-Down Sheet ─────────────────────────────────────────────

function RevenueDrillDownSheet({
  drillDown,
  onClose,
  currency,
  invoices,
  incomeTxns,
  paidInvoices,
  pendingInvoices,
  overdueInvoices,
}: {
  drillDown: { type: "revenue" | "outstanding" | "overdue" | "collection" | null; title: string; description?: string; transactions: any[] } | null;
  onClose: () => void;
  currency: string;
  invoices: any[];
  incomeTxns: any[];
  paidInvoices: any[];
  pendingInvoices: any[];
  overdueInvoices: any[];
}) {
  if (!drillDown) return null;

  const { type, title, description, transactions } = drillDown;

  // ── Revenue drill-down data ──
  const revenueByMonth = useMemo(() => {
    if (type !== "revenue") return [];
    const m: Record<string, number> = {};
    transactions.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (key) m[key] = (m[key] || 0) + t.amount;
    });
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => ({
        month: format(new Date(month + "-01"), "MMM yy"),
        revenue: amount,
      }));
  }, [type, transactions]);

  const revenueByCat = useMemo(() => {
    if (type !== "revenue") return [];
    const m: Record<string, number> = {};
    transactions.forEach((t: any) => {
      const cat = resolveIncomeCategory(t.category, t.counterparty_name || t.description, businessSector) || "Other";
      m[cat] = (m[cat] || 0) + t.amount;
    });
    const COLORS = [
      "hsl(143 44% 28%)", "hsl(210 80% 55%)", "hsl(25 95% 53%)",
      "hsl(262 83% 58%)", "hsl(0 84% 60%)", "hsl(173 58% 39%)",
      "hsl(47 96% 53%)", "hsl(330 81% 60%)",
    ];
    return Object.entries(m)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8)
      .map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));
  }, [type, transactions]);

  const topTxns = useMemo(() => {
    return [...transactions].sort((a: any, b: any) => Math.abs(b.amount || b.total || 0) - Math.abs(a.amount || a.total || 0)).slice(0, 10);
  }, [transactions]);

  // ── Outstanding drill-down data ──
  const outstandingByCustomer = useMemo(() => {
    if (type !== "outstanding") return [];
    const m: Record<string, { name: string; total: number; count: number }> = {};
    transactions.forEach((inv: any) => {
      const name = inv.v2_customers?.name || inv.customer_name || "Unknown";
      if (!m[name]) m[name] = { name, total: 0, count: 0 };
      m[name].total += inv.total || 0;
      m[name].count += 1;
    });
    return Object.values(m).sort((a, b) => b.total - a.total);
  }, [type, transactions]);

  // ── Overdue drill-down data ──
  const overdueAging = useMemo(() => {
    if (type !== "overdue") return [];
    const now = new Date();
    return transactions.map((inv: any) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const days = differenceInDays(now, dueDate);
      return { ...inv, daysOverdue: Math.max(0, days) };
    }).sort((a: any, b: any) => b.daysOverdue - a.daysOverdue);
  }, [type, transactions]);

  const overdueByBucket = useMemo(() => {
    if (type !== "overdue") return [];
    const buckets = [
      { label: "1-30 days", min: 1, max: 30, total: 0, count: 0, color: "hsl(38 92% 50%)" },
      { label: "31-60 days", min: 31, max: 60, total: 0, count: 0, color: "hsl(25 95% 53%)" },
      { label: "61-90 days", min: 61, max: 90, total: 0, count: 0, color: "hsl(0 72% 51%)" },
      { label: "90+ days", min: 91, max: 9999, total: 0, count: 0, color: "hsl(0 84% 40%)" },
    ];
    const now = new Date();
    transactions.forEach((inv: any) => {
      const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
      const days = differenceInDays(now, dueDate);
      const bucket = buckets.find((b) => days >= b.min && days <= b.max);
      if (bucket) {
        bucket.total += inv.total || 0;
        bucket.count += 1;
      }
    });
    return buckets.filter((b) => b.count > 0);
  }, [type, transactions]);

  // ── Collection drill-down data ──
  const collectionByMonth = useMemo(() => {
    if (type !== "collection") return [];
    const months: Record<string, { total: number; paid: number }> = {};
    transactions.forEach((inv: any) => {
      const key = (inv.invoice_date || inv.created_at || "")?.slice(0, 7);
      if (!key) return;
      if (!months[key]) months[key] = { total: 0, paid: 0 };
      months[key].total += 1;
      if (inv.status === "paid") months[key].paid += 1;
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, d]) => ({
        month: format(new Date(m + "-01"), "MMM yy"),
        rate: d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0,
        total: d.total,
        paid: d.paid,
      }));
  }, [type, transactions]);

  const statusBreakdown = useMemo(() => {
    if (type !== "collection") return [];
    const m: Record<string, number> = {};
    transactions.forEach((inv: any) => {
      const s = inv.status || "draft";
      m[s] = (m[s] || 0) + 1;
    });
    const colors: Record<string, string> = {
      paid: "hsl(143 44% 28%)", sent: "hsl(210 80% 55%)",
      overdue: "hsl(0 84% 60%)", draft: "hsl(215 20% 65%)", cancelled: "hsl(0 0% 70%)",
    };
    return Object.entries(m).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: colors[name] || "hsl(215 20% 65%)",
    }));
  }, [type, transactions]);

  const total = transactions.reduce((s, t) => s + Math.abs(t.amount || t.total || 0), 0);

  return (
    <Sheet open={!!drillDown} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="space-y-5 pt-4">
          {/* ── REVENUE DRILL-DOWN ── */}
          {type === "revenue" && (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-primary/5 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-lg font-bold text-primary mt-0.5"><FC amount={total} currency={currency} /></p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transactions</p>
                  <p className="text-lg font-bold mt-0.5">{transactions.length}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Size</p>
                  <p className="text-lg font-bold mt-0.5"><FC amount={transactions.length > 0 ? total / transactions.length : 0} currency={currency} /></p>
                </div>
              </div>

              {/* Monthly revenue chart */}
              {revenueByMonth.length > 1 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Monthly Revenue Trend</p>
                  <ChartContainer
                    config={{ revenue: { label: "Revenue", color: "hsl(143 44% 22%)" } }}
                    className="h-[160px] w-full !aspect-auto"
                  >
                    <AreaChart data={revenueByMonth}>
                      <defs>
                        <linearGradient id="revDrillGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(143 44% 28%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(143 44% 28%)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                      <YAxis axisLine={false} tickLine={false} width={55} className="text-[10px]" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(143 44% 28%)" strokeWidth={2} fill="url(#revDrillGrad)" dot={{ r: 3, fill: "hsl(143 44% 28%)", strokeWidth: 0 }} />
                    </AreaChart>
                  </ChartContainer>
                </div>
              )}

              {/* Revenue by category */}
              {revenueByCat.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Revenue by Category</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    {revenueByCat.map((c) => {
                      const pct = total > 0 ? (c.value / total) * 100 : 0;
                      return (
                        <div key={c.name} className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.fill }} />
                          <span className="text-xs truncate flex-1">{c.name}</span>
                          <span className="text-xs font-semibold"><FC amount={c.value} currency={currency} /></span>
                          <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Top transactions */}
              <div>
                <p className="text-xs font-semibold mb-2">Top Transactions</p>
                <div className="rounded-md border max-h-[35vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Date</TableHead>
                        <TableHead className="text-xs">Description</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topTxns.map((t: any, i: number) => (
                        <TableRow key={t.id || i}>
                          <TableCell className="text-xs whitespace-nowrap py-2">
                            {t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yy") : "—"}
                          </TableCell>
                          <TableCell className="text-xs py-2 max-w-[200px] truncate">{t.description || t.counterparty_name || "—"}</TableCell>
                          <TableCell className="text-xs text-right py-2 font-semibold text-emerald-600"><FC amount={t.amount} currency={currency} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {/* ── OUTSTANDING DRILL-DOWN ── */}
          {type === "outstanding" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total AR</p>
                  <p className="text-lg font-bold text-amber-600 mt-0.5"><FC amount={total} currency={currency} /></p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                  <p className="text-lg font-bold mt-0.5">{transactions.length}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Customers</p>
                  <p className="text-lg font-bold mt-0.5">{outstandingByCustomer.length}</p>
                </div>
              </div>

              {/* By customer */}
              {outstandingByCustomer.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Outstanding by Customer</p>
                  <div className="space-y-2">
                    {outstandingByCustomer.map((c) => {
                      const pct = total > 0 ? (c.total / total) * 100 : 0;
                      return (
                        <div key={c.name} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium truncate max-w-[220px]">{c.name}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{c.count} inv</Badge>
                              <span className="font-semibold text-xs"><FC amount={c.total} currency={currency} /></span>
                            </div>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <Separator />

              {/* Invoice list */}
              <div>
                <p className="text-xs font-semibold mb-2">Outstanding Invoices</p>
                <div className="rounded-md border max-h-[35vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs">Due Date</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-mono py-2">{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-xs py-2">{inv.v2_customers?.name || "—"}</TableCell>
                          <TableCell className="text-xs py-2">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yy") : "—"}</TableCell>
                          <TableCell className="text-xs text-right py-2 font-semibold"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                          <TableCell className="py-2"><InvoiceStatusBadge status={inv.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}

          {/* ── OVERDUE DRILL-DOWN ── */}
          {type === "overdue" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue Total</p>
                  <p className="text-lg font-bold text-red-600 mt-0.5"><FC amount={total} currency={currency} /></p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Invoices</p>
                  <p className="text-lg font-bold mt-0.5">{transactions.length}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50 border">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Days Overdue</p>
                  <p className="text-lg font-bold mt-0.5">
                    {overdueAging.length > 0
                      ? Math.round(overdueAging.reduce((s: number, a: any) => s + a.daysOverdue, 0) / overdueAging.length)
                      : 0}
                  </p>
                </div>
              </div>

              {/* Aging buckets chart */}
              {overdueByBucket.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Aging Distribution</p>
                  <ChartContainer
                    config={{ total: { label: "Amount", color: "hsl(0 84% 60%)" } }}
                    className="h-[120px] w-full !aspect-auto"
                  >
                    <BarChart data={overdueByBucket}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                      <XAxis dataKey="label" axisLine={false} tickLine={false} className="text-[10px]" />
                      <YAxis axisLine={false} tickLine={false} width={55} className="text-[10px]" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={32}>
                        {overdueByBucket.map((b, i) => (
                          <Cell key={i} fill={b.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              )}

              <Separator />

              {/* Overdue invoice list */}
              <div>
                <p className="text-xs font-semibold mb-2">Overdue Invoices — Sorted by Days</p>
                <div className="rounded-md border max-h-[35vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Due Date</TableHead>
                        <TableHead className="text-xs">Days</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueAging.map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs py-2 font-medium">{inv.v2_customers?.name || "—"}</TableCell>
                          <TableCell className="text-xs font-mono py-2">{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-xs py-2 text-red-500">{inv.due_date ? format(new Date(inv.due_date), "dd MMM yy") : "—"}</TableCell>
                          <TableCell className="py-2">
                            <Badge variant="destructive" className="text-[9px]">{inv.daysOverdue}d</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right py-2 font-semibold"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {transactions.length === 0 && (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-600">No Overdue Invoices</p>
                  <p className="text-xs text-muted-foreground">All receivables are current</p>
                </div>
              )}
            </>
          )}

          {/* ── COLLECTION DRILL-DOWN ── */}
          {type === "collection" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-green-50 border border-green-200">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Paid</p>
                  <p className="text-lg font-bold text-green-600 mt-0.5">{paidInvoices.length}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
                  <p className="text-lg font-bold text-amber-600 mt-0.5">{pendingInvoices.length}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Overdue</p>
                  <p className="text-lg font-bold text-red-600 mt-0.5">{overdueInvoices.length}</p>
                </div>
              </div>

              {/* Status breakdown donut */}
              {statusBreakdown.length > 0 && (
                <div className="flex items-center gap-6">
                  <ChartContainer
                    config={{ paid: { label: "Paid", color: "hsl(143 44% 28%)" }, sent: { label: "Sent", color: "hsl(210 80% 55%)" }, overdue: { label: "Overdue", color: "hsl(0 84% 60%)" } }}
                    className="h-[120px] w-[120px] !aspect-square shrink-0"
                  >
                    <PieChart>
                      <Pie data={statusBreakdown} cx="50%" cy="50%" innerRadius={36} outerRadius={54} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {statusBreakdown.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="space-y-1.5 flex-1">
                    {statusBreakdown.map((d) => (
                      <div key={d.name} className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
                        <span className="text-muted-foreground">{d.name}</span>
                        <span className="font-semibold ml-auto">{d.value}</span>
                        <span className="text-xs text-muted-foreground w-10 text-right">
                          {invoices.length > 0 ? ((d.value / invoices.length) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Monthly collection rate trend */}
              {collectionByMonth.length > 1 && (
                <div>
                  <p className="text-xs font-semibold mb-2">Monthly Collection Rate</p>
                  <ChartContainer
                    config={{ rate: { label: "Rate %", color: "hsl(143 44% 22%)" } }}
                    className="h-[140px] w-full !aspect-auto"
                  >
                    <BarChart data={collectionByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                      <YAxis axisLine={false} tickLine={false} width={40} className="text-[10px]" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <ChartTooltip content={<ChartTooltipContent formatter={(v) => `${v}%`} />} />
                      <ReferenceLine y={80} stroke="hsl(143 44% 28%)" strokeDasharray="4 4" />
                      <Bar dataKey="rate" fill="hsl(143 44% 22%)" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ChartContainer>
                  <p className="text-[10px] text-muted-foreground mt-1">Dashed line = 80% target collection rate</p>
                </div>
              )}

              <Separator />

              {/* All invoices list */}
              <div>
                <p className="text-xs font-semibold mb-2">All Invoices</p>
                <div className="rounded-md border max-h-[30vh] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Invoice #</TableHead>
                        <TableHead className="text-xs">Customer</TableHead>
                        <TableHead className="text-xs text-right">Amount</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.slice(0, 100).map((inv: any) => (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-mono py-2">{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-xs py-2">{inv.v2_customers?.name || "—"}</TableCell>
                          <TableCell className="text-xs text-right py-2 font-semibold"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                          <TableCell className="py-2"><InvoiceStatusBadge status={inv.status} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
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

function InvoiceStatusBadge({ status }: { status: string }) {
  const variants: Record<string, { variant: any; className: string }> = {
    paid: { variant: "default", className: "bg-green-100 text-green-700 border-green-200 hover:bg-green-100" },
    sent: { variant: "outline", className: "text-blue-600 border-blue-200" },
    overdue: { variant: "destructive", className: "" },
    draft: { variant: "outline", className: "text-muted-foreground" },
    cancelled: { variant: "outline", className: "text-muted-foreground line-through" },
  };
  const v = variants[status] || variants.draft;
  return (
    <Badge variant={v.variant} className={`text-[10px] ${v.className}`}>
      {status}
    </Badge>
  );
}

function InvoiceDetail({
  invoice,
  currency,
}: {
  invoice: any;
  currency: string;
}) {
  return (
    <div className="space-y-5 pt-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Invoice Number
          </p>
          <p className="font-mono font-medium">
            {invoice.invoice_number || "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Status
          </p>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Customer
          </p>
          <p className="font-medium">{invoice.v2_customers?.name || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Category
          </p>
          <Badge variant="outline" className="text-[10px]">
            {resolveIncomeCategory(invoice.category, invoice.v2_customers?.name, businessSector)}
          </Badge>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Invoice Date
          </p>
          <p className="text-sm">
            {invoice.invoice_date
              ? format(new Date(invoice.invoice_date), "dd MMM yyyy")
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
            Due Date
          </p>
          <p className="text-sm">
            {invoice.due_date
              ? format(new Date(invoice.due_date), "dd MMM yyyy")
              : "—"}
          </p>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span><FC amount={invoice.subtotal || 0} currency={currency} /></span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Tax</span>
          <span><FC amount={invoice.tax_amount || 0} currency={currency} /></span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="text-primary">
            <FC amount={invoice.total || 0} currency={currency} />
          </span>
        </div>
      </div>

      {invoice.notes && (
        <>
          <Separator />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
              Notes
            </p>
            <p className="text-sm">{invoice.notes}</p>
          </div>
        </>
      )}
    </div>
  );
}

// ── Payments & Collections Tab ────────────────────────────────────────────

function guessUnallocatedReason(txn: any): { reason: string; color: string } {
  const desc = (txn.description || "").toLowerCase();
  const cat = (txn.category || "").toLowerCase();
  const amt = txn.amount || 0;

  if (/transfer|tfr|ibft|internal|own account/i.test(desc))
    return { reason: "Internal Transfer", color: "text-slate-500" };
  if (/refund|reversal|return|chargeback/i.test(desc))
    return { reason: "Refund / Reversal", color: "text-purple-500" };
  if (/interest|profit|dividend/i.test(desc))
    return { reason: "Interest / Profit", color: "text-teal-500" };
  if (/atm|cash deposit|ccdm|cdm/i.test(desc))
    return { reason: "Cash Deposit", color: "text-cyan-600" };
  if (/salary|wage|wps/i.test(desc))
    return { reason: "Salary Credit", color: "text-indigo-500" };
  if (cat.includes("transfer") || cat.includes("banking") || cat.includes("finance"))
    return { reason: "Banking Transaction", color: "text-slate-500" };
  if (amt < 100)
    return { reason: "Small / Miscellaneous", color: "text-gray-400" };
  return { reason: "No Matching Invoice", color: "text-amber-500" };
}

function guessOverpaymentReason(a: { txn: any; invoice: any; diff: number }, currency: string): { reason: string; detail: string; color: string } {
  const invAmt = a.invoice?.total || 0;
  const rxAmt = a.txn?.amount || 0;
  const pct = invAmt > 0 ? ((a.diff / invAmt) * 100) : 0;
  const pctStr = pct.toFixed(1);
  const daysDiff = a.txn?.transaction_date && a.invoice?.invoice_date
    ? Math.abs(Math.round((new Date(a.txn.transaction_date).getTime() - new Date(a.invoice.invoice_date).getTime()) / 86400000))
    : null;
  const dateNote = daysDiff !== null ? ` Payment received ${daysDiff} day${daysDiff === 1 ? "" : "s"} after invoice.` : "";

  if (pct < 1)
    return { reason: "Rounding / Fee", detail: `Excess is only ${pctStr}% of invoice total — likely a rounding difference or bank fee adjustment.${dateNote}`, color: "text-gray-500" };
  if (pct <= 5)
    return { reason: "VAT / Service Charge", detail: `${pctStr}% over invoice — excess of ${formatAmount(a.diff, currency)} may include VAT adjustment, service charges, or late-fee credit.${dateNote}`, color: "text-amber-500" };
  return { reason: "Excess Payment", detail: `Customer paid ${pctStr}% more than invoiced (${formatAmount(rxAmt, currency)} received vs ${formatAmount(invAmt, currency)} invoiced). May be an advance payment, credit on account, or data entry error.${dateNote}`, color: "text-blue-500" };
}

function PaymentsCollectionsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const [drillDown, setDrillDown] = useState<{ type: string; title: string; description: string; items: any[] } | null>(null);

  const { data: invoices = [] } = useQuery({
    queryKey: ["rev-invoices-pay", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["rev-txns-pay", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string; limit: number } = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const incomeTxns = useMemo(() => {
    // Exclude non-customer-payment income: internal transfers, cash deposits, banking transactions
    const NON_PAYMENT_RE = /\b(transfer|tfr|ibft|mobn|internal|own account|between accounts|neft|rtgs|atm|cash deposit|ccdm|cdm|deposit machine|interest|profit|dividend|salary|wage|wps|refund|reversal|return|chargeback)\b/i;
    const NON_PAYMENT_CATS = new Set(["internal transfer", "finance & banking", "atm & cash deposits", "salary & wages"]);

    return transactions
      .filter((t: any) => {
        if (t.amount <= 0) return false;
        const desc = (t.description || "").toLowerCase();
        const cat = (t.category || "").toLowerCase();
        // Exclude if description matches non-payment patterns
        if (NON_PAYMENT_RE.test(desc)) return false;
        // Exclude if category is a known non-payment type
        if (NON_PAYMENT_CATS.has(cat)) return false;
        return true;
      })
      .sort((a: any, b: any) => (b.transaction_date || "").localeCompare(a.transaction_date || ""));
  }, [transactions]);

  const { allocated, unallocated, underpayments, overpayments } = useMemo(() => {
    const alloc: { txn: any; invoice: any; diff: number }[] = [];
    const unalloc: any[] = [];
    const matchedInvIds = new Set<string>();

    incomeTxns.forEach((txn: any) => {
      let bestMatch: any = null;
      let bestDiff = Infinity;
      invoices.forEach((inv: any) => {
        if (matchedInvIds.has(inv.id)) return;
        if (inv.status === "cancelled") return;
        const amtDiff = Math.abs(txn.amount - (inv.total || 0));
        const pctDiff = inv.total ? amtDiff / inv.total : 1;
        if (pctDiff > 0.10) return;
        const daysDiff = inv.invoice_date
          ? Math.abs(differenceInDays(new Date(txn.transaction_date), new Date(inv.invoice_date)))
          : 999;
        if (daysDiff > 30) return;
        if (daysDiff < bestDiff) {
          bestDiff = daysDiff;
          bestMatch = inv;
        }
      });
      if (bestMatch) {
        matchedInvIds.add(bestMatch.id);
        alloc.push({ txn, invoice: bestMatch, diff: txn.amount - (bestMatch.total || 0) });
      } else {
        unalloc.push(txn);
      }
    });

    const under = invoices.filter(
      (i: any) => i.status === "partial" && i.amount_paid != null && i.amount_paid < (i.total || 0),
    );
    const over = alloc.filter((a) => a.diff > 0.01);

    return { allocated: alloc, unallocated: unalloc, underpayments: under, overpayments: over };
  }, [incomeTxns, invoices]);

  // Reason breakdown for unallocated
  const unallocatedByReason = useMemo(() => {
    const map: Record<string, { items: any[]; color: string; total: number }> = {};
    unallocated.forEach((txn: any) => {
      const { reason, color } = guessUnallocatedReason(txn);
      if (!map[reason]) map[reason] = { items: [], color, total: 0 };
      map[reason].items.push(txn);
      map[reason].total += txn.amount || 0;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.total - a.total);
  }, [unallocated]);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return d || "—"; }
  };

  if (transactions.length === 0 && invoices.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ArrowRightLeft className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Payment Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements and create invoices to track payment allocation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Allocated" value={allocated.length.toString()} icon={CheckCircle2} color="text-green-600" sub="matched to invoices"
          onClick={() => setDrillDown({
            type: "allocated",
            title: "Allocated Payments",
            description: `${allocated.length} payments matched to invoices · ${formatAmount(allocated.reduce((s, a) => s + (a.txn.amount || 0), 0), currency)} total`,
            items: allocated,
          })}
        />
        <KPICard
          label="Unallocated" value={unallocated.length.toString()} icon={AlertTriangle}
          color={unallocated.length > 0 ? "text-amber-500" : "text-green-600"} sub="no matching invoice"
          onClick={() => setDrillDown({
            type: "unallocated",
            title: "Unallocated Payments",
            description: `${unallocated.length} payments with no matching invoice · ${formatAmount(unallocated.reduce((s, t) => s + (t.amount || 0), 0), currency)} total`,
            items: unallocated,
          })}
        />
        <KPICard
          label="Underpayments" value={underpayments.length.toString()} icon={TrendingDown}
          color={underpayments.length > 0 ? "text-red-500" : "text-green-600"} sub="partial payments"
          onClick={() => setDrillDown({
            type: "underpayments",
            title: "Underpayments",
            description: `${underpayments.length} invoices partially paid · ${formatAmount(underpayments.reduce((s, i) => s + ((i.total || 0) - (i.amount_paid || 0)), 0), currency)} shortfall`,
            items: underpayments,
          })}
        />
        <KPICard
          label="Overpayments" value={overpayments.length.toString()} icon={TrendingUp}
          color={overpayments.length > 0 ? "text-blue-500" : "text-green-600"} sub="excess received"
          onClick={() => setDrillDown({
            type: "overpayments",
            title: "Overpayments",
            description: `${overpayments.length} payments exceeding invoice total · ${formatAmount(overpayments.reduce((s, a) => s + a.diff, 0), currency)} excess`,
            items: overpayments,
          })}
        />
      </div>

      {/* Allocated Payments */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-green-600">Payment Allocation</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {allocated.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <p className="text-sm text-muted-foreground">No payments allocated to invoices yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bank Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Allocated To</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocated.slice(0, 30).map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(a.txn.transaction_date)}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{a.txn.description || "—"}</TableCell>
                    <TableCell className="text-right font-semibold text-sm text-green-600"><FC amount={a.txn.amount} currency={currency} /></TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {a.invoice.invoice_number || `INV-${a.invoice.id?.slice(0, 6)}`}
                      </Badge>
                    </TableCell>
                    <TableCell className={`text-right text-sm ${Math.abs(a.diff) < 0.01 ? "text-green-600" : "text-amber-500"}`}>
                      {Math.abs(a.diff) < 0.01 ? "Exact" : <FC amount={a.diff} currency={currency} />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Unallocated Payments — with reason breakdown */}
      {unallocated.length > 0 && (
        <Card className="stat-card-hover border-amber-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-amber-600">Unallocated Payments ({unallocated.length})</CardTitle>
              <p className="text-xs text-muted-foreground"><FC amount={unallocated.reduce((s: number, t: any) => s + (t.amount || 0), 0)} currency={currency} /> total</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Reason breakdown pills */}
            <div className="flex items-center gap-2 flex-wrap">
              {unallocatedByReason.map(([reason, { items, color, total }]) => (
                <Badge key={reason} variant="outline" className={`text-[10px] gap-1 cursor-default ${color}`}>
                  {reason}: {items.length} (<FC amount={total} currency={currency} />)
                </Badge>
              ))}
            </div>

            {/* Table with reason column */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unallocated.map((txn: any, i: number) => {
                    const { reason, color } = guessUnallocatedReason(txn);
                    return (
                      <TableRow key={i} className="bg-amber-50/30">
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDate(txn.transaction_date)}</TableCell>
                        <TableCell className="text-sm max-w-[250px] truncate">{txn.description || "—"}</TableCell>
                        <TableCell className="text-right font-semibold text-sm"><FC amount={txn.amount} currency={currency} /></TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] ${color}`}>{reason}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Underpayments */}
      {underpayments.length > 0 && (
        <Card className="stat-card-hover border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Underpayments ({underpayments.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Shortfall</TableHead>
                  <TableHead>% Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {underpayments.map((inv: any) => {
                  const shortfall = (inv.total || 0) - (inv.amount_paid || 0);
                  const pctPaid = inv.total ? ((inv.amount_paid || 0) / inv.total) * 100 : 0;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="text-xs font-mono">{inv.invoice_number || "—"}</TableCell>
                      <TableCell className="text-sm">{inv.customers?.name || inv.customer_name || "—"}</TableCell>
                      <TableCell className="text-right text-sm"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                      <TableCell className="text-right text-sm text-green-600"><FC amount={inv.amount_paid || 0} currency={currency} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold text-red-500"><FC amount={shortfall} currency={currency} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{pctPaid.toFixed(0)}%</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Overpayments */}
      {overpayments.length > 0 && (
        <Card className="stat-card-hover border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-500">Overpayments ({overpayments.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Invoice</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Excess</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overpayments.map((a: any, i: number) => {
                  const r = guessOverpaymentReason(a, currency);
                  return (
                    <TableRow key={i} className="bg-blue-50/30">
                      <TableCell className="text-sm">{a.invoice?.v2_customers?.name || "—"}</TableCell>
                      <TableCell className="text-right text-sm"><FC amount={a.invoice?.total || 0} currency={currency} /></TableCell>
                      <TableCell className="text-right text-sm text-green-600"><FC amount={a.txn?.amount || 0} currency={currency} /></TableCell>
                      <TableCell className="text-right text-sm font-semibold text-blue-500"><FC amount={a.diff} currency={currency} /></TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${r.color}`}>{r.reason}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[200px]">{r.detail}</p>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ── KPI Drill-Down Sheet ── */}
      <Sheet open={!!drillDown} onOpenChange={() => setDrillDown(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drillDown?.title}</SheetTitle>
            <SheetDescription>{drillDown?.description}</SheetDescription>
          </SheetHeader>
          {drillDown && (
            <div className="space-y-4 pt-4">
              {/* ── Allocated drill-down ── */}
              {drillDown.type === "allocated" && (
                <>
                  {/* Summary donut-like breakdown */}
                  <div className="grid grid-cols-2 gap-3">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-green-600">{drillDown.items.filter((a: any) => Math.abs(a.diff) < 0.01).length}</p>
                        <p className="text-xs text-muted-foreground">Exact Matches</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <p className="text-2xl font-bold text-amber-500">{drillDown.items.filter((a: any) => Math.abs(a.diff) >= 0.01).length}</p>
                        <p className="text-xs text-muted-foreground">Approximate Matches</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Payment</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Diff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(drillDown.items as any[]).map((a: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs whitespace-nowrap">{fmtDate(a.txn?.transaction_date)}</TableCell>
                          <TableCell className="text-xs max-w-[160px] truncate">{a.txn?.description || "—"}</TableCell>
                          <TableCell className="text-right text-xs font-semibold text-green-600"><FC amount={a.txn?.amount || 0} currency={currency} /></TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="outline" className="text-[9px]">{a.invoice?.invoice_number || "—"}</Badge>
                          </TableCell>
                          <TableCell className={`text-right text-xs ${Math.abs(a.diff) < 0.01 ? "text-green-600" : "text-amber-500"}`}>
                            {Math.abs(a.diff) < 0.01 ? "Exact" : <FC amount={a.diff} currency={currency} />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {/* ── Unallocated drill-down ── */}
              {drillDown.type === "unallocated" && (
                <>
                  {/* Reason breakdown cards */}
                  <div className="grid grid-cols-2 gap-3">
                    {unallocatedByReason.map(([reason, { items, color, total }]) => (
                      <Card key={reason}>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-semibold ${color}`}>{items.length}</p>
                            <p className="text-xs text-muted-foreground"><FC amount={total} currency={currency} /></p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{reason}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <Separator />

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(drillDown.items as any[]).map((txn: any, i: number) => {
                        const { reason, color } = guessUnallocatedReason(txn);
                        return (
                          <TableRow key={i}>
                            <TableCell className="text-xs whitespace-nowrap">{fmtDate(txn.transaction_date)}</TableCell>
                            <TableCell className="text-xs max-w-[180px] truncate">{txn.description || "—"}</TableCell>
                            <TableCell className="text-right text-xs font-semibold"><FC amount={txn.amount} currency={currency} /></TableCell>
                            <TableCell><Badge variant="outline" className={`text-[9px] ${color}`}>{reason}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </>
              )}

              {/* ── Underpayments drill-down ── */}
              {drillDown.type === "underpayments" && (
                <>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-red-500">
                        <FC amount={(drillDown.items as any[]).reduce((s: number, i: any) => s + ((i.total || 0) - (i.amount_paid || 0)), 0)} currency={currency} />
                      </p>
                      <p className="text-xs text-muted-foreground">Total Shortfall</p>
                    </CardContent>
                  </Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Shortfall</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(drillDown.items as any[]).map((inv: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">{inv.invoice_number || "—"}</TableCell>
                          <TableCell className="text-xs">{inv.customers?.name || inv.customer_name || "—"}</TableCell>
                          <TableCell className="text-right text-xs"><FC amount={inv.total || 0} currency={currency} /></TableCell>
                          <TableCell className="text-right text-xs text-green-600"><FC amount={inv.amount_paid || 0} currency={currency} /></TableCell>
                          <TableCell className="text-right text-xs font-semibold text-red-500"><FC amount={(inv.total || 0) - (inv.amount_paid || 0)} currency={currency} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {/* ── Overpayments drill-down ── */}
              {drillDown.type === "overpayments" && (
                <>
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <p className="text-2xl font-bold text-blue-500">
                        <FC amount={(drillDown.items as any[]).reduce((s: number, a: any) => s + (a.diff || 0), 0)} currency={currency} />
                      </p>
                      <p className="text-xs text-muted-foreground">Total Excess Received</p>
                    </CardContent>
                  </Card>
                  {(drillDown.items as any[]).map((a: any, i: number) => {
                    const r = guessOverpaymentReason(a, currency);
                    return (
                      <Card key={i} className="border-blue-100">
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium">{a.invoice?.v2_customers?.name || "Unknown Customer"}</p>
                              <p className="text-xs text-muted-foreground">
                                Invoice {a.invoice?.invoice_number || "—"}
                                {a.invoice?.invoice_date && ` · ${format(new Date(a.invoice.invoice_date + "T00:00:00"), "dd MMM yyyy")}`}
                              </p>
                            </div>
                            <Badge variant="outline" className={`text-[10px] shrink-0 ${r.color}`}>{r.reason}</Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-1.5 rounded bg-muted/50">
                              <p className="text-[10px] text-muted-foreground uppercase">Invoiced</p>
                              <p className="text-sm font-semibold"><FC amount={a.invoice?.total || 0} currency={currency} /></p>
                            </div>
                            <div className="p-1.5 rounded bg-green-50">
                              <p className="text-[10px] text-muted-foreground uppercase">Received</p>
                              <p className="text-sm font-semibold text-green-600"><FC amount={a.txn?.amount || 0} currency={currency} /></p>
                            </div>
                            <div className="p-1.5 rounded bg-blue-50">
                              <p className="text-[10px] text-muted-foreground uppercase">Excess</p>
                              <p className="text-sm font-semibold text-blue-500"><FC amount={a.diff} currency={currency} /></p>
                            </div>
                          </div>
                          <div className="bg-muted/30 rounded p-2">
                            <p className="text-xs text-muted-foreground">{r.detail}</p>
                          </div>
                          {a.txn?.transaction_date && (
                            <p className="text-[10px] text-muted-foreground">
                              Payment on {format(new Date(a.txn.transaction_date), "dd MMM yyyy")}
                              {a.txn.description && ` · ${a.txn.description.slice(0, 60)}${a.txn.description.length > 60 ? "..." : ""}`}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Revenue Variance Tab ─────────────────────────────────────────────────

function guessAnomalyReasons(monthTxns: any[], prevMonthTxns: any[], status: string, changePct: number): { reason: string; detail: string; color: string }[] {
  const reasons: { reason: string; detail: string; color: string }[] = [];
  if (monthTxns.length === 0) return [{ reason: "No Transactions", detail: "No income recorded this month", color: "text-gray-500" }];

  // Category breakdown this month vs prev
  const catThis: Record<string, number> = {};
  const catPrev: Record<string, number> = {};
  monthTxns.forEach((t: any) => { const c = t.category || "Other"; catThis[c] = (catThis[c] || 0) + t.amount; });
  prevMonthTxns.forEach((t: any) => { const c = t.category || "Other"; catPrev[c] = (catPrev[c] || 0) + t.amount; });

  // Find biggest contributors to change
  const allCats = new Set([...Object.keys(catThis), ...Object.keys(catPrev)]);
  const catChanges: { cat: string; diff: number; pct: number }[] = [];
  allCats.forEach((cat) => {
    const curr = catThis[cat] || 0;
    const prev = catPrev[cat] || 0;
    if (prev > 0 || curr > 0) catChanges.push({ cat, diff: curr - prev, pct: prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0 });
  });
  catChanges.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  // Top contributor
  if (catChanges.length > 0) {
    const top = catChanges[0];
    if (status === "spike" && top.diff > 0) {
      reasons.push({ reason: `${top.cat} Surge`, detail: `${top.cat} increased by ${top.pct.toFixed(0)}%`, color: "text-blue-600" });
    } else if (status === "drop" && top.diff < 0) {
      reasons.push({ reason: `${top.cat} Decline`, detail: `${top.cat} decreased by ${Math.abs(top.pct).toFixed(0)}%`, color: "text-red-500" });
    }
  }

  // Large single transactions
  const sorted = [...monthTxns].sort((a: any, b: any) => b.amount - a.amount);
  const totalMonth = monthTxns.reduce((s: number, t: any) => s + t.amount, 0);
  if (sorted.length > 0 && sorted[0].amount > totalMonth * 0.3) {
    reasons.push({ reason: "Large Single Payment", detail: `${sorted[0].description?.slice(0, 40) || "Transaction"} accounts for ${((sorted[0].amount / totalMonth) * 100).toFixed(0)}% of month`, color: "text-purple-500" });
  }

  // New sources appearing
  const newCats = Object.keys(catThis).filter((c) => !catPrev[c] && catThis[c] > 0);
  if (newCats.length > 0 && status === "spike") {
    reasons.push({ reason: "New Revenue Source", detail: `${newCats.join(", ")} appeared this month`, color: "text-teal-500" });
  }

  // Lost sources
  const lostCats = Object.keys(catPrev).filter((c) => !catThis[c] && catPrev[c] > 0);
  if (lostCats.length > 0 && status === "drop") {
    reasons.push({ reason: "Lost Revenue Source", detail: `${lostCats.join(", ")} had no income this month`, color: "text-orange-500" });
  }

  // Transaction count change
  if (prevMonthTxns.length > 0) {
    const countChange = ((monthTxns.length - prevMonthTxns.length) / prevMonthTxns.length) * 100;
    if (Math.abs(countChange) > 30) {
      reasons.push({
        reason: countChange > 0 ? "More Transactions" : "Fewer Transactions",
        detail: `${monthTxns.length} vs ${prevMonthTxns.length} last month (${countChange > 0 ? "+" : ""}${countChange.toFixed(0)}%)`,
        color: countChange > 0 ? "text-blue-500" : "text-red-400",
      });
    }
  }

  // Seasonality hint
  if (reasons.length === 0) {
    reasons.push({ reason: "Possible Seasonality", detail: `Revenue ${status === "spike" ? "surge" : "dip"} may reflect seasonal patterns`, color: "text-slate-500" });
  }

  return reasons;
}

function RevenueVarianceTab() {
  const { clientId, currency, client } = useActiveClient();
  const businessSector = client?.industry || null;
  const { startDate, endDate } = useDateRange();
  const [drillDown, setDrillDown] = useState<{ type: string; title: string; description: string; data?: any } | null>(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["rev-txns-var", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string; limit: number } = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  // Group income txns by month
  const txnsByMonth = useMemo(() => {
    const map: Record<string, any[]> = {};
    transactions.filter((t: any) => t.amount > 0).forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) { if (!map[m]) map[m] = []; map[m].push(t); }
    });
    return map;
  }, [transactions]);

  const { monthlyComparison, anomalies, trendData, sigma } = useMemo(() => {
    if (transactions.length === 0) return { monthlyComparison: [], anomalies: [], trendData: [], sigma: 0 };

    const monthly: Record<string, number> = {};
    transactions.filter((t: any) => t.amount > 0).forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) monthly[m] = (monthly[m] || 0) + t.amount;
    });

    const sorted = Object.entries(monthly).sort(([a], [b]) => a.localeCompare(b));
    const vals = sorted.map(([, v]) => v);
    const mean = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    const std = vals.length > 1 ? Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length) : 0;

    const comp = sorted.map(([month, rev], i) => {
      const prev = i > 0 ? sorted[i - 1][1] : 0;
      const changeAmt = i > 0 ? rev - prev : 0;
      const changePct = i > 0 && prev > 0 ? (changeAmt / prev) * 100 : 0;
      const zScore = std > 0 ? (rev - mean) / std : 0;
      const status = zScore > 2 ? "spike" : zScore < -2 ? "drop" : "normal";
      const prevMonth = i > 0 ? sorted[i - 1][0] : "";
      const reasons = status !== "normal" ? guessAnomalyReasons(txnsByMonth[month] || [], txnsByMonth[prevMonth] || [], status, changePct) : [];
      return { month, revenue: rev, prevRevenue: prev, changeAmt, changePct, zScore, status, txnCount: (txnsByMonth[month] || []).length, reasons };
    });

    const anom = comp.filter((c) => c.status !== "normal");
    const trend = sorted.map(([m, v]) => ({
      month: format(new Date(m + "-01"), "MMM yy"),
      rawMonth: m,
      revenue: v,
      upper: mean + 2 * std,
      lower: Math.max(0, mean - 2 * std),
      mean,
    }));

    return { monthlyComparison: comp, anomalies: anom, trendData: trend, sigma: std };
  }, [transactions, txnsByMonth]);

  const spikes = anomalies.filter((a) => a.status === "spike");
  const drops = anomalies.filter((a) => a.status === "drop");

  const trendConfig: ChartConfig = {
    revenue: { label: "Revenue", color: "hsl(143 44% 28%)" },
    upper: { label: "+2σ", color: "hsl(0 84% 55%)" },
    lower: { label: "-2σ", color: "hsl(0 84% 55%)" },
  };

  const fmtMonth = (m: string) => { try { return format(new Date(m + "-01"), "MMM yyyy"); } catch { return m; } };

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileWarning className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Revenue Variance Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Need at least 2 months of transaction data for variance analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Clickable KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Months Tracked" value={monthlyComparison.length.toString()} icon={Calendar} color="text-primary"
          onClick={() => setDrillDown({
            type: "months",
            title: "Monthly Revenue Breakdown",
            description: `${monthlyComparison.length} months tracked · Avg: ${formatAmount(monthlyComparison.length > 0 ? monthlyComparison.reduce((s, m) => s + m.revenue, 0) / monthlyComparison.length : 0, currency)}/mo`,
          })}
        />
        <KPICard
          label="Anomalies" value={anomalies.length.toString()} icon={Zap}
          color={anomalies.length > 0 ? "text-red-500" : "text-green-600"} sub="outside ±2σ"
          onClick={() => setDrillDown({
            type: "anomalies",
            title: "All Anomalies",
            description: `${anomalies.length} months outside ±2 standard deviations (σ = ${formatAmount(sigma, currency)})`,
          })}
        />
        <KPICard
          label="Spikes" value={spikes.length.toString()} icon={TrendingUp} color="text-blue-500" sub="revenue surges"
          onClick={() => spikes.length > 0 && setDrillDown({
            type: "spikes",
            title: "Revenue Spikes",
            description: `${spikes.length} month${spikes.length !== 1 ? "s" : ""} with unusually high revenue`,
          })}
        />
        <KPICard
          label="Drops" value={drops.length.toString()} icon={TrendingDown} color="text-red-500" sub="revenue drops"
          onClick={() => drops.length > 0 && setDrillDown({
            type: "drops",
            title: "Revenue Drops",
            description: `${drops.length} month${drops.length !== 1 ? "s" : ""} with unusually low revenue`,
          })}
        />
      </div>

      {/* Trend Chart with sigma band */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Revenue Trend with ±2σ Band</CardTitle>
        </CardHeader>
        <CardContent>
          {trendData.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-muted-foreground">Not enough data</p>
            </div>
          ) : (
            <ChartContainer config={trendConfig} className="h-[220px] w-full !aspect-auto">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="revVarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(143 44% 28%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(143 44% 28%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                <YAxis axisLine={false} tickLine={false} width={65} className="text-[10px]" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Area type="monotone" dataKey="upper" stroke="none" fill="hsl(0 84% 55%)" fillOpacity={0.06} />
                <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={1} />
                <ReferenceLine y={trendData[0]?.mean || 0} stroke="hsl(0 0% 60%)" strokeDasharray="4 4" label="" />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(143 44% 28%)"
                  strokeWidth={2.5}
                  fill="url(#revVarGrad)"
                  dot={(props: any) => {
                    const upper = trendData[props.index]?.upper || 0;
                    const lower = trendData[props.index]?.lower || 0;
                    const isOutlier = props.payload.revenue > upper || props.payload.revenue < lower;
                    return (
                      <circle
                        cx={props.cx}
                        cy={props.cy}
                        r={isOutlier ? 5 : 3}
                        fill={isOutlier ? "hsl(0 84% 55%)" : "hsl(143 44% 28%)"}
                        stroke={isOutlier ? "hsl(0 84% 55%)" : "none"}
                        strokeWidth={isOutlier ? 2 : 0}
                        style={{ cursor: "pointer" }}
                        onClick={() => {
                          const raw = trendData[props.index]?.rawMonth;
                          const comp = monthlyComparison.find((c) => c.month === raw);
                          if (comp) setDrillDown({ type: "month-detail", title: fmtMonth(comp.month), description: `Revenue: ${formatAmount(comp.revenue, currency)} · ${comp.txnCount} transactions · Z-Score: ${comp.zScore.toFixed(2)}`, data: comp });
                        }}
                      />
                    );
                  }}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Period Comparison Table */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Monthly Revenue Comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Prev Month</TableHead>
                <TableHead className="text-right">Change</TableHead>
                <TableHead className="text-right">Change %</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyComparison.map((row, i) => (
                <TableRow
                  key={row.month}
                  className={`cursor-pointer hover:bg-muted/50 ${row.status !== "normal" ? "bg-red-50/30" : ""}`}
                  onClick={() => setDrillDown({ type: "month-detail", title: fmtMonth(row.month), description: `Revenue: ${formatAmount(row.revenue, currency)} · ${row.txnCount} transactions`, data: row })}
                >
                  <TableCell className="text-sm font-medium">{fmtMonth(row.month)}</TableCell>
                  <TableCell className="text-right text-sm font-semibold"><FC amount={row.revenue} currency={currency} /></TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {i > 0 ? <FC amount={row.prevRevenue} currency={currency} /> : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm ${row.changeAmt >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {i > 0 ? <FC amount={Math.abs(row.changeAmt)} currency={currency} /> : "—"}
                  </TableCell>
                  <TableCell className={`text-right text-sm font-semibold ${row.changePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                    {i > 0 ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(1)}%` : "—"}
                  </TableCell>
                  <TableCell>
                    {row.status === "spike" ? (
                      <Badge className="text-[9px] bg-blue-100 text-blue-700 border-blue-200" variant="outline">
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />Spike
                      </Badge>
                    ) : row.status === "drop" ? (
                      <Badge className="text-[9px] bg-red-100 text-red-600 border-red-200" variant="outline">
                        <ArrowDownRight className="h-3 w-3 mr-0.5" />Drop
                      </Badge>
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

      {/* Anomaly Details with Reasons */}
      {anomalies.length > 0 && (
        <Card className="stat-card-hover border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-500">Anomaly Flags ({anomalies.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {anomalies.map((a) => (
                <div
                  key={a.month}
                  className="py-3 px-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => setDrillDown({ type: "month-detail", title: fmtMonth(a.month), description: `Revenue: ${formatAmount(a.revenue, currency)} · Z-Score: ${a.zScore.toFixed(2)}`, data: a })}
                >
                  <div className="flex items-center gap-3">
                    {a.status === "spike" ? (
                      <ArrowUpRight className="h-5 w-5 text-blue-500 shrink-0" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5 text-red-500 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{format(new Date(a.month + "-01"), "MMMM yyyy")}</p>
                      <p className="text-xs text-muted-foreground">
                        Revenue: <FC amount={a.revenue} currency={currency} /> — Z-Score: {a.zScore.toFixed(2)}
                      </p>
                    </div>
                    <Badge variant={a.status === "spike" ? "default" : "destructive"} className="text-[10px]">
                      {a.status === "spike" ? `+${a.changePct.toFixed(0)}%` : `${a.changePct.toFixed(0)}%`}
                    </Badge>
                  </div>
                  {/* Reasons */}
                  {a.reasons && a.reasons.length > 0 && (
                    <div className="mt-2 ml-8 space-y-1">
                      {a.reasons.map((r: any, ri: number) => (
                        <div key={ri} className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${r.color.replace("text-", "bg-")}`} />
                          <div>
                            <span className={`text-xs font-semibold ${r.color}`}>{r.reason}</span>
                            <span className="text-xs text-muted-foreground ml-1">— {r.detail}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Drill-Down Sheet ── */}
      <Sheet open={!!drillDown} onOpenChange={() => setDrillDown(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{drillDown?.title}</SheetTitle>
            <SheetDescription>{drillDown?.description}</SheetDescription>
          </SheetHeader>
          {drillDown && (
            <div className="space-y-4 pt-4">
              {/* ── Months overview ── */}
              {drillDown.type === "months" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Card><CardContent className="pt-3 text-center">
                      <p className="text-lg font-bold text-primary">{monthlyComparison.length}</p>
                      <p className="text-[10px] text-muted-foreground">Months</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 text-center">
                      <p className="text-lg font-bold text-green-600"><FC amount={Math.max(...monthlyComparison.map((m) => m.revenue), 0)} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Peak</p>
                    </CardContent></Card>
                    <Card><CardContent className="pt-3 text-center">
                      <p className="text-lg font-bold text-amber-500"><FC amount={Math.min(...monthlyComparison.map((m) => m.revenue), 0)} currency={currency} /></p>
                      <p className="text-[10px] text-muted-foreground">Lowest</p>
                    </CardContent></Card>
                  </div>
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Txns</TableHead>
                      <TableHead className="text-right">Change %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {monthlyComparison.map((row, i) => (
                        <TableRow key={row.month} className="cursor-pointer hover:bg-muted/50" onClick={() => setDrillDown({ type: "month-detail", title: fmtMonth(row.month), description: `Revenue: ${formatAmount(row.revenue, currency)} · ${row.txnCount} transactions`, data: row })}>
                          <TableCell className="text-xs font-medium">{fmtMonth(row.month)}</TableCell>
                          <TableCell className="text-right text-xs font-semibold"><FC amount={row.revenue} currency={currency} /></TableCell>
                          <TableCell className="text-right text-xs">{row.txnCount}</TableCell>
                          <TableCell className={`text-right text-xs ${row.changePct >= 0 ? "text-green-600" : "text-red-500"}`}>{i > 0 ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(1)}%` : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[9px] ${row.status === "spike" ? "text-blue-600" : row.status === "drop" ? "text-red-500" : "text-green-600"}`}>{row.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {/* ── Anomalies / Spikes / Drops list ── */}
              {(drillDown.type === "anomalies" || drillDown.type === "spikes" || drillDown.type === "drops") && (() => {
                const list = drillDown.type === "spikes" ? spikes : drillDown.type === "drops" ? drops : anomalies;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <Card><CardContent className="pt-3 text-center">
                        <p className="text-lg font-bold text-blue-500">{list.filter((a) => a.status === "spike").length}</p>
                        <p className="text-[10px] text-muted-foreground">Spikes</p>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 text-center">
                        <p className="text-lg font-bold text-red-500">{list.filter((a) => a.status === "drop").length}</p>
                        <p className="text-[10px] text-muted-foreground">Drops</p>
                      </CardContent></Card>
                    </div>
                    <div className="space-y-3">
                      {list.map((a) => (
                        <div
                          key={a.month}
                          className="py-3 px-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setDrillDown({ type: "month-detail", title: fmtMonth(a.month), description: `Revenue: ${formatAmount(a.revenue, currency)} · Z-Score: ${a.zScore.toFixed(2)}`, data: a })}
                        >
                          <div className="flex items-center gap-3">
                            {a.status === "spike" ? <ArrowUpRight className="h-4 w-4 text-blue-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                            <div className="flex-1">
                              <p className="text-sm font-semibold">{fmtMonth(a.month)}</p>
                              <p className="text-xs text-muted-foreground"><FC amount={a.revenue} currency={currency} /> · {a.txnCount} txns · Z: {a.zScore.toFixed(2)}</p>
                            </div>
                            <Badge variant={a.status === "spike" ? "default" : "destructive"} className="text-[10px]">
                              {a.changePct >= 0 ? "+" : ""}{a.changePct.toFixed(0)}%
                            </Badge>
                          </div>
                          {a.reasons && a.reasons.length > 0 && (
                            <div className="mt-2 ml-7 space-y-1">
                              {a.reasons.map((r: any, ri: number) => (
                                <div key={ri} className="flex items-start gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${r.color.replace("text-", "bg-")}`} />
                                  <span className="text-xs"><span className={`font-semibold ${r.color}`}>{r.reason}</span> — {r.detail}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              {/* ── Single month detail ── */}
              {drillDown.type === "month-detail" && drillDown.data && (() => {
                const row = drillDown.data;
                const monthTxns = txnsByMonth[row.month] || [];
                // Category breakdown
                const catBreak: Record<string, { count: number; total: number }> = {};
                monthTxns.forEach((t: any) => {
                  const c = resolveIncomeCategory(t.category, t.counterparty_name, businessSector) || "Other";
                  if (!catBreak[c]) catBreak[c] = { count: 0, total: 0 };
                  catBreak[c].count++;
                  catBreak[c].total += t.amount;
                });
                const catSorted = Object.entries(catBreak).sort(([, a], [, b]) => b.total - a.total);

                return (
                  <>
                    {/* Summary cards */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card><CardContent className="pt-3 text-center">
                        <p className="text-lg font-bold"><FC amount={row.revenue} currency={currency} /></p>
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 text-center">
                        <p className="text-lg font-bold">{row.txnCount}</p>
                        <p className="text-[10px] text-muted-foreground">Transactions</p>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 text-center">
                        <p className={`text-lg font-bold ${row.status === "spike" ? "text-blue-500" : row.status === "drop" ? "text-red-500" : "text-green-600"}`}>
                          {row.zScore.toFixed(2)}σ
                        </p>
                        <p className="text-[10px] text-muted-foreground">Z-Score</p>
                      </CardContent></Card>
                    </div>

                    {/* MoM change */}
                    {row.prevRevenue > 0 && (
                      <Card>
                        <CardContent className="pt-3 pb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">vs Previous Month</span>
                            <span className={`text-sm font-bold ${row.changePct >= 0 ? "text-green-600" : "text-red-500"}`}>
                              {row.changePct >= 0 ? "+" : ""}{row.changePct.toFixed(1)}% (<FC amount={Math.abs(row.changeAmt)} currency={currency} />)
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Anomaly reasons */}
                    {row.reasons && row.reasons.length > 0 && (
                      <Card className="border-amber-200">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-semibold text-amber-600">Possible Reasons</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {row.reasons.map((r: any, ri: number) => (
                            <div key={ri} className="flex items-start gap-2.5 py-1.5 px-2 rounded bg-muted/40">
                              <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${r.color.replace("text-", "bg-")}`} />
                              <div>
                                <p className={`text-xs font-semibold ${r.color}`}>{r.reason}</p>
                                <p className="text-xs text-muted-foreground">{r.detail}</p>
                              </div>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* Category breakdown */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold">Revenue by Category</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {catSorted.map(([cat, { count, total }]) => (
                          <div key={cat} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-primary" />
                              <span className="font-medium">{cat}</span>
                              <span className="text-muted-foreground">({count})</span>
                            </div>
                            <span className="font-semibold"><FC amount={total} currency={currency} /></span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Top transactions */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-semibold">Top Transactions</CardTitle>
                      </CardHeader>
                      <CardContent className="p-0 overflow-x-auto">
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {[...monthTxns].sort((a: any, b: any) => b.amount - a.amount).slice(0, 15).map((t: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell className="text-[10px] whitespace-nowrap">{t.transaction_date ? format(new Date(t.transaction_date), "dd MMM") : "—"}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">{t.description || "—"}</TableCell>
                                <TableCell className="text-right text-xs font-semibold text-green-600"><FC amount={t.amount} currency={currency} /></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  </>
                );
              })()}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function RevenueIntegrity() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Revenue Integrity
          </h1>
          <p className="text-muted-foreground">
            Protect income — track collections, monitor AR, and detect revenue gaps.
          </p>
        </div>

        <Tabs defaultValue={initialTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="aging" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              AR Aging
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Customers
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
            <RevenueOverviewTab />
          </TabsContent>
          <TabsContent value="invoices" className="mt-4">
            <InvoicesTab />
          </TabsContent>
          <TabsContent value="aging" className="mt-4">
            <ARAgingTab />
          </TabsContent>
          <TabsContent value="customers" className="mt-4">
            <CustomersTab />
          </TabsContent>
          <TabsContent value="payments" className="mt-4">
            <PaymentsCollectionsTab />
          </TabsContent>
          <TabsContent value="variance" className="mt-4">
            <RevenueVarianceTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
