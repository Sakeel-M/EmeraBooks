import { useEffect, useState } from "react";
import { format } from "date-fns";
import {
  InvoicePreview, DEFAULT_PROFILE, DEFAULT_TEMPLATE,
  type InvoiceProfile, type InvoiceTemplate, type LineItem,
} from "@/components/shared/InvoicePreview";
import { useActiveClient } from "@/hooks/useActiveClient";
import { database } from "@/lib/database";

interface Props {
  bill: any;
  currency: string;
  /** Render a PAID/CANCELLED stamp diagonally. */
  withStamp?: boolean;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy");
  } catch {
    return d;
  }
}

/** Renders a Bill (incoming supplier invoice) using the same template as the
 *  customer-facing Invoice. The user's saved company profile is the recipient
 *  on the top-left; the supplier is shown under "Bill From" with their saved
 *  contact details (address / phone / email / TRN).
 *
 *  Used inside the data-print-region wrappers so the same component looks the
 *  same on screen and in the downloaded PDF.
 */
export function PrintableBill({ bill, currency, withStamp = true }: Props) {
  const { clientId } = useActiveClient();
  const [profile, setProfile] = useState<InvoiceProfile>(DEFAULT_PROFILE);
  const [template, setTemplate] = useState<InvoiceTemplate>(DEFAULT_TEMPLATE);

  useEffect(() => {
    if (!clientId) return;
    database.getControlSetting(clientId, "invoice_profile")
      .then((v) => { if (v) setProfile({ ...DEFAULT_PROFILE, ...v }); })
      .catch(() => {});
    database.getControlSetting(clientId, "invoice_template")
      .then((v) => { if (v) setTemplate({ ...DEFAULT_TEMPLATE, ...v }); })
      .catch(() => {});
  }, [clientId]);

  const vendor = bill.v2_vendors || {};
  const vendorName = vendor.name || bill.vendor_name || bill.description || "—";

  // Build line items. Prefer stored line_items; otherwise synthesise a single
  // line from the bill totals so the table still renders cleanly.
  const lineItems: LineItem[] = (Array.isArray(bill.line_items) && bill.line_items.length > 0)
    ? bill.line_items.map((li: any, i: number) => ({
        id: String(i),
        description: li.description || "—",
        quantity: Number(li.quantity || 1),
        unit_price: Number(li.unit_price || 0),
        tax_rate: Number(li.tax_rate ?? 0),
        category: li.category || bill.category,
      }))
    : [{
        id: "0",
        description: bill.description || bill.notes || bill.bill_number || "Bill item",
        quantity: 1,
        unit_price: Number(bill.subtotal || (bill.total || 0) / 1.05),
        tax_rate: Number(bill.subtotal || 0) > 0
          ? +((Number(bill.tax_amount || 0) / Number(bill.subtotal || 1)) * 100).toFixed(2)
          : 0,
        category: bill.category,
      }];

  const stamp = withStamp
    ? (bill.status === "paid" ? "paid" : bill.status === "cancelled" ? "cancelled" : null)
    : null;

  return (
    <InvoicePreview
      kind="bill"
      profile={profile}
      template={template}
      customerName={vendorName}
      counterpartyContact={{
        address: vendor.address,
        phone: vendor.phone,
        email: vendor.email,
        trn: vendor.trn,
      }}
      invoiceNumber={bill.bill_number || "—"}
      invoiceDate={bill.bill_date || ""}
      dueDate={bill.due_date || bill.bill_date || ""}
      lineItems={lineItems}
      subtotal={Number(bill.subtotal || 0)}
      totalTax={Number(bill.tax_amount || 0)}
      grandTotal={Number(bill.total || 0)}
      notes={bill.notes || ""}
      currency={currency}
      fmtDate={fmtDate}
      stamp={stamp as any}
      showLineCategories
    />
  );
}
