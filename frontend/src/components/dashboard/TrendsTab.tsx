import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Calendar, TrendingDown } from "lucide-react";
import type { Transaction } from "@/lib/database";

interface TrendsTabProps {
  transactions: Transaction[];
  currency: string;
}

const TrendsTab = ({ transactions, currency }: TrendsTabProps) => {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);

  // Group by year
  const yearMap = new Map<string, { total: number; count: number }>();
  transactions.forEach((t) => {
    const year = new Date(t.transaction_date).getFullYear().toString();
    const existing = yearMap.get(year) || { total: 0, count: 0 };
    yearMap.set(year, { total: existing.total + Math.abs(t.amount), count: existing.count + 1 });
  });
  const yearData = Array.from(yearMap.entries()).sort(([a], [b]) => b.localeCompare(a));

  // Group by month
  const monthMap = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    const d = new Date(t.transaction_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(t);
  });
  const monthData = Array.from(monthMap.entries()).sort(([a], [b]) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Multi-Year Analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Multi-Year Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {yearData.map(([year, data]) => (
              <div key={year} className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground">{year}</p>
                <p className="text-lg font-bold text-foreground">{fmt(data.total)}</p>
                <p className="text-xs text-muted-foreground">{data.count} transactions</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Monthly Spending Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Spending Trends</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {monthData.map(([monthKey, txns]) => {
            const [y, m] = monthKey.split("-");
            const label = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
            const total = txns.reduce((s, t) => s + Math.abs(t.amount), 0);
            const isExpanded = expandedMonth === monthKey;

            return (
              <div key={monthKey} className="border rounded-lg">
                <button
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  onClick={() => setExpandedMonth(isExpanded ? null : monthKey)}
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{label}</span>
                    <Badge variant="secondary" className="text-xs">{txns.length} txns</Badge>
                  </div>
                  <span className="font-semibold text-foreground">{fmt(total)}</span>
                </button>
                {isExpanded && (
                  <div className="border-t px-4 py-2 space-y-1 max-h-60 overflow-y-auto">
                    {txns.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-1.5 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(t.transaction_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                          <span className="truncate text-foreground">{t.description}</span>
                        </div>
                        <span className={`font-medium whitespace-nowrap ml-2 ${t.amount < 0 ? "text-destructive" : "text-green-600"}`}>
                          {fmt(t.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default TrendsTab;
