import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface LineItem {
  account_id: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
}

export function JournalEntryDialog({ open, onOpenChange, onSaved }: Props) {
  const [entryNumber, setEntryNumber] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineItem[]>([
    { account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
    { account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-active"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("id, account_name, account_number, account_type").eq("is_active", true).order("account_number");
      return data || [];
    },
  });

  useEffect(() => {
    if (open) {
      setEntryNumber(`JE-${Date.now().toString().slice(-6)}`);
      setEntryDate(new Date().toISOString().split("T")[0]);
      setDescription("");
      setReference("");
      setLines([
        { account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
        { account_id: "", description: "", debit_amount: 0, credit_amount: 0 },
      ]);
    }
  }, [open]);

  const totalDebit = lines.reduce((s, l) => s + l.debit_amount, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit_amount, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const updateLine = (idx: number, field: keyof LineItem, value: any) => {
    const updated = [...lines];
    (updated[idx] as any)[field] = value;
    setLines(updated);
  };

  const addLine = () => setLines([...lines, { account_id: "", description: "", debit_amount: 0, credit_amount: 0 }]);
  const removeLine = (idx: number) => { if (lines.length > 2) setLines(lines.filter((_, i) => i !== idx)); };

  const handleSubmit = async () => {
    if (!isBalanced) { toast.error("Debits must equal credits"); return; }
    if (!description || !entryDate) { toast.error("Fill in all required fields"); return; }
    if (lines.some(l => !l.account_id)) { toast.error("Select an account for each line"); return; }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: entry, error } = await supabase.from("journal_entries").insert({
      user_id: user.id, entry_number: entryNumber, entry_date: entryDate, description, reference: reference || null,
    }).select().single();

    if (error) { toast.error("Failed to create entry"); setIsSubmitting(false); return; }

    const lineData = lines.map(l => ({
      journal_entry_id: entry.id,
      account_id: l.account_id,
      description: l.description || null,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
    }));

    const { error: lineError } = await supabase.from("journal_entry_lines").insert(lineData);
    if (lineError) { toast.error("Failed to save line items"); setIsSubmitting(false); return; }

    toast.success("Journal entry created");
    onSaved();
    onOpenChange(false);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Journal Entry</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Entry #</Label><Input value={entryNumber} onChange={e => setEntryNumber(e.target.value)} /></div>
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Description *</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this entry" /></div>
          <div className="space-y-2"><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Optional reference" /></div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Add Line</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[120px]">Debit</TableHead>
                  <TableHead className="w-[120px]">Credit</TableHead>
                  <TableHead className="w-[40px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Select value={line.account_id} onValueChange={v => updateLine(idx, "account_id", v)}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.account_number} — {a.account_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input value={line.description} onChange={e => updateLine(idx, "description", e.target.value)} placeholder="Line desc" /></TableCell>
                    <TableCell><Input type="number" min="0" step="0.01" value={line.debit_amount || ""} onChange={e => updateLine(idx, "debit_amount", parseFloat(e.target.value) || 0)} /></TableCell>
                    <TableCell><Input type="number" min="0" step="0.01" value={line.credit_amount || ""} onChange={e => updateLine(idx, "credit_amount", parseFloat(e.target.value) || 0)} /></TableCell>
                    <TableCell><Button variant="ghost" size="icon" onClick={() => removeLine(idx)} disabled={lines.length <= 2}><Trash2 className="w-3 h-3" /></Button></TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell colSpan={2} className="text-right">Totals</TableCell>
                  <TableCell>${totalDebit.toFixed(2)}</TableCell>
                  <TableCell>${totalCredit.toFixed(2)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
            {!isBalanced && totalDebit > 0 && (
              <div className="flex items-center gap-2 text-destructive text-sm"><AlertCircle className="w-4 h-4" />Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})</div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!isBalanced || isSubmitting}>{isSubmitting ? "Saving..." : "Create Entry"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
