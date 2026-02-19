import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReconciliationSettings } from "./ReconciliationSettings";
import { FlagDetailSheet } from "./FlagDetailSheet";
import { ArrowLeft, Play, Lock, CheckCircle, AlertTriangle, XCircle, Calendar, Copy, Loader2, FileText, BookOpen, Receipt, Info, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  reconcileTransactions,
  defaultSettings,
  type ReconciliationSettings as SettingsType,
  type ReconciliationResults,
  type BankTransaction,
  type LedgerEntry,
  type FlaggedItem,
} from "@/lib/reconciliation";
import { format } from "date-fns";

interface UploadedFile {
  id: string;
  file_name: string;
  bank_name: string;
  currency: string;
  total_transactions: number;
  created_at: string;
}

interface Props {
  reconciliationId: string;
  uploadedFiles: UploadedFile[];
  onBack: () => void;
}

export function ReconciliationDetail({ reconciliationId, uploadedFiles, onBack }: Props) {
  const [recon, setRecon] = useState<any>(null);
  const [results, setResults] = useState<ReconciliationResults | null>(null);
  const [settings, setSettings] = useState<SettingsType>(defaultSettings);
  const [ledgerSource, setLedgerSource] = useState<"journal" | "invoices_bills">("journal");
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [statementCount, setStatementCount] = useState<number>(0);
  const [ledgerCount, setLedgerCount] = useState<number>(0);
  const [selectedFlag, setSelectedFlag] = useState<FlaggedItem | null>(null);

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
    setIsLoading(false);
  };

  const sourceFile = recon?.statement_file_id
    ? uploadedFiles.find(f => f.id === recon.statement_file_id)
    : null;

  const handleRunReconciliation = async () => {
    if (!recon) return;
    setIsRunning(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // ── Statement side ──────────────────────────────────────────
      let stmtQuery = supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .gte("transaction_date", recon.period_start)
        .lte("transaction_date", recon.period_end)
        .order("transaction_date");

      // If reconciliation was created from an uploaded file, filter by file_id
      if (recon.statement_file_id) {
        stmtQuery = stmtQuery.eq("file_id", recon.statement_file_id);
      }

      const { data: stmtTxns } = await stmtQuery;

      const bankTxns: BankTransaction[] = (stmtTxns || []).map(t => ({
        id: t.id,
        transaction_date: t.transaction_date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        file_id: t.file_id,
      }));

      setStatementCount(bankTxns.length);

      // ── Ledger side ─────────────────────────────────────────────
      let ledgerEntries: LedgerEntry[] = [];

      if (ledgerSource === "journal") {
        // Journal entries path
        const { data: journalEntries } = await supabase
          .from("journal_entries")
          .select("id, entry_date, description, reference")
          .eq("user_id", user.id)
          .gte("entry_date", recon.period_start)
          .lte("entry_date", recon.period_end);

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
      } else {
        // Invoices & Bills path
        const [invoicesRes, billsRes] = await Promise.all([
          supabase
            .from("invoices")
            .select("id, invoice_date, invoice_number, total_amount, notes, category")
            .eq("user_id", user.id)
            .gte("invoice_date", recon.period_start)
            .lte("invoice_date", recon.period_end),
          supabase
            .from("bills")
            .select("id, bill_date, bill_number, total_amount, notes, category")
            .eq("user_id", user.id)
            .gte("bill_date", recon.period_start)
            .lte("bill_date", recon.period_end),
        ]);

        const invoices: LedgerEntry[] = (invoicesRes.data || []).map(inv => ({
          id: inv.id,
          date: inv.invoice_date,
          description: inv.notes || `Invoice ${inv.invoice_number}` || inv.category || "Invoice",
          amount: inv.total_amount,
          type: 'transaction' as const,
        }));

        const bills: LedgerEntry[] = (billsRes.data || []).map(bill => ({
          id: bill.id,
          date: bill.bill_date,
          description: bill.notes || `Bill ${bill.bill_number}` || bill.category || "Bill",
          amount: -Math.abs(bill.total_amount), // bills are outflows
          type: 'transaction' as const,
        }));

        ledgerEntries = [...invoices, ...bills];
      }

      setLedgerCount(ledgerEntries.length);

      const reconResults = reconcileTransactions(bankTxns, ledgerEntries, settings);
      setResults(reconResults);

      // Update reconciliation record with computed balances
      await supabase.from("reconciliations").update({
        unreconciled_difference: reconResults.unreconciledDifference,
        statement_ending_balance: bankTxns.reduce((s, t) => s + t.amount, 0),
        ledger_ending_balance: ledgerEntries.reduce((s, e) => s + e.amount, 0),
      }).eq("id", reconciliationId);

      toast.success(`Reconciliation complete — ${reconResults.matched.length} matched, ${reconResults.flags.length} flags`);
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

  const ledgerLabel = ledgerSource === "journal" ? "Journal Entries" : "Invoices & Bills";
  const statementLabel = sourceFile
    ? `${sourceFile.bank_name} — ${sourceFile.file_name}`
    : "Manual Transactions";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{statementLabel}</h1>
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

      {/* Source info banner */}
      <Card className="border-muted bg-muted/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">Statement:</span>
              <span className="font-medium">{statementLabel}</span>
              {results && <span className="text-muted-foreground">({statementCount} transactions)</span>}
            </div>
            <span className="text-muted-foreground hidden sm:inline">vs</span>
            <div className="flex items-center gap-2">
              {ledgerSource === "journal" ? <BookOpen className="w-4 h-4 text-primary" /> : <Receipt className="w-4 h-4 text-primary" />}
              <span className="text-muted-foreground">Ledger:</span>
              <span className="font-medium">{ledgerLabel}</span>
              {results && <span className="text-muted-foreground">({ledgerCount} entries)</span>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings panel (only before first run) */}
      {!isFinalized && !results && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Ledger source selector */}
          <Card>
            <CardHeader><CardTitle className="text-base">Ledger Source</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setLedgerSource("journal")}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                    ledgerSource === "journal" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <BookOpen className={`w-4 h-4 flex-shrink-0 ${ledgerSource === "journal" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-medium">Journal Entries</p>
                    <p className="text-xs text-muted-foreground">Accounting</p>
                  </div>
                </button>
                <button
                  onClick={() => setLedgerSource("invoices_bills")}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-colors text-left ${
                    ledgerSource === "invoices_bills" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                  }`}
                >
                  <Receipt className={`w-4 h-4 flex-shrink-0 ${ledgerSource === "invoices_bills" ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-medium">Invoices &amp; Bills</p>
                    <p className="text-xs text-muted-foreground">AR / AP records</p>
                  </div>
                </button>
              </div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2">
                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>
                  {ledgerSource === "journal"
                    ? "Matches statement transactions against journal entry lines from the accounting module."
                    : "Matches statement transactions against invoices (inflows) and bills (outflows) within the period."}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Match Settings</CardTitle></CardHeader>
            <CardContent>
              <ReconciliationSettings settings={settings} onSettingsChange={setSettings} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Allow changing ledger source and re-run after first run */}
      {!isFinalized && results && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium">Ledger Source:</span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={ledgerSource === "journal" ? "default" : "outline"}
                  onClick={() => setLedgerSource("journal")}
                >
                  <BookOpen className="w-3 h-3 mr-1" />Journal Entries
                </Button>
                <Button
                  size="sm"
                  variant={ledgerSource === "invoices_bills" ? "default" : "outline"}
                  onClick={() => setLedgerSource("invoices_bills")}
                >
                  <Receipt className="w-3 h-3 mr-1" />Invoices &amp; Bills
                </Button>
              </div>
              <span className="text-xs text-muted-foreground">Re-run to apply changes</span>
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <div className={`text-3xl font-bold ${results.matchRate >= 80 ? 'text-green-600 dark:text-green-400' : results.matchRate >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive'}`}>
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
                          <TableHead className="w-8"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.flags.map((f, i) => {
                          const Icon = flagIcons[f.flagType] || AlertTriangle;
                          return (
                            <TableRow
                              key={`${f.id}-${i}`}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedFlag(f)}
                            >
                              <TableCell>
                                <Badge variant="outline" className="gap-1">
                                  <Icon className="w-3 h-3" />
                                  {flagLabels[f.flagType]}
                                </Badge>
                              </TableCell>
                              <TableCell>{format(new Date(f.date), "MMM d, yyyy")}</TableCell>
                              <TableCell>{f.description}</TableCell>
                              <TableCell className="text-right">${f.amount.toFixed(2)}</TableCell>
                              <TableCell>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
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

      <FlagDetailSheet flag={selectedFlag} onClose={() => setSelectedFlag(null)} />
    </div>
  );
}
