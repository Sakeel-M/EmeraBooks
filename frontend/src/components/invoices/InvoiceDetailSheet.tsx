import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InvoicePreview } from "./InvoicePreview";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Pencil, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface InvoiceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onEdit: (invoice: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function InvoiceDetailSheet({ open, onOpenChange, invoice, onEdit, onDelete, onRefresh }: InvoiceDetailSheetProps) {
  const [marking, setMarking] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["invoice-items", invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];
      const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", invoice.id);
      return data || [];
    },
    enabled: !!invoice?.id && open,
  });

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  const markAsPaid = async () => {
    if (!invoice?.id) return;
    setMarking(true);
    try {
      await supabase.from("invoices").update({ status: "paid", amount_paid: invoice.total_amount }).eq("id", invoice.id);
      toast.success("Invoice marked as paid");
      onRefresh();
      onOpenChange(false);
    } catch {
      toast.error("Failed to update");
    } finally {
      setMarking(false);
    }
  };

  if (!invoice) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between pr-6">
            <SheetTitle>{invoice.invoice_number}</SheetTitle>
            <StatusBadge status={invoice.status || "draft"} />
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit(invoice); }}>
              <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
            </Button>
            {invoice.status !== "paid" && (
              <Button size="sm" variant="outline" onClick={markAsPaid} disabled={marking}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark as Paid
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => { onOpenChange(false); onDelete(invoice.id); }}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
            </Button>
          </div>

          {/* Timeline */}
          <div className="space-y-1 text-xs text-muted-foreground border-l-2 border-border pl-4">
            <p>Created: {new Date(invoice.created_at).toLocaleString()}</p>
            {invoice.status === "sent" && <p>Sent: {new Date(invoice.updated_at).toLocaleString()}</p>}
            {invoice.status === "paid" && <p>Paid: {new Date(invoice.updated_at).toLocaleString()}</p>}
          </div>

          {/* Invoice Preview */}
          <div className="border border-border rounded-lg overflow-hidden">
            <InvoicePreview
              invoice={invoice}
              companyProfile={prefs}
              templateSettings={prefs as any}
              items={items || []}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
