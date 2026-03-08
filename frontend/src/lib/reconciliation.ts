// Reconciliation Logic Utilities — Multi-Pass Matching Engine

export interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category?: string;
  file_id?: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  account_name?: string;
  type: 'transaction' | 'journal_line';
}

export interface ReconciliationSettings {
  matchByAmount: boolean;
  matchByDate: boolean;
  matchByDescription: boolean;
  matchSign: boolean;           // income txns match invoices; expense txns match bills
  dateTolerance: number;        // days: within tolerance = MATCH, not a flag
  amountTolerance: 'exact' | 'cents' | 'percent';
  aiMatching: boolean;
}

export interface MatchedItem {
  id: string;
  statementDate: string;
  statementDescription: string;
  statementAmount: number;
  ledgerDate: string;
  ledgerDescription: string;
  ledgerAmount: number;
  ledgerEntryId: string;
  matchQuality: 'exact' | 'near';   // 'near' = matched within date tolerance
  daysDiff?: number;                  // days offset when matchQuality = 'near'
}

export interface FlaggedItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  flagType: 'missing_in_ledger' | 'missing_in_statement' | 'amount_mismatch' | 'date_mismatch' | 'duplicate' | 'bank_transfer';
  ledgerEntryId?: string;
  ledgerAmount?: number;
  ledgerDate?: string;
  difference?: number;
  daysDiff?: number;
  occurrences?: number;
}

export interface ReconciliationResults {
  matchRate: number;
  totalDiscrepancy: number;
  matched: MatchedItem[];
  flags: FlaggedItem[];
  unreconciledDifference: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function checkAmountMatch(
  a: number,
  b: number,
  settings: ReconciliationSettings
): { isExact: boolean; isClose: boolean; difference: number } {
  const diff = a - b;
  const absDiff = Math.abs(diff);

  if (absDiff === 0) return { isExact: true, isClose: true, difference: 0 };

  if (settings.amountTolerance === 'cents' && absDiff <= 0.01)
    return { isExact: false, isClose: true, difference: diff };

  if (settings.amountTolerance === 'percent' && a > 0 && absDiff / a <= 0.01)
    return { isExact: false, isClose: true, difference: diff };

  return { isExact: false, isClose: false, difference: diff };
}

function checkDateMatch(
  dateA: string,
  dateB: string,
  settings: ReconciliationSettings
): { isExact: boolean; isClose: boolean; daysDiff: number } {
  if (!dateA || !dateB) return { isExact: false, isClose: false, daysDiff: 999 };

  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  const daysDiff = Math.abs(Math.round((a - b) / (1000 * 60 * 60 * 24)));

  if (daysDiff === 0) return { isExact: true, isClose: true, daysDiff: 0 };
  if (daysDiff <= settings.dateTolerance) return { isExact: false, isClose: true, daysDiff };
  return { isExact: false, isClose: false, daysDiff };
}

function checkDescriptionMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = na.split(/\s+/).filter(w => w.length > 2);
  const wordsB = nb.split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const matching = wordsA.filter(wa => wordsB.some(wb => wa.includes(wb) || wb.includes(wa)));
  return matching.length >= Math.min(wordsA.length, wordsB.length) * 0.5;
}

/** When matchSign is enabled, statement and ledger entries must share the same sign */
function sameSign(stmtAmount: number, ledgerAmount: number, settings: ReconciliationSettings): boolean {
  if (!settings.matchSign) return true;
  // Both positive (income / invoices) or both negative (expense / bills)
  return (stmtAmount >= 0 && ledgerAmount >= 0) || (stmtAmount < 0 && ledgerAmount < 0);
}

// ── Main reconciliation function ────────────────────────────────────────────

