import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { database, type UploadedFile, type Transaction, type AnalysisResult } from "@/lib/database";
import { api } from "@/lib/api";
import { exportToCSV } from "@/lib/export";
import { formatAmount } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { Loader2, RefreshCw, Download, FilePlus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuarterNavigator, getCurrentQuarter, useQuarterDates, type DateMode } from "@/components/dashboard/QuarterNavigator";
import { startOfYear, endOfYear, format } from "date-fns";

import OverviewTab from "@/components/dashboard/OverviewTab";
import ExpensesTab from "@/components/dashboard/ExpensesTab";
import RevenueTab from "@/components/dashboard/RevenueTab";
import TrendsTab from "@/components/dashboard/TrendsTab";
import TransactionsTab from "@/components/dashboard/TransactionsTab";
import AIInsightsTab from "@/components/dashboard/AIInsightsTab";
import BasicInsightsTab from "@/components/dashboard/BasicInsightsTab";
import AddReportTab from "@/components/dashboard/AddReportTab";
import ManageReportsTab from "@/components/dashboard/ManageReportsTab";
import MetricDetailSheet from "@/components/dashboard/MetricDetailSheet";
import MetricCards from "@/components/dashboard/MetricCards";
import BankInfoCard from "@/components/dashboard/BankInfoCard";

export interface BankInfo {
  bank_name: string;
  currency: string;
  country: string;
  bank_code: string;
}

