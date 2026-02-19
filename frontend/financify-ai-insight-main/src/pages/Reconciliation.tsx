import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { ReconciliationDashboard } from "@/components/reconciliation/ReconciliationDashboard";
import { ReconciliationDetail } from "@/components/reconciliation/ReconciliationDetail";
import { supabase } from "@/integrations/supabase/client";

interface UploadedFile {
  id: string;
  file_name: string;
  bank_name: string;
  currency: string;
  total_transactions: number;
  created_at: string;
}

interface ReconciliationRecord {
  id: string;
  bank_account_id: string | null;
  statement_file_id: string | null;
  period_start: string;
  period_end: string;
  status: string;
  statement_ending_balance: number;
  ledger_ending_balance: number;
  unreconciled_difference: number;
  finalized_at: string | null;
  created_at: string;
}

export default function Reconciliation() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [selectedReconciliation, setSelectedReconciliation] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [filesRes, reconRes] = await Promise.all([
      supabase.from("uploaded_files").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("reconciliations").select("*").eq("user_id", user.id).order("period_end", { ascending: false }),
    ]);

    setUploadedFiles(filesRes.data || []);
    setReconciliations((reconRes.data as ReconciliationRecord[]) || []);
    setIsLoading(false);
  };

  if (selectedReconciliation) {
    return (
      <Layout>
        <ReconciliationDetail
          reconciliationId={selectedReconciliation}
          uploadedFiles={uploadedFiles}
          onBack={() => {
            setSelectedReconciliation(null);
            fetchData();
          }}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <ReconciliationDashboard
        uploadedFiles={uploadedFiles}
        reconciliations={reconciliations}
        isLoading={isLoading}
        onSelectReconciliation={setSelectedReconciliation}
        onRefresh={fetchData}
      />
    </Layout>
  );
}