export function reconcileTransactions(
  statementTxns: BankTransaction[],
  ledgerEntries: LedgerEntry[],
  settings: ReconciliationSettings
): ReconciliationResults {
  const matched: MatchedItem[] = [];
  const flags: FlaggedItem[] = [];
  const usedLedgerIds = new Set<string>();
  const usedStatementIds = new Set<string>();
  let totalDiscrepancy = 0;

  // Wide tolerance for date_mismatch review flags (catches payment-after-invoice patterns)
  const wideTolerance = Math.max(settings.dateTolerance + 14, 21);

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 1: Perfect match — exact amount + exact date (+ desc if enabled)
  // ─────────────────────────────────────────────────────────────────────────
  for (const stmt of statementTxns) {
    if (usedStatementIds.has(stmt.id)) continue;
    const stmtAmt = Math.abs(stmt.amount);

    for (const ledger of ledgerEntries) {
      if (usedLedgerIds.has(ledger.id)) continue;
      if (!sameSign(stmt.amount, ledger.amount, settings)) continue;

      const amtMatch = settings.matchByAmount
        ? checkAmountMatch(stmtAmt, Math.abs(ledger.amount), settings)
        : { isExact: true, isClose: true, difference: 0 };
      const dateMatch = settings.matchByDate
        ? checkDateMatch(stmt.transaction_date, ledger.date, settings)
        : { isExact: true, isClose: true, daysDiff: 0 };
      const descMatch = settings.matchByDescription
        ? checkDescriptionMatch(stmt.description, ledger.description)
        : true;

      if (amtMatch.isExact && dateMatch.isExact && descMatch) {
        matched.push({
          id: stmt.id,
          statementDate: stmt.transaction_date,
          statementDescription: stmt.description,
          statementAmount: stmtAmt,
          ledgerDate: ledger.date,
          ledgerDescription: ledger.description,
          ledgerAmount: Math.abs(ledger.amount),
          ledgerEntryId: ledger.id,
          matchQuality: 'exact',
        });
        usedLedgerIds.add(ledger.id);
        usedStatementIds.add(stmt.id);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 2: Tolerance match — exact amount + date within dateTolerance
  // KEY FIX: "within tolerance" = MATCH, not a flag
  // ─────────────────────────────────────────────────────────────────────────
  for (const stmt of statementTxns) {
    if (usedStatementIds.has(stmt.id)) continue;
    const stmtAmt = Math.abs(stmt.amount);

    for (const ledger of ledgerEntries) {
      if (usedLedgerIds.has(ledger.id)) continue;
      if (!sameSign(stmt.amount, ledger.amount, settings)) continue;

      const amtMatch = settings.matchByAmount
        ? checkAmountMatch(stmtAmt, Math.abs(ledger.amount), settings)
        : { isExact: true, isClose: true, difference: 0 };
      const dateMatch = settings.matchByDate
        ? checkDateMatch(stmt.transaction_date, ledger.date, settings)
        : { isExact: true, isClose: true, daysDiff: 0 };
      const descMatch = settings.matchByDescription
        ? checkDescriptionMatch(stmt.description, ledger.description)
        : true;

      // Exact amount + date within tolerance → MATCH (not a flag)
      if (amtMatch.isExact && dateMatch.isClose && !dateMatch.isExact && descMatch) {
        matched.push({
          id: stmt.id,
          statementDate: stmt.transaction_date,
          statementDescription: stmt.description,
          statementAmount: stmtAmt,
          ledgerDate: ledger.date,
          ledgerDescription: ledger.description,
          ledgerAmount: Math.abs(ledger.amount),
          ledgerEntryId: ledger.id,
          matchQuality: 'near',
          daysDiff: dateMatch.daysDiff,
        });
        usedLedgerIds.add(ledger.id);
        usedStatementIds.add(stmt.id);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 3: Amount mismatch — close amount + date within tolerance
  // ─────────────────────────────────────────────────────────────────────────
  for (const stmt of statementTxns) {
    if (usedStatementIds.has(stmt.id)) continue;
    const stmtAmt = Math.abs(stmt.amount);

    for (const ledger of ledgerEntries) {
      if (usedLedgerIds.has(ledger.id)) continue;
      if (!sameSign(stmt.amount, ledger.amount, settings)) continue;

      const amtMatch = settings.matchByAmount
        ? checkAmountMatch(stmtAmt, Math.abs(ledger.amount), settings)
        : { isExact: true, isClose: true, difference: 0 };
      const dateMatch = settings.matchByDate
        ? checkDateMatch(stmt.transaction_date, ledger.date, settings)
        : { isExact: true, isClose: true, daysDiff: 0 };
      const descMatch = settings.matchByDescription
        ? checkDescriptionMatch(stmt.description, ledger.description)
        : true;

      if (!amtMatch.isExact && amtMatch.isClose && dateMatch.isClose && descMatch) {
        flags.push({
          id: stmt.id,
          date: stmt.transaction_date,
          description: stmt.description,
          amount: stmtAmt,
          flagType: 'amount_mismatch',
          ledgerEntryId: ledger.id,
          ledgerAmount: Math.abs(ledger.amount),
          difference: amtMatch.difference,
        });
        totalDiscrepancy += Math.abs(amtMatch.difference);
        usedLedgerIds.add(ledger.id);
        usedStatementIds.add(stmt.id);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 4: Wide date match — exact amount + date within wideTolerance
  // Catches invoices paid 7-21 days after issue — flagged for review, not as error
  // ─────────────────────────────────────────────────────────────────────────
  const wideSettings = { ...settings, dateTolerance: wideTolerance };
  for (const stmt of statementTxns) {
    if (usedStatementIds.has(stmt.id)) continue;
    const stmtAmt = Math.abs(stmt.amount);

    for (const ledger of ledgerEntries) {
      if (usedLedgerIds.has(ledger.id)) continue;
      if (!sameSign(stmt.amount, ledger.amount, settings)) continue;

      const amtMatch = settings.matchByAmount
        ? checkAmountMatch(stmtAmt, Math.abs(ledger.amount), settings)
        : { isExact: true, isClose: true, difference: 0 };
      const wideDateMatch = checkDateMatch(stmt.transaction_date, ledger.date, wideSettings);

      if (amtMatch.isExact && wideDateMatch.isClose) {
        flags.push({
          id: stmt.id,
          date: stmt.transaction_date,
          description: stmt.description,
          amount: stmtAmt,
          flagType: 'date_mismatch',
          ledgerEntryId: ledger.id,
          ledgerDate: ledger.date,
          daysDiff: wideDateMatch.daysDiff,
        });
        usedLedgerIds.add(ledger.id);
        usedStatementIds.add(stmt.id);
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 5: Missing in ledger
  // ─────────────────────────────────────────────────────────────────────────
  for (const stmt of statementTxns) {
    if (!usedStatementIds.has(stmt.id)) {
      flags.push({
        id: stmt.id,
        date: stmt.transaction_date,
        description: stmt.description,
        amount: Math.abs(stmt.amount),
        flagType: 'missing_in_ledger',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 6: Missing in statement
  // ─────────────────────────────────────────────────────────────────────────
  for (const ledger of ledgerEntries) {
    if (!usedLedgerIds.has(ledger.id)) {
      flags.push({
        id: ledger.id,
        date: ledger.date,
        description: ledger.description,
        amount: Math.abs(ledger.amount),
        flagType: 'missing_in_statement',
        ledgerEntryId: ledger.id,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PASS 7: Duplicates in statement
  // ─────────────────────────────────────────────────────────────────────────
  const seen = new Map<string, { txn: BankTransaction; count: number }>();
  for (const t of statementTxns) {
    const key = `${t.transaction_date}-${Math.abs(t.amount).toFixed(2)}-${t.description.toLowerCase().trim()}`;
    const existing = seen.get(key);
    if (existing) existing.count++;
    else seen.set(key, { txn: t, count: 1 });
  }
  for (const [, val] of seen) {
    if (val.count > 1) {
      flags.push({
        id: val.txn.id,
        date: val.txn.transaction_date,
        description: val.txn.description,
        amount: Math.abs(val.txn.amount),
        flagType: 'duplicate',
        occurrences: val.count,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Results
  // ─────────────────────────────────────────────────────────────────────────
  const totalStatement = statementTxns.length;
  const matchRate = totalStatement > 0 ? (matched.length / totalStatement) * 100 : 0;

  const stmtTotal = statementTxns.reduce((s, t) => s + t.amount, 0);
  const ledgerTotal = ledgerEntries.reduce((s, e) => s + e.amount, 0);
  const unreconciledDifference = Math.round((stmtTotal - ledgerTotal) * 100) / 100;

  return {
    matchRate: Math.round(matchRate * 10) / 10,
    totalDiscrepancy: Math.round(totalDiscrepancy * 100) / 100,
    matched,
    flags,
    unreconciledDifference,
  };
}

export const defaultSettings: ReconciliationSettings = {
  matchByAmount: true,
  matchByDate: true,
  matchByDescription: false,
  matchSign: true,
  dateTolerance: 3,
  amountTolerance: 'exact',
  aiMatching: false,
};
