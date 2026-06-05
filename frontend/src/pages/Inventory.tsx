import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Package, Plus, Pencil, Trash2, Search, Loader2, AlertTriangle,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { database } from "@/lib/database";
import { FC } from "@/components/shared/FormattedCurrency";
import { CategorySelect } from "@/components/shared/CategorySelect";
import { toast } from "sonner";

const UNITS = ["each", "box", "pack", "kg", "g", "litre", "metre", "hour", "day"];
const CURRENCIES = ["AED", "USD", "EUR", "GBP", "SAR", "INR"];

interface FormState {
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: string;
  unit_price: string;
  cost_price: string;
  tax_rate: string;
  quantity_on_hand: string;
  reorder_level: string;
  currency: string;
  is_active: boolean;
}

const blank = (currency: string): FormState => ({
  sku: "",
  name: "",
  description: "",
  category: "Other",
  unit: "each",
  unit_price: "0",
  cost_price: "0",
  tax_rate: "5",
  quantity_on_hand: "0",
  reorder_level: "0",
  currency,
  is_active: true,
});

export default function Inventory() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank(currency || "AED"));
  const [saving, setSaving] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["inventory", clientId],
    queryFn: () => database.getInventory(clientId!),
    enabled: !!clientId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it: any) => {
      if (q && !`${it.name} ${it.sku || ""} ${it.description || ""}`.toLowerCase().includes(q)) return false;
      if (stockFilter === "in" && it.quantity_on_hand <= 0) return false;
      if (stockFilter === "out" && it.quantity_on_hand > 0) return false;
      if (stockFilter === "low") {
        const reorder = it.reorder_level || 0;
        if (!(it.quantity_on_hand > 0 && reorder > 0 && it.quantity_on_hand <= reorder)) return false;
      }
      return true;
    });
  }, [items, search, stockFilter]);

  const stats = useMemo(() => {
    let totalValue = 0, lowCount = 0, outCount = 0;
    for (const it of items) {
      totalValue += (it.quantity_on_hand || 0) * (it.cost_price || 0);
      if (it.quantity_on_hand <= 0) outCount++;
      else if ((it.reorder_level || 0) > 0 && it.quantity_on_hand <= it.reorder_level) lowCount++;
    }
    return { totalValue, lowCount, outCount, total: items.length };
  }, [items]);

  const openNew = () => {
    setEditingId(null);
    setForm(blank(currency || "AED"));
    setOpen(true);
  };

  const openEdit = (it: any) => {
    setEditingId(it.id);
    setForm({
      sku: it.sku || "",
      name: it.name || "",
      description: it.description || "",
      category: it.category || "Other",
      unit: it.unit || "each",
      unit_price: String(it.unit_price ?? 0),
      cost_price: String(it.cost_price ?? 0),
      tax_rate: String(it.tax_rate ?? 5),
      quantity_on_hand: String(it.quantity_on_hand ?? 0),
      reorder_level: String(it.reorder_level ?? 0),
      currency: it.currency || currency || "AED",
      is_active: !!it.is_active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!clientId) return;
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        sku: form.sku.trim() || undefined,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
        unit: form.unit,
        unit_price: parseFloat(form.unit_price) || 0,
        cost_price: parseFloat(form.cost_price) || 0,
        tax_rate: parseFloat(form.tax_rate) || 0,
        quantity_on_hand: parseFloat(form.quantity_on_hand) || 0,
        reorder_level: parseFloat(form.reorder_level) || 0,
        currency: form.currency,
        is_active: form.is_active,
      };
      if (editingId) {
        await database.updateInventoryItem(editingId, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await database.createInventoryItem(clientId, payload);
        toast.success(`${payload.name} added`);
      }
      queryClient.invalidateQueries({ queryKey: ["inventory", clientId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-inventory"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (it: any) => {
    if (!window.confirm(`Delete "${it.name}"? This cannot be undone.`)) return;
    try {
      await database.deleteInventoryItem(it.id);
      queryClient.invalidateQueries({ queryKey: ["inventory", clientId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-inventory"] });
      toast.success(`${it.name} deleted`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-heading gradient-text flex items-center gap-2">
              <Package className="h-6 w-6 text-primary" /> Inventory
            </h1>
            <p className="text-muted-foreground text-sm">
              Track products and services you sell. Items added here are pickable on invoices.
            </p>
          </div>
          <Button onClick={openNew} className="gap-1.5">
            <Plus className="h-4 w-4" /> Add Item
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPI label="Total Items" value={String(stats.total)} />
          <KPI
            label="Stock Value (cost)"
            value={<FC amount={stats.totalValue} currency={currency} />}
          />
          <KPI
            label="Low Stock"
            value={String(stats.lowCount)}
            tint={stats.lowCount > 0 ? "text-amber-600" : "text-muted-foreground"}
          />
          <KPI
            label="Out of Stock"
            value={String(stats.outCount)}
            tint={stats.outCount > 0 ? "text-red-600" : "text-muted-foreground"}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Items</CardTitle>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, SKU, description…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
                <SelectTrigger className="w-[180px] h-9">
                  <SelectValue placeholder="Stock filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stock</SelectItem>
                  <SelectItem value="in">In stock</SelectItem>
                  <SelectItem value="low">Low (≤ reorder)</SelectItem>
                  <SelectItem value="out">Out of stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading inventory…
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium mb-1">
                  {items.length === 0 ? "No inventory items yet" : "No items match your filter"}
                </p>
                {items.length === 0 && (
                  <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={openNew}>
                    <Plus className="h-3.5 w-3.5" /> Add your first item
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">SKU</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Sell Price</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="w-[60px]">Tax</TableHead>
                      <TableHead className="w-[120px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((it: any) => {
                      const out = it.quantity_on_hand <= 0;
                      const low = !out && (it.reorder_level || 0) > 0 && it.quantity_on_hand <= it.reorder_level;
                      return (
                        <TableRow key={it.id} className="hover:bg-muted/40">
                          <TableCell className="font-mono text-xs text-muted-foreground">{it.sku || "—"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{it.name}</p>
                              {it.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[260px]">{it.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">{it.category || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <FC amount={it.unit_price || 0} currency={it.currency || currency} />
                            <span className="text-[10px] text-muted-foreground"> / {it.unit || "each"}</span>
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            <span className={out ? "text-red-600 font-medium" : low ? "text-amber-600 font-medium" : ""}>
                              {(it.quantity_on_hand || 0).toLocaleString()}
                            </span>
                            {(low || out) && (
                              <span className="inline-flex items-center gap-1 ml-1 align-middle">
                                <AlertTriangle className="h-3 w-3" />
                              </span>
                            )}
                            <p className="text-[10px] text-muted-foreground">{it.unit || "each"}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{it.tax_rate ?? 5}%</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(it)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDelete(it)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add / Edit dialog */}
        <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Item" : "Add Inventory Item"}</DialogTitle>
              <DialogDescription>
                Items added here are pickable on every Create Invoice line.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 col-span-1">
                  <Label className="text-xs">SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="OPT-001" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Name *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website redesign" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Short description for the invoice line" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <CategorySelect
                    value={form.category}
                    onChange={(v) => setForm({ ...form, category: v })}
                    type="invoice"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Unit</Label>
                  <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sell Price</Label>
                  <Input type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Cost Price</Label>
                  <Input type="number" step="0.01" min="0" value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tax %</Label>
                  <Input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Stock on Hand</Label>
                  <Input type="number" step="0.01" value={form.quantity_on_hand} onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reorder Level</Label>
                  <Input type="number" step="0.01" min="0" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="text-xs">Active (pickable on invoices)</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || !form.name.trim()}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                  {editingId ? "Save Changes" : "Add Item"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function KPI({ label, value, tint }: { label: string; value: any; tint?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={`text-lg font-semibold mt-0.5 ${tint || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
