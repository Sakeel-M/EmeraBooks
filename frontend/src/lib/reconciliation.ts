// Reconciliation Logic Utilities

export interface BankTransaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  category?: string;
  file_id?: string;
}

export interface OdooTransaction {
  id: number | string;
  date?: string;
  payment_date?: string;
  name?: string;
  amount?: number;
  amount_total?: number;
  ref?: string;
  partner_id?: [number, string] | null;
  partner_name?: string;
  memo?: string;
}

export interface NormalizedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  original?: OdooTransaction;
}

export interface ReconciliationSettings {
  matchByAmount: boolean;
  matchByDate: boolean;
  matchByDescription: boolean;
  dateTolerance: number;
  amountTolerance: 'exact' | 'cents' | 'percent';
  aiMatching: boolean;
}

export interface MatchedTransaction {
  id: string;
  date: string;
  description: string;
  bankAmount: number;
  odooAmount: number;
}

export interface AmountMismatch {
  id: string;
  date: string;
  description: string;
  bankAmount: number;
  odooAmount: number;
  difference: number;
}

export interface DateDiscrepancy {
  id: string;
  bankDate: string;
  odooDate: string;
  description: string;
  amount: number;
  daysDiff: number;
}

export interface DuplicateTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  occurrences: number;
}

export interface MissingTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface ReconciliationResults {
  matchRate: number;
  totalDiscrepancy: number;
  matched: MatchedTransaction[];
  amountMismatches: AmountMismatch[];
  missingInOdoo: MissingTransaction[];
  missingInBank: MissingTransaction[];
  dateDiscrepancies: DateDiscrepancy[];
  duplicates: DuplicateTransaction[];
}

function normalizeOdooTransactions(odooTxns: OdooTransaction[]): NormalizedTransaction[] {
  return odooTxns.map(t => ({
    id: String(t.id),
    date: t.date || t.payment_date || '',
    description: t.name || t.ref || t.memo || (t.partner_id ? t.partner_id[1] : '') || '',
    amount: Math.abs(t.amount || t.amount_total || 0),
    original: t
  }));
}

interface AmountMatchResult {
  isExact: boolean;
  isClose: boolean;
  difference: number;
}

function checkAmountMatch(
  bankAmount: number, 
  odooAmount: number, 
  settings: ReconciliationSettings
): AmountMatchResult {
  const diff = bankAmount - odooAmount;
  const absDiff = Math.abs(diff);
  
  if (absDiff === 0) {
    return { isExact: true, isClose: true, difference: 0 };
  }
  
  if (settings.amountTolerance === 'cents' && absDiff <= 0.01) {
    return { isExact: false, isClose: true, difference: diff };
  }
  
  if (settings.amountTolerance === 'percent' && bankAmount > 0 && (absDiff / bankAmount) <= 0.01) {
    return { isExact: false, isClose: true, difference: diff };
  }
  
  return { isExact: false, isClose: false, difference: diff };
}

interface DateMatchResult {
  isExact: boolean;
  isClose: boolean;
  daysDiff: number;
}

function checkDateMatch(
  bankDate: string, 
  odooDate: string, 
  settings: ReconciliationSettings
): DateMatchResult {
  if (!bankDate || !odooDate) {
    return { isExact: false, isClose: false, daysDiff: 999 };
  }
  
  const bankTime = new Date(bankDate).getTime();
  const odooTime = new Date(odooDate).getTime();
  const daysDiff = Math.abs(Math.round((bankTime - odooTime) / (1000 * 60 * 60 * 24)));
  
  if (daysDiff === 0) {
    return { isExact: true, isClose: true, daysDiff: 0 };
  }
  
  if (daysDiff <= settings.dateTolerance) {
    return { isExact: false, isClose: true, daysDiff };
  }
  
  return { isExact: false, isClose: false, daysDiff };
}

function checkDescriptionMatch(bankDesc: string, odooDesc: string): boolean {
  if (!bankDesc || !odooDesc) return false;
  
  const normalizedBank = bankDesc.toLowerCase().trim();
  const normalizedOdoo = odooDesc.toLowerCase().trim();
  
  // Exact match
  if (normalizedBank === normalizedOdoo) return true;
  
  // Partial match - one contains the other
  if (normalizedBank.includes(normalizedOdoo) || normalizedOdoo.includes(normalizedBank)) {
    return true;
  }
  
  // Word-based matching - at least 50% words match
  const bankWords = normalizedBank.split(/\s+/).filter(w => w.length > 2);
  const odooWords = normalizedOdoo.split(/\s+/).filter(w => w.length > 2);
  
  if (bankWords.length === 0 || odooWords.length === 0) return false;
  
  const matchingWords = bankWords.filter(bw => 
    odooWords.some(ow => bw.includes(ow) || ow.includes(bw))
  );
  
  return matchingWords.length >= Math.min(bankWords.length, odooWords.length) * 0.5;
}

