import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Users, Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import { DataTableColumnHeader } from "@/components/shared/DataTableColumnHeader";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { CustomerDetail } from "@/components/customers/CustomerDetail";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/hooks/useCurrency";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  balance: number;
  notes: string | null;
  created_at: string;
}

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Customer[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const { toast } = useToast();
  const { currency } = useCurrency();

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch customers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (customerId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("customers")
        .delete()
        .eq("id", customerId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Customer deleted successfully",
      });

      fetchCustomers();
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customer",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = selectedRows.map((row) => row.id);
      const { error } = await supabase
        .from("customers")
        .delete()
        .in("id", ids);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${ids.length} customer(s) deleted successfully`,
      });

      fetchCustomers();
      setDeleteDialogOpen(false);
      setSelectedRows([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete customers",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const columns: ColumnDef<Customer>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
      cell: ({ row }) => {
        return (
          <div>
            <div className="font-medium">{row.getValue("name")}</div>
            {row.original.email && (
              <div className="text-sm text-muted-foreground">{row.original.email}</div>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => {
        const phone = row.getValue("phone") as string | null;
        return phone ? <span>{phone}</span> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "city",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
      cell: ({ row }) => {
        const city = row.original.city;
        const state = row.original.state;
        const location = [city, state].filter(Boolean).join(", ");
        return location ? <span>{location}</span> : <span className="text-muted-foreground">-</span>;
      },
    },
    {
      accessorKey: "balance",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
      cell: ({ row }) => {
        const balance = row.getValue("balance") as number;
        return (
          <span className={balance > 0 ? "text-green-600 font-medium" : ""}>
            {formatCurrency(balance)}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const customer = row.original;
        return (
          <DataTableRowActions
            onView={() => {
              setSelectedCustomerId(customer.id);
              setDetailOpen(true);
            }}
            onEdit={() => {
              setSelectedCustomer(customer);
              setDialogOpen(true);
            }}
            onDelete={() => {
              setSelectedCustomer(customer);
              setDeleteDialogOpen(true);
            }}
          />
        );
      },
    },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Customers</h1>
            <p className="text-muted-foreground mt-1">Manage your customer relationships</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>

        {!isLoading && customers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Get started by adding your first customer"
            actionLabel="Add Customer"
            onAction={() => setDialogOpen(true)}
          />
        ) : (
          <DataTable
            columns={columns}
            data={customers}
            searchKey="name"
            searchPlaceholder="Search customers..."
            isLoading={isLoading}
            enableRowSelection
            onRowSelectionChange={setSelectedRows}
            bulkActions={
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            }
            emptyMessage="No customers found"
            exportFileName="customers"
          />
        )}

        <CustomerDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedCustomer(null);
          }}
          customer={selectedCustomer || undefined}
          onSuccess={fetchCustomers}
        />

        <CustomerDetail
          open={detailOpen}
          onOpenChange={setDetailOpen}
          customerId={selectedCustomerId}
        />

        <ConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={selectedRows.length > 0 ? "Delete Multiple Customers" : "Delete Customer"}
          description={
            selectedRows.length > 0
              ? `Are you sure you want to delete ${selectedRows.length} customer(s)? This action cannot be undone.`
              : `Are you sure you want to delete ${selectedCustomer?.name}? This action cannot be undone.`
          }
          confirmLabel="Delete"
          variant="destructive"
          onConfirm={() => {
            if (selectedRows.length > 0) {
              handleBulkDelete();
            } else if (selectedCustomer) {
              handleDelete(selectedCustomer.id);
            }
          }}
          isLoading={isDeleting}
        />
      </div>
    </Layout>
  );
}
