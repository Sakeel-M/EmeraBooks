import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FileText, CheckCircle, AlertTriangle, Download, Info, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { startOfYear, endOfYear, format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { fetchAllRows } from "@/lib/fetchAllRows";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

const TYPE_ORDER = ["asset", "liability", "equity", "revenue", "expense"];
const TYPE_LABELS: Record<string, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  revenue: "Revenue",
  expense: "Expenses",
};
const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-yellow-100 text-yellow-700",
};

function getAccountRule(type: string): string {
  if (type === "asset") return "Assets have a normal Debit balance. Debits increase assets (e.g., cash in); Credits decrease assets (e.g., cash paid out).";
  if (type === "expense") return "Expenses have a normal Debit balance. Debits record costs incurred; Credits reverse/reduce expenses.";
  if (type === "liability") return "Liabilities have a normal Credit balance. Credits increase what you owe; Debits reduce liabilities (e.g., repayments).";
  if (type === "equity") return "Equity has a normal Credit balance. Credits increase owner equity; Debits decrease it (e.g., drawings).";
  if (type === "revenue") return "Revenue has a normal Credit balance. Credits record income earned; Debits are reversals or refunds.";
  return "Balance = Total Debits − Total Credits from journal entries in this period.";
}

export function TrialBalanceTab() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfYear(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfYear(new Date()));
  const { currency } = useCurrency();

  // Reason sheet state
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonAccount, setReasonAccount] = useState<any>(null);
  const [reasonSide, setReasonSide] = useState<"debit" | "credit" | "net">("debit");
  const [reasonLines, setReasonLines] = useState<any[]>([]);
  const [reasonLoading, setReasonLoading] = useState(false);

  const openReason = async (account: any, side: "debit" | "credit" | "net") => {
    setReasonAccount(account);
    setReasonSide(side);
    setReasonLines([]);
    setReasonOpen(true);
    setReasonLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setReasonLoading(false); return; }
      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");

      // Fetch journal entry IDs in the selected date range
      const entries = await fetchAllRows(
        supabase
          .from("journal_entries")
          .select("id, entry_date, description, entry_number")
          .eq("user_id", user.id)
          .gte("entry_date", fromStr)
          .lte("entry_date", toStr)
      );
      const entryIds = entries.map((e: any) => e.id);
      const entryMap = new Map(entries.map((e: any) => [e.id, e]));

      if (entryIds.length === 0) { setReasonLines([]); setReasonLoading(false); return; }

      // Fetch lines for this account within those entries
      const lines: any[] = [];
      for (let i = 0; i < entryIds.length; i += 200) {
        const batch = entryIds.slice(i, i + 200);
        const { data } = await supabase
          .from("journal_entry_lines")
          .select("debit_amount, credit_amount, journal_entry_id")
          .eq("account_id", account.id)
          .in("journal_entry_id", batch);
        if (data) {
          lines.push(...data.map((l: any) => ({ ...l, entry: entryMap.get(l.journal_entry_id) })));
        }
      }
      // Sort by date desc
      lines.sort((a, b) => (b.entry?.entry_date || "").localeCompare(a.entry?.entry_date || ""));
      setReasonLines(lines);
    } catch {
      setReasonLines([]);
    }
    setReasonLoading(false);
  };

  const { data: hasFiles = false } = useQuery({
    queryKey: ["has-uploaded-files"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { count } = await supabase
        .from("uploaded_files")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      return (count || 0) > 0;
    },
  });

  const { data: result = { accounts: [], hasAccounts: false }, isLoading } = useQuery({
    queryKey: ["trial-balance", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { accounts: [], hasAccounts: false };
      const { data: accts } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .eq("user_id", user.id)
        .order("account_type")
        .order("account_number");

      if (!accts || accts.length === 0) return { accounts: [], hasAccounts: false };

      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");

      // Fetch all journal entries in date range (paginated to bypass 1000-row limit)
      const entries = await fetchAllRows(
        supabase
          .from("journal_entries")
          .select("id")
          .eq("user_id", user.id)
          .gte("entry_date", fromStr)
          .lte("entry_date", toStr)
      );

      const entryIds = entries.map((e: any) => e.id);
      let linesByAccount: Record<string, { debit: number; credit: number }> = {};

      if (entryIds.length > 0) {
        // Fetch in batches of 200 entry IDs, each batch paginated
        for (let i = 0; i < entryIds.length; i += 200) {
          const batch = entryIds.slice(i, i + 200);
          const lines = await fetchAllRows(
            supabase
              .from("journal_entry_lines")
              .select("account_id, debit_amount, credit_amount")
              .in("journal_entry_id", batch)
          );

          for (const line of lines as any[]) {
            if (!linesByAccount[line.account_id]) {
              linesByAccount[line.account_id] = { debit: 0, credit: 0 };
            }
            linesByAccount[line.account_id].debit += line.debit_amount || 0;
            linesByAccount[line.account_id].credit += line.credit_amount || 0;
          }
        }
      }

      const accounts = accts.map((a: any) => {
        const entry = linesByAccount[a.id] || { debit: 0, credit: 0 };
        return {
          ...a,
          computed_debit: entry.debit,
          computed_credit: entry.credit,
        };
      });

      return { accounts, hasAccounts: true };
    },
  });

  const { accounts, hasAccounts } = result;

  // Group accounts by type in defined order
  const grouped: Record<string, any[]> = {};
  for (const type of TYPE_ORDER) grouped[type] = [];
  for (const acc of accounts as any[]) {
    const t = acc.account_type;
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(acc);
  }

  // Compute subtotals per group
  const subtotals: Record<string, { debit: number; credit: number }> = {};
  for (const type of TYPE_ORDER) {
    const grp = grouped[type] || [];
    subtotals[type] = {
      debit: grp.reduce((s, a) => s + (a.computed_debit || 0), 0),
      credit: grp.reduce((s, a) => s + (a.computed_credit || 0), 0),
    };
  }

  const totalDebit = (accounts as any[]).reduce((s, a) => s + (a.computed_debit || 0), 0);
  const totalCredit = (accounts as any[]).reduce((s, a) => s + (a.computed_credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasActivity = totalDebit > 0 || totalCredit > 0;

  // Net Income = Revenue Credits - Revenue Debits - (Expense Debits - Expense Credits)
  const revenueNet = subtotals.revenue.credit - subtotals.revenue.debit;
  const expenseNet = subtotals.expense.debit - subtotals.expense.credit;
  const netIncome = revenueNet - expenseNet;

  const handleDateChange = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const handleExportCSV = () => {
    const rows: string[][] = [
      ["Account #", "Account Name", "Type", "Debit", "Credit"],
    ];

    for (const type of TYPE_ORDER) {
      const grp = grouped[type] || [];
      if (grp.length === 0) continue;
      rows.push([`--- ${TYPE_LABELS[type]} ---`, "", "", "", ""]);
      for (const a of grp) {
        rows.push([
          a.account_number,
          a.account_name,
          a.account_type,
          a.computed_debit > 0 ? a.computed_debit.toFixed(2) : "0.00",
          a.computed_credit > 0 ? a.computed_credit.toFixed(2) : "0.00",
        ]);
      }
      rows.push([
        `Subtotal ${TYPE_LABELS[type]}`, "", "",
        subtotals[type].debit.toFixed(2),
        subtotals[type].credit.toFixed(2),
      ]);
      rows.push(["", "", "", "", ""]);
    }
    // Net Income: positive → Credit column; negative (loss) → Debit column
    rows.push([
      "Net Income",
      "",
      "",
      netIncome < 0 ? Math.abs(netIncome).toFixed(2) : "0.00",
      netIncome >= 0 ? netIncome.toFixed(2) : "0.00",
    ]);
    rows.push(["TOTAL", "", "", totalDebit.toFixed(2), totalCredit.toFixed(2)]);

    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trial-balance-${format(dateFrom, "yyyy-MM-dd")}-to-${format(dateTo, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
          <EnhancedDateRangePicker
            onRangeChange={handleDateChange}
            defaultRange={{ from: dateFrom, to: dateTo }}
          />
          {hasAccounts && (
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />Export CSV
            </Button>
          )}
        </div>

        {!hasAccounts && !isLoading ? (
          !hasFiles ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-base">No bank statement uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Go to the <strong>Home</strong> page and upload a bank statement first. Once uploaded and synced, your accounts will appear here automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-base">No chart of accounts set up</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Go to the <strong>Chart of Accounts</strong> tab, click <strong>Load Standard Accounts</strong>, then click <strong>Sync Transactions → Journals</strong> to populate the trial balance.
                </p>
              </div>
            </div>
          )
        ) : hasAccounts && !hasActivity && !isLoading ? (
          !hasFiles ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Upload className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-base">No bank statement uploaded yet</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Go to the <strong>Home</strong> page and upload a bank statement. Once uploaded and synced, your trial balance will populate automatically.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-base">No journal entries for this period</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Your bank statement is uploaded but no journal entries have been synced yet. Go to the <strong>Chart of Accounts</strong> tab and click <strong>Sync Transactions → Journals</strong>.
                </p>
              </div>
            </div>
          )
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {isBalanced && hasActivity ? (
                <Badge className="bg-green-100 text-green-700 gap-1">
                  <CheckCircle className="w-3 h-3" />Balanced
                </Badge>
              ) : !isBalanced ? (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Out of balance by <FormattedCurrency amount={Math.abs(totalDebit - totalCredit)} currency={currency} />
                </Badge>
              ) : null}
              {hasActivity && (
                <span className="text-sm text-muted-foreground">
                  {format(dateFrom, "MMM d, yyyy")} – {format(dateTo, "MMM d, yyyy")}
                </span>
              )}
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-36">Debit</TableHead>
                    <TableHead className="text-right w-36">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TYPE_ORDER.map((type) => {
                    const grp = grouped[type] || [];
                    if (grp.length === 0) return null;
                    const sub = subtotals[type];
                    return [
                      // Group header
                      <TableRow key={`header-${type}`} className="bg-muted/30">
                        <TableCell colSpan={4} className="py-2">
                          <Badge className={typeColors[type] || ""}>
                            {TYPE_LABELS[type]}
                          </Badge>
                        </TableCell>
                      </TableRow>,
                      // Account rows
                      ...grp.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm pl-6">{a.account_name}</TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm ${a.computed_debit > 0 ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                            title={a.computed_debit > 0 ? "Click to see debit breakdown" : undefined}
                            onClick={() => a.computed_debit > 0 && openReason(a, "debit")}
                          >
                            {a.computed_debit > 0 ? <FormattedCurrency amount={a.computed_debit} currency={currency} /> : "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-mono text-sm ${a.computed_credit > 0 ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                            title={a.computed_credit > 0 ? "Click to see credit breakdown" : undefined}
                            onClick={() => a.computed_credit > 0 && openReason(a, "credit")}
                          >
                            {a.computed_credit > 0 ? <FormattedCurrency amount={a.computed_credit} currency={currency} /> : "—"}
                          </TableCell>
                        </TableRow>
                      )),
                      // Subtotal row
                      <TableRow key={`subtotal-${type}`} className="border-t bg-muted/20 font-medium">
                        <TableCell colSpan={2} className="text-right text-sm text-muted-foreground pl-6">
                          Subtotal {TYPE_LABELS[type]}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {sub.debit > 0 ? <FormattedCurrency amount={sub.debit} currency={currency} /> : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {sub.credit > 0 ? <FormattedCurrency amount={sub.credit} currency={currency} /> : "—"}
                        </TableCell>
                      </TableRow>,
                    ];
                  })}

                  {/* Net Income row */}
                  {hasActivity && (
                    <TableRow
                      className="border-t-2 bg-muted/10 cursor-pointer hover:bg-muted/30 transition-colors"
                      title="Click to see net income explanation"
                      onClick={() => openReason({ account_name: "Net Income", account_type: "equity", account_number: "—", id: "__net__", computed_debit: netIncome < 0 ? Math.abs(netIncome) : 0, computed_credit: netIncome >= 0 ? netIncome : 0 }, "net")}
                    >
                      <TableCell colSpan={2} className="font-semibold text-sm">
                        Net Income (Revenue − Expenses)
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {netIncome < 0 ? <FormattedCurrency amount={Math.abs(netIncome)} currency={currency} /> : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {netIncome >= 0 ? (
                          <span className="text-green-600">
                            <FormattedCurrency amount={netIncome} currency={currency} />
                          </span>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Grand Total */}
                  <TableRow className="border-t-2 font-bold bg-muted/30">
                    <TableCell colSpan={2} className="text-right text-sm uppercase tracking-wide">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <FormattedCurrency amount={totalDebit} currency={currency} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <FormattedCurrency amount={totalCredit} currency={currency} />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>

    {/* Reason Sheet */}
    <Sheet open={reasonOpen} onOpenChange={setReasonOpen}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {reasonSide === "net" ? "Net Income Explanation" : `${reasonSide === "debit" ? "Debit" : "Credit"} Breakdown`}
          </SheetTitle>
        </SheetHeader>

        {reasonAccount && (
          <div className="mt-4 space-y-4">
            {/* Account info */}
            <div className="flex items-center gap-2">
              <Badge className={typeColors[reasonAccount.account_type] || ""}>{reasonAccount.account_type}</Badge>
              <span className="font-semibold">{reasonAccount.account_name}</span>
              <span className="text-xs text-muted-foreground">#{reasonAccount.account_number}</span>
            </div>

            {/* Formula / explanation */}
            {reasonSide === "net" ? (
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Formula</p>
                <p className="font-mono text-sm">Net Income = Revenue Credits − Revenue Debits − (Expense Debits − Expense Credits)</p>
                <div className="space-y-1 pt-2 border-t border-muted text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue (net credits)</span>
                    <span className="font-mono"><FormattedCurrency amount={subtotals.revenue.credit - subtotals.revenue.debit} currency={currency} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expenses (net debits)</span>
                    <span className="font-mono text-red-500">−<FormattedCurrency amount={subtotals.expense.debit - subtotals.expense.credit} currency={currency} /></span>
                  </div>
                  <div className="flex justify-between font-bold border-t pt-1">
                    <span>Net Income</span>
                    <span className={netIncome >= 0 ? "text-green-600" : "text-red-500"}><FormattedCurrency amount={netIncome} currency={currency} /></span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  {netIncome >= 0
                    ? "Profit — your revenue exceeds your expenses for this period."
                    : "Loss — your expenses exceed your revenue for this period."}
                </p>
              </div>
            ) : (
              <div className="bg-muted/40 rounded-lg p-4 space-y-2">
                <p className="text-xs uppercase font-semibold text-muted-foreground">
                  {reasonSide === "debit" ? "Debit Total" : "Credit Total"} for this period
                </p>
                <p className="text-2xl font-bold font-mono">
                  <FormattedCurrency amount={reasonSide === "debit" ? reasonAccount.computed_debit : reasonAccount.computed_credit} currency={currency} />
                </p>
                <p className="text-sm text-muted-foreground">
                  Sum of all {reasonSide === "debit" ? "debit" : "credit"} amounts posted to <strong>{reasonAccount.account_name}</strong> in journal entries from{" "}
                  {format(dateFrom, "MMM d, yyyy")} to {format(dateTo, "MMM d, yyyy")}.
                </p>
              </div>
            )}

            {/* Accounting rule (skip for net income) */}
            {reasonSide !== "net" && (
              <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4 space-y-1">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Accounting Rule</p>
                <p className="text-sm">{getAccountRule(reasonAccount.account_type)}</p>
              </div>
            )}

            {/* Journal entry lines (skip for net income virtual row) */}
            {reasonSide !== "net" && reasonAccount.id !== "__net__" && (
              <div>
                <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">
                  Contributing Journal Entry Lines {!reasonLoading && `(${reasonLines.length})`}
                </p>
                {reasonLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin w-5 h-5 text-muted-foreground" />
                  </div>
                ) : reasonLines.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No journal entries found for this account in the selected period.</p>
                ) : (
                  <div className="space-y-0 divide-y rounded-md border overflow-hidden">
                    {reasonLines
                      .filter((l: any) => reasonSide === "debit" ? (l.debit_amount || 0) > 0 : (l.credit_amount || 0) > 0)
                      .slice(0, 50)
                      .map((line: any, i: number) => (
                        <div key={i} className="flex items-start justify-between px-3 py-2 text-sm hover:bg-muted/30">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">
                              {line.entry?.entry_date
                                ? format(new Date(line.entry.entry_date + "T00:00:00"), "MMM d, yyyy")
                                : ""} · {line.entry?.entry_number}
                            </p>
                            <p className="truncate max-w-[220px]">{line.entry?.description || "—"}</p>
                          </div>
                          <div className="text-right ml-3 shrink-0">
                            {reasonSide === "debit" && (
                              <p className="text-green-600 font-mono text-xs font-semibold">Dr <FormattedCurrency amount={line.debit_amount} currency={currency} /></p>
                            )}
                            {reasonSide === "credit" && (
                              <p className="text-red-500 font-mono text-xs font-semibold">Cr <FormattedCurrency amount={line.credit_amount} currency={currency} /></p>
                            )}
                          </div>
                        </div>
                      ))}
                    {reasonLines.filter((l: any) => reasonSide === "debit" ? (l.debit_amount || 0) > 0 : (l.credit_amount || 0) > 0).length > 50 && (
                      <p className="text-xs text-muted-foreground text-center py-2">Showing top 50 entries</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
    </>
  );
}
