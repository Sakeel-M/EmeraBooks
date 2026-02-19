import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Search, Loader2, FileText, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown } from "lucide-react";
import { getSectorStyle } from "@/lib/sectorStyles";
import { guessCategory, mapRawBankCategory } from "@/lib/sectorMapping";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { QuarterNavigator, useQuarterDates, DateMode } from "@/components/dashboard/QuarterNavigator";
import { LedgerEntryDetailSheet } from "@/components/ledger/LedgerEntryDetailSheet";

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
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedEntry, setSelectedEntry] = useState<LedgerRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [currentQuarter, setCurrentQuarter] = useState(0);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear() - 1);
  const [customFrom, setCustomFrom] = useState<Date>(new Date(new Date().getFullYear() - 1, 0, 1));
  const [customTo, setCustomTo] = useState<Date>(new Date(new Date().getFullYear() - 1, 11, 31, 23, 59, 59));

  const { from: dateFrom, to: dateTo } = useQuarterDates(currentQuarter, currentYear);

  useEffect(() => { fetchLedger(); }, []);

  const fetchLedger = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: accts } = await supabase.from("accounts").select("id, account_name").eq("user_id", user.id);

    const ledgerRows: LedgerRow[] = [];

    const { data: txns } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false });
    if (txns) {
      for (const t of txns) {
        const rawAccount = t.category || "";
        const mappedAccount = guessCategory(t.description) || mapRawBankCategory(rawAccount) || guessCategory(rawAccount) || "Other";
        ledgerRows.push({
          id: `txn-${t.id}`, date: t.transaction_date, account: mappedAccount,
          description: t.description, reference: "",
          debit: t.amount < 0 ? Math.abs(t.amount) : 0,
          credit: t.amount > 0 ? t.amount : 0, source: 'transaction',
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
          const rawAccount = accountMap.get(line.account_id) || "Unknown";
          const mappedAccount = guessCategory(rawAccount) || guessCategory(line.description || entry?.description) || rawAccount;
          ledgerRows.push({
            id: `jel-${line.id}`, date: entry?.entry_date || "", account: mappedAccount,
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

  const activeDateFrom = dateMode === "custom" ? customFrom : dateFrom;
  const activeDateTo = dateMode === "custom" ? customTo : dateTo;

  const filtered = useMemo(() => {
    let result = rows.filter((r) => {
      const d = new Date(r.date);
      return d >= activeDateFrom && d <= activeDateTo;
    });
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(r => r.description.toLowerCase().includes(s) || r.account.toLowerCase().includes(s) || r.reference.toLowerCase().includes(s));
    }
    return result;
  }, [rows, search, activeDateFrom, activeDateTo]);

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
  const netBalance = totalDebit - totalCredit;

  const handleRowClick = (row: LedgerRow) => {
    setSelectedEntry(row);
    setSheetOpen(true);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">General Ledger</h1>
            <p className="text-muted-foreground">Unified view of all financial postings</p>
          </div>
          <QuarterNavigator
            currentQuarter={currentQuarter}
            currentYear={currentYear}
            onNavigate={(q, y) => { setCurrentQuarter(q); setCurrentYear(y); }}
            mode={dateMode}
            onModeChange={setDateMode}
            customFrom={customFrom}
            customTo={customTo}
            onCustomDateChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
            modes={["year", "custom"]}
          />
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6 items-start">

          {/* Left: Stat Cards */}
          <div className="flex flex-col gap-3">
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Entries</span>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="text-2xl font-bold">{filtered.length.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground mt-1">in date range</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Debits</span>
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">{formatAmount(totalDebit, currency)}</div>
                <div className="text-xs text-muted-foreground mt-1">Dr side</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Credits</span>
                  <ArrowDownLeft className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold text-destructive">{formatAmount(totalCredit, currency)}</div>
                <div className="text-xs text-muted-foreground mt-1">Cr side</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Balance</span>
                  {netBalance >= 0
                    ? <TrendingUp className="h-4 w-4 text-green-500" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />}
                </div>
                <div className={`text-2xl font-bold ${netBalance >= 0 ? "text-green-500" : "text-destructive"}`}>
                  {formatAmount(Math.abs(netBalance), currency)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Dr − Cr</div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Ledger Table */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={`Filter ${filtered.length} entries...`} className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <span className="text-sm text-muted-foreground ml-4">{filtered.length} entries</span>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <EmptyState icon={BookOpen} title="No ledger entries" description="Transactions and journal entries will appear here once created." />
              ) : (
                <div className="overflow-x-auto">
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
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium text-xs">
                                  Dr {debit > 0 ? formatAmount(debit, currency) : "—"}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium text-xs">
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
                                  <TableRow
                                    key={r.id}
                                    className="cursor-pointer hover:bg-accent/60 transition-colors"
                                    onClick={() => handleRowClick(r)}
                                  >
                                    <TableCell>{r.date ? format(new Date(r.date), "MMM d, yyyy") : "—"}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">{r.description}</TableCell>
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

                  <div className="flex justify-end gap-4 px-5 py-3 mt-4 rounded-lg bg-gradient-to-r from-muted/60 to-muted font-bold text-sm border">
                    <span className="text-muted-foreground">Totals</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Dr {formatAmount(totalDebit, currency)}</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">Cr {formatAmount(totalCredit, currency)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Entry Detail Sheet */}
      <LedgerEntryDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        entry={selectedEntry}
        currency={currency}
      />
    </Layout>
  );
}
