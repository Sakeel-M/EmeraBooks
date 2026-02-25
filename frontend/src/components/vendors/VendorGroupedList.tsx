import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { X, Tag, Info, Building2, Receipt, Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveCategory, guessCategory, mapRawBankCategory, getCanonicalCategory } from "@/lib/sectorMapping";
import { PREDEFINED_SECTORS } from "@/lib/predefinedSectors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface VendorGroupedListProps {
  vendors: any[];
  bills: any[];
  onEdit: (vendor: any) => void;
  onView: (vendor: any) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  searchQuery?: string;
}

interface ConsolidatedVendor {
  id: string;
  ids: string[];
  name: string;
  email: string | null;
  category: string | null;
  balance: number;
  source: string | null;
  created_at: string;
  _original: any;
}

export function VendorGroupedList({ vendors, bills, onEdit, onView, onDelete, onRefresh, searchQuery = "" }: VendorGroupedListProps) {
  const { currency } = useCurrency();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [applying, setApplying] = useState(false);
  const queryClient = useQueryClient();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonData, setReasonData] = useState<{ vendor: ConsolidatedVendor; category: string; bills: any[] } | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories", "vendor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .or("type.eq.vendor,type.eq.all")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Deduplicate vendors by name - merge duplicates
  const consolidatedVendors = useMemo(() => {
    const byName = new Map<string, ConsolidatedVendor>();
    vendors.forEach((v) => {
      const key = v.name.toLowerCase().trim();
      if (byName.has(key)) {
        const existing = byName.get(key)!;
        existing.ids.push(v.id);
        existing.balance += Number(v.balance || 0);
        if (!existing.email && v.email) existing.email = v.email;
        if (!existing.category && v.category) existing.category = v.category;
      } else {
        byName.set(key, {
          id: v.id,
          ids: [v.id],
          name: v.name,
          email: v.email,
          category: v.category,
          balance: Number(v.balance || 0),
          source: v.source,
          created_at: v.created_at,
          _original: v,
        });
      }
    });
    return Array.from(byName.values());
  }, [vendors]);

  // Filter by search
  const filteredVendors = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedVendors;
    const q = searchQuery.toLowerCase();
    return consolidatedVendors.filter((v) => v.name.toLowerCase().includes(q));
  }, [consolidatedVendors, searchQuery]);

  // Get bills per vendor (using all vendor IDs for consolidated vendors)
  // Must be declared BEFORE 'grouped' which depends on it
  const vendorBillsMap = useMemo(() => {
    const idToName = new Map<string, string>();
    consolidatedVendors.forEach((cv) => {
      cv.ids.forEach((id) => idToName.set(id, cv.id));
    });
    const map = new Map<string, any[]>();
    bills.forEach((b) => {
      if (b.vendor_id) {
        const consolidatedId = idToName.get(b.vendor_id) || b.vendor_id;
        if (!map.has(consolidatedId)) map.set(consolidatedId, []);
        map.get(consolidatedId)!.push(b);
      }
    });
    return map;
  }, [bills, consolidatedVendors]);

  // Group vendors by category.
  // Priority: most common bill category (resolveCategory) → vendor.category → guess from name → "Other"
  const grouped = useMemo(() => {
    const groups = new Map<string, ConsolidatedVendor[]>();
    filteredVendors.forEach((v) => {
      // Bills have category set by syncBankDataToBusinessRecords via resolveCategory — most reliable
      const vendorBills = vendorBillsMap.get(v.id) || [];
      // Skip vendors with no activity in the selected period
      if (vendorBills.length === 0) return;
      const billCatCounts = new Map<string, number>();
      vendorBills.forEach((b: any) => {
        const resolved = resolveCategory(b.category, b.notes);
        if (!resolved || resolved === "Internal Transfer") return;
        billCatCounts.set(resolved, (billCatCounts.get(resolved) || 0) + 1);
      });
      let bestBillCat = "";
      let maxCount = 0;
      billCatCounts.forEach((count, cat) => {
        if (count > maxCount && cat !== "Other") { maxCount = count; bestBillCat = cat; }
      });

      let cat: string;
      // Vendor name is the most reliable signal — guessCategory uses direct keyword matching
      const nameGuess = guessCategory(v.name);
      if (nameGuess && nameGuess !== "Internal Transfer") {
        cat = nameGuess;
      } else if (bestBillCat) {
        cat = bestBillCat;
      } else {
        // Last resort: stored/mapped category
        const stored = v.category ? (mapRawBankCategory(v.category) || resolveCategory(v.category)) : null;
        cat = stored || "Other";
      }
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(v);
    });
    // Sort: Other last
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [filteredVendors, vendorBillsMap]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroupSelect = (vendorList: ConsolidatedVendor[]) => {
    const ids = vendorList.map((v) => v.id);
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allSelected ? next.delete(id) : next.add(id)));
      return next;
    });
  };

  const handleBulkApply = async () => {
    if (!bulkCategory || selected.size === 0) return;
    setApplying(true);
    try {
      // Gather all real IDs from selected consolidated vendors
      const allIds: string[] = [];
      consolidatedVendors.forEach((cv) => {
        if (selected.has(cv.id)) allIds.push(...cv.ids);
      });
      const categoryValue = bulkCategory === "uncategorized" ? null : bulkCategory;
      const { error } = await supabase
        .from("vendors")
        .update({ category: categoryValue })
        .in("id", allIds);
      if (error) throw error;
      toast.success(`Updated ${allIds.length} vendor(s) to "${bulkCategory === "uncategorized" ? "Uncategorized" : bulkCategory}"`);
      setSelected(new Set());
      setBulkCategory("");
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } catch {
      toast.error("Failed to update vendors");
    } finally {
      setApplying(false);
    }
  };

  const handleInlineCategory = async (vendor: ConsolidatedVendor, category: string) => {
    try {
      const categoryValue = category === "uncategorized" ? null : category;
      // Update all duplicate vendor records
      const { error } = await supabase
        .from("vendors")
        .update({ category: categoryValue })
        .in("id", vendor.ids);
      if (error) throw error;
      toast.success("Category updated");
      onRefresh();
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    } catch {
      toast.error("Failed to update category");
    }
  };

  const openReason = (vendor: ConsolidatedVendor, category: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const vBills = vendorBillsMap.get(vendor.id) || [];
    setReasonData({ vendor, category, bills: vBills });
    setReasonOpen(true);
  };

  // Explain how category was determined for a vendor
  const getCategoryReason = (vendor: ConsolidatedVendor, vBills: any[]): string => {
    const nameGuess = guessCategory(vendor.name);
    if (nameGuess && nameGuess !== "Internal Transfer") {
      return `Matched by vendor name — "${vendor.name}" contains a keyword for "${nameGuess}".`;
    }
    const billCatCounts = new Map<string, number>();
    vBills.forEach((b: any) => {
      const resolved = resolveCategory(b.category, b.notes);
      if (resolved && resolved !== "Internal Transfer" && resolved !== "Other")
        billCatCounts.set(resolved, (billCatCounts.get(resolved) || 0) + 1);
    });
    let bestBillCat = "";
    let maxCount = 0;
    billCatCounts.forEach((count, cat) => { if (count > maxCount) { maxCount = count; bestBillCat = cat; } });
    if (bestBillCat) {
      return `Inferred from ${maxCount} bill(s) in this period whose category resolved to "${bestBillCat}".`;
    }
    if (vendor.category) {
      return `Taken from the stored vendor profile category: "${vendor.category}".`;
    }
    return "Category could not be determined — defaulted to \"Other\".";
  };

  return (
    <div className="relative">
      <Accordion type="multiple" className="space-y-2">
        {grouped.map(([category, vendorList]) => {
          // Sum bills for vendors in this group (vendor_id matched — most accurate)
          const groupIdSet = new Set(vendorList.flatMap((v) => v.ids));
          const categoryTotal = bills
            .filter(b => b.vendor_id && groupIdSet.has(b.vendor_id))
            .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

          const groupIds = vendorList.map((v) => v.id);
          const allGroupSelected = groupIds.length > 0 && groupIds.every((id) => selected.has(id));
          const someGroupSelected = groupIds.some((id) => selected.has(id));

          return (
            <AccordionItem key={category} value={category} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center justify-between w-full mr-4">
                  <div className="flex items-center gap-2">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={allGroupSelected}
                        data-indeterminate={someGroupSelected && !allGroupSelected}
                        onCheckedChange={() => toggleGroupSelect(vendorList)}
                      />
                    </div>
                    <span className="font-semibold text-sm">{category}</span>
                    <Badge variant="secondary" className="text-xs">{vendorList.length}</Badge>
                  </div>
                  {categoryTotal > 0 && <span className="text-sm font-medium"><FormattedCurrency amount={categoryTotal} currency={currency} /></span>}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {vendorList.map((vendor) => {
                    const vBills = vendorBillsMap.get(vendor.id) || [];
                    const vendorTotal = vBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
                    return (
                      <div
                        key={vendor.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                        onClick={() => onView(vendor._original)}
                      >
                        <div className="flex items-center gap-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selected.has(vendor.id)}
                              onCheckedChange={() => toggleSelect(vendor.id)}
                            />
                          </div>
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {vendor.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{vendor.name}</p>
                              {vendor.ids.length > 1 && (
                                <Badge variant="outline" className="text-xs">{vendor.ids.length} merged</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {vendor.email || "No email"} · {vBills.length} bills
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={getCanonicalCategory(vendor.category, vendor.name, null) || "uncategorized"}
                              onValueChange={(val) => handleInlineCategory(vendor, val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-[130px] border-dashed">
                                <Tag className="h-3 w-3 mr-1" />
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="uncategorized">Uncategorized</SelectItem>
                                 {PREDEFINED_SECTORS.map((s) => (
                                   <SelectItem key={s.key + s.name} value={s.name}>{s.name}</SelectItem>
                                 ))}
                                 {categories.filter(c => !PREDEFINED_SECTORS.some(s => s.name === c.name)).map((cat) => (
                                   <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                 ))}
                               </SelectContent>
                            </Select>
                          </div>
                          <span className="text-sm font-semibold">
                            <FormattedCurrency amount={vendorTotal > 0 ? vendorTotal : vendor.balance} currency={currency} />
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                            title="Why is this vendor here?"
                            onClick={(e) => openReason(vendor, category, e)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Floating bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border rounded-lg shadow-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select value={bulkCategory} onValueChange={setBulkCategory}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Choose category" />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="uncategorized">Uncategorized</SelectItem>
               {PREDEFINED_SECTORS.map((s) => (
                 <SelectItem key={s.key + s.name + "bulk"} value={s.name}>{s.name}</SelectItem>
               ))}
               {categories.filter(c => !PREDEFINED_SECTORS.some(s => s.name === c.name)).map((cat) => (
                 <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
               ))}
             </SelectContent>
          </Select>
          <Button size="sm" onClick={handleBulkApply} disabled={!bulkCategory || applying}>
            Apply Category
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Reason Sheet */}
      <Sheet open={reasonOpen} onOpenChange={setReasonOpen}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col overflow-hidden">
          {reasonData && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-primary" />
                  <SheetTitle>{reasonData.vendor.name}</SheetTitle>
                </div>
                <SheetDescription>Why this vendor appears and how its data was determined</SheetDescription>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto mt-4 space-y-5 pr-1">
                {/* Appearance reason */}
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Receipt className="w-4 h-4 text-primary" />
                    Why this vendor is shown
                  </div>
                  {reasonData.bills.length > 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Found <span className="font-medium text-foreground">{reasonData.bills.length} bill{reasonData.bills.length !== 1 ? "s" : ""}</span> in the selected period that are linked to this vendor. Total spend: <span className="font-medium text-foreground"><FormattedCurrency amount={reasonData.bills.reduce((s, b) => s + Number(b.total_amount || 0), 0)} currency={currency} /></span>.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      This vendor exists in your vendor list but has no bills linked in the selected period. It may have been added manually or synced from an earlier upload.
                    </p>
                  )}
                </div>

                {/* Category reason */}
                <div className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Bookmark className="w-4 h-4 text-primary" />
                    Category: <span className="text-primary">{reasonData.category}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {getCategoryReason(reasonData.vendor, reasonData.bills)}
                  </p>
                </div>

                {/* Bill list */}
                {reasonData.bills.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-2">Linked Bills ({reasonData.bills.length})</p>
                      <div className="space-y-1">
                        {reasonData.bills.slice(0, 30).map((b: any, i: number) => (
                          <div key={b.id || i} className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/50 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-foreground">{b.notes || b.description || "—"}</p>
                              <p className="text-xs text-muted-foreground">{b.bill_date} · {resolveCategory(b.category, b.notes) || b.category || "Unknown"}</p>
                            </div>
                            <span className="ml-3 shrink-0 font-medium text-foreground"><FormattedCurrency amount={Number(b.total_amount || 0)} currency={currency} /></span>
                          </div>
                        ))}
                        {reasonData.bills.length > 30 && (
                          <p className="text-xs text-muted-foreground text-center pt-1">Showing first 30 of {reasonData.bills.length}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
