import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// AED amounts are displayed with the ISO code prefix "AED" (e.g. "AED 1,234").
// The combining-character Dirham symbol (D\u0336\u0336) renders as Đ on most
// systems, so we keep the plain ISO code for universal readability.
export const DIRHAM_SYMBOL = "AED";

export function replaceAedSymbol(formatted: string, _currencyCode: string): string {
  // Return the Intl.NumberFormat output unchanged — it already prefixes with "AED".
  return formatted;
}

export const formatAmount = (amount: number, currency: string = "USD") =>
  replaceAedSymbol(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount),
    currency
  );

export const formatCompactCurrency = (value: number, currency: string = "USD") =>
  replaceAedSymbol(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 0,
    }).format(value),
    currency
  );
