import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/EmptyState";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { Plus, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

export function JournalEntriesTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false });

      if (!data || data.length === 0) return [];

      // Fetch lines for totals
      const ids = data.map(e => e.id);
      const { data: lines } = await supabase.from("journal_entry_lines").select("journal_entry_id, debit_amount, credit_amount").in("journal_entry_id", ids);

      return data.map(e => {
        const entryLines = (lines || []).filter(l => l.journal_entry_id === e.id);
        const totalDebit = entryLines.reduce((s, l) => s + (l.debit_amount || 0), 0);
        return { ...e, totalDebit, lineCount: entryLines.length };
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />New Journal Entry
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {entries.length === 0 && !isLoading ? (
            <EmptyState icon={BookOpen} title="No journal entries" description="Record financial transactions with balanced debits and credits." actionLabel="New Entry" onAction={() => setDialogOpen(true)} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Total Debits</TableHead>
                  <TableHead className="text-right">Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono">{e.entry_number}</TableCell>
                    <TableCell>{format(new Date(e.entry_date), "MMM d, yyyy")}</TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.reference || "—"}</TableCell>
                    <TableCell className="text-right">${(e.totalDebit || 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{e.lineCount || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JournalEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} onSaved={() => queryClient.invalidateQueries({ queryKey: ["journal-entries"] })} />
    </div>
  );
}
