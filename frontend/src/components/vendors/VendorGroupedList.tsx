import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Tag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { guessCategory } from "@/lib/sectorMapping";
import { PREDEFINED_SECTORS } from "@/lib/predefinedSectors";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

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
  const fmt = (v: number) => formatAmount(v, currency);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [applying, setApplying] = useState(false);
  const queryClient = useQueryClient();

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

  // Group vendors by category (use guessCategory for auto-detection)
  const grouped = useMemo(() => {
    const groups = new Map<string, ConsolidatedVendor[]>();
    filteredVendors.forEach((v) => {
      const cat = v.category || guessCategory(v.name) || "Other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(v);
    });
    // Sort: Other last
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    });
  }, [filteredVendors]);

  // Get bills per vendor (using all vendor IDs for consolidated vendors)
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

  return (
    <div className="relative">
      <Accordion type="multiple" className="space-y-2">
        {grouped.map(([category, vendorList]) => {
          const categoryTotal = vendorList.reduce((s, v) => {
            const vBills = vendorBillsMap.get(v.id) || [];
            const billTotal = vBills.reduce((bs, b) => bs + Number(b.total_amount || 0), 0);
            return s + (billTotal || v.balance);
          }, 0);
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
                  <span className="text-sm font-medium">{fmt(categoryTotal)}</span>
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
                        <div className="flex items-center gap-3">
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={vendor.category || guessCategory(vendor.name) || "uncategorized"}
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
                            {vendorTotal > 0 ? fmt(vendorTotal) : fmt(vendor.balance)}
                          </span>
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
    </div>
  );
}
