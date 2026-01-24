import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, ArrowRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { 
  type MatchedTransaction, 
  type AmountMismatch, 
  type MissingTransaction,
  type DateDiscrepancy,
  type DuplicateTransaction 
} from "@/lib/reconciliation";

interface OdooConnection {
  id: string;
  connection_name: string;
  config?: {
    server_url?: string;
  };
}

interface ResultsTabsProps {
  matched: MatchedTransaction[];
  amountMismatches: AmountMismatch[];
  missingInOdoo: MissingTransaction[];
  missingInBank: MissingTransaction[];
  dateDiscrepancies: DateDiscrepancy[];
  duplicates: DuplicateTransaction[];
  onAddToOdoo?: (transaction: MissingTransaction) => Promise<void>;
  odooConnection?: OdooConnection | null;
}

export function ResultsTabs({
  matched,
  amountMismatches,
  missingInOdoo,
  missingInBank,
  dateDiscrepancies,
  duplicates,
  onAddToOdoo,
  odooConnection,
}: ResultsTabsProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const handleAddToOdoo = async (transaction: MissingTransaction) => {
    if (!onAddToOdoo) return;
    
    setLoadingIds(prev => new Set(prev).add(transaction.id));
    try {
      await onAddToOdoo(transaction);
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(transaction.id);
        return next;
      });
    }
  };

  const EmptyState = ({ message }: { message: string }) => (
    <div className="py-8 text-center text-muted-foreground">
      {message}
    </div>
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="matched">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="matched" className="text-xs">
              Matched ({matched.length})
            </TabsTrigger>
            <TabsTrigger value="amount" className="text-xs">
              Amount ({amountMismatches.length})
            </TabsTrigger>
            <TabsTrigger value="missing-odoo" className="text-xs">
              Missing Odoo ({missingInOdoo.length})
            </TabsTrigger>
            <TabsTrigger value="missing-bank" className="text-xs">
              Missing Bank ({missingInBank.length})
            </TabsTrigger>
            <TabsTrigger value="date" className="text-xs">
              Date ({dateDiscrepancies.length})
            </TabsTrigger>
            <TabsTrigger value="duplicates" className="text-xs">
              Duplicates ({duplicates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matched">
            {matched.length === 0 ? (
              <EmptyState message="No matched transactions found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Bank Amount</TableHead>
                    <TableHead className="text-right">Odoo Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matched.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.bankAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.odooAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="amount">
            {amountMismatches.length === 0 ? (
              <EmptyState message="No amount mismatches found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Bank Amount</TableHead>
                    <TableHead className="text-right">Odoo Amount</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {amountMismatches.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.bankAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.odooAmount)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="destructive">
                          {item.difference > 0 ? "+" : ""}{formatCurrency(item.difference)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={!odooConnection}>
                          Correct in Odoo
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="missing-odoo">
            {missingInOdoo.length === 0 ? (
              <EmptyState message="No transactions missing in Odoo" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingInOdoo.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled={!odooConnection || !onAddToOdoo || loadingIds.has(item.id)}
                          onClick={() => handleAddToOdoo(item)}
                        >
                          {loadingIds.has(item.id) ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Plus className="w-3 h-3 mr-1" />
                          )}
                          Add to Odoo
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="missing-bank">
            {missingInBank.length === 0 ? (
              <EmptyState message="No transactions missing in bank statement" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingInBank.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="date">
            {dateDiscrepancies.length === 0 ? (
              <EmptyState message="No date discrepancies found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bank Date</TableHead>
                    <TableHead>Odoo Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Days Off</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dateDiscrepancies.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.bankDate)}</TableCell>
                      <TableCell>{formatDate(item.odooDate)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.daysDiff} days</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={!odooConnection}>
                          Correct in Odoo
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="duplicates">
            {duplicates.length === 0 ? (
              <EmptyState message="No duplicate transactions found" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Occurrences</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicates.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.occurrences}x</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" disabled={!odooConnection}>
                          Remove Duplicate
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
