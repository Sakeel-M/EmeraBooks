import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DollarSign, Percent, TrendingDown, Calculator, Download, FileSpreadsheet, Receipt, ShieldCheck, Info } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DonutChart } from "@/components/charts/DonutChart";
import { CHART_COLORS } from "@/lib/chartColors";
import { CurrencyAxisTick } from "@/components/shared/CurrencyAxisTick";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { exportToCSV } from "@/lib/export";
import { downloadTaxationPDF } from "./TaxationReportPDF";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface TaxationReportProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  currency: string;
  invoices?: any[];
  bills?: any[];
}

interface RevenueByCustomer {
  name: string;
  count: number;
  subtotal: number;
  vat: number;
  net: number;
}

interface ExpenseByVendor {
  name: string;
  count: number;
  total: number;
}

interface MonthlySummary {
  month: string;
  revenue: number;
  vat: number;
  expenses: number;
  taxableProfit: number;
  corpTax: number;
}

export function TaxationReport({ totalRevenue, totalExpenses, netIncome, currency, invoices = [], bills = [] }: TaxationReportProps) {
  const { toast } = useToast();
  const fmt = (v: number) => <FormattedCurrency amount={v} currency={currency} />;

  const { data: companyName = "" } = useQuery({
    queryKey: ["company-name"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("company_name")
        .maybeSingle();
      return data?.company_name || "";
    },
  });

  // Tax calculations
  const vatRate = 0.05;
  const corpTaxRate = 0.09;
  const vatAmount = totalRevenue * vatRate;
  const revenueAfterVAT = totalRevenue - vatAmount;
  const netProfitBeforeTax = revenueAfterVAT - totalExpenses;
  const corpTaxAmount = Math.max(netProfitBeforeTax, 0) * corpTaxRate;
  const netProfitAfterTax = netProfitBeforeTax - corpTaxAmount;
  const totalTaxBurden = vatAmount + corpTaxAmount;
  const effectiveTaxRate = totalRevenue > 0 ? (totalTaxBurden / totalRevenue) * 100 : 0;

  // VAT Summary
  const outputVAT = totalRevenue * vatRate;
  const inputVAT = totalExpenses * vatRate;
  const netVATPayable = outputVAT - inputVAT;

  // Revenue by Customer
  const revenueByCustomer = useMemo<RevenueByCustomer[]>(() => {
    const map: Record<string, { count: number; subtotal: number }> = {};
    invoices.forEach((inv) => {
      const name = (inv.customers as any)?.name || "Uncategorized";
      if (!map[name]) map[name] = { count: 0, subtotal: 0 };
      map[name].count++;
      map[name].subtotal += Number(inv.total_amount || 0);
    });
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        count: d.count,
        subtotal: d.subtotal,
        vat: d.subtotal * vatRate,
        net: d.subtotal * (1 - vatRate),
      }))
      .sort((a, b) => b.subtotal - a.subtotal);
  }, [invoices]);

  // Expense by Vendor
  const expenseByVendor = useMemo<ExpenseByVendor[]>(() => {
    const map: Record<string, { count: number; total: number }> = {};
    bills.forEach((bill) => {
      const name = (bill.vendors as any)?.name || "Uncategorized";
      if (!map[name]) map[name] = { count: 0, total: 0 };
      map[name].count++;
      map[name].total += Number(bill.total_amount || 0);
    });
    return Object.entries(map)
      .map(([name, d]) => ({ name, count: d.count, total: d.total }))
      .sort((a, b) => b.total - a.total);
  }, [bills]);

  // Expense by Category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    bills.forEach((bill) => {
      const cat = bill.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + Number(bill.total_amount || 0);
    });
    return Object.entries(map)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [bills]);

  // Monthly Summary
  const monthlySummary = useMemo<MonthlySummary[]>(() => {
    const map: Record<string, { revenue: number; expenses: number }> = {};
    invoices.forEach((inv) => {
      const key = format(new Date(inv.invoice_date), "yyyy-MM");
      if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
      map[key].revenue += Number(inv.total_amount || 0);
    });
    bills.forEach((bill) => {
      const key = format(new Date(bill.bill_date), "yyyy-MM");
      if (!map[key]) map[key] = { revenue: 0, expenses: 0 };
      map[key].expenses += Number(bill.total_amount || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, d]) => {
        const vat = d.revenue * vatRate;
        const revenueAfter = d.revenue - vat;
        const taxableProfit = revenueAfter - d.expenses;
        const corpTax = Math.max(taxableProfit, 0) * corpTaxRate;
        return {
          month: format(new Date(key + "-01"), "MMM yyyy"),
          revenue: d.revenue,
          vat,
          expenses: d.expenses,
          taxableProfit,
          corpTax,
        };
      });
  }, [invoices, bills]);

  const breakdownRows = [
    { label: "Gross Revenue", value: totalRevenue, bold: true },
    { label: "Less: VAT (5%)", value: -vatAmount, indent: true },
    { label: "Revenue After VAT", value: revenueAfterVAT, bold: true },
    { label: "Less: Operating Expenses", value: -totalExpenses, indent: true },
    { label: "Net Profit Before Corporate Tax", value: netProfitBeforeTax, bold: true },
    { label: "Less: Corporate Tax (9%)", value: -corpTaxAmount, indent: true },
    { label: "Net Profit After All Taxes", value: netProfitAfterTax, bold: true, highlight: true },
  ];

  const handleDownloadCSV = () => {
    const csvData = breakdownRows.map((row) => ({
      Description: row.label,
      Amount: row.value,
    }));
    csvData.push(
      { Description: "Total Tax Burden", Amount: totalTaxBurden },
      { Description: `Effective Tax Rate: ${effectiveTaxRate.toFixed(1)}%`, Amount: 0 }
    );
    revenueByCustomer.forEach((r) => {
      csvData.push({ Description: `Revenue - ${r.name}`, Amount: r.subtotal });
    });
    expenseByVendor.forEach((e) => {
      csvData.push({ Description: `Expense - ${e.name}`, Amount: e.total });
    });
    exportToCSV(csvData, "taxation-report");
    toast({ title: "CSV downloaded", description: "taxation-report.csv has been saved." });
  };

  const handleDownloadPDF = async () => {
    try {
      await downloadTaxationPDF({
        companyName,
        currency,
        totalRevenue,
        vatAmount,
        revenueAfterVAT,
        totalExpenses,
        netProfitBeforeTax,
        corpTaxAmount,
        netProfitAfterTax,
        totalTaxBurden,
        effectiveTaxRate,
        revenueByCustomer,
        expenseByVendor,
        monthlySummary,
        outputVAT,
        inputVAT,
        netVATPayable,
      });
      toast({ title: "PDF downloaded", description: "taxation-report.pdf has been saved." });
    } catch {
      toast({ title: "PDF generation failed", variant: "destructive" });
    }
  };

  const barChartData = [
    { name: "Gross Revenue", revenue: totalRevenue, afterTax: revenueAfterVAT },
    { name: "Net Profit", revenue: Math.max(netProfitBeforeTax, 0), afterTax: Math.max(netProfitAfterTax, 0) },
  ];

  const donutData = [
    { name: "VAT (5%)", value: vatAmount, color: CHART_COLORS.amber },
    { name: "Corp Tax (9%)", value: corpTaxAmount, color: CHART_COLORS.danger },
    { name: "Net After Tax", value: Math.max(netProfitAfterTax, 0), color: CHART_COLORS.success },
  ].filter(d => d.value > 0);

  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Taxation Report</h2>
          {companyName && <p className="text-sm text-muted-foreground mt-1">{companyName}</p>}
          <p className="text-xs text-muted-foreground">{today}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadCSV}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
          <Button size="sm" onClick={handleDownloadPDF}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards - 6 cards */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold mt-1 text-foreground">{fmt(totalRevenue)}</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">VAT (5%)</p>
                <p className="text-lg font-bold mt-1 text-amber-600">{fmt(vatAmount)}</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <Percent className="w-4 h-4 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold mt-1 text-destructive">{fmt(totalExpenses)}</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5">
                <Receipt className="w-4 h-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Taxable Profit</p>
                <p className="text-lg font-bold mt-1 text-foreground">{fmt(Math.max(netProfitBeforeTax, 0))}</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <Calculator className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Corp Tax (9%)</p>
                <p className="text-lg font-bold mt-1 text-destructive">{fmt(corpTaxAmount)}</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-red-500/10 to-red-500/5">
                <TrendingDown className="w-4 h-4 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Tax Burden</p>
                <p className="text-lg font-bold mt-1 text-foreground">{fmt(totalTaxBurden)}</p>
                <p className="text-xs text-muted-foreground">Eff. rate: {effectiveTaxRate.toFixed(1)}%</p>
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdownRows.map((row) => (
                <TableRow key={row.label} className={row.highlight ? "bg-primary/5" : ""}>
                  <TableCell className={`${row.bold ? "font-semibold" : ""} ${row.indent ? "pl-8 text-muted-foreground" : ""}`}>
                    {row.label}
                  </TableCell>
                  <TableCell className={`text-right ${row.bold ? "font-semibold" : ""} ${row.value < 0 ? "text-destructive" : ""}`}>
                    {row.value < 0 ? <span>(<FormattedCurrency amount={Math.abs(row.value)} currency={currency} />)</span> : fmt(row.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Operating Expenses Breakdown */}
      {expenseByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Operating Expenses Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseByCategory.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell>{row.category}</TableCell>
                    <TableCell className="text-right">{fmt(row.amount)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalExpenses > 0 ? ((row.amount / totalExpenses) * 100).toFixed(1) : "0"}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* VAT Summary */}
      <Card>
        <CardHeader>
          <CardTitle>VAT Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">Output VAT (Revenue)</p>
              <p className="text-xl font-bold mt-1">{fmt(outputVAT)}</p>
            </div>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm text-muted-foreground">Input VAT (Expenses)</p>
              <p className="text-xl font-bold mt-1">{fmt(inputVAT)}</p>
            </div>
            <div className="p-4 rounded-lg border bg-primary/5 border-primary/20">
              <p className="text-sm text-muted-foreground">Net VAT Payable</p>
              <p className={`text-xl font-bold mt-1 ${netVATPayable >= 0 ? "text-destructive" : "text-green-600"}`}>
                {netVATPayable >= 0 ? fmt(netVATPayable) : <span>(<FormattedCurrency amount={Math.abs(netVATPayable)} currency={currency} />)</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown by Customer */}
      {revenueByCustomer.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Breakdown by Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-center">Invoices</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="text-right">VAT (5%)</TableHead>
                  <TableHead className="text-right">Net Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenueByCustomer.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center">{row.count}</TableCell>
                    <TableCell className="text-right">{fmt(row.subtotal)}</TableCell>
                    <TableCell className="text-right text-amber-600">{fmt(row.vat)}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(row.net)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{invoices.length}</TableCell>
                  <TableCell className="text-right">{fmt(totalRevenue)}</TableCell>
                  <TableCell className="text-right text-amber-600">{fmt(vatAmount)}</TableCell>
                  <TableCell className="text-right">{fmt(revenueAfterVAT)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Expense Breakdown by Vendor */}
      {expenseByVendor.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown by Vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-center">Bills</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">% of Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseByVendor.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center">{row.count}</TableCell>
                    <TableCell className="text-right">{fmt(row.total)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {totalExpenses > 0 ? ((row.total / totalExpenses) * 100).toFixed(1) : "0"}%
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{bills.length}</TableCell>
                  <TableCell className="text-right">{fmt(totalExpenses)}</TableCell>
                  <TableCell className="text-right">100%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Monthly Tax Summary */}
      {monthlySummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monthly Tax Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">VAT Collected</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Taxable Profit</TableHead>
                  <TableHead className="text-right">Corp Tax</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlySummary.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right">{fmt(row.revenue)}</TableCell>
                    <TableCell className="text-right text-amber-600">{fmt(row.vat)}</TableCell>
                    <TableCell className="text-right text-destructive">{fmt(row.expenses)}</TableCell>
                    <TableCell className={`text-right ${row.taxableProfit < 0 ? "text-destructive" : ""}`}>
                      {row.taxableProfit < 0 ? <span>(<FormattedCurrency amount={Math.abs(row.taxableProfit)} currency={currency} />)</span> : fmt(row.taxableProfit)}
                    </TableCell>
                    <TableCell className="text-right">{fmt(row.corpTax)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pre-Tax vs Post-Tax</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barChartData} barGap={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tick={<CurrencyAxisTick currency={currency} anchor="end" />} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [<FormattedCurrency amount={value} currency={currency} />, name]}
                />
                <Legend />
                <Bar dataKey="revenue" name="Before Tax" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="afterTax" name="After Tax" fill={CHART_COLORS.secondary} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Tax Composition</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {donutData.length > 0 ? (
              <DonutChart
                data={donutData}
                centerLabel="Total Tax"
                centerValue={totalTaxBurden}
                height={250}
                isCurrency
              />
            ) : (
              <p className="text-muted-foreground text-sm py-12">No tax data to display</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Rates & Thresholds Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            Tax Rates & Thresholds Reference
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-semibold text-foreground">Value Added Tax (VAT)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">5%</p>
              <p className="text-xs text-muted-foreground mt-1">Applied on all taxable goods and services</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-semibold text-foreground">Corporate Tax</p>
              <p className="text-2xl font-bold text-destructive mt-1">9%</p>
              <p className="text-xs text-muted-foreground mt-1">On taxable income exceeding AED 375,000</p>
            </div>
            <div className="p-4 rounded-lg border">
              <p className="text-sm font-semibold text-foreground">Small Business Relief</p>
              <p className="text-2xl font-bold text-green-600 mt-1">0%</p>
              <p className="text-xs text-muted-foreground mt-1">Revenue ≤ AED 3M may elect for relief (conditions apply)</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            This report is auto-generated for informational purposes. Please consult a tax professional for official filings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
