
# Fix: Replace "AED" with "Đ" Symbol in Remaining Pages

## Problem
Several pages still display the raw currency code "AED" instead of the custom Dirham symbol "Đ". This affects the Budget page, Invoice form, Customers page/detail, Payables & Receivables, Home page detail sheet, and Financial Summary.

## Root Cause
These files use either:
- String concatenation like `{currency} {amount}` (Budget page), which outputs "AED 4,000" instead of "Đ 4,000"
- Inline `Intl.NumberFormat` calls without the `replaceAedSymbol` post-processor

## Files to Change

| File | Issue | Fix |
|---|---|---|
| `src/pages/Budget.tsx` | Uses `{currency} {amount}` string concat | Replace with `formatAmount()` from utils |
| `src/components/invoices/LineItemsEditor.tsx` | Inline `Intl.NumberFormat` without AED override | Use `replaceAedSymbol` wrapper or import `formatAmount` |
| `src/components/customers/CustomerDetail.tsx` | Inline `formatCurrency` without AED override | Wrap with `replaceAedSymbol` |
| `src/pages/Customers.tsx` | Inline `formatCurrency` without AED override | Wrap with `replaceAedSymbol` |
| `src/components/dashboard/MetricDetailSheet.tsx` | Inline `fmt` without AED override | Wrap with `replaceAedSymbol` |
| `src/lib/payables.ts` | `formatCurrency` without AED override | Wrap with `replaceAedSymbol` |
| `src/components/dashboard/FinancialSummary.tsx` | Inline `formatCurrency` without AED override | Wrap with `replaceAedSymbol` |

## Technical Details

### Budget.tsx (largest change)
Replace all instances of `{currency} {value.toLocaleString()}` pattern with `formatAmount(value, currency)` imported from `@/lib/utils`. This handles the Đ symbol automatically.

### All other files
Add `import { replaceAedSymbol } from "@/lib/utils"` and wrap the existing `Intl.NumberFormat(...).format(amount)` calls with `replaceAedSymbol(result, currency)`, following the same pattern already used in 15+ other files.

This ensures every currency display across the entire application consistently shows "Đ" for AED.