export interface AnalysisData {
  ai_analysis: any;
  basic_statistics: any;
  bank_info: BankInfo;
  data_overview: any;
}

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [activeMetric, setActiveMetric] = useState<string | null>(null);

  // Date mode & navigation
  const { quarter: initQ, year: initY } = getCurrentQuarter();
  const [dateMode, setDateMode] = useState<DateMode>("year");
  const [quarter, setQuarter] = useState(0);
  const [year, setYear] = useState(initY);
  const [customFrom, setCustomFrom] = useState(() => startOfYear(new Date()));
  const [customTo, setCustomTo] = useState(() => endOfYear(new Date()));
  const quarterDates = useQuarterDates(quarter, year);
  const quarterLabel = dateMode === "custom"
    ? `${format(customFrom, "MMM dd")} – ${format(customTo, "MMM dd, yyyy")}`
    : quarter === 0 ? `${year}` : `Q${quarter} ${year}`;

  // Filter transactions by selected date range
  const filteredTransactions = useMemo(() => {
    const from = dateMode === "custom" ? customFrom : quarterDates.from;
    const to = dateMode === "custom" ? customTo : quarterDates.to;
    return transactions.filter((t) => {
      const d = new Date(t.transaction_date);
      return d >= from && d <= to;
    });
  }, [transactions, quarterDates, dateMode, customFrom, customTo]);

  // Auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const loadFiles = useCallback(async () => {
    const allFiles = await database.getAllFiles();
    setFiles(allFiles);
    return allFiles;
  }, []);

  const loadFileData = useCallback(async (fileId: string) => {
    const file = await database.getFileById(fileId);
    if (!file) return;
    const txns = await database.getTransactionsByFileId(fileId);
    const analysis = await database.getAnalysisByFileId(fileId);
    const info: BankInfo = {
      bank_name: file.bank_name, currency: file.currency,
      country: file.country || "", bank_code: file.bank_code || "",
    };
    setTransactions(txns);
    setBankInfo(info);
    setCurrentFileId(fileId);
    database.setCurrentFile(fileId);
    if (analysis) {
      setAnalysisData({ ai_analysis: analysis.ai_analysis, basic_statistics: analysis.basic_statistics, bank_info: info, data_overview: analysis.data_overview });
    } else {
      setAnalysisData(null);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const init = async () => {
      const allFiles = await loadFiles();
      const savedFileId = database.getCurrentFile();
      if (savedFileId && allFiles.some((f) => f.id === savedFileId)) {
        await loadFileData(savedFileId);
      } else if (allFiles.length > 0) {
        await loadFileData(allFiles[0].id);
      } else {
        database.cleanupOrphanedData().catch(console.error);
        localStorage.removeItem("currentFileId");
        localStorage.removeItem("finance_current_file");
        localStorage.removeItem("finance_uploaded_files");
        setActiveTab("add-report");
      }
    };
    init();
  }, [user, loadFiles, loadFileData]);

  const handleFileUpload = async (data: any) => {
    if (!user) return;
    try {
      setIsAnalyzing(true);
      if (!data.full_data || !Array.isArray(data.full_data) || !data.bank_info) throw new Error("Failed to process data");
      const fileName = data.full_data[0]?.["File Name"] || data.full_data[0]?.file_name || `${data.bank_info.bank_name} - ${new Date().toLocaleDateString()}`;
      const savedFile = await database.saveUploadedFile({
        file_name: fileName, bank_name: data.bank_info.bank_name, currency: data.bank_info.currency,
        country: data.bank_info.country || "", bank_code: data.bank_info.bank_code || "", total_transactions: data.total_rows,
      });
      if (!savedFile) throw new Error("Failed to save file");
      await database.saveTransactions(savedFile.id, data.full_data);

      // Phase 1: Update UI immediately with transaction data
      database.setCurrentFile(savedFile.id);
      await loadFiles();
      await loadFileData(savedFile.id);
      setActiveTab("overview");
      setIsAnalyzing(false);
      toast({ title: "Data Loaded!", description: "Your transactions are ready. AI insights are being generated..." });

      // Phase 2: Run AI analysis in background (non-blocking)
      api.analyzeData(data.full_data, data.bank_info)
        .then(async (analysis) => {
          await database.saveAnalysis(savedFile.id, { ai_analysis: analysis.ai_analysis, basic_statistics: analysis.basic_statistics, data_overview: analysis.data_overview });
          await loadFileData(savedFile.id);
          toast({ title: "AI Insights Ready!", description: "Your financial analysis is now available." });
        })
        .catch((err) => {
          console.warn("AI analysis error:", err);
          toast({ title: "AI Analysis Pending", description: "You can re-analyze anytime using the Re-analyze button.", variant: "default" });
        });

      // Sync business records in background (non-blocking)
      database.syncBankDataToBusinessRecords(savedFile.id, data.full_data, data.bank_info.currency)
        .catch((err) => console.warn("Business records sync error:", err));
    } catch (error: any) {
      setIsAnalyzing(false);
      toast({ title: "Upload Failed", description: error.message || "Could not process your data.", variant: "destructive" });
    }
  };

  const handleReanalyze = async () => {
    if (!currentFileId || transactions.length === 0 || !bankInfo) return;
    setIsAnalyzing(true);
    try {
      const txnData = transactions.map((t) => ({ Date: t.transaction_date, Description: t.description, Category: t.category, Amount: t.amount }));
      const analysis = await api.analyzeData(txnData, bankInfo);
      await database.saveAnalysis(currentFileId, { ai_analysis: analysis.ai_analysis, basic_statistics: analysis.basic_statistics, data_overview: analysis.data_overview });
      setAnalysisData({ ...analysis, bank_info: bankInfo });
      toast({ title: "Re-analysis complete!" });
    } catch (error: any) {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = () => {
    if (filteredTransactions.length === 0) return;
    exportToCSV(filteredTransactions.map((t) => ({ Date: t.transaction_date, Description: t.description, Category: t.category, Amount: t.amount, Type: t.amount < 0 ? "Expense" : "Income" })), `financial-report-${quarterLabel}`);
  };

  const handleSelectFile = async (fileId: string) => { await loadFileData(fileId); setActiveTab("overview"); };
  const handleDeleteFile = async (fileId: string) => {
    if (fileId === currentFileId) {
      const remaining = files.filter((f) => f.id !== fileId);
      setFiles(remaining);
      if (remaining.length > 0) { await loadFileData(remaining[0].id); }
      else { setTransactions([]); setAnalysisData(null); setBankInfo(null); setCurrentFileId(null); setActiveTab("add-report"); }
    } else { setFiles((prev) => prev.filter((f) => f.id !== fileId)); }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return null;

  // Metrics from filtered transactions
  const totalIncome = filteredTransactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTransactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netSavings = totalIncome - totalExpenses;
  const avgTransaction = filteredTransactions.length > 0 ? filteredTransactions.reduce((s, t) => s + Math.abs(t.amount), 0) / filteredTransactions.length : 0;
  const currency = bankInfo?.currency || "USD";
  const fmtCur = (v: number) => formatAmount(v, currency);

  const hasData = transactions.length > 0;

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Home</h1>
            <p className="text-sm text-muted-foreground">
              {hasData ? `${filteredTransactions.length} transactions in ${quarterLabel}` : "Upload a report to get started"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasData && (
              <>
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
                <Button variant="outline" size="sm" onClick={handleReanalyze} disabled={isAnalyzing}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${isAnalyzing ? "animate-spin" : ""}`} />
                  Re-analyze
                </Button>
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  Export
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metric Cards */}
        {hasData && bankInfo && (
          <>
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
            
          </>
        )}

        <MetricDetailSheet metricType={activeMetric as any} transactions={filteredTransactions} currency={currency} onClose={() => setActiveMetric(null)} />

        {/* Tabs - always show Add Report and Manage Reports */}
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
                {analysisData && <TabsTrigger value="basic-insights">Basic Insights</TabsTrigger>}
              </>
            )}
            <TabsTrigger value="add-report" className="gap-1">
              <FilePlus className="w-3 h-3" />
              Add Report
            </TabsTrigger>
            <TabsTrigger value="manage-reports" className="gap-1">
              <FolderOpen className="w-3 h-3" />
              Manage Reports
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
              {analysisData && (
                <TabsContent value="basic-insights">
                  <BasicInsightsTab analysisData={analysisData} />
                </TabsContent>
              )}
            </>
          )}
          <TabsContent value="add-report">
            <AddReportTab onUploadSuccess={handleFileUpload} />
          </TabsContent>
          <TabsContent value="manage-reports">
            <ManageReportsTab files={files} currentFileId={currentFileId} onSelectFile={handleSelectFile} onDeleteFile={handleDeleteFile} />
          </TabsContent>
        </Tabs>

        {isAnalyzing && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-lg font-medium text-foreground">Analyzing your finances...</p>
              <p className="text-sm text-muted-foreground">AI is processing your data</p>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
