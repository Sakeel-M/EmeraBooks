import { Separator } from "@/components/ui/separator";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface InvoicePreviewProps {
  invoice: any;
  companyProfile?: any;
  templateSettings?: {
    invoice_template?: string;
    invoice_accent_color?: string;
    invoice_show_tax?: boolean;
    invoice_show_terms?: boolean;
    invoice_show_notes?: boolean;
    invoice_footer_text?: string;
  };
  items?: any[];
  compact?: boolean;
  currency?: string;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function InvoicePreview({ invoice, companyProfile, templateSettings, items = [], compact = false, currency = "USD" }: InvoicePreviewProps) {
  const template = templateSettings?.invoice_template || "classic";
  const accentColor = templateSettings?.invoice_accent_color || "#1F4F2D";
  const showTax = templateSettings?.invoice_show_tax ?? true;
  const showTerms = templateSettings?.invoice_show_terms ?? true;
  const showNotes = templateSettings?.invoice_show_notes ?? true;
  const footerText = templateSettings?.invoice_footer_text;

  const hasItems = items.length > 0;
  const VAT_RATE = 5; // 5% UAE VAT
  const rawTotal = Number(invoice?.total_amount || 0);

  // For line-item invoices: sum from items. For bank-synced invoices (no items):
  // treat total_amount as VAT-inclusive → subtotal = total * 95%, tax = total * 5%
  const subtotal = hasItems
    ? items.reduce((s, i) => s + (i.quantity * i.unit_price), 0)
    : (invoice?.subtotal != null ? Number(invoice.subtotal) : rawTotal * (1 - VAT_RATE / 100));
  const taxTotal = hasItems && showTax
    ? items.reduce((s, i) => s + (i.quantity * i.unit_price * (i.tax_rate || 0) / 100), 0)
    : (invoice?.tax_amount != null && Number(invoice.tax_amount) > 0
        ? Number(invoice.tax_amount)
        : (showTax ? rawTotal * (VAT_RATE / 100) : 0));
  const total = hasItems ? subtotal + taxTotal : rawTotal;

  if (template === "modern") {
    return (
      <div className={`bg-white text-black ${compact ? "text-xs p-4" : "p-8"} rounded-lg`}>
        {/* Modern: full-width accent header */}
        <div className="rounded-t-lg p-6 mb-6" style={{ backgroundColor: accentColor }}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {companyProfile?.company_logo_url && (
                <img src={companyProfile.company_logo_url} alt="Logo" className="h-10 w-10 object-contain rounded bg-white p-1" />
              )}
              <div className="text-white">
                <h2 className="text-lg font-bold">{companyProfile?.company_name || "Your Company"}</h2>
                <p className="text-sm opacity-80">{companyProfile?.company_email}</p>
                {(companyProfile as any)?.company_tax_number && (
                  <p className="text-sm opacity-80">TRN: {(companyProfile as any).company_tax_number}</p>
                )}
              </div>
            </div>
            <div className="text-white text-right">
              <p className="text-2xl font-bold">INVOICE</p>
              <p className="text-sm opacity-80">{invoice?.invoice_number}</p>
            </div>
          </div>
        </div>
        <InvoiceBody invoice={invoice} companyProfile={companyProfile} items={items} subtotal={subtotal} taxTotal={taxTotal} total={total} showTax={showTax} showTerms={showTerms} showNotes={showNotes} footerText={footerText} compact={compact} currency={currency} />
      </div>
    );
  }

  if (template === "minimal") {
    return (
      <div className={`bg-white text-black ${compact ? "text-xs p-4" : "p-8"} rounded-lg`}>
        <div className="mb-8">
          <h2 className="text-3xl font-light tracking-tight mb-1">Invoice</h2>
          <p className="text-sm text-gray-500">{invoice?.invoice_number}</p>
        </div>
        <div className="flex justify-between mb-8">
          <div>
            <p className="font-medium">{companyProfile?.company_name || "Your Company"}</p>
            <p className="text-sm text-gray-500">{companyProfile?.company_email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Issued: {invoice?.invoice_date ? parseLocalDate(invoice.invoice_date).toLocaleDateString() : ""}</p>
            <p className="text-sm text-gray-500">Due: {invoice?.due_date ? parseLocalDate(invoice.due_date).toLocaleDateString() : ""}</p>
          </div>
        </div>
        <InvoiceBody invoice={invoice} companyProfile={companyProfile} items={items} subtotal={subtotal} taxTotal={taxTotal} total={total} showTax={showTax} showTerms={showTerms} showNotes={showNotes} footerText={footerText} compact={compact} currency={currency} />
      </div>
    );
  }

  // Classic template (default)
  return (
    <div className={`bg-white text-black ${compact ? "text-xs p-4" : "p-8"} rounded-lg`}>
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-3">
          {companyProfile?.company_logo_url && (
            <img src={companyProfile.company_logo_url} alt="Logo" className="h-12 w-12 object-contain" />
          )}
          <div>
            <h2 className="text-lg font-bold">{companyProfile?.company_name || "Your Company"}</h2>
            <p className="text-sm text-gray-500">{companyProfile?.company_email}</p>
            {companyProfile?.company_address_line1 && (
              <p className="text-sm text-gray-500">{companyProfile.company_address_line1}</p>
            )}
            {(companyProfile as any)?.company_tax_number && (
              <p className="text-sm text-gray-500">TRN: {(companyProfile as any).company_tax_number}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold" style={{ color: accentColor }}>INVOICE</p>
          <p className="text-sm font-medium">{invoice?.invoice_number}</p>
          <p className="text-sm text-gray-500 mt-1">Date: {invoice?.invoice_date ? parseLocalDate(invoice.invoice_date).toLocaleDateString() : ""}</p>
          <p className="text-sm text-gray-500">Due: {invoice?.due_date ? parseLocalDate(invoice.due_date).toLocaleDateString() : ""}</p>
        </div>
      </div>
      <InvoiceBody invoice={invoice} companyProfile={companyProfile} items={items} subtotal={subtotal} taxTotal={taxTotal} total={total} showTax={showTax} showTerms={showTerms} showNotes={showNotes} footerText={footerText} compact={compact} currency={currency} />
    </div>
  );
}

function InvoiceBody({ invoice, items, subtotal, taxTotal, total, showTax, showTerms, showNotes, footerText, compact, currency = "USD" }: any) {
  return (
    <>
      {/* Bill To */}
      <div className="mb-6">
        <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Bill To</p>
        <p className="font-medium">{invoice?.customers?.name || "Customer"}</p>
        {invoice?.customers?.email && <p className="text-sm text-gray-500">{invoice.customers.email}</p>}
        {invoice?.customers?.tax_number && <p className="text-sm text-gray-500">TRN: {invoice.customers.tax_number}</p>}
      </div>

      {/* Line Items Table */}
      <table className="w-full mb-6">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 text-xs uppercase text-gray-500 font-semibold">Description</th>
            <th className="text-right py-2 text-xs uppercase text-gray-500 font-semibold">Qty</th>
            <th className="text-right py-2 text-xs uppercase text-gray-500 font-semibold">Price</th>
            {showTax && <th className="text-right py-2 text-xs uppercase text-gray-500 font-semibold">Tax</th>}
            <th className="text-right py-2 text-xs uppercase text-gray-500 font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length > 0 ? items.map((item: any, i: number) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-2">{item.description}</td>
              <td className="text-right py-2">{item.quantity}</td>
              <td className="text-right py-2"><FormattedCurrency amount={Number(item.unit_price)} currency={currency} /></td>
              {showTax && <td className="text-right py-2">{item.tax_rate || 0}%</td>}
              <td className="text-right py-2"><FormattedCurrency amount={item.quantity * item.unit_price * (1 + (item.tax_rate || 0) / 100)} currency={currency} /></td>
            </tr>
          )) : (
            <tr><td colSpan={showTax ? 5 : 4} className="py-4 text-center text-gray-400">No line items</td></tr>
          )}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className={compact ? "w-40" : "w-56"}>
          <div className="flex justify-between py-1"><span className="text-gray-500">Subtotal</span><span><FormattedCurrency amount={subtotal} currency={currency} /></span></div>
          {showTax && <div className="flex justify-between py-1"><span className="text-gray-500">VAT (5%)</span><span><FormattedCurrency amount={taxTotal} currency={currency} /></span></div>}
          <Separator className="my-1" />
          <div className="flex justify-between py-1 font-bold text-lg"><span>Total</span><span><FormattedCurrency amount={total} currency={currency} /></span></div>
        </div>
      </div>

      {/* Terms & Notes */}
      {showTerms && invoice?.terms && (
        <div className="mb-4">
          <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Terms</p>
          <p className="text-sm text-gray-600">{invoice.terms}</p>
        </div>
      )}
      {showNotes && invoice?.notes && (
        <div className="mb-4">
          <p className="text-xs uppercase text-gray-400 font-semibold mb-1">Notes</p>
          <p className="text-sm text-gray-600">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      {footerText && (
        <div className="text-center pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">{footerText}</p>
        </div>
      )}
    </>
  );
}
