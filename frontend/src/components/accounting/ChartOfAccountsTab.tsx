import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { AccountDialog } from "./AccountDialog";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Calculator, Pencil, Trash2, Download, Search, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { useCurrency } from "@/hooks/useCurrency";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { format } from "date-fns";

const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-yellow-100 text-yellow-700",
};

const STANDARD_ACCOUNTS = [
  { account_number: "1000", account_name: "Cash", account_type: "asset" as const, description: "Cash on hand and in bank accounts" },
  { account_number: "1010", account_name: "Petty Cash", account_type: "asset" as const, description: "Small cash fund for minor expenses" },
  { account_number: "1100", account_name: "Accounts Receivable", account_type: "asset" as const, description: "Amounts owed by customers" },
  { account_number: "1200", account_name: "Inventory", account_type: "asset" as const, description: "Goods held for sale" },
  { account_number: "1300", account_name: "Prepaid Expenses", account_type: "asset" as const, description: "Expenses paid in advance" },
  { account_number: "1500", account_name: "Equipment", account_type: "asset" as const, description: "Machinery and office equipment" },
  { account_number: "1510", account_name: "Accumulated Depreciation", account_type: "asset" as const, description: "Contra asset for accumulated depreciation" },
  { account_number: "2000", account_name: "Accounts Payable", account_type: "liability" as const, description: "Amounts owed to suppliers and vendors" },
  { account_number: "2100", account_name: "Accrued Liabilities", account_type: "liability" as const, description: "Expenses incurred but not yet paid" },
  { account_number: "2200", account_name: "Sales Tax Payable", account_type: "liability" as const, description: "Sales tax collected and owed to government" },
  { account_number: "2300", account_name: "Short-term Loans Payable", account_type: "liability" as const, description: "Loans due within one year" },
  { account_number: "2500", account_name: "Long-term Debt", account_type: "liability" as const, description: "Loans and obligations due after one year" },
  { account_number: "3000", account_name: "Owner's Equity", account_type: "equity" as const, description: "Owner's investment in the business" },
  { account_number: "3100", account_name: "Retained Earnings", account_type: "equity" as const, description: "Accumulated net income kept in the business" },
  { account_number: "3200", account_name: "Owner's Drawings", account_type: "equity" as const, description: "Withdrawals made by the owner" },
  { account_number: "4000", account_name: "Sales Revenue", account_type: "revenue" as const, description: "Revenue from product sales" },
  { account_number: "4100", account_name: "Service Revenue", account_type: "revenue" as const, description: "Revenue from services rendered" },
  { account_number: "4200", account_name: "Interest Income", account_type: "revenue" as const, description: "Interest earned on deposits or loans" },
  { account_number: "4300", account_name: "Other Income", account_type: "revenue" as const, description: "Miscellaneous income" },
  { account_number: "5000", account_name: "Cost of Goods Sold", account_type: "expense" as const, description: "Direct cost of goods sold" },
  { account_number: "5100", account_name: "Salaries & Wages", account_type: "expense" as const, description: "Employee compensation expenses" },
  { account_number: "5200", account_name: "Rent Expense", account_type: "expense" as const, description: "Office and facility rent" },
  { account_number: "5300", account_name: "Utilities Expense", account_type: "expense" as const, description: "Electricity, water, internet" },
  { account_number: "5400", account_name: "Office Supplies", account_type: "expense" as const, description: "Office stationery and supplies" },
  { account_number: "5500", account_name: "Marketing & Advertising", account_type: "expense" as const, description: "Promotion and advertising costs" },
  { account_number: "5600", account_name: "Professional Services", account_type: "expense" as const, description: "Legal, accounting, consulting fees" },
  { account_number: "5700", account_name: "Insurance Expense", account_type: "expense" as const, description: "Business insurance premiums" },
  { account_number: "5800", account_name: "Depreciation Expense", account_type: "expense" as const, description: "Periodic depreciation of assets" },
  { account_number: "5900", account_name: "Interest Expense", account_type: "expense" as const, description: "Interest paid on loans and credit" },
  { account_number: "5950", account_name: "Miscellaneous Expense", account_type: "expense" as const, description: "Other uncategorized expenses" },
];

