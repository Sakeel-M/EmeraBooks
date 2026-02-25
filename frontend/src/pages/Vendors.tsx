import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
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
import { QuarterNavigator, DateMode } from "@/components/dashboard/QuarterNavigator";
import { format } from "date-fns";
import { toast } from "sonner";
import { getCanonicalCategory, guessCategory } from "@/lib/sectorMapping";
import { getSectorStyle } from "@/lib/sectorStyles";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

export default function Vendors() {
  const { currency } = useCurrency();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [vendorToDelete, setVendorToDelete] = useState<string | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("grouped");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [customFrom, setCustomFrom] = useState<Date>(() => new Date(new Date().getFullYear(), 0, 1));
  const [customTo, setCustomTo] = useState<Date>(() => new Date(new Date().getFullYear(), 11, 31, 23, 59, 59));
  const [yearInitialized, setYearInitialized] = useState(false);

  const { quarterFrom, quarterTo } = useMemo(() => {
    if (dateMode === "year") {
      return {
        quarterFrom: new Date(currentYear, 0, 1),
        quarterTo: new Date(currentYear, 11, 31, 23, 59, 59),
      };
    }
    return { quarterFrom: customFrom, quarterTo: customTo };
  }, [dateMode, currentYear, customFrom, customTo]);

  const { data: vendors, isLoading, refetch } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("vendors").select("*").eq("user_id", user.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: allBills = [] } = useQuery({
    queryKey: ["vendor-bills"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase.from("bills").select("*").eq("user_id", user.id).order("bill_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Expense transactions — source of truth for year auto-detection
  const { data: expenseTxns = [] } = useQuery({
    queryKey: ["expense-transactions-vendors"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data } = await supabase
        .from("transactions")
        .select("amount, category, description, transaction_date")
        .eq("user_id", user.id)
        .lt("amount", 0)
        .order("transaction_date", { ascending: false });
      return (data || []).map((t: any) => ({
        ...t,
        resolvedCategory: getCanonicalCategory(t.category, null, t.description),
        absAmount: Math.abs(Number(t.amount || 0)),
      }));
    },
  });

  // Auto-detect the most recent year from transactions (primary) or bills (fallback)
  useEffect(() => {
    if (!yearInitialized && (expenseTxns.length > 0 || allBills.length > 0)) {
      const txnYears = expenseTxns.map((t: any) => new Date(t.transaction_date).getFullYear()).filter((y: number) => y > 1970);
      const billYears = allBills.map((b: any) => new Date(b.bill_date).getFullYear()).filter((y: number) => y > 1970);
      const allYears = [...txnYears, ...billYears];
      const maxYear = allYears.length > 0 ? Math.max(...allYears) : new Date().getFullYear();
      setCurrentYear(maxYear);
      setCustomFrom(new Date(maxYear, 0, 1));
      setCustomTo(new Date(maxYear, 11, 31, 23, 59, 59));
      setYearInitialized(true);
    }
  }, [expenseTxns.length, allBills.length, yearInitialized]);

  // Vendor name lookup for transaction → vendor matching
  const vendorNameLookup = useMemo(() => {
    const map = new Map<string, string>(); // lowercase_name → vendor_id
    (vendors || []).forEach(v => {
      if (v.name && v.name.trim().length >= 4) {
        map.set(v.name.toLowerCase().trim(), v.id);
      }
    });
    return map;
  }, [vendors]);

  // Convert expense transactions to bill-like objects — Ledger pattern (category from resolveCategory)
  // Matches each transaction to a vendor by finding the longest vendor name in the description.
  const txnAsBills = useMemo(() => {
    return expenseTxns.map((t: any) => {
      const desc = (t.description || "").toLowerCase();
      let vendorId: string | null = null;
      let bestLen = 0;
      for (const [nameLower, vid] of vendorNameLookup.entries()) {
        if (nameLower.length > bestLen && desc.includes(nameLower)) {
          vendorId = vid;
          bestLen = nameLower.length;
        }
      }
      return {
        id: t.id,
        vendor_id: vendorId,
        total_amount: t.absAmount,
        bill_date: t.transaction_date,
        category: t.resolvedCategory,   // always correct — resolveCategory(t.category, t.description)
        notes: t.description,
        amount_paid: t.absAmount,
        status: "paid" as const,
      };
    });
  }, [expenseTxns, vendorNameLookup]);

  // Year-filtered transaction-bills (used for fallback if bills table is empty)
  const quarterTxnBills = useMemo(() => {
    return txnAsBills.filter(b => {
      const d = new Date(b.bill_date);
      return d >= quarterFrom && d <= quarterTo;
    });
  }, [txnAsBills, quarterFrom, quarterTo]);

  // Primary: bills from the bills table (have proper vendor_id links from sync)
  // Fall back to transaction-derived bills only if bills table has no data
  const quarterBills = useMemo(() => {
    const fromTable = allBills.filter(b => {
      const d = new Date(b.bill_date);
      return d >= quarterFrom && d <= quarterTo;
    });
    return fromTable.length > 0 ? fromTable : quarterTxnBills;
  }, [allBills, quarterTxnBills, quarterFrom, quarterTo]);

  // Vendors with matching bills in the selected year
  const activeVendorIds = useMemo(() => {
    const ids = new Set<string>();
    quarterBills.forEach((b) => { if (b.vendor_id) ids.add(b.vendor_id); });
    return ids;
  }, [quarterBills]);

  // Mode-count transaction categories per vendor (replaces bill-based map)
  const vendorBillCategoryMap = useMemo(() => {
    const map = new Map<string, string>();
    const vendorCatCounts = new Map<string, Map<string, number>>();
    quarterTxnBills.forEach((b) => {
      if (!b.vendor_id) return;
      const resolved = b.category; // already resolveCategory result from txnAsBills
      if (!resolved || resolved === "Other" || resolved === "Internal Transfer") return;
      if (!vendorCatCounts.has(b.vendor_id)) vendorCatCounts.set(b.vendor_id, new Map());
      const cats = vendorCatCounts.get(b.vendor_id)!;
      cats.set(resolved, (cats.get(resolved) || 0) + 1);
    });
    vendorCatCounts.forEach((cats, vendorId) => {
      let maxCount = 0, bestCat = "";
      cats.forEach((count, cat) => { if (count > maxCount) { maxCount = count; bestCat = cat; } });
      if (bestCat) map.set(vendorId, bestCat);
    });
    return map;
  }, [quarterTxnBills]);

  const getVendorCategory = (v: any): string => {
    // Vendor name is the most reliable signal — direct keyword matching
    const nameGuess = guessCategory(v.name);
    if (nameGuess && nameGuess !== "Internal Transfer") return nameGuess;
    // Fall back to transaction-matched category
    const txnCat = vendorBillCategoryMap.get(v.id);
    if (txnCat) return txnCat;
    // Last resort: stored/resolved category
    return getCanonicalCategory(v.category, v.name, null);
  };

  // Dynamic vendor balance: sum of (total_amount - amount_paid) across all bills for each vendor
  const vendorBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    allBills.forEach((b) => {
      if (!b.vendor_id) return;
      const outstanding = Number(b.total_amount || 0) - Number(b.amount_paid || 0);
      map.set(b.vendor_id, (map.get(b.vendor_id) || 0) + outstanding);
    });
    return map;
  }, [allBills]);

  const getVendorBalance = (v: any): number => {
    const dynamic = vendorBalanceMap.get(v.id);
    return dynamic !== undefined ? dynamic : Number(v.balance || 0);
  };

  // Unique auto-mapped sectors for CategoryManager
  const vendorSectors = useMemo(() => {
    const cats = new Set<string>();
    (vendors || []).forEach((v) => {
      const cat = getVendorCategory(v);
      if (cat && cat !== "Other") cats.add(cat);
    });
    return Array.from(cats).sort();
  }, [vendors]);

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

  const quarterLabel = dateMode === "year" ? `${currentYear}` : `${format(customFrom, "MMM dd, yyyy")} – ${format(customTo, "MMM dd, yyyy")}`;

  const columns: ColumnDef<any>[] = [
    { accessorKey: "name", header: "Vendor Name", cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <span>{row.original.name}</span>
        {row.original.source === 'odoo' && <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">From Odoo</Badge>}
      </div>
    )},
    { accessorKey: "email", header: "Email" },
    { accessorKey: "phone", header: "Phone" },
    { accessorKey: "category", header: "Category", cell: ({ row }) => {
      const cat = getVendorCategory(row.original);
      const style = getSectorStyle(cat.toLowerCase(), 0);
      return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.badgeBg} ${style.badgeText}`}>
          {cat}
        </span>
      );
    }},
    {
      accessorKey: "balance", header: "Balance",
      cell: ({ row }) => {
        const balance = getVendorBalance(row.original);
        return <span className={balance > 0 ? "text-destructive font-medium" : ""}><FormattedCurrency amount={balance} currency={currency} /></span>;
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
            <QuarterNavigator
              currentQuarter={0}
              currentYear={currentYear}
              onNavigate={(_, y) => setCurrentYear(y)}
              mode={dateMode}
              onModeChange={(m) => setDateMode(m as DateMode)}
              modes={["year", "custom"]}
              customFrom={customFrom}
              customTo={customTo}
              onCustomDateChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
            />
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
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
              <VendorInsightsPanel
                vendors={vendors || []}
                bills={quarterBills}
                quarterLabel={quarterLabel}
                quarterFrom={quarterFrom}
                quarterTo={quarterTo}
                activeVendorCount={activeVendorIds.size}
              />
              <VendorGroupedList
                vendors={vendors || []}
                bills={quarterBills}
                onEdit={handleEdit}
                onView={handleView}
                onDelete={handleDelete}
                onRefresh={() => refetch()}
                searchQuery={searchQuery}
              />
            </div>
          </div>
        )}

        <VendorDialog open={dialogOpen} onOpenChange={setDialogOpen} vendor={selectedVendor} onSuccess={() => refetch()} />
        <VendorDetail open={detailOpen} onOpenChange={setDetailOpen} vendorId={selectedVendor?.id} />
        <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete Vendor" description="Are you sure you want to delete this vendor? This action cannot be undone." />
        <CategoryManager open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen} type="vendor" availableSectors={vendorSectors} />
      </div>
    </Layout>
  );
}
