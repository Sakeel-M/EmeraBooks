import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Percent, TrendingDown, Calculator } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { DonutChart } from "@/components/charts/DonutChart";
import { CHART_COLORS, formatCurrencyValue } from "@/lib/chartColors";

interface TaxationReportProps {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  currency: string;
}

export function TaxationReport({ totalRevenue, totalExpenses, netIncome, currency }: TaxationReportProps) {
  const fmt = (v: number) => formatCurrencyValue(v, currency);

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

  const breakdownRows = [
    { label: "Gross Revenue", value: totalRevenue, bold: true },
    { label: "Less: VAT (5%)", value: -vatAmount, indent: true },
    { label: "Revenue After VAT", value: revenueAfterVAT, bold: true },
    { label: "Less: Operating Expenses", value: -totalExpenses, indent: true },
    { label: "Net Profit Before Corporate Tax", value: netProfitBeforeTax, bold: true },
    { label: "Less: Corporate Tax (9%)", value: -corpTaxAmount, indent: true },
    { label: "Net Profit After All Taxes", value: netProfitAfterTax, bold: true, highlight: true },
  ];

  const barChartData = [
    { name: "Gross Revenue", revenue: totalRevenue, afterTax: revenueAfterVAT },
    { name: "Net Profit", revenue: Math.max(netProfitBeforeTax, 0), afterTax: Math.max(netProfitAfterTax, 0) },
  ];

  const donutData = [
    { name: "VAT (5%)", value: vatAmount, color: CHART_COLORS.amber },
    { name: "Corp Tax (9%)", value: corpTaxAmount, color: CHART_COLORS.danger },
    { name: "Net After Tax", value: Math.max(netProfitAfterTax, 0), color: CHART_COLORS.success },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{fmt(totalRevenue)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">VAT Amount (5%)</p>
                <p className="text-2xl font-bold mt-1 text-amber-600">{fmt(vatAmount)}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5">
                <Percent className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxable Profit</p>
                <p className="text-2xl font-bold mt-1 text-foreground">{fmt(Math.max(netProfitBeforeTax, 0))}</p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                <Calculator className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Corporate Tax (9%)</p>
                <p className="text-2xl font-bold mt-1 text-destructive">{fmt(corpTaxAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Effective rate: {effectiveTaxRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5">
                <TrendingDown className="w-5 h-5 text-destructive" />
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
                    {row.value < 0 ? `(${fmt(Math.abs(row.value))})` : fmt(row.value)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => fmt(v)} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number, name: string) => [fmt(value), name]}
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
                centerValue={fmt(totalTaxBurden)}
                height={250}
                isCurrency
              />
            ) : (
              <p className="text-muted-foreground text-sm py-12">No tax data to display</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
