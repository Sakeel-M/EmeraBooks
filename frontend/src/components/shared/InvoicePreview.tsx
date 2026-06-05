import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FC } from "@/components/shared/FormattedCurrency";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  /** Optional per-line category — when present, the bill/invoice's top-level
   *  category becomes "Mixed" if lines differ, or the shared value otherwise.
   */
  category?: string;
}

export interface InvoiceProfile {
  company_name: string;
  address_line1: string;
  address_line2: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  trn: string;
  logo_text: string;
  logo_url: string;
}

export interface InvoiceTemplate {
  accent_color: string;
  layout: "classic" | "modern" | "minimal";
  show_logo: boolean;
  show_trn: boolean;
  show_due_date: boolean;
  show_notes: boolean;
  show_payment_terms: boolean;
  footer_text: string;
  payment_terms: string;
}

export const DEFAULT_PROFILE: InvoiceProfile = {
  company_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  country: "UAE",
  phone: "",
  email: "",
  trn: "",
  logo_text: "",
  logo_url: "",
};

export const DEFAULT_TEMPLATE: InvoiceTemplate = {
  accent_color: "#2563eb",
  layout: "classic",
  show_logo: true,
  show_trn: true,
  show_due_date: true,
  show_notes: true,
  show_payment_terms: true,
  footer_text: "Thank you for your business!",
  payment_terms: "Net 30",
};

export interface CounterpartyContact {
  address?: string;
  phone?: string;
  email?: string;
  trn?: string;
}

export interface InvoicePreviewProps {
  profile: InvoiceProfile;
  template: InvoiceTemplate;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  lineItems: LineItem[];
  subtotal: number;
  totalTax: number;
  grandTotal: number;
  notes: string;
  currency: string;
  fmtDate: (d: string) => string;
  stamp?: "paid" | "cancelled" | null;
  /** "invoice" (default) renders title "INVOICE" + "Bill To".
   *  "bill" renders "BILL" + "Bill From" (supplier).
   */
  kind?: "invoice" | "bill";
  /** Vendor/customer contact details rendered under the counterparty name. */
  counterpartyContact?: CounterpartyContact;
  /** Show a Category column on each line item row. */
  showLineCategories?: boolean;
}

