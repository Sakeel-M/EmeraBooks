import { useState, useMemo, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  DollarSign, Wallet, TrendingUp, TrendingDown, PieChart,
  LayoutGrid, Activity, Search, ArrowUpRight, ArrowDownRight,
  Scale, Banknote, Receipt,
} from "lucide-react";
import { formatCurrencyValue } from "@/lib/chartColors";
import { formatAmount } from "@/lib/utils";
import { CurrencyAxisTick } from "@/components/shared/CurrencyAxisTick";
import { FormattedCurrency } from "@/components/shared/FormattedCurrency";
import { format } from "date-fns";

export type FinancialDetailType =
  | "revenue" | "expenses" | "net-income" | "profit-margin"
  | "assets" | "liabilities" | "equity"
  | "operating" | "investing" | "financing";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  status?: string | null;
  category?: string | null;
  customers?: { name: string } | null;
}

interface Bill {
  id: string;
  bill_number: string;
  bill_date: string;
  total_amount: number;
  status?: string | null;
  category?: string | null;
  vendors?: { name: string } | null;
}

interface PlTxn {
  amount: number;
  resolvedCategory: string;
}

interface FinancialDetailSheetProps {
  open: boolean;
  onClose: () => void;
  type: FinancialDetailType | null;
  invoices: Invoice[];
  bills: Bill[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  profitMargin: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  outstandingReceivables?: number;
  outstandingPayables?: number;
  currency?: string;
  /** Filtered income transactions (same source as totalRevenue) */
  incomeTxns?: PlTxn[];
  /** Filtered expense transactions (same source as totalExpenses) */
  expenseTxns?: PlTxn[];
}

const TYPE_CONFIG: Record<FinancialDetailType, {
  title: string;
  icon: any;
  gradient: string;
  color: string;
  description: string;
}> = {
  revenue: {
    title: "Total Revenue",
    icon: DollarSign,
    gradient: "from-green-500/15 to-transparent",
    color: "text-green-600",
    description: "Income from all invoices",
  },
  expenses: {
    title: "Total Expenses",
    icon: Wallet,
    gradient: "from-red-500/15 to-transparent",
    color: "text-red-500",
    description: "Costs from all bills",
  },
  "net-income": {
    title: "Net Income",
    icon: TrendingUp,
    gradient: "from-blue-500/15 to-transparent",
    color: "text-blue-600",
    description: "Revenue minus expenses",
  },
  "profit-margin": {
    title: "Profit Margin",
    icon: PieChart,
    gradient: "from-amber-500/15 to-transparent",
    color: "text-amber-600",
    description: "Net income as % of revenue",
  },
  assets: {
    title: "Total Assets",
    icon: LayoutGrid,
    gradient: "from-green-500/15 to-transparent",
    color: "text-green-600",
    description: "Cash & Bank + Accounts Receivable (estimated)",
  },
  liabilities: {
    title: "Total Liabilities",
    icon: Scale,
    gradient: "from-red-500/15 to-transparent",
    color: "text-red-500",
    description: "Outstanding bills owed to vendors",
  },
  equity: {
    title: "Equity",
    icon: Banknote,
    gradient: "from-purple-500/15 to-transparent",
    color: "text-purple-600",
    description: "Assets minus liabilities",
  },
  operating: {
    title: "Operating Activities",
    icon: Activity,
    gradient: "from-green-500/15 to-transparent",
    color: "text-green-600",
    description: "Cash from core business operations",
  },
  investing: {
    title: "Investing Activities",
    icon: TrendingUp,
    gradient: "from-blue-500/15 to-transparent",
    color: "text-blue-600",
    description: "Cash from investments",
  },
  financing: {
    title: "Financing Activities",
    icon: Receipt,
    gradient: "from-purple-500/15 to-transparent",
    color: "text-purple-600",
    description: "Cash from financing",
  },
};

function getStatus(type: FinancialDetailType, value: number, margin: number): "Healthy" | "Watch" | "Critical" {
  if (type === "revenue" || type === "operating") return value > 0 ? "Healthy" : "Critical";
  if (type === "expenses" || type === "liabilities") return value > 0 ? "Watch" : "Healthy";
  if (type === "net-income") return value > 0 ? "Healthy" : value === 0 ? "Watch" : "Critical";
  if (type === "profit-margin") return margin >= 20 ? "Healthy" : margin >= 10 ? "Watch" : "Critical";
  if (type === "equity") return value > 0 ? "Healthy" : "Critical";
  return "Watch";
}

const STATUS_COLORS = {
  Healthy: "bg-green-500/10 text-green-600 border-green-500/20",
  Watch: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  Critical: "bg-red-500/10 text-red-600 border-red-500/20",
};

function getReason(
  type: FinancialDetailType,
  totalRevenue: number, totalExpenses: number, netIncome: number, profitMargin: number,
  totalAssets: number, totalLiabilities: number, equity: number,
  incomeTxns: PlTxn[], expenseTxns: PlTxn[],
  currency: string,
): { formula: string; steps: { label: string; value: ReactNode }[]; note?: string } {
  const fc = (v: number) => <FormattedCurrency amount={v} currency={currency} />;
  switch (type) {
    case "revenue":
      return {
        formula: "Σ Income Transactions",
        steps: [
          { label: "Income transactions", value: String(incomeTxns.length) },
          { label: "Avg per transaction", value: fc(incomeTxns.length > 0 ? totalRevenue / incomeTxns.length : 0) },
          { label: "Internal Transfers excluded", value: "Yes" },
          { label: "Total Revenue", value: fc(totalRevenue) },
        ],
        note: "Own-account movements (MOBN, internal transfers, ATM deposits) are excluded — only real business income is counted.",
      };
    case "expenses":
      return {
        formula: "Σ Expense Transactions",
        steps: [
          { label: "Expense transactions", value: String(expenseTxns.length) },
          { label: "Avg per transaction", value: fc(expenseTxns.length > 0 ? totalExpenses / expenseTxns.length : 0) },
          { label: "Internal Transfers excluded", value: "Yes" },
          { label: "Total Expenses", value: fc(totalExpenses) },
        ],
        note: "ATM withdrawals and inter-account transfers are excluded — only real business spending is counted.",
      };
    case "net-income":
      return {
        formula: "Revenue − Expenses",
        steps: [
          { label: "Total Revenue", value: fc(totalRevenue) },
          { label: "minus Total Expenses", value: fc(totalExpenses) },
          { label: "Net Income", value: fc(netIncome) },
          { label: "Profit margin", value: `${profitMargin.toFixed(1)}%` },
        ],
        note: netIncome >= 0 ? "Business is profitable this period." : "Expenses exceed revenue — review spending.",
      };
    case "profit-margin":
      return {
        formula: "Net Income ÷ Revenue × 100",
        steps: [
          { label: "Net Income", value: fc(netIncome) },
          { label: "Total Revenue", value: fc(totalRevenue) },
          { label: "Profit Margin", value: `${profitMargin.toFixed(2)}%` },
        ],
        note: profitMargin >= 20 ? "Healthy margin (>20%)." : profitMargin >= 10 ? "Moderate margin (10–20%)." : "Low margin — consider reducing expenses.",
      };
    case "assets":
      return {
        formula: "Cash & Bank + Receivables",
        steps: [
          { label: "Cash (from Net Income)", value: fc(Math.max(0, netIncome)) },
          { label: "Accounts Receivable", value: fc(totalAssets - Math.max(0, netIncome)) },
          { label: "Total Assets", value: fc(totalAssets) },
        ],
        note: "Estimated from transaction data. Set up Chart of Accounts for precise balance sheet figures.",
      };
    case "liabilities":
      return {
        formula: "Σ Overdue Bills",
        steps: [
          { label: "Only overdue bills", value: "Yes" },
          { label: "Pending/paid bills", value: "Excluded" },
          { label: "Total Payable", value: fc(totalLiabilities) },
        ],
        note: "Bank-synced bills marked 'pending' are already cleared transactions — not real liabilities.",
      };
    case "equity":
      return {
        formula: "Assets − Liabilities",
        steps: [
          { label: "Total Assets", value: fc(totalAssets) },
          { label: "minus Liabilities", value: fc(totalLiabilities) },
          { label: "Equity", value: fc(equity) },
        ],
        note: equity >= 0 ? "Positive equity — business owns more than it owes." : "Negative equity — liabilities exceed assets.",
      };
    default:
      return {
        formula: "From transaction data",
        steps: [{ label: "Value", value: fc(netIncome) }],
      };
  }
}

function getNarrative(
  type: FinancialDetailType, invoices: Invoice[], bills: Bill[],
  totalRevenue: number, totalExpenses: number, netIncome: number, profitMargin: number,
  currency: string = "USD", totalAssets: number = 0,
  outstandingReceivables: number = 0, outstandingPayables: number = 0
): string {
  const paidInvoices = invoices.filter(i => i.status === "paid");
  const paidBills = bills.filter(b => b.status === "paid");
  const fmt = (v: number) => formatAmount(v, currency);

  switch (type) {
    case "revenue":
      return `You earned ${fmt(totalRevenue)} from ${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} in this period. ${paidInvoices.length} invoice${paidInvoices.length !== 1 ? "s" : ""} ${paidInvoices.length !== 1 ? "have" : "has"} been paid.`;
    case "expenses":
      return `You spent ${fmt(totalExpenses)} across ${bills.length} bill${bills.length !== 1 ? "s" : ""} in this period. ${paidBills.length} bill${paidBills.length !== 1 ? "s" : ""} ${paidBills.length !== 1 ? "have" : "has"} been paid.`;
    case "net-income":
      return `Your profit after expenses is ${fmt(netIncome)} (${profitMargin.toFixed(1)}% margin). ${netIncome >= 0 ? "The business is profitable this period." : "Expenses exceed revenue this period."}`;
    case "profit-margin":
      return `For every unit of revenue, you keep ${(profitMargin / 100).toFixed(2)}. A ${profitMargin >= 20 ? "healthy" : profitMargin >= 10 ? "moderate" : "low"} profit margin of ${profitMargin.toFixed(1)}%.`;
    case "assets":
      return `Total assets of ${fmt(totalAssets)} are estimated from transaction data. Cash & Bank: ${fmt(Math.max(0, netIncome))} (from net income). Accounts Receivable: ${fmt(outstandingReceivables)}. Set up Chart of Accounts for precise figures.`;
    case "liabilities":
      return outstandingPayables > 0
        ? `You owe ${fmt(outstandingPayables)} in outstanding bills to vendors. All unpaid bills are recorded as accounts payable.`
        : `No outstanding bills at this time. All vendor invoices are settled.`;
    case "equity":
      return `Net worth equals assets minus liabilities (${fmt(totalAssets)} − ${fmt(outstandingPayables)} = ${fmt(totalAssets - outstandingPayables)}). A positive equity indicates the business owns more than it owes.`;
    case "operating":
      return `Cash generated from core business activities. Based on ${paidInvoices.length} paid invoice${paidInvoices.length !== 1 ? "s" : ""} received in this period.`;
    default:
      return "No data available for this period.";
  }
}

function MonthlyMiniChart({ data, color, currency = "USD" }: { data: { month: string; value: number }[]; color: string; currency?: string }) {
  if (!data.length) return <p className="text-sm text-muted-foreground text-center py-8">No monthly data available.</p>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={<CurrencyAxisTick currency={currency} anchor="end" fontSize={10} />} />
        <Tooltip
          content={({ active, payload, label }) => active && payload?.length ? (
            <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-bold text-foreground"><FormattedCurrency amount={payload[0].value as number} currency={currency} /></p>
            </div>
          ) : null}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={600}>
          {data.map((_, idx) => <Cell key={idx} fill={color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function MetricKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-center p-3 rounded-lg bg-muted/40 border border-border/50">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-base font-bold text-foreground">{value}</p>
    </div>
  );
}

export function FinancialDetailSheet({
  open, onClose, type, invoices, bills,
  totalRevenue, totalExpenses, netIncome, profitMargin,
  totalAssets, totalLiabilities, equity,
  outstandingReceivables = 0, outstandingPayables = 0,
  currency = "USD",
  incomeTxns, expenseTxns,
}: FinancialDetailSheetProps) {
  const [search, setSearch] = useState("");

  const config = type ? TYPE_CONFIG[type] : null;
  const Icon = config?.icon || DollarSign;

  // Main value display
  const displayValue = useMemo((): ReactNode => {
    if (!type) return null;
    const fc = (v: number) => <FormattedCurrency amount={v} currency={currency} />;
    switch (type) {
      case "revenue": return fc(totalRevenue);
      case "expenses": return fc(totalExpenses);
      case "net-income": return fc(netIncome);
      case "profit-margin": return `${profitMargin.toFixed(1)}%`;
      case "assets": return fc(totalAssets);
      case "liabilities": return fc(totalLiabilities);
      case "equity": return fc(equity);
      case "operating": return fc(netIncome);
      case "investing": return fc(0);
      case "financing": return fc(0);
    }
  }, [type, totalRevenue, totalExpenses, netIncome, profitMargin, totalAssets, totalLiabilities, equity, currency]);

  const status = type ? getStatus(type, netIncome, profitMargin) : "Watch";

  // Transactions to show
  const { transactionList, isInvoice } = useMemo(() => {
    if (!type) return { transactionList: [], isInvoice: true };
    const showBoth = type === "net-income" || type === "profit-margin";
    const showInvoices = ["revenue", "assets", "operating", "net-income", "profit-margin"].includes(type);
    const showBills = ["expenses", "liabilities", "net-income", "profit-margin"].includes(type);

    if (type === "assets") {
      // Show all income invoices — these are the transactions that make up the cash & bank position
      return { transactionList: [...invoices].sort((a, b) => Number(b.total_amount) - Number(a.total_amount)), isInvoice: true };
    }
    if (type === "liabilities") {
      // Only overdue bills are genuine outstanding payables (bank-synced "pending" bills are already cleared)
      return { transactionList: bills.filter(b => b.status === "overdue").sort((a, b) => b.total_amount - a.total_amount), isInvoice: false };
    }
    if (type === "operating") {
      return { transactionList: invoices.filter(i => i.status === "paid").sort((a, b) => b.total_amount - a.total_amount), isInvoice: true };
    }
    if (showBoth) {
      // Mix both
      const mixed = [
        ...invoices.map(i => ({ ...i, _type: "invoice" as const })),
        ...bills.map(b => ({ ...b, bill_date: b.bill_date, invoice_date: b.bill_date, invoice_number: b.bill_number, customers: null, _type: "bill" as const })),
      ].sort((a, b) => Number(b.total_amount) - Number(a.total_amount));
      return { transactionList: mixed as any[], isInvoice: false };
    }
    if (showInvoices) return { transactionList: [...invoices].sort((a, b) => b.total_amount - a.total_amount), isInvoice: true };
    return { transactionList: [...bills].sort((a, b) => b.total_amount - a.total_amount), isInvoice: false };
  }, [type, invoices, bills]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (!search) return transactionList;
    const q = search.toLowerCase();
    return transactionList.filter((item: any) => {
      const name = item._type === "bill"
        ? (item.vendors as any)?.name || ""
        : (item.customers as any)?.name || "";
      const num = item.invoice_number || item.bill_number || "";
      return name.toLowerCase().includes(q) || num.toLowerCase().includes(q);
    });
  }, [transactionList, search]);

  // Breakdown by category — uses filtered P&L transaction data when available
  // so percentages/totals match the headline figures exactly.
  const categoryBreakdown = useMemo(() => {
    if (!type) return [];
    const isExpenseType = ["expenses", "liabilities"].includes(type);

    // Prefer the pre-filtered transaction arrays passed from Financials.tsx
    const txnSource = isExpenseType ? expenseTxns : incomeTxns;
    if (txnSource && txnSource.length > 0) {
      const groups: Record<string, number> = {};
      txnSource.forEach((t) => {
        const cat = t.resolvedCategory || "Other";
        groups[cat] = (groups[cat] || 0) + Math.abs(Number(t.amount || 0));
      });
      const total = Object.values(groups).reduce((s, v) => s + v, 0);
      return Object.entries(groups)
        .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);
    }

    // Fallback: use invoices/bills table data
    const source = isExpenseType ? bills : invoices;
    const groups: Record<string, number> = {};
    source.forEach((item: any) => {
      const cat = item.category || "Uncategorized";
      groups[cat] = (groups[cat] || 0) + Number(item.total_amount || 0);
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0);
    return Object.entries(groups)
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [type, invoices, bills, incomeTxns, expenseTxns]);

  // Monthly mini-chart data
  const miniChartData = useMemo(() => {
    if (!type) return [];
    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const months: Record<string, number> = {};

    const addItems = (items: any[], dateKey: string) => {
      items.forEach(item => {
        const key = format(new Date(item[dateKey]), "MMM");
        months[key] = (months[key] || 0) + Number(item.total_amount || 0);
      });
    };

    if (["expenses", "liabilities"].includes(type)) addItems(bills, "bill_date");
    else if (type === "net-income" || type === "profit-margin") {
      addItems(invoices, "invoice_date");
      Object.keys(months).forEach(k => { months[k] = 0; });
      invoices.forEach(inv => {
        const key = format(new Date(inv.invoice_date), "MMM");
        months[key] = (months[key] || 0) + Number(inv.total_amount || 0);
      });
      bills.forEach(bill => {
        const key = format(new Date(bill.bill_date), "MMM");
        months[key] = (months[key] || 0) - Number(bill.total_amount || 0);
      });
    } else addItems(invoices, "invoice_date");

    return Object.entries(months)
      .map(([month, value]) => ({ month, value: Math.max(value, 0) }))
      .sort((a, b) => monthOrder.indexOf(a.month) - monthOrder.indexOf(b.month));
  }, [type, invoices, bills]);

  // Summary KPIs
  const kpis = useMemo(() => {
    if (!type) return [];
    const fc = (v: number) => <FormattedCurrency amount={v} currency={currency} />;
    switch (type) {
      case "revenue": return [
        { label: "Invoices", value: String(invoices.length) },
        { label: "Average", value: fc(invoices.length > 0 ? totalRevenue / invoices.length : 0) },
        { label: "Largest", value: fc(Math.max(...invoices.map(i => Number(i.total_amount || 0)), 0)) },
        { label: "Paid", value: String(invoices.filter(i => i.status === "paid").length) },
      ];
      case "expenses": return [
        { label: "Bills", value: String(bills.length) },
        { label: "Average", value: fc(bills.length > 0 ? totalExpenses / bills.length : 0) },
        { label: "Largest", value: fc(Math.max(...bills.map(b => Number(b.total_amount || 0)), 0)) },
        { label: "Paid", value: String(bills.filter(b => b.status === "paid").length) },
      ];
      case "net-income": return [
        { label: "Revenue", value: fc(totalRevenue) },
        { label: "Expenses", value: fc(totalExpenses) },
        { label: "Margin", value: `${profitMargin.toFixed(1)}%` },
        { label: "Status", value: netIncome >= 0 ? "Profitable" : "Loss" },
      ];
      case "profit-margin": return [
        { label: "Margin", value: `${profitMargin.toFixed(1)}%` },
        { label: "Per unit revenue", value: `${(profitMargin / 100).toFixed(2)}` },
        { label: "Revenue", value: fc(totalRevenue) },
        { label: "Net Income", value: fc(netIncome) },
      ];
      case "assets": return [
        { label: "Cash & Bank", value: fc(Math.max(0, netIncome)) },
        { label: "Accounts Receivable", value: fc(outstandingReceivables) },
        { label: "Total Assets", value: fc(totalAssets) },
        { label: "Basis", value: netIncome >= 0 ? "Net Profit" : "Receivables Only" },
      ];
      case "liabilities": return [
        { label: "Accounts Payable", value: fc(outstandingPayables) },
        { label: "Total Liabilities", value: fc(totalLiabilities) },
        { label: "Overdue Bills", value: String(bills.filter(b => b.status === "overdue").length) },
        { label: "Status", value: outstandingPayables === 0 ? "Settled" : "Outstanding" },
      ];
      case "equity": return [
        { label: "Assets", value: fc(totalAssets) },
        { label: "Liabilities", value: fc(totalLiabilities) },
        { label: "Equity", value: fc(equity) },
        { label: "Status", value: equity >= 0 ? "Positive" : "Negative" },
      ];
      default: return [
        { label: "Amount", value: fc(netIncome) },
      ];
    }
  }, [type, invoices, bills, totalRevenue, totalExpenses, netIncome, profitMargin, totalAssets, totalLiabilities, equity, outstandingReceivables, outstandingPayables, currency]);

  const chartColor = type === "expenses" || type === "liabilities" ? "hsl(0,84%,60%)" :
    type === "equity" || type === "financing" ? "hsl(143,44%,35%)" :
    type === "profit-margin" ? "hsl(32,60%,55%)" :
    "hsl(143,44%,28%)";

  if (!type || !config) return null;

  const narrative = getNarrative(type, invoices, bills, totalRevenue, totalExpenses, netIncome, profitMargin, currency, totalAssets, outstandingReceivables, outstandingPayables);
  const reason = getReason(type, totalRevenue, totalExpenses, netIncome, profitMargin, totalAssets, totalLiabilities, equity, incomeTxns || [], expenseTxns || [], currency);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-2xl overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className={`bg-gradient-to-r ${config.gradient} p-6 border-b border-border`}>
          <SheetHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-background/80 border border-border/60 shadow-sm">
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div>
                  <SheetTitle className="text-lg font-bold">{config.title}</SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
                </div>
              </div>
              <Badge className={`text-xs border ${STATUS_COLORS[status]}`} variant="outline">{status}</Badge>
            </div>
            <div className={`text-3xl font-extrabold mt-3 ${config.color}`}>{displayValue}</div>
          </SheetHeader>
        </div>

        {/* Body — left reason sidebar + right tabs */}
        <div className="flex-1 overflow-hidden flex">

          {/* Left Reason Sidebar */}
          <div className="w-44 shrink-0 border-r border-border bg-muted/20 flex flex-col overflow-y-auto p-3 gap-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">How calculated</p>

            {/* Formula badge */}
            <div className={`px-2 py-1.5 rounded-md bg-background border border-border text-xs font-mono font-semibold ${config.color} text-center leading-snug`}>
              {reason.formula}
            </div>

            {/* Step-by-step */}
            <div className="space-y-2">
              {reason.steps.map((step, i) => (
                <div key={i} className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground leading-none">{step.label}</p>
                  <p className="text-xs font-semibold text-foreground truncate">{step.value}</p>
                  {i < reason.steps.length - 1 && (
                    <div className="border-b border-dashed border-border/60 pt-1" />
                  )}
                </div>
              ))}
            </div>

            {/* Final result highlight */}
            <div className={`mt-auto rounded-md px-2 py-2 border text-center ${
              type === "expenses" || type === "liabilities" ? "bg-red-500/5 border-red-500/20" :
              type === "equity" || type === "profit-margin" ? "bg-purple-500/5 border-purple-500/20" :
              "bg-green-500/5 border-green-500/20"
            }`}>
              <p className="text-[10px] text-muted-foreground mb-0.5">Result</p>
              <p className={`text-sm font-extrabold ${config.color}`}>{displayValue}</p>
            </div>

            {/* Note */}
            {reason.note && (
              <p className="text-[10px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
                {reason.note}
              </p>
            )}
          </div>

          {/* Right: Tabs */}
          <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs defaultValue="summary" className="h-full flex flex-col">
            <TabsList className="mx-6 mt-4 grid grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            {/* Summary Tab */}
            <TabsContent value="summary" className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-5">
              {/* Narrative */}
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50 leading-relaxed">
                {narrative}
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3">
                {kpis.map((kpi, i) => <MetricKpi key={i} label={kpi.label} value={kpi.value} />)}
              </div>

              {/* Mini chart */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Monthly Distribution</p>
                <MonthlyMiniChart data={miniChartData} color={chartColor} currency={currency} />
              </div>
            </TabsContent>

            {/* Breakdown Tab */}
            <TabsContent value="breakdown" className="flex-1 overflow-auto px-6 pb-6 pt-4 space-y-4">
              {type === "assets" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Estimated balance sheet assets</p>
                  {[
                    { label: "Cash & Bank (Estimated)", value: Math.max(0, netIncome), color: "bg-green-500" },
                    { label: "Accounts Receivable", value: outstandingReceivables, color: "bg-blue-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold text-green-600"><FormattedCurrency amount={item.value} currency={currency} /></span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 border-green-500/40 bg-green-50/20 dark:bg-green-950/10">
                    <span className="text-sm font-bold text-foreground">Total Assets</span>
                    <span className="text-sm font-bold text-green-600"><FormattedCurrency amount={totalAssets} currency={currency} /></span>
                  </div>
                  <p className="text-xs text-muted-foreground">* Estimated from transaction data. Set up Chart of Accounts for actuals.</p>
                </div>
              ) : type === "liabilities" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Outstanding amounts owed to vendors</p>
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                      <span className="text-sm font-medium text-foreground">Accounts Payable (Unpaid Bills)</span>
                    </div>
                    <span className="text-sm font-bold text-destructive"><FormattedCurrency amount={outstandingPayables} currency={currency} /></span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 border-red-500/40 bg-red-50/20 dark:bg-red-950/10">
                    <span className="text-sm font-bold text-foreground">Total Liabilities</span>
                    <span className="text-sm font-bold text-destructive"><FormattedCurrency amount={totalLiabilities} currency={currency} /></span>
                  </div>
                  {outstandingPayables === 0 && (
                    <p className="text-xs text-muted-foreground">All vendor bills are currently settled.</p>
                  )}
                </div>
              ) : type === "equity" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">Net worth = Assets − Liabilities</p>
                  {[
                    { label: "Total Assets", value: totalAssets, color: "bg-green-500" },
                    { label: "Total Liabilities", value: totalLiabilities, color: "bg-red-500" },
                    { label: "Equity", value: equity, color: "bg-purple-500" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold text-foreground"><FormattedCurrency amount={item.value} currency={currency} /></span>
                    </div>
                  ))}
                </div>
              ) : categoryBreakdown.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">No category data available.</div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Top Categories by Amount</p>
                  {categoryBreakdown.map((cat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm text-foreground font-medium truncate min-w-0">{cat.name}</span>
                        <div className="text-right shrink-0 whitespace-nowrap">
                          <span className="text-sm font-bold text-foreground"><FormattedCurrency amount={cat.value} currency={currency} /></span>
                          <span className="text-xs text-muted-foreground ml-2">{cat.pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${cat.pct}%`, backgroundColor: chartColor }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="flex-1 overflow-hidden px-6 pb-6 pt-4 flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or number…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <ScrollArea className="flex-1 -mx-1 px-1">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No transactions found.</div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredTransactions.map((item: any, idx: number) => {
                      const isBill = item._type === "bill" || (!item.invoice_number && item.bill_number);
                      const name = isBill
                        ? (item.vendors as any)?.name || "Unknown Vendor"
                        : (item.customers as any)?.name || "Unknown Customer";
                      const num = item.invoice_number || item.bill_number || "";
                      const date = item.invoice_date || item.bill_date || "";
                      const amount = Number(item.total_amount || 0);
                      const statusVal = item.status || "draft";
                      return (
                        <div key={idx} className="grid grid-cols-[1fr_auto] gap-x-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 border border-border/40 transition-colors">
                          <div className="overflow-hidden">
                            <p className="text-sm font-medium text-foreground truncate">{name}</p>
                            <p className="text-xs text-muted-foreground truncate">{num} · {date ? format(new Date(date), "MMM d, yyyy") : "—"}</p>
                          </div>
                          <div className="text-right whitespace-nowrap self-center">
                            <p className={`text-sm font-bold ${isBill ? "text-red-500" : "text-green-600"}`}>
                              {isBill ? "-" : "+"}<FormattedCurrency amount={amount} currency={currency} />
                            </p>
                            <span className={`text-xs capitalize px-1.5 py-0.5 rounded-full ${
                              statusVal === "paid" ? "bg-green-500/10 text-green-600" :
                              statusVal === "overdue" ? "bg-red-500/10 text-red-500" :
                              "bg-muted text-muted-foreground"
                            }`}>{statusVal}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
          </div>{/* right tabs */}
        </div>{/* body flex */}
      </SheetContent>
    </Sheet>
  );
}
