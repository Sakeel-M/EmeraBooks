import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, AlertTriangle, CheckCircle2, AlertCircle } from "lucide-react";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { differenceInDays } from "date-fns";

interface AgingItem {
  id: string;
  name: string;
  number: string;
  amount: number;
  dueDate: string;
  type: "invoice" | "bill";
}

interface AgingReportCardProps {
  invoices: AgingItem[];
  bills: AgingItem[];
  currency?: string;
}

function getAgingBucket(dueDate: string) {
  const daysOverdue = differenceInDays(new Date(), new Date(dueDate));
  
  if (daysOverdue <= 0) return { bucket: "Current", color: CHART_COLORS.aging.current, severity: 0 };
  if (daysOverdue <= 30) return { bucket: "1-30 days", color: CHART_COLORS.aging.current, severity: 1 };
  if (daysOverdue <= 60) return { bucket: "31-60 days", color: CHART_COLORS.aging.days30, severity: 2 };
  if (daysOverdue <= 90) return { bucket: "61-90 days", color: CHART_COLORS.aging.days60, severity: 3 };
  return { bucket: "90+ days", color: CHART_COLORS.aging.days90, severity: 4 };
}

function AgingBar({ items, title, type, currency = "USD" }: { items: AgingItem[]; title: string; type: "invoice" | "bill"; currency?: string }) {
  const buckets = [
    { label: "Current", min: -Infinity, max: 0, color: CHART_COLORS.aging.current },
    { label: "1-30", min: 1, max: 30, color: CHART_COLORS.aging.current },
    { label: "31-60", min: 31, max: 60, color: CHART_COLORS.aging.days30 },
    { label: "61-90", min: 61, max: 90, color: CHART_COLORS.aging.days60 },
    { label: "90+", min: 91, max: Infinity, color: CHART_COLORS.aging.days90 },
  ];

  const bucketTotals = buckets.map((bucket) => {
    const total = items
      .filter((item) => {
        const daysOverdue = differenceInDays(new Date(), new Date(item.dueDate));
        return daysOverdue >= bucket.min && daysOverdue <= bucket.max;
      })
      .reduce((sum, item) => sum + item.amount, 0);
    return { ...bucket, total };
  });

  const grandTotal = bucketTotals.reduce((sum, b) => sum + b.total, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{title}</h4>
        <span className="text-sm font-bold"><FormattedCurrency amount={grandTotal} currency={currency} /></span>
      </div>
      <div className="flex h-8 rounded-lg overflow-hidden shadow-inner bg-muted/50">
        {bucketTotals.map((bucket, index) => {
          const percentage = grandTotal > 0 ? (bucket.total / grandTotal) * 100 : 0;
          if (percentage === 0) return null;
          return (
            <div
              key={index}
              className="flex items-center justify-center text-xs font-medium text-white transition-all hover:opacity-80"
              style={{
                width: `${percentage}%`,
                backgroundColor: bucket.color,
                minWidth: percentage > 0 ? "40px" : 0,
              }}
              title={`${bucket.label}: ${formatAmount(bucket.total, currency)}`}
            >
              {percentage > 15 && <FormattedCurrency amount={bucket.total} currency={currency} />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between gap-2">
        {bucketTotals.map((bucket, index) => (
          <div key={index} className="flex items-center gap-1 text-xs">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: bucket.color }}
            />
            <span className="text-muted-foreground">{bucket.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgingReportCard({ invoices, bills, currency = "USD" }: AgingReportCardProps) {
  const allItems = [
    ...invoices.map((i) => ({ ...i, type: "invoice" as const })),
    ...bills.map((b) => ({ ...b, type: "bill" as const })),
  ].sort((a, b) => {
    const aDays = differenceInDays(new Date(), new Date(a.dueDate));
    const bDays = differenceInDays(new Date(), new Date(b.dueDate));
    return bDays - aDays;
  });

  const overdueItems = allItems.filter(
    (item) => differenceInDays(new Date(), new Date(item.dueDate)) > 0
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-500/10 to-transparent">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" />
          AR/AP Aging Report
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {/* Aging Bars */}
        <div className="grid md:grid-cols-2 gap-6">
          <AgingBar items={invoices} title="Accounts Receivable" type="invoice" currency={currency} />
          <AgingBar items={bills} title="Accounts Payable" type="bill" currency={currency} />
        </div>

        {/* Overdue Items Table */}
        {overdueItems.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Overdue Items ({overdueItems.length})
            </h4>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueItems.map((item) => {
                    const aging = getAgingBucket(item.dueDate);
                    const daysOverdue = differenceInDays(new Date(), new Date(item.dueDate));
                    return (
                      <TableRow key={item.id} className="hover:bg-muted/30">
                        <TableCell>
                          <Badge variant={item.type === "invoice" ? "default" : "secondary"}>
                            {item.type === "invoice" ? "AR" : "AP"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.number}</TableCell>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="font-bold"><FormattedCurrency amount={item.amount} currency={currency} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              style={{
                                borderColor: aging.color,
                                color: aging.color,
                              }}
                            >
                              {daysOverdue} days overdue
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {overdueItems.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="w-5 h-5 mr-2 text-green-500" />
            All items are current
          </div>
        )}
      </CardContent>
    </Card>
  );
}
