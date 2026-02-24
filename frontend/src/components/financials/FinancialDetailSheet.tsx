import { useState, useMemo } from "react";
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
import { formatCompactCurrency } from "@/lib/utils";
import { formatAmount } from "@/lib/utils";
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
  const tickFmt = (v: number) => formatCompactCurrency(v, currency);
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} tickFormatter={tickFmt} />
        <Tooltip
          content={({ active, payload, label }) => active && payload?.length ? (
            <div className="bg-popover border border-border rounded-lg shadow-lg p-2">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-sm font-bold text-foreground">{formatAmount(payload[0].value as number, currency)}</p>
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

function MetricKpi({ label, value }: { label: string; value: string }) {
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
}: FinancialDetailSheetProps) {
  const [search, setSearch] = useState("");

  const config = type ? TYPE_CONFIG[type] : null;
  const Icon = config?.icon || DollarSign;

  // Main value display
  const displayValue = useMemo(() => {
    if (!type) return "";
    switch (type) {
      case "revenue": return formatCurrencyValue(totalRevenue, currency);
      case "expenses": return formatCurrencyValue(totalExpenses, currency);
      case "net-income": return formatCurrencyValue(netIncome, currency);
      case "profit-margin": return `${profitMargin.toFixed(1)}%`;
      case "assets": return formatCurrencyValue(totalAssets, currency);
      case "liabilities": return formatCurrencyValue(totalLiabilities, currency);
      case "equity": return formatCurrencyValue(equity, currency);
      case "operating": return formatCurrencyValue(netIncome, currency);
      case "investing": return formatCurrencyValue(0, currency);
      case "financing": return formatCurrencyValue(0, currency);
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

  // Breakdown by category
  const categoryBreakdown = useMemo(() => {
    if (!type) return [];
    const source = ["expenses", "liabilities"].includes(type) ? bills : invoices;
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
  }, [type, invoices, bills]);

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
    switch (type) {
      case "revenue": return [
        { label: "Invoices", value: String(invoices.length) },
        { label: "Average", value: formatCurrencyValue(invoices.length > 0 ? totalRevenue / invoices.length : 0, currency) },
        { label: "Largest", value: formatCurrencyValue(Math.max(...invoices.map(i => Number(i.total_amount || 0)), 0), currency) },
        { label: "Paid", value: String(invoices.filter(i => i.status === "paid").length) },
      ];
      case "expenses": return [
        { label: "Bills", value: String(bills.length) },
        { label: "Average", value: formatCurrencyValue(bills.length > 0 ? totalExpenses / bills.length : 0, currency) },
        { label: "Largest", value: formatCurrencyValue(Math.max(...bills.map(b => Number(b.total_amount || 0)), 0), currency) },
        { label: "Paid", value: String(bills.filter(b => b.status === "paid").length) },
      ];
      case "net-income": return [
        { label: "Revenue", value: formatCurrencyValue(totalRevenue, currency) },
        { label: "Expenses", value: formatCurrencyValue(totalExpenses, currency) },
        { label: "Margin", value: `${profitMargin.toFixed(1)}%` },
        { label: "Status", value: netIncome >= 0 ? "Profitable" : "Loss" },
      ];
      case "profit-margin": return [
        { label: "Margin", value: `${profitMargin.toFixed(1)}%` },
        { label: "Per unit revenue", value: `${(profitMargin / 100).toFixed(2)}` },
        { label: "Revenue", value: formatCurrencyValue(totalRevenue, currency) },
        { label: "Net Income", value: formatCurrencyValue(netIncome, currency) },
      ];
      case "assets": return [
        { label: "Cash & Bank", value: formatCurrencyValue(Math.max(0, netIncome), currency) },
        { label: "Accounts Receivable", value: formatCurrencyValue(outstandingReceivables, currency) },
        { label: "Total Assets", value: formatCurrencyValue(totalAssets, currency) },
        { label: "Basis", value: netIncome >= 0 ? "Net Profit" : "Receivables Only" },
      ];
      case "liabilities": return [
        { label: "Accounts Payable", value: formatCurrencyValue(outstandingPayables, currency) },
        { label: "Total Liabilities", value: formatCurrencyValue(totalLiabilities, currency) },
        { label: "Overdue Bills", value: String(bills.filter(b => b.status === "overdue").length) },
        { label: "Status", value: outstandingPayables === 0 ? "Settled" : "Outstanding" },
      ];
      case "equity": return [
        { label: "Assets", value: formatCurrencyValue(totalAssets, currency) },
        { label: "Liabilities", value: formatCurrencyValue(totalLiabilities, currency) },
        { label: "Equity", value: formatCurrencyValue(equity, currency) },
        { label: "Status", value: equity >= 0 ? "Positive" : "Negative" },
      ];
      default: return [
        { label: "Amount", value: formatCurrencyValue(netIncome, currency) },
      ];
    }
  }, [type, invoices, bills, totalRevenue, totalExpenses, netIncome, profitMargin, totalAssets, totalLiabilities, equity, outstandingReceivables, outstandingPayables, currency]);

  const chartColor = type === "expenses" || type === "liabilities" ? "hsl(0,84%,60%)" :
    type === "equity" || type === "financing" ? "hsl(143,44%,35%)" :
    type === "profit-margin" ? "hsl(32,60%,55%)" :
    "hsl(143,44%,28%)";

  if (!type || !config) return null;

  const narrative = getNarrative(type, invoices, bills, totalRevenue, totalExpenses, netIncome, profitMargin, currency, totalAssets, outstandingReceivables, outstandingPayables);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-xl overflow-hidden flex flex-col p-0">
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

        {/* Body */}
        <div className="flex-1 overflow-hidden">
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
                      <span className="text-sm font-bold text-green-600">{formatCurrencyValue(item.value, currency)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 border-green-500/40 bg-green-50/20 dark:bg-green-950/10">
                    <span className="text-sm font-bold text-foreground">Total Assets</span>
                    <span className="text-sm font-bold text-green-600">{formatCurrencyValue(totalAssets, currency)}</span>
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
                    <span className="text-sm font-bold text-destructive">{formatCurrencyValue(outstandingPayables, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border-2 border-red-500/40 bg-red-50/20 dark:bg-red-950/10">
                    <span className="text-sm font-bold text-foreground">Total Liabilities</span>
                    <span className="text-sm font-bold text-destructive">{formatCurrencyValue(totalLiabilities, currency)}</span>
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
                      <span className="text-sm font-bold text-foreground">{formatCurrencyValue(item.value, currency)}</span>
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
                          <span className="text-sm font-bold text-foreground">{formatCurrencyValue(cat.value, currency)}</span>
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
                              {isBill ? "-" : "+"}{formatCurrencyValue(amount, currency)}
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
