import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, MapPin, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface VendorDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendorId: string | null;
}

export function VendorDetail({ open, onOpenChange, vendorId }: VendorDetailProps) {
  const { data: vendor, isLoading } = useQuery({
    queryKey: ["vendor", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("id", vendorId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
  });

  const { data: bills } = useQuery({
    queryKey: ["vendor-bills", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from("bills")
        .select("*")
        .eq("vendor_id", vendorId)
        .order("bill_date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
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

  if (!vendor) return null;

  const outstandingBalance = vendor.balance || 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{vendor.name}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold">${outstandingBalance.toFixed(2)}</p>
              </div>
              <Badge variant={outstandingBalance > 0 ? "destructive" : "default"}>
                {outstandingBalance > 0 ? "Amount Due" : "Paid"}
              </Badge>
            </div>
          </div>

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

          {vendor.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{vendor.notes}</p>
              </div>
            </>
          )}

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Recent Bills</h3>
            {bills && bills.length > 0 ? (
              <div className="space-y-2">
                {bills.slice(0, 5).map((bill) => (
                  <div
                    key={bill.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{bill.bill_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(bill.bill_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${bill.total_amount.toFixed(2)}</p>
                      <Badge variant={bill.status === "paid" ? "default" : "secondary"} className="text-xs">
                        {bill.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No bills yet</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