// Maps transaction category + sign to the correct expense/income account number
function categoryToAccountNumber(category: string | null | undefined, isIncome: boolean): string {
  const cat = (category || "").toLowerCase();
  if (isIncome) {
    if (cat.includes("banking") || cat.includes("finance")) return "4300";
    if (cat.includes("sales")) return "4000";
    if (cat.includes("service")) return "4100";
    if (cat.includes("interest")) return "4200";
    return "4300"; // Other Income
  }
  // Expense side
  if (cat.includes("utilities") || cat.includes("bill")) return "5300";
  if (cat.includes("banking") || cat.includes("interest")) return "5900";
  if (cat.includes("salary") || cat.includes("payroll") || cat.includes("wage")) return "5100";
  if (cat.includes("rent")) return "5200";
  if (cat.includes("insurance")) return "5700";
  if (cat.includes("marketing") || cat.includes("advertising")) return "5500";
  if (cat.includes("professional") || cat.includes("legal") || cat.includes("consulting")) return "5600";
  if (cat.includes("depreciation")) return "5800";
  if (cat.includes("supplies") || cat.includes("office")) return "5400";
  // Everything else → Miscellaneous
  return "5950";
}

// Accounting rules per account type
function getAccountRule(type: string): string {
  if (type === "asset") return "Asset accounts have a normal Debit balance. Debits increase assets (e.g., cash received); Credits decrease assets (e.g., cash paid out).";
  if (type === "expense") return "Expense accounts have a normal Debit balance. Debits record costs incurred; Credits reduce expenses (e.g., refunds or reversals).";
  if (type === "liability") return "Liability accounts have a normal Credit balance. Credits increase what you owe; Debits reduce liabilities (e.g., loan repayments).";
  if (type === "equity") return "Equity accounts have a normal Credit balance. Credits increase owner's equity; Debits decrease it (e.g., owner withdrawals).";
  if (type === "revenue") return "Revenue accounts have a normal Credit balance. Credits record income earned; Debits are reversals or refunds.";
  return "Balance = Total Debits − Total Credits from all journal entry lines for this account.";
}
function getNormalBalance(type: string): string {
  return ["asset", "expense"].includes(type) ? "Debit" : "Credit";
}

