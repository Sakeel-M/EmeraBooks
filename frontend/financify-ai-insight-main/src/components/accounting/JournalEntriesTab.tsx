import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { Plus, BookOpen, ChevronDown, ChevronRight, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";

export function JournalEntriesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name, account_number").eq("is_active", true);
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
    // Delete lines first, then entry
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

  return (
    <div className="space-y-4">
      {noAccounts && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertCircle className="w-4 h-4 shrink-0" />
          No accounts found. Go to <strong className="mx-1">Chart of Accounts</strong> and load standard accounts before creating journal entries.
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)} disabled={noAccounts}>
          <Plus className="w-4 h-4 mr-2" />New Journal Entry
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {entries.length === 0 && !isLoading ? (
            <EmptyState
              icon={BookOpen}
              title="No journal entries"
              description="Record financial transactions with balanced debits and credits."
              actionLabel="New Entry"
              onAction={() => !noAccounts && setDialogOpen(true)}
            />
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
                {(entries as any[]).map((e: any) => {
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
                        <TableCell className="text-right font-mono">${(e.totalDebit || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${(e.totalCredit || 0).toFixed(2)}</TableCell>
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
                                          {acct ? `${acct.account_number} ${acct.account_name}` : line.account_id.slice(0, 8)}
                                        </td>
                                        <td className="py-1 text-muted-foreground">{line.description || "—"}</td>
                                        <td className="py-1 text-right font-mono">
                                          {(line.debit_amount || 0) > 0 ? `$${line.debit_amount.toFixed(2)}` : "—"}
                                        </td>
                                        <td className="py-1 text-right font-mono">
                                          {(line.credit_amount || 0) > 0 ? `$${line.credit_amount.toFixed(2)}` : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-border font-semibold text-xs">
                                    <td colSpan={2} className="pt-1 text-right text-muted-foreground">Totals</td>
                                    <td className="pt-1 text-right font-mono">${e.totalDebit.toFixed(2)}</td>
                                    <td className="pt-1 text-right font-mono">${e.totalCredit.toFixed(2)}</td>
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
