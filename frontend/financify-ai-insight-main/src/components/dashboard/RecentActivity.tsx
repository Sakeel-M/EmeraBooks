import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status: string;
  currency: string;
  customers: { name: string } | null;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  total_amount: number;
  status: string;
  currency: string;
  vendors: { name: string } | null;
}

export function RecentActivity() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [invoicesRes, billsRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('*, customers(name)')
            .order('invoice_date', { ascending: false })
            .limit(5),
          supabase
            .from('bills')
            .select('*, vendors(name)')
            .order('bill_date', { ascending: false })
            .limit(5)
        ]);

        if (invoicesRes.data) setInvoices(invoicesRes.data);
        if (billsRes.data) setBills(billsRes.data);
      } catch (error) {
        console.error('Error fetching recent activity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No invoices yet</p>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  onClick={() => navigate('/invoices')}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {invoice.customers?.name || 'Unknown Customer'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(invoice.invoice_date), 'MMM d, yyyy')} • {invoice.invoice_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(invoice.total_amount, invoice.currency)}
                    </p>
                    <StatusBadge status={invoice.status as any} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Bills</CardTitle>
        </CardHeader>
        <CardContent>
          {bills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No bills yet</p>
          ) : (
            <div className="space-y-3">
              {bills.map((bill) => (
                <div
                  key={bill.id}
                  onClick={() => navigate('/bills')}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {bill.vendors?.name || 'Unknown Vendor'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(bill.bill_date), 'MMM d, yyyy')} • {bill.bill_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <p className="text-sm font-semibold text-foreground whitespace-nowrap">
                      {formatCurrency(bill.total_amount, bill.currency)}
                    </p>
                    <StatusBadge status={bill.status as any} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
