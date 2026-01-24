import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, TrendingUp, PieChart, Lightbulb, AlertTriangle } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import DashboardMetrics from "@/components/DashboardMetrics";
import QuickActionsGrid from "@/components/QuickActionsGrid";
import FileUpload from "@/components/FileUpload";
import MetricsCards from "@/components/MetricsCards";
import SpendingCharts from "@/components/SpendingCharts";
import InsightsPanel from "@/components/InsightsPanel";
import TransactionTable from "@/components/TransactionTable";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { FinancialSummary } from "@/components/dashboard/FinancialSummary";
import { useToast } from "@/hooks/use-toast";
import { database } from "@/lib/database";
import { api } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

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
  const [uploadedData, setUploadedData] = useState<any>(null);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const { toast } = useToast();

  // Check authentication
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
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

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    const loadCurrentFile = async () => {
      const currentFileId = database.getCurrentFile();
      if (currentFileId) {
        const file = await database.getFileById(currentFileId);
        const transactions = await database.getTransactionsByFileId(currentFileId);
        const analysis = await database.getAnalysisByFileId(currentFileId);

        if (file && transactions.length > 0) {
          // Transform transactions to match expected format
          const transformedData = transactions.map(t => ({
            Date: t.transaction_date,
            Description: t.description,
            Category: t.category,
            Amount: parseFloat(t.amount.toString()),
          }));

          setUploadedData({ data: transformedData, full_data: transformedData, bank_info: {
            bank_name: file.bank_name,
            currency: file.currency,
            country: file.country || "",
            bank_code: file.bank_code || "",
          }});

          if (analysis) {
            setAnalysisData({
              ai_analysis: analysis.ai_analysis,
              basic_statistics: analysis.basic_statistics,
              bank_info: {
                bank_name: file.bank_name,
                currency: file.currency,
                country: file.country || "",
                bank_code: file.bank_code || "",
              },
              data_overview: analysis.data_overview,
            });
          }
        }
      }
    };

    loadCurrentFile();
  }, [user]);

  const handleFileUpload = async (data: any) => {
    if (!user) return;
    
    try {
      setIsAnalyzing(true);
      setAnalysisError(null);
      console.log("📦 Received data from backend:", data);
      console.log("📋 Data structure:", JSON.stringify(data, null, 2));
      
      // Validate backend response
      if (!data.full_data || !Array.isArray(data.full_data) || !data.bank_info) {
        console.error("❌ Invalid response:", data);
        throw new Error("Failed to process data");
      }

      setUploadedData(data);

      // Extract file name from first transaction or use default
      const fileName = data.full_data[0]?.["File Name"] || 
                       data.full_data[0]?.file_name ||
                       `${data.bank_info.bank_name} - ${new Date().toLocaleDateString()}`;

      console.log("💾 Saving file metadata...");
      const savedFile = await database.saveUploadedFile({
        file_name: fileName,
        bank_name: data.bank_info.bank_name,
        currency: data.bank_info.currency,
        country: data.bank_info.country || "",
        bank_code: data.bank_info.bank_code || "",
        total_transactions: data.total_rows,
      });

      if (!savedFile) {
        throw new Error("Failed to save file to database");
      }

      console.log("✅ File saved:", savedFile.id);
      console.log("💾 Saving transactions...");
      
      await database.saveTransactions(savedFile.id, data.full_data);
      console.log("✅ Transactions saved");

      console.log("🤖 Calling analysis API...");
      const analysis = await api.analyzeData(data.full_data, data.bank_info);
      console.log("✅ Analysis received:", analysis);
      
      setAnalysisData(analysis);

      console.log("💾 Saving analysis to database...");
      await database.saveAnalysis(savedFile.id, {
        ai_analysis: analysis.ai_analysis,
        basic_statistics: analysis.basic_statistics,
        data_overview: analysis.data_overview,
      });
      console.log("✅ Analysis saved");

      // Sync bank data to business records
      console.log("🔄 Syncing bank data to business records...");
      const syncResult = await database.syncBankDataToBusinessRecords(
        savedFile.id,
        data.full_data,
        data.bank_info.currency
      );
      console.log("✅ Sync complete:", syncResult);

      database.setCurrentFile(savedFile.id);

      toast({
        title: "Analysis Complete!",
        description: `Created ${syncResult.billsCreated} bills, ${syncResult.vendorsCreated} vendors, ${syncResult.invoicesCreated} invoices, and ${syncResult.customersCreated} customers from your bank data.`,
      });
    } catch (error: any) {
      console.error("❌ Upload error details:", error);
      console.error("❌ Error message:", error.message);
      console.error("❌ Error stack:", error.stack);
      
      setAnalysisError(error.message || "Could not analyze your data");
      toast({
        title: "Analysis Failed",
        description: error.message || "Could not analyze your data. Please try uploading again.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRetryAnalysis = async () => {
    if (!uploadedData?.full_data || !uploadedData?.bank_info) return;
    
    setIsAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const analysis = await api.analyzeData(uploadedData.full_data, uploadedData.bank_info);
      setAnalysisData(analysis);
      
      const currentFileId = database.getCurrentFile();
      if (currentFileId) {
        await database.saveAnalysis(currentFileId, {
          ai_analysis: analysis.ai_analysis,
          basic_statistics: analysis.basic_statistics,
          data_overview: analysis.data_overview,
        });
      }
      
      toast({ title: "Analysis Complete!", description: "Your data has been analyzed successfully." });
    } catch (error: any) {
      setAnalysisError(error.message || "Analysis failed");
      toast({ 
        title: "Analysis Failed", 
        description: error.message || "Please try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUploadAnother = () => {
    setUploadedData(null);
    setAnalysisData(null);
    setIsAnalyzing(false);
    setAnalysisError(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your business finances</p>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Bank Analytics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <DashboardMetrics />
            <QuickActionsGrid />
            <FinancialSummary />
            <RecentActivity />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {!uploadedData ? (
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-8 space-y-3">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary shadow-orange mb-4">
                    <Upload className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">Upload Your Bank Statement</h2>
                  <p className="text-lg text-muted-foreground">Get AI-powered insights into your spending patterns</p>
                </div>

                <FileUpload onUploadSuccess={handleFileUpload} />

                <div className="mt-12 grid md:grid-cols-3 gap-6">
                  <div className="text-center p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-orange transition-all">
                    <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
                      <PieChart className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">Smart Analysis</h3>
                    <p className="text-sm text-muted-foreground">AI analyzes spending patterns and trends</p>
                  </div>

                  <div className="text-center p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-orange transition-all">
                    <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
                      <Lightbulb className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">Personalized Tips</h3>
                    <p className="text-sm text-muted-foreground">Get recommendations to save money</p>
                  </div>

                  <div className="text-center p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-orange transition-all">
                    <div className="w-12 h-12 rounded-lg bg-secondary mx-auto mb-3 flex items-center justify-center">
                      <AlertTriangle className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">Risk Alerts</h3>
                    <p className="text-sm text-muted-foreground">Detect unusual spending patterns</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {isAnalyzing ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                      <p className="text-lg font-medium text-foreground">Analyzing your finances...</p>
                      <p className="text-sm text-muted-foreground">AI is processing your data</p>
                    </div>
                  </div>
                ) : analysisData ? (
                  <>
                    <div className="flex justify-end mb-4">
                      <Button variant="outline" onClick={handleUploadAnother} className="flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload Another Statement
                      </Button>
                    </div>
                    <MetricsCards analysisData={analysisData} />
                    <div className="grid lg:grid-cols-3 gap-6">
                      <div className="lg:col-span-2 space-y-6">
                        <SpendingCharts analysisData={analysisData} />
                        <TransactionTable data={uploadedData.data} />
                      </div>
                      <div className="lg:col-span-1">
                        <InsightsPanel analysisData={analysisData} />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 space-y-4">
                    <AlertTriangle className="w-12 h-12 text-yellow-500" />
                    <p className="text-lg font-medium text-foreground">Analysis unavailable</p>
                    <p className="text-sm text-muted-foreground max-w-md text-center">
                      {analysisError || "Could not load analysis data"}
                    </p>
                    <div className="flex gap-3">
                      <Button onClick={handleRetryAnalysis}>Retry Analysis</Button>
                      <Button variant="outline" onClick={handleUploadAnother}>Upload New File</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Index;
