// Chart color palette using Tarawat Brand Colors
export const CHART_COLORS = {
  // Primary Tarawat Green
  primary: "hsl(143, 44%, 22%)",
  primaryLight: "hsl(143, 44%, 32%)",
  primaryDark: "hsl(143, 44%, 15%)",
  
  // Secondary Tarawat Beige
  secondary: "hsl(32, 52%, 80%)",
  secondaryLight: "hsl(32, 52%, 88%)",
  secondaryDark: "hsl(32, 45%, 60%)",
  
  // Functional colors
  success: "hsl(143, 44%, 28%)",
  successLight: "hsl(143, 44%, 38%)",
  
  danger: "hsl(0, 84%, 60%)",
  dangerLight: "hsl(0, 84%, 70%)",
  
  accent: "hsl(32, 52%, 75%)",
  accentLight: "hsl(32, 52%, 85%)",
  
  info: "hsl(143, 35%, 45%)",
  infoLight: "hsl(143, 35%, 55%)",
  
  purple: "hsl(143, 44%, 35%)",
  purpleLight: "hsl(143, 44%, 45%)",
  
  teal: "hsl(143, 50%, 30%)",
  tealLight: "hsl(143, 50%, 40%)",
  
  amber: "hsl(32, 60%, 55%)",
  amberLight: "hsl(32, 60%, 65%)",
  
  // Gradient definitions for charts
  gradients: {
    revenue: { start: "hsl(143, 44%, 22%)", end: "hsl(143, 44%, 40%)" },
    expense: { start: "hsl(0, 84%, 60%)", end: "hsl(0, 84%, 75%)" },
    profit: { start: "hsl(32, 52%, 70%)", end: "hsl(32, 52%, 85%)" },
    accent: { start: "hsl(32, 52%, 75%)", end: "hsl(32, 52%, 90%)" },
    primary: { start: "hsl(143, 44%, 18%)", end: "hsl(143, 44%, 32%)" },
  },
  
  // Aging report colors
  aging: {
    current: "hsl(143, 44%, 28%)",
    days30: "hsl(32, 52%, 65%)",
    days60: "hsl(32, 45%, 50%)",
    days90: "hsl(0, 84%, 60%)",
  },
  
  // Multi-series colors using Tarawat palette
  series: [
    "hsl(143, 44%, 22%)",  // Primary green
    "hsl(32, 52%, 75%)",   // Beige
    "hsl(143, 44%, 35%)",  // Light green
    "hsl(32, 45%, 55%)",   // Dark beige
    "hsl(143, 35%, 50%)",  // Muted green
    "hsl(32, 40%, 45%)",   // Brown-beige
  ],
};

export const formatCurrencyValue = (value: number, currency = "USD") => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
