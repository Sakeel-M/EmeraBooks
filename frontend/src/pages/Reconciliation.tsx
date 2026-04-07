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
import { Checkbox } from "@/components/ui/checkbox";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import {
  GitCompareArrows,
  Plus,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowLeftRight,
  Loader2,
  Filter,
  Pencil,
  Trash2,
  Clock,
  Target,
  TrendingUp,
  FileWarning,
  BarChart3,
  ShieldCheck,
  Zap,
  CalendarRange,
  Search,
  Link,
  Unlink,
  Lock,
  DollarSign,
  Copy,
  CircleDot,
  ArrowUpRight,
  History,
  Eye,
  Info,
  Wand2,
  ChevronDown,
  HelpCircle,
  Sparkles,
  MonitorSmartphone,
  Users,
  Package,
  Layers,
  Upload,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  database,
  type ReconciliationSession,
  type ReconciliationItem,
  type MatchingRule,
} from "@/lib/database";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";

// ── Flag type config ──────────────────────────────────────────────────

const FLAG_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  matched: { label: "Matched", color: "text-green-600", bgColor: "bg-green-50 border-green-200", icon: CheckCircle2 },
  missing_bill: { label: "Missing Bill", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", icon: FileWarning },
  missing_invoice: { label: "Missing Invoice", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", icon: FileWarning },
  missing_in_bank: { label: "Not in Bank", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: XCircle },
  missing_in_source_b: { label: "No Ledger Match", color: "text-amber-600", bgColor: "bg-amber-50 border-amber-200", icon: FileWarning },
  missing_in_source_a: { label: "No Bank Match", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: XCircle },
  amount_mismatch: { label: "Amount Mismatch", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: DollarSign },
  date_mismatch: { label: "Date Mismatch", color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", icon: Clock },
  duplicate_suspect: { label: "Possible Duplicate", color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", icon: Copy },
  round_amount: { label: "Round Amount", color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", icon: CircleDot },
  large_transaction: { label: "Large Transaction", color: "text-red-600", bgColor: "bg-red-50 border-red-200", icon: ArrowUpRight },
  unmatched: { label: "Unmatched", color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200", icon: AlertTriangle },
  verified: { label: "Verified", color: "text-green-600", bgColor: "bg-green-50 border-green-200", icon: ShieldCheck },
};

function getFlagConfig(flagType: string | null) {
  return FLAG_CONFIG[flagType || "unmatched"] || FLAG_CONFIG.unmatched;
}

function getFlagExplanation(flagType: string | null, item?: ReconciliationItem | null): string {
  const desc = (item?.source_a_desc || item?.source_b_desc || "").toUpperCase();
  const reason = item?.reason || "";

  // Transaction-type-aware explanations
  const txnContext = (() => {
    if (desc.includes("MOBN") && desc.includes("TELEX"))
      return " This is a Mobile Banking Wire Transfer (MOBN TELEX) — typically an outgoing fund transfer to another account or beneficiary.";
    if (desc.includes("MOBN"))
      return " This is a Mobile Banking transfer — typically initiated via the bank's mobile app.";
    if (desc.includes("TELEX") || desc.includes("SWIFT"))
      return " This is a Wire/SWIFT transfer — international or high-value fund movement.";
    if (desc.includes("IBFT"))
      return " This is an Instant Bank Fund Transfer (IBFT) — real-time transfer between banks.";
    if (desc.includes("ATM") || desc.includes("CASH WITHDRAWAL"))
      return " This is an ATM cash withdrawal — no bill/invoice is expected. Consider excluding or categorizing as petty cash.";
    if (desc.includes("CCDM") || desc.includes("CASH DEPOSIT") || desc.includes("CDM"))
      return " This is a Cash/Cheque Deposit — income received in cash or cheque. Match to a customer receipt or invoice if applicable.";
    if (desc.includes("UPOS") || desc.includes("POS"))
      return " This is a Point of Sale purchase — typically a retail or service payment at a merchant terminal.";
    if (desc.includes("SALARY") || desc.includes("WPS"))
      return " This is a Salary/WPS payment — payroll disbursement. Should match a payroll entry in the ledger.";
    if (desc.includes("SALIK"))
      return " This is a SALIK road toll charge — recurring transportation expense.";
    if (desc.includes("DEWA"))
      return " This is a DEWA utility payment — electricity and water bill.";
    if (desc.includes("CHARGE") || desc.includes("FEE") || desc.includes("COMMISSION"))
      return " This is a bank charge/fee — typically no bill exists. Consider excluding or creating a bank fee expense entry.";
    if (desc.includes("INTEREST"))
      return " This is an interest credit/debit — bank-generated entry. Typically no matching bill/invoice.";
    if (desc.includes("REFUND") || desc.includes("REVERSAL"))
      return " This is a refund or reversal — should be matched against the original transaction.";
    if (desc.includes("STANDING ORDER") || desc.includes("S/O"))
      return " This is a standing order — recurring automatic payment. Should match a recurring bill.";
    if (desc.includes("RENT"))
      return " This is a rent payment — should match a rent bill or lease agreement.";
    if (desc.includes("LOAN") || desc.includes("EMI") || desc.includes("MORTGAGE"))
      return " This is a loan/EMI payment — should match the loan repayment schedule.";
    return "";
  })();

  switch (flagType) {
    case "matched": return "This bank transaction has been matched to a corresponding ledger record with matching amount and date." + (reason ? ` Match details: ${reason}` : "");
    case "missing_bill": return "This expense transaction has no corresponding bill in the system." + txnContext + " A bill should be created, or the transaction should be excluded with a note.";
    case "missing_invoice": return "This income transaction has no corresponding invoice in the system." + txnContext + " An invoice should be created, or the transaction should be excluded with a note.";
    case "missing_in_bank": return "This ledger record exists but has no matching bank transaction. It may not have been paid through the bank, or the payment may be outside this reconciliation period.";
    case "amount_mismatch": return "A potential match was found but the amounts differ significantly. Review both records and resolve the discrepancy — it may be a partial payment, VAT difference, or data entry error.";
    case "date_mismatch": return "A potential match was found but the dates differ by more than 7 days. This could indicate a timing difference between booking and clearing.";
    case "duplicate_suspect": return "Another transaction with the same amount was found on the same date." + txnContext + " Verify whether this is a legitimate duplicate payment or a data entry error.";
    case "round_amount": return "This round-number transaction may indicate an estimate, internal transfer, or deposit that needs verification." + txnContext;
    case "large_transaction": return "This transaction exceeds 10,000 and may require additional review or management approval per internal controls." + txnContext;
    case "verified": return "This transaction has been automatically verified during self-analysis.";
    default: return "This item could not be automatically matched. Review and resolve manually." + txnContext;
  }
}

// ── Bank Reconciliation Tab ──────────────────────────────────────────

function BankReconciliationTab() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const [showNewSession, setShowNewSession] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailItem, setDetailItem] = useState<ReconciliationItem | null>(null);
  const [activeTab, setActiveTab] = useState("workbench");
  const [summaryDrillDown, setSummaryDrillDown] = useState<string | null>(null); // "matched"|"flagged"|"rate"|"difference"

  // Filters
  const [descSearch, setDescSearch] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [flagTypeFilter, setFlagTypeFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Manual match
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [manualMatchSource, setManualMatchSource] = useState<ReconciliationItem | null>(null);
  const [manualMatchSearch, setManualMatchSearch] = useState("");

  // New session form
  const [newSourceA, setNewSourceA] = useState("Bank Statement");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [newEndingBalance, setNewEndingBalance] = useState("");

  const { data: sessions = [], isLoading: _sessLoad } = useQuery({
    queryKey: ["recon-sessions", clientId],
    queryFn: () => database.getReconciliationSessions(clientId!),
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  const { data: items = [] } = useQuery({
    queryKey: ["recon-items", selectedSessionId],
    queryFn: () => database.getReconciliationItems(selectedSessionId!),
    enabled: !!selectedSessionId,
  });

  const { data: matchingRules = [] } = useQuery({
    queryKey: ["matching-rules", clientId],
    queryFn: () => database.getMatchingRules(clientId!),
    enabled: !!clientId,
  });

  const _reconLoading = _sessLoad && sessions.length === 0;

  const matchedItems = useMemo(
    () => items.filter((i) => i.status === "matched" || i.status === "manual_match"),
    [items],
  );
  const flaggedItems = useMemo(
    () => items.filter((i) => i.status === "flagged"),
    [items],
  );
  const excludedItems = useMemo(
    () => items.filter((i) => i.status === "excluded"),
    [items],
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (statusFilter === "matched") result = matchedItems;
    else if (statusFilter === "flagged") result = flaggedItems;
    else if (statusFilter === "excluded") result = excludedItems;

    if (descSearch.trim()) {
      const q = descSearch.toLowerCase();
      result = result.filter(
        (i) =>
          (i.source_a_desc || "").toLowerCase().includes(q) ||
          (i.source_b_desc || "").toLowerCase().includes(q),
      );
    }

    const minAmt = amountMin ? parseFloat(amountMin) : null;
    const maxAmt = amountMax ? parseFloat(amountMax) : null;
    if (minAmt !== null || maxAmt !== null) {
      result = result.filter((i) => {
        const amt = Math.abs(i.source_a_amount ?? i.source_b_amount ?? 0);
        if (minAmt !== null && amt < minAmt) return false;
        if (maxAmt !== null && amt > maxAmt) return false;
        return true;
      });
    }

    if (flagTypeFilter !== "all") {
      result = result.filter((i) => i.flag_type === flagTypeFilter);
    }

    return result;
  }, [items, statusFilter, matchedItems, flaggedItems, excludedItems, descSearch, amountMin, amountMax, flagTypeFilter]);

  const flagTypes = useMemo(() => {
    const types = new Set<string>();
    items.forEach((i) => { if (i.flag_type) types.add(i.flag_type); });
    return Array.from(types);
  }, [items]);

  const unmatchedItems = useMemo(
    () => items.filter((i) => i.status === "flagged"),
    [items],
  );

  const canFinalize = selectedSession && flaggedItems.length === 0 && items.length > 0;

  // Donut chart
  const donutChartConfig: ChartConfig = {
    matched: { label: "Matched", color: "hsl(143 44% 28%)" },
    flagged: { label: "Flagged", color: "hsl(45 93% 47%)" },
    excluded: { label: "Excluded", color: "hsl(215 20% 65%)" },
  };

  const donutData = useMemo(() => {
    if (!selectedSession) {
      const totalMatched = sessions.reduce((s, x) => s + (x.match_count || 0), 0);
      const totalFlagged = sessions.reduce((s, x) => s + (x.flag_count || 0), 0);
      return [
        { name: "Matched", value: totalMatched || 0, fill: "hsl(143 44% 28%)" },
        { name: "Flagged", value: totalFlagged || 0, fill: "hsl(45 93% 47%)" },
      ];
    }
    return [
      { name: "Matched", value: matchedItems.length || 0, fill: "hsl(143 44% 28%)" },
      { name: "Flagged", value: flaggedItems.length || 0, fill: "hsl(45 93% 47%)" },
      { name: "Excluded", value: excludedItems.length || 0, fill: "hsl(215 20% 65%)" },
    ];
  }, [selectedSession, sessions, matchedItems, flaggedItems, excludedItems]);

  const currentMatchRate = selectedSession
    ? selectedSession.match_rate
    : sessions.length > 0
      ? sessions.reduce((s, x) => s + (x.match_count || 0), 0) /
        Math.max(1, sessions.reduce((s, x) => s + (x.match_count || 0) + (x.flag_count || 0), 0)) * 100
      : 0;

  const currentMatched = selectedSession
    ? matchedItems.length
    : sessions.reduce((s, x) => s + (x.match_count || 0), 0);

  const currentFlagged = selectedSession
    ? flaggedItems.length
    : sessions.reduce((s, x) => s + (x.flag_count || 0), 0);

  const handleCreateSession = async () => {
    if (!clientId || !newPeriodStart || !newPeriodEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsRunning(true);
    try {
      const session = await database.createReconciliationSession(clientId, {
        source_a: newSourceA,
        source_b: "Bills & Invoices",
        period_start: newPeriodStart,
        period_end: newPeriodEnd,
        statement_ending_balance: newEndingBalance
          ? parseFloat(newEndingBalance)
          : undefined,
      });

      // Fetch bank transactions
      const txns = await database.getTransactions(clientId, {
        startDate: newPeriodStart,
        endDate: newPeriodEnd,
      });

      if (txns.length === 0) {
        toast.warning("No transactions found in that date range. Upload a bank statement first.");
        setIsRunning(false);
        return;
      }

      const bankTxns = txns.map((t: any) => ({
        id: t.id,
        date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        category: t.category,
      }));

      // Fetch bills and invoices for the same period
      let bills: any[] = [];
      let invoices: any[] = [];
      try {
        bills = await database.getBills(clientId, {
          startDate: newPeriodStart,
          endDate: newPeriodEnd,
        });
      } catch { /* no bills */ }
      try {
        invoices = await database.getInvoices(clientId, {
          startDate: newPeriodStart,
          endDate: newPeriodEnd,
        });
      } catch { /* no invoices */ }

      // Format bills for the engine: positive amounts, vendor name
      const formattedBills = bills.map((b: any) => ({
        id: b.id,
        date: b.bill_date || b.due_date || b.created_at?.slice(0, 10),
        description: b.vendor_name || b.description || "",
        amount: Math.abs(b.total || b.amount || 0),
        vendor_name: b.vendor_name || b.vendors?.name || "",
        status: b.status,
      }));

      const formattedInvoices = invoices.map((inv: any) => ({
        id: inv.id,
        date: inv.invoice_date || inv.due_date || inv.created_at?.slice(0, 10),
        description: inv.customer_name || inv.description || "",
        amount: Math.abs(inv.total || inv.amount || 0),
        customer_name: inv.customer_name || inv.customers?.name || "",
        status: inv.status,
      }));

      // Get active matching rules sorted by priority
      const activeRules = matchingRules
        .filter((r: any) => r.is_active)
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0));

      // Call the reconciliation engine with bank-vs-bills/invoices
      const result = await api.reconcile({
        source_a_transactions: bankTxns,
        source_b_transactions: [],
        bills: formattedBills,
        invoices: formattedInvoices,
        rules: activeRules.length > 0 ? activeRules : undefined,
      } as any);

      // Map result items to reconciliation items
      const reconItems = [
        ...result.matched.map((m: any) => ({
          source_a_id: m.source_a_id || null,
          source_a_date: m.source_a_date || null,
          source_a_desc: m.source_a_desc || null,
          source_a_amount: m.source_a_amount ?? null,
          source_b_id: m.source_b_id || null,
          source_b_date: m.source_b_date || null,
          source_b_desc: m.source_b_desc || null,
          source_b_amount: m.source_b_amount ?? null,
          status: "matched",
          match_quality: m.match_quality || "exact",
          flag_type: "matched",
          difference: m.difference || 0,
          days_diff: m.days_diff || 0,
          resolution: null,
          reason: m.reason || null,
          txn_type: m.txn_type || null,
          txn_type_label: m.txn_type_label || null,
        })),
        ...result.flagged.map((f: any) => ({
          source_a_id: f.source_a_id || null,
          source_a_date: f.source_a_date || null,
          source_a_desc: f.source_a_desc || null,
          source_a_amount: f.source_a_amount ?? null,
          source_b_id: f.source_b_id || null,
          source_b_date: f.source_b_date || null,
          source_b_desc: f.source_b_desc || null,
          source_b_amount: f.source_b_amount ?? null,
          status: "flagged",
          match_quality: null,
          flag_type: f.flag_type || "unmatched",
          difference: f.difference || 0,
          days_diff: f.days_diff || 0,
          resolution: null,
          reason: f.reason || null,
          txn_type: f.txn_type || null,
          txn_type_label: f.txn_type_label || null,
        })),
      ];

      await database.saveReconciliationItems(clientId, session.id, reconItems);

      await database.updateReconciliationSession(session.id, {
        match_count: result.match_count,
        flag_count: result.flag_count,
        match_rate: result.match_rate,
        unreconciled_difference: result.total_discrepancy,
        status: "in_progress",
      } as any);

      setSelectedSessionId(session.id);
      setShowNewSession(false);
      setActiveTab("workbench");
      queryClient.invalidateQueries({ queryKey: ["recon-sessions", clientId] });
      toast.success(
        `Reconciliation complete: ${result.match_count} matched, ${result.flag_count} flagged`,
      );
    } catch (err: any) {
      toast.error(err.message || "Reconciliation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleResolveItem = async (
    itemId: string,
    action: "exclude" | "resolve",
    note: string,
  ) => {
    try {
      await database.updateReconciliationItem(itemId, {
        status: action === "exclude" ? "excluded" : "matched",
        resolution: note,
      });
      queryClient.invalidateQueries({
        queryKey: ["recon-items", selectedSessionId],
      });
      setDetailItem(null);
      toast.success(`Item ${action === "exclude" ? "excluded" : "resolved"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update item");
    }
  };

  const handleUnmatch = async (itemId: string) => {
    try {
      await database.updateReconciliationItem(itemId, {
        status: "flagged",
        match_quality: null,
        flag_type: "unmatched",
        resolution: null,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["recon-items", selectedSessionId] });
      toast.success("Item unmatched");
    } catch (err: any) {
      toast.error(err.message || "Failed to unmatch");
    }
  };

  const handleManualMatch = async (
    sourceItem: ReconciliationItem,
    targetItem: ReconciliationItem,
  ) => {
    try {
      await database.updateReconciliationItem(sourceItem.id, {
        status: "manual_match",
        match_quality: "manual",
        flag_type: null,
        source_b_id: targetItem.source_a_id || targetItem.source_b_id,
        source_b_desc: targetItem.source_a_desc || targetItem.source_b_desc,
        source_b_date: targetItem.source_a_date || targetItem.source_b_date,
        source_b_amount: targetItem.source_a_amount ?? targetItem.source_b_amount,
        resolution: "Manually matched",
      } as any);
      await database.updateReconciliationItem(targetItem.id, {
        status: "excluded",
        resolution: `Manually matched with item`,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["recon-items", selectedSessionId] });
      setShowManualMatch(false);
      setManualMatchSource(null);
      toast.success("Items manually matched");
    } catch (err: any) {
      toast.error(err.message || "Manual match failed");
    }
  };

  const handleFinalize = async () => {
    if (!selectedSessionId) return;
    try {
      const finalMatched = items.filter(
        (i) => i.status === "matched" || i.status === "manual_match",
      ).length;
      const finalFlagged = items.filter((i) => i.status === "flagged").length;
      const activeItems = finalMatched + finalFlagged;
      const finalRate = activeItems > 0 ? (finalMatched / activeItems) * 100 : 0;

      await database.updateReconciliationSession(selectedSessionId, {
        status: "finalized",
        match_count: finalMatched,
        flag_count: finalFlagged,
        match_rate: finalRate,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["recon-sessions", clientId] });
      toast.success("Session finalized successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to finalize");
    }
  };

  const handleBulkStatusChange = async (newStatus: "matched" | "excluded" | "flagged") => {
    if (selectedIds.size === 0) return;
    try {
      const updates = Array.from(selectedIds).map((id) =>
        database.updateReconciliationItem(id, {
          status: newStatus,
          ...(newStatus === "excluded" ? { resolution: "Bulk excluded" } : {}),
          ...(newStatus === "matched" ? { resolution: "Bulk resolved", flag_type: "matched" } : {}),
          ...(newStatus === "flagged" ? { match_quality: null, flag_type: "unmatched", resolution: null } : {}),
        } as any),
      );
      await Promise.all(updates);
      queryClient.invalidateQueries({ queryKey: ["recon-items", selectedSessionId] });
      setSelectedIds(new Set());
      toast.success(`${updates.length} item${updates.length !== 1 ? "s" : ""} updated to ${newStatus}`);
    } catch (err: any) {
      toast.error(err.message || "Bulk update failed");
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await database.deleteReconciliationSession(sessionId);
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["recon-sessions", clientId] });
      toast.success("Session deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete session");
    }
  };

  if (_reconLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading reconciliation...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards + Donut */}
      <div className="grid gap-4 md:grid-cols-5">
        {/* Match Rate Donut */}
        <Card className="md:col-span-2 stat-card-hover chart-enter">
          <CardContent className="p-5">
            {sessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="rounded-full bg-muted p-3 mb-3">
                  <GitCompareArrows className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground mb-1">No reconciliations yet</p>
                <p className="text-xs text-muted-foreground">
                  Create a session to start matching
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <ChartContainer
                  config={donutChartConfig}
                  className="h-[130px] w-[130px] shrink-0 !aspect-square"
                >
                  <PieChart>
                    <Pie
                      data={donutData.filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={58}
                      paddingAngle={3}
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {donutData
                        .filter((d) => d.value > 0)
                        .map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ChartContainer>
                <div className="flex-1 space-y-2">
                  <div>
                    <span className="text-3xl font-bold text-primary">
                      {currentMatchRate.toFixed(0)}%
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">
                      match rate
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full bg-[hsl(143_44%_28%)]" />
                      <span className="flex-1">Matched</span>
                      <span className="font-semibold">{currentMatched}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-2.5 h-2.5 rounded-full bg-[hsl(45_93%_47%)]" />
                      <span className="flex-1">Flagged</span>
                      <span className="font-semibold text-amber-600">{currentFlagged}</span>
                    </div>
                    {selectedSession && excludedItems.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2.5 h-2.5 rounded-full bg-[hsl(215_20%_65%)]" />
                        <span className="flex-1">Excluded</span>
                        <span className="font-semibold text-muted-foreground">{excludedItems.length}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <KPICard
          label="Sessions"
          value={sessions.length.toString()}
          icon={CalendarRange}
          sub={sessions.length > 0
            ? `Last: ${formatDistanceToNow(new Date(sessions[0]?.created_at), { addSuffix: true })}`
            : "No sessions"}
          color="text-primary"
        />
        <KPICard
          label="Open Flags"
          value={currentFlagged.toString()}
          icon={FileWarning}
          sub={
            currentFlagged === 0
              ? "All resolved"
              : `${currentFlagged} need attention`
          }
          color={currentFlagged === 0 ? "text-green-600" : "text-amber-500"}
        />
        <KPICard
          label="Discrepancy"
          value={
            selectedSession
              ? <FC amount={Math.abs(selectedSession.unreconciled_difference || 0)} currency={currency} />
              : <FC amount={sessions.reduce((s, x) => s + Math.abs(x.unreconciled_difference || 0), 0)} currency={currency} />
          }
          icon={TrendingUp}
          sub={
            (selectedSession?.unreconciled_difference || 0) === 0
              ? "Fully balanced"
              : "Outstanding"
          }
          color={
            (selectedSession?.unreconciled_difference || 0) === 0
              ? "text-green-600"
              : "text-red-500"
          }
        />
      </div>

      {/* Session Selector + New Session */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Select
              value={selectedSessionId || ""}
              onValueChange={(v) => {
                setSelectedSessionId(v);
                setActiveTab("workbench");
              }}
            >
              <SelectTrigger className="w-full sm:w-[320px]">
                <SelectValue placeholder="Select a reconciliation session" />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span>
                        {format(new Date(s.period_start), "MMM d")} --{" "}
                        {format(new Date(s.period_end), "MMM d, yyyy")}
                      </span>
                      <Badge
                        variant={s.status === "finalized" ? "default" : "secondary"}
                        className="text-[10px] h-4"
                      >
                        {s.status}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Dialog open={showNewSession} onOpenChange={setShowNewSession}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <GitCompareArrows className="h-5 w-5" />
                    New Reconciliation Session
                  </DialogTitle>
                  <DialogDescription>
                    Match bank transactions against bills and invoices for the selected period.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {bankAccounts.length > 0 && (
                    <div className="space-y-2">
                      <Label>Bank Account</Label>
                      <Select value={newSourceA} onValueChange={setNewSourceA}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Bank Statement">
                            All Bank Statements
                          </SelectItem>
                          {bankAccounts.map((acc: any) => (
                            <SelectItem key={acc.id} value={acc.account_name || acc.bank_name}>
                              {acc.account_name || acc.bank_name}
                              {acc.account_number ? ` (${acc.account_number.slice(-4)})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Period Start</Label>
                      <Input
                        type="date"
                        value={newPeriodStart}
                        onChange={(e) => setNewPeriodStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period End</Label>
                      <Input
                        type="date"
                        value={newPeriodEnd}
                        onChange={(e) => setNewPeriodEnd(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Statement Ending Balance (optional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newEndingBalance}
                      onChange={(e) => setNewEndingBalance(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                    The engine will match bank transactions against bills (expenses) and invoices (income).
                    Unmatched items will be flagged for review.
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreateSession}
                    disabled={isRunning || !newPeriodStart || !newPeriodEnd}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running Reconciliation...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4 mr-2" />
                        Start Reconciliation
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Tab switcher for session detail vs history */}
            {sessions.length > 0 && (
              <div className="flex gap-1 ml-auto">
                <Button
                  variant={activeTab === "workbench" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => setActiveTab("workbench")}
                >
                  <Eye className="h-3 w-3" />
                  Workbench
                </Button>
                <Button
                  variant={activeTab === "history" ? "default" : "ghost"}
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => setActiveTab("history")}
                >
                  <History className="h-3 w-3" />
                  History
                </Button>
              </div>
            )}

            {selectedSession && activeTab === "workbench" && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Progress
                    value={selectedSession.match_rate}
                    className="w-24 h-2"
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedSession.match_rate.toFixed(0)}%
                  </span>
                </div>
                <Badge
                  variant={
                    selectedSession.status === "finalized"
                      ? "default"
                      : selectedSession.status === "in_progress"
                        ? "secondary"
                        : "outline"
                  }
                  className="text-xs"
                >
                  {selectedSession.status.replace("_", " ")}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* History Tab */}
      {activeTab === "history" && (
        <SessionHistory
          sessions={sessions}
          currency={currency}
          onSelect={(id) => {
            setSelectedSessionId(id);
            setActiveTab("workbench");
          }}
          onDelete={handleDeleteSession}
        />
      )}

      {/* Workbench Tab */}
      {activeTab === "workbench" && (
        <>
          {/* Session Summary Bar */}
          {selectedSession && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MiniStat
                icon={CheckCircle2}
                iconColor="text-green-500"
                label="Matched"
                value={matchedItems.length.toString()}
                onClick={() => setSummaryDrillDown("matched")}
              />
              <MiniStat
                icon={AlertTriangle}
                iconColor="text-amber-500"
                label="Flagged"
                value={flaggedItems.length.toString()}
                onClick={() => setSummaryDrillDown("flagged")}
              />
              <MiniStat
                icon={Target}
                iconColor="text-primary"
                label="Match Rate"
                value={`${((matchedItems.length + flaggedItems.length) > 0 ? (matchedItems.length / (matchedItems.length + flaggedItems.length) * 100) : 0).toFixed(1)}%`}
                onClick={() => setSummaryDrillDown("rate")}
              />
              <MiniStat
                icon={selectedSession.unreconciled_difference === 0 ? ShieldCheck : XCircle}
                iconColor={selectedSession.unreconciled_difference === 0 ? "text-green-500" : "text-red-500"}
                label="Difference"
                value={<FC amount={selectedSession.unreconciled_difference} currency={currency} />}
                onClick={() => setSummaryDrillDown("difference")}
              />
              {selectedSession.status !== "finalized" && (
                <div className="flex items-center">
                  <Button
                    size="sm"
                    className="gap-2"
                    disabled={!canFinalize}
                    onClick={handleFinalize}
                  >
                    <Lock className="h-4 w-4" />
                    Finalize Session
                  </Button>
                  {!canFinalize && flaggedItems.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      Resolve {flaggedItems.length} flag{flaggedItems.length !== 1 && "s"} first
                    </span>
                  )}
                </div>
              )}
              {selectedSession.status === "finalized" && (
                <Badge className="bg-green-100 text-green-700 border-green-200 h-8 px-3">
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Finalized
                </Badge>
              )}
            </div>
          )}

          {/* Workbench content */}
          {selectedSession ? (
            <div className="space-y-4">
              {/* Filters */}
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <div className="flex gap-1">
                      {[
                        { value: "all", label: "All", count: items.length },
                        { value: "matched", label: "Matched", count: matchedItems.length },
                        { value: "flagged", label: "Flagged", count: flaggedItems.length },
                        { value: "excluded", label: "Excluded", count: excludedItems.length },
                      ].map((f) => (
                        <Button
                          key={f.value}
                          variant={statusFilter === f.value ? "default" : "ghost"}
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => setStatusFilter(f.value)}
                        >
                          {f.label}
                          {f.count > 0 && (
                            <Badge
                              variant={statusFilter === f.value ? "secondary" : "outline"}
                              className="text-[10px] h-4 px-1"
                            >
                              {f.count}
                            </Badge>
                          )}
                        </Button>
                      ))}
                    </div>
                    <Button
                      variant={showAdvancedFilters ? "secondary" : "ghost"}
                      size="sm"
                      className="text-xs h-7 gap-1 ml-auto"
                      onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    >
                      <Search className="h-3 w-3" />
                      Filters
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {filteredItems.length} item{filteredItems.length !== 1 && "s"}
                    </span>
                  </div>
                  {showAdvancedFilters && (
                    <div className="flex items-center gap-2 flex-wrap pt-1 border-t">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search description..."
                          value={descSearch}
                          onChange={(e) => setDescSearch(e.target.value)}
                          className="h-8 text-xs pl-7"
                        />
                      </div>
                      <Input
                        type="number"
                        placeholder="Min amount"
                        value={amountMin}
                        onChange={(e) => setAmountMin(e.target.value)}
                        className="h-8 text-xs w-[110px]"
                      />
                      <Input
                        type="number"
                        placeholder="Max amount"
                        value={amountMax}
                        onChange={(e) => setAmountMax(e.target.value)}
                        className="h-8 text-xs w-[110px]"
                      />
                      {flagTypes.length > 0 && (
                        <Select value={flagTypeFilter} onValueChange={setFlagTypeFilter}>
                          <SelectTrigger className="h-8 text-xs w-[160px]">
                            <SelectValue placeholder="Flag type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All flag types</SelectItem>
                            {flagTypes.map((ft) => (
                              <SelectItem key={ft} value={ft}>
                                {getFlagConfig(ft).label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {(descSearch || amountMin || amountMax || flagTypeFilter !== "all") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8"
                          onClick={() => {
                            setDescSearch("");
                            setAmountMin("");
                            setAmountMax("");
                            setFlagTypeFilter("all");
                          }}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bulk actions bar */}
              {selectedSession?.status !== "finalized" && filteredItems.length > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 bg-muted/40 rounded-lg border">
                  <Checkbox
                    checked={selectedIds.size > 0 && selectedIds.size === filteredItems.length}
                    onCheckedChange={toggleSelectAll}
                    className="h-4 w-4"
                  />
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.size > 0
                      ? `${selectedIds.size} selected`
                      : "Select all"}
                  </span>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-1.5 ml-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => handleBulkStatusChange("matched")}
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Resolve
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-amber-600 border-amber-200 hover:bg-amber-50"
                        onClick={() => handleBulkStatusChange("flagged")}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Flag
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 text-muted-foreground"
                        onClick={() => handleBulkStatusChange("excluded")}
                      >
                        <XCircle className="h-3 w-3" />
                        Exclude
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Items list */}
              <div className="space-y-1.5">
                {filteredItems.length === 0 && (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center">
                      <div className="rounded-full bg-muted p-3 mx-auto w-fit mb-3">
                        <Filter className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No items found for this filter.
                      </p>
                    </CardContent>
                  </Card>
                )}
                {filteredItems.map((item) => {
                  const flagConf = getFlagConfig(item.flag_type);
                  const FlagIcon = flagConf.icon;
                  return (
                    <Card
                      key={item.id}
                      className={`stat-card-hover cursor-pointer transition-all ${
                        selectedIds.has(item.id)
                          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                          : item.status === "flagged"
                            ? "border-amber-300/50 hover:border-amber-400"
                            : item.status === "excluded"
                              ? "opacity-60"
                              : "hover:border-primary/30"
                      }`}
                      onClick={() => setDetailItem(item)}
                    >
                      <CardContent className="py-3 px-4">
                        <div className="flex items-center gap-4">
                          {/* Checkbox */}
                          {selectedSession?.status !== "finalized" && (
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => toggleSelectItem(item.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 flex-shrink-0"
                            />
                          )}
                          {/* Status icon */}
                          <div className="flex-shrink-0">
                            {item.status === "matched" || item.status === "manual_match" ? (
                              <div className="rounded-full bg-green-50 p-1.5">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              </div>
                            ) : item.status === "flagged" ? (
                              <div className={`rounded-full p-1.5 ${flagConf.bgColor}`}>
                                <FlagIcon className={`h-4 w-4 ${flagConf.color}`} />
                              </div>
                            ) : (
                              <div className="rounded-full bg-muted p-1.5">
                                <XCircle className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Source A (Bank) */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              Bank
                            </p>
                            <p className="text-sm font-medium truncate">
                              {item.source_a_desc || (item.source_a_id ? "Transaction" : "--")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.source_a_date
                                ? format(new Date(item.source_a_date), "MMM d, yyyy")
                                : "--"}
                              {item.source_a_amount != null &&
                                ` | ${formatAmount(item.source_a_amount, currency)}`}
                            </p>
                          </div>

                          <ArrowLeftRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />

                          {/* Source B (Bill/Invoice) */}
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                              {item.source_b_amount != null && item.source_b_amount < 0
                                ? "Bill"
                                : item.source_b_amount != null && item.source_b_amount > 0
                                  ? "Invoice"
                                  : item.status === "flagged" && item.source_b_id
                                    ? "Near Match"
                                    : "Ledger"}
                            </p>
                            <p className="text-sm font-medium truncate">
                              {item.source_b_desc || (item.source_b_id ? "Record" : item.txn_type_label || "--")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.source_b_date
                                ? format(new Date(item.source_b_date), "MMM d, yyyy")
                                : "--"}
                              {item.source_b_amount != null &&
                                ` | ${formatAmount(item.source_b_amount, currency)}`}
                            </p>
                          </div>

                          {/* Badges + Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.flag_type && item.flag_type !== "matched" && (
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${flagConf.color} ${flagConf.bgColor}`}
                              >
                                {flagConf.label}
                              </Badge>
                            )}
                            {item.match_quality && (
                              <Badge
                                variant={item.match_quality === "exact" ? "default" : "secondary"}
                                className="text-[10px]"
                              >
                                {item.match_quality}
                              </Badge>
                            )}
                            {item.difference !== 0 && item.status === "matched" && (
                              <span className="text-xs font-medium text-red-500">
                                <FC amount={item.difference} currency={currency} />
                              </span>
                            )}
                            {item.status === "flagged" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 px-2"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManualMatchSource(item);
                                  setManualMatchSearch("");
                                  setShowManualMatch(true);
                                }}
                              >
                                <Link className="h-3 w-3" />
                                Match
                              </Button>
                            )}
                            {(item.status === "matched" || item.status === "manual_match") &&
                              selectedSession?.status !== "finalized" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] gap-1 px-2 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnmatch(item.id);
                                }}
                              >
                                <Unlink className="h-3 w-3" />
                                Unmatch
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <GitCompareArrows className="h-10 w-10 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {sessions.length === 0
                    ? "Start Your First Reconciliation"
                    : "Select a Session"}
                </h3>
                <p className="text-muted-foreground max-w-md mb-4 text-sm">
                  {sessions.length === 0
                    ? "Upload a bank statement and create a reconciliation session to match transactions against bills and invoices automatically."
                    : "Select an existing session from the dropdown above or create a new one."}
                </p>
                {sessions.length === 0 && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setShowNewSession(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Create First Session
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Manual Match Dialog */}
      <Dialog open={showManualMatch} onOpenChange={setShowManualMatch}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              Manual Match
            </DialogTitle>
            <DialogDescription>
              Select an item to match with the selected transaction.
            </DialogDescription>
          </DialogHeader>
          {manualMatchSource && (
            <div className="space-y-4 py-2">
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-2.5 px-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                    Selected Item
                  </p>
                  <p className="text-sm font-medium truncate">
                    {manualMatchSource.source_a_desc || manualMatchSource.source_b_desc || "--"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {manualMatchSource.source_a_date || manualMatchSource.source_b_date || "--"}
                    {(manualMatchSource.source_a_amount ?? manualMatchSource.source_b_amount) != null &&
                      ` | ${formatAmount(manualMatchSource.source_a_amount ?? manualMatchSource.source_b_amount ?? 0, currency)}`}
                  </p>
                </CardContent>
              </Card>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search by amount, date, or description..."
                  value={manualMatchSearch}
                  onChange={(e) => setManualMatchSearch(e.target.value)}
                  className="pl-8 text-sm"
                />
              </div>

              <div className="max-h-[280px] overflow-y-auto space-y-1.5">
                {unmatchedItems
                  .filter((c) => c.id !== manualMatchSource.id)
                  .filter((c) => {
                    if (!manualMatchSearch.trim()) return true;
                    const q = manualMatchSearch.toLowerCase();
                    return (
                      (c.source_a_desc || "").toLowerCase().includes(q) ||
                      (c.source_b_desc || "").toLowerCase().includes(q) ||
                      (c.source_a_date || "").includes(q) ||
                      String(c.source_a_amount || "").includes(q) ||
                      String(c.source_b_amount || "").includes(q)
                    );
                  })
                  .map((candidate) => (
                    <Card
                      key={candidate.id}
                      className="stat-card-hover cursor-pointer"
                      onClick={() => handleManualMatch(manualMatchSource, candidate)}
                    >
                      <CardContent className="py-2.5 px-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {candidate.source_a_desc || candidate.source_b_desc || "--"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {candidate.source_a_date || candidate.source_b_date || "--"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">
                          <FC amount={candidate.source_a_amount ?? candidate.source_b_amount ?? 0} currency={currency} />
                        </span>
                        <Link className="h-4 w-4 text-primary shrink-0" />
                      </CardContent>
                    </Card>
                  ))}
                {unmatchedItems.filter((c) => c.id !== manualMatchSource.id).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No unmatched items available to match.
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Item Detail Sheet -- works for ALL items (matched, flagged, excluded) */}
      <Sheet
        open={!!detailItem}
        onOpenChange={() => setDetailItem(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {detailItem && (() => {
                const conf = getFlagConfig(detailItem.flag_type);
                const Icon = conf.icon;
                return (
                  <>
                    <Icon className={`h-5 w-5 ${conf.color}`} />
                    {detailItem.status === "matched" || detailItem.status === "manual_match"
                      ? "Matched Item"
                      : detailItem.status === "excluded"
                        ? "Excluded Item"
                        : "Flagged Item"}
                  </>
                );
              })()}
            </SheetTitle>
            <SheetDescription>
              {detailItem?.status === "flagged"
                ? "Review and resolve this flagged item."
                : detailItem?.status === "matched" || detailItem?.status === "manual_match"
                  ? "Details of the matched transaction pair."
                  : "This item has been excluded from reconciliation."}
            </SheetDescription>
          </SheetHeader>
          {detailItem && (
            <ItemDetail
              item={detailItem}
              currency={currency}
              sessionStatus={selectedSession?.status || ""}
              onResolve={handleResolveItem}
              onUnmatch={handleUnmatch}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Summary Drill-Down Sheet */}
      <Sheet open={!!summaryDrillDown} onOpenChange={() => setSummaryDrillDown(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {summaryDrillDown === "matched" && <><CheckCircle2 className="h-5 w-5 text-green-500" /> Matched Items</>}
              {summaryDrillDown === "flagged" && <><AlertTriangle className="h-5 w-5 text-amber-500" /> Flagged Items</>}
              {summaryDrillDown === "rate" && <><Target className="h-5 w-5 text-primary" /> Match Rate Breakdown</>}
              {summaryDrillDown === "difference" && <><DollarSign className="h-5 w-5 text-red-500" /> Discrepancy Details</>}
            </SheetTitle>
            <SheetDescription>
              {summaryDrillDown === "matched" && `${matchedItems.length} transactions matched to ledger records.`}
              {summaryDrillDown === "flagged" && `${flaggedItems.length} items need review.`}
              {summaryDrillDown === "rate" && `Overall reconciliation accuracy for this session.`}
              {summaryDrillDown === "difference" && `Breakdown of reconciliation discrepancies.`}
            </SheetDescription>
          </SheetHeader>
          {selectedSession && (
            <div className="space-y-4 pt-4">
              {/* ── Matched drill-down ── */}
              {summaryDrillDown === "matched" && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-2.5 rounded-lg bg-green-50 border border-green-200">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Matched</p>
                      <p className="text-lg font-bold text-green-700">{matchedItems.length}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Exact</p>
                      <p className="text-lg font-bold">{matchedItems.filter(i => i.match_quality === "exact").length}</p>
                    </div>
                    <div className="text-center p-2.5 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Near</p>
                      <p className="text-lg font-bold">{matchedItems.filter(i => i.match_quality === "near").length}</p>
                    </div>
                  </div>
                  {(() => {
                    const totalMatchedAmt = matchedItems.reduce((s, i) => s + Math.abs(i.source_a_amount ?? 0), 0);
                    const totalDiff = matchedItems.reduce((s, i) => s + Math.abs(i.difference), 0);
                    const avgDaysDiff = matchedItems.length > 0
                      ? (matchedItems.reduce((s, i) => s + (i.days_diff || 0), 0) / matchedItems.length).toFixed(1)
                      : "0";
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="text-center p-2.5 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</p>
                          <p className="text-sm font-semibold"><FC amount={totalMatchedAmt} currency={currency} /></p>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cumulative Diff</p>
                          <p className={`text-sm font-semibold ${totalDiff === 0 ? "text-green-600" : "text-amber-600"}`}>
                            <FC amount={totalDiff} currency={currency} />
                          </p>
                        </div>
                        <div className="text-center p-2.5 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Date Diff</p>
                          <p className="text-sm font-semibold">{avgDaysDiff} days</p>
                        </div>
                      </div>
                    );
                  })()}
                  <Separator />
                  <p className="text-xs text-muted-foreground font-medium">Recent Matches</p>
                  <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                    {matchedItems.slice(0, 50).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => { setSummaryDrillDown(null); setDetailItem(item); }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{item.source_a_desc || "Transaction"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.source_a_date ? format(new Date(item.source_a_date), "MMM d") : ""} ←→ {item.source_b_desc || "Record"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-semibold"><FC amount={item.source_a_amount ?? 0} currency={currency} /></p>
                          <Badge variant={item.match_quality === "exact" ? "default" : "secondary"} className="text-[9px] h-3.5">
                            {item.match_quality}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {matchedItems.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing 50 of {matchedItems.length} matched items
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* ── Flagged drill-down ── */}
              {summaryDrillDown === "flagged" && (
                <>
                  {(() => {
                    const byType: Record<string, ReconciliationItem[]> = {};
                    flaggedItems.forEach(i => {
                      const t = i.flag_type || "unmatched";
                      (byType[t] = byType[t] || []).push(i);
                    });
                    const totalFlaggedAmt = flaggedItems.reduce((s, i) => s + Math.abs(i.source_a_amount ?? i.source_b_amount ?? 0), 0);
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2.5 rounded-lg bg-amber-50 border border-amber-200">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Flagged</p>
                            <p className="text-lg font-bold text-amber-700">{flaggedItems.length}</p>
                          </div>
                          <div className="text-center p-2.5 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Amount</p>
                            <p className="text-sm font-semibold"><FC amount={totalFlaggedAmt} currency={currency} /></p>
                          </div>
                        </div>
                        <Separator />
                        <p className="text-xs text-muted-foreground font-medium">Breakdown by Flag Type</p>
                        <div className="space-y-2">
                          {Object.entries(byType).map(([type, typeItems]) => {
                            const conf = getFlagConfig(type);
                            const FIcon = conf.icon;
                            const typeAmt = typeItems.reduce((s, i) => s + Math.abs(i.source_a_amount ?? i.source_b_amount ?? 0), 0);
                            return (
                              <div key={type} className={`rounded-lg border p-3 ${conf.bgColor}`}>
                                <div className="flex items-center gap-2 mb-2">
                                  <FIcon className={`h-4 w-4 ${conf.color}`} />
                                  <span className={`text-sm font-medium ${conf.color}`}>{conf.label}</span>
                                  <Badge variant="outline" className="ml-auto text-[10px]">{typeItems.length}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mb-2">
                                  {getFlagExplanation(type)}
                                </p>
                                <p className="text-xs font-medium">
                                  Total: <FC amount={typeAmt} currency={currency} />
                                </p>
                                <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                                  {typeItems.slice(0, 10).map(item => (
                                    <div
                                      key={item.id}
                                      className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-white/50 cursor-pointer"
                                      onClick={() => { setSummaryDrillDown(null); setDetailItem(item); }}
                                    >
                                      <span className="flex-1 truncate">{item.source_a_desc || item.source_b_desc || "—"}</span>
                                      <span className="font-medium shrink-0">
                                        <FC amount={item.source_a_amount ?? item.source_b_amount ?? 0} currency={currency} />
                                      </span>
                                    </div>
                                  ))}
                                  {typeItems.length > 10 && (
                                    <p className="text-[10px] text-muted-foreground text-center">+{typeItems.length - 10} more</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* ── Match Rate drill-down ── */}
              {summaryDrillDown === "rate" && (
                <>
                  {(() => {
                    const total = items.length;
                    const matched = matchedItems.length;
                    const flagged = flaggedItems.length;
                    const excluded = excludedItems.length;
                    const rate = total > 0 ? (matched / total * 100) : 0;
                    const exactCount = matchedItems.filter(i => i.match_quality === "exact").length;
                    const nearCount = matchedItems.filter(i => i.match_quality === "near").length;
                    const manualCount = matchedItems.filter(i => i.match_quality === "manual").length;
                    return (
                      <>
                        <div className="text-center p-4 rounded-lg bg-primary/5 border border-primary/20">
                          <p className="text-4xl font-bold text-primary">{rate.toFixed(1)}%</p>
                          <p className="text-sm text-muted-foreground mt-1">Overall Match Rate</p>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                            <p className="text-sm font-bold">{total}</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-green-50">
                            <p className="text-[10px] text-muted-foreground uppercase">Matched</p>
                            <p className="text-sm font-bold text-green-700">{matched}</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-amber-50">
                            <p className="text-[10px] text-muted-foreground uppercase">Flagged</p>
                            <p className="text-sm font-bold text-amber-700">{flagged}</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Excluded</p>
                            <p className="text-sm font-bold text-muted-foreground">{excluded}</p>
                          </div>
                        </div>
                        <Separator />
                        <p className="text-xs text-muted-foreground font-medium">Match Quality Breakdown</p>
                        <div className="space-y-2">
                          {[
                            { label: "Exact Match", desc: "Amount and date match perfectly", count: exactCount, color: "bg-green-500" },
                            { label: "Near Match", desc: "Amount matches, date within tolerance", count: nearCount, color: "bg-blue-500" },
                            { label: "Manual Match", desc: "Manually matched by user", count: manualCount, color: "bg-purple-500" },
                          ].filter(q => q.count > 0).map(q => (
                            <div key={q.label} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                              <div className={`w-3 h-3 rounded-full ${q.color} shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium">{q.label}</p>
                                <p className="text-[10px] text-muted-foreground">{q.desc}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold">{q.count}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {matched > 0 ? (q.count / matched * 100).toFixed(0) : 0}%
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <Separator />
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                          <p className="text-xs font-medium">How is the match rate calculated?</p>
                          <p className="text-[10px] text-muted-foreground leading-relaxed">
                            Match Rate = Matched Items / Total Items x 100.
                            The engine first matches expense transactions (negative amounts) against bills by amount, date, and vendor name.
                            Then income transactions (positive amounts) are matched against invoices.
                            Unmatched items are flagged for manual review.
                            Excluded items are counted in the total but not as matched.
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {/* ── Difference drill-down ── */}
              {summaryDrillDown === "difference" && (
                <>
                  {(() => {
                    const matchedDiffs = matchedItems.filter(i => i.difference !== 0);
                    const totalMatchedDiff = matchedDiffs.reduce((s, i) => s + Math.abs(i.difference), 0);
                    const flaggedTotal = flaggedItems.reduce((s, i) => s + Math.abs(i.difference || 0), 0);
                    const overallDisc = selectedSession.unreconciled_difference || 0;
                    return (
                      <>
                        <div className="text-center p-4 rounded-lg border" style={{
                          backgroundColor: overallDisc === 0 ? "rgb(240 253 244)" : "rgb(254 242 242)",
                          borderColor: overallDisc === 0 ? "rgb(187 247 208)" : "rgb(254 202 202)",
                        }}>
                          <p className={`text-3xl font-bold ${overallDisc === 0 ? "text-green-700" : "text-red-600"}`}>
                            <FC amount={Math.abs(overallDisc)} currency={currency} />
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {overallDisc === 0 ? "Fully Balanced" : "Total Discrepancy"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-2.5 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Matched Diffs</p>
                            <p className="text-sm font-semibold"><FC amount={totalMatchedDiff} currency={currency} /></p>
                            <p className="text-[10px] text-muted-foreground">{matchedDiffs.length} items with diff</p>
                          </div>
                          <div className="text-center p-2.5 rounded-lg bg-muted/50">
                            <p className="text-[10px] text-muted-foreground uppercase">Flagged Amount</p>
                            <p className="text-sm font-semibold text-amber-600"><FC amount={flaggedTotal} currency={currency} /></p>
                            <p className="text-[10px] text-muted-foreground">{flaggedItems.length} unreconciled</p>
                          </div>
                        </div>
                        {matchedDiffs.length > 0 && (
                          <>
                            <Separator />
                            <p className="text-xs text-muted-foreground font-medium">Matched Items with Differences</p>
                            <div className="space-y-1.5 max-h-[30vh] overflow-y-auto">
                              {matchedDiffs.map(item => (
                                <div
                                  key={item.id}
                                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                                  onClick={() => { setSummaryDrillDown(null); setDetailItem(item); }}
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium truncate">{item.source_a_desc || "Transaction"}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      Bank: <FC amount={item.source_a_amount ?? 0} currency={currency} /> vs Ledger: <FC amount={item.source_b_amount ?? 0} currency={currency} />
                                    </p>
                                  </div>
                                  <span className="text-xs font-bold text-red-500 shrink-0">
                                    <FC amount={item.difference} currency={currency} />
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                        <Separator />
                        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                          <p className="text-xs font-medium">What causes discrepancies?</p>
                          <ul className="text-[10px] text-muted-foreground leading-relaxed list-disc list-inside space-y-0.5">
                            <li>Rounding differences (e.g., VAT calculations)</li>
                            <li>Bank fees or charges applied after billing</li>
                            <li>Partial payments or overpayments</li>
                            <li>Timing differences between booking and clearing</li>
                            <li>Unrecorded transactions (missing bills/invoices)</li>
                          </ul>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ── Item Detail Panel ────────────────────────────────────────────────────

function ItemDetail({
  item,
  currency,
  sessionStatus,
  onResolve,
  onUnmatch,
}: {
  item: ReconciliationItem;
  currency: string;
  sessionStatus: string;
  onResolve: (id: string, action: "exclude" | "resolve", note: string) => void;
  onUnmatch: (id: string) => void;
}) {
  const [note, setNote] = useState(item.resolution || "");
  const flagConf = getFlagConfig(item.flag_type);

  return (
    <div className="space-y-5 pt-5">
      {/* Flag type + explanation */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={`${flagConf.color} ${flagConf.bgColor}`}
          >
            {flagConf.label}
          </Badge>
          {item.match_quality && (
            <Badge variant={item.match_quality === "exact" ? "default" : "secondary"}>
              {item.match_quality} match
            </Badge>
          )}
          {item.txn_type_label && (
            <Badge variant="outline" className="text-slate-600 border-slate-200 bg-slate-50">
              {item.txn_type_label}
            </Badge>
          )}
          {item.resolution && (
            <Badge variant="outline" className="text-green-600 border-green-200">
              Resolved
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {getFlagExplanation(item.flag_type, item)}
        </p>
      </div>

      {/* Engine Reasoning (from backend) */}
      {item.reason && (
        <Card className="border-slate-200/60 bg-slate-50/50">
          <CardHeader className="pb-1.5 pt-2.5 px-3">
            <CardTitle className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Matching Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-2.5">
            <div className="space-y-1">
              {(item.reason as string).split(" | ").map((line: string, idx: number) => {
                const isPositive = line.includes("exact match") || line.includes("same day") || line.includes("found in description");
                const isNegative = line.includes("too large") || line.includes("too far") || line.includes("no match") || line.includes("No potential");
                return (
                  <p key={idx} className={`text-xs leading-relaxed ${
                    isPositive ? "text-green-700" : isNegative ? "text-red-600" : "text-muted-foreground"
                  }`}>
                    {isPositive ? "+" : isNegative ? "-" : ">"} {line}
                  </p>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source A: Bank Transaction */}
      <Card className={item.source_a_id ? "border-green-200/60" : "border-dashed"}>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            Bank Transaction
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {item.source_a_id ? (
            <>
              <p className="text-sm font-medium leading-snug">{item.source_a_desc || "No description"}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.source_a_date
                    ? format(new Date(item.source_a_date), "MMM d, yyyy")
                    : "--"}
                </span>
                {item.txn_type_label && (
                  <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                    {item.txn_type_label}
                  </span>
                )}
              </div>
              <p className="text-lg font-bold text-primary">
                <FC amount={item.source_a_amount ?? 0} currency={currency} />
              </p>
            </>
          ) : (
            <div className="py-2">
              <p className="text-sm text-muted-foreground italic">No bank transaction</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                This ledger record has no corresponding entry in the bank statement for this period.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source B: Ledger Record */}
      <Card className={item.source_b_id
        ? (item.status === "flagged" ? "border-amber-200/60 bg-amber-50/30" : "border-blue-200/60")
        : "border-dashed"}>
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${item.source_b_id ? "bg-blue-500" : "bg-muted-foreground/30"}`} />
            {item.source_b_amount != null && item.source_b_amount < 0
              ? "Bill (Expense Record)"
              : item.source_b_amount != null && item.source_b_amount > 0
                ? "Invoice (Income Record)"
                : item.status === "flagged" && item.source_b_id
                  ? "Nearest Ledger Match"
                  : "Ledger Record"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          {item.source_b_id ? (
            <>
              <p className="text-sm font-medium leading-snug">{item.source_b_desc || "No description"}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {item.source_b_date
                    ? format(new Date(item.source_b_date), "MMM d, yyyy")
                    : "--"}
                </span>
              </div>
              <p className="text-lg font-bold text-primary">
                <FC amount={item.source_b_amount ?? 0} currency={currency} />
              </p>
              {item.status === "flagged" && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                  This is the closest potential match found but it did not meet the matching threshold. Review to manually match or exclude.
                </p>
              )}
            </>
          ) : (
            <div className="py-2 space-y-2">
              <p className="text-sm text-muted-foreground italic">No matching ledger record</p>
              <div className="text-xs text-muted-foreground/80 space-y-1">
                {(item.source_a_amount ?? 0) < 0 ? (
                  <>
                    <p>The engine searched all bills in the period but found no match.</p>
                    <p className="font-medium">Possible actions:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Create a bill for this expense</li>
                      <li>Exclude if it's a bank fee, ATM withdrawal, or internal transfer</li>
                      <li>Manually match to another unmatched item</li>
                    </ul>
                  </>
                ) : (item.source_a_amount ?? 0) > 0 ? (
                  <>
                    <p>The engine searched all invoices in the period but found no match.</p>
                    <p className="font-medium">Possible actions:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-1">
                      <li>Create an invoice for this income</li>
                      <li>Exclude if it's a refund, interest credit, or internal transfer</li>
                      <li>Manually match to another unmatched item</li>
                    </ul>
                  </>
                ) : (
                  <p>No ledger record corresponds to this item.</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Difference / Days diff */}
      {(item.status === "matched" || item.status === "manual_match") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Amount Diff</p>
            <p className={`text-sm font-bold ${item.difference === 0 ? "text-green-600" : "text-red-500"}`}>
              {item.difference === 0 ? "Exact" : <FC amount={item.difference} currency={currency} />}
            </p>
          </div>
          <div className="rounded-lg bg-muted/50 px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Date Diff</p>
            <p className={`text-sm font-bold ${item.days_diff === 0 ? "text-green-600" : "text-amber-500"}`}>
              {item.days_diff === 0 ? "Same day" : `${item.days_diff} day${item.days_diff !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
      )}

      {item.status === "flagged" && item.difference !== 0 && (
        <Card className="border-red-200/50 bg-red-50/50">
          <CardContent className="py-3 px-4 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Unreconciled Amount</span>
            <span className="text-sm font-bold text-red-600">
              <FC amount={item.difference} currency={currency} />
            </span>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Resolution actions (for flagged items only) */}
      {item.status === "flagged" && sessionStatus !== "finalized" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">
              Resolution Note
            </Label>
            <Input
              placeholder="Add a note about this resolution..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1 gap-2"
              onClick={() => onResolve(item.id, "resolve", note)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Resolve
            </Button>
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => onResolve(item.id, "exclude", note)}
            >
              <XCircle className="h-4 w-4" />
              Exclude
            </Button>
          </div>
        </div>
      )}

      {/* Unmatch action (for matched items) */}
      {(item.status === "matched" || item.status === "manual_match") && sessionStatus !== "finalized" && (
        <Button
          variant="outline"
          className="w-full gap-2 text-destructive hover:text-destructive"
          onClick={() => {
            onUnmatch(item.id);
          }}
        >
          <Unlink className="h-4 w-4" />
          Unmatch This Pair
        </Button>
      )}

      {/* Resolution display (for resolved/excluded items) */}
      {item.resolution && (
        <div className="rounded-lg bg-muted/50 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Resolution Note</p>
          <p className="text-sm">{item.resolution}</p>
        </div>
      )}
    </div>
  );
}

// ── Session History ──────────────────────────────────────────────────────

function SessionHistory({
  sessions,
  currency,
  onSelect,
  onDelete,
}: {
  sessions: ReconciliationSession[];
  currency: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-3 mb-3">
            <History className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <h3 className="text-sm font-semibold mb-1">No session history</h3>
          <p className="text-xs text-muted-foreground">
            Create your first reconciliation session to see history here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Session History</span>
        <span className="text-xs text-muted-foreground">({sessions.length} sessions)</span>
      </div>
      {sessions.map((session) => {
        const total = (session.match_count || 0) + (session.flag_count || 0);
        return (
          <Card
            key={session.id}
            className="stat-card-hover cursor-pointer"
            onClick={() => onSelect(session.id)}
          >
            <CardContent className="py-3 px-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {session.status === "finalized" ? (
                    <div className="rounded-full bg-green-50 p-1.5">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-amber-50 p-1.5">
                      <Clock className="h-4 w-4 text-amber-500" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {format(new Date(session.period_start), "MMM d")} --{" "}
                    {format(new Date(session.period_end), "MMM d, yyyy")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{session.match_rate.toFixed(0)}%</p>
                    <p className="text-[10px] text-muted-foreground">match rate</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-green-600">{session.match_count}</p>
                    <p className="text-[10px] text-muted-foreground">matched</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${session.flag_count > 0 ? "text-amber-500" : "text-green-600"}`}>
                      {session.flag_count}
                    </p>
                    <p className="text-[10px] text-muted-foreground">flagged</p>
                  </div>
                  <div className="text-right min-w-[80px]">
                    <p className="text-xs font-medium">
                      <FC amount={Math.abs(session.unreconciled_difference || 0)} currency={currency} />
                    </p>
                    <p className="text-[10px] text-muted-foreground">difference</p>
                  </div>
                  <Badge
                    variant={session.status === "finalized" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {session.status.replace("_", " ")}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(session.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ── Matching Rules Tab ───────────────────────────────────────────────────

// Preset auto-matching rule templates
const AUTO_RULE_PRESETS: { name: string; description: string; config: Partial<MatchingRule> }[] = [
  {
    name: "Exact Match",
    description: "Matches transactions with identical amounts on the same date. Highest confidence.",
    config: {
      match_by_amount: true, match_by_date: true, match_by_description: false, match_sign: true,
      amount_tolerance_type: "exact", amount_tolerance_value: 0, date_tolerance_days: 0, auto_match: true, priority: 10,
    },
  },
  {
    name: "Near Date Match",
    description: "Same amount, date within 3 days. Covers bank processing delays.",
    config: {
      match_by_amount: true, match_by_date: true, match_by_description: false, match_sign: true,
      amount_tolerance_type: "exact", amount_tolerance_value: 0, date_tolerance_days: 3, auto_match: true, priority: 20,
    },
  },
  {
    name: "Rounding Tolerance",
    description: "Allows up to 1.00 difference + 3 day date window. Catches rounding and bank fees.",
    config: {
      match_by_amount: true, match_by_date: true, match_by_description: false, match_sign: true,
      amount_tolerance_type: "fixed", amount_tolerance_value: 1, date_tolerance_days: 3, auto_match: true, priority: 30,
    },
  },
  {
    name: "Description + Amount",
    description: "Matches by vendor/description keywords AND amount within 5%. For invoice reconciliation.",
    config: {
      match_by_amount: true, match_by_date: false, match_by_description: true, match_sign: true,
      amount_tolerance_type: "percent", amount_tolerance_value: 5, date_tolerance_days: 7, auto_match: false, priority: 40,
    },
  },
];

// ── Cross-System Matching Tab ──────────────────────────────────────────────

type CrossSystemSource = {
  id: string;
  date: string;
  reference: string;
  description: string;
  amount: number;
};

type CrossMatchResult = {
  sourceA: CrossSystemSource;
  sourceB: CrossSystemSource | null;
  status: "matched" | "mismatch" | "unmatched";
  difference: number;
};

const CROSS_SYSTEM_TYPES = [
  {
    key: "erp-pos",
    label: "ERP ↔ POS",
    icon: MonitorSmartphone,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
    sourceA: "ERP",
    sourceB: "POS",
    description: "Match ERP sales records against POS terminal transactions to detect revenue leakage",
  },
  {
    key: "erp-crm",
    label: "ERP ↔ CRM",
    icon: Users,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200",
    sourceA: "ERP",
    sourceB: "CRM",
    description: "Match ERP invoices against CRM deal records to verify billing completeness",
  },
  {
    key: "erp-inventory",
    label: "ERP ↔ Inventory",
    icon: Package,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
    sourceA: "ERP",
    sourceB: "Inventory",
    description: "Match ERP purchase orders against inventory receipts to detect discrepancies",
  },
  {
    key: "multi-source",
    label: "Multi-Source",
    icon: Layers,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
    sourceA: "Source A",
    sourceB: "Source B",
    description: "Match any two data sources by uploading CSV files with reference, date, and amount",
  },
] as const;

function parseCsvToRecords(csvText: string): CrossSystemSource[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/"/g, ""));

  const refIdx = headers.findIndex((h) => /ref|reference|id|number|order|invoice/i.test(h));
  const dateIdx = headers.findIndex((h) => /date/i.test(h));
  const descIdx = headers.findIndex((h) => /desc|description|name|item|product|memo/i.test(h));
  const amtIdx = headers.findIndex((h) => /amount|total|value|sum|price/i.test(h));

  if (amtIdx === -1) return [];

  return lines.slice(1).filter(Boolean).map((line, i) => {
    const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    return {
      id: `row-${i}`,
      reference: refIdx >= 0 ? cols[refIdx] || "" : `#${i + 1}`,
      date: dateIdx >= 0 ? cols[dateIdx] || "" : "",
      description: descIdx >= 0 ? cols[descIdx] || "" : "",
      amount: parseFloat(cols[amtIdx]?.replace(/[^0-9.\-]/g, "") || "0") || 0,
    };
  });
}

function matchSources(sourceA: CrossSystemSource[], sourceB: CrossSystemSource[], tolerance: number): CrossMatchResult[] {
  const results: CrossMatchResult[] = [];
  const usedB = new Set<number>();

  sourceA.forEach((a) => {
    let bestIdx = -1;
    let bestDiff = Infinity;

    sourceB.forEach((b, idx) => {
      if (usedB.has(idx)) return;
      // Match by reference first, then amount
      const refMatch = a.reference && b.reference && a.reference.toLowerCase() === b.reference.toLowerCase();
      const amtDiff = Math.abs(a.amount - b.amount);

      if (refMatch && amtDiff <= tolerance) {
        if (amtDiff < bestDiff) { bestDiff = amtDiff; bestIdx = idx; }
      } else if (!refMatch && amtDiff <= tolerance * 0.01) {
        // Exact amount match as fallback
        if (amtDiff < bestDiff) { bestDiff = amtDiff; bestIdx = idx; }
      }
    });

    if (bestIdx >= 0) {
      usedB.add(bestIdx);
      const diff = a.amount - sourceB[bestIdx].amount;
      results.push({
        sourceA: a,
        sourceB: sourceB[bestIdx],
        status: Math.abs(diff) < 0.01 ? "matched" : "mismatch",
        difference: diff,
      });
    } else {
      results.push({ sourceA: a, sourceB: null, status: "unmatched", difference: a.amount });
    }
  });

  // Unmatched B records
  sourceB.forEach((b, idx) => {
    if (!usedB.has(idx)) {
      results.push({ sourceA: b, sourceB: null, status: "unmatched", difference: b.amount });
    }
  });

  return results;
}

function CrossSystemTab() {
  const { currency } = useActiveClient();
  const [activeType, setActiveType] = useState<string | null>(null);
  const [sourceAData, setSourceAData] = useState<CrossSystemSource[]>([]);
  const [sourceBData, setSourceBData] = useState<CrossSystemSource[]>([]);
  const [results, setResults] = useState<CrossMatchResult[]>([]);
  const [tolerance, setTolerance] = useState("1");
  const [isMatching, setIsMatching] = useState(false);
  const [resultFilter, setResultFilter] = useState<"all" | "matched" | "mismatch" | "unmatched">("all");

  const activeConfig = CROSS_SYSTEM_TYPES.find((t) => t.key === activeType);

  const handleFileUpload = (side: "a" | "b") => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const records = parseCsvToRecords(text);
        if (records.length === 0) {
          toast.error("Could not parse CSV. Ensure it has headers including an 'amount' column.");
          return;
        }
        if (side === "a") setSourceAData(records);
        else setSourceBData(records);
        toast.success(`Loaded ${records.length} records from ${file.name}`);
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const runMatching = () => {
    if (sourceAData.length === 0 || sourceBData.length === 0) {
      toast.error("Upload data for both sources before matching");
      return;
    }
    setIsMatching(true);
    setTimeout(() => {
      const matched = matchSources(sourceAData, sourceBData, parseFloat(tolerance) || 1);
      setResults(matched);
      setIsMatching(false);
      const mc = matched.filter((r) => r.status === "matched").length;
      const mm = matched.filter((r) => r.status === "mismatch").length;
      const um = matched.filter((r) => r.status === "unmatched").length;
      toast.success(`Matching complete: ${mc} matched, ${mm} mismatches, ${um} unmatched`);
    }, 500);
  };

  const filteredResults = results.filter((r) => resultFilter === "all" || r.status === resultFilter);
  const matchedCount = results.filter((r) => r.status === "matched").length;
  const mismatchCount = results.filter((r) => r.status === "mismatch").length;
  const unmatchedCount = results.filter((r) => r.status === "unmatched").length;
  const matchRate = results.length > 0 ? (matchedCount / results.length * 100).toFixed(1) : "0";
  const totalDiscrepancy = results.reduce((s, r) => s + (r.status === "mismatch" ? Math.abs(r.difference) : 0), 0);

  // No type selected — show overview cards
  if (!activeType) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select a matching type to reconcile records across systems.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CROSS_SYSTEM_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <Card
                key={type.key}
                className="stat-card-hover cursor-pointer transition-all hover:shadow-md"
                onClick={() => { setActiveType(type.key); setResults([]); setSourceAData([]); setSourceBData([]); }}
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`rounded-lg p-2.5 ${type.bgColor}`}>
                      <Icon className={`h-5 w-5 ${type.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm mb-1">{type.label}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {type.description}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-1" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Active matching type selected
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setActiveType(null)}>
          ← Back
        </Button>
        {activeConfig && (
          <div className="flex items-center gap-2">
            <div className={`rounded-md p-1.5 ${activeConfig.bgColor}`}>
              <activeConfig.icon className={`h-4 w-4 ${activeConfig.color}`} />
            </div>
            <h3 className="font-semibold">{activeConfig.label} Matching</h3>
          </div>
        )}
      </div>

      {/* Upload Sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source A */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>{activeConfig?.sourceA || "Source A"} Data</span>
              {sourceAData.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{sourceAData.length} records</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => handleFileUpload("a")}>
              <Upload className="h-4 w-4" />
              Upload {activeConfig?.sourceA || "Source A"} CSV
            </Button>
            {sourceAData.length > 0 && (
              <div className="mt-3 rounded-md border max-h-[180px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Ref</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceAData.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[10px] py-1.5">{r.reference || "—"}</TableCell>
                        <TableCell className="text-[10px] py-1.5">{r.date || "—"}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right font-mono"><FC amount={r.amount} currency={currency} /></TableCell>
                      </TableRow>
                    ))}
                    {sourceAData.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-[10px] text-muted-foreground py-1.5">
                          +{sourceAData.length - 10} more
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Source B */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              <span>{activeConfig?.sourceB || "Source B"} Data</span>
              {sourceBData.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{sourceBData.length} records</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => handleFileUpload("b")}>
              <Upload className="h-4 w-4" />
              Upload {activeConfig?.sourceB || "Source B"} CSV
            </Button>
            {sourceBData.length > 0 && (
              <div className="mt-3 rounded-md border max-h-[180px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-[10px]">Ref</TableHead>
                      <TableHead className="text-[10px]">Date</TableHead>
                      <TableHead className="text-[10px] text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sourceBData.slice(0, 10).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-[10px] py-1.5">{r.reference || "—"}</TableCell>
                        <TableCell className="text-[10px] py-1.5">{r.date || "—"}</TableCell>
                        <TableCell className="text-[10px] py-1.5 text-right font-mono"><FC amount={r.amount} currency={currency} /></TableCell>
                      </TableRow>
                    ))}
                    {sourceBData.length > 10 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-[10px] text-muted-foreground py-1.5">
                          +{sourceBData.length - 10} more
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Match Controls */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tolerance:</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className="h-8 w-[100px] text-xs"
              />
            </div>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={runMatching}
              disabled={isMatching || sourceAData.length === 0 || sourceBData.length === 0}
            >
              {isMatching ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Matching...</>
              ) : (
                <><RefreshCw className="h-3.5 w-3.5" /> Run Matching</>
              )}
            </Button>
            {results.length > 0 && (
              <div className="flex items-center gap-1.5 ml-auto">
                <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">
                  {matchedCount} matched
                </Badge>
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-200 bg-amber-50">
                  {mismatchCount} mismatch
                </Badge>
                <Badge variant="outline" className="text-[10px] text-red-600 border-red-200 bg-red-50">
                  {unmatchedCount} unmatched
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MiniStat icon={Target} iconColor="text-primary" label="Match Rate" value={`${matchRate}%`} />
            <MiniStat icon={CheckCircle2} iconColor="text-green-500" label="Matched" value={matchedCount.toString()} />
            <MiniStat icon={AlertTriangle} iconColor="text-amber-500" label="Mismatches" value={mismatchCount.toString()} />
            <MiniStat icon={DollarSign} iconColor="text-red-500" label="Total Discrepancy" value={<FC amount={totalDiscrepancy} currency={currency} />} />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-1">
            {(["all", "matched", "mismatch", "unmatched"] as const).map((f) => (
              <Button
                key={f}
                variant={resultFilter === f ? "default" : "ghost"}
                size="sm"
                className="text-xs h-7 capitalize"
                onClick={() => setResultFilter(f)}
              >
                {f} {f === "all" ? `(${results.length})` : f === "matched" ? `(${matchedCount})` : f === "mismatch" ? `(${mismatchCount})` : `(${unmatchedCount})`}
              </Button>
            ))}
          </div>

          {/* Results Table */}
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">{activeConfig?.sourceA} Ref</TableHead>
                    <TableHead className="text-xs">{activeConfig?.sourceA} Desc</TableHead>
                    <TableHead className="text-xs text-right">{activeConfig?.sourceA} Amt</TableHead>
                    <TableHead className="text-xs">{activeConfig?.sourceB} Ref</TableHead>
                    <TableHead className="text-xs">{activeConfig?.sourceB} Desc</TableHead>
                    <TableHead className="text-xs text-right">{activeConfig?.sourceB} Amt</TableHead>
                    <TableHead className="text-xs text-right">Diff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredResults.slice(0, 100).map((r, i) => (
                    <TableRow key={i} className="hover:bg-muted/30">
                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            r.status === "matched"
                              ? "text-green-600 border-green-200 bg-green-50"
                              : r.status === "mismatch"
                              ? "text-amber-600 border-amber-200 bg-amber-50"
                              : "text-red-600 border-red-200 bg-red-50"
                          }`}
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2">{r.sourceA.reference || "—"}</TableCell>
                      <TableCell className="text-xs py-2 max-w-[140px] truncate">{r.sourceA.description || "—"}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono"><FC amount={r.sourceA.amount} currency={currency} /></TableCell>
                      <TableCell className="text-xs py-2">{r.sourceB?.reference || "—"}</TableCell>
                      <TableCell className="text-xs py-2 max-w-[140px] truncate">{r.sourceB?.description || "—"}</TableCell>
                      <TableCell className="text-xs py-2 text-right font-mono">{r.sourceB ? <FC amount={r.sourceB.amount} currency={currency} /> : "—"}</TableCell>
                      <TableCell className={`text-xs py-2 text-right font-mono font-medium ${r.difference !== 0 ? "text-red-500" : ""}`}>
                        {r.status !== "unmatched" && r.sourceB ? <FC amount={r.difference} currency={currency} /> : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredResults.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-2">
                        +{filteredResults.length - 100} more results
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Matching Rules Tab ────────────────────────────────────────────────────

function MatchingRulesTab() {
  const { clientId } = useActiveClient();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<Partial<MatchingRule> | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const { data: rules = [] } = useQuery({
    queryKey: ["matching-rules", clientId],
    queryFn: () => database.getMatchingRules(clientId!),
    enabled: !!clientId,
  });

  const handleSaveRule = async () => {
    if (!clientId || !editingRule?.name) return;
    try {
      await database.upsertMatchingRule(clientId, editingRule as any);
      queryClient.invalidateQueries({ queryKey: ["matching-rules", clientId] });
      setShowEditor(false);
      setEditingRule(null);
      toast.success("Rule saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule");
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await database.deleteMatchingRule(ruleId);
      queryClient.invalidateQueries({ queryKey: ["matching-rules", clientId] });
      toast.success("Rule deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete rule");
    }
  };

  const handleAddPreset = async (preset: typeof AUTO_RULE_PRESETS[0]) => {
    if (!clientId) return;
    // Check if rule with same name already exists
    if (rules.some((r) => r.name === preset.name)) {
      toast.error(`Rule "${preset.name}" already exists`);
      return;
    }
    try {
      await database.upsertMatchingRule(clientId, {
        name: preset.name,
        description: preset.description,
        recon_type: "bank",
        is_active: true,
        ...preset.config,
      } as any);
      queryClient.invalidateQueries({ queryKey: ["matching-rules", clientId] });
      toast.success(`Auto rule "${preset.name}" added`);
    } catch (err: any) {
      toast.error(err.message || "Failed to add rule");
    }
  };

  const handleAddAllPresets = async () => {
    if (!clientId) return;
    let added = 0;
    for (const preset of AUTO_RULE_PRESETS) {
      if (rules.some((r) => r.name === preset.name)) continue;
      try {
        await database.upsertMatchingRule(clientId, {
          name: preset.name,
          description: preset.description,
          recon_type: "bank",
          is_active: true,
          ...preset.config,
        } as any);
        added++;
      } catch { /* skip */ }
    }
    queryClient.invalidateQueries({ queryKey: ["matching-rules", clientId] });
    if (added > 0) toast.success(`${added} auto matching rule(s) added`);
    else toast.info("All preset rules already exist");
  };

  const openNew = () => {
    setEditingRule({
      name: "",
      description: "",
      recon_type: "bank",
      priority: (rules.length + 1) * 10,
      is_active: true,
      match_by_amount: true,
      match_by_date: true,
      match_by_description: false,
      match_sign: true,
      amount_tolerance_type: "exact",
      amount_tolerance_value: 0,
      date_tolerance_days: 0,
      auto_match: false,
    });
    setShowEditor(true);
  };

  const openEdit = (rule: MatchingRule) => {
    setEditingRule({ ...rule });
    setShowEditor(true);
  };

  const activeRules = rules.filter((r) => r.is_active);
  const autoRules = rules.filter((r) => r.auto_match && r.is_active);

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Matching Rules</p>
            <p className="text-xs text-muted-foreground">
              {activeRules.length > 0
                ? `${activeRules.length} active rule(s) · ${autoRules.length} auto-match · Rules override default engine logic`
                : "No rules configured — engine uses default matching logic"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowHowItWorks(!showHowItWorks)}>
              <HelpCircle className="h-3.5 w-3.5" />
              How It Works
            </Button>
            <Button size="sm" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Add Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* How It Works explanation */}
      {showHowItWorks && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">How Auto Matching Works</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-blue-800 dark:text-blue-300">
              <div className="space-y-2">
                <p className="font-semibold">Rule Priority System</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li>Rules run in <strong>priority order</strong> (lowest number first)</li>
                  <li>Each transaction tries rules top-down until a match is found</li>
                  <li>Once matched by a rule, the transaction is not processed by later rules</li>
                  <li><strong>If you set rules, only your rules are used</strong> — the default engine logic is bypassed</li>
                </ul>
              </div>
              <div className="space-y-2">
                <p className="font-semibold">Matching Criteria</p>
                <ul className="space-y-1 list-disc pl-4">
                  <li><strong>Amount</strong> — Exact, cents tolerance, percentage, or fixed amount</li>
                  <li><strong>Date</strong> — Same day or within N days (covers bank delays)</li>
                  <li><strong>Description</strong> — Vendor/customer name keyword matching</li>
                  <li><strong>Auto-Match</strong> — Instantly marks as matched (no manual review needed)</li>
                </ul>
              </div>
            </div>
            <Separator className="bg-blue-200 dark:bg-blue-800" />
            <div className="text-xs text-blue-700 dark:text-blue-400">
              <p><strong>Example:</strong> Rule "Exact Match" (priority 10) runs first — if a bank transaction has the exact same amount and date as a bill, it is matched immediately. If no exact match, "Near Date Match" (priority 20) tries the same amount within 3 days. Unmatched items are flagged for manual review.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto Matching Rules — Presets */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Wand2 className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-medium">Auto Matching Rules</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleAddAllPresets}>
              <Sparkles className="h-3.5 w-3.5" />
              Add All Presets
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Pre-configured rules that cover the most common reconciliation scenarios. Click to add individually or use "Add All" for a complete setup.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AUTO_RULE_PRESETS.map((preset) => {
              const exists = rules.some((r) => r.name === preset.name);
              return (
                <div
                  key={preset.name}
                  className={`border rounded-lg p-3 transition-colors ${
                    exists
                      ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                      : "border-dashed hover:border-primary/40 hover:bg-muted/30 cursor-pointer"
                  }`}
                  onClick={() => !exists && handleAddPreset(preset)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold">{preset.name}</p>
                        {preset.config.auto_match && (
                          <Badge className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20">
                            <Zap className="h-2.5 w-2.5 mr-0.5" />Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{preset.description}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {preset.config.match_by_amount && <Badge variant="outline" className="text-[9px] h-3.5">Amount</Badge>}
                        {preset.config.match_by_date && <Badge variant="outline" className="text-[9px] h-3.5">Date</Badge>}
                        {preset.config.match_by_description && <Badge variant="outline" className="text-[9px] h-3.5">Description</Badge>}
                        {preset.config.amount_tolerance_type !== "exact" && (
                          <Badge variant="secondary" className="text-[9px] h-3.5">
                            +/-{preset.config.amount_tolerance_value} {preset.config.amount_tolerance_type}
                          </Badge>
                        )}
                        {(preset.config.date_tolerance_days || 0) > 0 && (
                          <Badge variant="secondary" className="text-[9px] h-3.5">+/-{preset.config.date_tolerance_days}d</Badge>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0">
                      {exists ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Plus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* User Rules List */}
      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Zap className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-sm font-semibold mb-1">No matching rules configured</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-3">
              The engine uses default logic. Add auto-matching presets above or create custom rules to control exactly how transactions are matched.
            </p>
            <Button size="sm" variant="outline" className="gap-2" onClick={openNew}>
              <Plus className="h-4 w-4" />
              Create Custom Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Rules ({rules.length})
            </p>
            <p className="text-[10px] text-muted-foreground">Processed in priority order (lowest first)</p>
          </div>
          {rules
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
            <Card key={rule.id} className="stat-card-hover">
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="text-xs font-mono text-muted-foreground bg-muted rounded px-1.5 py-0.5 w-8 text-center shrink-0">
                  {rule.priority}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{rule.name}</p>
                    {rule.auto_match && (
                      <Badge className="text-[9px] h-4 bg-primary/10 text-primary border-primary/20">
                        <Zap className="h-2.5 w-2.5 mr-0.5" />Auto
                      </Badge>
                    )}
                  </div>
                  {rule.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rule.match_by_amount && <Badge variant="outline" className="text-[10px] h-4">Amount</Badge>}
                    {rule.match_by_date && <Badge variant="outline" className="text-[10px] h-4">Date</Badge>}
                    {rule.match_by_description && <Badge variant="outline" className="text-[10px] h-4">Description</Badge>}
                    {rule.amount_tolerance_type !== "exact" && (
                      <Badge variant="secondary" className="text-[10px] h-4">
                        +/-{rule.amount_tolerance_value} {rule.amount_tolerance_type}
                      </Badge>
                    )}
                    {rule.date_tolerance_days > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-4">+/-{rule.date_tolerance_days}d</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={rule.is_active ? "default" : "outline"} className="text-[10px] h-5">
                    {rule.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteRule(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Rule editor dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {editingRule?.id ? "Edit Rule" : "New Matching Rule"}
            </DialogTitle>
            <DialogDescription>
              {editingRule?.id
                ? "Update this rule's matching criteria and tolerances."
                : "Define how the reconciliation engine should match transactions. Rules with Auto-Match enabled will be applied without manual review."}
            </DialogDescription>
          </DialogHeader>
          {editingRule && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Rule Name</Label>
                  <Input
                    value={editingRule.name || ""}
                    onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                    placeholder="e.g. Near Amount Match"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority (lower = runs first)</Label>
                  <Input
                    type="number"
                    value={editingRule.priority || 10}
                    onChange={(e) => setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 10 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={editingRule.description || ""}
                  onChange={(e) => setEditingRule({ ...editingRule, description: e.target.value })}
                  placeholder="What does this rule do?"
                />
              </div>
              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matching Criteria</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Match by Amount</Label>
                  <Switch
                    checked={editingRule.match_by_amount ?? true}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, match_by_amount: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Match by Date</Label>
                  <Switch
                    checked={editingRule.match_by_date ?? true}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, match_by_date: v })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Match Description</Label>
                  <Switch
                    checked={editingRule.match_by_description ?? false}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, match_by_description: v })}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-primary/5 px-2 py-1 -mx-2">
                  <Label className="text-sm font-semibold">Auto-Match</Label>
                  <Switch
                    checked={editingRule.auto_match ?? false}
                    onCheckedChange={(v) => setEditingRule({ ...editingRule, auto_match: v })}
                  />
                </div>
              </div>
              {editingRule.auto_match && (
                <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-800">
                  Transactions matching this rule will be <strong>automatically reconciled</strong> without manual review. Only enable for high-confidence rules.
                </div>
              )}
              <Separator />
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Tolerances</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount Tolerance</Label>
                  <Select
                    value={editingRule.amount_tolerance_type || "exact"}
                    onValueChange={(v) => setEditingRule({ ...editingRule, amount_tolerance_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact Match</SelectItem>
                      <SelectItem value="cents">Cents (+/-)</SelectItem>
                      <SelectItem value="percent">Percent (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {editingRule.amount_tolerance_type === "percent" ? "% Value" : "Amount Value"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingRule.amount_tolerance_value ?? 0}
                    onChange={(e) => setEditingRule({ ...editingRule, amount_tolerance_value: parseFloat(e.target.value) || 0 })}
                    disabled={editingRule.amount_tolerance_type === "exact"}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Date Tolerance (days)</Label>
                <Input
                  type="number"
                  min="0"
                  max="30"
                  value={editingRule.date_tolerance_days ?? 0}
                  onChange={(e) => setEditingRule({ ...editingRule, date_tolerance_days: parseInt(e.target.value) || 0 })}
                />
                <p className="text-[10px] text-muted-foreground">0 = same day only. Increase for bank processing delays (1-3 days typical).</p>
              </div>
              <Button className="w-full" onClick={handleSaveRule}>
                {editingRule.id ? "Update Rule" : "Create Rule"}
              </Button>
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
  sub,
  color,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
  color: string;
}) {
  return (
    <Card className="stat-card-hover">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <p className={`text-xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  iconColor,
  label,
  value,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5 ${onClick ? "cursor-pointer hover:bg-muted/80 transition-colors" : ""}`}
      onClick={onClick}
    >
      <Icon className={`h-4 w-4 ${iconColor} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────

export default function Reconciliation() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Reconciliation
          </h1>
          <p className="text-muted-foreground">
            Match bank transactions against bills and invoices to detect
            mismatches and discrepancies.
          </p>
        </div>

        <Tabs defaultValue="bank">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="bank" className="gap-1.5">
              <GitCompareArrows className="h-3.5 w-3.5" />
              Bank Reconciliation
            </TabsTrigger>
            <TabsTrigger value="payment" disabled>
              Payment Settlement
              <Badge variant="outline" className="ml-1.5 text-[9px] h-4">
                Soon
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="cross" className="gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              Cross-System
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Matching Rules
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bank" className="mt-4">
            <BankReconciliationTab />
          </TabsContent>

          <TabsContent value="payment" className="mt-4">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <ArrowLeftRight className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Match payment gateway transactions against bank settlements.
                  Validate fees, match refunds, detect settlement timing differences.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cross" className="mt-4">
            <CrossSystemTab />
          </TabsContent>

          <TabsContent value="rules" className="mt-4">
            <MatchingRulesTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
