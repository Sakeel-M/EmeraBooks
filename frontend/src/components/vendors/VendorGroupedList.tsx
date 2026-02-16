import { useMemo, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";

interface VendorGroupedListProps {
  vendors: any[];
  bills: any[];
  onEdit: (vendor: any) => void;
  onView: (vendor: any) => void;
  onDelete: (id: string) => void;
}

export function VendorGroupedList({ vendors, bills, onEdit, onView, onDelete }: VendorGroupedListProps) {
  const fmt = (v: number) => `$${v.toFixed(2)}`;

  // Group vendors by category
  const grouped = useMemo(() => {
    const groups = new Map<string, any[]>();
    vendors.forEach((v) => {
      const cat = v.category || "Uncategorized";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(v);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [vendors]);

  // Get bills per vendor
  const vendorBills = useMemo(() => {
    const map = new Map<string, any[]>();
    bills.forEach((b) => {
      if (b.vendor_id) {
        if (!map.has(b.vendor_id)) map.set(b.vendor_id, []);
        map.get(b.vendor_id)!.push(b);
      }
    });
    return map;
  }, [bills]);

  return (
    <Accordion type="multiple" className="space-y-2">
      {grouped.map(([category, vendorList]) => {
        const categoryTotal = vendorList.reduce((s, v) => s + Number(v.balance || 0), 0);
        return (
          <AccordionItem key={category} value={category} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{category}</span>
                  <Badge variant="secondary" className="text-xs">{vendorList.length}</Badge>
                </div>
                <span className="text-sm font-medium">{fmt(categoryTotal)}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1 pb-2">
                {vendorList.map((vendor) => {
                  const vBills = vendorBills.get(vendor.id) || [];
                  const vendorTotal = vBills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
                  return (
                    <div
                      key={vendor.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
                      onClick={() => onView(vendor)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {vendor.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{vendor.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vendor.email || "No email"} · {vBills.length} bills
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold">
                          {vendorTotal > 0 ? fmt(vendorTotal) : fmt(Number(vendor.balance || 0))}
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
  );
}
