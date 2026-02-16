import { useState, useMemo } from "react";
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
import { QuarterNavigator, getCurrentQuarter } from "@/components/dashboard/QuarterNavigator";
import { toast } from "sonner";
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
  const { quarter: initQ, year: initY } = getCurrentQuarter();
  const [quarter, setQuarter] = useState(initQ);
  const [year, setYear] = useState(initY);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vendors").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: bills = [] } = useQuery({
    queryKey: ["vendor-bills"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills").select("*").order("bill_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

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

  const quarterLabel = `Q${quarter} ${year}`;

  const columns: ColumnDef<any>[] = [
    { accessorKey: "name", header: "Vendor Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "category", header: "Category", cell: ({ row }) => row.original.category || <span className="text-muted-foreground">—</span> },
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
            <QuarterNavigator currentQuarter={quarter} currentYear={year} onNavigate={(q, y) => { setQuarter(q); setYear(y); }} />
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
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
            <VendorInsightsPanel vendors={vendors || []} bills={bills} quarterLabel={quarterLabel} />
            <VendorGroupedList vendors={vendors || []} bills={bills} onEdit={handleEdit} onView={handleView} onDelete={handleDelete} />
          </div>
        )}

        <VendorDialog open={dialogOpen} onOpenChange={setDialogOpen} vendor={selectedVendor} onSuccess={() => refetch()} />
        <VendorDetail open={detailOpen} onOpenChange={setDetailOpen} vendorId={selectedVendor?.id} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Vendor" description="Are you sure you want to delete this vendor? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="vendor" />
      </div>
    </Layout>
  );
}
