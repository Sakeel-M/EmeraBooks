import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import type { Transaction } from "@/lib/database";
import { replaceAedSymbol } from "@/lib/utils";

interface TransactionsTabProps {
  transactions: Transaction[];
  currency: string;
}

const TransactionsTab = ({ transactions, currency }: TransactionsTabProps) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.transaction_date.includes(q)
    );
  }, [transactions, search]);

  const fmt = (amount: number) =>
    replaceAedSymbol(new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Math.abs(amount)), currency);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">All Transactions</CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by description, category, or date"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>DATE</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead>CATEGORY</TableHead>
                <TableHead className="text-right">AMOUNT</TableHead>
                <TableHead>TYPE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(t.transaction_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{t.description}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={t.amount < 0 ? "text-destructive" : "text-green-600"}>
                      {t.amount < 0 ? "-" : "+"}{fmt(t.amount)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.amount < 0 ? "destructive" : "default"} className="text-xs">
                      {t.amount < 0 ? "Expense" : "Income"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Showing {filtered.length} of {transactions.length} transactions
        </p>
      </CardContent>
    </Card>
  );
};

export default TransactionsTab;
