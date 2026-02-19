import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadialGauge } from "@/components/charts/RadialGauge";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Scale,
  Percent,
  DollarSign,
  BookOpen,
  BarChart3,
  Lightbulb,
} from "lucide-react";

interface RatioData {
  label: string;
  value: number;
  maxValue: number;
  suffix: string;
  colorClass: string;
  isAvailable: boolean;
}

interface RatioDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ratio: RatioData | null;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
}

const fmt = (n: number, decimals = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

type StatusLevel = "green" | "amber" | "red";

interface RatioMeta {
  icon: React.ElementType;
  definition: string;
  formula: string;
  getCalcSteps: (v: number, revenue: number, expenses: number, netIncome: number, assets: number, liabilities: number, equity: number) => string[];
  getStatus: (v: number) => StatusLevel;
  benchmarks: { label: string; range: string; color: string }[];
  benchmarkMin: number;
  benchmarkMax: number;
  amberThreshold: number;
  greenThreshold: number;
  higherIsBetter: boolean;
  peerContext: string;
  advice: Record<StatusLevel, string[]>;
}

const RATIO_META: Record<string, RatioMeta> = {
  "Profit Margin": {
    icon: Percent,
    definition:
      "Profit Margin shows what percentage of each dollar of revenue is kept as profit after all expenses. A higher margin means your business retains more earnings per sale.",
    formula: "Net Income ÷ Total Revenue × 100",
    getCalcSteps: (v, revenue, _e, netIncome) => [
      `Net Income: ${fmtCurrency(netIncome)}`,
      `Total Revenue: ${fmtCurrency(revenue)}`,
      `${fmtCurrency(netIncome)} ÷ ${fmtCurrency(revenue)} × 100 = ${fmt(v)}%`,
    ],
    getStatus: (v) => (v >= 20 ? "green" : v >= 10 ? "amber" : "red"),
    benchmarks: [
      { label: "Below Target", range: "< 10%", color: "bg-red-500" },
      { label: "Acceptable", range: "10% – 20%", color: "bg-amber-500" },
      { label: "Healthy", range: "> 20%", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 50,
    amberThreshold: 10,
    greenThreshold: 20,
    higherIsBetter: true,
    peerContext: "Top 25% of service businesses maintain a Profit Margin above 30%.",
    advice: {
      green: [
        "Maintain your current cost discipline — it's clearly working.",
        "Consider reinvesting surplus profits into growth initiatives (marketing, talent, R&D).",
        "Review your pricing model periodically to ensure margins hold as revenue scales.",
        "Build a cash reserve of 3–6 months operating expenses as a safety buffer.",
      ],
      amber: [
        "Audit your largest expense categories — look for items you can trim 10–15%.",
        "Review your pricing — even a 5% price increase on top products can lift margins significantly.",
        "Identify unprofitable clients or projects that consume resources without matching returns.",
        "Renegotiate supplier contracts to reduce COGS where possible.",
      ],
      red: [
        "Urgent: conduct a full cost audit — identify and eliminate any non-essential spending immediately.",
        "Reassess your pricing strategy — you may be undercharging for the value you deliver.",
        "Pause or reduce low-ROI marketing spend and focus resources on your highest-margin offerings.",
        "Consider whether there are structural inefficiencies (processes, headcount) that need addressing.",
      ],
    },
  },
  "Current Ratio": {
    icon: Scale,
    definition:
      "The Current Ratio measures your ability to pay short-term obligations using short-term assets. A ratio above 1.0 means you have more assets than liabilities due soon.",
    formula: "Current Assets ÷ Current Liabilities",
    getCalcSteps: (v, _r, _e, _n, assets, liabilities) => [
      `Current Assets (unpaid receivables): ${fmtCurrency(assets)}`,
      `Current Liabilities (unpaid payables): ${fmtCurrency(liabilities)}`,
      `${fmtCurrency(assets)} ÷ ${fmtCurrency(liabilities)} = ${fmt(v)}x`,
    ],
    getStatus: (v) => (v >= 1.5 ? "green" : v >= 1.0 ? "amber" : "red"),
    benchmarks: [
      { label: "At Risk", range: "< 1.0x", color: "bg-red-500" },
      { label: "Acceptable", range: "1.0x – 1.5x", color: "bg-amber-500" },
      { label: "Healthy", range: "> 1.5x", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 4,
    amberThreshold: 1.0,
    greenThreshold: 1.5,
    higherIsBetter: true,
    peerContext: "Financially stable businesses typically maintain a Current Ratio between 1.5x and 3.0x.",
    advice: {
      green: [
        "Your liquidity position is strong — you can comfortably meet short-term obligations.",
        "Consider putting excess liquid assets to work rather than leaving them idle.",
        "Keep monitoring the ratio quarterly to catch any deterioration early.",
        "Use your strong liquidity position as leverage in supplier negotiations for better payment terms.",
      ],
      amber: [
        "Accelerate invoice collection — follow up on outstanding receivables weekly.",
        "Extend payment terms with suppliers where possible to give yourself more breathing room.",
        "Avoid taking on large short-term liabilities until the ratio improves above 1.5x.",
        "Consider a short-term revolving credit facility as a liquidity backstop.",
      ],
      red: [
        "Immediate action required: your short-term liabilities exceed your short-term assets.",
        "Prioritize collecting outstanding invoices urgently — escalate overdue accounts to collections.",
        "Defer any non-critical purchases or investments until liquidity improves.",
        "Speak to your bank about a working capital line of credit to bridge the gap.",
      ],
    },
  },
  "Quick Ratio": {
    icon: Activity,
    definition:
      "The Quick Ratio (Acid Test) measures immediate liquidity — how well you can cover current liabilities using only the most liquid assets (cash & receivables), excluding inventory.",
    formula: "(Current Assets − Inventory) ÷ Current Liabilities",
    getCalcSteps: (v, _r, _e, _n, assets, liabilities) => [
      `Liquid Assets (receivables, ~90% of current assets): ${fmtCurrency(assets * 0.9)}`,
      `Current Liabilities: ${fmtCurrency(liabilities)}`,
      `${fmtCurrency(assets * 0.9)} ÷ ${fmtCurrency(liabilities)} = ${fmt(v)}x`,
    ],
    getStatus: (v) => (v >= 1.0 ? "green" : v >= 0.5 ? "amber" : "red"),
    benchmarks: [
      { label: "Critical", range: "< 0.5x", color: "bg-red-500" },
      { label: "Acceptable", range: "0.5x – 1.0x", color: "bg-amber-500" },
      { label: "Healthy", range: "> 1.0x", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 3,
    amberThreshold: 0.5,
    greenThreshold: 1.0,
    higherIsBetter: true,
    peerContext: "A Quick Ratio above 1.0x is ideal. Service businesses with strong AR collection average 1.2–1.8x.",
    advice: {
      green: [
        "Your cash position is excellent — you can absorb unexpected expenses without distress.",
        "Maintain a formal AR aging review process to keep receivables current.",
        "Document your liquidity management process to institutionalize good habits.",
        "Consider a short-term investment vehicle for excess cash to earn a return while keeping it accessible.",
      ],
      amber: [
        "Review accounts receivable aging — chase invoices older than 30 days proactively.",
        "Tighten payment terms for new customers (e.g., require 50% upfront for large projects).",
        "Build a small cash buffer to reduce reliance on receivables for meeting obligations.",
        "Assess whether any non-essential current assets can be converted to cash.",
      ],
      red: [
        "Seek a business line of credit immediately to cover potential short-term cash gaps.",
        "Implement stricter upfront payment policies — consider requiring deposits on all new work.",
        "Aggressively collect all overdue invoices — consider offering early payment discounts.",
        "Reduce operational expenses to lower the current liabilities denominator.",
      ],
    },
  },
  "Debt to Equity": {
    icon: TrendingDown,
    definition:
      "Debt-to-Equity shows how much of your business is financed by debt versus owner equity. Lower values indicate a financially conservative, less leveraged business.",
    formula: "Total Liabilities ÷ Total Equity",
    getCalcSteps: (v, _r, _e, _n, _a, liabilities, equity) => [
      `Total Liabilities: ${fmtCurrency(liabilities)}`,
      `Total Equity: ${fmtCurrency(equity)}`,
      `${fmtCurrency(liabilities)} ÷ ${fmtCurrency(equity)} = ${fmt(v)}x`,
    ],
    getStatus: (v) => (v <= 0.5 ? "green" : v <= 1.0 ? "amber" : "red"),
    benchmarks: [
      { label: "High Risk", range: "> 2.0x", color: "bg-red-500" },
      { label: "Moderate", range: "0.5x – 2.0x", color: "bg-amber-500" },
      { label: "Conservative", range: "< 0.5x", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 3,
    amberThreshold: 0.5,
    greenThreshold: 0,
    higherIsBetter: false,
    peerContext: "D/E below 1.0x is generally considered safe. Capital-light service businesses often operate near 0.",
    advice: {
      green: [
        "Your low leverage means you have capacity to take on strategic debt if needed for growth.",
        "A D/E near zero shows strong financial health — this is a positive signal to investors and lenders.",
        "Consider whether selective debt financing could accelerate returns on equity.",
        "Keep managing the business conservatively — this resilience is a competitive advantage.",
      ],
      amber: [
        "Review the terms and interest rates on your current debt obligations.",
        "Prioritize paying down the highest-interest liabilities first (debt avalanche method).",
        "Avoid taking on additional debt until you've reduced leverage below 1.0x.",
        "Explore refinancing options if any existing debt carries above-market rates.",
      ],
      red: [
        "High leverage significantly increases financial risk — prioritize debt reduction immediately.",
        "Halt new borrowing unless absolutely necessary for business continuity.",
        "Engage your lenders proactively — restructuring options may be available.",
        "Focus on maximizing profitability to build equity and reduce the D/E ratio organically.",
      ],
    },
  },
  ROA: {
    icon: TrendingUp,
    definition:
      "Return on Assets (ROA) measures how efficiently your business generates profit from its assets. A higher ROA means each dollar of assets produces more profit.",
    formula: "Net Income ÷ Total Assets × 100",
    getCalcSteps: (v, _r, _e, netIncome, assets) => [
      `Net Income: ${fmtCurrency(netIncome)}`,
      `Total Assets: ${fmtCurrency(assets)}`,
      `${fmtCurrency(netIncome)} ÷ ${fmtCurrency(assets)} × 100 = ${fmt(v)}%`,
    ],
    getStatus: (v) => (v >= 10 ? "green" : v >= 5 ? "amber" : "red"),
    benchmarks: [
      { label: "Below Average", range: "< 5%", color: "bg-red-500" },
      { label: "Average", range: "5% – 10%", color: "bg-amber-500" },
      { label: "Strong", range: "> 10%", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 30,
    amberThreshold: 5,
    greenThreshold: 10,
    higherIsBetter: true,
    peerContext: "Top-performing service companies often achieve ROA of 15–25% due to low asset intensity.",
    advice: {
      green: [
        "Your assets are generating strong returns — this is a sign of efficient operations.",
        "Identify which assets contribute most to profitability and protect/expand them.",
        "Reinvest profits strategically into assets that have proven high returns.",
        "Use your strong ROA as a metric to benchmark new investment decisions against.",
      ],
      amber: [
        "Conduct an asset utilization audit — identify underperforming or idle assets.",
        "Consider whether any low-ROI assets could be sold or repurposed.",
        "Focus on increasing net income through better pricing or cost reduction.",
        "Review whether investment in automation or technology could improve output per asset dollar.",
      ],
      red: [
        "Review whether your asset base is appropriately sized for your revenue level.",
        "Consider divesting non-core assets that consume capital without generating returns.",
        "Prioritize profitability improvements — every dollar of additional net income directly lifts ROA.",
        "Analyze whether fixed costs are too high relative to the returns they generate.",
      ],
    },
  },
  ROE: {
    icon: DollarSign,
    definition:
      "Return on Equity (ROE) measures how effectively the business generates profit from owner-invested equity. It's a key metric of shareholder value creation.",
    formula: "Net Income ÷ Total Equity × 100",
    getCalcSteps: (v, _r, _e, netIncome, _a, _l, equity) => [
      `Net Income: ${fmtCurrency(netIncome)}`,
      `Total Equity: ${fmtCurrency(equity)}`,
      `${fmtCurrency(netIncome)} ÷ ${fmtCurrency(equity)} × 100 = ${fmt(v)}%`,
    ],
    getStatus: (v) => (v >= 15 ? "green" : v >= 8 ? "amber" : "red"),
    benchmarks: [
      { label: "Below Average", range: "< 8%", color: "bg-red-500" },
      { label: "Acceptable", range: "8% – 15%", color: "bg-amber-500" },
      { label: "Strong", range: "> 15%", color: "bg-green-500" },
    ],
    benchmarkMin: 0,
    benchmarkMax: 50,
    amberThreshold: 8,
    greenThreshold: 15,
    higherIsBetter: true,
    peerContext: "Exceptional service businesses often achieve ROE of 20–40%, benefiting from low capital requirements.",
    advice: {
      green: [
        "Strong ROE signals excellent use of shareholder capital — a key investment quality indicator.",
        "Maintain discipline in how retained earnings are reinvested to sustain high ROE.",
        "Consider distributing excess profits to owners or reinvesting in highest-return activities.",
        "Document your ROE trajectory — consistent above-15% ROE is a major business asset.",
      ],
      amber: [
        "Look for opportunities to increase net income without proportional equity growth.",
        "Assess whether equity is being used efficiently — idle retained earnings drag down ROE.",
        "Review pricing and operational efficiency as the primary levers to improve ROE.",
        "Consider optimizing your capital structure if debt could be used more strategically.",
      ],
      red: [
        "The business is not generating adequate returns on owner investment — treat this as urgent.",
        "Investigate whether retained earnings from prior years are being put to productive use.",
        "Focus sharply on profitability — the numerator (net income) must grow faster than equity.",
        "Consider whether any strategic pivots or restructuring are needed to improve profitability.",
      ],
    },
  },
};

function StatusBadgeLocal({ status }: { status: StatusLevel }) {
  if (status === "green")
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 border">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Healthy
      </Badge>
    );
  if (status === "amber")
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 border">
        <AlertTriangle className="w-3 h-3 mr-1" /> Watch
      </Badge>
    );
  return (
    <Badge className="bg-red-100 text-red-700 border-red-200 border">
      <XCircle className="w-3 h-3 mr-1" /> Critical
    </Badge>
  );
}

function BenchmarkBar({
  value,
  meta,
}: {
  value: number;
  meta: RatioMeta;
}) {
  const { benchmarkMin, benchmarkMax, amberThreshold, greenThreshold, higherIsBetter } = meta;
  const range = benchmarkMax - benchmarkMin;

  // Clamp the marker position
  const markerPct = Math.min(Math.max(((value - benchmarkMin) / range) * 100, 2), 98);

  // Zone widths (red | amber | green OR green | amber | red for lower-is-better)
  const amberPct = ((amberThreshold - benchmarkMin) / range) * 100;
  const greenPct = ((greenThreshold - benchmarkMin) / range) * 100;

  return (
    <div className="space-y-3">
      <div className="relative h-6 rounded-full overflow-hidden flex">
        {higherIsBetter ? (
          <>
            <div className="bg-red-400" style={{ width: `${amberPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${greenPct - amberPct}%` }} />
            <div className="bg-green-400 flex-1" />
          </>
        ) : (
          <>
            <div className="bg-green-400" style={{ width: `${amberPct}%` }} />
            <div className="bg-amber-400" style={{ width: `${greenPct - amberPct}%` }} />
            <div className="bg-red-400 flex-1" />
          </>
        )}
        {/* Marker */}
        <div
          className="absolute top-0 bottom-0 w-1 bg-foreground rounded-full shadow-lg"
          style={{ left: `calc(${markerPct}% - 2px)` }}
        />
        <div
          className="absolute -top-1 w-3 h-3 bg-foreground rounded-full border-2 border-background shadow-lg"
          style={{ left: `calc(${markerPct}% - 6px)` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{benchmarkMin}{meta.benchmarks[0]?.range.includes("x") ? "x" : "%"}</span>
        <span className="font-medium text-foreground">
          Your value: {value.toFixed(1)}{meta.benchmarks[0]?.range.includes("x") ? "x" : "%"}
        </span>
        <span>{benchmarkMax}{meta.benchmarks[0]?.range.includes("x") ? "x" : "%"}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {meta.benchmarks.map((b) => (
          <div key={b.label} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2 h-2 rounded-full ${b.color}`} />
            <div>
              <div className="font-medium text-foreground">{b.label}</div>
              <div className="text-muted-foreground">{b.range}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RatioDetailSheet({
  open,
  onOpenChange,
  ratio,
  totalRevenue,
  totalExpenses,
  netIncome,
  totalAssets,
  totalLiabilities,
  equity,
}: RatioDetailSheetProps) {
  if (!ratio) return null;

  const meta = RATIO_META[ratio.label];
  if (!meta) return null;

  const status = ratio.isAvailable ? meta.getStatus(ratio.value) : "amber";
  const calcSteps = ratio.isAvailable
    ? meta.getCalcSteps(ratio.value, totalRevenue, totalExpenses, netIncome, totalAssets, totalLiabilities, equity)
    : [];
  const recommendations = meta.advice[status];
  const Icon = meta.icon;

  const statusIcon =
    status === "green" ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : status === "amber" ? (
      <AlertTriangle className="w-5 h-5 text-amber-500" />
    ) : (
      <XCircle className="w-5 h-5 text-red-500" />
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto p-0">
        {/* Header */}
        <div className="p-6 border-b bg-gradient-to-r from-primary/10 to-transparent">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="w-5 h-5 text-primary" />
                <SheetTitle className="text-lg font-bold">{ratio.label}</SheetTitle>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <span className={`text-3xl font-bold ${ratio.colorClass}`}>
                  {ratio.isAvailable ? `${ratio.value.toFixed(1)}${ratio.suffix}` : "N/A"}
                </span>
                {ratio.isAvailable && <StatusBadgeLocal status={status} />}
              </div>
            </div>
            {ratio.isAvailable && (
              <RadialGauge
                value={Math.min(ratio.value, ratio.maxValue)}
                maxValue={ratio.maxValue}
                label=""
                size={80}
                strokeWidth={8}
                colorClass={ratio.colorClass}
                suffix={ratio.suffix}
                showPercentage={true}
              />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <Tabs defaultValue="explanation">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="explanation" className="flex items-center gap-1.5 text-xs">
                <BookOpen className="w-3.5 h-3.5" />
                Explanation
              </TabsTrigger>
              <TabsTrigger value="benchmark" className="flex items-center gap-1.5 text-xs">
                <BarChart3 className="w-3.5 h-3.5" />
                Benchmark
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="flex items-center gap-1.5 text-xs">
                <Lightbulb className="w-3.5 h-3.5" />
                Actions
              </TabsTrigger>
            </TabsList>

            {/* Explanation Tab */}
            <TabsContent value="explanation" className="space-y-4 mt-0">
              {/* Definition */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-sm text-foreground leading-relaxed">{meta.definition}</p>
              </div>

              {/* Formula */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Formula</h4>
                <div className="rounded-lg border bg-muted/50 px-4 py-3 font-mono text-sm text-foreground text-center">
                  {meta.formula}
                </div>
              </div>

              {/* Calculation with actual numbers */}
              {ratio.isAvailable && calcSteps.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Your Calculation
                  </h4>
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    {calcSteps.map((step, i) => (
                      <div key={i} className={`text-sm ${i === calcSteps.length - 1 ? "font-semibold text-foreground border-t pt-2 mt-2" : "text-muted-foreground"}`}>
                        {i === calcSteps.length - 1 ? "= " : ""}
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status interpretation */}
              {ratio.isAvailable && (
                <div className={`rounded-lg border p-4 flex gap-3 ${
                  status === "green" ? "bg-green-50 border-green-200" :
                  status === "amber" ? "bg-amber-50 border-amber-200" :
                  "bg-red-50 border-red-200"
                }`}>
                  <div className="mt-0.5">{statusIcon}</div>
                  <div>
                    <p className={`text-sm font-semibold mb-1 ${
                      status === "green" ? "text-green-700" :
                      status === "amber" ? "text-amber-700" :
                      "text-red-700"
                    }`}>
                      {status === "green" ? "Looking Healthy" : status === "amber" ? "Needs Monitoring" : "Requires Attention"}
                    </p>
                    <p className={`text-sm ${
                      status === "green" ? "text-green-600" :
                      status === "amber" ? "text-amber-600" :
                      "text-red-600"
                    }`}>
                      {status === "green"
                        ? `Your ${ratio.label} of ${ratio.value.toFixed(1)}${ratio.suffix} is above the healthy benchmark — your business is performing well on this metric.`
                        : status === "amber"
                        ? `Your ${ratio.label} of ${ratio.value.toFixed(1)}${ratio.suffix} is in the acceptable range but has room to improve. Keep monitoring.`
                        : `Your ${ratio.label} of ${ratio.value.toFixed(1)}${ratio.suffix} is below the recommended threshold. Consider taking action to improve it.`}
                    </p>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Benchmark Tab */}
            <TabsContent value="benchmark" className="space-y-4 mt-0">
              {ratio.isAvailable ? (
                <>
                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Where You Stand
                    </h4>
                    <BenchmarkBar value={ratio.value} meta={meta} />
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Industry Context
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{meta.peerContext}</p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Benchmark Zones
                    </h4>
                    {meta.benchmarks.map((b) => (
                      <div key={b.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${b.color}`} />
                          <span className="text-foreground font-medium">{b.label}</span>
                        </div>
                        <span className="text-muted-foreground font-mono">{b.range}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Benchmark data is not available — insufficient financial data to calculate this ratio.
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="space-y-4 mt-0">
              {ratio.isAvailable ? (
                <>
                  <div className={`rounded-lg border p-3 flex items-center gap-2 ${
                    status === "green" ? "bg-green-50 border-green-200" :
                    status === "amber" ? "bg-amber-50 border-amber-200" :
                    "bg-red-50 border-red-200"
                  }`}>
                    {statusIcon}
                    <p className={`text-sm font-medium ${
                      status === "green" ? "text-green-700" :
                      status === "amber" ? "text-amber-700" :
                      "text-red-700"
                    }`}>
                      {status === "green"
                        ? "Your ratio is healthy. Here's how to sustain and grow it."
                        : status === "amber"
                        ? "Your ratio needs monitoring. Here are steps to improve it."
                        : "Immediate action recommended. Here's what to do now."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-3 rounded-lg border bg-muted/20 p-3">
                        <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                          status === "green" ? "bg-green-100 text-green-700" :
                          status === "amber" ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {i + 1}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">{rec}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border bg-muted/30 p-6 text-center">
                  <p className="text-muted-foreground text-sm">
                    Recommendations are not available — add financial data to unlock personalised advice for this ratio.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
