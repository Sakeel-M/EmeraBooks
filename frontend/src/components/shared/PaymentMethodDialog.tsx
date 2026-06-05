import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Landmark, Banknote, CreditCard, Loader2 } from "lucide-react";

export type PaymentMethod = "bank_transfer" | "cash" | "card";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the selected method when the user confirms. Async errors
   *  surface via the parent's toast; the dialog re-enables on resolution. */
  onConfirm: (method: PaymentMethod) => void | Promise<void>;
  title?: string;
  description?: string;
}

const OPTIONS: { key: PaymentMethod; label: string; icon: typeof Landmark; tint: string }[] = [
  { key: "bank_transfer", label: "Bank Transfer", icon: Landmark, tint: "text-blue-600" },
  { key: "cash",          label: "Cash",          icon: Banknote,  tint: "text-emerald-600" },
  { key: "card",          label: "Card Payment",  icon: CreditCard, tint: "text-violet-600" },
];

export function PaymentMethodDialog({
  open, onOpenChange, onConfirm,
  title = "Mark as Paid — How was it paid?",
  description = "Pick the payment method so the receipt records it correctly.",
}: Props) {
  const [busy, setBusy] = useState<PaymentMethod | null>(null);

  useEffect(() => {
    if (!open) setBusy(null);
  }, [open]);

  const handlePick = async (method: PaymentMethod) => {
    setBusy(method);
    try {
      await onConfirm(method);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!busy) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 pt-2">
          {OPTIONS.map(({ key, label, icon: Icon, tint }) => (
            <Button
              key={key}
              variant="outline"
              className="justify-start gap-3 h-12"
              onClick={() => handlePick(key)}
              disabled={!!busy}
            >
              {busy === key ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className={`h-5 w-5 ${tint}`} />}
              <span className="text-sm font-medium">{label}</span>
            </Button>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="mt-1"
            onClick={() => onOpenChange(false)}
            disabled={!!busy}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