function findDuplicates(transactions: NormalizedTransaction[]): DuplicateTransaction[] {
  const seen = new Map<string, { transaction: NormalizedTransaction; count: number }>();
  
  for (const t of transactions) {
    const key = `${t.date}-${t.amount.toFixed(2)}-${t.description.toLowerCase().trim()}`;
    const existing = seen.get(key);
    
    if (existing) {
      existing.count++;
    } else {
      seen.set(key, { transaction: t, count: 1 });
    }
  }
  
  const duplicates: DuplicateTransaction[] = [];
  
  for (const [, value] of seen) {
    if (value.count > 1) {
      duplicates.push({
        id: value.transaction.id,
        date: value.transaction.date,
        description: value.transaction.description,
        amount: value.transaction.amount,
        occurrences: value.count
      });
    }
  }
  
  return duplicates;
}

export function reconcileTransactions(
  bankTxns: BankTransaction[],
  odooTxns: OdooTransaction[],
  settings: ReconciliationSettings
): ReconciliationResults {
  const normalizedOdoo = normalizeOdooTransactions(odooTxns);
  
  const matched: MatchedTransaction[] = [];
  const amountMismatches: AmountMismatch[] = [];
  const dateDiscrepancies: DateDiscrepancy[] = [];
  const usedOdooIds = new Set<string>();
  const usedBankIds = new Set<string>();
  
  let totalDiscrepancy = 0;
  
  // First pass: Find exact matches
  for (const bank of bankTxns) {
    if (usedBankIds.has(bank.id)) continue;
    
    const bankAmount = Math.abs(bank.amount);
    
    for (const odoo of normalizedOdoo) {
      if (usedOdooIds.has(odoo.id)) continue;
      
      const amountMatch = settings.matchByAmount 
        ? checkAmountMatch(bankAmount, odoo.amount, settings)
        : { isExact: true, isClose: true, difference: 0 };
        
      const dateMatch = settings.matchByDate
        ? checkDateMatch(bank.transaction_date, odoo.date, settings)
        : { isExact: true, isClose: true, daysDiff: 0 };
        
      const descMatch = settings.matchByDescription 
        ? checkDescriptionMatch(bank.description, odoo.description)
        : true;
      
      // Perfect match
      if (amountMatch.isExact && dateMatch.isExact && descMatch) {
        matched.push({
          id: bank.id,
          date: bank.transaction_date,
          description: bank.description,
          bankAmount,
          odooAmount: odoo.amount
        });
        usedOdooIds.add(odoo.id);
        usedBankIds.add(bank.id);
        break;
      }
      
      // Amount mismatch but date matches
      if (!amountMatch.isExact && amountMatch.isClose && dateMatch.isExact && descMatch) {
        amountMismatches.push({
          id: bank.id,
          date: bank.transaction_date,
          description: bank.description,
          bankAmount,
          odooAmount: odoo.amount,
          difference: amountMatch.difference
        });
        totalDiscrepancy += Math.abs(amountMatch.difference);
        usedOdooIds.add(odoo.id);
        usedBankIds.add(bank.id);
        break;
      }
      
      // Date mismatch but amount matches
      if (amountMatch.isExact && !dateMatch.isExact && dateMatch.isClose && descMatch) {
        dateDiscrepancies.push({
          id: bank.id,
          bankDate: bank.transaction_date,
          odooDate: odoo.date,
          description: bank.description,
          amount: bankAmount,
          daysDiff: dateMatch.daysDiff
        });
        usedOdooIds.add(odoo.id);
        usedBankIds.add(bank.id);
        break;
      }
    }
  }
  
  // Find missing in Odoo (bank transactions not matched)
  const missingInOdoo: MissingTransaction[] = bankTxns
    .filter(t => !usedBankIds.has(t.id))
    .map(t => ({
      id: t.id,
      date: t.transaction_date,
      description: t.description,
      amount: Math.abs(t.amount)
    }));
  
  // Find missing in Bank (Odoo transactions not matched)
  const missingInBank: MissingTransaction[] = normalizedOdoo
    .filter(t => !usedOdooIds.has(t.id))
    .map(t => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount
    }));
  
  // Find duplicates in Odoo
  const duplicates = findDuplicates(normalizedOdoo);
  
  // Calculate match rate
  const totalBank = bankTxns.length;
  const matchRate = totalBank > 0 
    ? (matched.length / totalBank) * 100 
    : 0;
  
  return {
    matchRate: Math.round(matchRate * 10) / 10,
    totalDiscrepancy: Math.round(totalDiscrepancy * 100) / 100,
    matched,
    amountMismatches,
    missingInOdoo,
    missingInBank,
    dateDiscrepancies,
    duplicates
  };
}

export const defaultSettings: ReconciliationSettings = {
  matchByAmount: true,
  matchByDate: true,
  matchByDescription: false,
  dateTolerance: 3,
  amountTolerance: 'exact',
  aiMatching: false
};
