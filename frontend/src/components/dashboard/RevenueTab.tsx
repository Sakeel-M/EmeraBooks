import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import {
  BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Transaction } from "@/lib/database";
import { resolveIncomeCategory } from "@/lib/sectorMapping";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { CurrencyAxisTick } from "@/components/shared/CurrencyAxisTick";

interface RevenueTabProps {
  transactions: Transaction[];
  currency: string;
  quarterLabel: string;
}

const RevenueTab = ({ transactions, currency, quarterLabel }: RevenueTabProps) => {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [search, setSearch] = useState("");


  const incomeTransactions = transactions.filter(t => t.amount > 0);
  const totalRevenue = incomeTransactions.reduce((s, t) => s + t.amount, 0);

  const revenueBySource = useMemo(() => {
    const sources = new Map<string, number>();
    incomeTransactions.forEach((t) => {
      const cat = resolveIncomeCategory(t.category, t.description);
      sources.set(cat, (sources.get(cat) || 0) + t.amount);
    });
    return Array.from(sources.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [incomeTransactions]);

  const revenueTrend = useMemo(() => {
    const monthly = new Map<string, number>();
    incomeTransactions.forEach((t) => {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, (monthly.get(key) || 0) + t.amount);
    });
    return Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, amount]) => {
        const [y, m] = month.split("-");
        return { month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short" }), amount };
      });
  }, [incomeTransactions]);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  // Source detail transactions
  const sourceTransactions = useMemo(() => {
    if (!selectedSource) return [];
    return incomeTransactions
      .filter(t => resolveIncomeCategory(t.category, t.description) === selectedSource)
      .filter(t => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.amount - a.amount);
  }, [incomeTransactions, selectedSource, search]);

  const sourceTotal = sourceTransactions.reduce((s, t) => s + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Analysis</CardTitle>
            <p className="text-xs text-muted-foreground">{quarterLabel}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600"><FormattedCurrency amount={totalRevenue} currency={currency} /></span>
              <Badge variant="secondary" className="text-xs">
                {incomeTransactions.length} transactions
              </Badge>
            </div>
            <div className="space-y-3">
              {revenueBySource.map((src, i) => (
                <div
                  key={src.name}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                  onClick={() => { setSelectedSource(src.name); setSearch(""); }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm">{src.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-green-600"><FormattedCurrency amount={src.amount} currency={currency} /></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={revenueBySource} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={<CurrencyAxisTick currency={currency} />} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
                <Bar
                  dataKey="amount"
                  fill="hsl(143 44% 35%)"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data: any) => { setSelectedSource(data.name); setSearch(""); }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={revenueTrend}>
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tick={<CurrencyAxisTick currency={currency} anchor="end" />} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(143 44% 35%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(143 44% 35%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="amount" stroke="hsl(143 44% 35%)" fill="url(#revenueGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Source Detail Sheet */}
      <Sheet open={!!selectedSource} onOpenChange={(open) => { if (!open) setSelectedSource(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedSource}</SheetTitle>
            <SheetDescription>
              {sourceTransactions.length} transactions · <FormattedCurrency amount={sourceTotal} currency={currency} /> total
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sourceTransactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600"><FormattedCurrency amount={t.amount} currency={currency} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default RevenueTab;
