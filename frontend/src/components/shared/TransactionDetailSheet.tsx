import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, ArrowUpRight, ArrowDownRight, Trash2 } from "lucide-react";
import { formatAmount } from "@/lib/utils";
import { FC } from "@/components/shared/FormattedCurrency";
import { format } from "date-fns";
import { getCanonicalCategory } from "@/lib/sectorMapping";

interface SummaryItem {
  label: string;
  value: React.ReactNode;
}

interface TransactionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  transactions: any[];
  currency: string;
  summary?: SummaryItem[];
  /** If provided, shows a status dropdown + delete button per row */
  onStatusChange?: (item: any, newStatus: string) => void;
  onDelete?: (item: any) => void;
  /** Which status options to show (defaults to invoice statuses) */
  statusOptions?: string[];
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return format(new Date(dateStr + "T00:00:00"), "MMM d, yyyy");
  } catch {
    return dateStr;
  }
}

export function TransactionDetailSheet({
  open,
  onOpenChange,
  title,
  description,
  transactions,
  currency,
  summary,
  onStatusChange,
  onDelete,
  statusOptions = ["draft", "sent", "paid", "overdue", "cancelled"],
}: TransactionDetailSheetProps) {
  const total = transactions.reduce((s, t) => s + (t.amount || t.total || 0), 0);
  const count = transactions.length;
  const avg = count > 0 ? total / count : 0;

  const handleExport = () => {
    const sanitize = (v: string) => {
      if (/^[=+\-@\t\r]/.test(v)) return `'${v}`;
      return v.includes(",") || v.includes('"')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
    };
    const rows = [
      ["Date", "Description", "Category", "Amount"],
      ...transactions.map((t) => [
        t.transaction_date || t.bill_date || t.invoice_date || "",
        t.description || t.notes || t.vendor_name || t.customer_name || "",
        getCanonicalCategory(t.category, t.description, t.description) || "Other",
        String(t.amount ?? t.total ?? 0),
      ]),
    ];
    const csv = rows.map((r) => r.map(sanitize).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="space-y-4 pt-4">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {summary ? (
              summary.map((s) => (
                <div key={s.label} className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                  <p className="text-sm font-semibold mt-0.5">{s.value}</p>
                </div>
              ))
            ) : (
              <>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                  <p className="text-sm font-semibold mt-0.5"><FC amount={Math.abs(total)} currency={currency} /></p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Count</p>
                  <p className="text-sm font-semibold mt-0.5">{count}</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Average</p>
                  <p className="text-sm font-semibold mt-0.5"><FC amount={Math.abs(avg)} currency={currency} /></p>
                </div>
              </>
            )}
          </div>

          <Separator />

          {/* Transaction list */}
          {count === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">No individual items to display</p>
              {summary && summary.length > 0 && (
                <p className="text-xs text-muted-foreground/70">
                  Summary metrics are shown above based on aggregated data
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-md border max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    {(onStatusChange || onDelete) && (
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 200).map((t, i) => {
                    const amt = t.amount ?? t.total ?? 0;
                    const desc = t.description || t.notes || t.vendor_name || t.customer_name || "—";
                    const cat = getCanonicalCategory(t.category, desc, desc) || "";
                    const dateStr = t.transaction_date || t.bill_date || t.invoice_date || "";
                    return (
                      <TableRow key={t.id || i}>
                        <TableCell className="text-xs whitespace-nowrap py-2">
                          {formatDate(dateStr)}
                        </TableCell>
                        <TableCell className="text-xs py-2">
                          <div className="max-w-[200px] truncate">{desc}</div>
                          {cat && (
                            <Badge variant="outline" className="text-[9px] mt-0.5">
                              {cat}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-right py-2 whitespace-nowrap">
                          <span className={amt >= 0 ? "text-emerald-600" : "text-red-500"}>
                            {amt >= 0 ? (
                              <ArrowUpRight className="inline h-3 w-3 mr-0.5" />
                            ) : (
                              <ArrowDownRight className="inline h-3 w-3 mr-0.5" />
                            )}
                            <FC amount={Math.abs(amt)} currency={currency} />
                          </span>
                        </TableCell>
                        {(onStatusChange || onDelete) && (
                          <TableCell className="text-xs text-right py-2">
                            <div className="flex items-center justify-end gap-1">
                              {onStatusChange && (
                                <Select
                                  value={t.status || ""}
                                  onValueChange={(v) => onStatusChange(t, v)}
                                >
                                  <SelectTrigger className="h-6 w-[90px] text-[10px]">
                                    <SelectValue placeholder="Status" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {statusOptions.map((s) => (
                                      <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {onDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => onDelete(t)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                  {count > 200 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-2">
                        Showing 200 of {count} transactions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Export */}
          {count > 0 && (
            <Button variant="outline" size="sm" className="w-full" onClick={handleExport}>
              <Download className="h-3.5 w-3.5 mr-2" />
              Export {count} transactions as CSV
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
