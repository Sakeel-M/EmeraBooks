import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { BillForm } from "@/components/bills/BillForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

export default function Bills() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);

  const { data: bills, isLoading, refetch } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          vendors (name)
        `)
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (bill: any) => {
    setSelectedBill(bill);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setBillToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    
    try {
      await supabase.from("bill_items").delete().eq("bill_id", billToDelete);
      const { error } = await supabase.from("bills").delete().eq("id", billToDelete);
      
      if (error) throw error;
      toast.success("Bill deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete bill");
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setBillToDelete(null);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "bill_number",
      header: "Bill Number",
    },
    {
      accessorKey: "vendors.name",
      header: "Vendor",
      cell: ({ row }) => row.original.vendors?.name || "-",
    },
    {
      accessorKey: "bill_date",
      header: "Bill Date",
      cell: ({ row }) => new Date(row.original.bill_date).toLocaleDateString(),
    },
    {
      accessorKey: "due_date",
      header: "Due Date",
      cell: ({ row }) => new Date(row.original.due_date).toLocaleDateString(),
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: ({ row }) => `$${row.original.total_amount.toFixed(2)}`,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DataTableRowActions
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
            <h1 className="text-3xl font-bold">Bills</h1>
            <p className="text-muted-foreground">Track and manage your bills</p>
          </div>
          <Button onClick={() => { setSelectedBill(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Bill
          </Button>
        </div>

        {!isLoading && (!bills || bills.length === 0) ? (
          <EmptyState
            icon={Plus}
            title="No bills yet"
            description="Create your first bill to start tracking expenses"
            actionLabel="Create Bill"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={bills || []}
            searchKey="bill_number"
            searchPlaceholder="Search bills..."
            isLoading={isLoading}
          />
        )}

        <BillForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          bill={selectedBill}
          onSuccess={refetch}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Bill"
          description="Are you sure you want to delete this bill? This action cannot be undone."
        />
      </div>
    </Layout>
  );
}
