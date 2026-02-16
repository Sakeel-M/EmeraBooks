import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, UserPlus, Layers } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface VendorInsightsPanelProps {
  vendors: any[];
  bills: any[];
  quarterLabel: string;
}

export function VendorInsightsPanel({ vendors, bills, quarterLabel }: VendorInsightsPanelProps) {
  const totalVendors = vendors.length;
  const totalSpend = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalTransactions = bills.length;

  // Vendors created recently (this quarter approx)
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const newVendors = vendors.filter(v => new Date(v.created_at) >= quarterStart).length;

  // Vendors in multiple categories
  const multiCatVendors = vendors.filter(v => v.category).length;

  // Monthly spend chart data
  const monthlySpend = new Map<string, number>();
  bills.forEach((b) => {
    const d = new Date(b.bill_date);
    const key = d.toLocaleDateString("en-US", { month: "short" });
    monthlySpend.set(key, (monthlySpend.get(key) || 0) + Number(b.total_amount || 0));
  });
  const chartData = Array.from(monthlySpend.entries()).map(([month, amount]) => ({ month, amount }));

  const fmt = (v: number) => `$${v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0)}`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{quarterLabel} · Total</p>
              <p className="text-xl font-bold">{totalVendors}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{quarterLabel} · Spend</p>
              <p className="text-xl font-bold">{fmt(totalSpend)}</p>
              <p className="text-xs text-muted-foreground">{totalTransactions} transactions</p>
            </div>
          </div>
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={chartData}>
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <UserPlus className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{quarterLabel} · New Vendors</p>
              <p className="text-xl font-bold">{newVendors}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Categorized</p>
              <p className="text-xl font-bold">{multiCatVendors}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
