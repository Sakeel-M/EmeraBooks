import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveClient } from "@/hooks/useActiveClient";
import { database } from "@/lib/database";
import { toast } from "sonner";
import { format } from "date-fns";
import { FC } from "@/components/shared/FormattedCurrency";

export interface JournalLineDraft {
  id: string;
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an entry to edit; omit to create a new one. */
  entry?: any;
  onSaved?: () => void;
}

function newLine(): JournalLineDraft {
  return { id: crypto.randomUUID(), account_id: "", debit: 0, credit: 0, description: "" };
}

export function JournalEntryDialog({ open, onOpenChange, entry, onSaved }: Props) {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const [entryDate, setEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<JournalLineDraft[]>([newLine(), newLine()]);
  const [saving, setSaving] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["coa-accounts", clientId],
    queryFn: () => database.getAccounts(clientId!),
    enabled: !!clientId && open,
  });

  // Hydrate when editing
  useEffect(() => {
    if (!open) return;
    if (entry) {
      setEntryDate(entry.entry_date || format(new Date(), "yyyy-MM-dd"));
      setDescription(entry.description || "");
      setReference(entry.reference || "");
      const hydrated: JournalLineDraft[] = (entry.lines || []).map((l: any) => ({
        id: crypto.randomUUID(),
        account_id: l.account_id,
        debit: Number(l.debit || 0),
        credit: Number(l.credit || 0),
        description: l.description || "",
      }));
      setLines(hydrated.length >= 2 ? hydrated : [newLine(), newLine()]);
    } else {
      setEntryDate(format(new Date(), "yyyy-MM-dd"));
      setDescription("");
      setReference("");
      setLines([newLine(), newLine()]);
    }
  }, [entry, open]);

  const totalDebit = useMemo(() => lines.reduce((s, l) => s + (Number(l.debit) || 0), 0), [lines]);
  const totalCredit = useMemo(() => lines.reduce((s, l) => s + (Number(l.credit) || 0), 0), [lines]);
  const isBalanced = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005;
  const allLinesValid = lines.every(
    (l) => l.account_id && ((l.debit > 0 && l.credit === 0) || (l.credit > 0 && l.debit === 0)),
  );
  const canSave = isBalanced && allLinesValid && lines.length >= 2;

  const updateLine = (id: string, patch: Partial<JournalLineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) return;
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const handleSave = async () => {
    if (!clientId || !canSave) return;
    setSaving(true);
    try {
      const payload = {
        entry_date: entryDate,
        description,
        reference: reference || undefined,
        lines: lines.map((l, idx) => ({
          account_id: l.account_id,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          description: l.description || undefined,
          line_order: idx,
        })),
      };
      if (entry?.id) {
        await database.updateJournalEntry(entry.id, payload);
        toast.success("Journal entry updated");
      } else {
        await database.createJournalEntry(clientId, payload);
        toast.success("Journal entry posted");
      }
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-txns"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle>
          <DialogDescription>
            Record a balanced double-entry. Total debits must equal total credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. INV-2026-001"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this entry for?"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Lines</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs"
                onClick={() => setLines([...lines, newLine()])}
              >
                <Plus className="h-3 w-3" /> Add line
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[35%]">Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-[40px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <Select
                        value={l.account_id || undefined}
                        onValueChange={(v) => updateLine(l.id, { account_id: v })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Select account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map((a: any) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.code ? `${a.code} · ` : ""}
                              {a.name}
                              <span className="text-muted-foreground ml-1">({a.type})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-xs text-right"
                        value={l.debit || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          updateLine(l.id, { debit: v, credit: v > 0 ? 0 : l.credit });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="h-8 text-xs text-right"
                        value={l.credit || ""}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          updateLine(l.id, { credit: v, debit: v > 0 ? 0 : l.debit });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="h-8 text-xs"
                        placeholder="(optional)"
                        value={l.description || ""}
                        onChange={(e) => updateLine(l.id, { description: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={lines.length <= 2}
                        onClick={() => removeLine(l.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40 font-semibold">
                  <TableCell className="text-right">Totals</TableCell>
                  <TableCell className="text-right"><FC amount={totalDebit} currency={currency} /></TableCell>
                  <TableCell className="text-right"><FC amount={totalCredit} currency={currency} /></TableCell>
                  <TableCell colSpan={2}>
                    {isBalanced ? (
                      <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-500 text-xs">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Difference <FC amount={Math.abs(totalDebit - totalCredit)} currency={currency} />
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              {entry ? "Save Changes" : "Post Entry"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
