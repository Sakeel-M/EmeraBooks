import { Fragment, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus, Pencil, Trash2, Search, Loader2, BookOpen, Wand2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useActiveClient } from "@/hooks/useActiveClient";
import { format } from "date-fns";
import { FC } from "@/components/shared/FormattedCurrency";
import { useLedgerEntries, LedgerEntry } from "./useLedgerEntries";
import { JournalEntryDialog } from "./JournalEntryDialog";
import { EditTransactionDialog } from "./EditTransactionDialog";
import { database } from "@/lib/database";
import { toast } from "sonner";

type FilterKind = "all" | "manual" | "derived";

export function JournalEntriesTab() {
  const { currency } = useActiveClient();
  const queryClient = useQueryClient();
  const { entries, isLoading } = useLedgerEntries();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dialogEntry, setDialogEntry] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<any | null>(null);
  const [searchParams] = useSearchParams();
  const txnId = searchParams.get("txnId");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let r: LedgerEntry[] = entries;
    if (kindFilter !== "all") r = r.filter((e) => e.kind === kindFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (e) =>
          e.description.toLowerCase().includes(q) ||
          e.lines.some((l) => l.account_name.toLowerCase().includes(q)),
      );
    }
    return r;
  }, [entries, kindFilter, search]);

  const totals = useMemo(() => {
    const tdr = filtered.reduce((s, e) => s + e.total_debit, 0);
    const tcr = filtered.reduce((s, e) => s + e.total_credit, 0);
    return { tdr, tcr, count: filtered.length };
  }, [filtered]);

  useEffect(() => {
    if (!txnId || isLoading) return;
    const targetId = `txn-${txnId}`;
    const match = entries.find((e) => e.id === targetId);
    if (!match) {
      toast.info("Transaction not in current date range — adjust the range to find it.");
      return;
    }
    setHighlightId(targetId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-id="${targetId}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
    const t = setTimeout(() => setHighlightId(null), 3000);
    return () => clearTimeout(t);
  }, [txnId, isLoading, entries]);

  const fmtDate = (d: string) => {
    try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
  };

  const handleEdit = (e: LedgerEntry) => {
    if (e.kind === "manual") {
      setDialogEntry(e.raw);
      setDialogOpen(true);
    } else {
      setEditTxn(e.raw);
    }
  };

  const handleDelete = async (e: LedgerEntry) => {
    if (e.kind !== "manual") {
      toast.error("Bank-derived entries can be edited but not deleted from here. Delete the bank transaction in the source upload.");
      return;
    }
    if (!confirm("Delete this journal entry? This cannot be undone.")) return;
    try {
      await database.deleteJournalEntry(e.source_id);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success("Entry deleted");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  if (isLoading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Entries</p>
            <p className="text-2xl font-bold mt-1">{totals.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Debits</p>
            <p className="text-2xl font-bold mt-1"><FC amount={totals.tdr} currency={currency} /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Credits</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600"><FC amount={totals.tcr} currency={currency} /></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Net</p>
            <p className={`text-2xl font-bold mt-1 ${Math.abs(totals.tdr - totals.tcr) < 0.005 ? "text-emerald-600" : "text-red-500"}`}>
              <FC amount={Math.abs(totals.tdr - totals.tcr)} currency={currency} />
            </p>
            <p className="text-[10px] text-muted-foreground">
              {Math.abs(totals.tdr - totals.tcr) < 0.005 ? "Balanced ✓" : "Mismatch"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search description or account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex border rounded-md overflow-hidden">
          {(["all", "manual", "derived"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`px-3 py-1.5 text-xs font-medium ${kindFilter === k ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"}`}
            >
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto gap-1.5"
          onClick={() => { setDialogEntry(null); setDialogOpen(true); }}
        >
          <Plus className="h-3.5 w-3.5" /> New Entry
        </Button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No journal entries</h3>
            <p className="text-sm text-muted-foreground">
              Upload a bank statement or post your first manual entry.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Debit Account</TableHead>
                  <TableHead>Credit Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-[90px]">Source</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const isMulti = e.lines.length > 2;
                  const isOpen = !!expanded[e.id];
                  const debitLine = e.lines.find((l) => l.debit > 0);
                  const creditLine = e.lines.find((l) => l.credit > 0);
                  return (
                    <Fragment key={e.id}>
                      <TableRow
                        data-id={e.id}
                        data-highlight={highlightId === e.id ? "true" : undefined}
                        className={`${isMulti ? "cursor-pointer hover:bg-muted/40" : ""} data-[highlight=true]:bg-amber-50 data-[highlight=true]:ring-2 data-[highlight=true]:ring-amber-300 transition-colors`}
                        onClick={() => isMulti && setExpanded((p) => ({ ...p, [e.id]: !p[e.id] }))}
                      >
                        <TableCell className="text-xs">{fmtDate(e.date)}</TableCell>
                        <TableCell className="text-sm">{e.description}</TableCell>
                        <TableCell className="text-xs">
                          {isMulti ? <span className="text-muted-foreground italic">Multiple — {e.lines.filter(l => l.debit > 0).length} lines</span> : debitLine?.account_name}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isMulti ? <span className="text-muted-foreground italic">Multiple — {e.lines.filter(l => l.credit > 0).length} lines</span> : creditLine?.account_name}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-sm">
                          <FC amount={e.total_debit} currency={currency} />
                        </TableCell>
                        <TableCell>
                          {e.kind === "manual" ? (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <Wand2 className="h-3 w-3" /> Manual
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Bank</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right" onClick={(ev) => ev.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {e.kind === "manual" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleDelete(e)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isMulti && isOpen && (
                        <TableRow key={`${e.id}-detail`} className="bg-muted/20">
                          <TableCell colSpan={7} className="py-2">
                            <div className="ml-6 pl-4 border-l-2 border-muted">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-xs">Account</TableHead>
                                    <TableHead className="text-xs text-right">Debit</TableHead>
                                    <TableHead className="text-xs text-right">Credit</TableHead>
                                    <TableHead className="text-xs">Memo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {e.lines.map((l, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell className="text-xs">
                                        {l.account_code ? `${l.account_code} · ` : ""}{l.account_name}
                                      </TableCell>
                                      <TableCell className="text-xs text-right">
                                        {l.debit > 0 ? <FC amount={l.debit} currency={currency} /> : ""}
                                      </TableCell>
                                      <TableCell className="text-xs text-right">
                                        {l.credit > 0 ? <FC amount={l.credit} currency={currency} /> : ""}
                                      </TableCell>
                                      <TableCell className="text-xs text-muted-foreground">{l.description || ""}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <JournalEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={dialogEntry}
      />
      <EditTransactionDialog
        open={!!editTxn}
        onOpenChange={(o) => !o && setEditTxn(null)}
        transaction={editTxn || {}}
      />
    </div>
  );
}
