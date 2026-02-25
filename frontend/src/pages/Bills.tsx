import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Tags, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { BillForm } from "@/components/bills/BillForm";
import { BillDetailSheet } from "@/components/bills/BillDetailSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { CategoryManager } from "@/components/shared/CategoryManager";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount, cn } from "@/lib/utils";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { getCanonicalCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";

export default function Bills() {
  const { currency } = useCurrency();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [billToDelete, setBillToDelete] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [detailBill, setDetailBill] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [yearInitialized, setYearInitialized] = useState(false);

  // ── PRIMARY DATA SOURCE: expense transactions (same as Home page) ──────────
  const { data: expenseTxns = [], isLoading, refetch } = useQuery({
    queryKey: ["expense-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .lt("amount", 0)
        .order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        ...t,
        resolvedCategory: getCanonicalCategory(t.category, null, t.description),
        displayAmount: Math.abs(t.amount),
      }));
    },
  });

  // ── SECONDARY: manually created bills (not from bank sync) ────────────────
  const { data: manualBills = [], refetch: refetchBills } = useQuery({
    queryKey: ["manual-bills"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("bills")
        .select("*, vendors(name)")
        .eq("user_id", user.id)
        .is("source_file_id", null)         // only manual bills
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-detect year from transactions
  useEffect(() => {
    if (!yearInitialized && expenseTxns.length > 0) {
      const years = expenseTxns.map((t: any) => new Date(t.transaction_date).getFullYear()).filter((y: number) => y > 1970);
      if (years.length > 0) setCurrentYear(Math.max(...years));
      setYearInitialized(true);
    }
  }, [expenseTxns.length, yearInitialized]);

  // Year-filtered expense transactions
  const filteredByYear = useMemo(() =>
    expenseTxns.filter((t: any) => new Date(t.transaction_date).getFullYear() === currentYear),
    [expenseTxns, currentYear]
  );

  // Unique categories (same 7 as Home)
  const uniqueCategories = useMemo(() => {
    const cats = new Set(filteredByYear.map((t: any) => t.resolvedCategory));
    return Array.from(cats as Set<string>).sort();
  }, [filteredByYear]);

  // Category + optional filter
  const displayTxns = useMemo(() =>
    selectedCategory
      ? filteredByYear.filter((t: any) => t.resolvedCategory === selectedCategory)
      : filteredByYear,
    [filteredByYear, selectedCategory]
  );

  // Totals
  const totalExpenses = filteredByYear.reduce((sum: number, t: any) => sum + t.displayAmount, 0);
  const filteredTotal = displayTxns.reduce((sum: number, t: any) => sum + t.displayAmount, 0);

  // Unique sectors for CategoryManager
  const billSectors = useMemo(() => uniqueCategories.filter(c => c !== "Other"), [uniqueCategories]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEditBill = (bill: any) => { setSelectedBill(bill); setDialogOpen(true); };
  const handleDeleteBill = (id: string) => { setBillToDelete(id); setDeleteDialogOpen(true); };
  const handleDialogClose = (open: boolean) => { setDialogOpen(open); if (!open) setSelectedBill(null); };

  const confirmDelete = async () => {
    if (!billToDelete) return;
    try {
      await supabase.from("bill_items").delete().eq("bill_id", billToDelete);
      const { error } = await supabase.from("bills").delete().eq("id", billToDelete);
      if (error) throw error;
      toast.success("Bill deleted successfully");
      refetchBills();
      queryClient.invalidateQueries({ queryKey: ["manual-bills"] });
    } catch { toast.error("Failed to delete bill"); }
    finally { setDeleteDialogOpen(false); setBillToDelete(null); }
  };

  // ── Columns: transaction view ─────────────────────────────────────────────
  const txnColumns: ColumnDef<any>[] = [
    {
      accessorKey: "transaction_date",
      header: "Date",
      cell: ({ row }) => new Date(row.original.transaction_date).toLocaleDateString(),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const desc = row.original.description as string;
        return (
          <span className="max-w-xs truncate block" title={desc}>
            {desc}
          </span>
        );
      },
    },
    {
      id: "category",
      header: "Category",
      cell: ({ row }) => {
        const cat = row.original.resolvedCategory as string;
        const style = getSectorStyle(cat.toLowerCase(), 0);
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeBg} ${style.badgeText}`}>
            {cat}
          </span>
        );
      },
    },
    {
      id: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium text-destructive">
          <FormattedCurrency amount={row.original.displayAmount} currency={currency} />
        </span>
      ),
    },
  ];

  // ── Columns: manual bills view ────────────────────────────────────────────
  const manualBillColumns: ColumnDef<any>[] = [
    { accessorKey: "bill_number", header: "Bill #" },
    { accessorKey: "vendors.name", header: "Vendor", cell: ({ row }) => row.original.vendors?.name || "-" },
    { accessorKey: "bill_date", header: "Date", cell: ({ row }) => new Date(row.original.bill_date).toLocaleDateString() },
    { accessorKey: "total_amount", header: "Amount", cell: ({ row }) => <FormattedCurrency amount={row.original.total_amount} currency={currency} /> },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <Badge variant="outline">{row.original.status}</Badge> },
    { id: "actions", cell: ({ row }) => (
      <DataTableRowActions
        onEdit={() => handleEditBill(row.original)}
        onDelete={() => handleDeleteBill(row.original.id)}
      />
    )},
  ];

  const hasData = expenseTxns.length > 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bills</h1>
            <p className="text-muted-foreground">
              {hasData
                ? `${filteredByYear.length} expenses in ${currentYear} · ${formatAmount(totalExpenses, currency)} total`
                : "Track and manage your expense transactions"}
            </p>
          </div>
          <div className="flex gap-2">
            {/* Year navigation */}
            {hasData && (
              <div className="flex items-center gap-1 border rounded-lg px-2">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentYear(y => y - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">{currentYear}</span>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setCurrentYear(y => y + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
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

        {/* Category filter pills — same design as Home page */}
        {!isLoading && filteredByYear.length > 0 && (
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
              All ({filteredByYear.length})
            </button>
            {uniqueCategories.map((cat) => {
              const count = filteredByYear.filter((t: any) => t.resolvedCategory === cat).length;
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

        {/* Category total strip */}
        {selectedCategory && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Showing</span>
            <Badge variant="secondary">{selectedCategory}</Badge>
            <span>— {displayTxns.length} transactions · {formatAmount(filteredTotal, currency)}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedCategory(null)}>
              Clear
            </Button>
          </div>
        )}

        {/* Main transaction table */}
        {!isLoading && !hasData ? (
          <EmptyState
            icon={FileText}
            title="No expense transactions yet"
            description="Upload a bank statement on the Home page to see your expenses here"
          />
        ) : (
          <DataTable
            columns={txnColumns}
            data={displayTxns}
            searchKey="description"
            searchPlaceholder="Search expenses..."
            isLoading={isLoading}
            emptyMessage="No expenses found"
            exportFileName="bills"
          />
        )}

        {/* Manual Bills section (only when manually created bills exist) */}
        {manualBills.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Manual Bills</h2>
              <Badge variant="secondary">{manualBills.length}</Badge>
            </div>
            <DataTable
              columns={manualBillColumns}
              data={manualBills}
              searchKey="bill_number"
              searchPlaceholder="Search bills..."
              isLoading={false}
              emptyMessage="No manual bills"
              exportFileName="manual-bills"
              onRowClick={(row: any) => { setDetailBill(row); setDetailOpen(true); }}
            />
          </div>
        )}

        {/* Dialogs */}
        <BillForm open={dialogOpen} onOpenChange={handleDialogClose} bill={selectedBill} onSuccess={refetchBills} />
        <BillDetailSheet open={detailOpen} onOpenChange={setDetailOpen} bill={detailBill} onEdit={handleEditBill} onDelete={handleDeleteBill} onRefresh={refetchBills} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Bill" description="Are you sure you want to delete this bill? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="bill" availableSectors={billSectors} onCategoryClick={(cat) => setSelectedCategory(cat)} />
      </div>
    </Layout>
  );
}
