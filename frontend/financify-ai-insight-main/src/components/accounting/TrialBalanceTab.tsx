import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, CheckCircle, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { EnhancedDateRangePicker } from "@/components/shared/EnhancedDateRangePicker";
import { startOfYear, endOfYear, format } from "date-fns";

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

export function TrialBalanceTab() {
  const [dateFrom, setDateFrom] = useState<Date>(startOfYear(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfYear(new Date()));

  const { data: result = { accounts: [], hasAccounts: false }, isLoading } = useQuery({
    queryKey: ["trial-balance", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data: accts } = await supabase
        .from("accounts")
        .select("*")
        .eq("is_active", true)
        .order("account_type")
        .order("account_number");

      if (!accts || accts.length === 0) return { accounts: [], hasAccounts: false };

      const fromStr = format(dateFrom, "yyyy-MM-dd");
      const toStr = format(dateTo, "yyyy-MM-dd");

      // Fetch all journal entries in date range
      const { data: entries } = await supabase
        .from("journal_entries")
        .select("id")
        .gte("entry_date", fromStr)
        .lte("entry_date", toStr);

      const entryIds = (entries || []).map(e => e.id);
      let linesByAccount: Record<string, { debit: number; credit: number }> = {};

      if (entryIds.length > 0) {
        // Fetch in batches of 500 to avoid URL length limits
        for (let i = 0; i < entryIds.length; i += 500) {
          const batch = entryIds.slice(i, i + 500);
          const { data: lines } = await supabase
            .from("journal_entry_lines")
            .select("account_id, debit_amount, credit_amount")
            .in("journal_entry_id", batch);

          if (lines) {
            for (const line of lines) {
              if (!linesByAccount[line.account_id]) {
                linesByAccount[line.account_id] = { debit: 0, credit: 0 };
              }
              linesByAccount[line.account_id].debit += line.debit_amount || 0;
              linesByAccount[line.account_id].credit += line.credit_amount || 0;
            }
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
    rows.push(["Net Income", "", "", "", netIncome >= 0 ? netIncome.toFixed(2) : "0.00"]);
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
          <EmptyState
            icon={FileText}
            title="No accounts set up"
            description='Go to the Chart of Accounts tab and click "Sync Transactions → Journals" to auto-populate from your uploaded data.'
          />
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap">
              {isBalanced && hasActivity ? (
                <Badge className="bg-green-100 text-green-700 gap-1">
                  <CheckCircle className="w-3 h-3" />Balanced
                </Badge>
              ) : isBalanced && !hasActivity ? (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  No journal entries in period
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Out of balance by ${Math.abs(totalDebit - totalCredit).toFixed(2)}
                </Badge>
              )}
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
                    <TableHead className="w-24">Account #</TableHead>
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
                          <TableCell className="font-mono text-sm pl-6">{a.account_number}</TableCell>
                          <TableCell className="text-sm">{a.account_name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {a.computed_debit > 0 ? `$${a.computed_debit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {a.computed_credit > 0 ? `$${a.computed_credit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                        </TableRow>
                      )),
                      // Subtotal row
                      <TableRow key={`subtotal-${type}`} className="border-t bg-muted/20 font-medium">
                        <TableCell colSpan={2} className="text-right text-sm text-muted-foreground pl-6">
                          Subtotal {TYPE_LABELS[type]}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {sub.debit > 0 ? `$${sub.debit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {sub.credit > 0 ? `$${sub.credit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                      </TableRow>,
                    ];
                  })}

                  {/* Net Income row */}
                  {hasActivity && (
                    <TableRow className="border-t-2 bg-muted/10">
                      <TableCell colSpan={2} className="font-semibold text-sm">
                        Net Income (Revenue − Expenses)
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {netIncome < 0 ? `$${Math.abs(netIncome).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {netIncome >= 0 ? (
                          <span className="text-green-600">
                            ${netIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                      ${totalDebit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      ${totalCredit.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
