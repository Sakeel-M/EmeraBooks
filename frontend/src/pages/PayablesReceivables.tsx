import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/layout/Layout";
import { PayablesSummary } from "@/components/payables/PayablesSummary";
import { PayablesTable } from "@/components/payables/PayablesTable";
import { PayableForm } from "@/components/payables/PayableForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { calculateTotals, isOverdue, type PayableReceivable } from "@/lib/payables";
import { useCurrency } from "@/hooks/useCurrency";

export default function PayablesReceivables() {
  const { currency } = useCurrency();
  // Fetch direct payables/receivables entries
  const { data: directEntries, isLoading: loadingDirect, refetch } = useQuery({
    queryKey: ["payables-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payables_receivables")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as PayableReceivable[];
    },
  });

  // Fetch unpaid bills (as payables)
  const { data: unpaidBills, isLoading: loadingBills } = useQuery({
    queryKey: ["unpaid-bills-for-payables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills")
        .select("*, vendors(name)")
        .neq("status", "paid")
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  // Fetch unpaid invoices (as receivables)
  const { data: unpaidInvoices, isLoading: loadingInvoices } = useQuery({
    queryKey: ["unpaid-invoices-for-receivables"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name)")
        .neq("status", "paid")
        .neq("status", "cancelled");
      if (error) throw error;
      return data;
    },
  });

  // Transform bills to payable format
  const billPayables: PayableReceivable[] = (unpaidBills || []).map((bill) => ({
    id: `bill-${bill.id}`,
    type: "payable",
    title: bill.vendors?.name || bill.bill_number,
    description: `Bill #${bill.bill_number}`,
    amount: bill.total_amount - (bill.amount_paid || 0),
    currency: bill.currency || currency,
    due_date: bill.due_date,
    status: isOverdue(bill.due_date) ? "overdue" : (bill.status as "pending" | "partial" | "settled"),
    source: "bill",
    source_id: bill.id,
    category: "Vendor",
  }));

  // Transform invoices to receivable format
  const invoiceReceivables: PayableReceivable[] = (unpaidInvoices || []).map((invoice) => ({
    id: `invoice-${invoice.id}`,
    type: "receivable",
    title: invoice.customers?.name || invoice.invoice_number,
    description: `Invoice #${invoice.invoice_number}`,
    amount: invoice.total_amount - (invoice.amount_paid || 0),
    currency: invoice.currency || currency,
    due_date: invoice.due_date,
    status: isOverdue(invoice.due_date) ? "overdue" : (invoice.status as "pending" | "partial" | "settled"),
    source: "invoice",
    source_id: invoice.id,
    category: "Customer",
  }));

  // Combine all entries
  const allItems: PayableReceivable[] = [
    ...(directEntries || []),
    ...billPayables,
    ...invoiceReceivables,
  ];

  const isLoading = loadingDirect || loadingBills || loadingInvoices;
  const totals = calculateTotals(allItems);

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payables & Receivables</h1>
            <p className="text-muted-foreground">
              Track amounts you owe and amounts owed to you
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <PayableForm defaultType="payable" />
          </div>
        </div>

        {/* Summary Cards */}
        <PayablesSummary
          totalPayable={totals.totalPayable}
          totalReceivable={totals.totalReceivable}
          netPosition={totals.netPosition}
          payableCount={totals.payableCount}
          receivableCount={totals.receivableCount}
          overduePayables={totals.overduePayables}
          overdueReceivables={totals.overdueReceivables}
          currency={currency}
        />

        {/* Tabs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-medium">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="payables" className="w-full">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="payables" className="gap-2">
                    <ArrowUpCircle className="h-4 w-4" />
                    Amount Payable
                  </TabsTrigger>
                  <TabsTrigger value="receivables" className="gap-2">
                    <ArrowDownCircle className="h-4 w-4" />
                    Amount Receivable
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="payables">
                <div className="mb-4 flex justify-end">
                  <PayableForm 
                    defaultType="payable" 
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Payable
                      </Button>
                    }
                  />
                </div>
                <PayablesTable 
                  items={allItems} 
                  type="payable" 
                  isLoading={isLoading} 
                />
              </TabsContent>

              <TabsContent value="receivables">
                <div className="mb-4 flex justify-end">
                  <PayableForm 
                    defaultType="receivable" 
                    trigger={
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Receivable
                      </Button>
                    }
                  />
                </div>
                <PayablesTable 
                  items={allItems} 
                  type="receivable" 
                  isLoading={isLoading} 
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
