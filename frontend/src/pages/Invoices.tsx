import { useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toast } from "sonner";

export default function Invoices() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`
          *,
          customers (name)
        `)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    setInvoiceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    
    try {
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceToDelete);
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceToDelete);
      
      if (error) throw error;
      toast.success("Invoice deleted successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to delete invoice");
      console.error(error);
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "invoice_number",
      header: "Invoice Number",
    },
    {
      accessorKey: "customers.name",
      header: "Customer",
      cell: ({ row }) => row.original.customers?.name || "-",
    },
    {
      accessorKey: "invoice_date",
      header: "Invoice Date",
      cell: ({ row }) => new Date(row.original.invoice_date).toLocaleDateString(),
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
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Create and manage customer invoices</p>
          </div>
          <Button onClick={() => { setSelectedInvoice(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Invoice
          </Button>
        </div>

        {!isLoading && (!invoices || invoices.length === 0) ? (
          <EmptyState
            icon={Plus}
            title="No invoices yet"
            description="Create your first invoice to start billing customers"
            actionLabel="Create Invoice"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={invoices || []}
            searchKey="invoice_number"
            searchPlaceholder="Search invoices..."
            isLoading={isLoading}
          />
        )}

        <InvoiceForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          invoice={selectedInvoice}
          onSuccess={refetch}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={confirmDelete}
          title="Delete Invoice"
          description="Are you sure you want to delete this invoice? This action cannot be undone."
        />
      </div>
    </Layout>
  );
}
