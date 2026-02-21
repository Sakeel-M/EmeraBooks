import { useMemo, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { replaceAedSymbol } from "@/lib/utils";

interface CategoryDetailPanelProps {
  open: boolean;
  onClose: () => void;
  category: string;
  invoices: any[];
  bills: any[];
  quarterLabels: string[];
  quarterRanges: { from: Date; to: Date }[];
  currency?: string;
}

export function CategoryDetailPanel({ open, onClose, category, invoices, bills, quarterLabels, quarterRanges, currency = "USD" }: CategoryDetailPanelProps) {
  const fmt = (v: number) =>
    replaceAedSymbol(new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v), currency);
  const [search, setSearch] = useState("");

  const isRevenue = category.startsWith("rev-") || invoices.some(inv => (inv.category || "Other Revenue") === category);

  // Quarterly trend data
  const quarterlyData = useMemo(() => {
    return quarterLabels.map((label, idx) => {
      const { from, to } = quarterRanges[idx];
      let amount = 0;
      if (isRevenue) {
        amount = invoices
          .filter(inv => { const d = new Date(inv.invoice_date); return d >= from && d <= to && (inv.category || "Other Revenue") === category; })
          .reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
      } else {
        amount = bills
          .filter(b => { const d = new Date(b.bill_date); return d >= from && d <= to && (b.category || "General Expenses") === category; })
          .reduce((s, b) => s + Number(b.total_amount || 0), 0);
      }
      return { quarter: label, amount };
    });
  }, [category, invoices, bills, quarterLabels, quarterRanges, isRevenue]);

  const currentAmount = quarterlyData[quarterlyData.length - 1]?.amount || 0;
  const prevAmount = quarterlyData.length > 1 ? quarterlyData[quarterlyData.length - 2]?.amount || 0 : 0;
  const changePct = prevAmount > 0 ? ((currentAmount - prevAmount) / prevAmount) * 100 : null;

  // YTD
  const ytdAmount = quarterlyData.reduce((s, q) => s + q.amount, 0);

  // Top vendors (from bills) or customers (from invoices)
  const topEntities = useMemo(() => {
    const map = new Map<string, number>();
    if (isRevenue) {
      invoices
        .filter(inv => (inv.category || "Other Revenue") === category)
        .forEach(inv => {
          const name = inv.customers?.name || "Unknown";
          map.set(name, (map.get(name) || 0) + Number(inv.total_amount || 0));
        });
    } else {
      bills
        .filter(b => (b.category || "General Expenses") === category)
        .forEach(b => {
          const name = b.vendors?.name || "Unknown";
          map.set(name, (map.get(name) || 0) + Number(b.total_amount || 0));
        });
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [category, invoices, bills, isRevenue]);

  // All transactions
  const allTransactions = useMemo(() => {
    const items = isRevenue
      ? invoices.filter(inv => (inv.category || "Other Revenue") === category).map(inv => ({
          date: inv.invoice_date, description: inv.invoice_number, entity: inv.customers?.name || "Unknown", amount: Number(inv.total_amount || 0),
        }))
      : bills.filter(b => (b.category || "General Expenses") === category).map(b => ({
          date: b.bill_date, description: b.bill_number, entity: b.vendors?.name || "Unknown", amount: Number(b.total_amount || 0),
        }));
    return items
      .filter(t => !search || t.description.toLowerCase().includes(search.toLowerCase()) || t.entity.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.amount - a.amount);
  }, [category, invoices, bills, isRevenue, search]);

  const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader>
          <SheetTitle>{category}</SheetTitle>
          <SheetDescription className="flex items-center gap-2">
            <span className="text-lg font-bold text-foreground">{fmt(currentAmount)}</span>
            {changePct !== null && (
              <Badge variant={changePct >= 0 ? "default" : "destructive"} className="text-xs">
                {changePct >= 0 ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                {Math.abs(changePct).toFixed(1)}% vs prior
              </Badge>
            )}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="overview" className="flex-1 flex flex-col mt-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ytd">YTD</TabsTrigger>
            <TabsTrigger value="entities">{isRevenue ? "Customers" : "Vendors"}</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="overview" className="space-y-4">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={quarterlyData}>
                  <XAxis dataKey="quarter" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={v => fmt(v)} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {changePct !== null && (
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">
                    You {isRevenue ? "earned" : "spent"} {changePct >= 0 ? "more" : "less"} on <strong>{category}</strong> this quarter
                    compared to the prior quarter ({fmt(Math.abs(currentAmount - prevAmount))} {changePct >= 0 ? "increase" : "decrease"}).
                  </p>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="ytd" className="space-y-4">
              <Card className="p-4 text-center">
                <p className="text-sm text-muted-foreground">Year-to-Date Total</p>
                <p className="text-2xl font-bold text-foreground">{fmt(ytdAmount)}</p>
              </Card>
              <div className="space-y-2">
                {quarterlyData.map(q => (
                  <div key={q.quarter} className="flex items-center justify-between py-2 px-3 rounded bg-muted/30">
                    <span className="text-sm text-foreground">{q.quarter}</span>
                    <span className="text-sm font-semibold text-foreground">{fmt(q.amount)}</span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="entities" className="space-y-3">
              {topEntities.map(([name, amount], i) => (
                <div key={name} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm text-foreground">{name}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{fmt(amount)}</span>
                </div>
              ))}
              {topEntities.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No data available</p>}
            </TabsContent>

            <TabsContent value="transactions" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="space-y-1">
                {allTransactions.map((t, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{t.entity}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{t.date}</span>
                        <span className="text-xs text-muted-foreground">{t.description}</span>
                      </div>
                    </div>
                    <span className="text-sm font-medium ml-2 text-foreground">{fmt(t.amount)}</span>
                  </div>
                ))}
                {allTransactions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No transactions found</p>}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
