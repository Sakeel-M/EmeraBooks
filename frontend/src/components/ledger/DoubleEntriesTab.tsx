import { Fragment, useMemo, useState } from "react";
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
  Plus, Pencil, Trash2, Search, Loader2, GitCompareArrows, Wand2,
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

export function DoubleEntriesTab() {
  const { currency } = useActiveClient();
  const queryClient = useQueryClient();
  const { entries, isLoading } = useLedgerEntries();
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<FilterKind>("all");
  const [dialogEntry, setDialogEntry] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTxn, setEditTxn] = useState<any | null>(null);

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
    if (e.kind !== "manual") return;
    if (!confirm("Delete this journal entry?")) return;
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Difference</p>
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

      {/* Traditional Journal Book layout */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <GitCompareArrows className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <h3 className="text-lg font-semibold mb-1">No entries to display</h3>
            <p className="text-sm text-muted-foreground">
              Bank-derived and manual journal entries appear here in journal-book format.
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
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right w-[140px]">Debit</TableHead>
                  <TableHead className="text-right w-[140px]">Credit</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((e) => {
                  const debitLines = e.lines.filter((l) => l.debit > 0);
                  const creditLines = e.lines.filter((l) => l.credit > 0);
                  return (
                    <Fragment key={e.id}>
                      {/* Debit lines — first row carries date + actions */}
                      {debitLines.map((l, i) => (
                        <TableRow
                          key={`${e.id}-d-${i}`}
                          className={i === 0 ? "group border-b-0" : "border-b-0"}
                        >
                          <TableCell className="text-xs font-mono align-top">
                            {i === 0 ? fmtDate(e.date) : ""}
                          </TableCell>
                          <TableCell className="text-sm align-top">
                            {l.account_code ? (
                              <span className="text-muted-foreground mr-1.5">{l.account_code}</span>
                            ) : null}
                            <span className="font-medium">{l.account_name}</span>
                          </TableCell>
                          <TableCell className="text-right font-semibold align-top">
                            <FC amount={l.debit} currency={currency} />
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground align-top">—</TableCell>
                          <TableCell className="align-top">
                            {i === 0 && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(e)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                {e.kind === "manual" && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDelete(e)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}

                      {/* Credit lines — indented account name */}
                      {creditLines.map((l, i) => (
                        <TableRow key={`${e.id}-c-${i}`} className="border-b-0">
                          <TableCell></TableCell>
                          <TableCell className="text-sm pl-10 align-top">
                            {l.account_code ? (
                              <span className="text-muted-foreground mr-1.5">{l.account_code}</span>
                            ) : null}
                            {l.account_name}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground align-top">—</TableCell>
                          <TableCell className="text-right font-semibold align-top">
                            <FC amount={l.credit} currency={currency} />
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}

                      {/* Memo + source badge */}
                      {(e.description || e.reference) && (
                        <TableRow key={`${e.id}-memo`} className="border-b-0">
                          <TableCell></TableCell>
                          <TableCell colSpan={4} className="pl-10 pt-0 pb-2">
                            <span className="italic text-xs text-muted-foreground">
                              "{e.description}"
                              {e.reference ? <span className="ml-2">· Ref: {e.reference}</span> : null}
                            </span>
                            {e.kind === "manual" ? (
                              <Badge variant="outline" className="ml-3 text-[10px] gap-1 align-middle">
                                <Wand2 className="h-3 w-3" /> Manual
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="ml-3 text-[10px] align-middle">Bank</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )}

                      {/* Separator between entries */}
                      <TableRow key={`${e.id}-sep`}>
                        <TableCell colSpan={5} className="p-0 border-b" />
                      </TableRow>
                    </Fragment>
                  );
                })}

                {/* Totals footer */}
                <TableRow className="bg-muted/40 font-semibold border-t-2">
                  <TableCell colSpan={2} className="text-right">Totals</TableCell>
                  <TableCell className="text-right">
                    <FC amount={totals.tdr} currency={currency} />
                  </TableCell>
                  <TableCell className="text-right">
                    <FC amount={totals.tcr} currency={currency} />
                  </TableCell>
                  <TableCell>
                    {Math.abs(totals.tdr - totals.tcr) < 0.005 ? (
                      <span className="text-emerald-600 text-xs">✓ Balanced</span>
                    ) : (
                      <span className="text-red-500 text-xs">Mismatch</span>
                    )}
                  </TableCell>
                </TableRow>
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
