import { Card, CardContent } from "@/components/ui/card";
import { Users, DollarSign, UserPlus, Layers } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer } from "recharts";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

interface VendorInsightsPanelProps {
  vendors: any[];
  bills: any[];
  quarterLabel: string;
  quarterFrom: Date;
  quarterTo: Date;
}

export function VendorInsightsPanel({ vendors, bills, quarterLabel, quarterFrom, quarterTo }: VendorInsightsPanelProps) {
  // Bills are already filtered by quarter from parent
  const totalSpend = bills.reduce((s, b) => s + Number(b.total_amount || 0), 0);
  const totalTransactions = bills.length;

  // Unique vendors with bills in this quarter
  const activeVendorIds = new Set(bills.map((b) => b.vendor_id).filter(Boolean));
  const activeVendors = activeVendorIds.size;

  // Vendors created in this quarter
  const newVendors = vendors.filter((v) => {
    const created = new Date(v.created_at);
    return created >= quarterFrom && created <= quarterTo;
  }).length;

  // Categorized vendors
  const multiCatVendors = vendors.filter((v) => v.category).length;

  // Monthly spend chart data (only months in the quarter)
  const monthlySpend = new Map<string, number>();
  bills.forEach((b) => {
    const d = new Date(b.bill_date);
    const key = d.toLocaleDateString("en-US", { month: "short" });
    monthlySpend.set(key, (monthlySpend.get(key) || 0) + Number(b.total_amount || 0));
  });
  const chartData = Array.from(monthlySpend.entries()).map(([month, amount]) => ({ month, amount }));

  const { currency } = useCurrency();
  const fmt = (v: number) => formatAmount(v, currency);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{quarterLabel} · Active</p>
              <p className="text-xl font-bold">{activeVendors}</p>
              <p className="text-xs text-muted-foreground">{vendors.length} total</p>
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
