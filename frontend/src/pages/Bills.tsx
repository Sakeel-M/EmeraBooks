import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, FileText, ChevronRight, Tags } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { BillForm } from "@/components/bills/BillForm";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryManager } from "@/components/shared/CategoryManager";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

const STATUS_PIPELINE = [
  { key: "draft", label: "In Review", statuses: ["draft"] },
  { key: "pending", label: "Pending Approval", statuses: ["pending"] },
  { key: "overdue", label: "Awaiting Payment", statuses: ["overdue"] },
  { key: "paid", label: "Scheduled & Paid", statuses: ["paid", "cancelled"] },
];

export default function Bills() {
  const { currency } = useCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState("draft");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const { data: bills, isLoading, refetch } = useQuery({
    queryKey: ["bills"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select(`*, vendors (name)`)
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleEdit = (bill: any) => { setSelectedBill(bill); setDialogOpen(true); };
  const handleDelete = async (id: string) => { setBillToDelete(id); setDeleteDialogOpen(true); };
  const handleDialogClose = (open: boolean) => { setDialogOpen(open); if (!open) setSelectedBill(null); };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    try {
      await supabase.from("bill_items").delete().eq("bill_id", billToDelete);
      const { error } = await supabase.from("bills").delete().eq("id", billToDelete);
      if (error) throw error;
      toast.success("Bill deleted successfully");
      refetch();
    } catch { toast.error("Failed to delete bill"); } finally { setDeleteDialogOpen(false); setBillToDelete(null); }
  };

  // Status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_PIPELINE.forEach((p) => {
      counts[p.key] = (bills || []).filter((b) => p.statuses.includes(b.status || "draft")).length;
    });
    return counts;
  }, [bills]);

  // Filtered bills by pipeline stage
  const activePipeline = STATUS_PIPELINE.find((p) => p.key === activeStatus);
  const filteredBills = useMemo(() => {
    return (bills || []).filter((b) => activePipeline?.statuses.includes(b.status || "draft"));
  }, [bills, activePipeline]);

  const columns: ColumnDef<any>[] = [
    { accessorKey: "bill_number", header: "Bill Number" },
    { accessorKey: "vendors.name", header: "Vendor", cell: ({ row }) => row.original.vendors?.name || "-" },
    { accessorKey: "category", header: "Category", cell: ({ row }) => row.original.category ? <Badge variant="secondary" className="text-xs">{row.original.category}</Badge> : <span className="text-muted-foreground">—</span> },
    { accessorKey: "bill_date", header: "Bill Date", cell: ({ row }) => new Date(row.original.bill_date).toLocaleDateString() },
    { accessorKey: "due_date", header: "Due Date", cell: ({ row }) => new Date(row.original.due_date).toLocaleDateString() },
    { accessorKey: "total_amount", header: "Amount", cell: ({ row }) => formatAmount(row.original.total_amount, currency) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "actions", cell: ({ row }) => <DataTableRowActions onEdit={() => handleEdit(row.original)} onDelete={() => handleDelete(row.original.id)} /> },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bills</h1>
            <p className="text-muted-foreground">Track and manage your bills</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)}>
              <Tags className="h-4 w-4 mr-2" />
              Categories
            </Button>
            <Button onClick={() => { setSelectedBill(null); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bill
            </Button>
          </div>
        </div>

        {/* Status Pipeline Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STATUS_PIPELINE.map((stage) => (
            <button
              key={stage.key}
              onClick={() => setActiveStatus(stage.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                activeStatus === stage.key
                  ? "bg-primary text-primary-foreground font-medium shadow-sm"
                  : "bg-secondary hover:bg-secondary/80 text-foreground"
              }`}
            >
              <span>{stage.label}</span>
              <Badge variant={activeStatus === stage.key ? "outline" : "secondary"} className={`text-xs ${activeStatus === stage.key ? "border-primary-foreground/30 text-primary-foreground" : ""}`}>
                {statusCounts[stage.key] || 0}
              </Badge>
            </button>
          ))}
        </div>

        {/* Content */}
        {!isLoading && filteredBills.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No {activePipeline?.label.toLowerCase()} bills</h3>
              <p className="text-sm text-muted-foreground mb-4">Upload your bills or create one manually</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setSelectedBill(null); setDialogOpen(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Bill
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            data={filteredBills}
            searchKey="bill_number"
            searchPlaceholder="Search bills..."
            isLoading={isLoading}
          />
        )}

        <BillForm open={dialogOpen} onOpenChange={handleDialogClose} bill={selectedBill} onSuccess={refetch} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Bill" description="Are you sure you want to delete this bill? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="bill" />
      </div>
    </Layout>
  );
}
