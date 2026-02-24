import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, Tags, LayoutGrid, List, Palette, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DataTable } from "@/components/shared/DataTable";
import { ColumnDef } from "@tanstack/react-table";
import { InvoiceProfileDialog } from "@/components/invoices/InvoiceProfileDialog";
import { InvoiceCard } from "@/components/invoices/InvoiceCard";
import { InvoiceDetailSheet } from "@/components/invoices/InvoiceDetailSheet";
import { InvoiceTemplateEditor } from "@/components/invoices/InvoiceTemplateEditor";
import { EmptyState } from "@/components/shared/EmptyState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTableRowActions } from "@/components/shared/DataTableRowActions";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CategoryManager } from "@/components/shared/CategoryManager";
import { resolveCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";
import { toast } from "sonner";

type InvoiceStatus = "all" | "draft" | "sent" | "paid" | "overdue" | "cancelled";

const STATUS_TABS: { key: InvoiceStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "sent", label: "Sent" },
  { key: "paid", label: "Paid" },
  { key: "overdue", label: "Overdue" },
  { key: "cancelled", label: "Cancelled" },
];

export default function Invoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<InvoiceStatus>("all");
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [yearInitialized, setYearInitialized] = useState(false);

  // ── PRIMARY DATA SOURCE: invoices table (all invoices, synced + manual) ──────
  const { data: invoices = [], isLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ["invoices-page"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name, email)")
        .eq("user_id", user.id)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return (data || []).map((inv: any) => ({
        ...inv,
        // Ledger pattern: resolveCategory(rawCategory, fallbackName)
        // Use notes (contains original description) as fallback — matches Home page categorization logic
        resolvedCategory: resolveCategory(inv.category, inv.notes) || "Other",
      }));
    },
  });

  const { data: prefs } = useQuery({
    queryKey: ["user-preferences-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
  });

  // Auto-detect year from invoices (same pattern as Bills.tsx)
  useEffect(() => {
    if (!yearInitialized && invoices.length > 0) {
      const years = invoices
        .map((inv: any) => new Date(inv.invoice_date).getFullYear())
        .filter((y: number) => y > 1970);
      if (years.length > 0) setCurrentYear(Math.max(...years));
      setYearInitialized(true);
    }
  }, [invoices.length, yearInitialized]);

  // Year-filtered invoices
  const filteredByYear = useMemo(() =>
    invoices.filter((inv: any) => new Date(inv.invoice_date).getFullYear() === currentYear),
    [invoices, currentYear]
  );

  // Status filter
  const filteredByStatus = useMemo(() =>
    activeStatus === "all"
      ? filteredByYear
      : filteredByYear.filter((inv: any) => inv.status === activeStatus),
    [filteredByYear, activeStatus]
  );

  // Unique categories from year-filtered invoices
  const uniqueCategories = useMemo(() => {
    const cats = new Set(filteredByYear.map((inv: any) => inv.resolvedCategory));
    return Array.from(cats as Set<string>).sort();
  }, [filteredByYear]);

  // Category filter applied on top of status filter
  const displayInvoices = useMemo(() =>
    selectedCategory
      ? filteredByStatus.filter((inv: any) => inv.resolvedCategory === selectedCategory)
      : filteredByStatus,
    [filteredByStatus, selectedCategory]
  );

  // Totals
  const totalAmount = filteredByYear.reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0);
  const filteredTotal = displayInvoices.reduce((sum: number, inv: any) => sum + Number(inv.total_amount || 0), 0);
  const invoiceSectors = useMemo(() => uniqueCategories.filter(c => c !== "Other"), [uniqueCategories]);
  const hasData = invoices.length > 0;

  // Status counts for tab badges
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredByYear.length };
    filteredByYear.forEach((inv: any) => {
      const s = inv.status || "draft";
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [filteredByYear]);

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleEdit = (invoice: any) => { navigate(`/invoices/${invoice.id}/edit`); };
  const handleDelete = (id: string) => { setInvoiceToDelete(id); setDeleteDialogOpen(true); };
  const handleView = (invoice: any) => { setDetailInvoice(invoice); setDetailOpen(true); };

  const confirmDelete = async () => {
    if (!invoiceToDelete) return;
    try {
      await supabase.from("invoice_items").delete().eq("invoice_id", invoiceToDelete);
      const { error } = await supabase.from("invoices").delete().eq("id", invoiceToDelete);
      if (error) throw error;
      toast.success("Invoice deleted");
      refetchInvoices();
      queryClient.invalidateQueries({ queryKey: ["invoices-page"] });
    } catch { toast.error("Failed to delete"); }
    finally { setDeleteDialogOpen(false); setInvoiceToDelete(null); }
  };

  // ── Columns for table view ─────────────────────────────────────────────────────
  const invoiceColumns: ColumnDef<any>[] = [
    { accessorKey: "invoice_number", header: "Invoice #" },
    {
      id: "customer",
      header: "Customer",
      cell: ({ row }) => row.original.customers?.name || "—",
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
      accessorKey: "invoice_date",
      header: "Date",
      cell: ({ row }) => new Date(row.original.invoice_date).toLocaleDateString(),
    },
    {
      accessorKey: "due_date",
      header: "Due",
      cell: ({ row }) => row.original.due_date ? new Date(row.original.due_date).toLocaleDateString() : "—",
    },
    {
      accessorKey: "total_amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="font-medium text-green-600">
          {formatAmount(Number(row.original.total_amount || 0), currency)}
        </span>
      ),
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">
              {hasData
                ? `${filteredByYear.length} invoices in ${currentYear} · ${formatAmount(totalAmount, currency)} total`
                : "Create and manage customer invoices"}
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
            <Button variant="outline" size="sm" onClick={() => setProfileOpen(true)}>
              <Building2 className="h-4 w-4 mr-2" /> Profile
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTemplateEditorOpen(true)}>
              <Palette className="h-4 w-4 mr-2" /> Template
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCategoryManagerOpen(true)}>
              <Tags className="h-4 w-4 mr-2" /> Categories
            </Button>
            <Button onClick={() => navigate("/invoices/new")}>
              <Plus className="h-4 w-4 mr-2" /> Create Invoice
            </Button>
          </div>
        </div>

        {/* Status tabs */}
        {hasData && (
          <div className="flex gap-1 border-b">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveStatus(key)}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeStatus === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
                <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                  {statusCounts[key] || 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Category filter pills */}
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
              All ({filteredByStatus.length})
            </button>
            {uniqueCategories.map((cat) => {
              const count = filteredByStatus.filter((inv: any) => inv.resolvedCategory === cat).length;
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
            <span>— {displayInvoices.length} invoices · {formatAmount(filteredTotal, currency)}</span>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setSelectedCategory(null)}>
              Clear
            </Button>
          </div>
        )}

        {/* Main view */}
        {!isLoading && !hasData ? (
          <EmptyState
            icon={FileText}
            title="No invoices yet"
            description="Create your first invoice or upload a bank statement to auto-generate invoices"
            actionLabel="Create Invoice"
            onAction={() => navigate("/invoices/new")}
          />
        ) : (
          <div className="space-y-3">
            {/* View toggle */}
            <div className="flex justify-end">
              <div className="flex border rounded-lg overflow-hidden">
                <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("grid")}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("table")}>
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {viewMode === "grid" ? (
              displayInvoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No invoices match the current filters</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {displayInvoices.map((inv: any) => (
                    <InvoiceCard
                      key={inv.id}
                      invoice={inv}
                      logoUrl={prefs?.company_logo_url}
                      currency={currency}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )
            ) : (
              <DataTable
                columns={invoiceColumns}
                data={displayInvoices}
                searchKey="invoice_number"
                searchPlaceholder="Search invoices..."
                isLoading={isLoading}
                emptyMessage="No invoices found"
                exportFileName="invoices"
                onRowClick={handleView}
              />
            )}
          </div>
        )}

        {/* Dialogs */}
        <InvoiceProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <InvoiceTemplateEditor open={templateEditorOpen} onOpenChange={setTemplateEditorOpen} />
        <InvoiceDetailSheet open={detailOpen} onOpenChange={setDetailOpen} invoice={detailInvoice} onEdit={handleEdit} onDelete={handleDelete} onRefresh={refetchInvoices} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Invoice" description="Are you sure you want to delete this invoice?" />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="invoice" availableSectors={invoiceSectors} onCategoryClick={(cat) => setSelectedCategory(cat)} />
      </div>
    </Layout>
  );
}
