import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Building2, Tags, LayoutGrid, List, Palette, Search, CalendarIcon, X } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { guessCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const STATUS_TABS = ["all", "draft", "sent", "paid", "overdue", "cancelled"] as const;

export default function Invoices() {
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const { currency } = useCurrency();

  const { data: invoices, isLoading, refetch } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(`*, customers (name, email)`)
        .order("invoice_date", { ascending: false });
      if (error) throw error;
      return data;
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

  // Resolve category: db value → guessed from customer name → "Other"
  const getInvoiceCategory = (inv: any): string =>
    inv.category || guessCategory(inv.customers?.name) || "Other";

  // Unique auto-mapped sectors for CategoryManager
  const invoiceSectors = useMemo(() => {
    const cats = new Set<string>();
    (invoices || []).forEach((i) => {
      const cat = getInvoiceCategory(i);
      if (cat && cat !== "Other") cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [invoices]);

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    (invoices || []).forEach((i) => cats.add(getInvoiceCategory(i)));
    return Array.from(cats).sort();
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    let list = invoices || [];
    if (statusFilter !== "all") list = list.filter((i) => i.status === statusFilter);
    if (categoryFilter !== "all") list = list.filter((i) => getInvoiceCategory(i) === categoryFilter);
    if (dateFrom) {
      list = list.filter((i) => {
        const [y, m, d] = i.invoice_date.split('-').map(Number);
        return new Date(y, m - 1, d) >= dateFrom;
      });
    }
    if (dateTo) {
      list = list.filter((i) => {
        const [y, m, d] = i.invoice_date.split('-').map(Number);
        return new Date(y, m - 1, d) <= dateTo;
      });
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        (i.customers?.name || "").toLowerCase().includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      switch (sortBy) {
        case "date-asc": return new Date(a.invoice_date).getTime() - new Date(b.invoice_date).getTime();
        case "amount-desc": return b.total_amount - a.total_amount;
        case "amount-asc": return a.total_amount - b.total_amount;
        case "customer": return (a.customers?.name || "").localeCompare(b.customers?.name || "");
        default: return new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime();
      }
    });
    return list;
  }, [invoices, statusFilter, categoryFilter, dateFrom, dateTo, searchQuery, sortBy]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: 0 };
    (invoices || []).forEach((i) => {
      counts.all = (counts.all || 0) + 1;
      counts[i.status || "draft"] = (counts[i.status || "draft"] || 0) + 1;
    });
    return counts;
  }, [invoices]);

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
      refetch();
    } catch { toast.error("Failed to delete"); } finally { setDeleteDialogOpen(false); setInvoiceToDelete(null); }
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: "invoice_number", header: "Invoice #", cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.invoice_number}</span>
        {row.original.source === 'odoo' && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">From Odoo</Badge>}
      </div>
    )},
    { accessorKey: "customers.name", header: "Customer", cell: ({ row }) => row.original.customers?.name || "-" },
    { accessorKey: "category", header: "Category", cell: ({ row }) => {
      const cat = getInvoiceCategory(row.original);
      const style = getSectorStyle(cat.toLowerCase(), 0);
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeBg} ${style.badgeText}`}>
          {cat}
        </span>
      );
    }},
    { accessorKey: "invoice_date", header: "Date", cell: ({ row }) => new Date(row.original.invoice_date).toLocaleDateString() },
    { accessorKey: "due_date", header: "Due", cell: ({ row }) => new Date(row.original.due_date).toLocaleDateString() },
    { accessorKey: "total_amount", header: "Amount", cell: ({ row }) => formatAmount(row.original.total_amount, currency) },
    { accessorKey: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { id: "actions", cell: ({ row }) => <DataTableRowActions onEdit={() => handleEdit(row.original)} onDelete={() => handleDelete(row.original.id)} /> },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Create and manage customer invoices</p>
          </div>
          <div className="flex gap-2">
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

        {!isLoading && (!invoices || invoices.length === 0) ? (
          <EmptyState
            icon={Plus}
            title="No invoices yet"
            description="Create your first invoice to start billing customers"
            actionLabel="Create Invoice"
            onAction={() => navigate("/invoices/new")}
          />
        ) : (
          <>
            {/* Status Tabs */}
            <Tabs value={statusFilter} onValueChange={setStatusFilter}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <TabsList>
                  {STATUS_TABS.map((s) => (
                    <TabsTrigger key={s} value={s} className="capitalize">
                      {s} {statusCounts[s] ? <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">{statusCounts[s]}</Badge> : null}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search invoices..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-56"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="Uncategorized">Uncategorized</SelectItem>
                      {uniqueCategories.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("gap-1.5", dateFrom && "text-foreground")}>
                        <CalendarIcon className="h-4 w-4" />
                        {dateFrom ? format(dateFrom, "MMM d") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("gap-1.5", dateTo && "text-foreground")}>
                        <CalendarIcon className="h-4 w-4" />
                        {dateTo ? format(dateTo, "MMM d") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  {(dateFrom || dateTo || categoryFilter !== "all") && (
                    <Button variant="ghost" size="sm" onClick={() => { setDateFrom(undefined); setDateTo(undefined); setCategoryFilter("all"); }}>
                      <X className="h-4 w-4 mr-1" /> Clear
                    </Button>
                  )}
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="date-desc">Newest first</SelectItem>
                      <SelectItem value="date-asc">Oldest first</SelectItem>
                      <SelectItem value="amount-desc">Highest amount</SelectItem>
                      <SelectItem value="amount-asc">Lowest amount</SelectItem>
                      <SelectItem value="customer">Customer A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border rounded-lg overflow-hidden">
                    <Button variant={viewMode === "grid" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("grid")}>
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button variant={viewMode === "table" ? "default" : "ghost"} size="sm" className="rounded-none" onClick={() => setViewMode("table")}>
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Content for all tabs renders the same filtered list */}
              {STATUS_TABS.map((s) => (
                <TabsContent key={s} value={s} className="mt-4">
                  {viewMode === "grid" ? (
                    filteredInvoices.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">No invoices found</div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredInvoices.map((inv) => (
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
                    <DataTable columns={columns} data={filteredInvoices} searchKey="invoice_number" searchPlaceholder="Search invoices..." isLoading={isLoading} />
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </>
        )}

        <InvoiceProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
        <InvoiceTemplateEditor open={templateEditorOpen} onOpenChange={setTemplateEditorOpen} />
        <InvoiceDetailSheet open={detailOpen} onOpenChange={setDetailOpen} invoice={detailInvoice} onEdit={handleEdit} onDelete={handleDelete} onRefresh={refetch} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Invoice" description="Are you sure you want to delete this invoice? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="invoice" availableSectors={invoiceSectors} onCategoryClick={(cat) => setCategoryFilter(cat)} />
      </div>
    </Layout>
  );
}
