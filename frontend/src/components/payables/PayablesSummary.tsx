import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownCircle, ArrowUpCircle, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";

interface PayablesSummaryProps {
  totalPayable: number;
  totalReceivable: number;
  netPosition: number;
  payableCount: number;
  receivableCount: number;
  overduePayables: number;
  overdueReceivables: number;
  currency?: string;
}

export function PayablesSummary({
  totalPayable,
  totalReceivable,
  netPosition,
  payableCount,
  receivableCount,
  overduePayables,
  overdueReceivables,
  currency = 'USD',
}: PayablesSummaryProps) {
  const isPositive = netPosition >= 0;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {/* Total Payable */}
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Payable
          </CardTitle>
          <ArrowUpCircle className="h-5 w-5 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">
            <FormattedCurrency amount={totalPayable} currency={currency} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {payableCount} items pending
            </p>
            {overduePayables > 0 && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" />
                {overduePayables} overdue
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Total Receivable */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Receivable
          </CardTitle>
          <ArrowDownCircle className="h-5 w-5 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-primary">
            <FormattedCurrency amount={totalReceivable} currency={currency} />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {receivableCount} items expected
            </p>
            {overdueReceivables > 0 && (
              <span className="flex items-center gap-1 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                {overdueReceivables} overdue
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Net Position */}
      <Card className={isPositive ? "border-primary/20 bg-primary/5" : "border-destructive/20 bg-destructive/5"}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Net Position
          </CardTitle>
          {isPositive ? (
            <TrendingUp className="h-5 w-5 text-primary" />
          ) : (
            <TrendingDown className="h-5 w-5 text-destructive" />
          )}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isPositive ? 'text-primary' : 'text-destructive'}`}>
            {isPositive ? '+' : ''}<FormattedCurrency amount={netPosition} currency={currency} />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isPositive ? 'Expected surplus' : 'Expected deficit'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
