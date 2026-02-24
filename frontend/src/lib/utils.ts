import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Official UAE Dirham symbol: Latin D + two combining long-stroke overlays (U+0336 × 2).
// This produces "D̶̶" — a D with two horizontal bars — matching the new official symbol
// announced by the UAE Central Bank on 1 Aug 2023.
// Unicode has assigned U+20C3 for this character; it will be released in Unicode 18.0.
// Until then, the combining-character approach works in all modern browsers without custom fonts.
export const DIRHAM_SYMBOL = "D\u0336\u0336";

export function replaceAedSymbol(formatted: string, currencyCode: string): string {
  if (currencyCode === "AED") {
    // Replace the "AED" prefix emitted by Intl.NumberFormat with the Dirham symbol
    return formatted.replace(/^AED\s*/, DIRHAM_SYMBOL + "\u00A0");
  }
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
