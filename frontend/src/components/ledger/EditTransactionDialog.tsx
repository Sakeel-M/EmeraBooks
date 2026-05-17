import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { flaskApi } from "@/lib/flaskApi";
import { PREDEFINED_SECTORS } from "@/lib/predefinedSectors";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: any;
  onSaved?: () => void;
}

export function EditTransactionDialog({ open, onOpenChange, transaction, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(0);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: customCategories = [] } = useQuery({
    queryKey: ["custom-categories"],
    queryFn: () => flaskApi.get<any[]>("/categories"),
    enabled: open,
  });

  useEffect(() => {
    if (!open || !transaction) return;
    setAmount(Number(transaction.amount || 0));
    setCategory(transaction.category || "");
    setDescription(transaction.description || "");
  }, [transaction, open]);

  const allCategories: string[] = (() => {
    const predefined = PREDEFINED_SECTORS.map((s: any) => s.name);
    const custom = customCategories.map((c: any) => c.name);
    return [...new Set([...predefined, ...custom])].sort();
  })();

  const handleSave = async () => {
    if (!transaction?.id) return;
    setSaving(true);
    try {
      await flaskApi.patch(`/transactions/${transaction.id}`, {
        amount,
        category,
        description,
      });
      queryClient.invalidateQueries({ queryKey: ["cash-ledger-txns"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-txns"] });
      queryClient.invalidateQueries({ queryKey: ["revenue-txns"] });
      queryClient.invalidateQueries({ queryKey: ["rev-txns-pay"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      toast.success("Transaction updated");
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
          <DialogDescription>
            Changes update the underlying bank transaction. Positive = inflow, negative = outflow.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input value={transaction?.transaction_date || ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Amount (signed)</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a category..." />
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
