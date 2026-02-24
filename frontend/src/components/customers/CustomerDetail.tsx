import { useEffect, useState } from "react";
import { replaceAedSymbol } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { Mail, Phone, MapPin, FileText, TrendingUp, DollarSign, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface CustomerDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  onEditCustomer?: (customer: any) => void;
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

interface PayableReceivable {
  id: string;
  title: string;
  type: string;
  amount: number;
  status: string | null;
  due_date: string | null;
  currency: string | null;
}

export function CustomerDetail({ open, onOpenChange, customerId, onEditCustomer }: CustomerDetailProps) {
  const [customer, setCustomer] = useState<any>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payablesReceivables, setPayablesReceivables] = useState<PayableReceivable[]>([]);
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
      const [customerRes, invoicesRes, prRes] = await Promise.all([
        supabase.from("customers").select("*").eq("id", customerId).single(),
        supabase.from("invoices").select("*").eq("customer_id", customerId).order("invoice_date", { ascending: false }),
        supabase.from("payables_receivables").select("*").eq("type", "receivable").order("created_at", { ascending: false }),
      ]);

      if (customerRes.error) throw customerRes.error;
      setCustomer(customerRes.data);

      setInvoices(invoicesRes.data || []);

      // Filter payables_receivables that mention this customer's name
      const customerName = customerRes.data?.name?.toLowerCase() || "";
      const matched = (prRes.data || []).filter((pr: any) =>
        pr.title?.toLowerCase().includes(customerName.slice(0, 10))
      );
      setPayablesReceivables(matched);
    } catch (error) {
      console.error("Error fetching customer details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Financial metrics derived from invoices
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalCollected = invoices.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);
  const outstandingReceivable = invoices
    .filter((inv) => inv.status === "sent" || inv.status === "overdue")
    .reduce((sum, inv) => sum + Math.max(0, (inv.total_amount || 0) - (inv.amount_paid || 0)), 0);
  const unpaidInvoices = invoices.filter((inv) => inv.status === "sent" || inv.status === "overdue");
  const paidInvoices = invoices.filter((inv) => inv.status === "paid");

  const formatCurrency = (amount: number, cur: string = "USD") => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
    return replaceAedSymbol(formatted, cur);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <div className="flex items-start justify-between">
            <div>
              <SheetTitle>Customer Details</SheetTitle>
              <SheetDescription>View customer information and financial activity</SheetDescription>
            </div>
            {customer && onEditCustomer && (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 mt-1"
                onClick={() => {
                  onOpenChange(false);
                  onEditCustomer(customer);
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-4 mt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : customer ? (
          <div className="mt-6 space-y-6">
            {/* Customer Info Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl break-words">{customer.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`mailto:${customer.email}`} className="text-primary hover:underline">
                      {customer.email}
                    </a>
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a href={`tel:${customer.phone}`} className="text-primary hover:underline">
                      {customer.phone}
                    </a>
                  </div>
                )}
                {(customer.address || customer.city || customer.state) && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      {customer.address && <div>{customer.address}</div>}
                      <div>
                        {[customer.city, customer.state, customer.zip_code].filter(Boolean).join(", ")}
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

            {/* Financial Summary — 3 stat cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-medium">Total Invoiced</span>
                  </div>
                  <p className="text-lg font-bold">
                    {formatCurrency(totalInvoiced, invoices[0]?.currency || "USD")}
                  </p>
                  <p className="text-xs text-muted-foreground">{invoices.length} invoice{invoices.length !== 1 ? "s" : ""}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground font-medium">Collected</span>
                  </div>
                  <p className="text-lg font-bold text-primary">
                    {formatCurrency(totalCollected, invoices[0]?.currency || "USD")}
                  </p>
                  <p className="text-xs text-muted-foreground">{paidInvoices.length} paid</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className={`h-4 w-4 ${outstandingReceivable > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground font-medium">Receivable</span>
                  </div>
                  <p className={`text-lg font-bold ${outstandingReceivable > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                    {formatCurrency(outstandingReceivable, invoices[0]?.currency || "USD")}
                  </p>
                  <p className="text-xs text-muted-foreground">{unpaidInvoices.length} unpaid</p>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="invoices" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="invoices">
                  Invoices ({invoices.length})
                </TabsTrigger>
                <TabsTrigger value="receivables">
                  Receivables {payablesReceivables.length > 0 ? `(${payablesReceivables.length})` : ""}
                </TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>

              {/* Invoices Tab */}
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
                              <p className="text-sm text-primary">
                                Paid: {formatCurrency(invoice.amount_paid, invoice.currency)}
                              </p>
                            )}
                            {(invoice.status === "sent" || invoice.status === "overdue") &&
                              invoice.total_amount - (invoice.amount_paid || 0) > 0 && (
                                <p className="text-sm text-amber-600">
                                  Due: {formatCurrency(invoice.total_amount - (invoice.amount_paid || 0), invoice.currency)}
                                </p>
                              )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Receivables Tab */}
              <TabsContent value="receivables" className="space-y-3 mt-4">
                {payablesReceivables.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No receivable entries linked to this customer</p>
                    <p className="text-xs mt-1">Receivables are tracked in the Payables & Receivables section</p>
                  </div>
                ) : (
                  payablesReceivables.map((pr) => (
                    <Card key={pr.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{pr.title}</p>
                            {pr.due_date && (
                              <p className="text-sm text-muted-foreground">
                                Due: {new Date(pr.due_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {formatCurrency(pr.amount, pr.currency || "USD")}
                            </p>
                            {pr.status && <StatusBadge status={pr.status as any} />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Activity Tab */}
              <TabsContent value="activity" className="mt-4">
                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-start gap-3 pb-3 border-b last:border-0">
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          invoice.status === "paid" ? "bg-primary" :
                          invoice.status === "overdue" ? "bg-destructive" :
                          invoice.status === "sent" ? "bg-warning" : "bg-muted-foreground"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">Invoice #{invoice.invoice_number}</p>
                            <p className="text-sm font-bold shrink-0">
                              {formatCurrency(invoice.total_amount, invoice.currency)}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(invoice.invoice_date), { addSuffix: true })} ·{" "}
                            <span className="capitalize">{invoice.status}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