export function InvoicePreview({
  profile,
  template,
  customerName,
  invoiceNumber,
  invoiceDate,
  dueDate,
  lineItems,
  subtotal,
  totalTax,
  grandTotal,
  notes,
  currency,
  fmtDate,
  stamp = null,
  kind = "invoice",
  counterpartyContact,
  showLineCategories = false,
}: InvoicePreviewProps) {
  const accent = template.accent_color;
  const isModern = template.layout === "modern";
  const isMinimal = template.layout === "minimal";

  return (
    <div className="relative">
      {stamp === "paid" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <span className="rotate-[-22deg] border-4 border-emerald-500/40 text-emerald-500/40 rounded-md px-8 py-2 text-5xl font-extrabold tracking-widest select-none">
            PAID
          </span>
        </div>
      )}
      {stamp === "cancelled" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
          <span className="rotate-[-22deg] border-4 border-red-500/40 text-red-500/40 rounded-md px-8 py-2 text-5xl font-extrabold tracking-widest select-none">
            CANCELLED
          </span>
        </div>
      )}
      <Card className="border shadow-sm overflow-hidden">
        {/* Top accent bar (classic + modern) */}
        {!isMinimal && (
          <div
            className={isModern ? "w-full h-2" : "w-full h-1"}
            style={{ backgroundColor: accent }}
          />
        )}

        <CardContent className="p-5 space-y-4 text-sm">
          {/* Header: Company info + INVOICE title */}
          <div className={`flex ${isModern ? "flex-col gap-3" : "justify-between items-start"}`}>
            {/* Company */}
            <div>
              {template.show_logo && (
                profile.logo_url ? (
                  <img src={profile.logo_url} alt="Logo" className="h-12 w-auto object-contain mb-1" />
                ) : profile.logo_text || profile.company_name ? (
                  <p className="font-bold text-lg" style={{ color: accent }}>
                    {profile.logo_text || profile.company_name}
                  </p>
                ) : (
                  <div className="w-24 h-8 rounded border-2 border-dashed border-muted-foreground/20 flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground">Logo</span>
                  </div>
                )
              )}
              {profile.company_name && (profile.logo_url || (profile.logo_text && profile.company_name !== profile.logo_text)) && (
                <p className="text-xs font-medium">{profile.company_name}</p>
              )}
              {profile.address_line1 && <p className="text-[10px] text-muted-foreground">{profile.address_line1}</p>}
              {profile.address_line2 && <p className="text-[10px] text-muted-foreground">{profile.address_line2}</p>}
              {(profile.city || profile.country) && (
                <p className="text-[10px] text-muted-foreground">
                  {[profile.city, profile.country].filter(Boolean).join(", ")}
                </p>
              )}
              {profile.phone && <p className="text-[10px] text-muted-foreground">{profile.phone}</p>}
              {profile.email && <p className="text-[10px] text-muted-foreground">{profile.email}</p>}
              {template.show_trn && profile.trn && (
                <p className="text-[10px] text-muted-foreground">TRN: {profile.trn}</p>
              )}
            </div>

            {/* Invoice/Bill meta */}
            <div className={isModern ? "" : "text-right"}>
              <p className="font-bold text-xl tracking-tight" style={{ color: accent }}>
                {kind === "bill" ? "BILL" : "INVOICE"}
              </p>
              <p className="text-xs font-mono text-muted-foreground">{invoiceNumber || "—"}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Date: {fmtDate(invoiceDate)}</p>
              {template.show_due_date && (
                <p className="text-[10px] text-muted-foreground">Due: {fmtDate(dueDate)}</p>
              )}
              {template.show_payment_terms && (
                <p className="text-[10px] text-muted-foreground">Terms: {template.payment_terms}</p>
              )}
            </div>
          </div>

          <Separator />

          {/* Bill To / Bill From */}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
              {kind === "bill" ? "Bill From" : "Bill To"}
            </p>
            <p className="font-medium">{customerName || "—"}</p>
            {counterpartyContact && (
              <div className="mt-0.5 space-y-0.5">
                {counterpartyContact.address && (
                  <p className="text-[10px] text-muted-foreground whitespace-pre-line">{counterpartyContact.address}</p>
                )}
                {counterpartyContact.phone && (
                  <p className="text-[10px] text-muted-foreground">{counterpartyContact.phone}</p>
                )}
                {counterpartyContact.email && (
                  <p className="text-[10px] text-muted-foreground">{counterpartyContact.email}</p>
                )}
                {counterpartyContact.trn && (
                  <p className="text-[10px] text-muted-foreground">TRN: {counterpartyContact.trn}</p>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Line items table */}
          <div>
            <div
              className="grid grid-cols-12 text-[9px] font-semibold uppercase tracking-wider pb-1.5 mb-1 border-b-2"
              style={{ borderColor: accent, color: accent }}
            >
              <div className={showLineCategories ? "col-span-3" : "col-span-5"}>Description</div>
              {showLineCategories && <div className="col-span-2">Category</div>}
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-1 text-right">Tax</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>
            {lineItems.map((li) => (
              <div key={li.id} className="grid grid-cols-12 text-xs py-1 border-b border-muted/50 items-start">
                <div className={`${showLineCategories ? "col-span-3" : "col-span-5"} pr-1 break-words`}>{li.description || "—"}</div>
                {showLineCategories && (
                  <div className="col-span-2 text-[10px] text-muted-foreground pr-1 break-words">{li.category || "—"}</div>
                )}
                <div className="col-span-2 text-right">{li.quantity}</div>
                <div className="col-span-2 text-right"><FC amount={li.unit_price} currency={currency} /></div>
                <div className="col-span-1 text-right text-muted-foreground">{li.tax_rate}%</div>
                <div className="col-span-2 text-right font-medium">
                  <FC amount={li.quantity * li.unit_price * (1 + li.tax_rate / 100)} currency={currency} />
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-1 max-w-[200px] ml-auto text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span><FC amount={subtotal} currency={currency} /></span>
            </div>
            {totalTax > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax</span>
                <span><FC amount={totalTax} currency={currency} /></span>
              </div>
            )}
            <div
              className="flex justify-between font-bold text-sm pt-1 mt-1 border-t-2"
              style={{ borderColor: accent }}
            >
              <span>Total</span>
              <span style={{ color: accent }}><FC amount={grandTotal} currency={currency} /></span>
            </div>
          </div>

          {/* Notes */}
          {template.show_notes && notes && (
            <>
              <Separator />
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>Notes</p>
                <p className="text-xs text-muted-foreground whitespace-pre-line">{notes}</p>
              </div>
            </>
          )}

          {/* Footer */}
          {template.footer_text && (
            <div className="text-center pt-2 border-t">
              <p className="text-[10px] text-muted-foreground italic">{template.footer_text}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
