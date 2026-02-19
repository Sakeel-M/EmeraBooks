import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface TransactionTableProps {
  data: any[];
}

const TransactionTable = ({ data }: TransactionTableProps) => {
  const displayData = data.slice(0, 10); // Show first 10 transactions

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Food & Dining': 'bg-orange-100 text-orange-700',
      'Shopping': 'bg-orange-100 text-orange-700',
      'Transportation': 'bg-orange-100 text-orange-700',
      'Entertainment': 'bg-orange-100 text-orange-700',
      'Bills & Utilities': 'bg-orange-100 text-orange-700',
      'Healthcare': 'bg-orange-100 text-orange-700',
      'Other': 'bg-muted text-muted-foreground',
    };
    return colors[category] || 'bg-muted text-muted-foreground';
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">Recent Transactions</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.map((transaction, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">
                  {transaction.Date}
                </TableCell>
                <TableCell className="max-w-xs truncate">
                  {transaction.Description}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={getCategoryColor(transaction.Category)}>
                    {transaction.Category}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <span className={transaction.Amount < 0 ? 'text-destructive font-semibold' : 'text-green-600 font-semibold'}>
                    {transaction.Amount < 0 ? '-' : '+'}
                    {Math.abs(transaction.Amount).toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {data.length > 10 && (
        <p className="text-sm text-muted-foreground text-center mt-4">
          Showing 10 of {data.length} transactions
        </p>
      )}
    </Card>
  );
};

export default TransactionTable;
