import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Tags, List, Layers, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { VendorDialog } from "@/components/vendors/VendorDialog";
import { VendorDetail } from "@/components/vendors/VendorDetail";
import { VendorInsightsPanel } from "@/components/vendors/VendorInsightsPanel";
import { VendorGroupedList } from "@/components/vendors/VendorGroupedList";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { CategoryManager } from "@/components/shared/CategoryManager";
import { QuarterNavigator, DateMode } from "@/components/dashboard/QuarterNavigator";
import { format } from "date-fns";
import { toast } from "sonner";
import { guessCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

export default function Vendors() {
  const { currency } = useCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [currentYear, setCurrentYear] = useState(2025);
  const [customFrom, setCustomFrom] = useState<Date>(new Date(2025, 0, 1));
  const [customTo, setCustomTo] = useState<Date>(new Date(2025, 11, 31, 23, 59, 59));

  const { quarterFrom, quarterTo } = useMemo(() => {
    if (dateMode === "year") {
      return {
        quarterFrom: new Date(currentYear, 0, 1),
        quarterTo: new Date(currentYear, 11, 31, 23, 59, 59),
      };
    }
    return { quarterFrom: customFrom, quarterTo: customTo };
  }, [dateMode, currentYear, customFrom, customTo]);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["vendor-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("bill_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Filter bills by selected quarter
  const quarterBills = useMemo(() => {
    return allBills.filter((b) => {
      const d = new Date(b.bill_date);
      return d >= quarterFrom && d <= quarterTo;
    });
  }, [allBills, quarterFrom, quarterTo]);

  // Vendors with activity in the selected quarter (have bills or created in quarter)
  const activeVendorIds = useMemo(() => {
    const ids = new Set<string>();
    quarterBills.forEach((b) => { if (b.vendor_id) ids.add(b.vendor_id); });
    (vendors || []).forEach((v) => {
      const created = new Date(v.created_at);
      if (created >= quarterFrom && created <= quarterTo) ids.add(v.id);
    });
    return ids;
  }, [quarterBills, vendors, quarterFrom, quarterTo]);

  // Auto-map sector from vendor name if no explicit category
  const getVendorCategory = (v: any): string =>
    v.category || guessCategory(v.name) || "Other";

  // Unique auto-mapped sectors for CategoryManager
  const vendorSectors = useMemo(() => {
    const cats = new Set<string>();
    (vendors || []).forEach((v) => {
      const cat = getVendorCategory(v);
      if (cat && cat !== "Other") cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [vendors]);

  const handleEdit = (vendor: any) => { setSelectedVendor(vendor); setDialogOpen(true); };
  const handleView = (vendor: any) => { setSelectedVendor(vendor); setDetailOpen(true); };
  const handleDelete = async (id: string) => { setVendorToDelete(id); setDeleteDialogOpen(true); };

  const confirmDelete = async () => {
    if (!vendorToDelete) return;
    try {
      const { error } = await supabase.from("vendors").delete().eq("id", vendorToDelete);
      if (error) throw error;
      toast.success("Vendor deleted successfully");
      refetch();
    } catch { toast.error("Failed to delete vendor"); } finally { setDeleteDialogOpen(false); setVendorToDelete(null); }
  };

  const quarterLabel = dateMode === "year" ? `${currentYear}` : `${format(customFrom, "MMM dd, yyyy")} – ${format(customTo, "MMM dd, yyyy")}`;

  const columns: ColumnDef<any>[] = [
    { accessorKey: "name", header: "Vendor Name", cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.name}</span>
        {row.original.source === 'odoo' && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">From Odoo</Badge>}
      </div>
    )},
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "category", header: "Category", cell: ({ row }) => {
      const cat = getVendorCategory(row.original);
      const style = getSectorStyle(cat.toLowerCase(), 0);
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeBg} ${style.badgeText}`}>
          {cat}
        </span>
      );
    }},
    {
      accessorKey: "balance", header: "Balance",
      cell: ({ row }) => {
        const balance = row.original.balance || 0;
        return <span className={balance > 0 ? "text-destructive font-medium" : ""}>{formatAmount(balance, currency)}</span>;
      },
    },
    { id: "actions", cell: ({ row }) => <DataTableRowActions onView={() => handleView(row.original)} onEdit={() => handleEdit(row.original)} onDelete={() => handleDelete(row.original.id)} /> },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-muted-foreground">Manage your vendors and suppliers</p>
          </div>
          <div className="flex gap-2">
            <QuarterNavigator
              currentQuarter={0}
              currentYear={currentYear}
              onNavigate={(_, y) => setCurrentYear(y)}
              mode={dateMode}
              onModeChange={(m) => setDateMode(m as DateMode)}
              modes={["year", "custom"]}
              customFrom={customFrom}
              customTo={customTo}
              onCustomDateChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
            />
            <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)}>
              <Tags className="h-4 w-4 mr-2" />
              Categories
            </Button>
            <div className="flex border rounded-lg overflow-hidden">
              <Button variant={viewMode === "list" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("list")}>
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === "grouped" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("grouped")}>
                <Layers className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => { setSelectedVendor(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </div>
        </div>

        {!isLoading && (!vendors || vendors.length === 0) ? (
          <EmptyState icon={Plus} title="No vendors yet" description="Get started by adding your first vendor" actionLabel="Add Vendor" onAction={() => setDialogOpen(true)} />
        ) : viewMode === "list" ? (
          <DataTable columns={columns} data={vendors || []} searchKey="name" searchPlaceholder="Search vendors..." isLoading={isLoading} />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <VendorInsightsPanel
                vendors={vendors || []}
                bills={quarterBills}
                quarterLabel={quarterLabel}
                quarterFrom={quarterFrom}
                quarterTo={quarterTo}
              />
              <VendorGroupedList
                vendors={vendors || []}
                bills={quarterBills}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                onRefresh={() => refetch()}
                searchQuery={searchQuery}
              />
            </div>
          </div>
        )}

        <VendorDialog open={dialogOpen} onOpenChange={setDialogOpen} vendor={selectedVendor} onSuccess={() => refetch()} />
        <VendorDetail open={detailOpen} onOpenChange={setDetailOpen} vendorId={selectedVendor?.id} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Vendor" description="Are you sure you want to delete this vendor? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="vendor" availableSectors={vendorSectors} />
      </div>
    </Layout>
  );
}
