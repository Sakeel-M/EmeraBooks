import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveClient } from "./useActiveClient";
import { useDateRange } from "./useDateRange";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { formatAmount } from "@/lib/utils";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { useState, useMemo, useCallback } from "react";
import { differenceInDays, parseISO, isAfter } from "date-fns";

export interface AIFactor {
  name: string;
  score: number;
  weight: number;
  finding: string;
  recommendation: string;
}

export interface AIScoreResult {
  score: number | null;
  level?: string;
  factors: AIFactor[];
  summary: string;
}

/**
 * Shared hook for AI Risk Score.
 * Both Control Center and Risk Monitor use this so results are identical.
 * The score is cached per client+dateRange and only refreshed on explicit request.
 */
export function useAIScore() {
  const { clientId, client, currency } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const queryClient = useQueryClient();

  // Underlying data queries
  const { data: transactions = [] } = useQuery({
    queryKey: ["ai-score-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 5000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["ai-score-invoices", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getInvoices(clientId!, opts);
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["ai-score-bills", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getBills(clientId!, opts);
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["ai-score-banks", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["ai-score-sessions", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const { data: riskAlerts = [] } = useQuery({
    queryKey: ["ai-score-alerts", clientId],
    queryFn: () => database.getRiskAlerts(clientId!, {}),
    enabled: !!clientId,
    staleTime: 60_000,
  });

  // Compute the summary payload for the AI endpoint
  const summaryPayload = useMemo(() => {
    if (!clientId || transactions.length === 0) return null;

    const expTxns = transactions.filter((t: any) => t.amount < 0);
    const incTxns = transactions.filter((t: any) => t.amount > 0);
    const totalExpenses = expTxns.reduce((s: number, t: any) => s + Math.abs(t.amount), 0);
    const totalIncome = incTxns.reduce((s: number, t: any) => s + t.amount, 0);

    const totalBalance = bankAccounts.reduce(
      (s: number, a: any) => s + (a.current_balance || 0), 0
    ) || (transactions.length > 0
      ? transactions.reduce((s: number, t: any) => s + (t.amount || 0), 0)
      : 0);

    // Monthly grouping
    const monthlyExp: Record<string, number> = {};
    const monthlyInc: Record<string, number> = {};
    expTxns.forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) monthlyExp[m] = (monthlyExp[m] || 0) + Math.abs(t.amount);
    });
    incTxns.forEach((t: any) => {
      const m = t.transaction_date?.slice(0, 7);
      if (m) monthlyInc[m] = (monthlyInc[m] || 0) + t.amount;
    });
    const months = Math.max(Object.keys(monthlyExp).length, 1);
    const avgBurn = totalExpenses / months;
    const avgIncome = totalIncome / months;
    const runway = avgBurn > 0 ? totalBalance / avgBurn : 999;

    // Category breakdown
    const catMap: Record<string, number> = {};
    expTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      catMap[cat] = (catMap[cat] || 0) + Math.abs(t.amount);
    });
    const sortedCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
    const topCats = sortedCats.slice(0, 5).map(([c]) => c);
    const topCatPct = totalExpenses > 0 && sortedCats.length > 0
      ? (sortedCats[0][1] / totalExpenses) * 100 : 0;

    // Spike detection
    const spikeCategories: string[] = [];
    const catMonthly: Record<string, Record<string, number>> = {};
    expTxns.forEach((t: any) => {
      const cat = getCanonicalCategory(t.category, t.description, t.description) || "Other";
      const m = t.transaction_date?.slice(0, 7) || "";
      if (!catMonthly[cat]) catMonthly[cat] = {};
      catMonthly[cat][m] = (catMonthly[cat][m] || 0) + Math.abs(t.amount);
    });
    Object.entries(catMonthly).forEach(([cat, monthData]) => {
      const vals = Object.values(monthData);
      if (vals.length < 2) return;
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
      const latest = vals[vals.length - 1];
      if (latest > avg * 1.5) spikeCategories.push(cat);
    });

    // Overdue
    const now = new Date();
    const overdueBills = bills.filter(
      (b: any) => b.status !== "paid" && b.status !== "cancelled" && b.due_date && isAfter(now, parseISO(b.due_date))
    );
    const overdueInvoices = invoices.filter(
      (i: any) => i.status !== "paid" && i.status !== "cancelled" && i.due_date && isAfter(now, parseISO(i.due_date))
    );
    const overdueBillsAmount = overdueBills.reduce((s: number, b: any) => s + (b.total || 0), 0);
    const overdueInvoicesAmount = overdueInvoices.reduce((s: number, i: any) => s + (i.total || 0), 0);

    // Reconciliation
    const totalMatched = sessions.reduce((s: number, x: any) => s + (x.match_count || 0), 0);
    const totalFlagged = sessions.reduce((s: number, x: any) => s + (x.flag_count || 0), 0);
    const totalRecon = totalMatched + totalFlagged;
    const matchRate = totalRecon > 0 ? (totalMatched / totalRecon) * 100 : 0;

    // Open alerts
    const openAlerts = riskAlerts.filter(
      (a: any) => a.status === "open" || a.status === "new"
    ).length;

    // Duplicate detection
    const amountMap = new Map<string, any[]>();
    expTxns.forEach((t: any) => {
      const key = Math.abs(t.amount).toFixed(2);
      if (!amountMap.has(key)) amountMap.set(key, []);
      amountMap.get(key)!.push(t);
    });
    let duplicateCount = 0;
    amountMap.forEach((group) => {
      if (group.length > 1) {
        for (let i = 0; i < group.length - 1; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const daysDiff = Math.abs(
              differenceInDays(
                new Date(group[i].transaction_date),
                new Date(group[j].transaction_date)
              )
            );
            if (daysDiff <= 3 && daysDiff > 0) duplicateCount++;
          }
        }
      }
    });

    return {
      currency,
      totalIncome,
      totalExpenses,
      netIncome: totalIncome - totalExpenses,
      cashBalance: totalBalance,
      runway: runway > 100 ? "100+" : runway.toFixed(1),
      avgMonthlyBurn: avgBurn,
      avgMonthlyIncome: avgIncome,
      overdueBillsCount: overdueBills.length,
      overdueBillsAmount,
      overdueInvoicesCount: overdueInvoices.length,
      overdueInvoicesAmount,
      duplicateCount,
      transactionCount: transactions.length,
      matchRate,
      openAlerts,
      topCategories: topCats,
      spikeCategories,
      topCategoryPct: topCatPct,
      industry: client?.industry || "Unknown",
    };
  }, [clientId, transactions, bills, invoices, bankAccounts, sessions, riskAlerts, currency, client]);

  // Cache key includes client + date range so different ranges get different scores
  const cacheKey = ["ai-risk-score", clientId, startDate || "all", endDate || "all"];

  // Manual trigger state — tracks loading across generate calls
  const [manualLoading, setManualLoading] = useState(false);

  // The cached AI score — only fetched when explicitly triggered via generate()
  const {
    data: aiScore,
    isFetching,
  } = useQuery<AIScoreResult>({
    queryKey: cacheKey,
    queryFn: async () => {
      if (!summaryPayload) throw new Error("No data");
      return flaskApi.post<AIScoreResult>("/risk/ai-score", { summary: summaryPayload });
    },
    enabled: false, // Never auto-fetch — only on explicit refetch
    staleTime: Infinity, // Once fetched, never goes stale automatically
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 1,
  });

  const generate = useCallback(async () => {
    if (!summaryPayload) return;
    setManualLoading(true);
    try {
      // Invalidate first so staleTime doesn't prevent re-fetch
      await queryClient.invalidateQueries({ queryKey: cacheKey });
      await queryClient.fetchQuery({
        queryKey: cacheKey,
        queryFn: () => flaskApi.post<AIScoreResult>("/risk/ai-score", { summary: summaryPayload }),
        staleTime: 0, // Force fresh fetch
      });
    } catch (e) {
      console.error("AI score generation failed:", e);
    } finally {
      setManualLoading(false);
    }
  }, [queryClient, cacheKey, summaryPayload]);

  const aiGenerating = isFetching || manualLoading;

  return {
    aiScore: aiScore ?? null,
    aiGenerating,
    generate,
    hasData: !!summaryPayload,
  };
}
