import { useState, useEffect, useMemo } from "react";
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
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { useCurrency } from "@/hooks/useCurrency";
import { guessCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";
import { cn } from "@/lib/utils";

interface InvoiceSummary {
  id: string;
  total_amount: number;
  amount_paid: number | null;
  status: string | null;
}

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
  invoices?: InvoiceSummary[];
  // Computed
  totalInvoiced?: number;
  totalPaid?: number;
  outstandingReceivable?: number;
  outstandingCount?: number;
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
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
        .select("*, invoices(id, total_amount, amount_paid, status)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const enriched = (data || []).map((c: any) => {
        const invs: InvoiceSummary[] = c.invoices || [];
        const totalInvoiced = invs.reduce((sum, i) => sum + (i.total_amount || 0), 0);
        const totalPaid = invs.reduce((sum, i) => sum + (i.amount_paid || 0), 0);
        const outstandingReceivable = invs
          .filter((i) => i.status === "sent" || i.status === "overdue")
          .reduce((sum, i) => sum + Math.max(0, (i.total_amount || 0) - (i.amount_paid || 0)), 0);
        const outstandingCount = invs.filter(
          (i) => i.status === "sent" || i.status === "overdue"
        ).length;
        return { ...c, totalInvoiced, totalPaid, outstandingReceivable, outstandingCount };
      });

      setCustomers(enriched);
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

  // Unique categories derived from customer names
  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    customers.forEach((c) => {
      const cat = guessCategory(c.name);
      cats.add(cat || "Other");
    });
    return Array.from(cats).sort();
  }, [customers]);

  // Filtered customers by selected category
  const filteredCustomers = useMemo(() => {
    if (!selectedCategory) return customers;
    return customers.filter((c) => {
      const cat = guessCategory(c.name) || "Other";
      return cat === selectedCategory;
    });
  }, [customers, selectedCategory]);

  const handleDelete = async (customerId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("customers").delete().eq("id", customerId);
      if (error) throw error;
      toast({ title: "Success", description: "Customer deleted successfully" });
      fetchCustomers();
      setDeleteDialogOpen(false);
      setSelectedCustomer(null);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete customer", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsDeleting(true);
    try {
      const ids = selectedRows.map((row) => row.id);
      const { error } = await supabase.from("customers").delete().in("id", ids);
      if (error) throw error;
      toast({ title: "Success", description: `${ids.length} customer(s) deleted successfully` });
      fetchCustomers();
      setDeleteDialogOpen(false);
      setSelectedRows([]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to delete customers", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

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
        const name = row.getValue("name") as string;
        const displayName = name.length > 35 ? name.slice(0, 35) + "…" : name;
        const isLong = name.length > 35;
        const isOdoo = (row.original as any).source === "odoo";
        return (
          <div>
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-medium cursor-default">{displayName}</span>
                  </TooltipTrigger>
                  {isLong && (
                    <TooltipContent side="top" className="max-w-xs break-words">
                      {name}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              {isOdoo && (
                <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                  From Odoo
                </Badge>
              )}
            </div>
            {row.original.email && (
              <div className="text-sm text-muted-foreground">{row.original.email}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "sector",
      header: "Sector",
      cell: ({ row }) => {
        const sector = guessCategory(row.original.name) || "Other";
        const style = getSectorStyle(sector.toLowerCase(), 0);
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeBg} ${style.badgeText}`}
          >
            {sector}
          </span>
        );
      },
    },
    {
      id: "totalInvoiced",
      header: ({ column }) => <DataTableColumnHeader column={column as any} title="Total Invoiced" />,
      cell: ({ row }) => {
        const total = row.original.totalInvoiced || 0;
        const count = (row.original.invoices || []).length;
        return (
          <div>
            <span className={total > 0 ? "font-medium" : "text-muted-foreground"}>
              {formatCurrency(total)}
            </span>
            {count > 0 && (
              <div className="text-xs text-muted-foreground">{count} invoice{count !== 1 ? "s" : ""}</div>
            )}
          </div>
        );
      },
    },
    {
      id: "receivable",
      header: ({ column }) => <DataTableColumnHeader column={column as any} title="Receivable" />,
      cell: ({ row }) => {
        const outstanding = row.original.outstandingReceivable || 0;
        const count = row.original.outstandingCount || 0;
        if (outstanding <= 0) {
          return <span className="text-muted-foreground">{formatCurrency(0)}</span>;
        }
        return (
          <div>
            <span className="font-medium text-amber-600">{formatCurrency(outstanding)}</span>
            {count > 0 && (
              <div className="text-xs text-muted-foreground">{count} unpaid</div>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const invs = row.original.invoices || [];
        const outstanding = row.original.outstandingReceivable || 0;
        const total = row.original.totalInvoiced || 0;
        if (invs.length === 0) {
          return <span className="text-muted-foreground text-xs">No invoices</span>;
        }
        if (outstanding > 0) {
          return <StatusBadge status="sent" />;
        }
        if (total > 0) {
          return <StatusBadge status="paid" />;
        }
        return <span className="text-muted-foreground text-xs">—</span>;
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

        {/* Category filter pills */}
        {!isLoading && customers.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                !selectedCategory
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
              )}
            >
              All ({customers.length})
            </button>
            {availableCategories.map((cat) => {
              const count = customers.filter((c) => (guessCategory(c.name) || "Other") === cat).length;
              const style = getSectorStyle(cat.toLowerCase(), 0);
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(isActive ? null : cat)}
                  className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    isActive
                      ? `${style.badgeBg} ${style.badgeText} border-transparent`
                      : "bg-background text-muted-foreground border-border hover:border-primary hover:text-foreground"
                  )}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>
        )}

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
            data={filteredCustomers}
            searchKey="name"
            searchPlaceholder="Search customers..."
            isLoading={isLoading}
            enableRowSelection
            onRowSelectionChange={setSelectedRows}
            onRowClick={(customer) => {
              setSelectedCustomerId(customer.id);
              setDetailOpen(true);
            }}
            bulkActions={
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
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
          onEditCustomer={(customer) => {
            setDetailOpen(false);
            setSelectedCustomer(customer);
            setDialogOpen(true);
          }}
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
