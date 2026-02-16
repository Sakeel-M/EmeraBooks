import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const typeColors: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-red-100 text-red-700",
  equity: "bg-purple-100 text-purple-700",
  revenue: "bg-green-100 text-green-700",
  expense: "bg-yellow-100 text-yellow-700",
};

export function TrialBalanceTab() {
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["trial-balance"],
    queryFn: async () => {
      const { data } = await supabase.from("accounts").select("*").eq("is_active", true).order("account_type").order("account_number");
      return data || [];
    },
  });

  const totalDebit = accounts.reduce((s, a: any) => s + Math.max(a.balance || 0, 0), 0);
  const totalCredit = accounts.reduce((s, a: any) => s + Math.max(-(a.balance || 0), 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <Card>
      <CardContent className="pt-6">
        {accounts.length === 0 && !isLoading ? (
          <EmptyState icon={FileText} title="No accounts" description="Add accounts in the Chart of Accounts tab to see the trial balance." />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              {isBalanced ? (
                <Badge className="bg-green-100 text-green-700 gap-1"><CheckCircle className="w-3 h-3" />Balanced</Badge>
              ) : (
                <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Out of balance by ${Math.abs(totalDebit - totalCredit).toFixed(2)}</Badge>
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account #</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((a: any) => {
                  const bal = a.balance || 0;
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-mono">{a.account_number}</TableCell>
                      <TableCell>{a.account_name}</TableCell>
                      <TableCell><Badge variant="outline" className={typeColors[a.account_type] || ""}>{a.account_type}</Badge></TableCell>
                      <TableCell className="text-right">{bal > 0 ? `$${bal.toFixed(2)}` : "—"}</TableCell>
                      <TableCell className="text-right">{bal < 0 ? `$${Math.abs(bal).toFixed(2)}` : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={3} className="text-right">Totals</TableCell>
                  <TableCell className="text-right">${totalDebit.toFixed(2)}</TableCell>
                  <TableCell className="text-right">${totalCredit.toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  );
}
