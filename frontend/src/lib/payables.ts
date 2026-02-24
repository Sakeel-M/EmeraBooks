import { DIRHAM_SYMBOL } from './utils';

// Utility keywords for auto-extraction from bank statements
export const UTILITY_KEYWORDS = [
  'electricity', 'electric', 'power', 'etisalat', 'du',
  'internet', 'wifi', 'broadband', 'network',
  'water', 'sewage', 'dewa', 'addc', 'sewa',
  'gas', 'petroleum', 'adnoc',
  'phone', 'mobile', 'telecom',
  'utility', 'utilities'
];

export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Utility': ['electricity', 'electric', 'power', 'water', 'sewage', 'gas', 'utility', 'utilities'],
  'Telecom': ['etisalat', 'du', 'internet', 'wifi', 'broadband', 'network', 'phone', 'mobile', 'telecom'],
  'Rent': ['rent', 'lease', 'property'],
  'Insurance': ['insurance', 'policy'],
  'Subscription': ['subscription', 'monthly', 'annual'],
};

export interface PayableReceivable {
  id: string;
  user_id?: string;
  type: 'payable' | 'receivable';
  title: string;
  description?: string;
  amount: number;
  currency: string;
  due_date?: string;
  status: 'pending' | 'partial' | 'settled' | 'overdue';
  source: 'manual' | 'bank_statement' | 'bill' | 'invoice';
  source_id?: string;
  category?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  transaction_date: string;
  category: string;
}

// Extract vendor name from transaction description
export function extractVendorName(description: string): string {
  // Remove common prefixes and clean up
  let name = description
    .replace(/^(payment to|transfer to|debit|credit|pos|atm|eft)/i, '')
    .replace(/\d{4,}/g, '') // Remove long numbers (card numbers, references)
    .replace(/[^\w\s]/g, ' ') // Remove special characters
    .trim();
  
  // Capitalize first letter of each word
  name = name
    .split(' ')
    .filter(word => word.length > 1)
    .slice(0, 3) // Take first 3 words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return name || 'Unknown Vendor';
}

// Detect category from description
export function detectCategory(description: string): string {
  const lowerDesc = description.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      return category;
    }
  }
  
  return 'Other';
}

// Check if transaction matches utility/payable patterns
export function isUtilityTransaction(description: string): boolean {
  const lowerDesc = description.toLowerCase();
  return UTILITY_KEYWORDS.some(kw => lowerDesc.includes(kw));
}

// Extract payables from bank statement transactions
export function extractPayablesFromTransactions(transactions: Transaction[]): Partial<PayableReceivable>[] {
  return transactions
    .filter(t => {
      const desc = t.description.toLowerCase();
      // Match utility keywords and negative amounts (expenses)
      return UTILITY_KEYWORDS.some(kw => desc.includes(kw)) && t.amount < 0;
    })
    .map(t => ({
      type: 'payable' as const,
      title: extractVendorName(t.description),
      description: t.description,
      amount: Math.abs(t.amount),
      category: detectCategory(t.description),
      source: 'bank_statement' as const,
      source_id: t.id,
      due_date: t.transaction_date,
      status: 'pending' as const,
    }));
}

// Extract receivables from transactions (positive amounts, potential customer payments)
export function extractReceivablesFromTransactions(transactions: Transaction[]): Partial<PayableReceivable>[] {
  return transactions
    .filter(t => t.amount > 0) // Positive amounts = incoming
    .map(t => ({
      type: 'receivable' as const,
      title: extractVendorName(t.description),
      description: t.description,
      amount: t.amount,
      category: 'Income',
      source: 'bank_statement' as const,
      source_id: t.id,
      due_date: t.transaction_date,
      status: 'settled' as const, // Already received
    }));
}

// Calculate totals
export function calculateTotals(items: PayableReceivable[]) {
  const payables = items.filter(i => i.type === 'payable' && i.status !== 'settled');
  const receivables = items.filter(i => i.type === 'receivable' && i.status !== 'settled');
  
  const totalPayable = payables.reduce((sum, i) => sum + i.amount, 0);
  const totalReceivable = receivables.reduce((sum, i) => sum + i.amount, 0);
  const netPosition = totalReceivable - totalPayable;
  
  return {
    totalPayable,
    totalReceivable,
    netPosition,
    payableCount: payables.length,
    receivableCount: receivables.length,
    overduePayables: payables.filter(i => i.status === 'overdue').length,
    overdueReceivables: receivables.filter(i => i.status === 'overdue').length,
  };
}

// Check if item is overdue (uses UTC midnight to avoid timezone edge cases)
export function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  // Treat date-only strings as UTC midnight to prevent timezone-driven false positives
  const normalized = dueDate.includes("T") ? dueDate : dueDate + "T00:00:00Z";
  return new Date(normalized) < new Date();
}

// Format currency — uses the new UAE Dirham symbol for AED
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
  if (currency === 'AED') {
    return formatted.replace(/^AED\s*/, DIRHAM_SYMBOL + '\u00A0');
  }
  return formatted;
}
