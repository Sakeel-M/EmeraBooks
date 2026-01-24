import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Mail, Phone, MapPin, FileText, DollarSign } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface CustomerDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  amount_paid: number;
  status: string;
  currency: string;
}

export function CustomerDetail({ open, onOpenChange, customerId }: CustomerDetailProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (customerId && open) {
      fetchCustomerDetails();
    }
  }, [customerId, open]);

  const fetchCustomerDetails = async () => {
    if (!customerId) return;
    
    setIsLoading(true);
    try {
      // Fetch customer
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .eq("customer_id", customerId)
        .order("invoice_date", { ascending: false });

      if (invoicesError) throw invoicesError;
      setInvoices(invoicesData || []);
    } catch (error) {
      console.error("Error fetching customer details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateBalance = () => {
    return invoices.reduce((total, inv) => {
      if (inv.status === "sent" || inv.status === "overdue") {
        return total + (inv.total_amount - (inv.amount_paid || 0));
      }
      return total;
    }, 0);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Customer Details</SheetTitle>
          <SheetDescription>View customer information and activity</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : customer ? (
          <div className="mt-6 space-y-6">
            {/* Customer Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{customer.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {(customer.address || customer.city || customer.state) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      {customer.address && <div>{customer.address}</div>}
                      <div>
                        {[customer.city, customer.state, customer.zip_code]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      {customer.country && <div>{customer.country}</div>}
                    </div>
                  </div>
                )}
                {customer.notes && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-muted-foreground">{customer.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Balance Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Outstanding Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {formatCurrency(calculateBalance(), invoices[0]?.currency || "USD")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {invoices.filter((inv) => inv.status === "sent" || inv.status === "overdue").length} unpaid
                  invoice(s)
                </p>
              </CardContent>
            </Card>

            {/* Tabs */}
            <Tabs defaultValue="invoices" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="invoices">
                  Invoices ({invoices.length})
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              <TabsContent value="invoices" className="space-y-3 mt-4">
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No invoices yet</p>
                  </div>
                ) : (
                  invoices.map((invoice) => (
                    <Card key={invoice.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">#{invoice.invoice_number}</p>
                              <StatusBadge status={invoice.status as any} />
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Due: {new Date(invoice.due_date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Issued {formatDistanceToNow(new Date(invoice.invoice_date), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-lg">
                              {formatCurrency(invoice.total_amount, invoice.currency)}
                            </p>
                            {invoice.amount_paid > 0 && (
                              <p className="text-sm text-green-600">
                                Paid: {formatCurrency(invoice.amount_paid, invoice.currency)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <div className="text-center py-8 text-muted-foreground">
                  <p>Activity tracking coming soon</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
