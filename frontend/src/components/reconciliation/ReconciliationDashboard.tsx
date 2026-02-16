import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/EmptyState";
import { GitCompareArrows, Plus, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

interface Props {
  bankAccounts: Array<{ id: string; account_name: string; bank_name: string; currency: string | null; balance: number | null }>;
  reconciliations: Array<{ id: string; bank_account_id: string; period_start: string; period_end: string; status: string; unreconciled_difference: number; finalized_at: string | null }>;
  isLoading: boolean;
  onSelectReconciliation: (id: string) => void;
  onRefresh: () => void;
}

export function ReconciliationDashboard({ bankAccounts, reconciliations, isLoading, onSelectReconciliation, onRefresh }: Props) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { label: format(d, "MMMM yyyy"), start: format(startOfMonth(d), "yyyy-MM-dd"), end: format(endOfMonth(d), "yyyy-MM-dd") };
  });

  const handleCreate = async () => {
    if (!selectedAccountId || !selectedMonth) {
      toast.error("Select an account and month");
      return;
    }
    const month = months.find(m => m.start === selectedMonth);
    if (!month) return;

    const existing = reconciliations.find(r => r.bank_account_id === selectedAccountId && r.period_start === month.start);
    if (existing) {
      onSelectReconciliation(existing.id);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("reconciliations").insert({
      user_id: user.id,
      bank_account_id: selectedAccountId,
      period_start: month.start,
      period_end: month.end,
      status: "draft",
    }).select().single();

    if (error) {
      toast.error("Failed to create reconciliation");
      return;
    }
    toast.success("Reconciliation created");
    onSelectReconciliation(data.id);
  };

  const getStatusBadge = (status: string) => {
    if (status === "finalized") return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Finalized</Badge>;
    return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
  };

  const getAccountName = (id: string) => {
    const acct = bankAccounts.find(a => a.id === id);
    return acct ? `${acct.account_name} (${acct.bank_name})` : "Unknown";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reconciliation</h1>
        <p className="text-muted-foreground">Compare bank statements against your internal ledger</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" />New Reconciliation</CardTitle>
          <CardDescription>Select a bank account and period to start reconciling</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select bank account" /></SelectTrigger>
              <SelectContent>
                {bankAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.account_name} — {a.bank_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.start} value={m.start}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handleCreate} disabled={!selectedAccountId || !selectedMonth}>
              <GitCompareArrows className="w-4 h-4 mr-2" />Start
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reconciliation History</CardTitle></CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <EmptyState icon={GitCompareArrows} title="No reconciliations yet" description="Create your first reconciliation by selecting an account and period above." />
          ) : (
            <div className="space-y-3">
              {reconciliations.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => onSelectReconciliation(r.id)}>
                  <div className="flex-1">
                    <p className="font-medium">{getAccountName(r.bank_account_id)}</p>
                    <p className="text-sm text-muted-foreground">{format(new Date(r.period_start), "MMM d")} — {format(new Date(r.period_end), "MMM d, yyyy")}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {r.unreconciled_difference !== 0 && (
                      <span className="text-sm font-medium text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />${Math.abs(r.unreconciled_difference).toFixed(2)}
                      </span>
                    )}
                    {getStatusBadge(r.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
