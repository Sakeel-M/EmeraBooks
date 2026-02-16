import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  HelpCircle, 
  Calendar, 
  Copy,
  TrendingUp
} from "lucide-react";

interface ReconciliationSummaryProps {
  matchRate: number;
  matched: number;
  amountMismatches: number;
  missingInLedger: number;
  missingInStatement: number;
  dateDiscrepancies: number;
  duplicates: number;
  totalDiscrepancy: number;
}

export function ReconciliationSummary({ 
  matchRate,
  matched,
  amountMismatches,
  missingInLedger,
  missingInStatement,
  dateDiscrepancies,
  duplicates,
  totalDiscrepancy
}: ReconciliationSummaryProps) {
  const categories = [
    {
      label: "Matched",
      value: matched,
      icon: CheckCircle2,
      bgColor: "bg-green-50 dark:bg-green-950",
      borderColor: "border-green-200 dark:border-green-800",
      textColor: "text-green-700 dark:text-green-300",
      iconColor: "text-green-600",
    },
    {
      label: "Amount Mismatches",
      value: amountMismatches,
      icon: AlertTriangle,
      bgColor: "bg-yellow-50 dark:bg-yellow-950",
      borderColor: "border-yellow-200 dark:border-yellow-800",
      textColor: "text-yellow-700 dark:text-yellow-300",
      iconColor: "text-yellow-600",
    },
    {
      label: "Missing in Ledger",
      value: missingInLedger,
      icon: XCircle,
      bgColor: "bg-red-50 dark:bg-red-950",
      borderColor: "border-red-200 dark:border-red-800",
      textColor: "text-red-700 dark:text-red-300",
      iconColor: "text-red-600",
    },
    {
      label: "Missing in Statement",
      value: missingInStatement,
      icon: HelpCircle,
      bgColor: "bg-orange-50 dark:bg-orange-950",
      borderColor: "border-orange-200 dark:border-orange-800",
      textColor: "text-orange-700 dark:text-orange-300",
      iconColor: "text-orange-600",
    },
    {
      label: "Date Discrepancies",
      value: dateDiscrepancies,
      icon: Calendar,
      bgColor: "bg-purple-50 dark:bg-purple-950",
      borderColor: "border-purple-200 dark:border-purple-800",
      textColor: "text-purple-700 dark:text-purple-300",
      iconColor: "text-purple-600",
    },
    {
      label: "Duplicates",
      value: duplicates,
      icon: Copy,
      bgColor: "bg-blue-50 dark:bg-blue-950",
      borderColor: "border-blue-200 dark:border-blue-800",
      textColor: "text-blue-700 dark:text-blue-300",
      iconColor: "text-blue-600",
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Reconciliation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center mb-6">
            <div className="text-center">
              <div className={`text-5xl font-bold ${matchRate >= 80 ? 'text-green-600' : matchRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {matchRate.toFixed(1)}%
              </div>
              <p className="text-muted-foreground mt-1">Match Rate</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((category) => {
              const Icon = category.icon;
              return (
                <div
                  key={category.label}
                  className={`p-4 rounded-lg border ${category.bgColor} ${category.borderColor}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${category.iconColor}`} />
                    <span className={`text-xs font-medium ${category.textColor}`}>
                      {category.label}
                    </span>
                  </div>
                  <div className={`text-2xl font-bold ${category.textColor}`}>
                    {category.value}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {totalDiscrepancy > 0 && (
        <Alert className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            <span className="font-medium">Total Discrepancy Found:</span> ${totalDiscrepancy.toFixed(2)} - 
            Review the details below and correct any discrepancies.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
