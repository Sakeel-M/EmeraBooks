import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Search, Loader2 } from "lucide-react";
import { getSectorStyle } from "@/lib/sectorStyles";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { AccountTree } from "@/components/ledger/AccountTree";
import { QuarterTimeline } from "@/components/ledger/QuarterTimeline";
import { QuarterNavigator, getCurrentQuarter, useQuarterDates } from "@/components/dashboard/QuarterNavigator";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";

interface LedgerRow {
  id: string;
  date: string;
  account: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  source: 'transaction' | 'journal';
}

export default function Ledger() {
  const { currency } = useCurrency();
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: string; account_name: string; account_number: string; account_type: string; balance: number | null }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAccountName, setSelectedAccountName] = useState<string | null>(null);

  const { quarter: initQ, year: initY } = getCurrentQuarter();
  const [quarter, setQuarter] = useState(initQ);
  const [year, setYear] = useState(initY);
  const quarterDates = useQuarterDates(quarter, year);

  useEffect(() => { fetchLedger(); }, []);

  const fetchLedger = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accts } = await supabase.from("accounts").select("id, account_name, account_number, account_type, balance").eq("user_id", user.id);
    setAccounts((accts as any) || []);

    const ledgerRows: LedgerRow[] = [];

    const { data: txns } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false });
    if (txns) {
      for (const t of txns) {
        ledgerRows.push({
          id: `txn-${t.id}`, date: t.transaction_date, account: t.category || "Uncategorized",
          description: t.description, reference: "", debit: t.amount > 0 ? t.amount : 0,
          credit: t.amount < 0 ? Math.abs(t.amount) : 0, source: 'transaction',
        });
      }
    }

    const { data: entries } = await supabase.from("journal_entries").select("*").eq("user_id", user.id);
    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      const { data: lines } = await supabase.from("journal_entry_lines").select("*").in("journal_entry_id", entryIds);
      if (lines) {
        const accountMap = new Map((accts || []).map(a => [a.id, a.account_name]));
        for (const line of lines) {
          const entry = entries.find(e => e.id === line.journal_entry_id);
          ledgerRows.push({
            id: `jel-${line.id}`, date: entry?.entry_date || "", account: accountMap.get(line.account_id) || "Unknown",
            description: line.description || entry?.description || "", reference: entry?.reference || entry?.entry_number || "",
            debit: line.debit_amount || 0, credit: line.credit_amount || 0, source: 'journal',
          });
        }
      }
    }

    ledgerRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setRows(ledgerRows);
    setIsLoading(false);
  };

  // Transaction counts per account
  const transactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => { counts.set(r.account, (counts.get(r.account) || 0) + 1); });
    return counts;
  }, [rows]);

  // Quarter timeline data
  const quarterTimeline = useMemo(() => {
    const qMap = new Map<string, { count: number; quarter: number; year: number }>();
    rows.forEach((r) => {
      const d = new Date(r.date);
      const q = Math.ceil((d.getMonth() + 1) / 3);
      const y = d.getFullYear();
      const key = `${y}-Q${q}`;
      if (!qMap.has(key)) qMap.set(key, { count: 0, quarter: q, year: y });
      qMap.get(key)!.count++;
    });
    return Array.from(qMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => ({ label: `Q${val.quarter} ${val.year}`, count: val.count, quarter: val.quarter, year: val.year }));
  }, [rows]);

  // Filter
  const filtered = useMemo(() => {
    let result = rows;
    // Quarter filter
    result = result.filter((r) => {
      const d = new Date(r.date);
      return d >= quarterDates.from && d <= quarterDates.to;
    });
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.description.toLowerCase().includes(s) || r.account.toLowerCase().includes(s) || r.reference.toLowerCase().includes(s));
    }
    if (selectedAccountName) {
      result = result.filter(r => r.account === selectedAccountName);
    }
    return result;
  }, [rows, search, selectedAccountName, quarterDates]);

  // Group by sector
  const groupedFiltered = useMemo(() => {
    const groups = new Map<string, { rows: LedgerRow[]; debit: number; credit: number }>();
    for (const r of filtered) {
      if (!groups.has(r.account)) groups.set(r.account, { rows: [], debit: 0, credit: 0 });
      const g = groups.get(r.account)!;
      g.rows.push(r);
      g.debit += r.debit;
      g.credit += r.credit;
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const totalDebit = filtered.reduce((s, r) => s + r.debit, 0);
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">General Ledger</h1>
            <p className="text-muted-foreground">Unified view of all financial postings</p>
          </div>
          <QuarterNavigator currentQuarter={quarter} currentYear={year} onNavigate={(q, y) => { setQuarter(q); setYear(y); }} />
        </div>

        {/* Quarter Timeline */}
        {quarterTimeline.length > 0 && (
          <QuarterTimeline quarters={quarterTimeline} selectedQuarter={quarter} selectedYear={year} onSelect={(q, y) => { setQuarter(q); setYear(y); }} />
        )}

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[250px_1fr] gap-6">
          {/* Account Tree */}
          <Card className="p-4">
            <AccountTree
              accounts={accounts as any}
              selectedAccountId={selectedAccountId}
              onSelectAccount={(id, name) => { setSelectedAccountId(id); setSelectedAccountName(name); }}
              transactionCounts={transactionCounts}
            />
          </Card>

          {/* Transaction List */}
          <Card>
            <CardContent className="pt-4">
              {/* Breadcrumb */}
              {selectedAccountName && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                  <button className="hover:text-foreground" onClick={() => { setSelectedAccountId(null); setSelectedAccountName(null); }}>All Accounts</button>
                  <span>›</span>
                  <span className="text-foreground font-medium">{selectedAccountName}</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={`Filter ${filtered.length} transactions...`} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span className="text-sm text-muted-foreground">{filtered.length} entries</span>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={BookOpen} title="No ledger entries" description="Transactions and journal entries will appear here once created." />
              ) : (
                <div className="overflow-x-auto">
                  {selectedAccountName ? (
                    /* Flat table when a specific account is selected */
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Debit</TableHead>
                          <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map(r => (
                          <TableRow key={r.id}>
                            <TableCell>{r.date ? format(new Date(r.date), "MMM d, yyyy") : "—"}</TableCell>
                            <TableCell>{r.description}</TableCell>
                            <TableCell className="text-muted-foreground">{r.reference || "—"}</TableCell>
                            <TableCell className="text-right">{r.debit > 0 ? formatAmount(r.debit, currency) : "—"}</TableCell>
                            <TableCell className="text-right">{r.credit > 0 ? formatAmount(r.credit, currency) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    /* Grouped accordion view */
                    <Accordion type="multiple" className="w-full space-y-3">
                      {groupedFiltered.map(([sector, { rows: sectorRows, debit, credit }], idx) => {
                        const style = getSectorStyle(sector, idx);
                        const Icon = style.icon;
                        return (
                          <AccordionItem key={sector} value={sector} className={`border rounded-lg ${style.borderColor} border-l-4 hover:shadow-md transition-shadow overflow-hidden`}>
                            <AccordionTrigger className="hover:no-underline px-4 py-3">
                              <div className="flex items-center justify-between w-full pr-2">
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-full ${style.bgColor} flex items-center justify-center`}>
                                    <Icon className={`w-4 h-4 ${style.textColor}`} />
                                  </div>
                                  <span className="font-semibold text-base">{sector}</span>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badgeBg} ${style.badgeText}`}>
                                    {sectorRows.length} txn{sectorRows.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                                <div className="flex gap-3 text-sm">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium text-xs">
                                    Dr {debit > 0 ? formatAmount(debit, currency) : "—"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-medium text-xs">
                                    Cr {credit > 0 ? formatAmount(credit, currency) : "—"}
                                  </span>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="bg-muted/30">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {sectorRows.map(r => (
                                    <TableRow key={r.id}>
                                      <TableCell>{r.date ? format(new Date(r.date), "MMM d, yyyy") : "—"}</TableCell>
                                      <TableCell>{r.description}</TableCell>
                                      <TableCell className="text-muted-foreground">{r.reference || "—"}</TableCell>
                                      <TableCell className="text-right">{r.debit > 0 ? formatAmount(r.debit, currency) : "—"}</TableCell>
                                      <TableCell className="text-right">{r.credit > 0 ? formatAmount(r.credit, currency) : "—"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  )}

                  {/* Overall totals */}
                  <div className="flex justify-end gap-4 px-5 py-3 mt-4 rounded-lg bg-gradient-to-r from-muted/60 to-muted font-bold text-sm border">
                    <span className="text-muted-foreground">Totals</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">Dr {formatAmount(totalDebit, currency)}</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-800 text-xs font-semibold">Cr {formatAmount(totalCredit, currency)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
