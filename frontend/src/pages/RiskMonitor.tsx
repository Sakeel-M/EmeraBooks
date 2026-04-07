import { useState, useMemo, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  TrendingDown,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Bell,
  ShieldCheck,
  Flame,
  XCircle,
  Info,
  Ban,
  Zap,
  ArrowRightLeft,
  Scale,
  FileWarning,
  Clipboard,
  ListChecks,
  ExternalLink,
  Sparkles,
  Lightbulb,
  Target,
  Loader2,
  RefreshCw,
  ChevronRight,
  Wallet,
  Users,
  Receipt,
  Calendar,
  Activity,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useDateRange } from "@/hooks/useDateRange";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format, subMonths, differenceInDays, isAfter, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { TransactionDetailSheet } from "@/components/shared/TransactionDetailSheet";
import { flaskApi } from "@/lib/flaskApi";
import { useAIScore } from "@/hooks/useAIScore";

// ── Severity helpers ──────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  critical: { color: "bg-red-600", text: "text-red-600", border: "border-red-200", bg: "bg-red-50", icon: Flame },
  high: { color: "bg-orange-500", text: "text-orange-500", border: "border-orange-200", bg: "bg-orange-50", icon: AlertTriangle },
  medium: { color: "bg-amber-400", text: "text-amber-500", border: "border-amber-200", bg: "bg-amber-50", icon: Info },
  low: { color: "bg-blue-400", text: "text-blue-500", border: "border-blue-200", bg: "bg-blue-50", icon: ShieldCheck },
};

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toLowerCase() as keyof typeof SEVERITY_CONFIG;
  const cfg = SEVERITY_CONFIG[s] || SEVERITY_CONFIG.medium;
  return (
    <Badge variant="outline" className={`text-[10px] ${cfg.text} ${cfg.border}`}>
      {severity}
    </Badge>
  );
}

// ── Risk Overview Tab ─────────────────────────────────────────────────────

function RiskOverviewTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const riskAlerts = useRiskAlerts();

  const { data: alerts = [], isFetching: _alertsLoad } = useQuery({
    queryKey: ["risk-alerts-all", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getRiskAlerts(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: flaggedItems = [] } = useQuery({
    queryKey: ["risk-flagged", clientId],
    queryFn: () => database.getFlaggedItems(clientId!),
    enabled: !!clientId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["risk-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["risk-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["risk-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ["risk-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const _riskLoading = _alertsLoad && alerts.length === 0;

  // ── Risk Score Calculation ──
  const riskScore = useMemo(() => {
    let score = 100; // start perfect

    // Deductions
    const openAlerts = alerts.filter((a: any) => a.status === "open");
    score -= openAlerts.filter((a: any) => a.severity === "critical").length * 15;
    score -= openAlerts.filter((a: any) => a.severity === "high").length * 8;
    score -= openAlerts.filter((a: any) => a.severity === "medium").length * 3;
    score -= openAlerts.filter((a: any) => a.severity === "low").length * 1;

    // Flagged reconciliation items
    score -= Math.min(flaggedItems.length * 2, 15);

    // Overdue bills
    const overdueBills = bills.filter((b: any) => {
      if (b.status === "paid" || b.status === "cancelled") return false;
      if (!b.due_date) return false;
      return isAfter(new Date(), parseISO(b.due_date));
    });
    score -= Math.min(overdueBills.length * 2, 10);

    // Overdue invoices
    const overdueInvoices = invoices.filter((i: any) => {
      if (i.status === "paid" || i.status === "cancelled") return false;
      if (!i.due_date) return false;
      return isAfter(new Date(), parseISO(i.due_date));
    });
    score -= Math.min(overdueInvoices.length * 2, 10);

    return Math.max(0, Math.min(100, score));
  }, [alerts, flaggedItems, bills, invoices]);

  const riskLevel = useMemo(() => {
    if (riskScore >= 81) return { label: "Low Risk", color: "text-green-600", bg: "bg-green-500", desc: "Controls are effective" };
    if (riskScore >= 61) return { label: "Medium Risk", color: "text-amber-500", bg: "bg-amber-500", desc: "Some areas need attention" };
    if (riskScore >= 41) return { label: "High Risk", color: "text-orange-500", bg: "bg-orange-500", desc: "Multiple issues detected" };
    return { label: "Critical", color: "text-red-600", bg: "bg-red-600", desc: "Immediate action required" };
  }, [riskScore]);

  // Severity distribution donut
  const severityDonut = useMemo(() => {
    const open = alerts.filter((a: any) => a.status === "open");
    return [
      { name: "Critical", value: open.filter((a: any) => a.severity === "critical").length, fill: "hsl(0 84% 45%)" },
      { name: "High", value: open.filter((a: any) => a.severity === "high").length, fill: "hsl(25 95% 53%)" },
      { name: "Medium", value: open.filter((a: any) => a.severity === "medium").length, fill: "hsl(45 93% 47%)" },
      { name: "Low", value: open.filter((a: any) => a.severity === "low").length, fill: "hsl(210 80% 55%)" },
    ].filter((d) => d.value > 0);
  }, [alerts]);

  const donutConfig: ChartConfig = {
    critical: { label: "Critical", color: "hsl(0 84% 45%)" },
    high: { label: "High", color: "hsl(25 95% 53%)" },
    medium: { label: "Medium", color: "hsl(45 93% 47%)" },
    low: { label: "Low", color: "hsl(210 80% 55%)" },
  };

  // Overdue amounts
  const overdueAP = useMemo(
    () => bills.filter((b: any) => {
      if (b.status === "paid" || b.status === "cancelled") return false;
      return b.due_date && isAfter(new Date(), parseISO(b.due_date));
    }).reduce((s: number, b: any) => s + (b.total || 0), 0),
    [bills],
  );
  const overdueAR = useMemo(
    () => invoices.filter((i: any) => {
      if (i.status === "paid" || i.status === "cancelled") return false;
      return i.due_date && isAfter(new Date(), parseISO(i.due_date));
    }).reduce((s: number, i: any) => s + (i.total || 0), 0),
    [invoices],
  );

  const hasData = alerts.length > 0 || transactions.length > 0 || bills.length > 0;

  if (!hasData) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ShieldAlert className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Risk Data Yet</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements and run reconciliation to start monitoring risks.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (_riskLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading risk data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Risk Score Hero */}
      <Card className="stat-card-hover">
        <CardContent className="p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20">
                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={riskScore >= 81 ? "hsl(143 44% 28%)" : riskScore >= 61 ? "hsl(45 93% 47%)" : riskScore >= 41 ? "hsl(25 95% 53%)" : "hsl(0 84% 45%)"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(riskScore / 100) * 213.6} 213.6`}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl font-bold ${riskLevel.color}`}>{riskScore}</span>
                  <span className="text-[9px] text-muted-foreground">/100</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-2.5 h-2.5 rounded-full ${riskLevel.bg}`} />
                  <span className={`text-lg font-bold ${riskLevel.color}`}>{riskLevel.label}</span>
                </div>
                <p className="text-sm text-muted-foreground">{riskLevel.desc}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MiniStat label="Open Alerts" value={riskAlerts.alertCount} color={riskAlerts.alertCount > 0 ? "text-red-500" : "text-green-600"} />
              <MiniStat label="Flagged Items" value={flaggedItems.length} color={flaggedItems.length > 0 ? "text-amber-500" : "text-green-600"} />
              <MiniStat label="Overdue AP" value={<FC amount={overdueAP} currency={currency} />} color={overdueAP > 0 ? "text-red-500" : "text-green-600"} />
              <MiniStat label="Overdue AR" value={<FC amount={overdueAR} currency={currency} />} color={overdueAR > 0 ? "text-amber-500" : "text-green-600"} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Severity + Checklist */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Severity Breakdown */}
        <Card className="stat-card-hover chart-enter">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Alert Severity</CardTitle>
          </CardHeader>
          <CardContent>
            {severityDonut.length === 0 ? (
              <div className="flex flex-col items-center py-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm text-green-600 font-medium">No open alerts</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <ChartContainer config={donutConfig} className="h-[130px] w-[130px] !aspect-square">
                  <PieChart>
                    <Pie data={severityDonut} cx="50%" cy="50%" innerRadius={40} outerRadius={58} paddingAngle={3} dataKey="value" strokeWidth={0}>
                      {severityDonut.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 w-full">
                  {severityDonut.map((d) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Control Checklist */}
        <Card className="md:col-span-2 stat-card-hover">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Control Checklist</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              <ChecklistItem label="Bank statements uploaded" done={transactions.length > 0} />
              <ChecklistItem label="Bank accounts detected" done={bankAccounts.length > 0} />
              <ChecklistItem label="Bills/Vendors synced" done={bills.length > 0} />
              <ChecklistItem label="Invoices/Customers synced" done={invoices.length > 0} />
              <ChecklistItem label="Reconciliation run" done={flaggedItems.length > 0 || alerts.some((a: any) => a.alert_type?.includes("reconciliation"))} />
              <ChecklistItem label="No critical alerts" done={riskAlerts.critical === 0} />
              <ChecklistItem label="No overdue payables" done={overdueAP === 0} />
              <ChecklistItem label="No overdue receivables" done={overdueAR === 0} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Active Alerts Tab ─────────────────────────────────────────────────────

function ActiveAlertsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: alerts = [] } = useQuery({
    queryKey: ["risk-alerts-all", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getRiskAlerts(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const openAlerts = useMemo(() => alerts.filter((a: any) => a.status === "open"), [alerts]);

  // Unique alert types for dropdown
  const alertTypes = useMemo(() => {
    const types = new Set<string>();
    openAlerts.forEach((a: any) => { if (a.alert_type) types.add(a.alert_type); });
    return Array.from(types).sort();
  }, [openAlerts]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? openAlerts : openAlerts.filter((a: any) => a.severity === filter);
    if (typeFilter !== "all") list = list.filter((a: any) => a.alert_type === typeFilter);
    if (dateFrom) list = list.filter((a: any) => (a.created_at || "") >= dateFrom);
    if (dateTo) list = list.filter((a: any) => (a.created_at || "").slice(0, 10) <= dateTo);
    return list;
  }, [openAlerts, filter, typeFilter, dateFrom, dateTo]);

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { all: openAlerts.length };
    openAlerts.forEach((a: any) => { counts[a.severity] = (counts[a.severity] || 0) + 1; });
    return counts;
  }, [openAlerts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((a: any) => a.id)));
    }
  };

  const handleResolve = async (alertId: string) => {
    try {
      await database.updateRiskAlert(alertId, { status: "resolved", resolution: "Resolved via Risk Monitor" });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-all", clientId] });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-count", clientId] });
      setSelectedAlert(null);
    } catch {
      // silent
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await database.updateRiskAlert(alertId, { status: "resolved", resolution: "Acknowledged" });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-all", clientId] });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-count", clientId] });
      toast.success("Alert acknowledged");
    } catch {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await database.updateRiskAlert(alertId, { status: "resolved", resolution: "Dismissed" });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-all", clientId] });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-count", clientId] });
      toast.success("Alert dismissed");
    } catch {
      toast.error("Failed to dismiss alert");
    }
  };

  const handleBulkResolve = async () => {
    if (selectedIds.size === 0) return;
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) =>
          database.updateRiskAlert(id, { status: "resolved", resolution: "Bulk resolved via Risk Monitor" })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-all", clientId] });
      queryClient.invalidateQueries({ queryKey: ["risk-alerts-count", clientId] });
      setSelectedIds(new Set());
      toast.success(`${selectedIds.size} alerts resolved`);
    } catch {
      toast.error("Failed to resolve some alerts");
    }
  };

  if (alerts.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-50 p-4 mb-4">
            <ShieldCheck className="h-10 w-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-green-600">No Alerts</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            All clear. Alerts are generated during reconciliation and variance analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Severity Filter */}
      <Card>
        <CardContent className="p-3 flex items-center gap-3 flex-wrap">
          {["all", "critical", "high", "medium", "low"].map((s) => (
            <Button key={s} variant={filter === s ? "default" : "ghost"} size="sm" className="text-xs h-7 gap-1" onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {(severityCounts[s] || 0) > 0 && (
                <Badge variant={filter === s ? "secondary" : "outline"} className="text-[10px] h-4 px-1">{severityCounts[s]}</Badge>
              )}
            </Button>
          ))}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} alert{filtered.length !== 1 && "s"}</span>
        </CardContent>
      </Card>

      {/* Alert Type + Date Range Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Alert Type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {alertTypes.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date From</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Date To</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
        </div>
        <div className="flex items-end">
          {(typeFilter !== "all" || dateFrom || dateTo) && (
            <Button size="sm" variant="ghost" className="text-xs h-8" onClick={() => { setTypeFilter("all"); setDateFrom(""); setDateTo(""); }}>
              Clear Filters
            </Button>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3 flex items-center gap-3">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button size="sm" className="gap-1.5 text-xs h-7" onClick={handleBulkResolve}>
              <CheckCircle2 className="h-3 w-3" />
              Resolve Selected
            </Button>
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setSelectedIds(new Set())}>
              Clear Selection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            <Checkbox
              checked={selectedIds.size === filtered.length && filtered.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-xs text-muted-foreground">Select all</span>
          </div>
        )}
        {filtered.map((alert: any) => {
          const sev = (alert.severity || "medium").toLowerCase() as keyof typeof SEVERITY_CONFIG;
          const cfg = SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.medium;
          const SevIcon = cfg.icon;
          return (
            <Card
              key={alert.id}
              className={`stat-card-hover ${cfg.border} ${cfg.bg}/30 ${selectedIds.has(alert.id) ? "ring-2 ring-primary/50" : ""}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(alert.id)}
                  onCheckedChange={() => toggleSelect(alert.id)}
                  className="mt-1"
                />
                <div className={`mt-0.5 rounded-full p-1.5 ${cfg.bg}`}>
                  <SevIcon className={`h-4 w-4 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{alert.title}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                      )}
                    </div>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    {alert.alert_type && <span className="capitalize">{alert.alert_type.replace(/_/g, " ")}</span>}
                    {alert.amount && <span className="font-medium"><FC amount={alert.amount} currency={currency} /></span>}
                    {alert.created_at && <span>{format(new Date(alert.created_at), "dd MMM yyyy")}</span>}
                  </div>
                </div>
                {/* Quick Actions */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-green-600" onClick={(e) => { e.stopPropagation(); handleAcknowledge(alert.id); }}>
                    <CheckCircle2 className="h-3 w-3" />
                    Ack
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1 text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleDismiss(alert.id); }}>
                    <XCircle className="h-3 w-3" />
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Alert Details</SheetTitle>
            <SheetDescription>{selectedAlert?.title}</SheetDescription>
          </SheetHeader>
          {selectedAlert && (
            <div className="space-y-5 pt-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Severity</p>
                  <SeverityBadge severity={selectedAlert.severity} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Type</p>
                  <p className="text-sm capitalize">{(selectedAlert.alert_type || "").replace(/_/g, " ")}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <Badge variant={selectedAlert.status === "open" ? "destructive" : "default"} className="text-[10px]">{selectedAlert.status}</Badge>
                </div>
                {selectedAlert.amount && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
                    <p className="font-semibold"><FC amount={selectedAlert.amount} currency={currency} /></p>
                  </div>
                )}
              </div>
              {selectedAlert.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                    <p className="text-sm">{selectedAlert.description}</p>
                  </div>
                </>
              )}
              {selectedAlert.created_at && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Created</p>
                  <p className="text-sm">{format(new Date(selectedAlert.created_at), "dd MMM yyyy HH:mm")}</p>
                </div>
              )}
              {selectedAlert.status === "open" && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button onClick={() => handleAcknowledge(selectedAlert.id)} variant="outline" className="flex-1 gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Acknowledge
                    </Button>
                    <Button onClick={() => handleDismiss(selectedAlert.id)} variant="ghost" className="flex-1 gap-2">
                      <XCircle className="h-4 w-4" />
                      Dismiss
                    </Button>
                  </div>
                  <Button onClick={() => handleResolve(selectedAlert.id)} className="w-full gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Mark as Resolved
                  </Button>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── High-Risk Transactions Tab ────────────────────────────────────────────

function HighRiskTransactionsTab() {
  const { clientId, currency } = useActiveClient();
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [drillDown, setDrillDown] = useState<{title: string; description?: string; transactions: any[]} | null>(null);

  const threeMonthsAgo = useMemo(() => format(subMonths(new Date(), 3), "yyyy-MM-dd"), []);

  const { data: transactions = [] } = useQuery({
    queryKey: ["risk-txns-3m", clientId, threeMonthsAgo],
    queryFn: () => database.getTransactions(clientId!, { startDate: threeMonthsAgo, limit: 3000 }),
    enabled: !!clientId,
  });

  const markReviewed = (id: string) => {
    setReviewedIds((prev) => { const next = new Set(prev); next.add(id); return next; });
    toast.success("Transaction marked as reviewed");
  };

  // Calculate statistics for flagging
  const { largeTransactions, duplicateSuspects, unusualTiming, roundAmounts } = useMemo(() => {
    if (transactions.length === 0) return { largeTransactions: [], duplicateSuspects: [], unusualTiming: [], roundAmounts: [] };

    const amounts = transactions.map((t: any) => Math.abs(t.amount));
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length);
    const threshold = mean + 2 * stdDev;

    // Large transactions (>2 std dev above mean)
    const large = transactions
      .filter((t: any) => Math.abs(t.amount) > threshold)
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 20)
      .map((t: any) => ({ ...t, reason: "Unusually large amount", riskType: "large" }));

    // Duplicate suspects (same amount + similar description within 3 days)
    const dupes: any[] = [];
    const seen = new Map<string, any[]>();
    transactions.forEach((t: any) => {
      const key = `${Math.abs(t.amount).toFixed(2)}`;
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key)!.push(t);
    });
    seen.forEach((group) => {
      if (group.length > 1) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const daysDiff = Math.abs(differenceInDays(
              new Date(group[i].transaction_date),
              new Date(group[j].transaction_date),
            ));
            if (daysDiff <= 3 && daysDiff > 0) {
              dupes.push({ ...group[j], reason: `Possible duplicate of ${group[i].description?.slice(0, 30)}`, riskType: "duplicate" });
            }
          }
        }
      }
    });

    // Weekend/unusual timing (just flag weekend transactions)
    const weekend = transactions
      .filter((t: any) => {
        const d = new Date(t.transaction_date);
        const day = d.getDay();
        return day === 0 || day === 6; // Sat/Sun
      })
      .slice(0, 10)
      .map((t: any) => ({ ...t, reason: "Weekend transaction", riskType: "timing" }));

    // Round amount detection (exactly divisible by 1000, amount >= 5000)
    const round = transactions
      .filter((t: any) => {
        const abs = Math.abs(t.amount);
        return abs >= 5000 && abs % 1000 === 0;
      })
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 15)
      .map((t: any) => ({ ...t, reason: "Round amount (divisible by 1,000)", riskType: "round" }));

    return {
      largeTransactions: large,
      duplicateSuspects: dupes.slice(0, 15),
      unusualTiming: weekend,
      roundAmounts: round,
    };
  }, [transactions]);

  const allFlagged = [...largeTransactions, ...duplicateSuspects, ...unusualTiming, ...roundAmounts];
  const unreviewedCount = allFlagged.filter((t: any) => !reviewedIds.has(t.id)).length;

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Zap className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Transaction Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements to detect high-risk transactions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (allFlagged.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-50 p-4 mb-4">
            <ShieldCheck className="h-10 w-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-green-600">No High-Risk Transactions</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            All transactions within normal parameters.
          </p>
        </CardContent>
      </Card>
    );
  }

  const RiskRow = ({ t, i }: { t: any; i: number }) => {
    const isReviewed = reviewedIds.has(t.id);
    return (
      <TableRow key={t.id || i} className={isReviewed ? "opacity-50" : ""}>
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {t.transaction_date ? format(new Date(t.transaction_date), "dd MMM yyyy") : "—"}
        </TableCell>
        <TableCell className="text-sm font-medium max-w-[200px] truncate">{t.description || "—"}</TableCell>
        <TableCell className={`text-right font-semibold text-sm ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
          <FC amount={Math.abs(t.amount)} currency={currency} />
        </TableCell>
        <TableCell><span className="text-[10px] text-muted-foreground">{t.reason}</span></TableCell>
        <TableCell>
          {isReviewed ? (
            <Badge variant="outline" className="text-[9px] text-green-600 border-green-200">Reviewed</Badge>
          ) : (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 gap-1" onClick={() => markReviewed(t.id)}>
              <Eye className="h-3 w-3" />
              Review
            </Button>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Large Amounts" value={largeTransactions.length.toString()} icon={DollarSign} color={largeTransactions.length > 0 ? "text-red-500" : "text-green-600"} sub=">2σ from mean" onClick={() => setDrillDown({ title: "Large Transactions", description: "Amounts exceeding 2 standard deviations", transactions: largeTransactions })} />
        <KPICard label="Duplicate Suspects" value={duplicateSuspects.length.toString()} icon={Ban} color={duplicateSuspects.length > 0 ? "text-amber-500" : "text-green-600"} sub="Same amt, ≤3 days" onClick={() => setDrillDown({ title: "Duplicate Suspects", description: "Same amount within 3 days", transactions: duplicateSuspects })} />
        <KPICard label="Round Amounts" value={roundAmounts.length.toString()} icon={Scale} color={roundAmounts.length > 0 ? "text-orange-500" : "text-green-600"} sub="≥5K, div by 1K" onClick={() => setDrillDown({ title: "Round Amount Transactions", description: "Amounts divisible by 1,000", transactions: roundAmounts })} />
        <KPICard label="Unreviewed" value={unreviewedCount.toString()} icon={Eye} color={unreviewedCount > 0 ? "text-amber-500" : "text-green-600"} sub={`of ${allFlagged.length} flagged`} onClick={() => setDrillDown({ title: "All Flagged Transactions", description: `${unreviewedCount} unreviewed of ${allFlagged.length} total`, transactions: allFlagged })} />
      </div>

      {/* Large Transactions */}
      {largeTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600 flex items-center gap-2">
              <Flame className="h-4 w-4" />
              Large Transactions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {largeTransactions.map((t: any, i: number) => <RiskRow key={t.id || i} t={t} i={i} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Round Amounts */}
      {roundAmounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600 flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Round Amount Transactions
            </CardTitle>
            <CardDescription className="text-xs">Transactions with suspiciously round amounts (multiples of 1,000)</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roundAmounts.map((t: any, i: number) => <RiskRow key={t.id || i} t={t} i={i} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Duplicate Suspects */}
      {duplicateSuspects.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Duplicate Suspects
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicateSuspects.map((t: any, i: number) => <RiskRow key={t.id || i} t={t} i={i} />)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Variance Tab ──────────────────────────────────────────────────────────

function VarianceTab() {
  const { clientId, currency } = useActiveClient();
  const [drillDown, setDrillDown] = useState<{ type: string; title: string; description?: string; transactions?: any[]; category?: string } | null>(null);

  const sixMonthsAgo = useMemo(() => format(subMonths(new Date(), 6), "yyyy-MM-dd"), []);

  const { data: transactions = [] } = useQuery({
    queryKey: ["risk-txns-6m", clientId, sixMonthsAgo],
    queryFn: () => database.getTransactions(clientId!, { startDate: sixMonthsAgo, limit: 5000 }),
    enabled: !!clientId,
  });

  const expTxns = useMemo(() => transactions.filter((t: any) => t.amount < 0), [transactions]);

  // Monthly category spend
  const { monthCats, categoryVariance, monthlySpend } = useMemo(() => {
    if (expTxns.length === 0) return { monthCats: {} as Record<string, Record<string, number>>, categoryVariance: [], monthlySpend: [] };

    const mCats: Record<string, Record<string, number>> = {};
    const monthTotals: Record<string, number> = {};
    expTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      const month = t.transaction_date?.slice(0, 7);
      if (!month) return;
      if (!mCats[cat]) mCats[cat] = {};
      mCats[cat][month] = (mCats[cat][month] || 0) + Math.abs(t.amount);
      monthTotals[month] = (monthTotals[month] || 0) + Math.abs(t.amount);
    });

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
        return { category: cat, avg, latest, variance, zScore, std, months: sortedMs.length, monthlyData: sortedMs.map((m) => ({ month: m, amount: months[m] })) };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null && Math.abs(v.variance) > 15)
      .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

    const mSpend = Object.entries(monthTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([m, v]) => ({ month: format(new Date(m + "-01"), "MMM yy"), fullMonth: m, spend: v }));

    return { monthCats: mCats, categoryVariance: catVar, monthlySpend: mSpend };
  }, [expTxns]);

  const spikeCategory = useMemo(() => categoryVariance.filter((v) => v.variance > 0).sort((a, b) => b.variance - a.variance)[0], [categoryVariance]);
  const dropCategory = useMemo(() => categoryVariance.filter((v) => v.variance < 0).sort((a, b) => a.variance - b.variance)[0], [categoryVariance]);

  const getCategoryTxns = (cat: string) =>
    expTxns.filter((t: any) => (getCanonicalCategory(t.category, t.description, t.description) || "Other") === cat)
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 25);

  const getMonthTxns = (month: string) =>
    expTxns.filter((t: any) => t.transaction_date?.startsWith(month))
      .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 25);

  // Anomaly reasons
  const guessVarianceReasons = (cat: string, variance: number, zScore: number) => {
    const reasons: { reason: string; detail: string }[] = [];
    const catMonths = monthCats[cat] || {};
    const sortedMs = Object.keys(catMonths).sort();
    if (sortedMs.length < 2) return [{ reason: "Insufficient Data", detail: "Need more months" }];
    const latestMonth = sortedMs[sortedMs.length - 1];
    const prevMonth = sortedMs[sortedMs.length - 2];
    const latestTxns = expTxns.filter((t: any) => t.transaction_date?.startsWith(latestMonth) && (getCanonicalCategory(t.category, t.description, t.description) || "Other") === cat);
    const prevTxns = expTxns.filter((t: any) => t.transaction_date?.startsWith(prevMonth) && (getCanonicalCategory(t.category, t.description, t.description) || "Other") === cat);

    if (latestTxns.length > prevTxns.length * 1.5 && prevTxns.length > 0)
      reasons.push({ reason: "Volume Increase", detail: `${latestTxns.length} txns vs ${prevTxns.length} previous` });
    else if (prevTxns.length > 0 && latestTxns.length < prevTxns.length * 0.5)
      reasons.push({ reason: "Volume Decrease", detail: `${latestTxns.length} txns vs ${prevTxns.length} previous` });

    const largest = latestTxns.sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))[0];
    const total = latestTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    if (largest && total > 0 && Math.abs(largest.amount) / total > 0.5)
      reasons.push({ reason: "Single Large Transaction", detail: `"${(largest.counterparty_name || largest.description)?.slice(0, 35)}" = ${formatAmount(Math.abs(largest.amount), currency)} (${((Math.abs(largest.amount) / total) * 100).toFixed(0)}%)` });

    const prevDescs = new Set(prevTxns.map((t: any) => (t.counterparty_name || t.description || "").toLowerCase().trim()));
    const newPayees = latestTxns.filter((t: any) => !prevDescs.has((t.counterparty_name || t.description || "").toLowerCase().trim()));
    if (newPayees.length > 0) {
      const newTotal = newPayees.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      reasons.push({ reason: "New Payees", detail: `${newPayees.length} new payee(s) totaling ${formatAmount(newTotal, currency)}` });
    }

    if (Math.abs(zScore) > 2)
      reasons.push({ reason: "Statistical Outlier", detail: `Z-score ${zScore.toFixed(2)} — ${Math.abs(zScore).toFixed(1)}σ from mean` });

    if (reasons.length === 0)
      reasons.push({ reason: variance > 0 ? "Gradual Increase" : "Gradual Decrease", detail: `${Math.abs(variance).toFixed(0)}% shift vs rolling average` });

    return reasons;
  };

  const spendChartConfig: ChartConfig = {
    spend: { label: "Spend", color: "hsl(0 84% 55%)" },
  };

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <FileWarning className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Variance Data</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Need at least 2 months of transaction data for variance analysis.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Drill-down renderer
  const renderDrillDown = () => {
    if (!drillDown) return null;

    if (drillDown.type === "category-detail") {
      const cat = drillDown.category || "";
      const varData = categoryVariance.find((v) => v.category === cat);
      const txns = getCategoryTxns(cat);
      const reasons = varData ? guessVarianceReasons(cat, varData.variance, varData.zScore) : [];
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
                  <p className="text-[10px] text-muted-foreground uppercase">Latest</p>
                  <p className="text-sm font-bold"><FC amount={varData.latest} currency={currency} /></p>
                </div>
              </div>
              {varData.monthlyData.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Monthly Trend</p>
                  <div className="flex items-end gap-1 h-16">
                    {varData.monthlyData.map((m) => {
                      const maxVal = Math.max(...varData.monthlyData.map((d) => d.amount));
                      const pct = maxVal > 0 ? (m.amount / maxVal) * 100 : 0;
                      const isLatest = m.month === varData.monthlyData[varData.monthlyData.length - 1].month;
                      return (
                        <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className={`w-full rounded-t ${isLatest ? (varData.variance > 0 ? "bg-red-400" : "bg-green-400") : "bg-muted-foreground/20"}`} style={{ height: `${Math.max(pct, 4)}%` }} />
                          <span className="text-[8px] text-muted-foreground">{m.month.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {reasons.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Detected Reasons</p>
                  <div className="space-y-2">
                    {reasons.map((r, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-muted/50">
                        <p className="text-xs font-medium">{r.reason}</p>
                        <p className="text-[10px] text-muted-foreground">{r.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
          {txns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Transactions ({txns.length})</p>
              <div className="space-y-1">
                {txns.map((t: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                      <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (drillDown.type === "month-detail") {
      const month = drillDown.category || "";
      const txns = getMonthTxns(month);
      const catBreakdown: Record<string, number> = {};
      txns.forEach((t: any) => {
        const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
        catBreakdown[cat] = (catBreakdown[cat] || 0) + Math.abs(t.amount);
      });
      const totalMonth = Object.values(catBreakdown).reduce((s, v) => s + v, 0);
      return (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Total Expenses</p>
            <p className="text-2xl font-bold text-red-500"><FC amount={totalMonth} currency={currency} /></p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Category Breakdown</p>
            {Object.entries(catBreakdown).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between py-1.5">
                <span className="text-xs font-medium">{cat}</span>
                <span className="text-xs font-semibold text-red-500"><FC amount={amt} currency={currency} /></span>
              </div>
            ))}
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Top Transactions</p>
            {txns.slice(0, 15).map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                  <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                </div>
                <span className="text-xs font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (drillDown.type === "spike" || drillDown.type === "drop") {
      const target = drillDown.type === "spike" ? spikeCategory : dropCategory;
      if (!target) return <p className="text-sm text-muted-foreground">No data.</p>;
      const reasons = guessVarianceReasons(target.category, target.variance, target.zScore);
      const txns = getCategoryTxns(target.category);
      return (
        <div className="space-y-4">
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
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Detected Reasons</p>
            {reasons.map((r, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-muted/50 mb-2">
                <p className="text-xs font-medium">{r.reason}</p>
                <p className="text-[10px] text-muted-foreground">{r.detail}</p>
              </div>
            ))}
          </div>
          {txns.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Top Transactions</p>
              {txns.slice(0, 10).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                    <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                  </div>
                  <span className="text-xs font-semibold text-red-500 ml-2"><FC amount={Math.abs(t.amount)} currency={currency} /></span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Fallback: transactions list
    if (drillDown.transactions && drillDown.transactions.length > 0) {
      return (
        <div className="space-y-1">
          {drillDown.transactions.map((t: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
              </div>
              <span className={`text-xs font-semibold ml-2 ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}><FC amount={Math.abs(t.amount)} currency={currency} /></span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Categories Tracked"
          value={categoryVariance.length.toString()}
          icon={BarChart3}
          color="text-primary"
          sub=">15% variance"
          onClick={() => setDrillDown({ type: "categories", title: "All Variance Categories", description: `${categoryVariance.length} categories with >15% variance` })}
        />
        <KPICard
          label="Highest Spike"
          value={spikeCategory ? `+${spikeCategory.variance.toFixed(0)}%` : "N/A"}
          icon={TrendingUp}
          color="text-red-500"
          sub={spikeCategory?.category}
          onClick={spikeCategory ? () => setDrillDown({ type: "spike", title: `Spike: ${spikeCategory.category}`, description: `+${spikeCategory.variance.toFixed(0)}% above average`, category: spikeCategory.category }) : undefined}
        />
        <KPICard
          label="Biggest Drop"
          value={dropCategory ? `${dropCategory.variance.toFixed(0)}%` : "N/A"}
          icon={TrendingDown}
          color="text-red-500"
          sub={dropCategory?.category}
          onClick={dropCategory ? () => setDrillDown({ type: "drop", title: `Drop: ${dropCategory.category}`, description: `${dropCategory.variance.toFixed(0)}% below average`, category: dropCategory.category }) : undefined}
        />
      </div>

      {/* Monthly Spend Chart */}
      <Card className="stat-card-hover chart-enter">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Monthly Expense Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySpend.length === 0 ? (
            <EmptyChart text="No spend data" />
          ) : (
            <ChartContainer config={spendChartConfig} className="h-[180px] w-full !aspect-auto">
              <BarChart data={monthlySpend} onClick={(e: any) => {
                if (e?.activePayload?.[0]?.payload?.fullMonth) {
                  const m = e.activePayload[0].payload.fullMonth;
                  setDrillDown({ type: "month-detail", title: format(new Date(m + "-01"), "MMMM yyyy"), description: "Monthly expense breakdown", category: m });
                }
              }} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[10px]" />
                <YAxis axisLine={false} tickLine={false} width={65} className="text-[10px]" tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()} />
                <ChartTooltip content={<ChartTooltipContent formatter={(v) => formatAmount(Number(v), currency)} />} />
                <Bar dataKey="spend" fill="hsl(0 84% 55%)" radius={[3, 3, 0, 0]} barSize={24} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* Variance Table */}
      {categoryVariance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Category Variance (vs Average)</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Latest</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                  <TableHead>Signal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryVariance.map((v) => (
                  <TableRow
                    key={v.category}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setDrillDown({ type: "category-detail", title: v.category, category: v.category })}
                  >
                    <TableCell className="text-sm font-medium">{v.category}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground"><FC amount={v.avg} currency={currency} /></TableCell>
                    <TableCell className="text-right text-sm font-semibold"><FC amount={v.latest} currency={currency} /></TableCell>
                    <TableCell className={`text-right text-sm font-bold ${v.variance > 0 ? "text-red-500" : "text-green-600"}`}>
                      {v.variance > 0 ? "+" : ""}{v.variance.toFixed(0)}%
                    </TableCell>
                    <TableCell>
                      {Math.abs(v.variance) > 50 ? (
                        <Badge variant="destructive" className="text-[9px]">High</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-200">Watch</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
            {drillDown?.type === "categories" ? (
              <div className="space-y-2">
                {categoryVariance.map((v) => (
                  <div key={v.category} className="p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors"
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
                      <Badge variant={Math.abs(v.variance) > 50 ? "destructive" : "outline"} className="text-[9px]">
                        {Math.abs(v.variance) > 50 ? "High" : "Watch"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : renderDrillDown()}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Unresolved Mismatches Tab ─────────────────────────────────────────────

function UnresolvedMismatchesTab() {
  const { clientId, currency } = useActiveClient();
  const navigate = useNavigate();

  const { data: flaggedItems = [] } = useQuery({
    queryKey: ["rm-flagged", clientId],
    queryFn: () => database.getFlaggedItems(clientId!),
    enabled: !!clientId,
  });

  const { data: reconSessions = [] } = useQuery({
    queryKey: ["rm-recon-sessions", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
  });

  // Map session IDs to labels
  const sessionMap = useMemo(() => {
    const map: Record<string, string> = {};
    reconSessions.forEach((s: any) => {
      map[s.id] = s.source_a && s.source_b
        ? `${s.source_a} vs ${s.source_b}`
        : `Session ${format(new Date(s.created_at || Date.now()), "dd MMM")}`;
    });
    return map;
  }, [reconSessions]);

  const items = useMemo(() =>
    flaggedItems
      .filter((item: any) => item.status === "flagged" || item.status === "unmatched")
      .map((item: any) => ({
        ...item,
        sessionLabel: sessionMap[item.session_id] || "Unknown Session",
        ageDays: item.created_at ? differenceInDays(new Date(), new Date(item.created_at)) : 0,
      }))
      .sort((a: any, b: any) => b.ageDays - a.ageDays),
    [flaggedItems, sessionMap],
  );

  if (items.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/30 p-4 mb-4">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Unresolved Mismatches</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            All reconciliation items have been matched or resolved. Great work!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="destructive" className="text-xs">
          {items.length} unresolved
        </Badge>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs ml-auto" onClick={() => navigate("/reconciliation")}>
          <ExternalLink className="h-3.5 w-3.5" />
          Go to Reconciliation
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="max-h-[500px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Session</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Source A</TableHead>
                  <TableHead className="text-xs text-right">Amount A</TableHead>
                  <TableHead className="text-xs">Source B</TableHead>
                  <TableHead className="text-xs text-right">Amount B</TableHead>
                  <TableHead className="text-xs">Flag</TableHead>
                  <TableHead className="text-xs text-right">Age</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item: any, i: number) => (
                  <TableRow key={item.id || i}>
                    <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                      {item.sessionLabel}
                    </TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {item.transaction_date
                        ? format(new Date(item.transaction_date), "dd MMM yy")
                        : item.created_at
                          ? format(new Date(item.created_at), "dd MMM yy")
                          : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {item.source_a_description || item.description || "—"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {item.source_a_amount != null ? <FC amount={Math.abs(item.source_a_amount)} currency={currency} /> : item.amount != null ? <FC amount={Math.abs(item.amount)} currency={currency} /> : "—"}
                    </TableCell>
                    <TableCell className="text-xs max-w-[150px] truncate">
                      {item.source_b_description || "No match"}
                    </TableCell>
                    <TableCell className="text-right text-xs font-semibold">
                      {item.source_b_amount != null ? <FC amount={Math.abs(item.source_b_amount)} currency={currency} /> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-200">
                        {item.flag_type || item.status || "flagged"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`text-xs font-medium ${item.ageDays > 30 ? "text-red-500" : item.ageDays > 7 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {item.ageDays}d
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Control Completion Tab ────────────────────────────────────────────────

function ControlCompletionTab() {
  const { clientId } = useActiveClient();
  const { alerts } = useRiskAlerts();

  const { data: reconSessions = [] } = useQuery({
    queryKey: ["rm-cc-recon", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["rm-cc-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: flaggedItems = [] } = useQuery({
    queryKey: ["rm-cc-flagged", clientId],
    queryFn: () => database.getFlaggedItems(clientId!),
    enabled: !!clientId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["rm-cc-accounts", clientId],
    queryFn: () => database.getAccounts(clientId!),
    enabled: !!clientId,
  });

  // Build control checks
  const controls = useMemo(() => {
    const now = new Date();
    const thisMonthStart = startOfMonth(now);

    // 1. Bank reconciliation completed this month
    const reconThisMonth = reconSessions.some(
      (s: any) => s.created_at && new Date(s.created_at) >= thisMonthStart
    );

    // 2. All risk alerts addressed (no open alerts)
    const openAlerts = (alerts || []).filter(
      (a: any) => a.status === "open" || a.status === "active"
    );
    const allAlertsAddressed = openAlerts.length === 0;

    // 3. No unresolved flagged items
    const unresolvedFlags = flaggedItems.filter(
      (i: any) => i.status === "flagged" || i.status === "unmatched"
    );
    const allFlagsResolved = unresolvedFlags.length === 0;

    // 4. All bank accounts reconciled (within 30 days)
    const allAccountsReconciled = bankAccounts.length > 0 && bankAccounts.every((acc: any) => {
      const sessions = reconSessions.filter((s: any) => s.bank_account_id === acc.id);
      if (sessions.length === 0) return false;
      const latest = sessions.sort((a: any, b: any) => (b.created_at || "").localeCompare(a.created_at || ""))[0];
      return latest.created_at && differenceInDays(now, new Date(latest.created_at)) <= 30;
    });

    // 5. Chart of Accounts set up
    const coaSetUp = accounts.length >= 3;

    // 6. Bank accounts connected
    const banksConnected = bankAccounts.length > 0;

    // 7. At least 1 reconciliation session exists
    const hasAnyRecon = reconSessions.length > 0;

    return [
      { label: "Bank reconciliation completed this month", done: reconThisMonth },
      { label: "All risk alerts addressed", done: allAlertsAddressed, detail: openAlerts.length > 0 ? `${openAlerts.length} open` : undefined },
      { label: "All flagged items resolved", done: allFlagsResolved, detail: unresolvedFlags.length > 0 ? `${unresolvedFlags.length} unresolved` : undefined },
      { label: "All bank accounts reconciled (within 30 days)", done: allAccountsReconciled },
      { label: "Chart of Accounts configured", done: coaSetUp },
      { label: "Bank accounts connected", done: banksConnected },
      { label: "Reconciliation process started", done: hasAnyRecon },
    ];
  }, [reconSessions, alerts, flaggedItems, bankAccounts, accounts]);

  const completed = controls.filter((c) => c.done).length;
  const total = controls.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="space-y-5">
      {/* Progress Overview */}
      <Card className="stat-card-hover">
        <CardContent className="p-5">
          <div className="flex items-center gap-6">
            {/* Progress Ring */}
            <div className="relative h-24 w-24 shrink-0">
              <svg className="h-24 w-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                  strokeDasharray={`${pct * 2.64} 264`}
                  strokeLinecap="round"
                  className={pct >= 80 ? "text-green-500" : pct >= 50 ? "text-amber-500" : "text-red-500"}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-bold">{pct}%</span>
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg">{completed} of {total} Controls Complete</p>
              <p className="text-sm text-muted-foreground mt-1">
                {pct === 100
                  ? "All financial controls are in place. Excellent!"
                  : pct >= 70
                    ? "Almost there — a few controls need attention."
                    : "Several controls need to be addressed to reduce risk."}
              </p>
              <Progress value={pct} className="h-2 mt-3" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <ListChecks className="h-4 w-4" />
            Control Checklist
          </CardTitle>
          <CardDescription className="text-xs">Status of financial controls for this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {controls.map((control, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                {control.done ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-4.5 w-4.5 text-muted-foreground/40 shrink-0" />
                )}
                <span className={control.done ? "" : "text-muted-foreground"}>{control.label}</span>
                {control.detail && !control.done && (
                  <Badge variant="outline" className="text-[9px] ml-auto text-amber-600 border-amber-200">
                    {control.detail}
                  </Badge>
                )}
                {control.done && (
                  <CheckCircle2 className="h-3 w-3 text-green-400 ml-auto" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score contribution note */}
      <Card className="stat-card-hover border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">
              Control Completion Score ({pct}%) contributes to the overall Risk Score shown on the Overview tab.
              Complete all controls to maximize your risk rating.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── AI Risk Insights Tab ──────────────────────────────────────────────────

interface AIRiskInsight {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  title: string;
  description: string;
  impact: string;
  suggestion: string;
  affectedAmount?: number;
  relatedTransactions?: any[];
}

function AIRiskInsightsTab() {
  const { clientId, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIRiskInsight[]>([]);
  const [selectedInsight, setSelectedInsight] = useState<AIRiskInsight | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const { aiScore, aiGenerating, generate: generateAIScore } = useAIScore();

  const { data: transactions = [] } = useQuery({
    queryKey: ["ai-risk-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["ai-risk-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["ai-risk-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["ai-risk-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  // Pre-computed financial metrics for AI
  const metrics = useMemo(() => {
    const expTxns = transactions.filter((t: any) => t.amount < 0);
    const incTxns = transactions.filter((t: any) => t.amount > 0);
    const totalExpenses = expTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    const totalIncome = incTxns.reduce((s: number, t: any) => s + t.amount, 0);
    const totalBalance = bankAccounts.reduce((s: number, a: any) => s + (a.current_balance || 0), 0);

    // Monthly burn
    const monthlyBurn: Record<string, number> = {};
    const monthlyInc: Record<string, number> = {};
    expTxns.forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) monthlyBurn[m] = (monthlyBurn[m] || 0) + Math.abs(t.amount);
    });
    incTxns.forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) monthlyInc[m] = (monthlyInc[m] || 0) + t.amount;
    });
    const burnVals = Object.values(monthlyBurn);
    const avgBurn = burnVals.length > 0 ? burnVals.reduce((s, v) => s + v, 0) / burnVals.length : 0;
    const avgIncome = Object.values(monthlyInc).length > 0 ? Object.values(monthlyInc).reduce((s, v) => s + v, 0) / Object.values(monthlyInc).length : 0;

    // Category breakdown
    const catSpend: Record<string, number> = {};
    expTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      catSpend[cat] = (catSpend[cat] || 0) + Math.abs(t.amount);
    });

    // Overdue
    const now = new Date();
    const overdueBills = bills.filter((b: any) => b.status !== "paid" && b.status !== "cancelled" && b.due_date && isAfter(now, parseISO(b.due_date)));
    const overdueInvoices = invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && isAfter(now, parseISO(i.due_date)));

    // Duplicate detection
    const amountMap = new Map<string, any[]>();
    expTxns.forEach((t: any) => {
      const key = Math.abs(t.amount).toFixed(2);
      if (!amountMap.has(key)) amountMap.set(key, []);
      amountMap.get(key)!.push(t);
    });
    let duplicateCount = 0;
    let duplicateAmount = 0;
    amountMap.forEach((group) => {
      if (group.length > 1) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const daysDiff = Math.abs(differenceInDays(new Date(group[i].transaction_date), new Date(group[j].transaction_date)));
            if (daysDiff <= 3 && daysDiff > 0) {
              duplicateCount++;
              duplicateAmount += Math.abs(group[j].amount);
            }
          }
        }
      }
    });

    // Weekend transactions
    const weekendTxns = expTxns.filter((t: any) => {
      const d = new Date(t.transaction_date);
      return d.getDay() === 0 || d.getDay() === 6;
    });

    // Large outliers
    const amounts = expTxns.map((t: any) => Math.abs(t.amount));
    const mean = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;
    const stdDev = amounts.length > 0 ? Math.sqrt(amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length) : 0;
    const largeTxns = expTxns.filter((t: any) => Math.abs(t.amount) > mean + 2 * stdDev);

    // Category variance
    const monthCats: Record<string, Record<string, number>> = {};
    expTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      const m = t.transaction_date?.slice(0, 7);
      if (!m) return;
      if (!monthCats[cat]) monthCats[cat] = {};
      monthCats[cat][m] = (monthCats[cat][m] || 0) + Math.abs(t.amount);
    });

    const spikeCategories: { cat: string; variance: number; latest: number; avg: number }[] = [];
    Object.entries(monthCats).forEach(([cat, months]) => {
      const vals = Object.values(months);
      if (vals.length < 2) return;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const latest = vals[vals.length - 1];
      const variance = avg > 0 ? ((latest - avg) / avg) * 100 : 0;
      if (Math.abs(variance) > 30) spikeCategories.push({ cat, variance, latest, avg });
    });

    const runway = avgBurn > 0 ? totalBalance / avgBurn : Infinity;

    return {
      totalExpenses, totalIncome, totalBalance, avgBurn, avgIncome, runway,
      catSpend, overdueBills, overdueInvoices,
      duplicateCount, duplicateAmount, weekendTxns, largeTxns,
      spikeCategories, txnCount: transactions.length, expCount: expTxns.length,
      monthlyBurn, monthlyInc,
    };
  }, [transactions, bills, invoices, bankAccounts]);

  // Generate AI insights using rules engine + optional AI call
  const generateInsights = useCallback(async () => {
    setAiLoading(true);
    const insights: AIRiskInsight[] = [];
    let nextId = 1;
    const id = () => `ai-${nextId++}`;

    // 1. Cash Runway Analysis
    if (metrics.runway < 3 && metrics.runway !== Infinity) {
      insights.push({
        id: id(), severity: metrics.runway < 1 ? "critical" : "high",
        category: "Liquidity",
        title: `Cash Runway: ${metrics.runway.toFixed(1)} Months`,
        description: `At the current burn rate of ${formatAmount(metrics.avgBurn, currency)}/month, your cash reserves of ${formatAmount(metrics.totalBalance, currency)} will be depleted in ${metrics.runway.toFixed(1)} months.`,
        impact: `Risk of inability to meet obligations within ${Math.ceil(metrics.runway)} months`,
        suggestion: metrics.runway < 1
          ? "URGENT: Immediately reduce non-essential spending. Consider emergency credit facilities. Accelerate receivables collection. Negotiate extended payment terms with vendors."
          : "Reduce monthly burn rate by 20-30%. Prioritize revenue-generating activities. Build a 6-month cash reserve. Review and eliminate unused subscriptions and services.",
        affectedAmount: metrics.totalBalance,
      });
    }

    // 2. Income vs Expense Imbalance
    if (metrics.avgIncome > 0 && metrics.avgBurn > metrics.avgIncome) {
      const deficit = metrics.avgBurn - metrics.avgIncome;
      insights.push({
        id: id(), severity: deficit / metrics.avgBurn > 0.3 ? "critical" : "high",
        category: "Cash Flow",
        title: "Monthly Expenses Exceed Income",
        description: `Average monthly expenses (${formatAmount(metrics.avgBurn, currency)}) exceed income (${formatAmount(metrics.avgIncome, currency)}) by ${formatAmount(deficit, currency)}/month.`,
        impact: `Net cash drain of ${formatAmount(deficit, currency)} per month — unsustainable`,
        suggestion: "Identify the top 3 expense categories for cost reduction. Explore additional revenue streams. Set strict departmental budgets. Consider renegotiating vendor contracts for better rates.",
        affectedAmount: deficit,
      });
    }

    // 3. Overdue Payables
    if (metrics.overdueBills.length > 0) {
      const overdueTotal = metrics.overdueBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      const oldestDays = Math.max(...metrics.overdueBills.map((b: any) => b.due_date ? differenceInDays(new Date(), parseISO(b.due_date)) : 0));
      insights.push({
        id: id(), severity: oldestDays > 60 ? "critical" : oldestDays > 30 ? "high" : "medium",
        category: "Accounts Payable",
        title: `${metrics.overdueBills.length} Overdue Bills (${formatAmount(overdueTotal, currency)})`,
        description: `${metrics.overdueBills.length} bills are past their due date, totaling ${formatAmount(overdueTotal, currency)}. Oldest is ${oldestDays} days overdue.`,
        impact: "Risk of late payment penalties, damaged vendor relationships, and potential supply disruption",
        suggestion: `Prioritize payment of the ${Math.min(3, metrics.overdueBills.length)} largest overdue bills. Contact vendors to negotiate payment plans. Set up automated payment reminders 7 days before due dates. Implement a weekly AP review process.`,
        affectedAmount: overdueTotal,
      });
    }

    // 4. Overdue Receivables
    if (metrics.overdueInvoices.length > 0) {
      const overdueTotal = metrics.overdueInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
      insights.push({
        id: id(), severity: overdueTotal > metrics.totalBalance * 0.5 ? "high" : "medium",
        category: "Accounts Receivable",
        title: `${metrics.overdueInvoices.length} Overdue Invoices (${formatAmount(overdueTotal, currency)})`,
        description: `${formatAmount(overdueTotal, currency)} in receivables are past due. This represents potential cash that should already be collected.`,
        impact: `${formatAmount(overdueTotal, currency)} in uncollected revenue impacting cash flow`,
        suggestion: "Send payment reminders immediately for all overdue invoices. Implement escalating follow-up: email at 7 days, phone call at 14 days, formal notice at 30 days. Consider offering early payment discounts (2/10 net 30). Review credit terms for repeat late payers.",
        affectedAmount: overdueTotal,
      });
    }

    // 5. Duplicate Transaction Risk
    if (metrics.duplicateCount > 0) {
      insights.push({
        id: id(), severity: metrics.duplicateAmount > metrics.avgBurn * 0.1 ? "high" : "medium",
        category: "Transaction Integrity",
        title: `${metrics.duplicateCount} Possible Duplicate Payments`,
        description: `Detected ${metrics.duplicateCount} transactions with identical amounts occurring within 3 days of each other, totaling ${formatAmount(metrics.duplicateAmount, currency)}.`,
        impact: `Potential overpayment of ${formatAmount(metrics.duplicateAmount, currency)}`,
        suggestion: "Review each flagged pair in the High-Risk Transactions tab. Implement a duplicate detection check before processing payments. Set up approval workflows for payments matching existing recent transactions. Request refunds for confirmed duplicates.",
        affectedAmount: metrics.duplicateAmount,
      });
    }

    // 6. Expense Concentration Risk
    const sortedCats = Object.entries(metrics.catSpend).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0 && metrics.totalExpenses > 0) {
      const topCat = sortedCats[0];
      const topPct = (topCat[1] / metrics.totalExpenses) * 100;
      if (topPct > 40) {
        insights.push({
          id: id(), severity: topPct > 60 ? "high" : "medium",
          category: "Expense Diversification",
          title: `${topCat[0]} Dominates Spending (${topPct.toFixed(0)}%)`,
          description: `The "${topCat[0]}" category accounts for ${topPct.toFixed(0)}% of all expenses (${formatAmount(topCat[1], currency)}).`,
          impact: "High concentration risk — disruption in this category could severely impact operations",
          suggestion: `Diversify vendor relationships within ${topCat[0]}. Negotiate volume discounts or long-term contracts to stabilize costs. Evaluate alternative providers. Set a category spending cap at ${(topPct * 0.8).toFixed(0)}% of total expenses.`,
          affectedAmount: topCat[1],
        });
      }
    }

    // 7. Spending Variance Spikes
    metrics.spikeCategories.forEach((sc) => {
      if (sc.variance > 50) {
        insights.push({
          id: id(), severity: sc.variance > 100 ? "high" : "medium",
          category: "Variance",
          title: `${sc.cat}: +${sc.variance.toFixed(0)}% Spending Spike`,
          description: `"${sc.cat}" spending jumped from avg ${formatAmount(sc.avg, currency)} to ${formatAmount(sc.latest, currency)} (${sc.variance.toFixed(0)}% increase).`,
          impact: `${formatAmount(sc.latest - sc.avg, currency)} above expected baseline spending`,
          suggestion: `Investigate the root cause in "${sc.cat}". Check for one-time purchases vs recurring increase. Set spending alerts when category exceeds ${formatAmount(sc.avg * 1.2, currency)} (120% of average). Require approval for purchases above ${formatAmount(sc.avg * 0.5, currency)}.`,
          affectedAmount: sc.latest - sc.avg,
        });
      }
    });

    // 8. Large Transaction Outliers
    if (metrics.largeTxns.length > 3) {
      const largeTotal = metrics.largeTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      insights.push({
        id: id(), severity: "medium",
        category: "Transaction Review",
        title: `${metrics.largeTxns.length} Unusually Large Transactions`,
        description: `${metrics.largeTxns.length} transactions significantly exceed the statistical norm (>2 standard deviations), totaling ${formatAmount(largeTotal, currency)}.`,
        impact: "May indicate unauthorized spending, pricing errors, or unusual business activity",
        suggestion: "Review all flagged large transactions for authorization. Implement tiered approval limits (e.g., >5K requires manager, >20K requires director). Set up real-time alerts for transactions exceeding threshold amounts.",
        affectedAmount: largeTotal,
        relatedTransactions: metrics.largeTxns.slice(0, 5),
      });
    }

    // 9. Weekend Transaction Activity
    if (metrics.weekendTxns.length > 5) {
      const weekendTotal = metrics.weekendTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
      insights.push({
        id: id(), severity: "low",
        category: "Timing",
        title: `${metrics.weekendTxns.length} Weekend Transactions Detected`,
        description: `${metrics.weekendTxns.length} expense transactions occurred on Saturday/Sunday, totaling ${formatAmount(weekendTotal, currency)}.`,
        impact: "Weekend transactions may indicate personal use, unauthorized activity, or control weaknesses",
        suggestion: "Review weekend transactions for legitimacy. Consider implementing weekend spending restrictions or additional approval requirements. Separate business and personal spending accounts.",
        affectedAmount: weekendTotal,
        relatedTransactions: metrics.weekendTxns.slice(0, 5),
      });
    }

    // 10. Burn Rate Trend
    const burnEntries = Object.entries(metrics.monthlyBurn).sort(([a], [b]) => a.localeCompare(b));
    if (burnEntries.length >= 4) {
      const recent = burnEntries.slice(-2).map(([, v]) => v);
      const older = burnEntries.slice(0, -2).map(([, v]) => v);
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const olderAvg = older.reduce((s, v) => s + v, 0) / older.length;
      if (olderAvg > 0 && recentAvg > olderAvg * 1.25) {
        const pctIncrease = ((recentAvg / olderAvg - 1) * 100);
        insights.push({
          id: id(), severity: pctIncrease > 50 ? "high" : "medium",
          category: "Burn Rate",
          title: `Burn Rate Accelerating (+${pctIncrease.toFixed(0)}%)`,
          description: `Recent spending average (${formatAmount(recentAvg, currency)}/mo) is ${pctIncrease.toFixed(0)}% higher than earlier periods (${formatAmount(olderAvg, currency)}/mo).`,
          impact: `If trend continues, runway reduces from ${(metrics.totalBalance / olderAvg).toFixed(1)} to ${(metrics.totalBalance / recentAvg).toFixed(1)} months`,
          suggestion: "Conduct a department-by-department spending review. Implement monthly budget caps per category. Freeze non-essential hiring and discretionary spending until burn rate stabilizes. Set a target burn rate of no more than 110% of the historical average.",
          affectedAmount: (recentAvg - olderAvg) * 12,
        });
      }
    }

    // 11. Positive insights
    if (insights.length === 0 || insights.every((i) => i.severity === "low" || i.severity === "medium")) {
      if (metrics.runway > 6) {
        insights.push({
          id: id(), severity: "low",
          category: "Healthy",
          title: "Strong Cash Position",
          description: `Your cash runway of ${metrics.runway.toFixed(1)} months exceeds the recommended 6-month buffer. Cash reserves are healthy.`,
          impact: "Provides stability and ability to weather unexpected expenses",
          suggestion: "Consider investing surplus cash in short-term instruments for better returns. Maintain current fiscal discipline. Set aside 10% of monthly revenue as an emergency reserve.",
        });
      }
      if (metrics.overdueBills.length === 0 && metrics.overdueInvoices.length === 0) {
        insights.push({
          id: id(), severity: "low",
          category: "Healthy",
          title: "No Overdue Items",
          description: "All bills and invoices are current. No overdue payables or receivables detected.",
          impact: "Strong vendor and customer relationships maintained",
          suggestion: "Continue timely payment practices. Consider early payment discounts where offered. Maintain current AR follow-up procedures.",
        });
      }
    }

    // Try AI enhancement via backend
    try {
      const summaryForAI = {
        totalExpenses: metrics.totalExpenses,
        totalIncome: metrics.totalIncome,
        cashBalance: metrics.totalBalance,
        runway: metrics.runway === Infinity ? "unlimited" : metrics.runway.toFixed(1),
        avgMonthlyBurn: metrics.avgBurn,
        avgMonthlyIncome: metrics.avgIncome,
        overdueBillsCount: metrics.overdueBills.length,
        overdueInvoicesCount: metrics.overdueInvoices.length,
        duplicateCount: metrics.duplicateCount,
        topCategories: sortedCats.slice(0, 5).map(([c, v]) => `${c}: ${v.toFixed(0)}`),
        spikeCategories: metrics.spikeCategories.slice(0, 3).map((s) => `${s.cat}: +${s.variance.toFixed(0)}%`),
        transactionCount: metrics.txnCount,
        currency,
      };

      const aiResponse = await flaskApi.post<{ ai_suggestions?: string[] }>("/risk-ai-insights", { summary: summaryForAI });
      if (aiResponse?.ai_suggestions && Array.isArray(aiResponse.ai_suggestions)) {
        aiResponse.ai_suggestions.forEach((suggestion: string) => {
          if (suggestion && suggestion.length > 10) {
            insights.push({
              id: id(), severity: "medium",
              category: "AI Insight",
              title: "AI Recommendation",
              description: suggestion,
              impact: "AI-generated insight based on financial data patterns",
              suggestion: suggestion,
            });
          }
        });
      }
    } catch {
      // AI backend not available — rule-based insights are sufficient
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    setAiInsights(insights);
    setHasGenerated(true);
    setAiLoading(false);

    // Also generate the shared AI score (same score seen in Control Center)
    generateAIScore();
  }, [metrics, currency, transactions, generateAIScore]);

  const criticalCount = aiInsights.filter((i) => i.severity === "critical").length;
  const highCount = aiInsights.filter((i) => i.severity === "high").length;
  const mediumCount = aiInsights.filter((i) => i.severity === "medium").length;

  if (transactions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Sparkles className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Data for AI Analysis</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Upload bank statements to generate AI-powered risk insights and suggestions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasGenerated) {
    return (
      <div className="space-y-5">
        <Card className="border-2 border-dashed border-primary/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-primary/10 p-5 mb-4">
              <Sparkles className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">AI Risk Intelligence</h3>
            <p className="text-sm text-muted-foreground max-w-lg mb-6">
              Advanced analysis engine that examines your financial data across 11 risk dimensions —
              liquidity, cash flow, payables, receivables, duplicates, concentration, variance, outliers,
              timing patterns, burn rate trends, and more — with actionable suggestions.
            </p>
            <Button size="lg" className="gap-2" onClick={generateInsights} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AI Risk Analysis
            </Button>
            <p className="text-[10px] text-muted-foreground mt-3">
              Analyzes {transactions.length} transactions, {bills.length} bills, {invoices.length} invoices
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary header */}
      <Card className="stat-card-hover">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold">AI Risk Analysis</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {aiInsights.length} insights generated across {new Set(aiInsights.map((i) => i.category)).size} risk categories
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-4">
                {criticalCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-600" />
                    <span className="text-xs font-semibold text-red-600">{criticalCount} Critical</span>
                  </div>
                )}
                {highCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    <span className="text-xs font-semibold text-orange-500">{highCount} High</span>
                  </div>
                )}
                {mediumCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-amber-500">{mediumCount} Medium</span>
                  </div>
                )}
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={generateInsights} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Score — shared with Control Center */}
      {(aiScore?.score != null || aiGenerating) && (
        <Card className="stat-card-hover border-purple-200 dark:border-purple-800">
          <CardContent className="p-5">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2.5">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">AI Risk Score</p>
                  {aiGenerating ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                      <span className="text-sm text-muted-foreground">Analyzing...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className={`text-3xl font-bold ${
                        (aiScore?.score ?? 0) >= 81 ? "text-green-600" :
                        (aiScore?.score ?? 0) >= 61 ? "text-emerald-500" :
                        (aiScore?.score ?? 0) >= 41 ? "text-amber-500" : "text-red-500"
                      }`}>
                        {aiScore?.score}
                      </span>
                      <span className="text-sm text-muted-foreground">/100</span>
                      <Badge variant="outline" className={`text-[10px] ml-1 ${
                        (aiScore?.score ?? 0) >= 81 ? "text-green-700 border-green-200" :
                        (aiScore?.score ?? 0) >= 61 ? "text-emerald-700 border-emerald-200" :
                        (aiScore?.score ?? 0) >= 41 ? "text-amber-700 border-amber-200" : "text-red-700 border-red-200"
                      }`}>
                        {aiScore?.level}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
              {aiScore?.summary && !aiGenerating && (
                <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">{aiScore.summary}</p>
              )}
            </div>
            {aiScore?.factors && aiScore.factors.length > 0 && !aiGenerating && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
                {aiScore.factors.slice(0, 8).map((f) => (
                  <div key={f.name} className="text-center p-2 rounded bg-muted/50">
                    <p className="text-[10px] text-muted-foreground truncate">{f.name}</p>
                    <p className={`text-sm font-bold ${
                      f.score >= 80 ? "text-green-600" : f.score >= 60 ? "text-emerald-500" : f.score >= 40 ? "text-amber-500" : "text-red-500"
                    }`}>{f.score}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Insight cards */}
      <div className="space-y-3">
        {aiInsights.map((insight) => {
          const cfg = SEVERITY_CONFIG[insight.severity] || SEVERITY_CONFIG.medium;
          const SevIcon = cfg.icon;
          return (
            <Card
              key={insight.id}
              className={`stat-card-hover cursor-pointer border-l-4 ${cfg.border}`}
              onClick={() => setSelectedInsight(insight)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`rounded-full p-2 ${cfg.bg} shrink-0 mt-0.5`}>
                    <SevIcon className={`h-4 w-4 ${cfg.text}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold">{insight.title}</span>
                      <Badge variant="outline" className="text-[9px]">{insight.category}</Badge>
                      <SeverityBadge severity={insight.severity} />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{insight.description}</p>
                    {insight.affectedAmount != null && insight.affectedAmount > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-semibold"><FC amount={insight.affectedAmount} currency={currency} /></span>
                        <span className="text-[10px] text-muted-foreground">affected</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Insight Detail Sheet */}
      <Sheet open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedInsight && (() => {
                const cfg = SEVERITY_CONFIG[selectedInsight.severity] || SEVERITY_CONFIG.medium;
                const SevIcon = cfg.icon;
                return <SevIcon className={`h-5 w-5 ${cfg.text}`} />;
              })()}
              {selectedInsight?.title}
            </SheetTitle>
            <SheetDescription>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">{selectedInsight?.category}</Badge>
                {selectedInsight && <SeverityBadge severity={selectedInsight.severity} />}
              </div>
            </SheetDescription>
          </SheetHeader>
          {selectedInsight && (
            <div className="mt-4 space-y-5">
              {/* Description */}
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1.5">Analysis</p>
                <p className="text-sm">{selectedInsight.description}</p>
              </div>

              {/* Impact */}
              <div className={`p-4 rounded-lg border-2 ${
                selectedInsight.severity === "critical" ? "border-red-200 bg-red-50/50" :
                selectedInsight.severity === "high" ? "border-orange-200 bg-orange-50/50" :
                selectedInsight.severity === "medium" ? "border-amber-200 bg-amber-50/50" :
                "border-blue-200 bg-blue-50/50"
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <AlertTriangle className={`h-4 w-4 ${
                    selectedInsight.severity === "critical" ? "text-red-600" :
                    selectedInsight.severity === "high" ? "text-orange-500" :
                    selectedInsight.severity === "medium" ? "text-amber-500" :
                    "text-blue-500"
                  }`} />
                  <p className="text-xs font-semibold uppercase">Impact Assessment</p>
                </div>
                <p className="text-sm">{selectedInsight.impact}</p>
                {selectedInsight.affectedAmount != null && selectedInsight.affectedAmount > 0 && (
                  <div className="mt-2 pt-2 border-t border-current/10">
                    <span className="text-lg font-bold"><FC amount={selectedInsight.affectedAmount} currency={currency} /></span>
                    <span className="text-xs text-muted-foreground ml-1.5">financial exposure</span>
                  </div>
                )}
              </div>

              {/* Suggestion */}
              <div className="p-4 rounded-lg border-2 border-green-200 bg-green-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-green-600" />
                  <p className="text-xs font-semibold text-green-700 uppercase">Recommended Actions</p>
                </div>
                <div className="space-y-2">
                  {selectedInsight.suggestion.split('. ').filter(Boolean).map((s, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-green-700">{i + 1}</span>
                      </div>
                      <p className="text-sm text-green-800">{s.trim().replace(/\.$/, "")}.</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Related Transactions */}
              {selectedInsight.relatedTransactions && selectedInsight.relatedTransactions.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Related Transactions</p>
                  <div className="space-y-1">
                    {selectedInsight.relatedTransactions.map((t: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded text-sm hover:bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate text-xs">{t.counterparty_name || t.description?.slice(0, 40)}</p>
                          <p className="text-[10px] text-muted-foreground">{t.transaction_date}</p>
                        </div>
                        <span className={`text-xs font-semibold ml-2 ${t.amount >= 0 ? "text-green-600" : "text-red-500"}`}>
                          <FC amount={Math.abs(t.amount)} currency={currency} />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────

function KPICard({ label, value, icon: Icon, color, sub, onClick }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; sub?: string; onClick?: () => void;
}) {
  return (
    <Card className={`stat-card-hover${onClick ? " cursor-pointer" : ""}`} onClick={onClick}>
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

function MiniStat({ label, value, color, onClick }: { label: string; value: string | number; color: string; onClick?: () => void }) {
  return (
    <div className={`text-center px-3 py-1.5 rounded-lg bg-muted/50${onClick ? " cursor-pointer hover:bg-muted" : ""}`} onClick={onClick}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      )}
      <span className={done ? "" : "text-muted-foreground"}>{label}</span>
    </div>
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

export default function RiskMonitor() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Risk Monitor
          </h1>
          <p className="text-muted-foreground">
            AI-powered command center — risk scoring, active alerts, high-risk
            transactions, variance analysis, and intelligent suggestions.
          </p>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-1.5">
              <Bell className="h-3.5 w-3.5" />
              Active Alerts
            </TabsTrigger>
            <TabsTrigger value="high-risk" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              High-Risk Txns
            </TabsTrigger>
            <TabsTrigger value="variance" className="gap-1.5">
              <FileWarning className="h-3.5 w-3.5" />
              Variance
            </TabsTrigger>
            <TabsTrigger value="mismatches" className="gap-1.5">
              <Clipboard className="h-3.5 w-3.5" />
              Mismatches
            </TabsTrigger>
            <TabsTrigger value="completion" className="gap-1.5">
              <ListChecks className="h-3.5 w-3.5" />
              Controls
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              AI Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <RiskOverviewTab />
          </TabsContent>
          <TabsContent value="alerts" className="mt-4">
            <ActiveAlertsTab />
          </TabsContent>
          <TabsContent value="high-risk" className="mt-4">
            <HighRiskTransactionsTab />
          </TabsContent>
          <TabsContent value="variance" className="mt-4">
            <VarianceTab />
          </TabsContent>
          <TabsContent value="mismatches" className="mt-4">
            <UnresolvedMismatchesTab />
          </TabsContent>
          <TabsContent value="completion" className="mt-4">
            <ControlCompletionTab />
          </TabsContent>
          <TabsContent value="ai-insights" className="mt-4">
            <AIRiskInsightsTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
