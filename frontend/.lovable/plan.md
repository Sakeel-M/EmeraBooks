

# Fix: Bill Form Shows Dollar Sign Instead of User's Currency

## Problem
The bill creation form always shows "$" in the amount field, even when the user's preferred currency is set to something else (e.g., AED). The `useCurrency` hook is already imported and called in `BillForm.tsx`, but the currency value is never passed to the `CurrencyInput` component.

## Fix
One line change in `src/components/bills/BillForm.tsx`: pass the `userCurrency` value to the `CurrencyInput` component's `currency` prop.

### Current code (line ~238):
```tsx
<CurrencyInput
  value={field.value}
  onChange={field.onChange}
/>
```

### Fixed code:
```tsx
<CurrencyInput
  value={field.value}
  onChange={field.onChange}
  currency={userCurrency}
/>
```

## How It Works
- `useCurrency()` is already called at the top of `BillForm` and returns the user's preferred currency from their settings
- `CurrencyInput` already supports a `currency` prop and displays the correct symbol when provided
- The currency symbol mapping in `CurrencyInput` currently only handles "USD" with "$" and falls back to the currency code for others -- this is sufficient since codes like "AED" will display as "AED" prefix

## Files to Change

| File | Change |
|---|---|
| `src/components/bills/BillForm.tsx` | Add `currency={userCurrency}` prop to CurrencyInput |

