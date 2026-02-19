import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, BookOpen, CreditCard, Hash, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getSectorStyle } from "@/lib/sectorStyles";
import { formatAmount } from "@/lib/utils";

interface LedgerRow {
  id: string;
  date: string;
  account: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  source: "transaction" | "journal";
}

interface LedgerEntryDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: LedgerRow | null;
  currency: string;
}

export function LedgerEntryDetailSheet({ open, onOpenChange, entry, currency }: LedgerEntryDetailSheetProps) {
  if (!entry) return null;

  const style = getSectorStyle(entry.account, 0);
  const Icon = style.icon;
  const net = entry.debit - entry.credit;
  const isJournal = entry.source === "journal";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${style.bgColor} flex items-center justify-center shrink-0`}>
              <Icon className={`w-5 h-5 ${style.textColor}`} />
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-left text-base leading-tight">{entry.account}</SheetTitle>
              <Badge
                variant="outline"
                className={`mt-1 text-xs ${isJournal ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}
              >
                {isJournal ? "Journal Entry" : "Bank Transaction"}
              </Badge>
            </div>
          </div>
        </SheetHeader>

        <Separator className="mb-5" />

        {/* Date */}
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <Tag className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Date</p>
              <p className="font-medium text-sm">
                {entry.date ? format(new Date(entry.date), "MMMM d, yyyy") : "—"}
              </p>
            </div>
          </div>

          {/* Description */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Description</p>
              <p className="font-medium text-sm leading-relaxed">{entry.description || "—"}</p>
            </div>
          </div>

          {/* Reference */}
          {entry.reference && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <Hash className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Reference</p>
                <p className="font-medium text-sm font-mono">{entry.reference}</p>
              </div>
            </div>
          )}
        </div>

        <Separator className="my-5" />

        {/* Amounts */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Amounts</p>

          <div className="grid grid-cols-2 gap-3">
            {/* Debit */}
            <div className={`rounded-xl p-4 border ${entry.debit > 0 ? "bg-primary/5 border-primary/20" : "bg-muted/50 border-border"}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight className={`w-3.5 h-3.5 ${entry.debit > 0 ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Debit</span>
              </div>
              <p className={`text-lg font-bold ${entry.debit > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {entry.debit > 0 ? formatAmount(entry.debit, currency) : "—"}
              </p>
            </div>

            {/* Credit */}
            <div className={`rounded-xl p-4 border ${entry.credit > 0 ? "bg-destructive/5 border-destructive/20" : "bg-muted/50 border-border"}`}>
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownLeft className={`w-3.5 h-3.5 ${entry.credit > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Credit</span>
              </div>
              <p className={`text-lg font-bold ${entry.credit > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {entry.credit > 0 ? formatAmount(entry.credit, currency) : "—"}
              </p>
            </div>
          </div>

          {/* Net */}
          <div className={`rounded-xl p-4 border ${net >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-destructive/5 border-destructive/20"}`}>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Net Position (Dr − Cr)</p>
            <p className={`text-xl font-bold ${net >= 0 ? "text-green-600" : "text-destructive"}`}>
              {net >= 0 ? "+" : ""}{formatAmount(Math.abs(net), currency)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{net >= 0 ? "Debit surplus" : "Credit surplus"}</p>
          </div>
        </div>

        <Separator className="my-5" />

        {/* Source Info */}
        <div className="rounded-xl bg-muted/50 border p-4">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Source</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <Badge variant="outline" className={`text-xs ${isJournal ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                {isJournal ? "Journal Entry" : "Bank Transaction"}
              </Badge>
            </div>
            {entry.reference && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Reference #</span>
                <span className="text-xs font-mono font-medium">{entry.reference}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Account</span>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>{entry.account}</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
