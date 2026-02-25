import { DIRHAM_PATH } from "./DirhamSymbol";

interface CurrencyAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value: number };
  currency?: string;
  anchor?: "start" | "middle" | "end";
  /** Use compact K/M notation (default true) */
  compact?: boolean;
  fill?: string;
  fontSize?: number;
}

/**
 * Custom recharts tick component that renders the UAE Dirham SVG symbol for AED,
 * and standard Intl text for all other currencies.
 *
 * Usage on XAxis (numbers on bottom, category labels):
 *   <XAxis tick={<CurrencyAxisTick currency={currency} />} />
 *
 * Usage on YAxis (numbers on left):
 *   <YAxis tick={<CurrencyAxisTick currency={currency} anchor="end" />} />
 *
 * Recharts passes {x, y, payload} automatically via element cloning.
 */
export const CurrencyAxisTick = ({
  x = 0,
  y = 0,
  payload,
  currency = "USD",
  anchor = "middle",
  compact = true,
  fill = "hsl(var(--muted-foreground))",
  fontSize = 11,
}: CurrencyAxisTickProps) => {
  if (!payload) return null;

  const numStr = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 2,
    ...(compact ? { notation: "compact" } : {}),
  } as Intl.NumberFormatOptions).format(payload.value);

  // Non-AED: standard Intl text with currency symbol
  if (currency !== "AED") {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: compact ? 1 : 2,
      ...(compact ? { notation: "compact" } : {}),
    } as Intl.NumberFormatOptions).format(payload.value);
    return (
      <text x={x} y={y} textAnchor={anchor} fill={fill} fontSize={fontSize} dy="0.35em">
        {formatted}
      </text>
    );
  }

  // AED: render Dirham SVG path + number in SVG context
  // Symbol viewBox: 0 0 1000 870  → scale = fontSize / 870
  const scale = fontSize / 870;
  const symW = 1000 * scale;   // symbol width in px
  const symH = 870 * scale;    // symbol height in px  (= fontSize)
  const gap = 2;

  // Approximate text width (monospace-ish estimate)
  const numW = numStr.length * fontSize * 0.58;
  const totalW = symW + gap + numW;

  // Starting x for the symbol depending on text anchor
  let sx: number;
  if (anchor === "middle") sx = x - totalW / 2;
  else if (anchor === "end") sx = x - totalW;
  else sx = x; // "start"

  // Vertical: align symbol baseline with text baseline
  // Recharts passes y as the tick's baseline position
  const baseY = y + fontSize * 0.35; // match dy="0.35em" used for text
  const symY = baseY - symH;         // top of symbol

  return (
    <g fill={fill}>
      {/* Dirham symbol as a scaled path in SVG coordinate space */}
      <g transform={`translate(${sx}, ${symY}) scale(${scale})`}>
        <path d={DIRHAM_PATH} />
      </g>
      {/* Number text immediately after the symbol */}
      <text
        x={sx + symW + gap}
        y={baseY}
        textAnchor="start"
        fontSize={fontSize}
        fill={fill}
      >
        {numStr}
      </text>
    </g>
  );
};
