import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveClient } from "@/hooks/useActiveClient";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { FC } from "@/components/shared/FormattedCurrency";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { format, addDays } from "date-fns";
import { toast } from "sonner";

interface BillLine {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  _tax_kind?: "zero" | "exempt";
  category?: string;
}

function newLine(): BillLine {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: 1,
    unit_price: 0,
    tax_rate: 5,
    category: "Other",
  };
}

export default function BillFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();

  // Vendor + bill details
  const [vendorName, setVendorName] = useState("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const [vendorEmail, setVendorEmail] = useState("");
  const [vendorTrn, setVendorTrn] = useState("");

  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<BillLine[]>([newLine()]);
  const [saving, setSaving] = useState(false);

  // Vendor list for the picker
  const { data: vendors = [] } = useQuery({
    queryKey: ["bill-form-vendors", clientId],
    queryFn: () => database.getVendors(clientId!),
    enabled: !!clientId,
  });

  // Pre-fill vendor contact fields whenever the selected vendor changes
  useEffect(() => {
    const v = vendors.find((x: any) => x.name === vendorName);
    if (v) {
      if (v.address && !vendorAddress) setVendorAddress(v.address);
      if (v.phone && !vendorPhone) setVendorPhone(v.phone);
      if (v.email && !vendorEmail) setVendorEmail(v.email);
      if (v.trn && !vendorTrn) setVendorTrn(v.trn);
    }
    // Intentionally only triggers on vendor name change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorName, vendors]);

  // Edit-mode hydration
  useEffect(() => {
    if (!editId || !clientId) return;
    (async () => {
      try {
        const bill: any = await flaskApi.get(`/bills/${editId}`);
        if (bill) {
          setVendorName(bill.v2_vendors?.name || bill.vendor_name || "");
          setBillNumber(bill.bill_number || "");
          if (bill.bill_date) setBillDate(bill.bill_date);
          if (bill.due_date) setDueDate(bill.due_date);
          setNotes(bill.notes || "");
          if (Array.isArray(bill.line_items) && bill.line_items.length > 0) {
            setLineItems(bill.line_items.map((li: any) => ({
              id: crypto.randomUUID(),
              description: li.description || "",
              quantity: li.quantity || 1,
              unit_price: li.unit_price || 0,
              tax_rate: li.tax_rate ?? 5,
              category: li.category || bill.category || "Other",
            })));
          } else {
            const sub = bill.subtotal || (bill.total || 0) / 1.05;
            const pct = bill.tax_amount && sub > 0 ? Math.round((bill.tax_amount / sub) * 100) : 5;
            setLineItems([{
              id: crypto.randomUUID(),
              description: bill.notes || bill.bill_number || "Bill item",
              quantity: 1,
              unit_price: sub,
              tax_rate: pct,
              category: bill.category || "Other",
            }]);
          }
        }
      } catch {/* ignore */}
    })();
  }, [editId, clientId]);

  // Auto-generate bill number once
  useEffect(() => {
    if (!billNumber && !editId) {
      const month = format(new Date(), "yyyyMM");
      const seq = String(Math.floor(Math.random() * 900) + 100);
      setBillNumber(`BILL-${month}-${seq}`);
    }
  }, [billNumber, editId]);

  const subtotal = useMemo(
    () => lineItems.reduce((s, li) => s + li.quantity * li.unit_price, 0),
    [lineItems],
  );
  const totalTax = useMemo(
    () => lineItems.reduce((s, li) => s + li.quantity * li.unit_price * (li.tax_rate / 100), 0),
    [lineItems],
  );
  const grandTotal = subtotal + totalTax;

  const updateLine = (id: string, field: keyof BillLine, value: any) => {
    setLineItems((prev) => prev.map((li) => (li.id === id ? { ...li, [field]: value } : li)));
  };
  const removeLine = (id: string) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  };

  const handleSave = async () => {
    if (!clientId) return;
    if (!vendorName.trim()) {
      toast.error("Vendor is required");
      return;
    }
    if (lineItems.every((li) => !li.description.trim())) {
      toast.error("Add at least one line item with a description");
      return;
    }
    setSaving(true);
    try {
      const lineCats = Array.from(new Set(
        lineItems.map((li) => (li.category || "").trim()).filter(Boolean),
      ));
      const topCategory = lineCats.length === 1 ? lineCats[0] : (lineCats.length > 1 ? "Mixed" : "Other");

      const payload: any = {
        vendor_name: vendorName.trim(),
        vendor_address: vendorAddress.trim() || undefined,
        vendor_phone: vendorPhone.trim() || undefined,
        vendor_email: vendorEmail.trim() || undefined,
        vendor_trn: vendorTrn.trim() || undefined,
        bill_number: billNumber.trim() || undefined,
        bill_date: billDate,
        due_date: dueDate,
        subtotal,
        tax_amount: totalTax,
        total: grandTotal,
        notes: notes.trim() || undefined,
        category: topCategory,
        status: "open",
        line_items: lineItems.map((li) => ({
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          tax_rate: li.tax_rate,
          category: li.category || "Other",
        })),
      };

      if (editId) {
        await flaskApi.patch(`/bills/${editId}`, payload);
        toast.success(`Bill ${billNumber} updated`);
      } else {
        await database.createBill(clientId, payload);
        toast.success(`Bill ${billNumber} created`);
      }
      queryClient.invalidateQueries({ queryKey: ["expense-bills"] });
      queryClient.invalidateQueries({ queryKey: ["expense-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["fr-bills"] });
      queryClient.invalidateQueries({ queryKey: ["cc-bills"] });
      navigate("/expenses");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save bill");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/expenses")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text">
              {editId ? "Edit Bill" : "Create Bill"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Capture a supplier bill with multiple line items, each with its own category.
            </p>
          </div>
        </div>

        {/* Bill details */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Bill Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Vendor *</Label>
                <Select value={vendorName} onValueChange={setVendorName}>
                  <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                  <SelectContent>
                    {vendors.map((v: any) => (
                      <SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="...or type a new vendor name"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Bill Number</Label>
                <Input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Bill Date</Label>
                <Input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Due Date</Label>
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vendor contact */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-semibold">Vendor Contact</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Address</Label>
              <Textarea
                placeholder="Supplier billing address"
                value={vendorAddress}
                onChange={(e) => setVendorAddress(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Phone</Label>
                <Input placeholder="+971..." value={vendorPhone} onChange={(e) => setVendorPhone(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email</Label>
                <Input type="email" placeholder="supplier@example.com" value={vendorEmail} onChange={(e) => setVendorEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">TRN</Label>
                <Input placeholder="100123456789003" value={vendorTrn} onChange={(e) => setVendorTrn(e.target.value)} />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              These details are saved on the vendor record and reused on future bills.
            </p>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="text-sm font-semibold">Line Items</CardTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setLineItems([...lineItems, newLine()])}>
                <Plus className="h-3 w-3" /> Add Item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
              <div className="col-span-3">Description</div>
              <div className="col-span-1">Qty</div>
              <div className="col-span-2">Unit Price</div>
              <div className="col-span-1">Tax</div>
              <div className="col-span-3">Category</div>
              <div className="col-span-1 text-right">Amount</div>
              <div className="col-span-1"></div>
            </div>
            {lineItems.map((li) => {
              const lineTotal = li.quantity * li.unit_price * (1 + li.tax_rate / 100);
              const taxKind: "standard" | "zero" | "exempt" =
                li.tax_rate === 5 ? "standard" : (li._tax_kind === "exempt" ? "exempt" : "zero");
              return (
                <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <Input
                      placeholder="Item description"
                      value={li.description}
                      onChange={(e) => updateLine(li.id, "description", e.target.value)}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="col-span-1">
                    <Input
                      type="number"
                      min="1"
                      value={li.quantity}
                      onChange={(e) => updateLine(li.id, "quantity", parseInt(e.target.value) || 1)}
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
                      onChange={(e) => updateLine(li.id, "unit_price", parseFloat(e.target.value) || 0)}
                      className="text-sm h-9"
                    />
                  </div>
                  <div className="col-span-1">
                    <Select
                      value={taxKind}
                      onValueChange={(v) => {
                        const rate = v === "standard" ? 5 : 0;
                        const kind = v === "standard" ? undefined : (v as "zero" | "exempt");
                        setLineItems((prev) =>
                          prev.map((x) => (x.id === li.id ? { ...x, tax_rate: rate, _tax_kind: kind } : x)),
                        );
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm px-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">5%</SelectItem>
                        <SelectItem value="zero">Zero Tax</SelectItem>
                        <SelectItem value="exempt">Tax Exempt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3">
                    <CategorySelect
                      value={li.category || "Other"}
                      onChange={(v) => updateLine(li.id, "category", v)}
                      type="bill"
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
                      onClick={() => removeLine(li.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Totals + notes */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">Notes</Label>
              <Textarea placeholder="Payment terms, internal notes..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5 text-sm max-w-xs ml-auto">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span><FC amount={subtotal} currency={currency} /></span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span><FC amount={totalTax} currency={currency} /></span></div>
              <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span className="text-red-500"><FC amount={grandTotal} currency={currency} /></span></div>
            </div>
          </CardContent>
        </Card>

        {/* Save bar */}
        <div className="flex justify-end gap-2 pb-8">
          <Button variant="outline" onClick={() => navigate("/expenses")} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editId ? "Update Bill" : "Create Bill"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
