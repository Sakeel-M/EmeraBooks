import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** @deprecated No longer needed — kept for backward compatibility only */
export function replaceAedSymbol(formatted: string, _currencyCode: string): string {
  return formatted;
}

/** Returns a formatted currency string (e.g. "AED 55,113" or "$55,113").
 *  For JSX display with the UAE Dirham SVG symbol use <FormattedCurrency> instead. */
export const formatAmount = (amount: number, currency: string = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);

/** Compact version of formatAmount (e.g. "AED 55.1K"). String output only. */
export const formatCompactCurrency = (value: number, currency: string = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  } as Intl.NumberFormatOptions).format(value);
