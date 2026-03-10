import { useState, useMemo } from "react";
import { Layout } from "@/components/layout/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  CreditCard,
  ShoppingCart,
  Users,
  Package,
  Wallet,
  Clock,
  FileSpreadsheet,
  CheckCircle2,
  Plug,
  ArrowRightLeft,
  BarChart3,
  Globe,
  Zap,
  Shield,
  Link2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Landmark,
  Smartphone,
  Truck,
  Receipt,
  Trash2,
} from "lucide-react";
import { useActiveClient } from "@/hooks/useActiveClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { database } from "@/lib/database";
import { flaskApi } from "@/lib/flaskApi";
import { toast } from "sonner";
import FileUpload from "@/components/FileUpload";
import { IntegrationCard } from "@/components/integrations/IntegrationCard";
import { formatDistanceToNow } from "date-fns";
import { formatAmount } from "@/lib/utils";
import { useDateRange } from "@/hooks/useDateRange";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";

// ── ERP Tab ───────────────────────────────────────────────────────────────

function ERPTab() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();

  const { data: connections = [] } = useQuery({
    queryKey: ["connections", clientId],
    queryFn: () => database.getConnections(clientId!),
    enabled: !!clientId,
  });

  const getConnection = (type: string) =>
    connections.find((c: any) => c.provider === type) || null;

  const handleConnect = async (type: string, credentials: any) => {
    await flaskApi.post(`/clients/${clientId}/connections`, {
      integration_type: type,
      credentials,
    });
    queryClient.invalidateQueries({ queryKey: ["connections", clientId] });
  };

  const handleDisconnect = async (type: string) => {
    const conn = getConnection(type);
    if (conn) {
      await flaskApi.del(`/clients/${clientId}/connections/${conn.id}`);
      queryClient.invalidateQueries({ queryKey: ["connections", clientId] });
    }
  };

  const handleSync = async (
    type: string,
    entityType: string,
    direction: "import" | "export",
  ) => {
    const conn = getConnection(type);
    if (!conn) throw new Error("Not connected");
    const result = await flaskApi.post<any>(
      `/clients/${clientId}/connections/${conn.id}/sync`,
      { entity_type: entityType, direction },
    );
    queryClient.invalidateQueries({ queryKey: ["connections", clientId] });
    return result;
  };

  const connectedCount = connections.filter(
    (c: any) => c.status === "connected",
  ).length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Connected"
          value={connectedCount.toString()}
          icon={CheckCircle2}
          color={connectedCount > 0 ? "text-green-600" : "text-muted-foreground"}
          sub="ERP systems"
        />
        <StatusCard
          label="Available"
          value="3"
          icon={Plug}
          color="text-primary"
          sub="integrations"
        />
        <StatusCard
          label="Last Sync"
          value={
            connections.length > 0
              ? connections
                  .filter((c: any) => c.last_sync_at)
                  .sort(
                    (a: any, b: any) =>
                      new Date(b.last_sync_at).getTime() -
                      new Date(a.last_sync_at).getTime(),
                  )[0]?.last_sync_at
                ? formatDistanceToNow(
                    new Date(
                      connections
                        .filter((c: any) => c.last_sync_at)
                        .sort(
                          (a: any, b: any) =>
                            new Date(b.last_sync_at).getTime() -
                            new Date(a.last_sync_at).getTime(),
                        )[0].last_sync_at,
                    ),
                    { addSuffix: true },
                  )
                : "Never"
              : "Never"
          }
          icon={Clock}
          color="text-muted-foreground"
        />
      </div>

      {/* ERP Cards */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
        <IntegrationCard
          name="Odoo"
          description="Connect your Odoo ERP to sync customers, vendors, invoices, bills, payments, journal entries, and chart of accounts."
          icon={<Building2 className="h-6 w-6 text-purple-600" />}
          type="odoo"
          connection={getConnection("odoo")}
          onConnect={(creds) => handleConnect("odoo", creds)}
          onDisconnect={() => handleDisconnect("odoo")}
          onSync={(entity, dir) => handleSync("odoo", entity, dir)}
        />
        <IntegrationCard
          name="QuickBooks Online"
          description="Connect QuickBooks to import/export invoices, bills, customers, vendors, and chart of accounts."
          icon={<Building2 className="h-6 w-6 text-green-600" />}
          type="quickbooks"
          connection={getConnection("quickbooks")}
          onConnect={(creds) => handleConnect("quickbooks", creds)}
          onDisconnect={() => handleDisconnect("quickbooks")}
          onSync={(entity, dir) => handleSync("quickbooks", entity, dir)}
        />
        <IntegrationCard
          name="Zoho Books"
          description="Connect Zoho Books to sync invoices, bills, contacts, bank transactions, and journal entries."
          icon={<Building2 className="h-6 w-6 text-red-500" />}
          type="zoho"
          connection={getConnection("zoho")}
          onConnect={(creds) => handleConnect("zoho", creds)}
          onDisconnect={() => handleDisconnect("zoho")}
          onSync={(entity, dir) => handleSync("zoho", entity, dir)}
        />
      </div>
    </div>
  );
}

