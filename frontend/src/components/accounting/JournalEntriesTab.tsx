import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { Plus, BookOpen, ChevronDown, ChevronRight, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

type FilterType = "manual" | "synced" | "all";

function isAutoSynced(e: any): boolean {
  const ref = e.reference || "";
  return ref.startsWith("TXN:") || ref.startsWith("INV:") || ref.startsWith("BILL:") || ref.startsWith("BANK-AUTO");
}

export function JournalEntriesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("manual");
  const { currency } = useCurrency();
  const fmt = (v: number) => formatAmount(v, currency);

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

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("accounts").select("id, account_name, account_number").eq("is_active", true).eq("user_id", user.id);
      return data || [];
    },
  });

  const accountMap = Object.fromEntries((accounts as any[]).map((a: any) => [a.id, a]));

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("entry_date", { ascending: false });

      if (!data || data.length === 0) return [];

      const ids = data.map(e => e.id);
      const { data: lines } = await supabase
        .from("journal_entry_lines")
        .select("*")
        .in("journal_entry_id", ids);

      return data.map(e => {
        const entryLines = (lines || []).filter(l => l.journal_entry_id === e.id);
        const totalDebit = entryLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
        const totalCredit = entryLines.reduce((s, l) => s + (l.credit_amount || 0), 0);
        return { ...e, totalDebit, totalCredit, lines: entryLines };
      });
    },
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("journal_entry_lines").delete().eq("journal_entry_id", deleteId);
    const { error } = await supabase.from("journal_entries").delete().eq("id", deleteId);
    if (error) toast.error("Failed to delete entry");
    else {
      toast.success("Journal entry deleted");
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    }
    setDeleteId(null);
  };

  const noAccounts = accounts.length === 0;
  const manualEntries = (entries as any[]).filter(e => !isAutoSynced(e));
  const syncedEntries = (entries as any[]).filter(e => isAutoSynced(e));
  const displayedEntries = filter === "manual" ? manualEntries
    : filter === "synced" ? syncedEntries
    : (entries as any[]);

  return (
    <div className="space-y-4">
      {noAccounts && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {!hasFiles
            ? <>No bank statement uploaded yet. Go to the <strong className="mx-1">Home</strong> page to upload one, then return here to set up accounts.</>
            : <>No accounts found. Go to <strong className="mx-1">Chart of Accounts</strong> and click <strong className="mx-1">Load Standard Accounts</strong> before creating journal entries.</>
          }
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Filter toggle */}
        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            size="sm"
            variant={filter === "manual" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setFilter("manual")}
          >
            Manual
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
              {manualEntries.length}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant={filter === "synced" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setFilter("synced")}
          >
            Auto-Synced
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
              {syncedEntries.length}
            </Badge>
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "ghost"}
            className="h-7 px-3 text-xs"
            onClick={() => setFilter("all")}
          >
            All
            <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
              {(entries as any[]).length}
            </Badge>
          </Button>
        </div>

        <Button onClick={() => setDialogOpen(true)} disabled={noAccounts}>
          <Plus className="w-4 h-4 mr-2" />New Journal Entry
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {displayedEntries.length === 0 && !isLoading ? (
            filter === "manual" ? (
              <EmptyState
                icon={BookOpen}
                title="No manual journal entries"
                description="Use the New Entry button to record a custom debit/credit entry."
                actionLabel="New Entry"
                onAction={() => !noAccounts && setDialogOpen(true)}
              />
            ) : filter === "synced" ? (
              <EmptyState
                icon={BookOpen}
                title="No auto-synced entries yet"
                description={
                  !hasFiles
                    ? "Upload a bank statement on the Home page first. Once uploaded and synced, journal entries will appear here automatically."
                    : 'Go to the Chart of Accounts tab and click "Sync Transactions → Journals" to generate entries from your uploaded data.'
                }
              />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No journal entries"
                description={
                  !hasFiles
                    ? "Upload a bank statement on the Home page first, then sync transactions from Chart of Accounts to populate entries here."
                    : "Record financial transactions manually, or sync from Chart of Accounts to auto-generate entries."
                }
                actionLabel={noAccounts ? undefined : "New Entry"}
                onAction={() => !noAccounts && setDialogOpen(true)}
              />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedEntries.map((e: any) => {
                  const isExpanded = expandedId === e.id;
                  const isBalanced = Math.abs(e.totalDebit - e.totalCredit) < 0.01;
                  return (
                    <>
                      <TableRow
                        key={e.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedId(isExpanded ? null : e.id)}
                      >
                        <TableCell>
                          {isExpanded
                            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{e.entry_number}</TableCell>
                        <TableCell>{format(new Date(e.entry_date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="font-medium">{e.description}</TableCell>
                        <TableCell className="text-muted-foreground">{e.reference || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.totalDebit || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(e.totalCredit || 0)}</TableCell>
                        <TableCell className="text-right">
                          {isBalanced ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1 text-xs">
                              <CheckCircle className="w-3 h-3" />Balanced
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs gap-1">
                              <AlertCircle className="w-3 h-3" />Unbalanced
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell onClick={(ev) => ev.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(e.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow key={`${e.id}-expanded`} className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={9} className="p-0">
                            <div className="px-6 py-3 space-y-1 border-l-2 border-primary/20 ml-8">
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-muted-foreground">
                                    <th className="text-left pb-1 font-medium w-[200px]">Account</th>
                                    <th className="text-left pb-1 font-medium">Description</th>
                                    <th className="text-right pb-1 font-medium w-[120px]">Debit</th>
                                    <th className="text-right pb-1 font-medium w-[120px]">Credit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(e.lines || []).map((line: any) => {
                                    const acct = accountMap[line.account_id];
                                    return (
                                      <tr key={line.id} className="border-t border-border/50">
                                        <td className="py-1 font-mono text-xs">
                                          {acct ? acct.account_name : line.account_id.slice(0, 8)}
                                        </td>
                                        <td className="py-1 text-muted-foreground">{line.description || "—"}</td>
                                        <td className="py-1 text-right font-mono">
                                          {(line.debit_amount || 0) > 0 ? fmt(line.debit_amount) : "—"}
                                        </td>
                                        <td className="py-1 text-right font-mono">
                                          {(line.credit_amount || 0) > 0 ? fmt(line.credit_amount) : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-border font-semibold text-xs">
                                    <td colSpan={2} className="pt-1 text-right text-muted-foreground">Totals</td>
                                    <td className="pt-1 text-right font-mono">{fmt(e.totalDebit)}</td>
                                    <td className="pt-1 text-right font-mono">{fmt(e.totalCredit)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
          queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
          queryClient.invalidateQueries({ queryKey: ["accounts"] });
        }}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Journal Entry"
        description="This will permanently delete this journal entry and all its line items. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleDelete}
      />
    </div>
  );
}
