import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function replaceAedSymbol(formatted: string, currencyCode: string): string {
  if (currencyCode !== "AED") return formatted;
  return formatted.replace(/AED|د\.إ\.?\s?/g, "Đ");
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