// ── Banks Tab ─────────────────────────────────────────────────────────────

function BanksTab() {
  const { clientId, currency } = useActiveClient();
  const queryClient = useQueryClient();
  const { refreshDateRange } = useDateRange();
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: uploadedFiles = [] } = useQuery({
    queryKey: ["uploaded-files", clientId],
    queryFn: () => database.getUploadedFiles(clientId!),
    enabled: !!clientId,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts-integ", clientId],
    queryFn: () => database.getBankAccounts(clientId!),
    enabled: !!clientId,
  });

  const totalRows = uploadedFiles.reduce(
    (s: number, f: any) => s + (f.total_rows || 0),
    0,
  );

  const handleUploadSuccess = async (data: any) => {
    if (!clientId) return;
    try {
      // ── Duplicate check: same bank_name + total_rows = same statement ──
      const newBankName = data.bank_info?.bank_name || "";
      const newTotalRows = data.total_rows || 0;
      const duplicate = uploadedFiles.find(
        (f: any) => f.bank_name === newBankName && f.total_rows === newTotalRows,
      );
      if (duplicate) {
        toast.warning("This statement has already been uploaded", {
          description: `"${newBankName}" with ${newTotalRows} rows was already uploaded.`,
        });
        return;
      }

      // ── Currency mismatch check ──
      const newCurrency = data.bank_info?.currency || currency;
      if (uploadedFiles.length > 0) {
        const existingCurrency = uploadedFiles[0]?.currency;
        if (existingCurrency && newCurrency && existingCurrency !== newCurrency) {
          toast.error("Cannot upload statements with different currencies", {
            description: `Existing data uses ${existingCurrency}. This statement uses ${newCurrency}. Create a separate client for ${newCurrency} statements.`,
          });
          return;
        }
      }

      const file = await database.saveUploadedFile(clientId, {
        file_name: data.bank_info?.bank_name
          ? `${data.bank_info.bank_name} Statement`
          : "Bank Statement",
        bank_name: data.bank_info?.bank_name,
        currency: newCurrency,
        total_rows: data.total_rows,
      });

      await database.saveTransactions(
        clientId,
        file.id,
        data.full_data || data.data,
        data.bank_info?.currency || currency,
      );

      toast.success(
        `${data.total_rows} transactions saved for ${data.bank_info?.bank_name || "unknown bank"}`,
      );

      // Run sync pipeline to derive vendors, customers, bills, invoices, bank account, risk alerts
      try {
        const syncResult = await database.syncFileData(clientId, file.id);
        const parts: string[] = [];
        if (syncResult.vendors_created) parts.push(`${syncResult.vendors_created} vendors`);
        if (syncResult.customers_created) parts.push(`${syncResult.customers_created} customers`);
        if (syncResult.bills_created) parts.push(`${syncResult.bills_created} bills`);
        if (syncResult.invoices_created) parts.push(`${syncResult.invoices_created} invoices`);
        if (syncResult.alerts_created) parts.push(`${syncResult.alerts_created} alerts`);
        if (syncResult.bank_account_created) parts.push("bank account created");
        if (parts.length > 0) {
          toast.success(`Sync complete: ${parts.join(", ")}`);
        }
      } catch (syncErr: any) {
        console.warn("Sync failed:", syncErr);
        toast.warning("Transactions saved but sync failed — some pages may show incomplete data");
      }

      // Invalidate all caches so every page picks up fresh data
      const keys = [
        "uploaded-files", "transactions", "bank-accounts-integ", "bank-accounts",
        "cc-bills", "cc-invoices", "bills", "invoices", "vendors", "customers",
        "risk-alerts", "recent-txns", "recon-sessions", "flagged-items", "connections",
      ];
      keys.forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k, clientId] }),
      );
      // Refresh global date range — new file likely extends the date range
      refreshDateRange();
    } catch (err: any) {
      toast.error(err.message || "Failed to save transactions");
    }
  };

  const handleDeleteFile = async () => {
    if (!clientId || !deleteFileId) return;
    setIsDeleting(true);
    try {
      // Pre-flight: ensure backend is reachable before attempting delete
      try {
        await flaskApi.get("/health");
      } catch {
        toast.error("Backend server not reachable", {
          description: "Cannot delete file while the server is offline. Ensure Flask is running on port 5000.",
        });
        setIsDeleting(false);
        setDeleteFileId(null);
        return;
      }
      await database.deleteUploadedFile(clientId, deleteFileId);
      toast.success("File and all associated data deleted");
      const keys = [
        "uploaded-files", "transactions", "bank-accounts-integ", "bank-accounts",
        "cc-bills", "cc-invoices", "bills", "invoices", "vendors", "customers",
        "risk-alerts", "recent-txns", "recon-sessions", "flagged-items", "connections",
        "expense-bills", "expense-vendors", "expense-txns", "cash-txns", "cash-bank-accounts",
        "fr-txns", "fr-txns-prev",
      ];
      keys.forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k, clientId] }),
      );
      refreshDateRange();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete file");
    } finally {
      setIsDeleting(false);
      setDeleteFileId(null);
    }
  };

  return (
    <div className="space-y-5">
      <ConfirmDialog
        open={!!deleteFileId}
        onOpenChange={(open) => !open && setDeleteFileId(null)}
        title="Delete Uploaded File"
        description="This will permanently delete this file and all its transactions, bills, invoices, and related data. This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
        onConfirm={handleDeleteFile}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard
          label="Statements"
          value={uploadedFiles.length.toString()}
          icon={FileSpreadsheet}
          color="text-primary"
          sub="uploaded"
        />
        <StatusCard
          label="Total Rows"
          value={totalRows.toLocaleString()}
          icon={BarChart3}
          color="text-primary"
          sub="transactions parsed"
        />
        <StatusCard
          label="Bank Accounts"
          value={bankAccounts.length.toString()}
          icon={Landmark}
          color="text-primary"
          sub="detected"
        />
        <StatusCard
          label="Status"
          value={uploadedFiles.length > 0 ? "Active" : "Pending"}
          icon={uploadedFiles.length > 0 ? CheckCircle2 : Clock}
          color={
            uploadedFiles.length > 0 ? "text-green-600" : "text-amber-500"
          }
          sub={
            uploadedFiles.length > 0
              ? "Data flowing"
              : "Upload to start"
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload area */}
        <Card className="stat-card-hover">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Upload Bank Statement
            </CardTitle>
            <CardDescription className="text-xs">
              Supports Excel (.xlsx, .xls) and CSV files from any bank
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FileUpload onUploadSuccess={handleUploadSuccess} />
          </CardContent>
        </Card>

        {/* Previous uploads */}
        <div className="space-y-4">
          <Card className="stat-card-hover">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Uploaded Statements
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {uploadedFiles.length} files
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {uploadedFiles.length === 0 ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No statements uploaded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {uploadedFiles.map((f: any) => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {f.bank_name || f.file_name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {f.total_rows} rows
                          {f.currency ? ` · ${f.currency}` : ""}
                          {f.created_at
                            ? ` · ${formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant={
                          f.processing_status === "completed"
                            ? "default"
                            : "secondary"
                        }
                        className="text-[9px] shrink-0"
                      >
                        {f.processing_status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteFileId(f.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bank API — future */}
          <ProviderCard
            title="Bank API Connections"
            description="Automatic bank feeds via open banking APIs"
            providers={[
              { name: "Plaid", region: "US/CA/EU" },
              { name: "Lean Technologies", region: "UAE/GCC" },
              { name: "Salt Edge", region: "Global" },
            ]}
            phase="Phase 4"
          />
        </div>
      </div>
    </div>
  );
}

// ── POS Tab ───────────────────────────────────────────────────────────────

function POSTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Connected"
          value="0"
          icon={ShoppingCart}
          color="text-muted-foreground"
          sub="POS systems"
        />
        <StatusCard
          label="Available"
          value="4"
          icon={Plug}
          color="text-primary"
          sub="providers"
        />
        <StatusCard
          label="Sync Capability"
          value="Sales"
          icon={ArrowRightLeft}
          color="text-primary"
          sub="+ settlements"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          title="Square"
          description="Sync daily sales, itemized transactions, settlements, and refunds from Square POS."
          providers={[
            { name: "Transactions", region: "Real-time" },
            { name: "Settlements", region: "Daily" },
            { name: "Catalog", region: "Items + categories" },
          ]}
          phase="Phase 4"
          icon={<ShoppingCart className="h-5 w-5 text-blue-600" />}
        />
        <ProviderCard
          title="Lightspeed"
          description="Import sales, inventory movements, and customer data from Lightspeed Retail or Restaurant."
          providers={[
            { name: "Sales", region: "Real-time" },
            { name: "Inventory", region: "On-demand" },
            { name: "Customers", region: "Sync" },
          ]}
          phase="Phase 4"
          icon={<Zap className="h-5 w-5 text-orange-500" />}
        />
        <ProviderCard
          title="Toast"
          description="Restaurant POS integration — sync orders, payments, tips, and labor costs."
          providers={[
            { name: "Orders", region: "Real-time" },
            { name: "Payments", region: "Daily" },
            { name: "Labor", region: "Payroll sync" },
          ]}
          phase="Phase 4"
          icon={<Receipt className="h-5 w-5 text-red-500" />}
        />
        <ProviderCard
          title="Vend (Lightspeed X)"
          description="Retail POS — sync products, sales, customers, and registers."
          providers={[
            { name: "Products", region: "Full catalog" },
            { name: "Sales", region: "Register data" },
            { name: "Reports", region: "Daily summaries" },
          ]}
          phase="Phase 4"
          icon={<ShoppingCart className="h-5 w-5 text-green-600" />}
        />
      </div>
    </div>
  );
}

// ── CRM Tab ───────────────────────────────────────────────────────────────

function CRMTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Connected"
          value="0"
          icon={Users}
          color="text-muted-foreground"
          sub="CRM systems"
        />
        <StatusCard
          label="Available"
          value="3"
          icon={Plug}
          color="text-primary"
          sub="providers"
        />
        <StatusCard
          label="Data Types"
          value="Contacts"
          icon={ArrowRightLeft}
          color="text-primary"
          sub="+ deals + pipeline"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ProviderCard
          title="Salesforce"
          description="Sync contacts, opportunities, deals, and revenue pipeline from Salesforce CRM."
          providers={[
            { name: "Contacts", region: "Bi-directional" },
            { name: "Opportunities", region: "Pipeline" },
            { name: "Revenue", region: "Forecasts" },
          ]}
          phase="Phase 4"
          icon={<Globe className="h-5 w-5 text-blue-500" />}
        />
        <ProviderCard
          title="HubSpot"
          description="Import contacts, companies, deals, and activities from HubSpot CRM."
          providers={[
            { name: "Contacts", region: "Full sync" },
            { name: "Companies", region: "Enriched" },
            { name: "Deals", region: "Pipeline stages" },
          ]}
          phase="Phase 4"
          icon={<Users className="h-5 w-5 text-orange-500" />}
        />
        <ProviderCard
          title="Zoho CRM"
          description="Sync leads, contacts, deals, and quotes from Zoho CRM alongside Zoho Books."
          providers={[
            { name: "Leads", region: "Auto-import" },
            { name: "Contacts", region: "Bi-directional" },
            { name: "Deals", region: "Revenue tracking" },
          ]}
          phase="Phase 4"
          icon={<Globe className="h-5 w-5 text-red-500" />}
        />
      </div>
    </div>
  );
}

// ── Inventory Tab ─────────────────────────────────────────────────────────

function InventoryTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Connected"
          value="0"
          icon={Package}
          color="text-muted-foreground"
          sub="inventory systems"
        />
        <StatusCard
          label="Available"
          value="3"
          icon={Plug}
          color="text-primary"
          sub="providers"
        />
        <StatusCard
          label="Data Types"
          value="Stock"
          icon={ArrowRightLeft}
          color="text-primary"
          sub="+ POs + movements"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ProviderCard
          title="Cin7"
          description="Full inventory management — sync products, stock levels, purchase orders, and warehouses."
          providers={[
            { name: "Products", region: "Full catalog" },
            { name: "Stock", region: "Real-time levels" },
            { name: "Purchase Orders", region: "Auto-sync" },
          ]}
          phase="Phase 4"
          icon={<Package className="h-5 w-5 text-indigo-500" />}
        />
        <ProviderCard
          title="Odoo Inventory"
          description="Sync stock moves, deliveries, receipts, and manufacturing orders from Odoo."
          providers={[
            { name: "Stock Moves", region: "In/Out" },
            { name: "Deliveries", region: "Tracking" },
            { name: "Manufacturing", region: "BOM + Orders" },
          ]}
          phase="Phase 4"
          icon={<Truck className="h-5 w-5 text-purple-500" />}
        />
        <ProviderCard
          title="TradeGecko"
          description="Product catalog, warehouse stock, sales orders, and purchase orders."
          providers={[
            { name: "Catalog", region: "Products + variants" },
            { name: "Warehouses", region: "Multi-location" },
            { name: "Orders", region: "Sales + Purchase" },
          ]}
          phase="Phase 4"
          icon={<Package className="h-5 w-5 text-teal-500" />}
        />
      </div>
    </div>
  );
}

// ── Payroll Tab ───────────────────────────────────────────────────────────

function PayrollTab() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatusCard
          label="Connected"
          value="0"
          icon={Wallet}
          color="text-muted-foreground"
          sub="payroll systems"
        />
        <StatusCard
          label="Available"
          value="4"
          icon={Plug}
          color="text-primary"
          sub="providers"
        />
        <StatusCard
          label="Data Types"
          value="Salaries"
          icon={ArrowRightLeft}
          color="text-primary"
          sub="+ deductions + WPS"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ProviderCard
          title="WPS (UAE)"
          description="Import WPS salary files to auto-match payroll transactions against bank statements."
          providers={[
            { name: "Salary Records", region: "Monthly" },
            { name: "Employee List", region: "Active staff" },
            { name: "Allowances", region: "Breakdown" },
          ]}
          phase="Phase 4"
          icon={<Shield className="h-5 w-5 text-green-600" />}
          highlight
        />
        <ProviderCard
          title="Bayzat"
          description="UAE HR & payroll — sync employee records, salary runs, leave, and benefits."
          providers={[
            { name: "Payroll Runs", region: "Monthly" },
            { name: "Employees", region: "Full records" },
            { name: "Leave", region: "Accruals" },
          ]}
          phase="Phase 4"
          icon={<Smartphone className="h-5 w-5 text-blue-600" />}
        />
        <ProviderCard
          title="Gusto"
          description="US payroll — sync payroll runs, tax filings, employee records, and benefits."
          providers={[
            { name: "Payroll", region: "Bi-weekly/Monthly" },
            { name: "Tax Filings", region: "Auto-file" },
            { name: "Benefits", region: "Health + 401k" },
          ]}
          phase="Phase 4"
          icon={<Wallet className="h-5 w-5 text-orange-500" />}
        />
        <ProviderCard
          title="ADP"
          description="Enterprise payroll — sync payroll data, workforce analytics, and compliance reports."
          providers={[
            { name: "Payroll", region: "Enterprise" },
            { name: "Workforce", region: "Analytics" },
            { name: "Compliance", region: "Multi-country" },
          ]}
          phase="Phase 4"
          icon={<Building2 className="h-5 w-5 text-red-500" />}
        />
      </div>
    </div>
  );
}

// ── Helper Components ─────────────────────────────────────────────────────

function StatusCard({
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

function ProviderCard({
  title,
  description,
  providers,
  phase,
  icon,
  highlight,
}: {
  title: string;
  description: string;
  providers: { name: string; region: string }[];
  phase: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card
      className={`stat-card-hover ${highlight ? "border-primary/30 bg-primary/[0.02]" : ""}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {title}
              {highlight && (
                <Badge className="text-[9px] h-4" variant="default">
                  Recommended
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 line-clamp-2">
              {description}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Capabilities */}
        <div className="space-y-1.5">
          {providers.map((p) => (
            <div
              key={p.name}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-muted-foreground">{p.name}</span>
              <Badge variant="outline" className="text-[9px] h-4">
                {p.region}
              </Badge>
            </div>
          ))}
        </div>

        <Separator />

        {/* Phase badge + Coming Soon */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{phase}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            disabled
          >
            <Link2 className="h-3 w-3" />
            Connect
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Integrations() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold font-heading gradient-text">
            Integrations
          </h1>
          <p className="text-muted-foreground">
            Connect your data sources — banks, ERPs, POS, CRM, inventory, and
            payroll.
          </p>
        </div>

        <Tabs defaultValue="banks">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="banks" className="gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Banks
            </TabsTrigger>
            <TabsTrigger value="erp" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              ERP
            </TabsTrigger>
            <TabsTrigger value="pos" className="gap-1.5">
              <ShoppingCart className="h-3.5 w-3.5" />
              POS
            </TabsTrigger>
            <TabsTrigger value="crm" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              CRM
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="payroll" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Payroll
            </TabsTrigger>
          </TabsList>

          <TabsContent value="banks" className="mt-4">
            <BanksTab />
          </TabsContent>
          <TabsContent value="erp" className="mt-4">
            <ERPTab />
          </TabsContent>
          <TabsContent value="pos" className="mt-4">
            <POSTab />
          </TabsContent>
          <TabsContent value="crm" className="mt-4">
            <CRMTab />
          </TabsContent>
          <TabsContent value="inventory" className="mt-4">
            <InventoryTab />
          </TabsContent>
          <TabsContent value="payroll" className="mt-4">
            <PayrollTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
