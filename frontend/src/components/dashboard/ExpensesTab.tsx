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

interface ExpensesTabProps {
  transactions: Transaction[];
  currency: string;
  quarterLabel: string;
}

const ExpensesTab = ({ transactions, currency, quarterLabel }: ExpensesTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const categoryAnalysis = useMemo(() => {
    const categories = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.amount < 0) {
        const cat = t.category || "Uncategorized";
        categories.set(cat, (categories.get(cat) || 0) + Math.abs(t.amount));
      }
    });
    return Array.from(categories.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [transactions]);

  const cashTrend = useMemo(() => {
    const monthly = new Map<string, number>();
    let balance = 0;
    const sorted = [...transactions].sort((a, b) => a.transaction_date.localeCompare(b.transaction_date));
    sorted.forEach((t) => {
      balance += t.amount;
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthly.set(key, balance);
    });
    return Array.from(monthly.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, balance]) => {
        const [y, m] = month.split("-");
        return { month: new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short" }), balance };
      });
  }, [transactions]);

  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  // Category detail transactions
  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    return transactions
      .filter(t => t.amount < 0 && (t.category || "Uncategorized") === selectedCategory)
      .filter(t => !search || t.description.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [transactions, selectedCategory, search]);

  const categoryTotal = categoryTransactions.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses Analysis</CardTitle>
            <p className="text-xs text-muted-foreground">{quarterLabel}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{fmt(totalExpenses)}</span>
              <Badge variant="secondary" className="text-xs">
                {transactions.filter(t => t.amount < 0).length} transactions
              </Badge>
            </div>
            <div className="space-y-3">
              {categoryAnalysis.map((cat, i) => (
                <div
                  key={cat.name}
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors"
                  onClick={() => { setSelectedCategory(cat.name); setSearch(""); }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <span className="text-sm font-semibold">{fmt(cat.amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Expense Categories</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryAnalysis} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Bar
                  dataKey="amount"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  cursor="pointer"
                  onClick={(data: any) => { setSelectedCategory(data.name); setSearch(""); }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Total Cash Balance Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={cashTrend}>
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <defs>
                <linearGradient id="cashGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="url(#cashGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Detail Sheet */}
      <Sheet open={!!selectedCategory} onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCategory}</SheetTitle>
            <SheetDescription>
              {categoryTransactions.length} transactions · {fmt(categoryTotal)} total
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
                  {categoryTransactions.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(t.transaction_date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                      <TableCell className="text-right font-semibold text-destructive">{fmt(Math.abs(t.amount))}</TableCell>
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

export default ExpensesTab;
