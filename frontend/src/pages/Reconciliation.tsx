import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { ReconciliationDashboard } from "@/components/reconciliation/ReconciliationDashboard";
import { ReconciliationDetail } from "@/components/reconciliation/ReconciliationDetail";
import { supabase } from "@/integrations/supabase/client";

interface BankAccount {
  id: string;
  account_name: string;
  bank_name: string;
  currency: string | null;
  balance: number | null;
}

interface ReconciliationRecord {
  id: string;
  bank_account_id: string;
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
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
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

    const [accountsRes, reconRes] = await Promise.all([
      supabase.from("bank_accounts").select("*").eq("user_id", user.id).eq("is_active", true),
      supabase.from("reconciliations").select("*").eq("user_id", user.id).order("period_end", { ascending: false }),
    ]);

    setBankAccounts(accountsRes.data || []);
    setReconciliations((reconRes.data as ReconciliationRecord[]) || []);
    setIsLoading(false);
  };

  if (selectedReconciliation) {
    return (
      <Layout>
        <ReconciliationDetail
          reconciliationId={selectedReconciliation}
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
        bankAccounts={bankAccounts}
        reconciliations={reconciliations}
        isLoading={isLoading}
        onSelectReconciliation={setSelectedReconciliation}
        onRefresh={fetchData}
      />
    </Layout>
  );
}
