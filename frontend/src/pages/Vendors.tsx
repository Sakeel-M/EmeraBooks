import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { VendorDialog } from "@/components/vendors/VendorDialog";
import { VendorDetail } from "@/components/vendors/VendorDetail";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { toast } from "sonner";

export default function Vendors() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (vendor: any) => {
    setSelectedVendor(vendor);
    setDialogOpen(true);
  };

  const handleView = (vendor: any) => {
    setSelectedVendor(vendor);
    setDetailOpen(true);
  };

  const handleDelete = async (id: string) => {
    setVendorToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!vendorToDelete) return;
    
    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", vendorToDelete);
      
      if (error) throw error;
      toast.success("Vendor deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete vendor");
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setVendorToDelete(null);
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .in("id", ids);
      
      if (error) throw error;
      toast.success(`${ids.length} vendor(s) deleted successfully`);
      refetch();
    } catch (error) {
      toast.error("Failed to delete vendors");
      console.error(error);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "name",
      header: "Vendor Name",
    },
    {
      accessorKey: "email",
      header: "Email",
    },
    {
      accessorKey: "phone",
      header: "Phone",
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => {
        const balance = row.original.balance || 0;
        return (
          <span className={balance > 0 ? "text-destructive font-medium" : ""}>
            ${balance.toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
          onView={() => handleView(row.original)}
          onEdit={() => handleEdit(row.original)}
          onDelete={() => handleDelete(row.original.id)}
        />
      ),
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-muted-foreground">Manage your vendors and suppliers</p>
          </div>
          <Button onClick={() => { setSelectedVendor(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Vendor
          </Button>
        </div>

        {!isLoading && (!vendors || vendors.length === 0) ? (
          <EmptyState
            icon={Plus}
            title="No vendors yet"
            description="Get started by adding your first vendor"
            actionLabel="Add Vendor"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={vendors || []}
            searchKey="name"
            searchPlaceholder="Search vendors..."
            isLoading={isLoading}
            enableRowSelection
            onRowSelectionChange={(selectedRows) => {
              // Handle row selection if needed
            }}
          />
        )}

        <VendorDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          vendor={selectedVendor}
          onSuccess={refetch}
        />

        <VendorDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          vendorId={selectedVendor?.id}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Vendor"
          description="Are you sure you want to delete this vendor? This action cannot be undone."
        />
      </div>
    </Layout>
  );
}
