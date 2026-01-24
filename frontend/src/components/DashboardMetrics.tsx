import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Users, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

interface MetricData {
  value: number;
  change: number;
  trend: 'up' | 'down';
}

const DashboardMetrics = () => {
  const [revenue, setRevenue] = useState<MetricData>({ value: 0, change: 0, trend: 'up' });
  const [spend, setSpend] = useState<MetricData>({ value: 0, change: 0, trend: 'down' });
  const [customers, setCustomers] = useState<MetricData>({ value: 0, change: 0, trend: 'up' });
  const [vendors, setVendors] = useState<MetricData>({ value: 0, change: 0, trend: 'up' });
  const [currency, setCurrency] = useState('USD');

  useEffect(() => {
    fetchMetrics();
    detectCurrency();
  }, []);

  const detectCurrency = async () => {
    // Try to get currency from uploaded files first
    const { data: files } = await supabase
      .from('uploaded_files')
      .select('currency')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (files && files.length > 0 && files[0].currency) {
      setCurrency(files[0].currency);
      return;
    }

    // Fall back to invoices
    const { data: invoices } = await supabase
      .from('invoices')
      .select('currency')
      .limit(1);
    
    if (invoices && invoices.length > 0 && invoices[0].currency) {
      setCurrency(invoices[0].currency);
      return;
    }

    // Fall back to bills
    const { data: bills } = await supabase
      .from('bills')
      .select('currency')
      .limit(1);
    
    if (bills && bills.length > 0 && bills[0].currency) {
      setCurrency(bills[0].currency);
    }
  };

  const fetchMetrics = async () => {
    // Get latest invoice and bill dates to use as reference
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('invoice_date')
      .order('invoice_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const { data: lastBill } = await supabase
      .from('bills')
      .select('bill_date')
      .order('bill_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no data exists, keep metrics at zero
    if (!lastInvoice && !lastBill) {
      return;
    }

    // Use the latest date from either invoices or bills as reference
    const referenceDate = new Date(
      Math.max(
        lastInvoice ? new Date(lastInvoice.invoice_date).getTime() : 0,
        lastBill ? new Date(lastBill.bill_date).getTime() : 0
      )
    );

    // Calculate dynamic time windows relative to the reference date
    const currentStart = new Date(referenceDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevStart = new Date(referenceDate.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const referenceDateStr = referenceDate.toISOString().split('T')[0];
    const currentStartStr = currentStart.toISOString().split('T')[0];
    const prevStartStr = prevStart.toISOString().split('T')[0];

    // Total Revenue from invoices (last 30 days of data)
    const { data: currentRevenue } = await supabase
      .from('invoices')
      .select('total_amount, currency')
      .in('status', ['sent', 'paid'])
      .gte('invoice_date', currentStartStr)
      .lte('invoice_date', referenceDateStr);

    const { data: previousRevenue } = await supabase
      .from('invoices')
      .select('total_amount')
      .in('status', ['sent', 'paid'])
      .gte('invoice_date', prevStartStr)
      .lt('invoice_date', currentStartStr);

    const currentRevenueTotal = currentRevenue?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const previousRevenueTotal = previousRevenue?.reduce((sum, inv) => sum + Number(inv.total_amount), 0) || 0;
    const revenueChange = previousRevenueTotal > 0 
      ? ((currentRevenueTotal - previousRevenueTotal) / previousRevenueTotal) * 100 
      : 0;

    if (currentRevenue && currentRevenue.length > 0) {
      setCurrency(currentRevenue[0].currency || 'USD');
    }

    setRevenue({
      value: currentRevenueTotal,
      change: Math.abs(revenueChange),
      trend: revenueChange >= 0 ? 'up' : 'down'
    });

    // Total Spend from bills (last 30 days of data)
    const { data: currentBills } = await supabase
      .from('bills')
      .select('total_amount')
      .gte('bill_date', currentStartStr)
      .lte('bill_date', referenceDateStr);

    const { data: previousBills } = await supabase
      .from('bills')
      .select('total_amount')
      .gte('bill_date', prevStartStr)
      .lt('bill_date', currentStartStr);

    const currentBillsTotal = currentBills?.reduce((sum, bill) => sum + Number(bill.total_amount), 0) || 0;
    const previousBillsTotal = previousBills?.reduce((sum, bill) => sum + Number(bill.total_amount), 0) || 0;
    const spendChange = previousBillsTotal > 0 
      ? ((currentBillsTotal - previousBillsTotal) / previousBillsTotal) * 100 
      : 0;

    setSpend({
      value: currentBillsTotal,
      change: Math.abs(spendChange),
      trend: spendChange >= 0 ? 'up' : 'down'
    });

    // Active Customers (with invoices in last 90 days of data)
    const ninetyDaysAgo = new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneEightyDaysAgo = new Date(referenceDate.getTime() - 180 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];
    const oneEightyDaysAgoStr = oneEightyDaysAgo.toISOString().split('T')[0];

    const { data: activeCustomers } = await supabase
      .from('invoices')
      .select('customer_id')
      .gte('invoice_date', ninetyDaysAgoStr)
      .lte('invoice_date', referenceDateStr);

    const uniqueCustomers = new Set(activeCustomers?.map(inv => inv.customer_id).filter(Boolean));
    
    const { data: previousActiveCustomers } = await supabase
      .from('invoices')
      .select('customer_id')
      .gte('invoice_date', oneEightyDaysAgoStr)
      .lt('invoice_date', ninetyDaysAgoStr);

    const previousUniqueCustomers = new Set(previousActiveCustomers?.map(inv => inv.customer_id).filter(Boolean));
    const customerChange = previousUniqueCustomers.size > 0
      ? ((uniqueCustomers.size - previousUniqueCustomers.size) / previousUniqueCustomers.size) * 100
      : 0;

    setCustomers({
      value: uniqueCustomers.size,
      change: Math.abs(customerChange),
      trend: customerChange >= 0 ? 'up' : 'down'
    });

    // Active Vendors (with bills in last 90 days of data)
    const { data: activeVendors } = await supabase
      .from('bills')
      .select('vendor_id')
      .gte('bill_date', ninetyDaysAgoStr)
      .lte('bill_date', referenceDateStr);

    const uniqueVendors = new Set(activeVendors?.map(bill => bill.vendor_id).filter(Boolean));

    const { data: previousActiveVendors } = await supabase
      .from('bills')
      .select('vendor_id')
      .gte('bill_date', oneEightyDaysAgoStr)
      .lt('bill_date', ninetyDaysAgoStr);

    const previousUniqueVendors = new Set(previousActiveVendors?.map(bill => bill.vendor_id).filter(Boolean));
    const vendorChange = previousUniqueVendors.size > 0
      ? ((uniqueVendors.size - previousUniqueVendors.size) / previousUniqueVendors.size) * 100
      : 0;

    setVendors({
      value: uniqueVendors.size,
      change: Math.abs(vendorChange),
      trend: vendorChange >= 0 ? 'up' : 'down'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const MetricCard = ({ 
    title, 
    value, 
    metric, 
    icon: Icon, 
    variant = 'default' 
  }: { 
    title: string; 
    value: string | number; 
    metric: MetricData; 
    icon: any; 
    variant?: 'default' | 'primary';
  }) => (
    <Card className={`p-6 hover:shadow-orange transition-shadow ${variant === 'primary' ? 'bg-gradient-primary' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div className={`w-12 h-12 rounded-lg ${variant === 'primary' ? 'bg-white/20' : 'bg-secondary'} flex items-center justify-center`}>
          <Icon className={`w-6 h-6 ${variant === 'primary' ? 'text-primary-foreground' : 'text-primary'}`} />
        </div>
        <span className={`text-xs font-medium ${variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
          {title}
        </span>
      </div>
      <div className="mt-4">
        <p className={`text-2xl font-bold ${variant === 'primary' ? 'text-primary-foreground' : 'text-foreground'}`}>
          {value}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <div className={`flex items-center gap-1 ${variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            {metric.trend === 'up' ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm">{metric.change.toFixed(1)}%</span>
          </div>
          <span className={`text-sm ${variant === 'primary' ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
            vs last period
          </span>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Total Revenue"
        value={formatCurrency(revenue.value)}
        metric={revenue}
        icon={TrendingUp}
      />
      <MetricCard
        title="Total Spend"
        value={formatCurrency(spend.value)}
        metric={spend}
        icon={TrendingDown}
      />
      <MetricCard
        title="Active Customers"
        value={customers.value}
        metric={customers}
        icon={Users}
      />
      <MetricCard
        title="Active Vendors"
        value={vendors.value}
        metric={vendors}
        icon={Building2}
        variant="primary"
      />
    </div>
  );
};

export default DashboardMetrics;
