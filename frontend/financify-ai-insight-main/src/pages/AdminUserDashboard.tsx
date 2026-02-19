import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { format, startOfYear, endOfYear } from "date-fns";
import { toast } from "sonner";
import { Layout } from "@/components/layout/Layout";
import MetricCards from "@/components/dashboard/MetricCards";
import MetricDetailSheet from "@/components/dashboard/MetricDetailSheet";
import { QuarterNavigator, getCurrentQuarter, useQuarterDates, type DateMode } from "@/components/dashboard/QuarterNavigator";
import OverviewTab from "@/components/dashboard/OverviewTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import RevenueTab from "@/components/dashboard/RevenueTab";
import TrendsTab from "@/components/dashboard/TrendsTab";
import TransactionsTab from "@/components/dashboard/TransactionsTab";
import AIInsightsTab from "@/components/dashboard/AIInsightsTab";
import { FilePlus } from "lucide-react";

interface UserDashboardData {
  invoices: any[];
  bills: any[];
  customers: any[];
  vendors: any[];
  transactions: any[];
  files: any[];
  analysis: any | null;
  summary: {
    total_income: number;
    total_expenses: number;
    net_balance: number;
    transaction_count: number;
  };
}

export default function AdminUserDashboard() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [userInfo, setUserInfo] = useState<{ email: string; full_name: string | null; created_at: string; roles: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

  // Date mode & navigation — mirrors Index.tsx
  const { year: initY } = getCurrentQuarter();
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [quarter, setQuarter] = useState(0);
  const [year, setYear] = useState(initY);
  const [customFrom, setCustomFrom] = useState(() => startOfYear(new Date()));
  const [customTo, setCustomTo] = useState(() => endOfYear(new Date()));
  const quarterDates = useQuarterDates(quarter, year);
  const quarterLabel = dateMode === "custom"
    ? `${format(customFrom, "MMM dd")} – ${format(customTo, "MMM dd, yyyy")}`
    : quarter === 0 ? `${year}` : `Q${quarter} ${year}`;

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [isAdmin, adminLoading, navigate]);

  useEffect(() => {
    if (!userId || !isAdmin) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [listRes, dataRes] = await Promise.all([
          supabase.functions.invoke("admin-users", { method: "GET" }),
          supabase.functions.invoke("admin-users", {
            method: "POST",
            body: { action: "get_user_data", user_id: userId },
          }),
        ]);

        if (listRes.error) throw listRes.error;
        if (dataRes.error) throw dataRes.error;

        const targetUser = listRes.data?.users?.find((u: any) => u.id === userId);
        if (targetUser) {
          setUserInfo({
            email: targetUser.email,
            full_name: targetUser.full_name,
            created_at: targetUser.created_at,
            roles: targetUser.roles,
          });
        }

        setData(dataRes.data);
      } catch (e: any) {
        toast.error(e.message || "Failed to load user data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, isAdmin]);

  // Convert raw transactions to the same format used in Index.tsx
  const transactions = useMemo(() => {
    return (data?.transactions || []).map((t: any) => ({
      id: t.id || Math.random().toString(),
      transaction_date: t.transaction_date,
      description: t.description,
      category: t.category,
      amount: Number(t.amount),
      file_id: t.file_id || "",
      user_id: userId || "",
      created_at: t.created_at || new Date().toISOString(),
    }));
  }, [data, userId]);

  // Filter by date range — same logic as Index.tsx
  const filteredTransactions = useMemo(() => {
    const from = dateMode === "custom" ? customFrom : quarterDates.from;
    const to = dateMode === "custom" ? customTo : quarterDates.to;
    return transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d >= from && d <= to;
    });
  }, [transactions, quarterDates, dateMode, customFrom, customTo]);

  // Derive currency from first file
  const currency = data?.files?.[0]?.currency || "USD";

  // Compute metrics from filtered transactions
  const totalIncome = filteredTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netSavings = totalIncome - totalExpenses;
  const avgTransaction = filteredTransactions.length > 0
    ? filteredTransactions.reduce((s, t) => s + Math.abs(t.amount), 0) / filteredTransactions.length
    : 0;

  const hasData = transactions.length > 0;

  if (adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <Layout>
      {/* Admin impersonation banner */}
      <div className="-mx-6 -mt-6 mb-6 bg-amber-500/10 border-b border-amber-500/30 px-6 py-2.5 flex items-center gap-3">
        <Eye className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-medium text-amber-700 flex-1">
          Admin View — Reading <strong>{userInfo?.full_name || userInfo?.email || "this user"}'s</strong> dashboard (read-only)
        </span>
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin")} className="gap-1.5 h-7 text-amber-700 hover:text-amber-900 hover:bg-amber-100">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Admin
        </Button>
      </div>

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              {userInfo?.full_name || userInfo?.email || "User Dashboard"}
              {userInfo?.roles?.includes("admin") && (
                <Badge className="bg-purple-500/15 text-purple-600 border-purple-500/30 text-xs">Admin</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              {userInfo?.email}
              {userInfo?.created_at && ` · Joined ${format(new Date(userInfo.created_at), "MMM d, yyyy")}`}
              {hasData && ` · ${filteredTransactions.length} transactions in ${quarterLabel}`}
            </p>
          </div>

          {/* Date navigator — for filtering, same as real dashboard */}
          {hasData && !loading && (
            <QuarterNavigator
              currentQuarter={quarter}
              currentYear={year}
              onNavigate={(q, y) => { setQuarter(q); setYear(y); }}
              mode={dateMode}
              onModeChange={setDateMode}
              customFrom={customFrom}
              customTo={customTo}
              onCustomDateChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
            />
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading user data…</p>
            </div>
          </div>
        )}

        {/* Metric Cards — same as real dashboard */}
        {!loading && hasData && (
          <MetricCards
            totalIncome={totalIncome}
            totalExpenses={totalExpenses}
            netSavings={netSavings}
            avgTransaction={avgTransaction}
            incomeCount={filteredTransactions.filter(t => t.amount > 0).length}
            expenseCount={filteredTransactions.filter(t => t.amount < 0).length}
            savingsRate={totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0}
            totalCount={filteredTransactions.length}
            currency={currency}
            onCardClick={(type) => setActiveMetric(type)}
          />
        )}

        <MetricDetailSheet
          metricType={activeMetric as any}
          transactions={filteredTransactions}
          currency={currency}
          onClose={() => setActiveMetric(null)}
        />

        {/* Tabs — same as real dashboard */}
        {!loading && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="flex-wrap h-auto gap-1">
              {hasData && (
                <>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trends">Trends</TabsTrigger>
                  <TabsTrigger value="expenses">Expenses</TabsTrigger>
                  <TabsTrigger value="revenue">Revenue</TabsTrigger>
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
                </>
              )}
              <TabsTrigger value="files" className="gap-1">
                <FilePlus className="w-3 h-3" />
                Files ({data?.files?.length || 0})
              </TabsTrigger>
            </TabsList>

            {hasData && (
              <>
                <TabsContent value="overview">
                  <OverviewTab transactions={filteredTransactions} currency={currency} />
                </TabsContent>
                <TabsContent value="trends">
                  <TrendsTab transactions={filteredTransactions} currency={currency} />
                </TabsContent>
                <TabsContent value="expenses">
                  <ExpensesTab transactions={filteredTransactions} currency={currency} quarterLabel={quarterLabel} />
                </TabsContent>
                <TabsContent value="revenue">
                  <RevenueTab transactions={filteredTransactions} currency={currency} quarterLabel={quarterLabel} />
                </TabsContent>
                <TabsContent value="transactions">
                  <TransactionsTab transactions={filteredTransactions} currency={currency} />
                </TabsContent>
                <TabsContent value="ai-insights">
                  <AIInsightsTab transactions={filteredTransactions} currency={currency} />
                </TabsContent>
              </>
            )}

            {/* Files tab */}
            <TabsContent value="files">
              <div className="rounded-xl border bg-card">
                {!data?.files?.length ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">No files uploaded by this user.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/30">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">File Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Bank</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Currency</th>
                        <th className="text-center px-4 py-3 font-medium text-muted-foreground">Transactions</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Uploaded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.files.map((f: any) => (
                        <tr key={f.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-medium">{f.file_name}</td>
                          <td className="px-4 py-3 text-muted-foreground">{f.bank_name}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">{f.currency}</Badge>
                          </td>
                          <td className="px-4 py-3 text-center">{f.total_transactions?.toLocaleString()}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(f.created_at), "MMM d, yyyy")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* No data state */}
        {!loading && !hasData && (
          <div className="text-center py-24 text-muted-foreground">
            <p className="text-lg font-medium mb-1">No financial data</p>
            <p className="text-sm">This user hasn't uploaded any bank statements yet.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
