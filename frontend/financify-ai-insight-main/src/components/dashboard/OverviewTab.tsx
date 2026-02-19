import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import type { Transaction } from "@/lib/database";

interface OverviewTabProps {
  transactions: Transaction[];
  currency: string;
}

const COLORS = [
  "hsl(143 44% 22%)", "hsl(32 52% 70%)", "hsl(143 44% 35%)",
  "hsl(32 52% 55%)", "hsl(143 44% 50%)", "hsl(200 60% 50%)",
  "hsl(0 60% 50%)", "hsl(270 50% 50%)",
];

const OverviewTab = ({ transactions, currency }: OverviewTabProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  // Spending by category (expenses only)
  const categoryMap = new Map<string, { total: number; count: number }>();
  transactions.forEach((t) => {
    if (t.amount < 0) {
      const cat = t.category || "Uncategorized";
      const existing = categoryMap.get(cat) || { total: 0, count: 0 };
      categoryMap.set(cat, { total: existing.total + Math.abs(t.amount), count: existing.count + 1 });
    }
  });

  const categoryData = Array.from(categoryMap.entries())
    .map(([name, { total, count }]) => ({ name, amount: total, count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const totalExpenses = categoryData.reduce((s, c) => s + c.amount, 0);
  const donutData = categoryData.map((c) => ({
    ...c,
    percentage: totalExpenses > 0 ? ((c.amount / totalExpenses) * 100).toFixed(1) : "0",
  }));

  // Monthly trends
  const monthlyMap = new Map<string, number>();
  transactions.forEach((t) => {
    if (t.amount < 0) {
      const d = new Date(t.transaction_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, (monthlyMap.get(key) || 0) + Math.abs(t.amount));
    }
  });
  const monthlyData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, amount]) => {
      const [y, m] = month.split("-");
      const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      return { month: label, amount };
    });

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <p className="text-xs text-muted-foreground">{categoryData.length} categories found</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(data: any) => { setSelectedCategory(data.name); setSearch(""); }} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="amount"
                  paddingAngle={2}
                >
                  {donutData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer" onClick={() => { setSelectedCategory(entry.name); setSearch(""); }} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
              {donutData.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-muted-foreground">
                    {item.name} ({item.percentage}%) — {fmt(item.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Spending Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => fmt(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Transaction Detail Sheet */}
      <Sheet open={!!selectedCategory} onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCategory}</SheetTitle>
            <SheetDescription>
              {(() => {
                const catTxns = transactions.filter((t) => t.amount < 0 && (t.category || "Uncategorized") === selectedCategory);
                return `${catTxns.length} transactions · ${fmt(catTxns.reduce((s, t) => s + Math.abs(t.amount), 0))} total`;
              })()}
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
                  {transactions
                    .filter((t) => t.amount < 0 && (t.category || "Uncategorized") === selectedCategory)
                    .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
                    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                    .map((t, i) => (
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

export default OverviewTab;
