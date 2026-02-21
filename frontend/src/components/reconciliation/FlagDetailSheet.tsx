import { format } from "date-fns";
import { AlertTriangle, Calendar, Copy, XCircle, ChevronRight, Lightbulb } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { FlaggedItem } from "@/lib/reconciliation";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

interface Props {
  flag: FlaggedItem | null;
  onClose: () => void;
}

const flagConfig: Record<string, { label: string; icon: any; badgeClass: string }> = {
  date_mismatch: {
    label: "Date Mismatch",
    icon: Calendar,
    badgeClass: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
  },
  amount_mismatch: {
    label: "Amount Mismatch",
    icon: AlertTriangle,
    badgeClass: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  },
  missing_in_ledger: {
    label: "Missing in Ledger",
    icon: XCircle,
    badgeClass: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  },
  missing_in_statement: {
    label: "Missing in Statement",
    icon: XCircle,
    badgeClass: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
  },
  duplicate: {
    label: "Duplicate",
    icon: Copy,
    badgeClass: "bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700",
  },
};

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "MMM d, yyyy"); } catch { return dateStr; }
}

function getExplanation(flag: FlaggedItem): { why: string; action: string } {
  switch (flag.flagType) {
    case "date_mismatch":
      return {
        why: `The bank statement records this transaction on ${formatDate(flag.date)}, but the ledger records it ${flag.daysDiff} day(s) ${
          flag.ledgerDate && new Date(flag.ledgerDate) > new Date(flag.date) ? "later" : "earlier"
        } on ${formatDate(flag.ledgerDate)}. This is within the configured date tolerance so it was flagged as a near-match rather than rejected.`,
        action:
          "Review both dates and update the ledger entry if needed. If this is a normal bank processing delay, you can accept it and proceed.",
      };
    case "amount_mismatch":
      return {
        why: `The bank statement shows ${flag.amount.toFixed(2)}, but the ledger records ${
          flag.ledgerAmount?.toFixed(2) ?? "—"
        }. The difference is ${Math.abs(flag.difference ?? 0).toFixed(2)}. This was within your tolerance setting and flagged as a near-match.`,
        action:
          "Check for rounding errors, partial payments, or fees. Correct the ledger entry amount if there is a genuine discrepancy.",
      };
    case "missing_in_ledger":
      return {
        why: `This transaction was found in the bank statement on ${formatDate(flag.date)} for ${flag.amount.toFixed(
          2
        )}, but no matching entry exists in the ledger for this period.`,
        action:
          "Create a journal entry, invoice, or bill to record this transaction in the ledger, then re-run the reconciliation.",
      };
    case "missing_in_statement":
      return {
        why: `This entry exists in the ledger (recorded on ${formatDate(flag.date)} for ${flag.amount.toFixed(
          2
        )}) but was not found in the bank statement for this period.`,
        action:
          "Check whether this transaction has cleared the bank. It may be pending, cancelled, or recorded on a different date in the statement.",
      };
    case "duplicate":
      return {
        why: `This transaction appears ${flag.occurrences} times in the bank statement with the same date, amount (${flag.amount.toFixed(
          2
        )}), and description. This could indicate duplicate imports or genuinely separate transactions.`,
        action:
          "Verify with the bank whether these are separate transactions. If they are duplicates, remove the extra entry from your statement data and re-run.",
      };
    default:
      return { why: "This item was flagged during reconciliation.", action: "Review and resolve manually." };
  }
}

export function FlagDetailSheet({ flag, onClose }: Props) {
  const { currency } = useCurrency();

  if (!flag) return null;

  const config = flagConfig[flag.flagType] ?? flagConfig.missing_in_ledger;
  const Icon = config.icon;
  const { why, action } = getExplanation(flag);

  const hasLedgerSide =
    flag.flagType === "date_mismatch" ||
    flag.flagType === "amount_mismatch" ||
    flag.flagType === "missing_in_statement";

  const statementAmount = flag.amount;
  const ledgerAmount = flag.flagType === "amount_mismatch" ? flag.ledgerAmount : flag.amount;
  const ledgerDate = flag.flagType === "date_mismatch" ? flag.ledgerDate : flag.date;

  return (
    <Sheet open={!!flag} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.badgeClass}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <SheetTitle className="text-lg">{config.label}</SheetTitle>
              <p className="text-sm text-muted-foreground">Why this was flagged</p>
            </div>
          </div>
        </SheetHeader>

        {/* Side-by-side comparison */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Comparison
          </h3>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border">
              {/* Statement side */}
              <div className="p-4 space-y-3 bg-muted/20">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Bank Statement
                </p>
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="text-sm font-medium">{formatDate(flag.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Amount</p>
                  <p className="text-sm font-medium">{formatAmount(statementAmount, currency)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm font-medium break-words">{flag.description || "—"}</p>
                </div>
              </div>

              {/* Ledger side */}
              <div className={`p-4 space-y-3 ${hasLedgerSide ? "bg-background" : "bg-muted/5 opacity-50"}`}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Ledger
                </p>
                {hasLedgerSide ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Date</p>
                      <p className={`text-sm font-medium ${flag.flagType === "date_mismatch" ? "text-destructive" : ""}`}>
                        {formatDate(ledgerDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className={`text-sm font-medium ${flag.flagType === "amount_mismatch" ? "text-destructive" : ""}`}>
                        {ledgerAmount != null ? formatAmount(ledgerAmount, currency) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-sm font-medium break-words">{flag.description || "—"}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic pt-2">No ledger match found</p>
                )}
              </div>
            </div>

            {/* Difference highlight for amount mismatch */}
            {flag.flagType === "amount_mismatch" && flag.difference !== undefined && (
              <div className="border-t border-border bg-destructive/5 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Difference</span>
                <span className="text-sm font-semibold text-destructive">
                  {formatAmount(Math.abs(flag.difference), currency)}
                </span>
              </div>
            )}

            {/* Days off highlight for date mismatch */}
            {flag.flagType === "date_mismatch" && flag.daysDiff !== undefined && (
              <div className="border-t border-border bg-primary/5 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Days apart</span>
                <span className="text-sm font-semibold text-primary">
                  {flag.daysDiff} day(s)
                </span>
              </div>
            )}

            {/* Duplicate count */}
            {flag.flagType === "duplicate" && flag.occurrences !== undefined && (
              <div className="border-t border-border bg-secondary/20 px-4 py-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Occurrences</span>
                <span className="text-sm font-semibold text-secondary-foreground">
                  {flag.occurrences}×
                </span>
              </div>
            )}
          </div>
        </div>

        <Separator className="mb-6" />

        {/* Explanation */}
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Explanation
          </h3>
          <p className="text-sm leading-relaxed text-foreground">{why}</p>
        </div>

        <Separator className="mb-6" />

        {/* Suggested Action */}
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Suggested Action
          </h3>
          <div className="flex gap-3 rounded-lg bg-primary/5 border border-primary/20 p-4">
            <Lightbulb className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm leading-relaxed text-foreground">{action}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
