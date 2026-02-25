import { cn } from "@/lib/utils";
import { DirhamSymbol } from "./DirhamSymbol";

interface FormattedCurrencyProps {
  amount: number;
  currency: string;
  /** Use compact notation: 55,113 → 55.1K */
  compact?: boolean;
  /** Override max decimal places (default: 2 standard, 1 compact) */
  maxDecimals?: number;
  /** Extra classes applied to the outer <span> (AED only) */
  className?: string;
}

/**
 * Renders a currency amount with the proper symbol.
 * - AED → UAE Dirham SVG symbol + number (currentColor, inline-flex)
 * - All other currencies → standard Intl.NumberFormat text (e.g. "$55.1K")
 *
 * Use this in JSX wherever you display a monetary value.
 * For string contexts (chart tooltips, CSV, aria-labels) keep using formatAmount().
 */
export const FormattedCurrency = ({
  amount,
  currency,
  compact = false,
  maxDecimals,
  className,
}: FormattedCurrencyProps) => {
  if (currency === "AED") {
    const numStr = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxDecimals ?? (compact ? 1 : 2),
      ...(compact ? { notation: "compact" } : {}),
    } as Intl.NumberFormatOptions).format(amount);

    return (
      <span className={cn("inline-flex items-baseline gap-[0.1em]", className)}>
        <DirhamSymbol />
        <span>{numStr}</span>
      </span>
    );
  }

  // Non-AED: standard symbol from Intl (e.g. "$", "€", "£")
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals ?? (compact ? 1 : 2),
    ...(compact ? { notation: "compact" } : {}),
  } as Intl.NumberFormatOptions).format(amount);

  return <>{formatted}</>;
};
