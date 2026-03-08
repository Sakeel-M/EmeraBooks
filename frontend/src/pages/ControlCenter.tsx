import { useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  GitCompareArrows,
  AlertTriangle,
  ShieldAlert,
  Landmark,
  TrendingUp,
  TrendingDown,
  Gauge,
  Activity,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Plug,
  Upload,
  Wallet,
  BarChart3,
  CircleDot,
  Receipt,
  Sparkles,
  Loader2,
  RefreshCw,
  Clock,
  Zap,
  FileWarning,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useRiskAlerts } from "@/hooks/useRiskAlerts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { toast } from "sonner";
import { formatAmount } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { format, differenceInDays, parseISO, isAfter } from "date-fns";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { useAIScore, type AIScoreResult } from "@/hooks/useAIScore";
import { useDateRange } from "@/hooks/useDateRange";
import { TransactionDetailSheet } from "@/components/shared/TransactionDetailSheet";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useState } from "react";

const FLAG_LABELS: Record<string, string> = {
  missing_bill: "Missing Bill",
  missing_invoice: "Missing Invoice",
  missing_in_bank: "Not in Bank",
  missing_in_source_b: "No Ledger Match",
  missing_in_source_a: "No Bank Match",
  amount_mismatch: "Amount Mismatch",
  date_mismatch: "Date Mismatch",
  duplicate_suspect: "Duplicate",
  round_amount: "Round Amount",
  large_transaction: "Large Txn",
  unmatched: "Unmatched",
};

interface RiskBreakdownItem {
  name: string;
  weight: number;
  score: number;
  maxScore: number;
  detail: string;
  status: "good" | "warning" | "critical";
}

interface DrillDown {
  title: string;
  description?: string;
  transactions: any[];
  summary?: { label: string; value: string }[];
  riskBreakdown?: RiskBreakdownItem[];
  aiScore?: AIScoreResult;
  /** "invoice" or "bill" — enables edit/delete actions in the detail sheet */
  itemType?: "invoice" | "bill";
}

