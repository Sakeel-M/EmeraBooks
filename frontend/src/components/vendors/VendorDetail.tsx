import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, TrendingDown, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { resolveCategory } from "@/lib/sectorMapping";

interface VendorDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string | null;
}

export function VendorDetail({ open, onOpenChange, vendorId }: VendorDetailProps) {
  // Hooks must always be called unconditionally — before any early returns
  const { currency } = useCurrency();
  const fmt = (v: number) => formatAmount(v, currency);

  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!vendorId,
  });

  // Query expense transactions matching this vendor's name in the description
  const { data: transactions = [] } = useQuery({
    queryKey: ["vendor-transactions", vendorId, vendor?.name],
    queryFn: async () => {
      if (!vendor?.name) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const searchName = vendor.name.slice(0, 30);
      const { data } = await supabase
        .from("transactions")
        .select("id, transaction_date, description, amount, category")
        .eq("user_id", user.id)
        .lt("amount", 0)
        .ilike("description", `%${searchName}%`)
        .order("transaction_date", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!vendor?.name,
  });

  // Query payables/receivables linked to this vendor by name
  const { data: payablesReceivables = [] } = useQuery({
    queryKey: ["vendor-pr", vendorId, vendor?.name],
    queryFn: async () => {
      if (!vendor?.name) return [];
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("payables_receivables")
        .select("*")
        .eq("user_id", user.id)
        .ilike("title", `%${vendor.name}%`)
        .order("due_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!vendor?.name,
  });

  if (isLoading) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <Skeleton className="h-8 w-48" />
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (!vendor) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Vendor</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-muted-foreground mt-6">Vendor details not found.</p>
        </SheetContent>
      </Sheet>
    );
  }

  const totalSpend = transactions.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const payables = payablesReceivables.filter((pr) => pr.type === "payable" && pr.status !== "settled");
  const receivables = payablesReceivables.filter((pr) => pr.type === "receivable" && pr.status !== "settled");
  const totalPayables = payables.reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalReceivables = receivables.reduce((s, r) => s + Number(r.amount || 0), 0);
  const hasContact = !!(vendor.email || vendor.phone || vendor.address || vendor.city);
  const hasUserNote = vendor.notes && vendor.notes !== "Auto-created from bank statement";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vendor.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Spend Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total Spend</p>
              <p className="text-xl font-bold">{fmt(totalSpend)}</p>
              <p className="text-xs text-muted-foreground mt-1">{transactions.length} transactions</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Outstanding Balance</p>
              <p className="text-xl font-bold">{fmt(vendor.balance || 0)}</p>
              <Badge variant={(vendor.balance || 0) > 0 ? "destructive" : "default"} className="mt-1">
                {(vendor.balance || 0) > 0 ? "Amount Due" : "Settled"}
              </Badge>
            </div>
          </div>

          {/* Payables & Receivables */}
          {(totalPayables > 0 || totalReceivables > 0) && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Payables & Receivables</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-destructive/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowUpRight className="h-4 w-4 text-destructive" />
                      <p className="text-xs text-muted-foreground">You Owe</p>
                    </div>
                    <p className="text-lg font-bold text-destructive">{fmt(totalPayables)}</p>
                    <p className="text-xs text-muted-foreground">{payables.length} items</p>
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ArrowDownRight className="h-4 w-4 text-primary" />
                      <p className="text-xs text-muted-foreground">They Owe You</p>
                    </div>
                    <p className="text-lg font-bold text-primary">{fmt(totalReceivables)}</p>
                    <p className="text-xs text-muted-foreground">{receivables.length} items</p>
                  </div>
                </div>
                {payablesReceivables.filter((pr) => pr.status !== "settled").length > 0 && (
                  <div className="mt-3 space-y-2">
                    {payablesReceivables.filter((pr) => pr.status !== "settled").slice(0, 5).map((pr) => (
                      <div key={pr.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-sm">
                        <div className="flex items-center gap-2">
                          {pr.type === "payable" ? (
                            <ArrowUpRight className="h-3 w-3 text-destructive" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 text-primary" />
                          )}
                          <span className="truncate max-w-[200px]">{pr.title}</span>
                        </div>
                        <div className="text-right">
                          <span className={`font-medium ${pr.type === "payable" ? "text-destructive" : "text-primary"}`}>
                            {fmt(Number(pr.amount))}
                          </span>
                          {pr.due_date && (
                            <p className="text-xs text-muted-foreground">{new Date(pr.due_date).toLocaleDateString()}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Contact Information — only show if data exists */}
          {hasContact && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-3">Contact Information</h3>
                <div className="space-y-3">
                  {vendor.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.email}</span>
                    </div>
                  )}
                  {vendor.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{vendor.phone}</span>
                    </div>
                  )}
                  {(vendor.address || vendor.city || vendor.state) && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        {vendor.address && <div>{vendor.address}</div>}
                        {(vendor.city || vendor.state) && (
                          <div>
                            {vendor.city}
                            {vendor.city && vendor.state && ", "}
                            {vendor.state} {vendor.zip_code}
                          </div>
                        )}
                        {vendor.country && <div>{vendor.country}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Notes — hide auto-generated note */}
          {hasUserNote && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{vendor.notes}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Recent Transactions from transactions table */}
          <div>
            <h3 className="font-semibold mb-3">Recent Transactions</h3>
            {transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <TrendingDown className="h-4 w-4 text-destructive shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[200px]">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(txn.transaction_date).toLocaleDateString()}
                          {txn.category && ` · ${resolveCategory(txn.category, txn.description) || txn.category}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium text-destructive shrink-0 ml-2">
                      {fmt(Math.abs(Number(txn.amount || 0)))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions found</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
