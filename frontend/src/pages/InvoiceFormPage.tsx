import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Eye,
  Settings2,
  Building2,
  Palette,
  Save,
  Send,
  Download,
  Copy,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

interface InvoiceProfile {
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

interface InvoiceTemplate {
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

const ACCENT_COLORS = [
  { name: "Blue", value: "#2563eb" },
  { name: "Emerald", value: "#059669" },
  { name: "Purple", value: "#7c3aed" },
  { name: "Rose", value: "#e11d48" },
  { name: "Orange", value: "#ea580c" },
  { name: "Slate", value: "#475569" },
];

const DEFAULT_PROFILE: InvoiceProfile = {
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

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const DEFAULT_TEMPLATE: InvoiceTemplate = {
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

function newLineItem(): LineItem {
  return { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, tax_rate: 5 };
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function InvoiceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();

  // Form state
  const [customerName, setCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [category, setCategory] = useState("Professional Services");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("draft");
  const [lineItems, setLineItems] = useState<LineItem[]>([newLineItem()]);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Customize dialogs
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);

  // Profile & template state (persisted to control settings)
  const [profile, setProfile] = useState<InvoiceProfile>(DEFAULT_PROFILE);
  const [template, setTemplate] = useState<InvoiceTemplate>(DEFAULT_TEMPLATE);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ["revenue-customers", clientId],
    queryFn: () => database.getCustomers(clientId!),
    enabled: !!clientId,
  });

  // Fetch existing invoices for auto-numbering
  const { data: invoices = [] } = useQuery({
    queryKey: ["revenue-invoices-count", clientId],
    queryFn: () => database.getInvoices(clientId!),
    enabled: !!clientId,
  });

  // Load saved profile & template from control settings
  useEffect(() => {
    if (!clientId) return;
    (async () => {
      try {
        const savedProfile = await database.getControlSetting(clientId, "invoice_profile");
        if (savedProfile) setProfile(savedProfile);
        const savedTemplate = await database.getControlSetting(clientId, "invoice_template");
        if (savedTemplate) setTemplate(savedTemplate);
      } catch { /* first time — use defaults */ }
    })();
  }, [clientId]);

  // Load existing invoice for editing
  useEffect(() => {
    if (!editId || !clientId) return;
    (async () => {
      try {
        const allInvoices = await database.getInvoices(clientId);
        const inv = allInvoices.find((i: any) => i.id === editId);
        if (inv) {
          setCustomerName(inv.v2_customers?.name || inv.customer_name || "");
          setInvoiceNumber(inv.invoice_number || "");
          setInvoiceDate(inv.invoice_date || format(new Date(), "yyyy-MM-dd"));
          setDueDate(inv.due_date || format(addDays(new Date(), 30), "yyyy-MM-dd"));
          setCategory(inv.category || "Professional Services");
          setNotes(inv.notes || "");
          setStatus(inv.status || "draft");
          // Reconstruct line item from totals
          const sub = inv.subtotal || (inv.total || 0) / 1.05;
          const taxPct = inv.tax_amount && sub > 0 ? Math.round((inv.tax_amount / sub) * 100) : 5;
          setLineItems([{
            id: crypto.randomUUID(),
            description: inv.notes || inv.description || "Invoice item",
            quantity: 1,
            unit_price: sub,
            tax_rate: taxPct,
          }]);
        }
      } catch { /* ignore */ }
    })();
  }, [editId, clientId]);

  // Auto-generate invoice number
  useEffect(() => {
    if (!editId && invoiceNumber === "" && invoices.length >= 0) {
      setInvoiceNumber(`INV-${format(new Date(), "yyyyMM")}-${String(invoices.length + 1).padStart(3, "0")}`);
    }
  }, [invoices.length, editId, invoiceNumber]);

  // Computed totals
  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0),
    [lineItems],
  );
  const totalTax = useMemo(
    () => lineItems.reduce((s, li) => s + li.quantity * li.unit_price * (li.tax_rate / 100), 0),
    [lineItems],
  );
  const grandTotal = subtotal + totalTax;

