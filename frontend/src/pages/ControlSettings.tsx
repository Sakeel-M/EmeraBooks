import { useState, useMemo, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Settings,
  BookOpen,
  GitMerge,
  Sliders,
  Bell,
  Shield,
  ScrollText,
  Plus,
  Pencil,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Zap,
  ArrowUpDown,
  Scale,
  Landmark,
  Users,
  Building2,
  UserPlus,
  Archive,
  Mail,
  Crown,
  ShieldCheck,
  Download,
  Upload,
  RotateCcw,
  Search,
  Power,
  X,
  Briefcase,
  Globe,
  Phone,
  MapPin,
  FileText,
  Hash,
  Calendar as CalendarIcon,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { toast } from "sonner";
import { useOrg } from "@/hooks/useOrg";
import { format } from "date-fns";

// ── Chart of Accounts Tab ─────────────────────────────────────────────────

type COAAccount = { code: string; name: string; type: string };
type COATemplate = { label: string; accounts: COAAccount[] };

// ── Common base accounts (shared across all sectors) ──
const BASE_ACCOUNTS: COAAccount[] = [
  { code: "1000", name: "Cash & Bank", type: "Asset" },
  { code: "1100", name: "Accounts Receivable", type: "Asset" },
  { code: "1200", name: "Prepaid Expenses", type: "Asset" },
  { code: "1500", name: "Fixed Assets", type: "Asset" },
  { code: "1510", name: "Accumulated Depreciation", type: "Asset" },
  { code: "2000", name: "Accounts Payable", type: "Liability" },
  { code: "2100", name: "VAT Payable", type: "Liability" },
  { code: "2200", name: "Accrued Expenses", type: "Liability" },
  { code: "2500", name: "Long-term Loans", type: "Liability" },
  { code: "3000", name: "Owner's Equity", type: "Equity" },
  { code: "3100", name: "Retained Earnings", type: "Equity" },
];

// ── Sector-specific accounts (keyed by industry from Onboarding) ──
const SECTOR_ACCOUNTS: Record<string, { revenue: COAAccount[]; expense: COAAccount[] }> = {
  "Retail & Trading": {
    revenue: [
      { code: "4000", name: "Sales Revenue", type: "Revenue" },
      { code: "4100", name: "Returns & Allowances", type: "Revenue" },
      { code: "4200", name: "Discount Income", type: "Revenue" },
      { code: "4300", name: "Other Trading Income", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Cost of Goods Sold", type: "Expense" },
      { code: "5100", name: "Freight & Shipping", type: "Expense" },
      { code: "5200", name: "Inventory Write-offs", type: "Expense" },
      { code: "6000", name: "Staff Wages", type: "Expense" },
      { code: "6100", name: "Rent — Retail Space", type: "Expense" },
      { code: "6200", name: "Utilities", type: "Expense" },
      { code: "6300", name: "POS & Card Processing Fees", type: "Expense" },
      { code: "6400", name: "Marketing & Advertising", type: "Expense" },
      { code: "6500", name: "Insurance", type: "Expense" },
      { code: "6600", name: "Packaging & Supplies", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "IT & Technology": {
    revenue: [
      { code: "4000", name: "Service Revenue", type: "Revenue" },
      { code: "4100", name: "Software License Revenue", type: "Revenue" },
      { code: "4200", name: "SaaS Subscription Revenue", type: "Revenue" },
      { code: "4300", name: "Consulting Revenue", type: "Revenue" },
      { code: "4400", name: "Support & Maintenance Revenue", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Development Costs", type: "Expense" },
      { code: "5100", name: "Software & Hosting Costs", type: "Expense" },
      { code: "5200", name: "Cloud Infrastructure", type: "Expense" },
      { code: "6000", name: "Developer Salaries", type: "Expense" },
      { code: "6100", name: "Contractor & Freelancer Fees", type: "Expense" },
      { code: "6200", name: "Office & Co-working Rent", type: "Expense" },
      { code: "6300", name: "Software Subscriptions & Tools", type: "Expense" },
      { code: "6400", name: "Marketing & Growth", type: "Expense" },
      { code: "6500", name: "Equipment & Hardware", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Professional Services": {
    revenue: [
      { code: "4000", name: "Professional Fees", type: "Revenue" },
      { code: "4100", name: "Consulting Revenue", type: "Revenue" },
      { code: "4200", name: "Advisory Fees", type: "Revenue" },
      { code: "4300", name: "Retainer Income", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Direct Labor Costs", type: "Expense" },
      { code: "5100", name: "Subcontractor Fees", type: "Expense" },
      { code: "6000", name: "Staff Salaries", type: "Expense" },
      { code: "6100", name: "Office Rent", type: "Expense" },
      { code: "6200", name: "Professional Subscriptions", type: "Expense" },
      { code: "6300", name: "Training & Development", type: "Expense" },
      { code: "6400", name: "Business Development", type: "Expense" },
      { code: "6500", name: "Insurance — Professional Liability", type: "Expense" },
      { code: "6600", name: "Travel & Client Entertainment", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Accounting & Finance": {
    revenue: [
      { code: "4000", name: "Audit & Assurance Fees", type: "Revenue" },
      { code: "4100", name: "Tax Advisory Fees", type: "Revenue" },
      { code: "4200", name: "Bookkeeping Revenue", type: "Revenue" },
      { code: "4300", name: "Consulting & Advisory Revenue", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Staff Costs — Accountants", type: "Expense" },
      { code: "5100", name: "Subcontractor & Outsource Fees", type: "Expense" },
      { code: "6000", name: "Admin Staff Salaries", type: "Expense" },
      { code: "6100", name: "Office Rent", type: "Expense" },
      { code: "6200", name: "Accounting Software & Licenses", type: "Expense" },
      { code: "6300", name: "Professional Membership Fees", type: "Expense" },
      { code: "6400", name: "Insurance — PI & Fidelity", type: "Expense" },
      { code: "6500", name: "CPD & Training", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Construction & Real Estate": {
    revenue: [
      { code: "4000", name: "Contract Revenue", type: "Revenue" },
      { code: "4100", name: "Rental Income", type: "Revenue" },
      { code: "4200", name: "Property Sales Revenue", type: "Revenue" },
      { code: "4300", name: "Project Management Fees", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Materials & Labor", type: "Expense" },
      { code: "5100", name: "Subcontractor Costs", type: "Expense" },
      { code: "5200", name: "Equipment Rental", type: "Expense" },
      { code: "6000", name: "Site Staff Wages", type: "Expense" },
      { code: "6100", name: "Office & Admin Salaries", type: "Expense" },
      { code: "6200", name: "Permits & Government Fees", type: "Expense" },
      { code: "6300", name: "Safety & Compliance", type: "Expense" },
      { code: "6400", name: "Insurance — Contractor All Risk", type: "Expense" },
      { code: "6500", name: "Fuel & Transportation", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Food & Beverage": {
    revenue: [
      { code: "4000", name: "Food & Beverage Sales", type: "Revenue" },
      { code: "4100", name: "Catering Revenue", type: "Revenue" },
      { code: "4200", name: "Delivery Revenue", type: "Revenue" },
      { code: "4300", name: "Franchise Fees", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Food & Kitchen Cost", type: "Expense" },
      { code: "5100", name: "Beverage Cost", type: "Expense" },
      { code: "5200", name: "Packaging & Disposables", type: "Expense" },
      { code: "6000", name: "Kitchen Staff Wages", type: "Expense" },
      { code: "6100", name: "Front-of-House Salaries", type: "Expense" },
      { code: "6200", name: "Rent — Restaurant / Kitchen", type: "Expense" },
      { code: "6300", name: "Utilities — Gas, Water, Electric", type: "Expense" },
      { code: "6400", name: "Food Safety & Licensing", type: "Expense" },
      { code: "6500", name: "Delivery Platform Commissions", type: "Expense" },
      { code: "6600", name: "Marketing & Promotions", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Healthcare": {
    revenue: [
      { code: "4000", name: "Consultation Fees", type: "Revenue" },
      { code: "4100", name: "Treatment & Procedure Revenue", type: "Revenue" },
      { code: "4200", name: "Insurance Claims Revenue", type: "Revenue" },
      { code: "4300", name: "Pharmacy Sales", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Medical Supplies & Consumables", type: "Expense" },
      { code: "5100", name: "Pharmaceutical Costs", type: "Expense" },
      { code: "6000", name: "Doctor & Specialist Salaries", type: "Expense" },
      { code: "6100", name: "Nursing & Support Staff", type: "Expense" },
      { code: "6200", name: "Clinic / Hospital Rent", type: "Expense" },
      { code: "6300", name: "Medical Equipment Maintenance", type: "Expense" },
      { code: "6400", name: "Licensing & Compliance (DHA/HAAD)", type: "Expense" },
      { code: "6500", name: "Insurance — Medical Malpractice", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "E-Commerce": {
    revenue: [
      { code: "4000", name: "Product Sales Revenue", type: "Revenue" },
      { code: "4100", name: "Marketplace Commission Revenue", type: "Revenue" },
      { code: "4200", name: "Subscription Revenue", type: "Revenue" },
      { code: "4300", name: "Returns & Refunds", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Cost of Goods Sold", type: "Expense" },
      { code: "5100", name: "Shipping & Fulfillment", type: "Expense" },
      { code: "5200", name: "Payment Gateway Fees", type: "Expense" },
      { code: "5300", name: "Marketplace Fees", type: "Expense" },
      { code: "6000", name: "Staff Salaries", type: "Expense" },
      { code: "6100", name: "Warehouse & Storage Rent", type: "Expense" },
      { code: "6200", name: "Website & Platform Costs", type: "Expense" },
      { code: "6300", name: "Digital Marketing & Ads", type: "Expense" },
      { code: "6400", name: "Packaging Materials", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Education": {
    revenue: [
      { code: "4000", name: "Tuition Fees", type: "Revenue" },
      { code: "4100", name: "Training Program Revenue", type: "Revenue" },
      { code: "4200", name: "Course Material Sales", type: "Revenue" },
      { code: "4300", name: "Examination & Certification Fees", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Course Development Costs", type: "Expense" },
      { code: "5100", name: "Teaching Materials", type: "Expense" },
      { code: "6000", name: "Teacher / Instructor Salaries", type: "Expense" },
      { code: "6100", name: "Admin Staff Salaries", type: "Expense" },
      { code: "6200", name: "Facility Rent", type: "Expense" },
      { code: "6300", name: "Software & EdTech Subscriptions", type: "Expense" },
      { code: "6400", name: "Marketing & Student Acquisition", type: "Expense" },
      { code: "6500", name: "Accreditation & Licensing Fees", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Hospitality & Tourism": {
    revenue: [
      { code: "4000", name: "Room / Booking Revenue", type: "Revenue" },
      { code: "4100", name: "Tour Package Revenue", type: "Revenue" },
      { code: "4200", name: "F&B Revenue", type: "Revenue" },
      { code: "4300", name: "Ancillary Services Revenue", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Room / Tour Operating Costs", type: "Expense" },
      { code: "5100", name: "F&B Cost of Sales", type: "Expense" },
      { code: "6000", name: "Hospitality Staff Wages", type: "Expense" },
      { code: "6100", name: "Property / Venue Rent", type: "Expense" },
      { code: "6200", name: "Utilities & Maintenance", type: "Expense" },
      { code: "6300", name: "OTA & Booking Commissions", type: "Expense" },
      { code: "6400", name: "Marketing & Promotions", type: "Expense" },
      { code: "6500", name: "Linen, Supplies & Amenities", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Manufacturing": {
    revenue: [
      { code: "4000", name: "Product Sales Revenue", type: "Revenue" },
      { code: "4100", name: "Contract Manufacturing Revenue", type: "Revenue" },
      { code: "4200", name: "Scrap & Byproduct Sales", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Raw Materials", type: "Expense" },
      { code: "5100", name: "Direct Labor — Production", type: "Expense" },
      { code: "5200", name: "Manufacturing Overhead", type: "Expense" },
      { code: "6000", name: "Factory Rent", type: "Expense" },
      { code: "6100", name: "Admin & Office Staff", type: "Expense" },
      { code: "6200", name: "Machinery Maintenance", type: "Expense" },
      { code: "6300", name: "Quality Control & Testing", type: "Expense" },
      { code: "6400", name: "Freight & Logistics", type: "Expense" },
      { code: "6500", name: "Insurance — Factory & Equipment", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Transportation & Logistics": {
    revenue: [
      { code: "4000", name: "Freight & Shipping Revenue", type: "Revenue" },
      { code: "4100", name: "Warehousing Revenue", type: "Revenue" },
      { code: "4200", name: "Last-Mile Delivery Revenue", type: "Revenue" },
      { code: "4300", name: "Customs Brokerage Fees", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Vehicle Operating Costs", type: "Expense" },
      { code: "5100", name: "Fuel & Tolls", type: "Expense" },
      { code: "5200", name: "Driver Wages", type: "Expense" },
      { code: "6000", name: "Admin & Dispatch Staff", type: "Expense" },
      { code: "6100", name: "Fleet Maintenance & Repairs", type: "Expense" },
      { code: "6200", name: "Warehouse Rent", type: "Expense" },
      { code: "6300", name: "Insurance — Fleet & Cargo", type: "Expense" },
      { code: "6400", name: "Licensing & Permits (RTA)", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
  "Other": {
    revenue: [
      { code: "4000", name: "Revenue", type: "Revenue" },
      { code: "4100", name: "Service Income", type: "Revenue" },
      { code: "4200", name: "Other Income", type: "Revenue" },
    ],
    expense: [
      { code: "5000", name: "Cost of Sales", type: "Expense" },
      { code: "6000", name: "Salaries & Wages", type: "Expense" },
      { code: "6100", name: "Rent Expense", type: "Expense" },
      { code: "6200", name: "Utilities", type: "Expense" },
      { code: "6300", name: "Office Supplies", type: "Expense" },
      { code: "6400", name: "Marketing & Advertising", type: "Expense" },
      { code: "6500", name: "Depreciation", type: "Expense" },
      { code: "6600", name: "Insurance", type: "Expense" },
      { code: "6700", name: "Professional Fees", type: "Expense" },
      { code: "6900", name: "Miscellaneous Expense", type: "Expense" },
    ],
  },
};

function buildSectorCOA(industry: string): COAAccount[] {
  const sector = SECTOR_ACCOUNTS[industry] || SECTOR_ACCOUNTS["Other"];
  return [...BASE_ACCOUNTS, ...sector.revenue, ...sector.expense];
}

// Framework templates (non-sector-specific)
const FRAMEWORK_TEMPLATES: Record<string, COATemplate> = {
  ifrs: {
    label: "IFRS",
    accounts: [
      { code: "100", name: "Cash & Cash Equivalents", type: "Asset" },
      { code: "110", name: "Trade Receivables", type: "Asset" },
      { code: "120", name: "Inventories", type: "Asset" },
      { code: "130", name: "Property, Plant & Equipment", type: "Asset" },
      { code: "140", name: "Intangible Assets", type: "Asset" },
      { code: "150", name: "Right-of-Use Assets", type: "Asset" },
      { code: "200", name: "Trade Payables", type: "Liability" },
      { code: "210", name: "Provisions", type: "Liability" },
      { code: "220", name: "Lease Liabilities", type: "Liability" },
      { code: "230", name: "Borrowings", type: "Liability" },
      { code: "300", name: "Share Capital", type: "Equity" },
      { code: "310", name: "Retained Earnings", type: "Equity" },
      { code: "320", name: "Other Comprehensive Income", type: "Equity" },
      { code: "400", name: "Revenue from Contracts", type: "Revenue" },
      { code: "410", name: "Other Operating Income", type: "Revenue" },
      { code: "500", name: "Cost of Sales", type: "Expense" },
      { code: "510", name: "Employee Benefits", type: "Expense" },
      { code: "520", name: "Depreciation & Amortization", type: "Expense" },
      { code: "530", name: "Other Operating Expenses", type: "Expense" },
      { code: "540", name: "Finance Costs", type: "Expense" },
    ],
  },
};

function ChartOfAccountsTab() {
  const { clientId, client } = useActiveClient();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [addForm, setAddForm] = useState({ code: "", name: "", type: "Asset" });

  const industry = client?.industry || "Other";

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["cs-accounts", clientId],
    queryFn: () => database.getAccounts(clientId!),
    enabled: !!clientId,
  });

  // Group by type
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    accounts.forEach((a: any) => {
      const type = a.type || a.account_type || "Other";
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [accounts]);

  const typeColors: Record<string, string> = {
    Asset: "text-blue-600 bg-blue-50 border-blue-200",
    Liability: "text-red-500 bg-red-50 border-red-200",
    Equity: "text-purple-600 bg-purple-50 border-purple-200",
    Revenue: "text-green-600 bg-green-50 border-green-200",
    Expense: "text-orange-500 bg-orange-50 border-orange-200",
  };

  const handleImportSector = async () => {
    if (!clientId) return;
    setImporting(true);
    try {
      const sectorAccounts = buildSectorCOA(industry);
      const result = await database.importAccountTemplate(clientId, `sector-${industry}`, sectorAccounts);
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success(`Imported ${result.imported} accounts for ${industry}`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFramework = async (key: string) => {
    if (!clientId) return;
    const tmpl = FRAMEWORK_TEMPLATES[key];
    if (!tmpl) return;
    setImporting(true);
    try {
      const result = await database.importAccountTemplate(clientId, key, tmpl.accounts);
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success(`Imported ${result.imported} accounts from ${tmpl.label} template`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleExportIFRS = async () => {
    if (!clientId) return;
    setImporting(true);
    try {
      // Fetch all data
      const [accs, txns, bills, invoices] = await Promise.all([
        database.getAccounts(clientId),
        database.getTransactions(clientId, { limit: 50000 }),
        database.getBills(clientId).catch(() => []),
        database.getInvoices(clientId).catch(() => []),
      ]);

      // Group accounts by type
      const byType: Record<string, any[]> = {};
      accs.forEach((a: any) => {
        const t = a.type || a.account_type || "Other";
        if (!byType[t]) byType[t] = [];
        byType[t].push(a);
      });

      // Compute totals from transactions
      const totalRevenue = txns
        .filter((t: any) => t.amount > 0)
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      const totalExpenses = txns
        .filter((t: any) => t.amount < 0)
        .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      const netIncome = totalRevenue - totalExpenses;

      // Compute bill/invoice totals
      const totalBilled = bills.reduce((s: number, b: any) => s + (b.total || 0), 0);
      const totalPaidBills = bills
        .filter((b: any) => b.status === "paid")
        .reduce((s: number, b: any) => s + (b.total || 0), 0);
      const totalInvoiced = invoices.reduce((s: number, i: any) => s + (i.total || 0), 0);
      const totalPaidInvoices = invoices
        .filter((i: any) => i.status === "paid")
        .reduce((s: number, i: any) => s + (i.total || 0), 0);

      const receivables = totalInvoiced - totalPaidInvoices;
      const payables = totalBilled - totalPaidBills;
      const cashBalance = totalRevenue - totalExpenses;

      // Cash flow categories
      const investingRe = /\b(property|equipment|vehicle|machinery|land|building|furniture|renovation|capital)\b/i;
      const financingRe = /\b(loan|mortgage|dividend|share|equity|repayment|emi)\b/i;
      let operating = 0, investing = 0, financing = 0;
      txns.forEach((t: any) => {
        const desc = (t.description || "").toLowerCase();
        const amt = Number(t.amount);
        if (investingRe.test(desc)) investing += amt;
        else if (financingRe.test(desc)) financing += amt;
        else operating += amt;
      });

      const today = new Date().toISOString().slice(0, 10);
      const currency = txns[0]?.currency || "AED";

      // Build multi-section CSV
      const lines: string[] = [];
      const addLine = (...cells: (string | number)[]) => lines.push(cells.map(c => String(c)).join(","));
      const blank = () => lines.push("");

      // Header
      addLine("IFRS Financial Statements Export");
      addLine("Generated", today);
      addLine("Currency", currency);
      blank();

      // 1. Statement of Financial Position (IAS 1)
      addLine("STATEMENT OF FINANCIAL POSITION (IAS 1)");
      addLine("Account Code", "Account Name", "Type", "Amount");
      blank();
      addLine("ASSETS");
      let totalAssets = 0;
      (byType["Asset"] || []).forEach((a: any) => {
        addLine(a.code, a.name, "Asset", "");
      });
      totalAssets = cashBalance + receivables;
      addLine("", "Cash & Cash Equivalents", "", cashBalance.toFixed(2));
      addLine("", "Trade Receivables", "", receivables.toFixed(2));
      addLine("", "TOTAL ASSETS", "", totalAssets.toFixed(2));
      blank();
      addLine("LIABILITIES");
      addLine("", "Trade Payables", "", payables.toFixed(2));
      addLine("", "TOTAL LIABILITIES", "", payables.toFixed(2));
      blank();
      addLine("EQUITY");
      const equity = totalAssets - payables;
      addLine("", "Retained Earnings (Net Income)", "", netIncome.toFixed(2));
      addLine("", "TOTAL EQUITY", "", equity.toFixed(2));
      blank();
      addLine("", "TOTAL LIABILITIES + EQUITY", "", (payables + equity).toFixed(2));
      blank();
      blank();

      // 2. Statement of Profit or Loss (IAS 1)
      addLine("STATEMENT OF PROFIT OR LOSS (IAS 1)");
      addLine("Line Item", "Amount");
      blank();
      addLine("Revenue from Contracts with Customers (IFRS 15)", totalRevenue.toFixed(2));

      // Expense breakdown by category
      const expByCat: Record<string, number> = {};
      txns.filter((t: any) => t.amount < 0).forEach((t: any) => {
        const cat = t.category || "Other Operating Expenses";
        expByCat[cat] = (expByCat[cat] || 0) + Math.abs(Number(t.amount));
      });
      Object.entries(expByCat)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, amt]) => {
          addLine(`  ${cat}`, `-${amt.toFixed(2)}`);
        });

      addLine("Total Expenses", `-${totalExpenses.toFixed(2)}`);
      blank();
      addLine("PROFIT / (LOSS) FOR THE PERIOD", netIncome.toFixed(2));
      blank();
      blank();

      // 3. Statement of Cash Flows (IAS 7)
      addLine("STATEMENT OF CASH FLOWS (IAS 7) — Indirect Method");
      addLine("Category", "Amount");
      blank();
      addLine("Cash flows from operating activities", operating.toFixed(2));
      addLine("Cash flows from investing activities", investing.toFixed(2));
      addLine("Cash flows from financing activities", financing.toFixed(2));
      blank();
      addLine("NET CHANGE IN CASH", (operating + investing + financing).toFixed(2));
      blank();
      blank();

      // 4. Notes — Chart of Accounts
      addLine("NOTES — CHART OF ACCOUNTS");
      addLine("Code", "Name", "Type", "Status");
      accs.forEach((a: any) => {
        addLine(a.code, a.name, a.type || a.account_type || "", a.is_active !== false ? "Active" : "Inactive");
      });
      blank();

      // 5. Notes — Summary
      addLine("NOTES — TRANSACTION SUMMARY");
      addLine("Metric", "Value");
      addLine("Total Transactions", txns.length);
      addLine("Total Bills", bills.length);
      addLine("Total Invoices", invoices.length);
      addLine("Outstanding Receivables", receivables.toFixed(2));
      addLine("Outstanding Payables", payables.toFixed(2));

      // Download
      const csv = lines.join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `IFRS_Financial_Statements_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("IFRS financial statements exported");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    } finally {
      setImporting(false);
    }
  };

  const handleAddAccount = async () => {
    if (!clientId || !addForm.code.trim() || !addForm.name.trim()) return;
    try {
      await database.createAccount(clientId, addForm);
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success("Account created");
      setShowAdd(false);
      setAddForm({ code: "", name: "", type: "Asset" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    }
  };

  const handleToggle = async (acc: any) => {
    try {
      await database.updateAccount(acc.id, { is_active: !acc.is_active });
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success(acc.is_active ? "Account deactivated" : "Account activated");
    } catch {
      toast.error("Failed to update account");
    }
  };

  const handleDelete = async (acc: any) => {
    try {
      await database.deleteAccount(acc.id);
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success("Account deleted");
    } catch {
      toast.error("Failed to delete account");
    }
  };

  const handleEditSave = async () => {
    if (!editAccount) return;
    try {
      await database.updateAccount(editAccount.id, {
        code: editAccount.code,
        name: editAccount.name,
        type: editAccount.type,
      });
      queryClient.invalidateQueries({ queryKey: ["cs-accounts", clientId] });
      toast.success("Account updated");
      setEditAccount(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="space-y-5">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Chart of Accounts</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-2">
              Load standard accounts tailored for your business sector, or choose a framework template.
            </p>
            <Badge variant="outline" className="mb-4 text-xs">
              <Building2 className="h-3 w-3 mr-1" />
              Business Sector: {industry}
            </Badge>
            <div className="flex flex-col items-center gap-3">
              <Button size="sm" className="gap-1.5" onClick={handleImportSector} disabled={importing}>
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                Load Standard Accounts for {industry}
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or use framework:</span>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleImportFramework("ifrs")} disabled={importing}>
                  {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  IFRS
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
                  <Plus className="h-3 w-3" />
                  Add Manual
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Add dialog */}
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Account</DialogTitle>
              <DialogDescription>Create a new account in the Chart of Accounts.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Code *</Label>
                  <Input value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} placeholder="e.g. 1000" className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name *</Label>
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Cash & Bank" className="h-8" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button onClick={handleAddAccount} disabled={!addForm.code.trim() || !addForm.name.trim()} className="gap-1.5">
                <Save className="h-4 w-4" />
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <KPICard label="Total Accounts" value={accounts.length.toString()} icon={BookOpen} color="text-primary" />
          <KPICard label="Account Types" value={grouped.length.toString()} icon={Scale} color="text-primary" />
          <KPICard label="Active" value={accounts.filter((a: any) => a.is_active !== false).length.toString()} icon={CheckCircle2} color="text-green-600" />
          <KPICard label="Inactive" value={accounts.filter((a: any) => a.is_active === false).length.toString()} icon={AlertTriangle} color="text-muted-foreground" />
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3" />
          Add Account
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleImportSector} disabled={importing}>
          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          Load {industry} Accounts
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleImportFramework("ifrs")} disabled={importing}>
          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Import IFRS
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleExportIFRS} disabled={importing}>
          {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Export IFRS
        </Button>
      </div>

      {/* Sector Info */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          <Building2 className="h-3 w-3 mr-1" />
          {industry}
        </Badge>
        <span className="text-xs text-muted-foreground">
          Accounts are tailored for your business sector
        </span>
      </div>

      {grouped.map(([type, accs]) => {
        const colorCls = typeColors[type] || "text-muted-foreground bg-muted border-muted";
        return (
          <Card key={type} className="stat-card-hover">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] ${colorCls}`}>{type}</Badge>
                <CardTitle className="text-sm font-medium">{accs.length} account{accs.length !== 1 && "s"}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accs.map((a: any) => (
                    <TableRow key={a.id} className={a.is_active === false ? "opacity-50" : ""}>
                      <TableCell className="font-mono text-xs">{a.code || "—"}</TableCell>
                      <TableCell className="text-sm font-medium">{a.name}</TableCell>
                      <TableCell>
                        <Badge variant={a.is_active !== false ? "default" : "secondary"} className="text-[9px]">
                          {a.is_active !== false ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setEditAccount({ ...a })}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleToggle(a)}>
                            <Power className={`h-3 w-3 ${a.is_active !== false ? "text-green-500" : "text-muted-foreground"}`} />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500" onClick={() => handleDelete(a)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Add Account Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Account</DialogTitle>
            <DialogDescription>Create a new account in the Chart of Accounts.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Code *</Label>
                <Input value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} placeholder="e.g. 1000" className="h-8" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={addForm.type} onValueChange={(v) => setAddForm({ ...addForm, type: v })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Cash & Bank" className="h-8" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddAccount} disabled={!addForm.code.trim() || !addForm.name.trim()} className="gap-1.5">
              <Save className="h-4 w-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Account Dialog */}
      <Dialog open={!!editAccount} onOpenChange={() => setEditAccount(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
            <DialogDescription>Modify account details.</DialogDescription>
          </DialogHeader>
          {editAccount && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Code</Label>
                  <Input value={editAccount.code || ""} onChange={(e) => setEditAccount({ ...editAccount, code: e.target.value })} className="h-8" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Type</Label>
                  <Select value={editAccount.type || "Asset"} onValueChange={(v) => setEditAccount({ ...editAccount, type: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Asset", "Liability", "Equity", "Revenue", "Expense"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={editAccount.name || ""} onChange={(e) => setEditAccount({ ...editAccount, name: e.target.value })} className="h-8" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAccount(null)}>Cancel</Button>
            <Button onClick={handleEditSave} className="gap-1.5">
              <Save className="h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Matching Rules Tab ────────────────────────────────────────────────────

function MatchingRulesTab() {
  const { clientId } = useActiveClient();
  const queryClient = useQueryClient();
  const [editRule, setEditRule] = useState<any>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    priority: "1",
    match_type: "exact",
    field: "amount",
    tolerance: "0",
    auto_match: false,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["cs-matching-rules", clientId],
    queryFn: () => database.getMatchingRules(clientId!),
    enabled: !!clientId,
  });

  const openNew = () => {
    setEditRule(null);
    setForm({ name: "", priority: "1", match_type: "exact", field: "amount", tolerance: "0", auto_match: false });
    setShowDialog(true);
  };

  const openEdit = (rule: any) => {
    setEditRule(rule);
    setForm({
      name: rule.name || "",
      priority: (rule.priority || 1).toString(),
      match_type: rule.criteria?.match_type || "exact",
      field: rule.criteria?.field || "amount",
      tolerance: (rule.criteria?.tolerance || 0).toString(),
      auto_match: rule.auto_match || false,
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!clientId || !form.name.trim()) return;
    setSaving(true);
    try {
      await database.upsertMatchingRule(clientId, {
        ...(editRule ? { id: editRule.id } : {}),
        name: form.name.trim(),
        priority: parseInt(form.priority) || 1,
        criteria: {
          match_type: form.match_type,
          field: form.field,
          tolerance: parseFloat(form.tolerance) || 0,
        },
        auto_match: form.auto_match,
      });
      queryClient.invalidateQueries({ queryKey: ["cs-matching-rules", clientId] });
      toast.success(editRule ? "Rule updated" : "Rule created");
      setShowDialog(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await database.deleteMatchingRule(ruleId);
      queryClient.invalidateQueries({ queryKey: ["cs-matching-rules", clientId] });
      toast.success("Rule deleted");
    } catch {
      toast.error("Failed to delete rule");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1 mr-4">
          <KPICard label="Total Rules" value={rules.length.toString()} icon={GitMerge} color="text-primary" />
          <KPICard label="Auto-Match" value={rules.filter((r: any) => r.auto_match).length.toString()} icon={Zap} color="text-amber-500" sub="enabled" />
          <KPICard label="Manual" value={rules.filter((r: any) => !r.auto_match).length.toString()} icon={ArrowUpDown} color="text-muted-foreground" />
        </div>
        <Button onClick={openNew} className="gap-1.5 shrink-0">
          <Plus className="h-4 w-4" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <GitMerge className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Matching Rules</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Create rules to automatically match transactions during
              reconciliation. Rules define how amounts, dates, and descriptions
              are compared.
            </p>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create First Rule
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Match Type</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Tolerance</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rules]
                  .sort((a: any, b: any) => (a.priority || 99) - (b.priority || 99))
                  .map((rule: any) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          #{rule.priority || 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{rule.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">
                          {rule.criteria?.match_type || "exact"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {rule.criteria?.field || "amount"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {rule.criteria?.tolerance || 0}
                        {rule.criteria?.match_type === "percentage" ? "%" : ""}
                      </TableCell>
                      <TableCell>
                        {rule.auto_match ? (
                          <Zap className="h-4 w-4 text-amber-500" />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(rule)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(rule.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rule Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRule ? "Edit Rule" : "New Matching Rule"}</DialogTitle>
            <DialogDescription>
              Define how transactions should be matched during reconciliation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input id="rule-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g., Exact Amount Match" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input type="number" min="1" max="99" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={form.match_type} onValueChange={(v) => setForm({ ...form, match_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="exact">Exact</SelectItem>
                    <SelectItem value="fuzzy">Fuzzy</SelectItem>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="range">Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Field</Label>
                <Select value={form.field} onValueChange={(v) => setForm({ ...form, field: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="amount">Amount</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="description">Description</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tolerance</Label>
                <Input type="number" min="0" step="0.01" value={form.tolerance} onChange={(e) => setForm({ ...form, tolerance: e.target.value })} placeholder="0" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.auto_match} onCheckedChange={(v) => setForm({ ...form, auto_match: v })} />
              <Label className="text-sm">Auto-match (no manual review needed)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editRule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Thresholds & Alerts Tab ───────────────────────────────────────────────

function ThresholdsTab() {
  const { clientId, currency } = useActiveClient();
  const [saving, setSaving] = useState<string | null>(null);

  // Settings with defaults
  const settingKeys = [
    { key: "large_txn_threshold", label: "Large Transaction Threshold", desc: "Flag transactions above this amount", type: "number", default: 10000, unit: currency },
    { key: "variance_pct_threshold", label: "Variance Alert Threshold", desc: "Flag categories with month-over-month variance above this %", type: "number", default: 25, unit: "%" },
    { key: "overdue_alert_days", label: "Overdue Alert After (days)", desc: "Create alert when bills/invoices are overdue by this many days", type: "number", default: 7, unit: "days" },
    { key: "auto_reconcile", label: "Auto-Reconcile Exact Matches", desc: "Automatically mark perfect matches as reconciled", type: "toggle", default: true },
    { key: "duplicate_detection", label: "Duplicate Transaction Detection", desc: "Flag potential duplicate transactions (same amount within 3 days)", type: "toggle", default: true },
    { key: "weekend_txn_alert", label: "Weekend Transaction Alerts", desc: "Flag transactions occurring on Saturday or Sunday", type: "toggle", default: false },
    { key: "low_balance_threshold", label: "Low Balance Alert", desc: "Alert when any bank account balance falls below this amount", type: "number", default: 5000, unit: currency },
    { key: "ar_aging_critical_days", label: "AR Critical Aging (days)", desc: "Mark receivables as critical risk after this many days", type: "number", default: 90, unit: "days" },
  ];

  const [values, setValues] = useState<Record<string, any>>({});

  // Load settings
  const { data: loadedSettings, isLoading } = useQuery({
    queryKey: ["cs-settings", clientId],
    queryFn: async () => {
      const results: Record<string, any> = {};
      for (const s of settingKeys) {
        try {
          const val = await database.getControlSetting(clientId!, s.key);
          results[s.key] = val;
        } catch {
          results[s.key] = null;
        }
      }
      return results;
    },
    enabled: !!clientId,
  });

  useEffect(() => {
    if (loadedSettings) {
      const merged: Record<string, any> = {};
      settingKeys.forEach((s) => {
        merged[s.key] = loadedSettings[s.key] ?? s.default;
      });
      setValues(merged);
    }
  }, [loadedSettings]);

  const handleSave = async (key: string, value: any) => {
    if (!clientId) return;
    setSaving(key);
    try {
      await database.setControlSetting(clientId, key, value);
      setValues((prev) => ({ ...prev, [key]: value }));
      toast.success("Setting saved");
    } catch {
      toast.error("Failed to save setting");
    } finally {
      setSaving(null);
    }
  };

  const [sensitivity, setSensitivity] = useState<string>("medium");
  const [resetting, setResetting] = useState(false);

  // Load sensitivity setting
  const { data: loadedSensitivity } = useQuery({
    queryKey: ["cs-sensitivity", clientId],
    queryFn: () => database.getControlSetting(clientId!, "alert_sensitivity"),
    enabled: !!clientId,
  });

  useEffect(() => {
    if (loadedSensitivity) setSensitivity(loadedSensitivity);
  }, [loadedSensitivity]);

  const handleSensitivityChange = async (level: string) => {
    if (!clientId) return;
    setSensitivity(level);
    try {
      await database.setControlSetting(clientId, "alert_sensitivity", level);
      toast.success(`Alert sensitivity set to ${level}`);
    } catch {
      toast.error("Failed to save sensitivity");
    }
  };

  const handleResetDefaults = async () => {
    if (!clientId) return;
    setResetting(true);
    try {
      for (const s of settingKeys) {
        await database.setControlSetting(clientId, s.key, s.default);
      }
      await database.setControlSetting(clientId, "alert_sensitivity", "medium");
      const merged: Record<string, any> = {};
      settingKeys.forEach((s) => { merged[s.key] = s.default; });
      setValues(merged);
      setSensitivity("medium");
      toast.success("All settings reset to defaults");
    } catch {
      toast.error("Failed to reset settings");
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const SENSITIVITY_LEVELS = [
    { value: "low", label: "Low", desc: "Only critical alerts — fewer notifications, may miss subtle issues", color: "text-blue-500 border-blue-200 bg-blue-50 dark:bg-blue-900/20" },
    { value: "medium", label: "Medium", desc: "Balanced — catches most issues without excessive noise", color: "text-amber-500 border-amber-200 bg-amber-50 dark:bg-amber-900/20" },
    { value: "high", label: "High", desc: "Aggressive — catches everything, may generate more false positives", color: "text-red-500 border-red-200 bg-red-50 dark:bg-red-900/20" },
  ];

  return (
    <div className="space-y-4">
      {/* Alert Sensitivity */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Bell className="h-4 w-4" />
            Alert Sensitivity
          </CardTitle>
          <CardDescription className="text-xs">
            Control how aggressively the system flags potential issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {SENSITIVITY_LEVELS.map((level) => (
              <button
                key={level.value}
                onClick={() => handleSensitivityChange(level.value)}
                className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                  sensitivity === level.value
                    ? `${level.color} border-current shadow-sm`
                    : "border-muted hover:border-muted-foreground/30 bg-muted/30"
                }`}
              >
                {sensitivity === level.value && (
                  <CheckCircle2 className="absolute top-2 right-2 h-4 w-4" />
                )}
                <p className="text-sm font-semibold mb-1">{level.label}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">{level.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Detection Thresholds</CardTitle>
          <CardDescription className="text-xs">
            Configure when alerts and flags are triggered
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {settingKeys
            .filter((s) => s.type === "number")
            .map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Input
                    type="number"
                    className="w-[120px] h-8 text-sm"
                    value={values[s.key] ?? s.default}
                    onChange={(e) =>
                      setValues((prev) => ({
                        ...prev,
                        [s.key]: parseFloat(e.target.value) || 0,
                      }))
                    }
                    min={0}
                  />
                  {s.unit && (
                    <span className="text-xs text-muted-foreground w-10">{s.unit}</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1"
                    disabled={saving === s.key}
                    onClick={() => handleSave(s.key, values[s.key])}
                  >
                    {saving === s.key ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Save className="h-3 w-3" />
                    )}
                    Save
                  </Button>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Alert Toggles</CardTitle>
          <CardDescription className="text-xs">
            Enable or disable specific detection features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settingKeys
            .filter((s) => s.type === "toggle")
            .map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between gap-4 py-2"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch
                    checked={values[s.key] ?? s.default}
                    onCheckedChange={(v) => {
                      setValues((prev) => ({ ...prev, [s.key]: v }));
                      handleSave(s.key, v);
                    }}
                  />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Reset to Defaults */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-between py-4">
          <div>
            <p className="text-sm font-medium">Reset to Defaults</p>
            <p className="text-xs text-muted-foreground">Restore all thresholds, toggles, and sensitivity to factory defaults</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleResetDefaults} disabled={resetting}>
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            Reset All
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Audit Log Tab ─────────────────────────────────────────────────────────

function AuditLogTab() {
  const { clientId } = useActiveClient();
  const [actionFilter, setActionFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Combine risk alerts + reconciliation items as audit trail
  const { data: alerts = [] } = useQuery({
    queryKey: ["cs-alerts-audit", clientId],
    queryFn: () => database.getRiskAlerts(clientId!),
    enabled: !!clientId,
  });

  const { data: flaggedItems = [] } = useQuery({
    queryKey: ["cs-flagged-audit", clientId],
    queryFn: () => database.getFlaggedItems(clientId!),
    enabled: !!clientId,
  });

  const auditEntries = useMemo(() => {
    const entries: any[] = [];

    alerts.forEach((a: any) => {
      entries.push({
        id: a.id,
        timestamp: a.created_at,
        action: a.status === "resolved" ? "Alert Resolved" : "Alert Created",
        type: "alert",
        entity: a.alert_type?.replace(/_/g, " ") || "Risk Alert",
        detail: a.title,
        severity: a.severity,
      });
    });

    flaggedItems.forEach((f: any) => {
      entries.push({
        id: f.id,
        timestamp: f.created_at,
        action: f.status === "matched" ? "Item Matched" : f.status === "flagged" ? "Item Flagged" : `Item ${f.status}`,
        type: "reconciliation",
        entity: "Reconciliation",
        detail: f.description || `${f.source_a_ref || ""} vs ${f.source_b_ref || ""}`,
        severity: f.status === "flagged" ? "medium" : "low",
      });
    });

    return entries
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""))
      .slice(0, 200);
  }, [alerts, flaggedItems]);

  const actionTypes = useMemo(() => {
    const set = new Set(auditEntries.map((e) => e.action));
    return Array.from(set).sort();
  }, [auditEntries]);

  const entityTypes = useMemo(() => {
    const set = new Set(auditEntries.map((e) => e.type));
    return Array.from(set).sort();
  }, [auditEntries]);

  const filtered = useMemo(() => {
    return auditEntries.filter((e) => {
      if (actionFilter !== "all" && e.action !== actionFilter) return false;
      if (entityFilter !== "all" && e.type !== entityFilter) return false;
      if (dateFrom && e.timestamp && e.timestamp < dateFrom) return false;
      if (dateTo && e.timestamp && e.timestamp > dateTo + "T23:59:59") return false;
      return true;
    });
  }, [auditEntries, actionFilter, entityFilter, dateFrom, dateTo]);

  const handleExportCSV = () => {
    const sanitize = (val: string) => {
      const s = String(val ?? "");
      if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
      return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "Timestamp,Action,Entity Type,Entity,Detail,Severity";
    const rows = filtered.map((e) =>
      [
        e.timestamp ? format(new Date(e.timestamp), "yyyy-MM-dd HH:mm:ss") : "",
        sanitize(e.action),
        sanitize(e.type),
        sanitize(e.entity),
        sanitize(e.detail || ""),
        sanitize(e.severity || ""),
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries`);
  };

  if (auditEntries.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <ScrollText className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Audit Entries</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Audit entries are created when alerts fire, reconciliation items are
            flagged or resolved, and settings are changed.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard label="Total Entries" value={filtered.length.toString()} icon={ScrollText} color="text-primary" />
        <KPICard label="Alerts" value={filtered.filter((e) => e.type === "alert").length.toString()} icon={Bell} color="text-amber-500" />
        <KPICard label="Reconciliation" value={filtered.filter((e) => e.type === "reconciliation").length.toString()} icon={GitMerge} color="text-blue-500" />
      </div>

      {/* Filters + Export */}
      <Card className="stat-card-hover">
        <CardContent className="py-3 px-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Entity Type</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {entityTypes.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
              <Input type="date" className="h-8 w-[140px] text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
              <Input type="date" className="h-8 w-[140px] text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <div className="ml-auto flex items-center gap-2">
              {(actionFilter !== "all" || entityFilter !== "all" || dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => { setActionFilter("all"); setEntityFilter("all"); setDateFrom(""); setDateTo(""); }}>
                  <X className="h-3 w-3" /> Clear
                </Button>
              )}
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleExportCSV}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Severity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No entries match the current filters
                  </TableCell>
                </TableRow>
              ) : filtered.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.timestamp
                      ? format(new Date(entry.timestamp), "dd MMM yyyy HH:mm")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.action.includes("Resolved") || entry.action.includes("Matched")
                          ? "default"
                          : entry.action.includes("Flagged") || entry.action.includes("Created")
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs capitalize">{entry.entity}</TableCell>
                  <TableCell className="text-sm max-w-[250px] truncate">{entry.detail}</TableCell>
                  <TableCell>
                    {entry.severity && (
                      <Badge
                        variant="outline"
                        className={`text-[9px] ${
                          entry.severity === "critical"
                            ? "text-red-600 border-red-200"
                            : entry.severity === "high"
                              ? "text-orange-500 border-orange-200"
                              : entry.severity === "medium"
                                ? "text-amber-500 border-amber-200"
                                : "text-blue-500 border-blue-200"
                        }`}
                      >
                        {entry.severity}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── User Roles Tab ────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400",
  admin: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400",
  manager: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400",
  member: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400",
  viewer: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full access + can delete org",
  admin: "Full access except org deletion",
  manager: "View + edit data, run reconciliations",
  member: "View + edit data only",
  viewer: "Read-only access",
};

function UserRolesTab() {
  const { org, orgId, role: currentRole } = useOrg();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  // Current user info
  const currentUser = useMemo(() => ({
    email: org?.owner_email || "you@example.com",
    role: currentRole || "owner",
    name: org?.name ? `${org.name} Owner` : "You",
    joined: org?.created_at || new Date().toISOString(),
  }), [org, currentRole]);

  if (!orgId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Users className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Organization</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Complete onboarding to set up your organization before managing user roles.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Role Permissions Reference */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Shield className="h-4 w-4" />
            Role Permissions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
              <div key={role} className="text-center p-3 rounded-lg bg-muted/50">
                <Badge variant="outline" className={`text-[10px] mb-1.5 ${ROLE_COLORS[role] || ""}`}>
                  {role === "owner" && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Badge>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Members Table */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Organization Members</CardTitle>
            <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowInvite(true)}>
              <UserPlus className="h-3.5 w-3.5" />
              Invite User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Joined</TableHead>
                <TableHead className="text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-sm font-medium">{currentUser.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{currentUser.email}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${ROLE_COLORS[currentUser.role] || ""}`}>
                    {currentUser.role === "owner" && <Crown className="h-2.5 w-2.5 mr-0.5" />}
                    {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {currentUser.joined ? format(new Date(currentUser.joined), "dd MMM yyyy") : "—"}
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground">You</span>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>Send an invitation to join your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="colleague@example.com" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {ROLE_DESCRIPTIONS[inviteRole] || ""}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button
              disabled={!inviteEmail.trim() || !inviteEmail.includes("@")}
              onClick={() => {
                toast.info("User invitation is coming soon. The invite system will be available in a future update.");
                setShowInvite(false);
                setInviteEmail("");
              }}
              className="gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Client Management Tab ─────────────────────────────────────────────────

function ClientManagementTab() {
  const { orgId, clients } = useOrg();
  const { clientId } = useActiveClient();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    currency: "AED",
    country: "AE",
    industry: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    currency: "AED",
    country: "AE",
    industry: "",
  });

  const sortedClients = useMemo(
    () => [...clients].sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "")),
    [clients],
  );

  const handleAddClient = async () => {
    if (!orgId || !form.name.trim()) return;
    setSaving(true);
    try {
      await database.createClient(orgId, {
        name: form.name.trim(),
        currency: form.currency,
        country: form.country,
        industry: form.industry.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["org-data"] });
      toast.success("Client added successfully");
      setShowAdd(false);
      setForm({ name: "", currency: "AED", country: "AE", industry: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to add client");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (client: any) => {
    setEditClient(client);
    setEditForm({
      name: client.name || "",
      currency: client.currency || "AED",
      country: client.country || "AE",
      industry: client.industry || "",
    });
  };

  const handleEditClient = async () => {
    if (!editClient || !editForm.name.trim()) return;
    setSaving(true);
    try {
      await flaskApi.patch(`/clients/${editClient.id}`, {
        name: editForm.name.trim(),
        currency: editForm.currency,
        country: editForm.country,
        industry: editForm.industry.trim() || null,
      });
      queryClient.invalidateQueries({ queryKey: ["org-data"] });
      toast.success("Client updated");
      setEditClient(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update client");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async (client: any) => {
    const newStatus = client.status === "archived" ? "active" : "archived";
    try {
      await flaskApi.patch(`/clients/${client.id}`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["org-data"] });
      toast.success(newStatus === "archived" ? "Client archived" : "Client restored");
    } catch {
      toast.error("Failed to update client status");
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await flaskApi.del(`/clients/${id}`);
      queryClient.invalidateQueries({ queryKey: ["org-data"] });
      toast.success("Client deleted");
      setDeleteConfirm(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete client");
    }
  };

  if (!orgId) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Building2 className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Organization</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Complete onboarding to manage clients.
          </p>
        </CardContent>
      </Card>
    );
  }

  const CURRENCY_OPTIONS = [
    { value: "AED", label: "AED — UAE Dirham" },
    { value: "USD", label: "USD — US Dollar" },
    { value: "GBP", label: "GBP — British Pound" },
    { value: "EUR", label: "EUR — Euro" },
    { value: "INR", label: "INR — Indian Rupee" },
    { value: "SAR", label: "SAR — Saudi Riyal" },
  ];

  const COUNTRY_OPTIONS = [
    { value: "AE", label: "UAE" },
    { value: "US", label: "United States" },
    { value: "GB", label: "United Kingdom" },
    { value: "IN", label: "India" },
    { value: "SA", label: "Saudi Arabia" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {sortedClients.length} client{sortedClients.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
            {sortedClients.filter((c: any) => c.status !== "archived").length} active
          </Badge>
        </div>
        <Button size="sm" className="gap-1.5 text-xs" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add Client
        </Button>
      </div>

      {sortedClients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Building2 className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Clients Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Add your first client to start tracking their financial data.
            </p>
            <Button onClick={() => setShowAdd(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Currency</TableHead>
                  <TableHead className="text-xs">Country</TableHead>
                  <TableHead className="text-xs">Industry</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedClients.map((client: any) => (
                  <TableRow key={client.id} className={client.id === clientId ? "bg-primary/5" : ""}>
                    <TableCell className="text-sm font-medium">
                      <div className="flex items-center gap-1.5">
                        {client.name || "Untitled"}
                        {client.id === clientId && (
                          <Badge variant="outline" className="text-[9px] text-primary border-primary/30">Active</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{client.currency || "AED"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{client.country || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{client.industry || "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          client.status === "archived"
                            ? "text-muted-foreground border-muted"
                            : "text-green-600 border-green-200"
                        }`}
                      >
                        {client.status === "archived" ? "Archived" : "Active"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {client.created_at ? format(new Date(client.created_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => openEdit(client)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title={client.status === "archived" ? "Restore" : "Archive"}
                          onClick={() => handleArchiveToggle(client)}
                        >
                          {client.status === "archived" ? <Power className="h-3 w-3 text-green-500" /> : <Archive className="h-3 w-3 text-amber-500" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          title="Delete"
                          onClick={() => setDeleteConfirm(client.id)}
                          disabled={client.id === clientId}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>Add a new client to your organization.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input placeholder="e.g. Acme Trading LLC" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={form.country} onValueChange={(v) => setForm({ ...form, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input placeholder="e.g. Trading, Real Estate, Technology" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddClient} disabled={saving || !form.name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editClient} onOpenChange={() => setEditClient(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>Update client details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Company Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={editForm.currency} onValueChange={(v) => setEditForm({ ...editForm, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Select value={editForm.country} onValueChange={(v) => setEditForm({ ...editForm, country: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input value={editForm.industry} onChange={(e) => setEditForm({ ...editForm, industry: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClient(null)}>Cancel</Button>
            <Button onClick={handleEditClient} disabled={saving || !editForm.name.trim()} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Client
            </DialogTitle>
            <DialogDescription>
              This will permanently delete the client and all associated data (transactions, files, reconciliation sessions). This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDeleteClient(deleteConfirm)} className="gap-1.5">
              <Trash2 className="h-4 w-4" />
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Business Profile Tab ──────────────────────────────────────────────────

const INDUSTRIES = [
  "Accounting & Finance",
  "Construction & Real Estate",
  "E-Commerce",
  "Education",
  "Food & Beverage",
  "Healthcare",
  "Hospitality & Tourism",
  "IT & Technology",
  "Manufacturing",
  "Professional Services",
  "Retail & Trading",
  "Transportation & Logistics",
  "Other",
];

const CURRENCY_OPTIONS_BP = [
  { value: "AED", label: "AED — UAE Dirham" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "SAR", label: "SAR — Saudi Riyal" },
];

const COUNTRY_OPTIONS_BP = [
  { value: "AE", label: "UAE" },
  { value: "US", label: "United States" },
  { value: "GB", label: "United Kingdom" },
  { value: "IN", label: "India" },
  { value: "SA", label: "Saudi Arabia" },
  { value: "DE", label: "Germany" },
  { value: "SG", label: "Singapore" },
];

const FISCAL_MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

function BusinessProfileTab() {
  const { clientId, client } = useActiveClient();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [form, setForm] = useState({
    name: "",
    industry: "",
    currency: "AED",
    country: "AE",
    trade_license: "",
    trn: "",
    fiscal_year_start: 1,
    phone: "",
    email: "",
    address: "",
    description: "",
    website: "",
  });

  // Load client data into form
  useEffect(() => {
    if (client) {
      const meta = client.metadata || {};
      setForm({
        name: client.name || "",
        industry: client.industry || "",
        currency: client.currency || "AED",
        country: client.country || "AE",
        trade_license: client.trade_license || "",
        trn: client.trn || "",
        fiscal_year_start: client.fiscal_year_start || 1,
        phone: meta.phone || "",
        email: meta.email || "",
        address: meta.address || "",
        description: meta.description || "",
        website: meta.website || "",
      });
      setHasChanges(false);
    }
  }, [client]);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!clientId || !form.name.trim()) return;
    setSaving(true);
    try {
      await flaskApi.patch(`/clients/${clientId}`, {
        name: form.name.trim(),
        industry: form.industry || null,
        currency: form.currency,
        country: form.country,
        trade_license: form.trade_license.trim() || null,
        trn: form.trn.trim() || null,
        fiscal_year_start: form.fiscal_year_start,
        metadata: {
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          address: form.address.trim() || null,
          description: form.description.trim() || null,
          website: form.website.trim() || null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["org-data"] });
      toast.success("Business profile updated");
      setHasChanges(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (!clientId || !client) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Briefcase className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Active Client</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Select or create a client to manage its business profile.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Save bar */}
      {hasChanges && (
        <div className="sticky top-0 z-10 flex items-center justify-between bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2.5">
          <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">You have unsaved changes</p>
          <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving || !form.name.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      )}

      {/* Company Identity */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            Company Identity
          </CardTitle>
          <CardDescription className="text-xs">
            Core business information used across all modules
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Company Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Acme Trading LLC"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Business Sector *</Label>
              <Select value={form.industry} onValueChange={(v) => updateField("industry", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                This determines your Chart of Accounts template and category mapping
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Currency</Label>
              <Select value={form.currency} onValueChange={(v) => updateField("currency", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS_BP.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Country</Label>
              <Select value={form.country} onValueChange={(v) => updateField("country", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COUNTRY_OPTIONS_BP.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Fiscal Year Start</Label>
              <Select value={form.fiscal_year_start.toString()} onValueChange={(v) => updateField("fiscal_year_start", parseInt(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FISCAL_MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Trade License No.
              </Label>
              <Input
                value={form.trade_license}
                onChange={(e) => updateField("trade_license", e.target.value)}
                placeholder="e.g. 123456"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Hash className="h-3 w-3" />
                TRN (Tax Registration Number)
              </Label>
              <Input
                value={form.trn}
                onChange={(e) => updateField("trn", e.target.value)}
                placeholder="e.g. 100123456700003"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact & Details */}
      <Card className="stat-card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="h-4 w-4" />
            Contact & Details
          </CardTitle>
          <CardDescription className="text-xs">
            Additional business information for invoices, reports, and communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone
              </Label>
              <Input
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="e.g. +971 4 123 4567"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Mail className="h-3 w-3" />
                Business Email
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="e.g. info@company.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <Globe className="h-3 w-3" />
                Website
              </Label>
              <Input
                value={form.website}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="e.g. https://www.company.com"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Address
              </Label>
              <Input
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="e.g. Office 101, Business Bay, Dubai"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Business Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of your business activities..."
              rows={3}
              className="resize-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* Current Sector Summary */}
      <Card className="stat-card-hover border-primary/20 bg-primary/[0.02]">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Briefcase className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{form.industry || "No sector selected"}</p>
                <p className="text-xs text-muted-foreground">
                  {form.industry && SECTOR_ACCOUNTS[form.industry]
                    ? `${SECTOR_ACCOUNTS[form.industry].revenue.length} revenue + ${SECTOR_ACCOUNTS[form.industry].expense.length} expense accounts in template`
                    : "Select a sector to see tailored Chart of Accounts"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">{form.currency}</Badge>
              <Badge variant="outline" className="text-[10px]">{COUNTRY_OPTIONS_BP.find((c) => c.value === form.country)?.label || form.country}</Badge>
              <Badge variant="outline" className="text-[10px]">FY starts {FISCAL_MONTHS.find((m) => m.value === form.fiscal_year_start)?.label || "Jan"}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Business Profile
        </Button>
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="stat-card-hover">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
            {label}
          </span>
          <Icon className="h-4 w-4 text-muted-foreground/60" />
        </div>
        <span className={`text-xl font-bold ${color}`}>{value}</span>
        {sub && (
          <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function ControlSettings() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Control Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your business profile, Chart of Accounts, matching rules,
            thresholds, and audit trail.
          </p>
        </div>

        <Tabs defaultValue="profile">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="profile" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" />
              Business Profile
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-1.5">
              <BookOpen className="h-3.5 w-3.5" />
              Chart of Accounts
            </TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5">
              <GitMerge className="h-3.5 w-3.5" />
              Matching Rules
            </TabsTrigger>
            <TabsTrigger value="thresholds" className="gap-1.5">
              <Sliders className="h-3.5 w-3.5" />
              Thresholds & Alerts
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="h-3.5 w-3.5" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              User Roles
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              Clients
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-4">
            <BusinessProfileTab />
          </TabsContent>
          <TabsContent value="accounts" className="mt-4">
            <ChartOfAccountsTab />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <MatchingRulesTab />
          </TabsContent>
          <TabsContent value="thresholds" className="mt-4">
            <ThresholdsTab />
          </TabsContent>
          <TabsContent value="audit" className="mt-4">
            <AuditLogTab />
          </TabsContent>
          <TabsContent value="roles" className="mt-4">
            <UserRolesTab />
          </TabsContent>
          <TabsContent value="clients" className="mt-4">
            <ClientManagementTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
