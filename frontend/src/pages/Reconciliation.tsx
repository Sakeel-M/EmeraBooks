import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { StepWizard } from "@/components/reconciliation/StepWizard";
import { ReconciliationSettings } from "@/components/reconciliation/ReconciliationSettings";
import { DataPreview } from "@/components/reconciliation/DataPreview";
import { ReconciliationSummary } from "@/components/reconciliation/ReconciliationSummary";
import { ResultsTabs } from "@/components/reconciliation/ResultsTabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Link2, AlertCircle, Loader2, RefreshCw, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  reconcileTransactions, 
  defaultSettings,
  type ReconciliationSettings as ReconciliationSettingsType,
  type ReconciliationResults,
  type BankTransaction,
  type OdooTransaction
} from "@/lib/reconciliation";

interface OdooConnection {
  id: string;
  connection_name: string;
  connection_type: string;
  status: string;
  config: {
    server_url?: string;
    database?: string;
    uid?: number;
    auth_method?: string;
  };
  api_key?: string;
}

interface UploadedFile {
  id: string;
  file_name: string;
  bank_name: string;
  total_transactions: number;
  created_at: string;
}

export default function Reconciliation() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  
  // Data states
  const [odooConnection, setOdooConnection] = useState<OdooConnection | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [odooTransactions, setOdooTransactions] = useState<OdooTransaction[]>([]);
  const [reconciliationResults, setReconciliationResults] = useState<ReconciliationResults | null>(null);
  
  // Settings state
  const [settings, setSettings] = useState<ReconciliationSettingsType>(defaultSettings);

  // Fetch Odoo connection on mount
  useEffect(() => {
    fetchOdooConnection();
    fetchUploadedFiles();
  }, []);

  const fetchOdooConnection = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('connection_type', 'odoo')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setOdooConnection(data as OdooConnection);
      }
    } catch (error) {
      console.error('Error fetching Odoo connection:', error);
    }
  };

  const fetchUploadedFiles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUploadedFiles(data || []);
    } catch (error) {
      console.error('Error fetching uploaded files:', error);
    }
  };

  const fetchBankTransactions = async (fileId: string) => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('file_id', fileId)
        .eq('user_id', user.id)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setBankTransactions(data || []);
    } catch (error) {
      console.error('Error fetching bank transactions:', error);
      toast.error('Failed to load bank transactions');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOdooTransactions = async () => {
    if (!odooConnection?.config) {
      toast.error('Odoo connection not configured properly');
      return [];
    }

    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('odoo-integration', {
        body: {
          action: 'fetch_data',
          params: {
            entity_type: 'payments',
            server_url: odooConnection.config.server_url,
            database: odooConnection.config.database,
            uid: odooConnection.config.uid,
            api_key: odooConnection.api_key,
            auth_method: odooConnection.config.auth_method || 'XML-RPC',
          }
        }
      });

      if (error) throw error;
      
      const transactions = data?.data || [];
      setOdooTransactions(transactions);
      return transactions;
    } catch (error) {
      console.error('Error fetching Odoo transactions:', error);
      toast.error('Failed to fetch Odoo transactions');
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (fileId: string) => {
    setSelectedFileId(fileId);
    await fetchBankTransactions(fileId);
  };

  const handleSettingsChange = (newSettings: ReconciliationSettingsType) => {
    setSettings(newSettings);
  };

  const handleRunReconciliation = async () => {
    if (!selectedFileId) {
      toast.error('Please select a bank statement file');
      return;
    }

    if (!odooConnection) {
      toast.error('Please connect to Odoo first');
      return;
    }

    try {
      setIsReconciling(true);
      setCurrentStep(3);

      // Fetch latest Odoo transactions
      const odooTxns = await fetchOdooTransactions();
      
      // Run reconciliation
      const results = reconcileTransactions(bankTransactions, odooTxns, settings);
      setReconciliationResults(results);
      
      setCurrentStep(4);
      toast.success('Reconciliation completed');
    } catch (error) {
      console.error('Reconciliation error:', error);
      toast.error('Reconciliation failed');
      setCurrentStep(2);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleAddToOdoo = async (transaction: { id: string; date: string; description: string; amount: number }) => {
    if (!odooConnection?.config) {
      toast.error('Odoo connection not configured');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('odoo-integration', {
        body: {
          action: 'push_data',
          params: {
            entity_type: 'payments',
            data: [{
              date: transaction.date,
              amount: transaction.amount,
              name: transaction.description,
              ref: `Bank Import - ${transaction.id}`
            }],
            server_url: odooConnection.config.server_url,
            database: odooConnection.config.database,
            uid: odooConnection.config.uid,
            api_key: odooConnection.api_key,
            auth_method: odooConnection.config.auth_method || 'XML-RPC',
          }
        }
      });

      if (error) throw error;
      
      toast.success('Transaction added to Odoo');
      // Re-run reconciliation
      handleRunReconciliation();
    } catch (error) {
      console.error('Error adding to Odoo:', error);
      toast.error('Failed to add transaction to Odoo');
    }
  };

  const handleNewReconciliation = () => {
    setCurrentStep(1);
    setReconciliationResults(null);
    setSelectedFileId(null);
    setBankTransactions([]);
    setOdooTransactions([]);
  };

  const handleExportReport = () => {
    if (!reconciliationResults) return;
    
    const report = {
      generatedAt: new Date().toISOString(),
      matchRate: reconciliationResults.matchRate,
      totalDiscrepancy: reconciliationResults.totalDiscrepancy,
      summary: {
        matched: reconciliationResults.matched.length,
        amountMismatches: reconciliationResults.amountMismatches.length,
        missingInOdoo: reconciliationResults.missingInOdoo.length,
        missingInBank: reconciliationResults.missingInBank.length,
        dateDiscrepancies: reconciliationResults.dateDiscrepancies.length,
        duplicates: reconciliationResults.duplicates.length,
      },
      details: reconciliationResults
    };
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-report-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported');
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Connect to Odoo</CardTitle>
              <CardDescription>
                Ensure your Odoo account is connected to proceed with reconciliation
              </CardDescription>
            </CardHeader>
            <CardContent>
              {odooConnection ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div className="flex-1">
                    <p className="font-medium text-green-800 dark:text-green-200">
                      Connected to Odoo
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {odooConnection.connection_name} • {odooConnection.config?.server_url}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    Active
                  </Badge>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="w-6 h-6 text-yellow-600" />
                  <div className="flex-1">
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Odoo Not Connected
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Please connect your Odoo account to proceed
                    </p>
                  </div>
                  <Button onClick={() => navigate('/integrations')} variant="outline">
                    <Link2 className="w-4 h-4 mr-2" />
                    Connect Odoo
                  </Button>
                </div>
              )}
              
              <div className="mt-6 flex justify-end">
                <Button 
                  onClick={() => setCurrentStep(2)} 
                  disabled={!odooConnection}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 2:
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DataPreview
              bankCount={bankTransactions.length}
              odooCount={odooTransactions.length}
              uploadedFiles={uploadedFiles}
              selectedFileId={selectedFileId}
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
            />
            <ReconciliationSettings
              settings={settings}
              onSettingsChange={handleSettingsChange}
            />
            <div className="lg:col-span-2 flex justify-between">
              <Button variant="outline" onClick={() => setCurrentStep(1)}>
                Back
              </Button>
              <Button 
                onClick={handleRunReconciliation}
                disabled={!selectedFileId || bankTransactions.length === 0 || isLoading}
              >
                Run Reconciliation
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center text-center">
                <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">Running Reconciliation</h3>
                <p className="text-muted-foreground">
                  Comparing {bankTransactions.length} bank transactions with Odoo data...
                </p>
              </div>
            </CardContent>
          </Card>
        );

      case 4:
        return reconciliationResults ? (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Reconciliation Results</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleNewReconciliation}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  New Reconciliation
                </Button>
                <Button onClick={handleExportReport}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>
            </div>

            <ReconciliationSummary
              matchRate={reconciliationResults.matchRate}
              matched={reconciliationResults.matched.length}
              amountMismatches={reconciliationResults.amountMismatches.length}
              missingInOdoo={reconciliationResults.missingInOdoo.length}
              missingInBank={reconciliationResults.missingInBank.length}
              dateDiscrepancies={reconciliationResults.dateDiscrepancies.length}
              duplicates={reconciliationResults.duplicates.length}
              totalDiscrepancy={reconciliationResults.totalDiscrepancy}
            />

            <ResultsTabs
              matched={reconciliationResults.matched}
              amountMismatches={reconciliationResults.amountMismatches}
              missingInOdoo={reconciliationResults.missingInOdoo}
              missingInBank={reconciliationResults.missingInBank}
              dateDiscrepancies={reconciliationResults.dateDiscrepancies}
              duplicates={reconciliationResults.duplicates}
              onAddToOdoo={handleAddToOdoo}
              odooConnection={odooConnection}
            />
          </div>
        ) : null;

      default:
        return null;
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reconciliation</h1>
          <p className="text-muted-foreground">
            Compare your bank statements with Odoo data to identify discrepancies
          </p>
        </div>

        <StepWizard
          currentStep={currentStep}
          steps={[
            { title: "Connect to Odoo", description: "Verify connection" },
            { title: "Select Data", description: "Choose files & settings" },
            { title: "Run Reconciliation", description: "Process data" },
            { title: "Review Results", description: "View discrepancies" },
          ]}
        />

        {renderStepContent()}
      </div>
    </Layout>
  );
}
