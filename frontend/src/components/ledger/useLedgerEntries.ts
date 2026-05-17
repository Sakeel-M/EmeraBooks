import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useDateRange } from "@/hooks/useDateRange";
import { database } from "@/lib/database";
import { resolveIncomeCategory, getCanonicalCategory } from "@/lib/sectorMapping";

export interface LedgerLine {
  account_id?: string;
  account_name: string;
  account_code?: string;
  account_type?: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface LedgerEntry {
  id: string;
  kind: "derived" | "manual";
  date: string;
  description: string;
  reference?: string;
  lines: LedgerLine[];
  total_debit: number;
  total_credit: number;
  source_id: string; // transaction id (derived) or journal id (manual)
  raw: any;
}

const CASH_LABEL = "Cash / Bank";

function buildDerivedEntry(t: any, businessSector: string | null): LedgerEntry {
  const amt = Number(t.amount || 0);
  const isInflow = amt > 0;
  const abs = Math.abs(amt);
  const counterCategory = isInflow
    ? resolveIncomeCategory(t.category, t.counterparty_name || t.description, businessSector) || "Business Income"
    : getCanonicalCategory(t.category, t.counterparty_name || t.description, t.description) || "Uncategorized";
  const lines: LedgerLine[] = isInflow
    ? [
        { account_name: CASH_LABEL, debit: abs, credit: 0 },
        { account_name: counterCategory, debit: 0, credit: abs },
      ]
    : [
        { account_name: counterCategory, debit: abs, credit: 0 },
        { account_name: CASH_LABEL, debit: 0, credit: abs },
      ];
  return {
    id: `txn-${t.id}`,
    kind: "derived",
    date: t.transaction_date,
    description: t.description || t.counterparty_name || "Bank transaction",
    lines,
    total_debit: abs,
    total_credit: abs,
    source_id: t.id,
    raw: t,
  };
}

function buildManualEntry(je: any): LedgerEntry {
  const lines: LedgerLine[] = (je.lines || []).map((l: any) => ({
    account_id: l.account_id,
    account_name: l.account_name || "—",
    account_code: l.account_code,
    account_type: l.account_type,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
    description: l.description,
  }));
  return {
    id: `je-${je.id}`,
    kind: "manual",
    date: je.entry_date,
    description: je.description || "Manual journal entry",
    reference: je.reference,
    lines,
    total_debit: Number(je.total_debit || lines.reduce((s, l) => s + l.debit, 0)),
    total_credit: Number(je.total_credit || lines.reduce((s, l) => s + l.credit, 0)),
    source_id: je.id,
    raw: je,
  };
}

export function useLedgerEntries() {
  const { clientId, client } = useActiveClient();
  const { startDate, endDate } = useDateRange();
  const businessSector = client?.industry || null;

  const { data: transactions = [], isFetching: txnsFetching } = useQuery({
    queryKey: ["ledger-txns", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = { limit: 10000 };
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getTransactions(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const { data: journals = [], isFetching: jeFetching } = useQuery({
    queryKey: ["journal-entries", clientId, startDate || "all", endDate || "all"],
    queryFn: () => {
      const opts: any = {};
      if (startDate) opts.startDate = startDate;
      if (endDate) opts.endDate = endDate;
      return database.getJournalEntries(clientId!, opts);
    },
    enabled: !!clientId,
  });

  const entries = useMemo<LedgerEntry[]>(() => {
    const derived = transactions.map((t: any) => buildDerivedEntry(t, businessSector));
    const manual = journals.map((je: any) => buildManualEntry(je));
    return [...derived, ...manual].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [transactions, journals, businessSector]);

  return {
    entries,
    isLoading: txnsFetching || jeFetching,
    rawTransactions: transactions,
    rawJournals: journals,
  };
}
