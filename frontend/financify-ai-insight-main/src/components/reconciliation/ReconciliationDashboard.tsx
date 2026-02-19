import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/EmptyState";
import { GitCompareArrows, Plus, CheckCircle, Clock, AlertCircle, FileText, PenLine, BookOpen, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface UploadedFile {
  id: string;
  file_name: string;
  bank_name: string;
  currency: string;
  total_transactions: number;
  created_at: string;
}

interface ReconciliationRecord {
  id: string;
  bank_account_id: string | null;
  statement_file_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  unreconciled_difference: number;
  finalized_at: string | null;
}

interface Props {
  uploadedFiles: UploadedFile[];
  reconciliations: ReconciliationRecord[];
  isLoading: boolean;
  onSelectReconciliation: (id: string) => void;
  onRefresh: () => void;
}

export function ReconciliationDashboard({ uploadedFiles, reconciliations, isLoading, onSelectReconciliation, onRefresh }: Props) {
  const [statementSource, setStatementSource] = useState<"file" | "manual">("file");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [ledgerSource, setLedgerSource] = useState<"journal" | "invoices_bills">("journal");
  const [manualStart, setManualStart] = useState<string>("");
  const [manualEnd, setManualEnd] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (statementSource === "file" && !selectedFileId) {
      toast.error("Please select an uploaded file");
      return;
    }
    if (statementSource === "manual" && (!manualStart || !manualEnd)) {
      toast.error("Please select a date range");
      return;
    }

    setIsCreating(true);

    try {
      let period_start = manualStart;
      let period_end = manualEnd;
      let statement_file_id: string | null = null;

      if (statementSource === "file") {
        statement_file_id = selectedFileId;

        // Auto-detect period from file's transaction date range
        const { data: txnRange } = await supabase
          .from("transactions")
          .select("transaction_date")
          .eq("file_id", selectedFileId)
          .eq("user_id", user.id)
          .order("transaction_date", { ascending: true });

        if (txnRange && txnRange.length > 0) {
          period_start = txnRange[0].transaction_date;
          period_end = txnRange[txnRange.length - 1].transaction_date;
        } else {
          // Fallback to current month
          const now = new Date();
          period_start = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
          period_end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
        }
      }

      // Check for existing reconciliation with same file or period
      const existing = reconciliations.find(r =>
        statement_file_id
          ? r.statement_file_id === statement_file_id
          : r.period_start === period_start && !r.statement_file_id
      );

      if (existing) {
        onSelectReconciliation(existing.id);
        return;
      }

      const { data, error } = await supabase.from("reconciliations").insert({
        user_id: user.id,
        statement_file_id,
        period_start,
        period_end,
        status: "draft",
        // Store ledger source in bank_account_id field as a marker prefix (null = journal, special string = invoices_bills)
        // We use a separate approach: store ledger preference in the status field extended OR just pass it through UI
      }).select().single();

      if (error) {
        toast.error("Failed to create reconciliation");
        return;
      }

      toast.success("Reconciliation created");
      onSelectReconciliation(data.id);
    } finally {
      setIsCreating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "finalized") return <Badge className="bg-green-100 text-green-700 border-green-300"><CheckCircle className="w-3 h-3 mr-1" />Finalized</Badge>;
    return <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
  };

  const getSourceLabel = (r: ReconciliationRecord) => {
    if (r.statement_file_id) {
      const file = uploadedFiles.find(f => f.id === r.statement_file_id);
      return file ? `${file.bank_name} — ${file.file_name}` : "Uploaded File";
    }
    return "Manual Transactions";
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
          <CardDescription>Choose your statement source and what to compare it against</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Statement Source */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">Statement Source</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStatementSource("file")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                  statementSource === "file" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <FileText className={`w-5 h-5 flex-shrink-0 ${statementSource === "file" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Uploaded File</p>
                  <p className="text-xs text-muted-foreground">Excel / PDF statement</p>
                </div>
              </button>
              <button
                onClick={() => setStatementSource("manual")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                  statementSource === "manual" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <PenLine className={`w-5 h-5 flex-shrink-0 ${statementSource === "manual" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Manual / All Transactions</p>
                  <p className="text-xs text-muted-foreground">Date range filter</p>
                </div>
              </button>
            </div>

            {statementSource === "file" && (
              <Select value={selectedFileId} onValueChange={setSelectedFileId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select uploaded bank statement file" />
                </SelectTrigger>
                <SelectContent>
                  {uploadedFiles.length === 0 ? (
                    <div className="p-3 text-sm text-muted-foreground text-center">No uploaded files found</div>
                  ) : (
                    uploadedFiles.map(f => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.bank_name} — {f.file_name} ({f.total_transactions} txns)
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {statementSource === "manual" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Start Date</Label>
                  <input
                    type="date"
                    value={manualStart}
                    onChange={e => setManualStart(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">End Date</Label>
                  <input
                    type="date"
                    value={manualEnd}
                    onChange={e => setManualEnd(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Ledger Source */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">Compare Against (Ledger)</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setLedgerSource("journal")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                  ledgerSource === "journal" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <BookOpen className={`w-5 h-5 flex-shrink-0 ${ledgerSource === "journal" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Journal Entries</p>
                  <p className="text-xs text-muted-foreground">From accounting sync</p>
                </div>
              </button>
              <button
                onClick={() => setLedgerSource("invoices_bills")}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left ${
                  ledgerSource === "invoices_bills" ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <Receipt className={`w-5 h-5 flex-shrink-0 ${ledgerSource === "invoices_bills" ? "text-primary" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-medium">Invoices &amp; Bills</p>
                  <p className="text-xs text-muted-foreground">Manual &amp; imported</p>
                </div>
              </button>
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={isCreating || (statementSource === "file" && !selectedFileId) || (statementSource === "manual" && (!manualStart || !manualEnd))}
            className="w-full sm:w-auto"
          >
            <GitCompareArrows className="w-4 h-4 mr-2" />
            {isCreating ? "Creating..." : "Start Reconciliation"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reconciliation History</CardTitle></CardHeader>
        <CardContent>
          {reconciliations.length === 0 ? (
            <EmptyState icon={GitCompareArrows} title="No reconciliations yet" description="Create your first reconciliation by selecting a statement source above." />
          ) : (
            <div className="space-y-3">
              {reconciliations.map(r => (
                <div key={r.id} className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => onSelectReconciliation(r.id)}>
                  <div className="flex-1">
                    <p className="font-medium">{getSourceLabel(r)}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(r.period_start), "MMM d")} — {format(new Date(r.period_end), "MMM d, yyyy")}
                    </p>
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