export default function ControlCenter() {
  const { clientId, client, currency } = useActiveClient();
  const { totalOpen, bySeverity, breakdown } = useRiskAlerts();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { startDate, endDate, backendReachable } = useDateRange();
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null);
  const { aiScore, aiGenerating, generate: handleGenerateAI } = useAIScore();

  // ── Data queries ──────────────────────────────────────────────────────

  const { data: sessions = [] } = useQuery({
    queryKey: ["recon-sessions", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  const { data: flaggedItems = [] } = useQuery({
    queryKey: ["flagged-items", clientId],
    queryFn: () => database.getFlaggedItems(clientId!),
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["connections", clientId],
    queryFn: () => database.getConnections(clientId!),
    enabled: !!clientId,
  });

  const { data: uploadedFiles = [] } = useQuery({
    queryKey: ["uploaded-files", clientId],
    queryFn: () => database.getUploadedFiles(clientId!),
    enabled: !!clientId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["cc-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["cc-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  // Primary query: uses date range when available, falls back to all transactions
  const { data: recentTxns = [], isLoading: txnLoading } = useQuery({
    queryKey: ["cc-transactions", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string; limit: number } = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
    staleTime: 30_000,
    retry: 2,
  });

  const { data: riskAlerts = [] } = useQuery({
    queryKey: ["cc-risk-alerts", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: { startDate?: string; endDate?: string } = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getRiskAlerts(clientId!, opts);
    },
    enabled: !!clientId,
    refetchInterval: 60_000,
  });

  // Anomaly detection — runs on mount, refreshes every 5 min
  useQuery({
    queryKey: ["anomaly-detection", clientId],
    queryFn: () => database.detectAnomalies(clientId!),
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // ── Derived metrics ───────────────────────────────────────────────────

  const reconStats = useMemo(() => {
    if (sessions.length === 0)
      return { matchRate: 0, totalMatched: 0, totalFlagged: 0, lastDate: null };
    const totalMatched = sessions.reduce((s: number, x: any) => s + (x.match_count || 0), 0);
    const totalFlagged = sessions.reduce((s: number, x: any) => s + (x.flag_count || 0), 0);
    const total = totalMatched + totalFlagged;
    const matchRate = total > 0 ? (totalMatched / total) * 100 : 0;
    const lastDate = sessions[0]?.created_at;
    return { matchRate, totalMatched, totalFlagged, lastDate };
  }, [sessions]);

  const cashPosition = useMemo(() => {
    const byCurrency: Record<string, number> = {};
    bankAccounts
      .filter((a: any) => a.is_active)
      .forEach((a: any) => {
        byCurrency[a.currency] = (byCurrency[a.currency] || 0) + (a.current_balance || 0);
      });
    return byCurrency;
  }, [bankAccounts]);

  const arExposure = useMemo(() => {
    const unpaid = invoices.filter(
      (i: any) => i.status !== "paid" && i.status !== "cancelled",
    );
    const total = unpaid.reduce((s: number, i: any) => s + (i.total || 0), 0);
    const now = new Date();
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
    let overdueCount = 0;
    unpaid.forEach((inv: any) => {
      const amt = inv.total || 0;
      if (!inv.due_date) {
        buckets.current += amt;
        return;
      }
      const due = parseISO(inv.due_date);
      if (!isAfter(now, due)) {
        buckets.current += amt;
      } else {
        overdueCount++;
        const days = differenceInDays(now, due);
        if (days <= 30) buckets.d1_30 += amt;
        else if (days <= 60) buckets.d31_60 += amt;
        else if (days <= 90) buckets.d61_90 += amt;
        else buckets.d90plus += amt;
      }
    });
    return { total, overdueCount, buckets, count: unpaid.length };
  }, [invoices]);

  const monthlyRevenue = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    recentTxns.forEach((t: any) => {
      const key = t.transaction_date?.slice(0, 7);
      if (!key) return;
      if (!months[key]) months[key] = { income: 0, expense: 0 };
      if (t.amount > 0) months[key].income += t.amount;
      else months[key].expense += Math.abs(t.amount);
    });
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
  }, [recentTxns]);

  // AP Exposure for risk score
  const apExposure = useMemo(() => {
    const unpaid = bills.filter((b: any) => b.status !== "paid" && b.status !== "cancelled");
    const total = unpaid.reduce((s: number, b: any) => s + (b.total || 0), 0);
    let overdueCount = 0;
    unpaid.forEach((b: any) => {
      if (b.due_date && isAfter(new Date(), parseISO(b.due_date))) overdueCount++;
    });
    return { total, overdueCount, count: unpaid.length };
  }, [bills]);

  const riskScore = useMemo(() => {
    // 1. Reconciliation (30%): match rate from sessions
    const reconFactor = reconStats.matchRate * 0.3;
    // 2. Alert resolution (20%): 0 open = full score
    const alertFactor = totalOpen === 0 ? 20 : Math.max(0, 20 - totalOpen * 2);
    // 3. AR health (15%): non-overdue / total AR
    const arTotal = arExposure.count;
    const arHealthPct = arTotal > 0 ? ((arTotal - arExposure.overdueCount) / arTotal) * 100 : 100;
    const arFactor = arHealthPct * 0.15;
    // 4. AP health (15%): non-overdue / total AP
    const apTotal = apExposure.count;
    const apHealthPct = apTotal > 0 ? ((apTotal - apExposure.overdueCount) / apTotal) * 100 : 100;
    const apFactor = apHealthPct * 0.15;
    // 5. Data freshness (20%): has uploaded files + recent uploads
    const dataFresh = uploadedFiles.length > 0 ? 20 : 0;
    return Math.min(100, Math.round(reconFactor + alertFactor + arFactor + apFactor + dataFresh));
  }, [reconStats.matchRate, totalOpen, uploadedFiles, arExposure, apExposure]);

  const riskLevel =
    riskScore >= 81 ? "Low Risk" : riskScore >= 61 ? "Medium Risk" : riskScore >= 41 ? "High Risk" : "Critical Risk";

  const riskColor =
    riskScore >= 81 ? "text-green-600" : riskScore >= 61 ? "text-emerald-500" : riskScore >= 41 ? "text-amber-500" : "text-red-500";

  const riskBadgeColor =
    riskScore >= 81 ? "bg-green-100 text-green-700 border-green-200" : riskScore >= 61 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : riskScore >= 41 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200";

  // Total revenue across the entire selected date range
  const totalRevenue = useMemo(() => {
    return recentTxns
      .filter((t: any) => t.amount > 0)
      .reduce((s: number, t: any) => s + t.amount, 0);
  }, [recentTxns]);

  const totalExpenses = useMemo(() => {
    return recentTxns
      .filter((t: any) => t.amount < 0)
      .reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
  }, [recentTxns]);

  const revenueTrend = useMemo(() => {
    if (monthlyRevenue.length < 2) return 0;
    const last = monthlyRevenue[monthlyRevenue.length - 1][1].income;
    const prev = monthlyRevenue[monthlyRevenue.length - 2][1].income;
    return prev > 0 ? ((last - prev) / prev) * 100 : 0;
  }, [monthlyRevenue]);

  const totalBalance = useMemo(() => {
    const bankTotal = Object.values(cashPosition).reduce((s, v) => s + v, 0);
    // Fallback: if no bank accounts but we have transactions, compute from transactions
    if (bankTotal === 0 && bankAccounts.length === 0 && recentTxns.length > 0) {
      return recentTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0);
    }
    return bankTotal;
  }, [cashPosition, bankAccounts, recentTxns]);

  // ── AI Risk Score ────────────────────────────────────────────────────

  const aiRiskColor = aiScore?.score != null
    ? (aiScore.score >= 81 ? "text-green-600" : aiScore.score >= 61 ? "text-emerald-500" : aiScore.score >= 41 ? "text-amber-500" : "text-red-500")
    : "text-muted-foreground";

  const aiRiskBadgeColor = aiScore?.score != null
    ? (aiScore.score >= 81 ? "bg-green-100 text-green-700 border-green-200" : aiScore.score >= 61 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : aiScore.score >= 41 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-red-100 text-red-700 border-red-200")
    : "bg-muted text-muted-foreground border-muted";

  // ── Chart data ────────────────────────────────────────────────────────

  const revenueChartConfig: ChartConfig = {
    income: { label: "Income", color: "hsl(143 44% 22%)" },
    expense: { label: "Expenses", color: "hsl(0 72% 51%)" },
  };

  const revenueChartData = useMemo(
    () =>
      monthlyRevenue.map(([month, data]) => ({
        month: format(new Date(month + "-01"), "MMM"),
        income: data.income,
        expense: data.expense,
      })),
    [monthlyRevenue],
  );

  const reconChartConfig: ChartConfig = {
    matched: { label: "Matched", color: "hsl(143 44% 28%)" },
    flagged: { label: "Flagged", color: "hsl(45 93% 47%)" },
  };

  const reconPieData = useMemo(
    () => [
      { name: "Matched", value: reconStats.totalMatched || 0, fill: "hsl(143 44% 28%)" },
      { name: "Flagged", value: reconStats.totalFlagged || 0, fill: "hsl(45 93% 47%)" },
    ],
    [reconStats],
  );

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="space-y-6">
        {/* ── Header ── */}
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Control Center
          </h1>
          <p className="text-muted-foreground">
            {client?.name
              ? `Executive overview for ${client.name}`
              : "Financial health at a glance"}
          </p>
        </div>

        {backendReachable === false && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Backend not reachable — charts and KPIs require the Flask server on port 5000.</span>
          </div>
        )}

        {/* ── Hero: Basic Insight + AI Insight + Quick Stats ── */}
        <Card className="stat-card-hover chart-enter overflow-hidden border-0 shadow-md">
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6 items-center">
                {/* Basic Insight — circle gauge */}
                <div
                  className="flex flex-col items-center cursor-pointer gap-1.5"
                  onClick={() => {
                    const reconFactor = reconStats.matchRate * 0.3;
                    const alertFactor = totalOpen === 0 ? 20 : Math.max(0, 20 - totalOpen * 2);
                    const arTotal = arExposure.count;
                    const arHealthPct = arTotal > 0 ? ((arTotal - arExposure.overdueCount) / arTotal) * 100 : 100;
                    const arFactor = arHealthPct * 0.15;
                    const apTotal = apExposure.count;
                    const apHealthPct = apTotal > 0 ? ((apTotal - apExposure.overdueCount) / apTotal) * 100 : 100;
                    const apFactor = apHealthPct * 0.15;
                    const dataFresh = uploadedFiles.length > 0 ? 20 : 0;
                    setDrillDown({
                      title: `Basic Insight — ${riskScore}/100 (${riskLevel})`,
                      description: "Rule-based risk score from 5 weighted factors.",
                      transactions: [],
                      summary: [
                        { label: "Risk Score", value: `${riskScore}/100` },
                        { label: "Level", value: riskLevel },
                        { label: "Factors", value: "5 weighted" },
                      ],
                      riskBreakdown: [
                        { name: "Reconciliation", weight: 30, score: Math.round(reconFactor), maxScore: 30, detail: `Match rate: ${reconStats.matchRate.toFixed(1)}% across ${sessions.length} session(s)`, status: reconStats.matchRate >= 90 ? "good" : reconStats.matchRate >= 70 ? "warning" : "critical" },
                        { name: "Alert Resolution", weight: 20, score: Math.round(alertFactor), maxScore: 20, detail: `${totalOpen} open alert(s) — ${bySeverity.critical} critical, ${bySeverity.high} high`, status: totalOpen === 0 ? "good" : totalOpen <= 3 ? "warning" : "critical" },
                        { name: "AR Health", weight: 15, score: Math.round(arFactor), maxScore: 15, detail: `${arExposure.overdueCount} overdue of ${arTotal} unpaid invoice(s) — ${formatAmount(arExposure.total, currency)} outstanding`, status: arExposure.overdueCount === 0 ? "good" : arExposure.overdueCount <= 3 ? "warning" : "critical" },
                        { name: "AP Health", weight: 15, score: Math.round(apFactor), maxScore: 15, detail: `${apExposure.overdueCount} overdue of ${apTotal} unpaid bill(s) — ${formatAmount(apExposure.total, currency)} outstanding`, status: apExposure.overdueCount === 0 ? "good" : apExposure.overdueCount <= 3 ? "warning" : "critical" },
                        { name: "Data Freshness", weight: 20, score: dataFresh, maxScore: 20, detail: `${uploadedFiles.length} file(s) uploaded, ${connections.length} live connection(s)`, status: uploadedFiles.length > 0 ? "good" : "critical" },
                      ],
                    } as any);
                  }}
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Basic Insight</p>
                  {/* SVG circular gauge with score centered */}
                  <div className="relative" style={{ width: 100, height: 100 }}>
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(143 20% 92%)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                        stroke={riskScore >= 81 ? "hsl(143 60% 35%)" : riskScore >= 61 ? "hsl(155 50% 40%)" : riskScore >= 41 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"}
                        strokeDasharray={`${(riskScore / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className={`text-2xl font-bold font-heading leading-none ${riskColor}`}>{riskScore}</span>
                    </div>
                  </div>
                  <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${riskBadgeColor}`}>{riskLevel}</span>
                </div>

                {/* AI Insight — circle gauge */}
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> AI Insight
                  </p>
                  {aiScore?.score != null ? (
                    <>
                      <div
                        className="relative cursor-pointer"
                        style={{ width: 100, height: 100 }}
                        onClick={() => {
                          if (aiScore) {
                            setDrillDown({
                              title: `AI Insight — ${aiScore.score}/100 (${aiScore.level || "N/A"})`,
                              description: aiScore.summary,
                              transactions: [],
                              summary: [
                                { label: "AI Score", value: `${aiScore.score}/100` },
                                { label: "Level", value: aiScore.level || "N/A" },
                                { label: "Dimensions", value: `${aiScore.factors.length} analyzed` },
                              ],
                              aiScore,
                            });
                          }
                        }}
                      >
                        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                          <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(265 20% 92%)" strokeWidth="8" />
                          <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" strokeLinecap="round"
                            stroke={aiScore.score >= 81 ? "hsl(143 60% 35%)" : aiScore.score >= 61 ? "hsl(155 50% 40%)" : aiScore.score >= 41 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)"}
                            strokeDasharray={`${(aiScore.score / 100) * 2 * Math.PI * 42} ${2 * Math.PI * 42}`}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className={`text-2xl font-bold font-heading leading-none ${aiRiskColor}`}>{aiScore.score}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${aiRiskBadgeColor}`}>{aiScore.level || "AI Score"}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 text-[9px] text-muted-foreground gap-1 px-1"
                        onClick={handleGenerateAI}
                        disabled={aiGenerating}
                      >
                        {aiGenerating ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <RefreshCw className="h-2.5 w-2.5" />}
                        Refresh
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center" style={{ width: 100, height: 100 }}>
                      {aiGenerating ? (
                        <div className="flex flex-col items-center gap-1.5">
                          <Loader2 className="h-6 w-6 animate-spin text-purple-500" />
                          <span className="text-[10px] text-muted-foreground">Analyzing...</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 text-xs border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/20"
                          onClick={handleGenerateAI}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Generate
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Stats */}
                <div
                  className="text-center space-y-1 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => {
                    if (sessions.length > 0) {
                      setDrillDown({
                        title: "Match Rate — Reconciliation",
                        description: `${sessions.length} session(s) · ${reconStats.totalMatched + reconStats.totalFlagged} items processed`,
                        transactions: flaggedItems.map((item: any) => ({
                          ...item,
                          transaction_date: item.source_a_date || item.source_b_date || null,
                          description: item.source_a_desc || item.source_b_desc || item.flag_type || "Flagged item",
                          amount: item.source_a_amount ?? item.source_b_amount ?? item.difference ?? 0,
                        })),
                        summary: [
                          { label: "Match Rate", value: `${reconStats.matchRate.toFixed(1)}%` },
                          { label: "Matched", value: String(reconStats.totalMatched) },
                          { label: "Flagged", value: String(reconStats.totalFlagged) },
                          { label: "Sessions", value: String(sessions.length) },
                        ],
                      });
                    } else {
                      navigate("/reconciliation");
                    }
                  }}
                >
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Match Rate
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {reconStats.matchRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {reconStats.totalMatched + reconStats.totalFlagged} items processed
                  </p>
                </div>
                <div
                  className="text-center space-y-1 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => {
                    if (totalOpen > 0) {
                      const openAlerts = riskAlerts.filter((a: any) => a.status === "open" || a.status === "new");
                      const alertTxns = openAlerts.map((a: any) => ({
                        id: a.id,
                        transaction_date: a.created_at?.slice(0, 10),
                        description: a.title || a.description || a.alert_type || "Risk Alert",
                        amount: a.amount || 0,
                        category: a.alert_type === "anomaly" ? "Anomaly" : `Risk: ${a.severity}`,
                      }));
                      const flaggedTxns = flaggedItems.map((f: any) => ({
                        id: f.id,
                        transaction_date: f.source_a_date,
                        description: f.source_a_desc || f.flag_type || "Flagged Item",
                        amount: f.source_a_amount || f.difference || 0,
                        category: "Flagged Reconciliation",
                      }));
                      const overdueInvTxns = invoices
                        .filter((i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && new Date(i.due_date) < new Date())
                        .map((i: any) => ({
                          id: i.id,
                          transaction_date: i.due_date,
                          description: `Invoice ${i.invoice_number || ""} — ${i.v2_customers?.name || "Unknown"}`.trim(),
                          amount: i.total || 0,
                          category: "Overdue Invoice",
                        }));
                      const overdueBillTxns = bills
                        .filter((b: any) => b.status !== "paid" && b.status !== "cancelled" && b.due_date && new Date(b.due_date) < new Date())
                        .map((b: any) => ({
                          id: b.id,
                          transaction_date: b.due_date,
                          description: `Bill ${b.bill_number || ""} — ${b.v2_vendors?.name || "Unknown"}`.trim(),
                          amount: b.total || 0,
                          category: "Overdue Bill",
                        }));

                      const summaryItems: { label: string; value: string }[] = [];
                      if (breakdown.riskAlerts > 0) summaryItems.push({ label: "Risk Alerts", value: String(breakdown.riskAlerts) });
                      if (breakdown.anomalies > 0) summaryItems.push({ label: "Anomalies", value: String(breakdown.anomalies) });
                      if (breakdown.flaggedRecon > 0) summaryItems.push({ label: "Flagged Reconciliation", value: String(breakdown.flaggedRecon) });
                      if (breakdown.overdueInvoices > 0) summaryItems.push({ label: "Overdue Invoices", value: String(breakdown.overdueInvoices) });
                      if (breakdown.overdueBills > 0) summaryItems.push({ label: "Overdue Bills", value: String(breakdown.overdueBills) });

                      setDrillDown({
                        title: "All Open Alerts",
                        description: `${totalOpen} item(s) requiring attention`,
                        transactions: [...alertTxns, ...flaggedTxns, ...overdueInvTxns, ...overdueBillTxns],
                        summary: summaryItems,
                      });
                    } else {
                      navigate("/risk");
                    }
                  }}
                >
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Open Alerts
                  </p>
                  <p
                    className={`text-2xl font-bold ${totalOpen > 0 ? "text-amber-500" : "text-green-600"}`}
                  >
                    {totalOpen}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {totalOpen > 0
                      ? `${bySeverity.critical > 0 ? `${bySeverity.critical} critical · ` : ""}${breakdown.flaggedRecon > 0 ? `${breakdown.flaggedRecon} flagged` : "Review needed"}`
                      : "All clear"}
                  </p>
                </div>
                <div
                  className="text-center space-y-1 cursor-pointer hover:bg-muted/30 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => {
                    const fileSummary = uploadedFiles.map((f: any) => ({
                      label: f.file_name || "Uploaded file",
                      value: f.created_at ? new Date(f.created_at).toLocaleDateString() : "—",
                    }));
                    setDrillDown({
                      title: "Data Sources",
                      description: `${uploadedFiles.length} file(s) uploaded · ${connections.length} live integration(s)`,
                      transactions: [],
                      summary: [
                        { label: "Uploaded Files", value: String(uploadedFiles.length) },
                        { label: "Live Connections", value: String(connections.length) },
                        ...fileSummary,
                      ],
                    });
                  }}
                >
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    Data Sources
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {uploadedFiles.length + connections.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {uploadedFiles.length} files, {connections.length} live
                  </p>
                </div>
            </div>
          </CardContent>
        </Card>

        {/* ── KPI Row ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Balance",
              value: formatAmount(totalBalance, currency),
              icon: Wallet,
              trend: null as number | null,
              onClick: () => {
                const bankSummary = bankAccounts
                  .filter((a: any) => a.is_active)
                  .map((a: any) => ({
                    label: `${a.bank_name}${a.account_number ? ` ···${a.account_number.slice(-4)}` : ""}`,
                    value: formatAmount(a.current_balance || 0, a.currency),
                  }));
                setDrillDown({
                  title: "Total Balance — Bank Accounts",
                  description: `${bankAccounts.filter((a: any) => a.is_active).length} active account(s) · ${recentTxns.length} transactions in period`,
                  transactions: recentTxns.slice(0, 100),
                  summary: bankSummary.length > 0
                    ? [
                        ...bankSummary,
                        ...(bankSummary.length < 3
                          ? Array.from({ length: 3 - bankSummary.length }, (_, i) => ({
                              label: i === 0 ? "Transactions" : "Net Flow",
                              value: i === 0
                                ? String(recentTxns.length)
                                : formatAmount(
                                    recentTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0),
                                    currency,
                                  ),
                            }))
                          : []),
                      ]
                    : undefined,
                });
              },
              color:
                totalBalance > 0
                  ? "text-primary"
                  : totalBalance < 0
                    ? "text-red-500"
                    : "text-muted-foreground",
            },
            {
              label: "Match Rate",
              value: `${reconStats.matchRate.toFixed(1)}%`,
              icon: GitCompareArrows,
              trend: null as number | null,
              onClick: () => {
                if (sessions.length > 0) {
                  setDrillDown({
                    title: "Match Rate — Reconciliation",
                    description: `${sessions.length} session(s) · ${reconStats.totalMatched + reconStats.totalFlagged} items processed`,
                    transactions: flaggedItems.map((item: any) => ({
                      ...item,
                      transaction_date: item.source_a_date || item.source_b_date || null,
                      description: item.source_a_desc || item.source_b_desc || item.flag_type || "Flagged item",
                      amount: item.source_a_amount ?? item.source_b_amount ?? item.difference ?? 0,
                    })),
                    summary: [
                      { label: "Match Rate", value: `${reconStats.matchRate.toFixed(1)}%` },
                      { label: "Matched", value: String(reconStats.totalMatched) },
                      { label: "Flagged", value: String(reconStats.totalFlagged) },
                    ],
                  });
                } else {
                  navigate("/reconciliation");
                }
              },
              color:
                reconStats.matchRate >= 90
                  ? "text-green-600"
                  : reconStats.matchRate >= 70
                    ? "text-amber-500"
                    : "text-muted-foreground",
            },
            {
              label: "Expenses",
              value: formatAmount(totalExpenses, currency),
              icon: TrendingDown,
              trend: (() => {
                if (monthlyRevenue.length < 2) return 0;
                const last = monthlyRevenue[monthlyRevenue.length - 1][1].expense;
                const prev = monthlyRevenue[monthlyRevenue.length - 2][1].expense;
                return prev > 0 ? ((last - prev) / prev) * 100 : 0;
              })(),
              onClick: () => {
                const expTxns = recentTxns.filter((t: any) => t.amount < 0);
                setDrillDown({
                  title: "Expenses — All Outflows",
                  description: `${expTxns.length} expense transactions in selected period`,
                  transactions: expTxns,
                  summary: [
                    { label: "Total Expenses", value: formatAmount(totalExpenses, currency) },
                    { label: "Transactions", value: String(expTxns.length) },
                    { label: "Avg per Txn", value: formatAmount(expTxns.length > 0 ? totalExpenses / expTxns.length : 0, currency) },
                  ],
                });
              },
              color: "text-red-500",
            },
            {
              label: "Revenue",
              value: formatAmount(totalRevenue, currency),
              icon: TrendingUp,
              trend: revenueTrend,
              onClick: () => {
                const incomeTxns = recentTxns.filter((t: any) => t.amount > 0);
                setDrillDown({
                  title: "Revenue — All Income",
                  description: `${incomeTxns.length} income transactions in selected period`,
                  transactions: incomeTxns,
                  summary: [
                    { label: "Total Income", value: formatAmount(totalRevenue, currency) },
                    { label: "Transactions", value: String(incomeTxns.length) },
                    { label: "Avg per Txn", value: formatAmount(incomeTxns.length > 0 ? totalRevenue / incomeTxns.length : 0, currency) },
                  ],
                });
              },
              color: "text-primary",
            },
          ].map((kpi) => (
            <Card
              key={kpi.label}
              className="stat-card-hover cursor-pointer group"
              onClick={kpi.onClick}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                    {kpi.label}
                  </span>
                  <kpi.icon className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
                </div>
                <div className="flex items-end gap-2 min-w-0">
                  <span className={`text-xl font-bold ${kpi.color} truncate`}>
                    {kpi.value}
                  </span>
                  {kpi.trend !== null && kpi.trend !== 0 && (
                    <span
                      className={`text-xs flex items-center gap-0.5 ${kpi.trend > 0 ? "text-green-600" : "text-red-500"}`}
                    >
                      {kpi.trend > 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(kpi.trend).toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Main Grid ── */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Revenue & Expense Trend — AreaChart */}
          <Card
            className="stat-card-hover chart-enter cursor-pointer"
            onClick={() => {
              if (recentTxns.length > 0) {
                setDrillDown({
                  title: "Revenue & Expense Trend",
                  description: `${monthlyRevenue.length} months of data`,
                  transactions: recentTxns,
                  summary: [
                    { label: "Total Income", value: formatAmount(totalRevenue, currency) },
                    { label: "Total Expenses", value: formatAmount(totalExpenses, currency) },
                    { label: "Net", value: formatAmount(totalRevenue - totalExpenses, currency) },
                  ],
                });
              } else {
                navigate("/integrations");
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Revenue & Expense Trend
                </CardTitle>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {monthlyRevenue.length > 0 ? `${monthlyRevenue.length} months` : "—"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {txnLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : recentTxns.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  text="No transaction data yet"
                  cta="Upload a bank statement"
                  onClick={() => navigate("/integrations")}
                />
              ) : (
                <ChartContainer
                  config={revenueChartConfig}
                  className="h-[200px] w-full !aspect-auto"
                >
                  <AreaChart data={revenueChartData}>
                    <defs>
                      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(143 44% 22%)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(143 44% 22%)" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(0 72% 51%)" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(0 72% 51%)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} className="text-[11px]" />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={70}
                      className="text-[11px]"
                      tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString()}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatAmount(Number(value), currency)}
                        />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stroke="hsl(143 44% 22%)"
                      strokeWidth={2.5}
                      fill="url(#incomeGrad)"
                      dot={{ r: 3, fill: "hsl(143 44% 22%)", strokeWidth: 0 }}
                      activeDot={{ r: 5, stroke: "hsl(143 44% 22%)", strokeWidth: 2, fill: "white" }}
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stroke="hsl(0 72% 51%)"
                      strokeWidth={2}
                      fill="url(#expenseGrad)"
                      dot={{ r: 2, fill: "hsl(0 72% 51%)", strokeWidth: 0 }}
                      activeDot={{ r: 4, stroke: "hsl(0 72% 51%)", strokeWidth: 2, fill: "white" }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          {/* Reconciliation — PieChart donut */}
          <Card
            className="stat-card-hover chart-enter cursor-pointer"
            onClick={() => {
              if (sessions.length > 0) {
                setDrillDown({
                  title: "Reconciliation Summary",
                  description: `${sessions.length} session(s) completed`,
                  transactions: flaggedItems.map((item: any) => ({
                    ...item,
                    transaction_date: item.source_a_date || item.source_b_date || null,
                    description: item.source_a_desc || item.source_b_desc || item.flag_type || "—",
                    amount: item.source_a_amount ?? item.source_b_amount ?? item.difference ?? 0,
                  })),
                  summary: [
                    { label: "Matched", value: String(reconStats.totalMatched) },
                    { label: "Flagged", value: String(reconStats.totalFlagged) },
                    { label: "Match Rate", value: `${reconStats.matchRate.toFixed(1)}%` },
                  ],
                });
              } else {
                navigate("/reconciliation");
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Reconciliation
                </CardTitle>
                <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 && recentTxns.length === 0 && !txnLoading ? (
                <EmptyState
                  icon={GitCompareArrows}
                  text="No reconciliations yet"
                  cta="Upload a bank statement to start"
                  onClick={() => navigate("/integrations")}
                />
              ) : sessions.length === 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-amber-50 p-2">
                      <GitCompareArrows className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Ready to reconcile</p>
                      <p className="text-xs text-muted-foreground">
                        {recentTxns.length} transactions available
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold text-primary">
                        {recentTxns.filter((t: any) => t.amount > 0).length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Credits</p>
                    </div>
                    <div className="p-2 rounded bg-muted/50">
                      <p className="text-lg font-bold text-red-500">
                        {recentTxns.filter((t: any) => t.amount < 0).length}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Debits</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={(e) => { e.stopPropagation(); navigate("/reconciliation"); }}
                  >
                    Start Reconciliation <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ChartContainer
                    config={reconChartConfig}
                    className="h-[160px] w-[160px] shrink-0 !aspect-square"
                  >
                    <PieChart>
                      <Pie
                        data={reconPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={68}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {reconPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                  <div className="flex-1 space-y-3">
                    <div>
                      <span className="text-3xl font-bold text-primary">
                        {reconStats.matchRate.toFixed(0)}%
                      </span>
                      <span className="text-sm text-muted-foreground ml-1">
                        match rate
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[hsl(143_44%_28%)]" />
                        <span className="text-sm flex-1">Matched</span>
                        <span className="font-semibold text-sm">
                          {reconStats.totalMatched}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-[hsl(45_93%_47%)]" />
                        <span className="text-sm flex-1">Flagged</span>
                        <span className="font-semibold text-sm text-amber-600">
                          {reconStats.totalFlagged}
                        </span>
                      </div>
                    </div>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      {sessions.length} session
                      {sessions.length !== 1 && "s"} completed
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* AR Exposure */}
          <Card
            className="stat-card-hover cursor-pointer"
            onClick={() => {
              const unpaid = invoices.filter((i: any) => i.status !== "paid" && i.status !== "cancelled");
              setDrillDown({
                title: unpaid.length > 0 ? "AR Exposure — Unpaid Invoices" : "AR — All Invoices Collected",
                description: unpaid.length > 0
                  ? `${unpaid.length} unpaid invoices totalling ${formatAmount(arExposure.total, currency)}`
                  : `All ${invoices.length} invoices are paid`,
                transactions: unpaid.length > 0 ? unpaid : invoices,
                itemType: "invoice",
                summary: [
                  { label: "Total Invoices", value: String(invoices.length) },
                  { label: "Collected", value: String(invoices.filter((i: any) => i.status === "paid").length) },
                  { label: "Outstanding", value: formatAmount(arExposure.total, currency) },
                ],
              });
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  AR Exposure
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {invoices.length === 0 && recentTxns.length === 0 && !txnLoading ? (
                <EmptyState
                  icon={Receipt}
                  text="No invoices yet"
                  cta="Upload a bank statement"
                  onClick={() => navigate("/integrations")}
                />
              ) : invoices.length === 0 || arExposure.total === 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-50 p-2.5">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-600">All Collected</p>
                      <p className="text-xs text-muted-foreground">
                        {invoices.length > 0
                          ? `${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} fully paid`
                          : `${recentTxns.filter((t: any) => t.amount > 0).length} income transactions recorded`}
                      </p>
                    </div>
                  </div>
                  {invoices.length > 0 && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Total collected</span>
                        <span className="font-semibold text-foreground">
                          {formatAmount(invoices.reduce((s: number, i: any) => s + (i.total || 0), 0), currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-primary">
                      {formatAmount(arExposure.total, currency)}
                    </span>
                    {arExposure.overdueCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] h-5">
                        {arExposure.overdueCount} overdue
                      </Badge>
                    )}
                  </div>
                  {/* Aging buckets bar */}
                  {arExposure.total > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex h-3 rounded-full overflow-hidden">
                        {[
                          { key: "current", color: "bg-green-500", label: "Current" },
                          { key: "d1_30", color: "bg-yellow-400", label: "1-30d" },
                          { key: "d31_60", color: "bg-orange-400", label: "31-60d" },
                          { key: "d61_90", color: "bg-red-400", label: "61-90d" },
                          { key: "d90plus", color: "bg-red-700", label: "90+d" },
                        ].map((bucket) => {
                          const val = arExposure.buckets[bucket.key as keyof typeof arExposure.buckets];
                          const pct = arExposure.total > 0 ? (val / arExposure.total) * 100 : 0;
                          return pct > 0 ? (
                            <div
                              key={bucket.key}
                              className={`${bucket.color} transition-all`}
                              style={{ width: `${pct}%` }}
                              title={`${bucket.label}: ${formatAmount(val, currency)}`}
                            />
                          ) : null;
                        })}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {[
                          { key: "current", color: "bg-green-500", label: "Current" },
                          { key: "d1_30", color: "bg-yellow-400", label: "1-30" },
                          { key: "d31_60", color: "bg-orange-400", label: "31-60" },
                          { key: "d61_90", color: "bg-red-400", label: "61-90" },
                          { key: "d90plus", color: "bg-red-700", label: "90+" },
                        ].map((bucket) => {
                          const val = arExposure.buckets[bucket.key as keyof typeof arExposure.buckets];
                          return val > 0 ? (
                            <div key={bucket.key} className="flex items-center gap-1 text-[10px]">
                              <div className={`w-1.5 h-1.5 rounded-full ${bucket.color}`} />
                              <span className="text-muted-foreground">{bucket.label}</span>
                            </div>
                          ) : null;
                        })}
                      </div>
                    </div>
                  )}
                  <Separator />
                  <p className="text-xs text-muted-foreground">
                    {arExposure.count} unpaid invoice{arExposure.count !== 1 && "s"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Mismatches */}
          <Card
            className="stat-card-hover cursor-pointer"
            onClick={() => {
              if (flaggedItems.length > 0) {
                const byType: Record<string, any[]> = {};
                flaggedItems.forEach((item: any) => {
                  const t = item.flag_type || "unmatched";
                  (byType[t] = byType[t] || []).push(item);
                });
                const totalAmt = flaggedItems.reduce((s: number, i: any) => {
                  const amt = Math.abs(i.source_a_amount ?? i.source_b_amount ?? i.difference ?? 0);
                  return s + amt;
                }, 0);
                setDrillDown({
                  title: "Open Mismatches",
                  description: `${flaggedItems.length} unresolved flagged item(s) totaling ${formatAmount(totalAmt, currency)}`,
                  transactions: flaggedItems.map((i: any) => ({
                    id: i.id,
                    transaction_date: i.source_a_date || i.source_b_date,
                    description: i.source_a_desc || i.source_b_desc || i.flag_type || "Mismatch",
                    amount: i.source_a_amount ?? i.source_b_amount ?? i.difference ?? 0,
                    category: FLAG_LABELS[i.flag_type] || i.flag_type || "Flagged",
                  })),
                  summary: [
                    { label: "Total Flagged", value: String(flaggedItems.length) },
                    { label: "Total Amount", value: formatAmount(totalAmt, currency) },
                    { label: "Types", value: String(Object.keys(byType).length) },
                  ],
                });
              } else {
                navigate("/reconciliation");
              }
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Open Mismatches
                </CardTitle>
                <div className="flex items-center gap-2">
                  {flaggedItems.length > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5">
                      {flaggedItems.length}
                    </Badge>
                  )}
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {flaggedItems.length === 0 ? (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="rounded-full bg-green-50 p-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-600">No open mismatches</p>
                    <p className="text-xs text-muted-foreground">All items reconciled</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {flaggedItems
                    .filter((item: any) => {
                      const amt = Math.abs(item.source_a_amount ?? item.source_b_amount ?? item.difference ?? 0);
                      return amt > 0;
                    })
                    .slice(0, 5)
                    .map((item: any) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 text-xs py-1.5 border-b border-muted last:border-0"
                    >
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${
                          item.flag_type?.includes("missing") ? "text-red-600 border-red-200" :
                          item.flag_type === "duplicate_suspect" ? "text-purple-600 border-purple-200" :
                          item.flag_type === "large_transaction" ? "text-red-600 border-red-200" :
                          item.flag_type === "round_amount" ? "text-blue-600 border-blue-200" :
                          "text-amber-600 border-amber-200"
                        }`}
                      >
                        {FLAG_LABELS[item.flag_type] || item.flag_type || "Flagged"}
                      </Badge>
                      <span className="truncate flex-1 text-muted-foreground">
                        {(item.source_a_desc || item.source_b_desc || "Mismatch").slice(0, 40)}
                      </span>
                      <span className="font-semibold shrink-0">
                        {formatAmount(
                          Math.abs(item.source_a_amount ?? item.source_b_amount ?? item.difference ?? 0),
                          currency,
                        )}
                      </span>
                    </div>
                  ))}
                  {flaggedItems.filter((i: any) => Math.abs(i.source_a_amount ?? i.source_b_amount ?? i.difference ?? 0) === 0).length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      +{flaggedItems.filter((i: any) => Math.abs(i.source_a_amount ?? i.source_b_amount ?? i.difference ?? 0) === 0).length} items with zero amount
                    </p>
                  )}
                  {flaggedItems.length > 5 && (
                    <Button
                      variant="link"
                      size="sm"
                      className="px-0 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("/reconciliation");
                      }}
                    >
                      View all {flaggedItems.length} mismatches
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cash Position */}
          <Card
            className="stat-card-hover cursor-pointer"
            onClick={() => {
              const activeBanks = bankAccounts.filter((a: any) => a.is_active);
              setDrillDown({
                title: "Cash Position — Account Details",
                description: `${activeBanks.length} active account(s) · ${recentTxns.length} transactions`,
                transactions: recentTxns.slice(0, 100),
                summary: [
                  { label: "Total Balance", value: formatAmount(totalBalance, currency) },
                  { label: "Accounts", value: String(activeBanks.length) },
                  { label: "Net Flow", value: formatAmount(recentTxns.reduce((s: number, t: any) => s + (t.amount || 0), 0), currency) },
                ],
              });
            }}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Cash Position
                </CardTitle>
                <Landmark className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <EmptyState
                  icon={Landmark}
                  text="No bank accounts connected"
                  cta="Connect a bank account"
                  onClick={() => navigate("/integrations")}
                />
              ) : (
                <div className="space-y-3">
                  {Object.entries(cashPosition).map(([cur, total]) => (
                    <div key={cur}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                          {cur}
                        </span>
                        <span className="text-lg font-bold">
                          {formatAmount(total, cur)}
                        </span>
                      </div>
                      <Progress value={100} className="h-1.5" />
                    </div>
                  ))}
                  <Separator />
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto">
                    {bankAccounts
                      .filter((a: any) => a.is_active)
                      .map((a: any) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground truncate">
                            {a.bank_name}
                            {a.account_number
                              ? ` ···${a.account_number.slice(-4)}`
                              : ""}
                          </span>
                          <span className="font-medium">
                            {formatAmount(a.current_balance, a.currency)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Alerts */}
          <Card className="stat-card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Active Alerts
                </CardTitle>
                <div className="flex items-center gap-2">
                  {totalOpen > 0 && (
                    <Badge variant="destructive" className="text-[10px] h-5">
                      {totalOpen}
                    </Badge>
                  )}
                  <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {totalOpen === 0 ? (
                <div className="flex items-center gap-3 py-6 justify-center">
                  <div className="rounded-full bg-green-50 p-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-green-600">
                      All Clear
                    </p>
                    <p className="text-xs text-muted-foreground">
                      No active alerts
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {([
                    { label: "Risk Alerts", count: breakdown.riskAlerts, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-50", route: "/risk" },
                    { label: "Anomalies", count: breakdown.anomalies, icon: Zap, color: "text-purple-500", bg: "bg-purple-50", route: "/risk" },
                    { label: "Flagged Reconciliation", count: breakdown.flaggedRecon, icon: FileWarning, color: "text-amber-500", bg: "bg-amber-50", route: "/reconciliation" },
                    { label: "Overdue Invoices", count: breakdown.overdueInvoices, icon: Clock, color: "text-orange-500", bg: "bg-orange-50", route: "/revenue" },
                    { label: "Overdue Bills", count: breakdown.overdueBills, icon: Clock, color: "text-rose-500", bg: "bg-rose-50", route: "/expenses" },
                  ])
                    .filter((s) => s.count > 0)
                    .map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-2.5 p-1.5 -mx-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => navigate(item.route)}
                        >
                          <div className={`rounded-md p-1 ${item.bg} shrink-0`}>
                            <Icon className={`h-3.5 w-3.5 ${item.color}`} />
                          </div>
                          <span className="text-sm flex-1">{item.label}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] h-5 ${item.color} border-current/20`}
                          >
                            {item.count}
                          </Badge>
                        </div>
                      );
                    })}
                  {/* Severity sub-row for risk alerts */}
                  {breakdown.riskAlerts > 0 && (bySeverity.critical > 0 || bySeverity.high > 0) && (
                    <div className="flex items-center gap-1.5 pl-8 mt-0.5">
                      {bySeverity.critical > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-red-600 border-red-200">
                          {bySeverity.critical} critical
                        </Badge>
                      )}
                      {bySeverity.high > 0 && (
                        <Badge variant="outline" className="text-[9px] h-4 text-orange-600 border-orange-200">
                          {bySeverity.high} high
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── System Health ── */}
        <Card className="stat-card-hover cursor-pointer" onClick={() => navigate("/integrations")}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">System Health</span>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <StatusDot
                active={uploadedFiles.length > 0}
                icon={Upload}
                label={`Bank Statements: ${uploadedFiles.length > 0 ? `${uploadedFiles.length} uploaded` : "None"}`}
              />
              <Separator orientation="vertical" className="h-5 hidden sm:block" />
              <StatusDot
                active={connections.length > 0}
                icon={Plug}
                label={`Integrations: ${connections.length > 0 ? `${connections.length} connected` : "None"}`}
              />
              <Separator orientation="vertical" className="h-5 hidden sm:block" />
              <StatusDot
                active={sessions.length > 0}
                icon={GitCompareArrows}
                label={`Reconciliation: ${sessions.length > 0 ? `${sessions.length} sessions` : "Not started"}`}
              />
              {connections.slice(0, 3).map((conn: any) => (
                <span key={conn.id} className="contents">
                  <Separator orientation="vertical" className="h-5 hidden sm:block" />
                  <StatusDot
                    active={conn.status === "connected"}
                    error={conn.status === "error"}
                    icon={Plug}
                    label={`${conn.provider_name || conn.integration_type}: ${conn.status}`}
                  />
                </span>
              ))}
            </div>
            {connections.length === 0 && uploadedFiles.length === 0 && (
              <Button
                variant="link"
                size="sm"
                className="px-0 mt-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/integrations");
                }}
              >
                Connect your first data source
                <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Regular drill-down sheet */}
      {drillDown && !drillDown.riskBreakdown && (
        <TransactionDetailSheet
          open={!!drillDown}
          onOpenChange={(open) => !open && setDrillDown(null)}
          title={drillDown.title}
          description={drillDown.description}
          transactions={drillDown.transactions}
          currency={currency}
          summary={drillDown.summary}
          statusOptions={drillDown.itemType === "bill" ? ["open", "pending", "paid", "overdue", "cancelled"] : ["draft", "sent", "paid", "overdue", "cancelled"]}
          onStatusChange={drillDown.itemType ? async (item, newStatus) => {
            const endpoint = drillDown.itemType === "invoice" ? `/invoices/${item.id}` : `/bills/${item.id}`;
            try {
              await flaskApi.patch(endpoint, { status: newStatus });
              // Update the item in the current drillDown state
              setDrillDown((prev) => prev ? {
                ...prev,
                transactions: prev.transactions.map((t) => t.id === item.id ? { ...t, status: newStatus } : t),
              } : null);
              queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
              queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["expense-bills"] });
              queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
              queryClient.invalidateQueries({ queryKey: ["cash-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["cash-bills"] });
              toast.success(`Status updated to ${newStatus}`);
            } catch (err: any) {
              toast.error(err.message || "Failed to update status");
            }
          } : undefined}
          onDelete={drillDown.itemType ? async (item) => {
            const endpoint = drillDown.itemType === "invoice" ? `/invoices/${item.id}` : `/bills/${item.id}`;
            try {
              await flaskApi.del(endpoint);
              setDrillDown((prev) => prev ? {
                ...prev,
                transactions: prev.transactions.filter((t) => t.id !== item.id),
              } : null);
              queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
              queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["expense-bills"] });
              queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
              queryClient.invalidateQueries({ queryKey: ["cash-invoices"] });
              queryClient.invalidateQueries({ queryKey: ["cash-bills"] });
              toast.success("Deleted successfully");
            } catch (err: any) {
              toast.error(err.message || "Failed to delete");
            }
          } : undefined}
        />
      )}

      {/* Basic Insight drill-down sheet */}
      {drillDown?.riskBreakdown && !drillDown.aiScore && (
        <Sheet open onOpenChange={() => setDrillDown(null)}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Gauge className="h-5 w-5" />
                {drillDown.title}
              </SheetTitle>
              <SheetDescription>{drillDown.description}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-3 gap-3">
                {drillDown.summary?.map((s) => (
                  <div key={s.label} className="text-center p-2.5 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Overall Score</span>
                  <span className={`font-bold ${riskColor}`}>{riskScore}/100</span>
                </div>
                <Progress value={riskScore} className="h-3" />
              </div>

              <Separator />

              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Risk Factor Breakdown
              </p>
              <div className="space-y-3">
                {drillDown.riskBreakdown.map((factor) => (
                  <div key={factor.name} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          factor.status === "good" ? "bg-green-500" :
                          factor.status === "warning" ? "bg-amber-500" : "bg-red-500"
                        }`} />
                        <span className="text-sm font-medium">{factor.name}</span>
                      </div>
                      <span className={`text-sm font-bold ${
                        factor.status === "good" ? "text-green-600" :
                        factor.status === "warning" ? "text-amber-600" : "text-red-600"
                      }`}>
                        {factor.score}/{factor.maxScore}
                      </span>
                    </div>
                    <Progress
                      value={factor.maxScore > 0 ? (factor.score / factor.maxScore) * 100 : 0}
                      className="h-1.5"
                    />
                    <p className="text-xs text-muted-foreground">{factor.detail}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Weight: {factor.weight}% of total score
                    </p>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="rounded-lg bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium">How to improve your score</p>
                <ul className="text-[10px] text-muted-foreground leading-relaxed list-disc list-inside space-y-1">
                  {riskScore < 100 && reconStats.matchRate < 90 && (
                    <li>Run reconciliation sessions to increase match rate above 90%</li>
                  )}
                  {totalOpen > 0 && (
                    <li>Resolve {totalOpen} open risk alert(s) — especially {bySeverity.critical} critical</li>
                  )}
                  {arExposure.overdueCount > 0 && (
                    <li>Follow up on {arExposure.overdueCount} overdue invoice(s) to improve AR health</li>
                  )}
                  {apExposure.overdueCount > 0 && (
                    <li>Address {apExposure.overdueCount} overdue bill(s) to improve AP health</li>
                  )}
                  {uploadedFiles.length === 0 && (
                    <li>Upload at least one bank statement to earn data freshness points</li>
                  )}
                  {riskScore >= 90 && (
                    <li>Your risk score is excellent! Continue regular reconciliations to maintain it.</li>
                  )}
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => { setDrillDown(null); navigate("/risk"); }}
              >
                Open Risk Monitor
                <ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* AI Insight drill-down sheet */}
      {drillDown?.aiScore && (
        <Sheet open onOpenChange={() => setDrillDown(null)}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                {drillDown.title}
              </SheetTitle>
              <SheetDescription>
                AI-powered analysis across {drillDown.aiScore.factors.length} risk dimensions
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 pt-4">
              {/* Score summary */}
              <div className="grid grid-cols-3 gap-3">
                {drillDown.summary?.map((s) => (
                  <div key={s.label} className="text-center p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                    <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Score bar */}
              {drillDown.aiScore.score != null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>AI Overall Score</span>
                    <span className={`font-bold ${aiRiskColor}`}>{drillDown.aiScore.score}/100</span>
                  </div>
                  <Progress value={drillDown.aiScore.score} className="h-3" />
                </div>
              )}

              {/* Executive Summary — same style as Risk Monitor */}
              <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase">AI Executive Summary</p>
                </div>
                <p className="text-sm leading-relaxed">{drillDown.aiScore.summary}</p>
              </div>

              {/* Compare with Basic */}
              {aiScore?.score != null && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Score Comparison</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-3 rounded-lg bg-background border">
                      <p className="text-[10px] text-muted-foreground uppercase mb-1">Basic Insight</p>
                      <p className={`text-2xl font-bold ${riskColor}`}>{riskScore}</p>
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${riskBadgeColor}`}>
                        {riskLevel}
                      </span>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-background border-2 border-purple-200 dark:border-purple-800">
                      <p className="text-[10px] text-purple-600 dark:text-purple-400 uppercase mb-1">AI Insight</p>
                      <p className={`text-2xl font-bold ${aiRiskColor}`}>{aiScore.score}</p>
                      <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${aiRiskBadgeColor}`}>
                        {aiScore.level}
                      </span>
                    </div>
                  </div>
                  {Math.abs((aiScore.score || 0) - riskScore) > 10 && (
                    <div className="p-2 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3 inline mr-1" />
                        {(aiScore.score || 0) > riskScore
                          ? `AI rates your health ${(aiScore.score || 0) - riskScore} points higher — AI sees additional positive signals beyond the rule-based engine.`
                          : `AI rates your health ${riskScore - (aiScore.score || 0)} points lower — AI detected additional risk factors not captured by basic rules.`
                        }
                      </p>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Dimension breakdown — elaborated like Risk Monitor */}
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                AI Risk Dimensions ({drillDown.aiScore.factors.length})
              </p>
              <div className="space-y-4">
                {drillDown.aiScore.factors.map((factor) => {
                  const severity = factor.score >= 80 ? "good" : factor.score >= 60 ? "moderate" : factor.score >= 40 ? "warning" : "critical";
                  const borderColor = severity === "good" ? "border-l-green-500" : severity === "moderate" ? "border-l-emerald-500" : severity === "warning" ? "border-l-amber-500" : "border-l-red-500";
                  const factorColor = severity === "good" ? "text-green-600" : severity === "moderate" ? "text-emerald-500" : severity === "warning" ? "text-amber-500" : "text-red-500";
                  const dotColor = severity === "good" ? "bg-green-500" : severity === "moderate" ? "bg-emerald-500" : severity === "warning" ? "bg-amber-500" : "bg-red-500";
                  const impactBorder = severity === "critical" ? "border-red-200 bg-red-50/50 dark:bg-red-900/10" : severity === "warning" ? "border-amber-200 bg-amber-50/50 dark:bg-amber-900/10" : severity === "moderate" ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10" : "border-green-200 bg-green-50/50 dark:bg-green-900/10";
                  const impactIcon = severity === "critical" ? "text-red-600" : severity === "warning" ? "text-amber-500" : severity === "moderate" ? "text-emerald-500" : "text-green-600";

                  return (
                    <div key={factor.name} className={`rounded-lg border border-l-4 ${borderColor} p-4 space-y-3`}>
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${dotColor}`} />
                          <span className="text-sm font-bold">{factor.name}</span>
                          <Badge variant="outline" className="text-[9px]">
                            {factor.weight}% weight
                          </Badge>
                        </div>
                        <span className={`text-lg font-bold ${factorColor}`}>
                          {factor.score}/100
                        </span>
                      </div>
                      <Progress value={factor.score} className="h-2" />

                      {/* Analysis — like Risk Monitor "Description" */}
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Analysis</p>
                        <p className="text-sm">{factor.finding}</p>
                      </div>

                      {/* Impact Assessment — severity-colored like Risk Monitor */}
                      <div className={`p-3 rounded-lg border-2 ${impactBorder}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className={`h-3.5 w-3.5 ${impactIcon}`} />
                          <p className="text-[10px] font-semibold uppercase">
                            {severity === "critical" ? "Critical Risk" : severity === "warning" ? "Needs Attention" : severity === "moderate" ? "Monitor Closely" : "Healthy"}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {factor.score < 40
                            ? "This dimension poses significant risk to your financial health and requires immediate action."
                            : factor.score < 60
                              ? "This dimension shows warning signs that could escalate if not addressed promptly."
                              : factor.score < 80
                                ? "This dimension is performing adequately but has room for improvement."
                                : "This dimension is performing well. Continue maintaining current practices."
                          }
                        </p>
                      </div>

                      {/* Recommended Actions — numbered like Risk Monitor */}
                      <div className="p-3 rounded-lg border-2 border-green-200 bg-green-50/50 dark:bg-green-900/10">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                          <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 uppercase">Recommended Actions</p>
                        </div>
                        <div className="space-y-1.5">
                          {factor.recommendation.split('. ').filter(Boolean).map((s, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[9px] font-bold text-green-700 dark:text-green-400">{i + 1}</span>
                              </div>
                              <p className="text-xs text-green-800 dark:text-green-300">{s.trim().replace(/\.$/, "")}.</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />

              <Button
                variant="outline"
                className="w-full text-xs"
                onClick={() => { setDrillDown(null); navigate("/risk"); }}
              >
                Open Risk Monitor for Full Analysis
                <ArrowRight className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </Layout>
  );
}

// ── Helper Components ─────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  text,
  cta,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  text: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="rounded-full bg-muted p-3 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground mb-1">{text}</p>
      <Button
        variant="link"
        size="sm"
        className="text-xs"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {cta}
        <ArrowRight className="h-3 w-3 ml-1" />
      </Button>
    </div>
  );
}

function StatusDot({
  active,
  error,
  icon: Icon,
  label,
}: {
  active: boolean;
  error?: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div
        className={`w-2 h-2 rounded-full shrink-0 ${
          error ? "bg-red-500" : active ? "bg-green-500" : "bg-gray-300"
        }`}
      />
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}
