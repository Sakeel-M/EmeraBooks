import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { Pencil, Trash2, CheckCircle2, FileText, Calendar, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BillDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bill: any | null;
  onEdit: (bill: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function BillDetailSheet({ open, onOpenChange, bill, onEdit, onDelete, onRefresh }: BillDetailSheetProps) {
  const { currency } = useCurrency();

  const { data: lineItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["bill-items", bill?.id],
    queryFn: async () => {
      if (!bill?.id) return [];
      const { data, error } = await supabase
        .from("bill_items")
        .select("*")
        .eq("bill_id", bill.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!bill?.id,
  });

  const handleMarkPaid = async () => {
    if (!bill) return;
    try {
      const { error } = await supabase
        .from("bills")
        .update({ status: "paid", amount_paid: bill.total_amount })
        .eq("id", bill.id);
      if (error) throw error;
      toast.success("Bill marked as paid");
      onRefresh();
      onOpenChange(false);
    } catch {
      toast.error("Failed to update bill");
    }
  };

  if (!bill) return null;

  const balanceDue = (bill.total_amount || 0) - (bill.amount_paid || 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <SheetTitle className="text-xl">{bill.bill_number}</SheetTitle>
            <StatusBadge status={bill.status} />
          </div>
          <SheetDescription>Bill details and line items</SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          {/* Bill Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" /> Vendor</p>
              <p className="text-sm font-medium">{bill.vendors?.name || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Category</p>
              <p className="text-sm">{bill.category ? <Badge variant="secondary" className="text-xs">{bill.category}</Badge> : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Bill Date</p>
              <p className="text-sm">{new Date(bill.bill_date).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Due Date</p>
              <p className="text-sm">{new Date(bill.due_date).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Currency</p>
              <p className="text-sm">{bill.currency || currency}</p>
            </div>
            {bill.source && bill.source !== "manual" && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Source</p>
                <Badge variant="outline" className="text-xs capitalize">{bill.source}</Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Amount Breakdown */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Amount Breakdown</h4>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatAmount(bill.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatAmount(bill.tax_amount || 0, currency)}</span></div>
              <Separator />
              <div className="flex justify-between font-semibold"><span>Total</span><span>{formatAmount(bill.total_amount, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount Paid</span><span>{formatAmount(bill.amount_paid || 0, currency)}</span></div>
              <div className="flex justify-between font-semibold text-primary"><span>Balance Due</span><span>{formatAmount(balanceDue, currency)}</span></div>
            </div>
          </div>

          <Separator />

          {/* Line Items */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-1"><FileText className="h-4 w-4" /> Line Items</h4>
            {itemsLoading ? (
              <div className="space-y-2">
                {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lineItems && lineItems.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Description</TableHead>
                      <TableHead className="text-xs text-right">Qty</TableHead>
                      <TableHead className="text-xs text-right">Price</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs">{item.description}</TableCell>
                        <TableCell className="text-xs text-right">{item.quantity}</TableCell>
                        <TableCell className="text-xs text-right">{formatAmount(item.unit_price, currency)}</TableCell>
                        <TableCell className="text-xs text-right">{formatAmount(item.amount, currency)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No line items</p>
            )}
          </div>

          {/* Notes */}
          {bill.notes && (
            <>
              <Separator />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold">Notes</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{bill.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { onEdit(bill); onOpenChange(false); }}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
            {bill.status !== "paid" && (
              <Button variant="outline" size="sm" onClick={handleMarkPaid}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Paid
              </Button>
            )}
            <Button variant="destructive" size="sm" onClick={() => { onDelete(bill.id); onOpenChange(false); }}>
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
