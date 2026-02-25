import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { EmptyState } from "@/components/shared/EmptyState";
import { BookOpen, Search, Loader2, FileText, ArrowUpRight, ArrowDownLeft, TrendingUp, TrendingDown, HelpCircle, X, Tags, PlusCircle, CheckCircle2 } from "lucide-react";
import { getSectorStyle } from "@/lib/sectorStyles";
import { resolveCategory, resolveIncomeCategory, getUserCategoryRules, saveUserCategories, loadAndRegisterUserCategories } from "@/lib/sectorMapping";
import { database } from "@/lib/database";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useCurrency } from "@/hooks/useCurrency";
import { formatAmount } from "@/lib/utils";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
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

  const [showReasons, setShowReasons] = useState(false);
  const [categoryRules, setCategoryRules] = useState<Array<{ name: string; keywords: string[] }>>(() => getUserCategoryRules());
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleKeywords, setNewRuleKeywords] = useState("");
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [applyingRule, setApplyingRule] = useState(false);
  const [ruleAppliedMsg, setRuleAppliedMsg] = useState("");
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [currentQuarter, setCurrentQuarter] = useState(0);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [customFrom, setCustomFrom] = useState<Date>(new Date(new Date().getFullYear(), 0, 1));
  const [customTo, setCustomTo] = useState<Date>(new Date(new Date().getFullYear(), 11, 31, 23, 59, 59));
  const [yearInitialized, setYearInitialized] = useState(false);

  const { from: dateFrom, to: dateTo } = useQuarterDates(currentQuarter, currentYear);

  useEffect(() => { fetchLedger(); }, []);
  useEffect(() => { loadAndRegisterUserCategories(); }, []);

  const fetchLedger = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setIsLoading(false); return; }

    // Only show transactions for the currently selected file — matches Home page
    const currentFileId = database.getCurrentFile();
    let query = supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("transaction_date", { ascending: false });
    if (currentFileId) query = query.eq("file_id", currentFileId);

    const { data: txns } = await query;

    // Auto-detect most recent transaction year on first load
    if (txns && txns.length > 0 && !yearInitialized) {
      const years = txns.map((t) => new Date(t.transaction_date).getFullYear()).filter((y) => y > 1970);
      const maxYear = years.length > 0 ? Math.max(...years) : new Date().getFullYear();
      setCurrentYear(maxYear);
      setCustomFrom(new Date(maxYear, 0, 1));
      setCustomTo(new Date(maxYear, 11, 31, 23, 59, 59));
      setYearInitialized(true);
    }

    const ledgerRows: LedgerRow[] = (txns || []).map((t) => {
      // Income: use resolveIncomeCategory (matches Home Revenue tab → "Business Income" not "Technology")
      // Expense: use resolveCategory (matches Home Overview/Expenses tab)
      const mappedAccount = t.amount > 0
        ? (resolveIncomeCategory(t.category || "", t.description) || "Business Income")
        : (resolveCategory(t.category || "", t.description) || "Other");
      return {
        id: `txn-${t.id}`, date: t.transaction_date, account: mappedAccount,
        description: t.description, reference: "",
        debit: t.amount < 0 ? Math.abs(t.amount) : 0,
        credit: t.amount > 0 ? t.amount : 0, source: 'transaction',
      };
    });

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

  const applyRule = async () => {
    const name = newRuleName.trim();
    const keywords = newRuleKeywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!name || keywords.length === 0) return;
    setApplyingRule(true);
    setRuleAppliedMsg("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      let totalUpdated = 0;
      for (const kw of keywords) {
        const { count } = await supabase.from("transactions")
          .update({ category: name })
          .eq("user_id", user.id)
          .ilike("description", `%${kw}%`);
        totalUpdated += count || 0;
        await supabase.from("bills")
          .update({ category: name })
          .eq("user_id", user.id)
          .ilike("notes", `%${kw}%`);
        await supabase.from("invoices")
          .update({ category: name })
          .eq("user_id", user.id)
          .ilike("notes", `%${kw}%`);
      }
      const existing = getUserCategoryRules();
      const existingIdx = existing.findIndex(r => r.name.toLowerCase() === name.toLowerCase());
      if (existingIdx >= 0) {
        existing[existingIdx].keywords = Array.from(new Set([...existing[existingIdx].keywords, ...keywords]));
      } else {
        existing.push({ name, keywords });
      }
      saveUserCategories(existing);
      setCategoryRules([...existing]);
      setRuleAppliedMsg(`Applied: "${name}" matched ${totalUpdated} transactions`);
      setNewRuleName("");
      setNewRuleKeywords("");
      fetchLedger();
    } catch (err) {
      setRuleAppliedMsg("Error applying rule");
    } finally {
      setApplyingRule(false);
    }
  };

  const deleteRule = async (ruleName: string) => {
    const updated = categoryRules.filter(r => r.name !== ruleName);
    saveUserCategories(updated);
    setCategoryRules(updated);
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
                <div className="text-2xl font-bold text-primary"><FormattedCurrency amount={totalDebit} currency={currency} /></div>
                <div className="text-xs text-muted-foreground mt-1">Dr side</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Credits</span>
                  <ArrowDownLeft className="h-4 w-4 text-destructive" />
                </div>
                <div className="text-2xl font-bold text-destructive"><FormattedCurrency amount={totalCredit} currency={currency} /></div>
                <div className="text-xs text-muted-foreground mt-1">Cr side</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Net Balance</span>
                  {/* Cr > Dr (netBalance < 0) = income > expenses = good = green */}
                  {netBalance <= 0
                    ? <TrendingUp className="h-4 w-4 text-green-500" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />}
                </div>
                <div className={`text-2xl font-bold ${netBalance <= 0 ? "text-green-500" : "text-destructive"}`}>
                  <FormattedCurrency amount={Math.abs(netBalance)} currency={currency} />
                  <span className="text-base ml-1 font-medium opacity-70">{netBalance > 0 ? "Dr" : "Cr"}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Dr − Cr</div>
              </CardContent>
            </Card>
            {/* Explain toggle */}
            <button
              onClick={() => setShowReasons(v => !v)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${showReasons ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0" />
              {showReasons ? "Hide Explanation" : "Explain These Numbers"}
            </button>

            {/* Reason Panel */}
            {showReasons && (
              <Card>
                <CardContent className="pt-4 pb-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How calculated</p>
                    <button onClick={() => setShowReasons(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>

                  <div className="space-y-3">
                    {/* Total Entries */}
                    <div className="rounded-lg bg-muted/40 p-3 space-y-1">
                      <p className="text-xs font-semibold text-foreground">Total Entries: {filtered.length}</p>
                      <p className="text-[11px] text-muted-foreground">All transactions from the database for this period. Source: <span className="font-mono">transactions</span> table, filtered by year and file.</p>
                    </div>

                    {/* Total Debits */}
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
                      <p className="text-xs font-semibold text-primary">Total Debits: {formatAmount(totalDebit, currency)}</p>
                      <p className="text-[11px] text-muted-foreground">Sum of all negative transactions (money going OUT). Categories: {groupedFiltered.filter(([, g]) => g.debit > 0).map(([cat]) => cat).join(", ") || "—"}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">Σ(amount &lt; 0) = {formatAmount(totalDebit, currency)}</p>
                    </div>

                    {/* Total Credits */}
                    <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 space-y-1">
                      <p className="text-xs font-semibold text-destructive">Total Credits: {formatAmount(totalCredit, currency)}</p>
                      <p className="text-[11px] text-muted-foreground">Sum of all positive transactions (money coming IN). Categories: {groupedFiltered.filter(([, g]) => g.credit > 0).map(([cat]) => cat).join(", ") || "—"}</p>
                      <p className="text-[11px] font-mono text-muted-foreground">Σ(amount &gt; 0) = {formatAmount(totalCredit, currency)}</p>
                    </div>

                    {/* Net Balance */}
                    <div className={`rounded-lg p-3 space-y-1 border ${netBalance <= 0 ? "bg-green-500/5 border-green-500/20" : "bg-destructive/5 border-destructive/20"}`}>
                      <p className={`text-xs font-semibold ${netBalance <= 0 ? "text-green-600" : "text-destructive"}`}>
                        Net Balance: {formatAmount(Math.abs(netBalance), currency)} {netBalance > 0 ? "Dr" : "Cr"}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        = Dr − Cr = {formatAmount(totalDebit, currency)} − {formatAmount(totalCredit, currency)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {netBalance <= 0
                          ? `Credits exceed Debits by ${formatAmount(Math.abs(netBalance), currency)} — income exceeded expenses (profitable period).`
                          : `Debits exceed Credits by ${formatAmount(Math.abs(netBalance), currency)} — expenses exceeded income (loss period).`}
                      </p>
                      <p className="text-[11px] text-muted-foreground">This matches Home page Profit of {formatAmount(Math.abs(netBalance), currency)}.</p>
                    </div>

                    <div className="text-[11px] text-muted-foreground border-t border-border/40 pt-2">
                      Data source: Supabase <span className="font-mono">transactions</span> table. Income categories use <span className="font-mono">resolveIncomeCategory()</span>; expense categories use <span className="font-mono">resolveCategory()</span> — same logic as Home page.
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Category Rules toggle */}
            <button
              onClick={() => setShowRulesPanel(v => !v)}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${showRulesPanel ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"}`}
            >
              <Tags className="h-3.5 w-3.5 shrink-0" />
              {showRulesPanel ? "Hide Rules" : "Category Rules"}
            </button>

            {showRulesPanel && (
              <Card>
                <CardContent className="pt-4 pb-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Category Rules</p>
                    <button onClick={() => setShowRulesPanel(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Add keywords &rarr; all transactions with matching descriptions automatically move to that category on all pages.</p>

                  {/* Add Rule Form */}
                  <div className="space-y-2">
                    <input
                      className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                      placeholder="Category name (e.g. Marketing)"
                      value={newRuleName}
                      onChange={e => setNewRuleName(e.target.value)}
                    />
                    <input
                      className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background"
                      placeholder="Keywords, comma-separated (e.g. marketing, ads)"
                      value={newRuleKeywords}
                      onChange={e => setNewRuleKeywords(e.target.value)}
                    />
                    <button
                      onClick={applyRule}
                      disabled={applyingRule || !newRuleName.trim() || !newRuleKeywords.trim()}
                      className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      {applyingRule ? <Loader2 className="h-3 w-3 animate-spin" /> : <PlusCircle className="h-3 w-3" />}
                      Apply Rule
                    </button>
                    {ruleAppliedMsg && (
                      <p className="text-[11px] text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {ruleAppliedMsg}
                      </p>
                    )}
                  </div>

                  {/* Existing Rules */}
                  {categoryRules.length > 0 && (
                    <div className="space-y-1.5 border-t border-border/40 pt-2">
                      <p className="text-[11px] font-medium text-muted-foreground">Active rules:</p>
                      {categoryRules.map((rule) => (
                        <div key={rule.name} className="flex items-start justify-between gap-1 text-[11px]">
                          <div>
                            <span className="font-semibold text-foreground">{rule.name}</span>
                            <span className="text-muted-foreground"> &larr; {rule.keywords.join(", ")}</span>
                          </div>
                          <button onClick={() => deleteRule(rule.name)} className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

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
                                  Dr {debit > 0 ? <FormattedCurrency amount={debit} currency={currency} /> : "—"}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive font-medium text-xs">
                                  Cr {credit > 0 ? <FormattedCurrency amount={credit} currency={currency} /> : "—"}
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
                                    <TableCell className="text-right">{r.debit > 0 ? <FormattedCurrency amount={r.debit} currency={currency} /> : "—"}</TableCell>
                                    <TableCell className="text-right">{r.credit > 0 ? <FormattedCurrency amount={r.credit} currency={currency} /> : "—"}</TableCell>
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
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">Dr <FormattedCurrency amount={totalDebit} currency={currency} /></span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">Cr <FormattedCurrency amount={totalCredit} currency={currency} /></span>
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