export function ChartOfAccountsTab() {
  const { currency } = useCurrency();
  const fmtBal = (v: number) => <FormattedCurrency amount={v} currency={currency} />;
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatus, setSyncStatus] = useState("");

  // Reason sheet state
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonAccount, setReasonAccount] = useState<any>(null);
  const [reasonLines, setReasonLines] = useState<any[]>([]);
  const [reasonLoading, setReasonLoading] = useState(false);

  const openReason = async (account: any) => {
    setReasonAccount(account);
    setReasonLines([]);
    setReasonOpen(true);
    setReasonLoading(true);
    try {
      const { data } = await supabase
        .from("journal_entry_lines")
        .select("debit_amount, credit_amount, journal_entries(entry_date, description, entry_number)")
        .eq("account_id", account.id)
        .limit(100);
      setReasonLines(data || []);
    } catch {
      setReasonLines([]);
    }
    setReasonLoading(false);
  };

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: accts } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .eq("user_id", user.id)
        .order("account_type")
        .order("account_number");
      if (!accts || accts.length === 0) return [];

      const ids = accts.map((a) => a.id);
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("account_id, debit_amount, credit_amount")
        .in("account_id", ids);

      const balanceMap: Record<string, number> = {};
      if (lines) {
        for (const line of lines) {
          if (!balanceMap[line.account_id]) balanceMap[line.account_id] = 0;
          balanceMap[line.account_id] += (line.debit_amount || 0) - (line.credit_amount || 0);
        }
      }

      return accts.map((a: any) => ({
        ...a,
        computed_balance: balanceMap[a.id] ?? 0,
      }));
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("accounts").update({ is_active: false }).eq("id", deleteId);
    if (error) toast.error("Failed to deactivate account");
    else { toast.success("Account deactivated"); queryClient.invalidateQueries({ queryKey: ["accounts"] }); }
    setDeleteId(null);
  };

  const ensureStandardAccounts = async (userId: string): Promise<Record<string, string>> => {
    const { data: existing } = await supabase
      .from("accounts")
      .select("account_number, id")
      .eq("user_id", userId)
      .eq("is_active", true);

    const existingMap: Record<string, string> = {};
    (existing || []).forEach((a) => { existingMap[a.account_number] = a.id; });

    const toInsert = STANDARD_ACCOUNTS
      .filter((a) => !existingMap[a.account_number])
      .map((a) => ({ ...a, user_id: userId }));

    if (toInsert.length > 0) {
      const { data: inserted } = await supabase.from("accounts").insert(toInsert).select("account_number, id");
      (inserted || []).forEach((a) => { existingMap[a.account_number] = a.id; });
    }

    return existingMap;
  };

  const handleLoadStandard = async () => {
    setSeeding(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSeeding(false); return; }

    const { data: existing } = await supabase
      .from("accounts")
      .select("account_number")
      .eq("user_id", user.id);
    const existingNumbers = new Set((existing || []).map((a) => a.account_number));

    const toInsert = STANDARD_ACCOUNTS
      .filter((a) => !existingNumbers.has(a.account_number))
      .map((a) => ({ ...a, user_id: user.id }));

    if (toInsert.length === 0) {
      toast.info("All standard accounts already exist");
      setSeeding(false);
      return;
    }

    const { error } = await supabase.from("accounts").insert(toInsert);
    if (error) {
      toast.error(`Failed to load standard accounts: ${error.message}`);
    } else {
      toast.success(`Loaded ${toInsert.length} standard accounts`);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
    }
    setSeeding(false);
  };

  const handleSyncTransactions = async () => {
    setSyncing(true);
    setSyncProgress(0);
    setSyncStatus("Starting sync...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Not logged in"); setSyncing(false); return; }

      // Step 1: Ensure standard accounts exist and get account map
      setSyncStatus("Loading standard accounts...");
      const accountMap = await ensureStandardAccounts(user.id);
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      setSyncProgress(5);

      // Step 2: Fetch all transactions
      setSyncStatus("Fetching transactions from your uploaded files...");
      const { data: transactions } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, amount, category")
        .eq("user_id", user.id);

      const allTxns = transactions || [];
      setSyncProgress(10);

      // Step 2.5: Clean up orphaned journal entries (entries with no lines from failed syncs)
      setSyncStatus("Cleaning up orphaned entries...");

      // Delete old BANK-AUTO-* entries (created by a previous sync format — always have 0 amounts)
      await supabase
        .from("journal_entries")
        .delete()
        .eq("user_id", user.id)
        .like("reference", "BANK-AUTO%");

      const { data: syncedEntries } = await supabase
        .from("journal_entries")
        .select("id, reference")
        .eq("user_id", user.id)
        .or("reference.like.TXN:%,reference.like.INV:%,reference.like.BILL:%");

      if (syncedEntries && syncedEntries.length > 0) {
        const entryIds = syncedEntries.map(e => e.id);
        // Check which entries have lines
        const { data: linesExist } = await supabase
          .from("journal_entry_lines")
          .select("journal_entry_id")
          .in("journal_entry_id", entryIds);

        const idsWithLines = new Set((linesExist || []).map(l => l.journal_entry_id));
        const orphanIds = entryIds.filter(id => !idsWithLines.has(id));

        if (orphanIds.length > 0) {
          // Delete orphans in batches of 50
          for (let i = 0; i < orphanIds.length; i += 50) {
            await supabase.from("journal_entries").delete().in("id", orphanIds.slice(i, i + 50));
          }
          console.log(`Cleaned up ${orphanIds.length} orphaned journal entries`);
        }
      }
      setSyncProgress(13);

      // Step 3: Find already-synced transactions
      setSyncStatus("Checking for already-synced entries...");
      const { data: existingRefs } = await supabase
        .from("journal_entries")
        .select("reference")
        .eq("user_id", user.id)
        .like("reference", "TXN:%");

      const syncedRefs = new Set((existingRefs || []).map(r => r.reference));

      // Filter out already-synced
      const toSync = allTxns.filter(t => !syncedRefs.has(`TXN:${t.id}`));
      setSyncProgress(15);

      let createdCount = 0;

      // Step 4: Batch-create journal entries from transactions (batches of 30)
      const BATCH_SIZE = 30;
      for (let i = 0; i < toSync.length; i += BATCH_SIZE) {
        const batch = toSync.slice(i, i + BATCH_SIZE);
        setSyncStatus(`Syncing transactions ${i + 1}–${Math.min(i + BATCH_SIZE, toSync.length)} of ${toSync.length}...`);
        setSyncProgress(15 + Math.round((i / Math.max(toSync.length, 1)) * 55));

        const entriesToInsert = batch.map((txn, idx) => ({
          user_id: user.id,
          entry_number: `TXN-${txn.id.substring(0, 8)}`,
          entry_date: txn.transaction_date,
          description: txn.description || "Transaction",
          reference: `TXN:${txn.id}`,
        }));

        const { data: insertedEntries, error: entryErr } = await supabase
          .from("journal_entries")
          .insert(entriesToInsert)
          .select("id, reference");

        if (entryErr || !insertedEntries) continue;

        // Build lines for each inserted entry
        const lines: any[] = [];
        for (const entry of insertedEntries) {
          const txn = batch.find(t => `TXN:${t.id}` === entry.reference);
          if (!txn) continue;
          const amount = Math.abs(txn.amount);
          const isIncome = txn.amount > 0;
          const cashAccountId = accountMap["1000"];
          const otherAccountNum = categoryToAccountNumber(txn.category, isIncome);
          const otherAccountId = accountMap[otherAccountNum];

          if (!cashAccountId || !otherAccountId) continue;

          if (isIncome) {
            // Debit Cash, Credit Revenue
            lines.push({ journal_entry_id: entry.id, account_id: cashAccountId, debit_amount: amount, credit_amount: 0 });
            lines.push({ journal_entry_id: entry.id, account_id: otherAccountId, debit_amount: 0, credit_amount: amount });
          } else {
            // Debit Expense, Credit Cash
            lines.push({ journal_entry_id: entry.id, account_id: otherAccountId, debit_amount: amount, credit_amount: 0 });
            lines.push({ journal_entry_id: entry.id, account_id: cashAccountId, debit_amount: 0, credit_amount: amount });
          }
        }

        if (lines.length > 0) {
          await supabase.from("journal_entry_lines").insert(lines);
        }
        createdCount += insertedEntries.length;
      }

      setSyncProgress(70);

      // Step 5: Sync invoices
      setSyncStatus("Syncing invoices...");
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_date, invoice_number, total_amount, category")
        .eq("user_id", user.id)
        .in("status", ["paid", "sent"]);

      const { data: existingInvRefs } = await supabase
        .from("journal_entries")
        .select("reference")
        .eq("user_id", user.id)
        .like("reference", "INV:%");

      const syncedInvRefs = new Set((existingInvRefs || []).map(r => r.reference));
      const invoicesToSync = (invoices || []).filter(inv => !syncedInvRefs.has(`INV:${inv.id}`));

      for (let i = 0; i < invoicesToSync.length; i += BATCH_SIZE) {
        const batch = invoicesToSync.slice(i, i + BATCH_SIZE);
        const entriesToInsert = batch.map(inv => ({
          user_id: user.id,
          entry_number: `INV-${inv.id.substring(0, 8)}`,
          entry_date: inv.invoice_date,
          description: `Invoice ${inv.invoice_number}`,
          reference: `INV:${inv.id}`,
        }));

        const { data: insertedEntries } = await supabase
          .from("journal_entries")
          .insert(entriesToInsert)
          .select("id, reference");

        if (!insertedEntries) continue;

        const lines: any[] = [];
        const arAccountId = accountMap["1100"]; // Accounts Receivable
        const revenueAccountId = accountMap["4000"]; // Sales Revenue

        for (const entry of insertedEntries) {
          const inv = batch.find(i => `INV:${i.id}` === entry.reference);
          if (!inv || !arAccountId || !revenueAccountId) continue;
          const amount = Math.abs(inv.total_amount);
          // Debit AR, Credit Revenue
          lines.push({ journal_entry_id: entry.id, account_id: arAccountId, debit_amount: amount, credit_amount: 0 });
          lines.push({ journal_entry_id: entry.id, account_id: revenueAccountId, debit_amount: 0, credit_amount: amount });
        }

        if (lines.length > 0) await supabase.from("journal_entry_lines").insert(lines);
        createdCount += insertedEntries.length;
      }

      setSyncProgress(85);

      // Step 6: Sync bills (include ALL statuses — unpaid bills create AP liability)
      setSyncStatus("Syncing bills...");
      const { data: bills } = await supabase
        .from("bills")
        .select("id, bill_date, bill_number, total_amount, category, status")
        .eq("user_id", user.id)
        .in("status", ["paid", "pending", "overdue", "partial"]);

      const { data: existingBillRefs } = await supabase
        .from("journal_entries")
        .select("reference")
        .eq("user_id", user.id)
        .like("reference", "BILL:%");

      const syncedBillRefs = new Set((existingBillRefs || []).map(r => r.reference));
      const billsToSync = (bills || []).filter(b => !syncedBillRefs.has(`BILL:${b.id}`));

      for (let i = 0; i < billsToSync.length; i += BATCH_SIZE) {
        const batch = billsToSync.slice(i, i + BATCH_SIZE);
        const entriesToInsert = batch.map(bill => ({
          user_id: user.id,
          entry_number: `BILL-${bill.id.substring(0, 8)}`,
          entry_date: bill.bill_date,
          description: `Bill ${bill.bill_number}`,
          reference: `BILL:${bill.id}`,
        }));

        const { data: insertedEntries } = await supabase
          .from("journal_entries")
          .insert(entriesToInsert)
          .select("id, reference");

        if (!insertedEntries) continue;

        const lines: any[] = [];
        const apAccountId = accountMap["2000"]; // Accounts Payable
        const cashAccountId2 = accountMap["1000"]; // Cash

        for (const entry of insertedEntries) {
          const bill = batch.find(b => `BILL:${b.id}` === entry.reference);
          if (!bill) continue;
          const expAccountNum = categoryToAccountNumber(bill.category || "", false);
          const expAccountId = accountMap[expAccountNum];
          if (!expAccountId) continue;
          const amount = Math.abs(bill.total_amount);

          if (bill.status === "paid") {
            // Paid bill: Dr Expense / Cr Cash
            if (!cashAccountId2) continue;
            lines.push({ journal_entry_id: entry.id, account_id: expAccountId, debit_amount: amount, credit_amount: 0 });
            lines.push({ journal_entry_id: entry.id, account_id: cashAccountId2, debit_amount: 0, credit_amount: amount });
          } else {
            // Unpaid bill: Dr Expense / Cr Accounts Payable (creates AP liability)
            if (!apAccountId) continue;
            lines.push({ journal_entry_id: entry.id, account_id: expAccountId, debit_amount: amount, credit_amount: 0 });
            lines.push({ journal_entry_id: entry.id, account_id: apAccountId, debit_amount: 0, credit_amount: amount });
          }
        }

        if (lines.length > 0) await supabase.from("journal_entry_lines").insert(lines);
        createdCount += insertedEntries.length;
      }

      setSyncProgress(100);
      setSyncStatus("Done!");

      // Invalidate all accounting queries
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });

      toast.success(`✅ Sync complete! Created ${createdCount} journal entries from your transactions, invoices, and bills.`);
    } catch (err: any) {
      toast.error(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
      setTimeout(() => { setSyncProgress(0); setSyncStatus(""); }, 3000);
    }
  };

  const filtered = accounts.filter((a: any) =>
    search === "" ||
    a.account_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_number.toLowerCase().includes(search.toLowerCase())
  );

  const grouped = filtered.reduce((acc: Record<string, any[]>, a: any) => {
    const type = a.account_type || "other";
    if (!acc[type]) acc[type] = [];
    acc[type].push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleLoadStandard} disabled={seeding || syncing}>
            <Download className="w-4 h-4 mr-2" />
            {seeding ? "Loading..." : "Load Standard Accounts"}
          </Button>
          <Button
            variant="default"
            onClick={handleSyncTransactions}
            disabled={syncing || seeding}
            className="bg-primary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync Transactions → Journals"}
          </Button>
          <Button onClick={() => { setEditingAccount(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />Add Account
          </Button>
        </div>
      </div>

      {/* Sync progress */}
      {syncing && (
        <Card>
          <CardContent className="pt-4 pb-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{syncStatus}</span>
              <span className="font-mono text-xs">{syncProgress}%</span>
            </div>
            <Progress value={syncProgress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {accounts.length === 0 && !isLoading ? (
        <Card><CardContent className="pt-6">
          <EmptyState
            icon={Calculator}
            title="No accounts yet"
            description='Click "Sync Transactions → Journals" to auto-populate accounts and journal entries from your uploaded data, or load standard accounts manually.'
            actionLabel="Load Standard Accounts"
            onAction={handleLoadStandard}
          />
        </CardContent></Card>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="pt-6 text-center text-muted-foreground py-12">
          No accounts match "{search}"
        </CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, accts]) => (
          <Card key={type}>
            <CardContent className="pt-6">
              <h3 className="font-semibold capitalize mb-4 flex items-center gap-2">
                <Badge className={typeColors[type] || ""}>{type}</Badge>
                <span className="text-muted-foreground text-sm">({(accts as any[]).length})</span>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(accts as any[]).map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.account_name}</TableCell>
                      <TableCell
                        className="text-right font-mono cursor-pointer hover:bg-muted/50 transition-colors rounded"
                        title="Click to see balance breakdown"
                        onClick={() => openReason(a)}
                      >
                        {a.computed_balance !== 0 ? (
                          <span className={a.computed_balance > 0 ? "text-green-600" : "text-red-600"}>
                            {a.computed_balance > 0 ? "+" : ""}{fmtBal(a.computed_balance)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{fmtBal(0)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setEditingAccount(a); setDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(a.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}

      <AccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
          queryClient.invalidateQueries({ queryKey: ["accounts-active"] });
        }}
      />
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Deactivate Account"
        description="This account will be marked inactive. It won't appear in lists but historical data is preserved."
        confirmLabel="Deactivate"
        onConfirm={handleDelete}
      />

      {/* Reason Sheet */}
      <Sheet open={reasonOpen} onOpenChange={setReasonOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Balance Breakdown</SheetTitle>
          </SheetHeader>
          {reasonAccount && (
            <div className="mt-4 space-y-4">
              {/* Account info */}
              <div className="flex items-center gap-2">
                <Badge className={typeColors[reasonAccount.account_type] || ""}>{reasonAccount.account_type}</Badge>
                <span className="font-semibold">{reasonAccount.account_name}</span>
                <span className="text-xs text-muted-foreground">#{reasonAccount.account_number}</span>
              </div>

              {/* Formula box */}
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Formula</p>
                <p className="font-mono text-sm">Balance = Total Debits − Total Credits</p>
                {!reasonLoading && (() => {
                  const totalDr = reasonLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
                  const totalCr = reasonLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
                  const bal = totalDr - totalCr;
                  return (
                    <div className="space-y-1 pt-1 border-t border-muted">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Debits</span>
                        <span className="font-mono text-green-600">+{fmtBal(totalDr)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Credits</span>
                        <span className="font-mono text-red-500">−{fmtBal(totalCr)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold border-t pt-1">
                        <span>Net Balance</span>
                        <span className={bal >= 0 ? "text-green-600" : "text-red-500"}>{fmtBal(bal)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Accounting rule */}
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-1">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Accounting Rule</p>
                <p className="text-sm">{getAccountRule(reasonAccount.account_type)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Normal balance side: <span className="font-semibold">{getNormalBalance(reasonAccount.account_type)}</span>
                </p>
              </div>

              {/* Journal entry lines */}
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                  Journal Entry Lines {!reasonLoading && `(${reasonLines.length})`}
                </p>
                {reasonLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
                  </div>
                ) : reasonLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No journal entries found for this account.</p>
                ) : (
                  <div className="space-y-0 divide-y rounded-md border overflow-hidden">
                    {reasonLines.slice(0, 50).map((line: any, i: number) => (
                      <div key={i} className="flex items-start justify-between px-3 py-2 text-sm hover:bg-muted/30">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {line.journal_entries?.entry_date
                              ? format(new Date(line.journal_entries.entry_date + "T00:00:00"), "MMM d, yyyy")
                              : ""} · {line.journal_entries?.entry_number}
                          </p>
                          <p className="truncate max-w-[220px]">{line.journal_entries?.description || "—"}</p>
                        </div>
                        <div className="text-right ml-3 shrink-0">
                          {(line.debit_amount || 0) > 0 && (
                            <p className="text-green-600 font-mono text-xs">Dr {fmtBal(line.debit_amount)}</p>
                          )}
                          {(line.credit_amount || 0) > 0 && (
                            <p className="text-red-500 font-mono text-xs">Cr {fmtBal(line.credit_amount)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                    {reasonLines.length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Showing 50 of {reasonLines.length} entries
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
