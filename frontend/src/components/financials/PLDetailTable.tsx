import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { replaceAedSymbol } from "@/lib/utils";
import { resolveCategory } from "@/lib/sectorMapping";

interface PLRow {
  id: string;
  label: string;
  isHeader?: boolean;
  isTotal?: boolean;
  quarters: number[];
  changePct: number | null;
}

interface PLDetailTableProps {
  invoices: any[];
  bills: any[];
  accounts: any[];
  quarterLabels: string[];
  quarterRanges: { from: Date; to: Date }[];
  onRowClick: (row: PLRow) => void;
  currency?: string;
}

export function PLDetailTable({ invoices, bills, accounts, quarterLabels, quarterRanges, onRowClick, currency = "USD" }: PLDetailTableProps) {
  const fmt = (v: number) =>
    replaceAedSymbol(new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v), currency);
  const rows = useMemo(() => {
    const result: PLRow[] = [];

    // Helper: sum invoices in a quarter by category (compare resolved categories)
    const invoiceByQuarterCategory = (cat: string, qIdx: number) => {
      const { from, to } = quarterRanges[qIdx];
      return invoices
        .filter(inv => {
          const d = new Date(inv.invoice_date);
          const resolvedCat = resolveCategory(inv.category) || "Other Revenue";
          return d >= from && d <= to && resolvedCat === cat;
        })
        .reduce((s, inv) => s + Number(inv.total_amount || 0), 0);
    };

    const billByQuarterCategory = (cat: string, qIdx: number) => {
      const { from, to } = quarterRanges[qIdx];
      return bills
        .filter(b => {
          const d = new Date(b.bill_date);
          const resolvedCat = resolveCategory(b.category) || "General Expenses";
          return d >= from && d <= to && resolvedCat === cat;
        })
        .reduce((s, b) => s + Number(b.total_amount || 0), 0);
    };

    // Revenue categories (resolved to proper sector names)
    const revenueCategories = new Set<string>();
    invoices.forEach(inv => revenueCategories.add(
      resolveCategory(inv.category) || "Other Revenue"
    ));

    const expenseCategories = new Set<string>();
    bills.forEach(b => expenseCategories.add(
      resolveCategory(b.category) || "General Expenses"
    ));

    // Revenue section
    result.push({ id: "rev-header", label: "REVENUE", isHeader: true, quarters: [], changePct: null });
    const revTotals = quarterRanges.map(() => 0);

    Array.from(revenueCategories).sort().forEach((cat, idx) => {
      const quarters = quarterRanges.map((_, qIdx) => invoiceByQuarterCategory(cat, qIdx));
      quarters.forEach((v, qi) => revTotals[qi] += v);
      const last = quarters[quarters.length - 1];
      const prev = quarters.length > 1 ? quarters[quarters.length - 2] : 0;
      const changePct = prev > 0 ? ((last - prev) / prev) * 100 : null;
      result.push({ id: `rev-${idx}`, label: cat, quarters, changePct });
    });

    result.push({ id: "rev-total", label: "TOTAL REVENUE", isTotal: true, quarters: revTotals, changePct: revTotals.length > 1 && revTotals[revTotals.length - 2] > 0 ? ((revTotals[revTotals.length - 1] - revTotals[revTotals.length - 2]) / revTotals[revTotals.length - 2]) * 100 : null });

    // Expense section
    result.push({ id: "exp-header", label: "OPERATING EXPENSES", isHeader: true, quarters: [], changePct: null });
    const expTotals = quarterRanges.map(() => 0);

    Array.from(expenseCategories).sort().forEach((cat, idx) => {
      const quarters = quarterRanges.map((_, qIdx) => billByQuarterCategory(cat, qIdx));
      quarters.forEach((v, qi) => expTotals[qi] += v);
      const last = quarters[quarters.length - 1];
      const prev = quarters.length > 1 ? quarters[quarters.length - 2] : 0;
      const changePct = prev > 0 ? ((last - prev) / prev) * 100 : null;
      result.push({ id: `exp-${idx}`, label: cat, quarters, changePct });
    });

    result.push({ id: "exp-total", label: "TOTAL OPERATING EXPENSES", isTotal: true, quarters: expTotals, changePct: expTotals.length > 1 && expTotals[expTotals.length - 2] > 0 ? ((expTotals[expTotals.length - 1] - expTotals[expTotals.length - 2]) / expTotals[expTotals.length - 2]) * 100 : null });

    // Net Income
    const netQuarters = revTotals.map((r, i) => r - expTotals[i]);
    const lastNet = netQuarters[netQuarters.length - 1];
    const prevNet = netQuarters.length > 1 ? netQuarters[netQuarters.length - 2] : 0;
    result.push({
      id: "net-income",
      label: "NET INCOME",
      isTotal: true,
      quarters: netQuarters,
      changePct: prevNet !== 0 ? ((lastNet - prevNet) / Math.abs(prevNet)) * 100 : null,
    });

    return result;
  }, [invoices, bills, quarterRanges]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Profit & Loss Detail</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Account</TableHead>
              {quarterLabels.map(q => (
                <TableHead key={q} className="text-right min-w-[100px]">{q}</TableHead>
              ))}
              <TableHead className="text-right min-w-[80px]">Change %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow
                key={row.id}
                className={`
                  ${row.isHeader ? "bg-muted/50" : ""}
                  ${row.isTotal ? "font-bold border-t-2" : ""}
                  ${!row.isHeader && !row.isTotal ? "cursor-pointer hover:bg-muted/30" : ""}
                `}
                onClick={() => !row.isHeader && onRowClick(row)}
              >
                <TableCell className={`${row.isHeader || row.isTotal ? "font-bold text-foreground" : ""}`}>
                  <span className={!row.isHeader && !row.isTotal ? "pl-4" : ""}>{row.label}</span>
                </TableCell>
                {row.quarters.map((val, qi) => (
                  <TableCell key={qi} className={`text-right ${row.isTotal ? "font-bold" : ""} ${val < 0 ? "text-destructive" : ""}`}>
                    {fmt(val)}
                  </TableCell>
                ))}
                {row.isHeader ? (
                  <TableCell />
                ) : (
                  <TableCell className="text-right">
                    {row.changePct !== null ? (
                      <div className={`flex items-center justify-end gap-1 ${row.changePct >= 0 ? "text-green-600" : "text-destructive"}`}>
                        {row.changePct >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        <span className="text-sm">{Math.abs(row.changePct).toFixed(1)}%</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
