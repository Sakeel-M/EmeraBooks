import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Eye, Pencil, Trash2, FileText } from "lucide-react";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface InvoiceCardProps {
  invoice: any;
  logoUrl?: string | null;
  currency?: string;
  onView: (invoice: any) => void;
  onEdit: (invoice: any) => void;
  onDelete: (id: string) => void;
}

// Clean raw bank-reference names stored in the DB
// e.g. "Ln42012546429376:- Com Akwad Tech Network" → "Akwad Tech Network"
function cleanCustomerName(name: string | null | undefined): string {
  if (!name) return "";
  let s = name.trim();
  const refMatch = s.match(/^(?:[A-Za-z]{0,3})?\d{6,}:-\s*(.+)/);
  if (refMatch) s = refMatch[1].trim();
  s = s.replace(/^(?:Com|Edu|Fam|Str|Sal|Pur|Ref|Int|Ext|Own)\s+/i, "").trim();
  return s || name;
}

export function InvoiceCard({ invoice, logoUrl, currency = "USD", onView, onEdit, onDelete }: InvoiceCardProps) {
  const customerName = cleanCustomerName(invoice.customers?.name);
  return (
    <Card
      className="group cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 border-border"
      onClick={() => onView(invoice)}
    >
      <CardContent className="p-5 space-y-4">
        {/* Header: Logo + Invoice # + Status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain rounded" />
            ) : (
              <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <span className="font-semibold text-sm text-foreground">{invoice.invoice_number}</span>
          </div>
          <StatusBadge status={invoice.status || "draft"} />
        </div>

        {/* Customer */}
        <div>
          <p className="text-sm font-medium text-foreground">{customerName || "No Customer"}</p>
        </div>

        {/* Dates */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{new Date(invoice.invoice_date).toLocaleDateString()}</span>
          <span>Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
        </div>

        {/* Amount */}
        <div className="text-right">
          <span className="text-xl font-bold text-foreground">
            <FormattedCurrency amount={Number(invoice.total_amount)} currency={currency} />
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onView(invoice); }}>
            <Eye className="h-3.5 w-3.5 mr-1" /> View
          </Button>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(invoice); }}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(invoice.id); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
