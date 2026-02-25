import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StatCard } from "@/components/shared/StatCard";
import { DollarSign, AlertCircle, TrendingUp, Wallet } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrency } from "@/hooks/useCurrency";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface FinancialMetrics {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  outstandingBalance: number;
  currency: string;
  invoiceCount: number;
  billCount: number;
}

export function FinancialSummary() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const { currency: userCurrency } = useCurrency();

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const currency = userCurrency;

        // Total Revenue: All invoices
        const { data: allInvoices } = await supabase
          .from('invoices')
          .select('total_amount');

        const totalRevenue = allInvoices?.reduce(
          (sum, inv) => sum + Number(inv.total_amount),
          0
        ) || 0;

        const invoiceCount = allInvoices?.length || 0;

        // Total Expenses: All bills
        const { data: allBills } = await supabase
          .from('bills')
          .select('total_amount');

        const totalExpenses = allBills?.reduce(
          (sum, bill) => sum + Number(bill.total_amount),
          0
        ) || 0;

        const billCount = allBills?.length || 0;

        // Net Profit: Total Revenue - Total Expenses
        const netProfit = totalRevenue - totalExpenses;

        // Outstanding Balance: Unpaid invoices + Unpaid bills
        const { data: unpaidInvoices } = await supabase
          .from('invoices')
          .select('total_amount')
          .neq('status', 'paid');

        const { data: unpaidBills } = await supabase
          .from('bills')
          .select('total_amount')
          .neq('status', 'paid');

        const unpaidInvoicesTotal = unpaidInvoices?.reduce(
          (sum, inv) => sum + Number(inv.total_amount),
          0
        ) || 0;

        const unpaidBillsTotal = unpaidBills?.reduce(
          (sum, bill) => sum + Number(bill.total_amount),
          0
        ) || 0;

        const outstandingBalance = unpaidInvoicesTotal + unpaidBillsTotal;

        setMetrics({
          totalRevenue,
          totalExpenses,
          netProfit,
          outstandingBalance,
          currency: userCurrency,
          invoiceCount,
          billCount,
        });
      } catch (error) {
        console.error('Error fetching financial metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [userCurrency]);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!metrics) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Revenue"
        value={<FormattedCurrency amount={metrics.totalRevenue} currency={metrics.currency} />}
        icon={DollarSign}
        trend="up"
        change={`${metrics.invoiceCount} invoices`}
      />

      <StatCard
        title="Total Expenses"
        value={<FormattedCurrency amount={metrics.totalExpenses} currency={metrics.currency} />}
        icon={AlertCircle}
        change={`${metrics.billCount} bills`}
      />

      <StatCard
        title="Net Profit"
        value={<FormattedCurrency amount={metrics.netProfit} currency={metrics.currency} />}
        icon={TrendingUp}
        trend={metrics.netProfit >= 0 ? "up" : "down"}
      />

      <StatCard
        title="Outstanding Balance"
        value={<FormattedCurrency amount={metrics.outstandingBalance} currency={metrics.currency} />}
        icon={Wallet}
        className={metrics.outstandingBalance > 0 ? "border-orange-500/20" : ""}
      />
    </div>
  );
}