  // Handlers
  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems((prev) =>
      prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)),
    );
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleSave = async (sendStatus?: string) => {
    if (!clientId || !customerName) {
      toast.error("Please select a customer");
      return;
    }
    if (subtotal <= 0) {
      toast.error("Please add at least one line item with an amount");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        customer_name: customerName,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        due_date: dueDate,
        subtotal,
        tax_amount: totalTax,
        total: grandTotal,
        notes,
        category,
        description: lineItems.map((li) => li.description).filter(Boolean).join("; "),
        status: sendStatus || status,
      };

      if (editId) {
        await flaskApi.patch(`/invoices/${editId}`, payload);
        toast.success(`Invoice ${invoiceNumber} updated`);
      } else {
        await database.createInvoice(clientId, payload as any);
        toast.success(`Invoice ${invoiceNumber} created`);
      }
      queryClient.invalidateQueries({ queryKey: ["revenue-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["cc-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fr-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["cash-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["ai-score-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["ai-risk-score"] });
      navigate("/revenue?tab=invoices");
    } catch (err: any) {
      toast.error(err.message || "Failed to save invoice");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!clientId) return;
    try {
      await database.setControlSetting(clientId, "invoice_profile", profile);
      toast.success("Invoice profile saved");
      setShowProfileDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    }
  };

  const handleSaveTemplate = async () => {
    if (!clientId) return;
    try {
      await database.setControlSetting(clientId, "invoice_template", template);
      toast.success("Invoice template saved");
      setShowTemplateSheet(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save template");
    }
  };

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
  };

  return (
    <Layout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/revenue?tab=invoices")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold font-heading">
                {editId ? "Edit Invoice" : "Create Invoice"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {editId ? `Editing ${invoiceNumber}` : "Fill in the details below"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowProfileDialog(true)}>
              <Building2 className="h-3.5 w-3.5" />
              Invoice Profile
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowTemplateSheet(true)}>
              <Palette className="h-3.5 w-3.5" />
              Customize
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowPreview(true)}>
              <Eye className="h-3.5 w-3.5" />
              Preview
            </Button>
          </div>
        </div>

        {/* Main content: 2-column */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-4">
            {/* Customer & Invoice Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Invoice Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Customer</Label>
                    <Select value={customerName} onValueChange={setCustomerName}>
                      <SelectTrigger><SelectValue placeholder="Select customer..." /></SelectTrigger>
                      <SelectContent>
                        {customers.map((c: any) => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Invoice Number</Label>
                    <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Invoice Date</Label>
                    <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Due Date</Label>
                    <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Professional Services", "Consulting", "Technology", "Retail & Shopping", "Healthcare", "Education", "Business Income", "Other"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Line Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
                  <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setLineItems([...lineItems, newLineItem()])}>
                    <Plus className="h-3 w-3" /> Add Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Unit Price</div>
                  <div className="col-span-1">Tax %</div>
                  <div className="col-span-1 text-right">Amount</div>
                  <div className="col-span-1"></div>
                </div>
                {lineItems.map((li) => {
                  const lineTotal = li.quantity * li.unit_price * (1 + li.tax_rate / 100);
                  return (
                    <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <Input
                          placeholder="Item description"
                          value={li.description}
                          onChange={(e) => updateLineItem(li.id, "description", e.target.value)}
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          min="1"
                          value={li.quantity}
                          onChange={(e) => updateLineItem(li.id, "quantity", parseInt(e.target.value) || 1)}
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={li.unit_price || ""}
                          onChange={(e) => updateLineItem(li.id, "unit_price", parseFloat(e.target.value) || 0)}
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="col-span-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={li.tax_rate}
                          onChange={(e) => updateLineItem(li.id, "tax_rate", parseFloat(e.target.value) || 0)}
                          className="text-sm h-9"
                        />
                      </div>
                      <div className="col-span-1 text-right text-sm font-medium">
                        <FC amount={lineTotal} currency={currency} />
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-500"
                          disabled={lineItems.length <= 1}
                          onClick={() => removeLineItem(li.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                <Separator />

                {/* Totals */}
                <div className="space-y-1.5 max-w-xs ml-auto text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span><FC amount={subtotal} currency={currency} /></span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span><FC amount={totalTax} currency={currency} /></span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total</span>
                    <span className="text-primary"><FC amount={grandTotal} currency={currency} /></span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Label className="text-xs">Notes / Payment Terms</Label>
                <Textarea
                  placeholder="Payment terms, special instructions, thank you note..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end">
              <Button variant="outline" onClick={() => navigate("/revenue?tab=invoices")}>Cancel</Button>
              <Button variant="outline" className="gap-1.5" onClick={() => handleSave("draft")} disabled={saving}>
                <Save className="h-3.5 w-3.5" />
                Save Draft
              </Button>
              <Button className="gap-1.5" onClick={() => handleSave("sent")} disabled={saving}>
                <Send className="h-3.5 w-3.5" />
                {saving ? "Saving..." : editId ? "Update & Send" : "Create & Send"}
              </Button>
            </div>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Live Preview</p>
              <InvoiceLivePreview
                profile={profile}
                template={template}
                customerName={customerName}
                invoiceNumber={invoiceNumber}
                invoiceDate={invoiceDate}
                dueDate={dueDate}
                lineItems={lineItems}
                subtotal={subtotal}
                totalTax={totalTax}
                grandTotal={grandTotal}
                notes={notes}
                currency={currency}
                fmtDate={fmtDate}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoice Profile Dialog ── */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Invoice Profile
            </DialogTitle>
            <DialogDescription>
              Your company details that appear on every invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Logo Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Company Logo</Label>
              <div className="flex items-center gap-3">
                {profile.logo_url ? (
                  <div className="relative group">
                    <img src={profile.logo_url} alt="Logo" className="h-14 w-14 object-contain rounded border bg-white p-1" />
                    <button
                      className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setProfile({ ...profile, logo_url: "" })}
                    >
                      x
                    </button>
                  </div>
                ) : (
                  <div className="h-14 w-14 rounded border-2 border-dashed border-muted-foreground/25 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <label className="cursor-pointer">
                    <span className="text-xs text-primary font-medium hover:underline">
                      {profile.logo_url ? "Change logo" : "Upload logo"}
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 500 * 1024) {
                          toast.error("Logo must be under 500 KB");
                          return;
                        }
                        try {
                          const dataUrl = await readFileAsDataURL(file);
                          setProfile({ ...profile, logo_url: dataUrl });
                        } catch {
                          toast.error("Failed to read image");
                        }
                      }}
                    />
                  </label>
                  <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG or WebP. Max 500 KB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Company / Business Name</Label>
              <Input value={profile.company_name} onChange={(e) => setProfile({ ...profile, company_name: e.target.value })} placeholder="Your Company Name" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo Text (shown if no image uploaded)</Label>
              <Input value={profile.logo_text} onChange={(e) => setProfile({ ...profile, logo_text: e.target.value })} placeholder="e.g. ACME" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 1</Label>
                <Input value={profile.address_line1} onChange={(e) => setProfile({ ...profile, address_line1: e.target.value })} placeholder="Street address" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Address Line 2</Label>
                <Input value={profile.address_line2} onChange={(e) => setProfile({ ...profile, address_line2: e.target.value })} placeholder="Suite, floor" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">City</Label>
                <Input value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} placeholder="Dubai" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Input value={profile.country} onChange={(e) => setProfile({ ...profile, country: e.target.value })} placeholder="UAE" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} placeholder="+971 50 000 0000" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} placeholder="billing@company.com" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">TRN (Tax Registration Number)</Label>
              <Input value={profile.trn} onChange={(e) => setProfile({ ...profile, trn: e.target.value })} placeholder="100000000000003" />
            </div>
            <Button className="w-full mt-2" onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Customize Invoice Template Sheet ── */}
      <Sheet open={showTemplateSheet} onOpenChange={setShowTemplateSheet}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Customize Invoice
            </SheetTitle>
            <SheetDescription>
              Adjust the look and feel of your invoices.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 pt-4">
            {/* Layout */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Layout Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["classic", "modern", "minimal"] as const).map((layout) => (
                  <button
                    key={layout}
                    className={`rounded-lg border-2 p-3 text-center text-xs font-medium transition-colors ${
                      template.layout === layout
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    }`}
                    onClick={() => setTemplate({ ...template, layout })}
                  >
                    <div className={`mx-auto mb-1.5 w-8 h-10 rounded border ${
                      layout === "classic" ? "border-t-4" : layout === "modern" ? "border-l-4" : ""
                    }`} style={{ borderColor: template.accent_color }} />
                    {layout.charAt(0).toUpperCase() + layout.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Accent Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      template.accent_color === c.value ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                    onClick={() => setTemplate({ ...template, accent_color: c.value })}
                  />
                ))}
                <div className="flex items-center gap-1.5 ml-2">
                  <Input
                    type="color"
                    value={template.accent_color}
                    onChange={(e) => setTemplate({ ...template, accent_color: e.target.value })}
                    className="w-8 h-8 p-0 border-0 cursor-pointer"
                  />
                  <span className="text-xs text-muted-foreground">Custom</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Toggle fields */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold">Show / Hide Fields</Label>
              {[
                { key: "show_logo" as const, label: "Company Logo / Name" },
                { key: "show_trn" as const, label: "TRN (Tax Registration)" },
                { key: "show_due_date" as const, label: "Due Date" },
                { key: "show_notes" as const, label: "Notes Section" },
                { key: "show_payment_terms" as const, label: "Payment Terms" },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm">{label}</span>
                  <Switch
                    checked={template[key]}
                    onCheckedChange={(v) => setTemplate({ ...template, [key]: v })}
                  />
                </div>
              ))}
            </div>

            <Separator />

            {/* Footer text */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Footer Text</Label>
              <Input
                value={template.footer_text}
                onChange={(e) => setTemplate({ ...template, footer_text: e.target.value })}
                placeholder="Thank you for your business!"
              />
            </div>

            {/* Payment terms */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Default Payment Terms</Label>
              <Select value={template.payment_terms} onValueChange={(v) => setTemplate({ ...template, payment_terms: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Due on Receipt", "Net 15", "Net 30", "Net 45", "Net 60"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Mini preview */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Preview</Label>
              <div className="transform scale-[0.6] origin-top-left -mb-40">
                <InvoiceLivePreview
                  profile={profile}
                  template={template}
                  customerName={customerName || "Sample Customer"}
                  invoiceNumber={invoiceNumber || "INV-000"}
                  invoiceDate={invoiceDate}
                  dueDate={dueDate}
                  lineItems={lineItems.length > 0 && lineItems[0].unit_price > 0 ? lineItems : [{ id: "sample", description: "Sample Service", quantity: 1, unit_price: 1000, tax_rate: 5 }]}
                  subtotal={subtotal || 1000}
                  totalTax={totalTax || 50}
                  grandTotal={grandTotal || 1050}
                  notes={notes || "Thank you for your business!"}
                  currency={currency}
                  fmtDate={fmtDate}
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSaveTemplate}>
              Save Template
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Full Preview Dialog ── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invoice Preview</DialogTitle>
            <DialogDescription>This is how your invoice will look.</DialogDescription>
          </DialogHeader>
          <InvoiceLivePreview
            profile={profile}
            template={template}
            customerName={customerName}
            invoiceNumber={invoiceNumber}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            lineItems={lineItems}
            subtotal={subtotal}
            totalTax={totalTax}
            grandTotal={grandTotal}
            notes={notes}
            currency={currency}
            fmtDate={fmtDate}
          />
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// ── Live Preview Component ─────────────────────────────────────────────────

function InvoiceLivePreview({
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
}: {
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
}) {
  const accent = template.accent_color;
  const isModern = template.layout === "modern";
  const isMinimal = template.layout === "minimal";

  return (
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

          {/* Invoice meta */}
          <div className={isModern ? "" : "text-right"}>
            <p className="font-bold text-xl tracking-tight" style={{ color: accent }}>
              INVOICE
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

        {/* Bill To */}
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: accent }}>
            Bill To
          </p>
          <p className="font-medium">{customerName || "—"}</p>
        </div>

        <Separator />

        {/* Line items table */}
        <div>
          <div
            className="grid grid-cols-12 text-[9px] font-semibold uppercase tracking-wider pb-1.5 mb-1 border-b-2"
            style={{ borderColor: accent, color: accent }}
          >
            <div className="col-span-5">Description</div>
            <div className="col-span-2 text-right">Qty</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-1 text-right">Tax</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>
          {lineItems.map((li) => (
            <div key={li.id} className="grid grid-cols-12 text-xs py-1 border-b border-muted/50">
              <div className="col-span-5 truncate">{li.description || "—"}</div>
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tax</span>
            <span><FC amount={totalTax} currency={currency} /></span>
          </div>
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
  );
}
