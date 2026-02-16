import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReconciliationSettings } from "./ReconciliationSettings";
import { ArrowLeft, Play, Lock, CheckCircle, AlertTriangle, XCircle, Calendar, Copy, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  reconcileTransactions,
  defaultSettings,
  type ReconciliationSettings as SettingsType,
  type ReconciliationResults,
  type BankTransaction,
  type LedgerEntry,
} from "@/lib/reconciliation";
import { format } from "date-fns";

interface Props {
  reconciliationId: string;
  onBack: () => void;
}

export function ReconciliationDetail({ reconciliationId, onBack }: Props) {
  const [recon, setRecon] = useState<any>(null);
  const [bankAccount, setBankAccount] = useState<any>(null);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchReconciliation();
  }, [reconciliationId]);

  const fetchReconciliation = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("reconciliations")
      .select("*")
      .eq("id", reconciliationId)
      .single();

    if (error || !data) {
      toast.error("Failed to load reconciliation");
      onBack();
      return;
    }
    setRecon(data);

    if (data.bank_account_id) {
      const { data: acct } = await supabase.from("bank_accounts").select("*").eq("id", data.bank_account_id).single();
      setBankAccount(acct);
    }
    setIsLoading(false);
  };

  const handleRunReconciliation = async () => {
    if (!recon) return;
    setIsRunning(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Fetch statement transactions (bank transactions in the period)
      const { data: stmtTxns } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", recon.period_start)
        .lte("transaction_date", recon.period_end)
        .order("transaction_date");

      // Fetch ledger entries (journal entry lines in the period)
      const { data: journalEntries } = await supabase
        .from("journal_entries")
        .select("id, entry_date, description, reference")
        .eq("user_id", user.id)
        .gte("entry_date", recon.period_start)
        .lte("entry_date", recon.period_end);

      let ledgerEntries: LedgerEntry[] = [];

      if (journalEntries && journalEntries.length > 0) {
        const entryIds = journalEntries.map(e => e.id);
        const { data: lines } = await supabase
          .from("journal_entry_lines")
          .select("id, journal_entry_id, debit_amount, credit_amount, description, account_id")
          .in("journal_entry_id", entryIds);

        if (lines) {
          ledgerEntries = lines.map(line => {
            const entry = journalEntries.find(e => e.id === line.journal_entry_id);
            const amount = (line.debit_amount || 0) - (line.credit_amount || 0);
            return {
              id: line.id,
              date: entry?.entry_date || "",
              description: line.description || entry?.description || "",
              amount,
              type: 'journal_line' as const,
            };
          });
        }
      }

      const bankTxns: BankTransaction[] = (stmtTxns || []).map(t => ({
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        file_id: t.file_id,
      }));

      const reconResults = reconcileTransactions(bankTxns, ledgerEntries, settings);
      setResults(reconResults);

      // Update reconciliation record
      await supabase.from("reconciliations").update({
        unreconciled_difference: reconResults.unreconciledDifference,
        statement_ending_balance: bankTxns.reduce((s, t) => s + t.amount, 0),
        ledger_ending_balance: ledgerEntries.reduce((s, e) => s + e.amount, 0),
      }).eq("id", reconciliationId);

      toast.success("Reconciliation complete");
    } catch (err) {
      console.error(err);
      toast.error("Reconciliation failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleFinalize = async () => {
    if (!results || results.unreconciledDifference !== 0) {
      toast.error("Unreconciled difference must be $0.00 to finalize");
      return;
    }
    const { error } = await supabase.from("reconciliations").update({
      status: "finalized",
      finalized_at: new Date().toISOString(),
    }).eq("id", reconciliationId);

    if (error) { toast.error("Failed to finalize"); return; }
    toast.success("Reconciliation finalized and locked");
    onBack();
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const isFinalized = recon?.status === "finalized";

  const flagIcons: Record<string, any> = {
    missing_in_ledger: XCircle,
    missing_in_statement: XCircle,
    amount_mismatch: AlertTriangle,
    date_mismatch: Calendar,
    duplicate: Copy,
  };

  const flagLabels: Record<string, string> = {
    missing_in_ledger: "Missing in Ledger",
    missing_in_statement: "Missing in Statement",
    amount_mismatch: "Amount Mismatch",
    date_mismatch: "Date Mismatch",
    duplicate: "Duplicate",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">
            {bankAccount ? `${bankAccount.account_name} — ${bankAccount.bank_name}` : "Reconciliation"}
          </h1>
          <p className="text-muted-foreground">
            {recon && `${format(new Date(recon.period_start), "MMM d")} — ${format(new Date(recon.period_end), "MMM d, yyyy")}`}
          </p>
        </div>
        {isFinalized ? (
          <Badge className="bg-green-100 text-green-700 border-green-300"><Lock className="w-3 h-3 mr-1" />Finalized</Badge>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleRunReconciliation} disabled={isRunning}>
              {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {results ? "Re-run" : "Run Reconciliation"}
            </Button>
            {results && results.unreconciledDifference === 0 && (
              <Button variant="outline" onClick={handleFinalize}><Lock className="w-4 h-4 mr-2" />Finalize</Button>
            )}
          </div>
        )}
      </div>

      {!isFinalized && !results && (
        <Card>
          <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
          <CardContent>
            <ReconciliationSettings settings={settings} onSettingsChange={setSettings} />
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className={`text-3xl font-bold ${results.matchRate >= 80 ? 'text-green-600' : results.matchRate >= 50 ? 'text-yellow-600' : 'text-destructive'}`}>
                  {results.matchRate.toFixed(1)}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">Match Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-foreground">{results.matched.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Matched</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className="text-3xl font-bold text-yellow-600">{results.flags.length}</div>
                <p className="text-sm text-muted-foreground mt-1">Flags</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <div className={`text-3xl font-bold ${results.unreconciledDifference === 0 ? 'text-green-600' : 'text-destructive'}`}>
                  ${Math.abs(results.unreconciledDifference).toFixed(2)}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Unreconciled</p>
              </CardContent>
            </Card>
          </div>

          {/* Detail tabs */}
          <Tabs defaultValue="matched">
            <TabsList>
              <TabsTrigger value="matched">Matched ({results.matched.length})</TabsTrigger>
              <TabsTrigger value="flags">Flags ({results.flags.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="matched">
              <Card>
                <CardContent className="pt-6">
                  {results.matched.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No matches found</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Statement</TableHead>
                          <TableHead>Ledger</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.matched.map(m => (
                          <TableRow key={m.id}>
                            <TableCell>{format(new Date(m.statementDate), "MMM d, yyyy")}</TableCell>
                            <TableCell>{m.statementDescription}</TableCell>
                            <TableCell>{m.ledgerDescription}</TableCell>
                            <TableCell className="text-right">${m.statementAmount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="flags">
              <Card>
                <CardContent className="pt-6">
                  {results.flags.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-2" />
                      <p className="text-muted-foreground">No issues found — ready to finalize!</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Flag</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.flags.map((f, i) => {
                          const Icon = flagIcons[f.flagType] || AlertTriangle;
                          return (
                            <TableRow key={`${f.id}-${i}`}>
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  <Icon className="w-3 h-3" />
                                  {flagLabels[f.flagType]}
                                </Badge>
                              </TableCell>
                              <TableCell>{format(new Date(f.date), "MMM d, yyyy")}</TableCell>
                              <TableCell>{f.description}</TableCell>
                              <TableCell className="text-right">${f.amount.toFixed(2)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {f.flagType === 'amount_mismatch' && f.difference !== undefined && `Diff: $${Math.abs(f.difference).toFixed(2)}`}
                                {f.flagType === 'date_mismatch' && f.daysDiff !== undefined && `${f.daysDiff} day(s) off`}
                                {f.flagType === 'duplicate' && f.occurrences !== undefined && `${f.occurrences} occurrences`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
