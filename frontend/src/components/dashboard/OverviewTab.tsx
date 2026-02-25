import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import type { Transaction } from "@/lib/database";
import { CurrencyAxisTick } from "@/components/shared/CurrencyAxisTick";
import { getCanonicalCategory, resolveIncomeCategory } from "@/lib/sectorMapping";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

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
  const [selectedSide, setSelectedSide] = useState<"expense" | "income">("expense");
  const [search, setSearch] = useState("");


  // ── Expense categories ──────────────────────────────────────────────────────
  const expenseMap = new Map<string, { total: number; count: number }>();
  transactions.forEach((t) => {
    if (t.amount < 0) {
      const cat = getCanonicalCategory(t.category, null, t.description);
      const e = expenseMap.get(cat) || { total: 0, count: 0 };
      expenseMap.set(cat, { total: e.total + Math.abs(t.amount), count: e.count + 1 });
    }
  });
  const expenseData = Array.from(expenseMap.entries())
    .map(([name, { total, count }]) => ({ name, amount: total, count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const totalExpenses = expenseData.reduce((s, c) => s + c.amount, 0);
  const expenseDonut = expenseData.map((c) => ({
    ...c,
    percentage: totalExpenses > 0 ? ((c.amount / totalExpenses) * 100).toFixed(1) : "0",
  }));

  // ── Income categories ───────────────────────────────────────────────────────
  const incomeMap = new Map<string, { total: number; count: number }>();
  transactions.forEach((t) => {
    if (t.amount > 0) {
      const cat = resolveIncomeCategory(t.category, t.description);
      const e = incomeMap.get(cat) || { total: 0, count: 0 };
      incomeMap.set(cat, { total: e.total + t.amount, count: e.count + 1 });
    }
  });
  const incomeData = Array.from(incomeMap.entries())
    .map(([name, { total, count }]) => ({ name, amount: total, count }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const totalIncome = incomeData.reduce((s, c) => s + c.amount, 0);
  const incomeDonut = incomeData.map((c) => ({
    ...c,
    percentage: totalIncome > 0 ? ((c.amount / totalIncome) * 100).toFixed(1) : "0",
  }));

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  const openSheet = (name: string, side: "expense" | "income") => {
    setSelectedCategory(name);
    setSelectedSide(side);
    setSearch("");
  };

  // Transactions shown in the detail sheet
  const sheetTxns = selectedCategory
    ? transactions.filter((t) => {
        if (selectedSide === "expense") {
          return t.amount < 0 && getCanonicalCategory(t.category, null, t.description) === selectedCategory;
        }
        return t.amount > 0 && resolveIncomeCategory(t.category, t.description) === selectedCategory;
      })
    : [];

  return (
    <div className="space-y-6">
      {/* Row 1: Spending by Category | Income by Category */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by Category</CardTitle>
            <p className="text-xs text-muted-foreground">{expenseData.length} categories found</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={<CurrencyAxisTick currency={currency} />} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={80} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => openSheet(d.name, "expense")} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income by Category</CardTitle>
            <p className="text-xs text-muted-foreground">{incomeData.length} categories found</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeData} layout="vertical" margin={{ left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={<CurrencyAxisTick currency={currency} />} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" width={100} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d: any) => openSheet(d.name, "income")} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Expense Distribution | Income Distribution */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={expenseDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="amount" paddingAngle={2}>
                  {expenseDonut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer"
                      onClick={() => openSheet(expenseDonut[i].name, "expense")} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
              {expenseDonut.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs cursor-pointer" onClick={() => openSheet(item.name, "expense")}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{item.name} ({item.percentage}%) — <FormattedCurrency amount={item.amount} currency={currency} /></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={incomeDonut} cx="50%" cy="50%" innerRadius={55} outerRadius={95} dataKey="amount" paddingAngle={2}>
                  {incomeDonut.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} cursor="pointer"
                      onClick={() => openSheet(incomeDonut[i].name, "income")} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => <FormattedCurrency amount={v} currency={currency} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
              {incomeDonut.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-xs cursor-pointer" onClick={() => openSheet(item.name, "income")}>
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{item.name} ({item.percentage}%) — <FormattedCurrency amount={item.amount} currency={currency} /></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detail Sheet — shows transactions for clicked category */}
      <Sheet open={!!selectedCategory} onOpenChange={(open) => { if (!open) setSelectedCategory(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCategory}</SheetTitle>
            <SheetDescription>
              {sheetTxns.length} transactions · <FormattedCurrency amount={sheetTxns.reduce((s, t) => s + Math.abs(t.amount), 0)} currency={currency} /> total
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
                  {sheetTxns
                    .filter((t) => !search || t.description.toLowerCase().includes(search.toLowerCase()))
                    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
                    .map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {new Date(t.transaction_date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{t.description}</TableCell>
                        <TableCell className={`text-right font-semibold ${selectedSide === "income" ? "text-green-600" : "text-destructive"}`}>
                          {selectedSide === "income" ? "+" : ""}<FormattedCurrency amount={Math.abs(t.amount)} currency={currency} />
                        </TableCell>
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
