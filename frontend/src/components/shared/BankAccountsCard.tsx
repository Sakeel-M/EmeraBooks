import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Landmark, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { database } from "@/lib/database";
import { toast } from "sonner";

const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR"];

interface FormState {
  bank_name: string;
  account_name: string;
  account_number: string;
  iban: string;
  swift_code: string;
  branch: string;
  currency: string;
}

const blank = (): FormState => ({
  bank_name: "", account_name: "", account_number: "",
  iban: "", swift_code: "", branch: "", currency: "AED",
});

interface Props {
  clientId: string | null | undefined;
}

export function BankAccountsCard({ clientId }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [saving, setSaving] = useState(false);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const openNew = () => {
    setEditingId(null);
    setForm(blank());
    setOpen(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      bank_name: a.bank_name || "",
      account_name: a.account_name || "",
      account_number: a.account_number || "",
      iban: a.iban || "",
      swift_code: a.swift_code || "",
      branch: a.branch || "",
      currency: a.currency || "AED",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!clientId) return;
    if (!form.bank_name.trim() || !form.account_name.trim()) {
      toast.error("Bank name and Account name are required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await database.updateBankAccount(editingId, {
          bank_name: form.bank_name.trim(),
          account_name: form.account_name.trim(),
          account_number: form.account_number.trim() || undefined,
          iban: form.iban.trim() || undefined,
          swift_code: form.swift_code.trim() || undefined,
          branch: form.branch.trim() || undefined,
          currency: form.currency,
        });
        toast.success("Bank account updated");
      } else {
        await database.createBankAccount(clientId, {
          bank_name: form.bank_name.trim(),
          account_name: form.account_name.trim(),
          account_number: form.account_number.trim() || undefined,
          iban: form.iban.trim() || undefined,
          swift_code: form.swift_code.trim() || undefined,
          branch: form.branch.trim() || undefined,
          currency: form.currency,
        });
        toast.success("Bank account added");
      }
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", clientId] });
      // Also invalidate any list of bank accounts used elsewhere (e.g. invoice form).
      queryClient.invalidateQueries({ queryKey: ["invoice-bank-accounts"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save bank account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: any) => {
    if (!window.confirm(`Delete bank account "${a.bank_name} — ${a.account_name}"?`)) return;
    try {
      await database.deleteBankAccount(a.id);
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", clientId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-bank-accounts"] });
      toast.success("Bank account deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Bank Accounts
          </CardTitle>
          <Button size="sm" onClick={openNew} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Bank Account
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Bank details shown on invoices and used to receive customer payments. Add multiple if you bank in different currencies.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg">
            <Landmark className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No bank accounts yet.</p>
            <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Add your first bank account
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a: any) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm truncate">{a.bank_name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {a.currency}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {a.account_name}{a.branch ? ` — ${a.branch}` : ""}
                  </p>
                  <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                    {a.account_number && <p>Account #: <span className="font-mono">{a.account_number}</span></p>}
                    {a.iban && <p>IBAN: <span className="font-mono">{a.iban}</span></p>}
                    {a.swift_code && <p>SWIFT: <span className="font-mono">{a.swift_code}</span></p>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => handleDelete(a)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
              <DialogDescription>
                These details will appear on invoices so customers can pay you.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bank Name *</Label>
                  <Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} placeholder="e.g. Emirates NBD" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Account Name *</Label>
                <Input value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} placeholder="Account holder / company name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Number</Label>
                  <Input value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="123456789" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Branch (optional)</Label>
                  <Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="e.g. Dubai Main Branch" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">IBAN</Label>
                  <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} placeholder="AE07 0331 2345 6789 0123 456" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SWIFT / BIC</Label>
                  <Input value={form.swift_code} onChange={(e) => setForm({ ...form, swift_code: e.target.value })} placeholder="EBILAEAD" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  {editingId ? "Save Changes" : "Add Bank Account"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
