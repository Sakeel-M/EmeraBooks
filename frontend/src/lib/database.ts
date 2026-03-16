import { flaskApi } from "@/lib/flaskApi";
import { getCanonicalCategory } from "@/lib/sectorMapping";

// ── Interfaces ───────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string;
  default_currency: string;
  country: string;
  vat_rate: number;
  fiscal_year_start: number;
}

export interface Client {
  id: string;
  org_id: string;
  name: string;
  currency: string;
  country: string;
  industry: string | null;
  trade_license: string | null;
  trn: string | null;
  status: string;
}

export interface UploadedFile {
  id: string;
  client_id: string;
  file_name: string;
  bank_name: string | null;
  currency: string | null;
  total_rows: number;
  processing_status: string;
  period_start: string | null;
  period_end: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  client_id: string;
  transaction_date: string;
  description: string;
  amount: number;
  currency: string;
  category: string | null;
  counterparty_name: string | null;
  source: string;
  file_id: string | null;
  created_at: string;
}

export interface BankAccount {
  id: string;
  client_id: string;
  account_name: string;
  account_number: string | null;
  bank_name: string;
  currency: string;
  current_balance: number;
  is_active: boolean;
  last_statement_date: string | null;
}

export interface ReconciliationSession {
  id: string;
  client_id: string;
  recon_type: string;
  source_a: string;
  source_b: string;
  period_start: string;
  period_end: string;
  status: string;
  match_count: number;
  flag_count: number;
  match_rate: number;
  unreconciled_difference: number;
  created_at: string;
}

export interface ReconciliationItem {
  id: string;
  session_id: string;
  source_a_id: string | null;
  source_a_date: string | null;
  source_a_desc: string | null;
  source_a_amount: number | null;
  source_b_id: string | null;
  source_b_date: string | null;
  source_b_desc: string | null;
  source_b_amount: number | null;
  status: string;
  match_quality: string | null;
  flag_type: string | null;
  difference: number;
  days_diff: number;
  resolution: string | null;
  reason?: string | null;
  txn_type?: string | null;
  txn_type_label?: string | null;
}

export interface MatchingRule {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  recon_type: string;
  priority: number;
  is_active: boolean;
  match_by_amount: boolean;
  match_by_date: boolean;
  match_by_description: boolean;
  match_sign: boolean;
  amount_tolerance_type: string;
  amount_tolerance_value: number;
  date_tolerance_days: number;
  auto_match: boolean;
}

export interface RiskAlert {
  id: string;
  client_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string | null;
  entity_type: string | null;
  entity_id: string | null;
  amount: number | null;
  status: string;
  created_at: string;
}

// ── Database Operations (all via Flask API) ─────────────────────────────

export const database = {

  // ── Organization & Client ────────────────────────────────────────────

  async createOrganization(data: {
    name: string;
    country: string;
    default_currency: string;
    vat_rate: number;
    fiscal_year_start: number;
  }): Promise<Organization> {
    return flaskApi.post<Organization>("/organizations", data);
  },

  async createClient(orgId: string, data: {
    name: string;
    currency: string;
    country: string;
    industry?: string;
    trade_license?: string;
    trn?: string;
  }): Promise<Client> {
    return flaskApi.post<Client>(`/organizations/${orgId}/clients`, data);
  },

  async getClients(orgId: string): Promise<Client[]> {
    return flaskApi.get<Client[]>(`/organizations/${orgId}/clients`);
  },

  // ── Bank Accounts ────────────────────────────────────────────────────

  async getBankAccounts(clientId: string): Promise<BankAccount[]> {
    return flaskApi.get<BankAccount[]>(`/clients/${clientId}/bank-accounts`);
  },

  async createBankAccount(clientId: string, data: {
    account_name: string;
    bank_name: string;
    account_number?: string;
    currency: string;
    current_balance?: number;
  }): Promise<BankAccount> {
    return flaskApi.post<BankAccount>(`/clients/${clientId}/bank-accounts`, data);
  },

  // ── Uploaded Files ───────────────────────────────────────────────────

  async saveUploadedFile(clientId: string, fileData: {
    file_name: string;
    bank_name?: string;
    currency?: string;
    total_rows?: number;
  }): Promise<UploadedFile> {
    return flaskApi.post<UploadedFile>(`/clients/${clientId}/files`, fileData);
  },

  async getUploadedFiles(clientId: string): Promise<UploadedFile[]> {
    return flaskApi.get<UploadedFile[]>(`/clients/${clientId}/files`);
  },

  async updateUploadedFile(clientId: string, fileId: string, data: { currency?: string; bank_name?: string; file_name?: string }): Promise<any> {
    return flaskApi.patch(`/clients/${clientId}/files/${fileId}`, data);
  },

  async deleteUploadedFile(clientId: string, fileId: string): Promise<void> {
    await flaskApi.del(`/clients/${clientId}/files/${fileId}`);
  },

  // ── Transactions ─────────────────────────────────────────────────────

  async saveTransactions(
    clientId: string,
    fileId: string,
    transactions: any[],
    currency: string = "AED"
  ): Promise<void> {
    // Resolve categories on the frontend before sending
    const rows = transactions.map((t) => {
      const rawCat = t.Category || t.category || "";
      const desc = t.Description || t.description || "";
      const merchant = t.MerchantName || t.counterparty_name || "";
      const category = getCanonicalCategory(rawCat, merchant, desc);
      const amount = parseFloat(t.Amount ?? t.amount ?? 0);
      const dateStr = t.Date || t.transaction_date || new Date().toISOString().slice(0, 10);

      return {
        source: "bank_upload",
        transaction_date: dateStr,
        description: desc,
        amount,
        category,
        counterparty_name: merchant || null,
        is_transfer: category === "Internal Transfer",
      };
    });

    await flaskApi.post(`/clients/${clientId}/transactions`, {
      file_id: fileId,
      currency,
      transactions: rows,
    });
  },

  async getTransactions(clientId: string, options?: {
    fileId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<Transaction[]> {
    const params = new URLSearchParams();
    if (options?.fileId) params.set("file_id", options.fileId);
    if (options?.startDate) params.set("start_date", options.startDate);
    if (options?.endDate) params.set("end_date", options.endDate);
    if (options?.limit) params.set("limit", String(options.limit));
    const qs = params.toString();
    return flaskApi.get<Transaction[]>(`/clients/${clientId}/transactions${qs ? `?${qs}` : ""}`);
  },

  async updateTransactionCategory(txnId: string, category: string): Promise<any> {
    return flaskApi.patch<any>(`/transactions/${txnId}`, { category });
  },

  async syncCategoryByKeywords(clientId: string, category: string, keywords: string[]): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/transactions/sync-category`, { category, keywords });
  },

  // ── Reconciliation Sessions ──────────────────────────────────────────

  async getReconciliationSessions(clientId: string): Promise<ReconciliationSession[]> {
    return flaskApi.get<ReconciliationSession[]>(`/clients/${clientId}/reconciliation/sessions`);
  },

  async createReconciliationSession(clientId: string, data: {
    bank_account_id?: string;
    recon_type?: string;
    source_a: string;
    source_b: string;
    period_start: string;
    period_end: string;
    statement_ending_balance?: number;
  }): Promise<ReconciliationSession> {
    return flaskApi.post<ReconciliationSession>(`/clients/${clientId}/reconciliation/sessions`, data);
  },

  async updateReconciliationSession(
    sessionId: string,
    updates: Partial<ReconciliationSession>
  ): Promise<void> {
    await flaskApi.patch(`/reconciliation/sessions/${sessionId}`, updates);
  },

  async deleteReconciliationSession(sessionId: string): Promise<void> {
    await flaskApi.del(`/reconciliation/sessions/${sessionId}`);
  },

  // ── Reconciliation Items ─────────────────────────────────────────────

  async saveReconciliationItems(
    clientId: string,
    sessionId: string,
    items: Omit<ReconciliationItem, "id" | "session_id">[]
  ): Promise<void> {
    await flaskApi.post(`/reconciliation/sessions/${sessionId}/items`, { items });
  },

  async getReconciliationItems(sessionId: string): Promise<ReconciliationItem[]> {
    return flaskApi.get<ReconciliationItem[]>(`/reconciliation/sessions/${sessionId}/items`);
  },

  async getFlaggedItems(clientId: string): Promise<ReconciliationItem[]> {
    return flaskApi.get<ReconciliationItem[]>(`/clients/${clientId}/reconciliation/flagged`);
  },

  async updateReconciliationItem(
    itemId: string,
    updates: { status?: string; resolution?: string; resolved_by?: string; match_quality?: string }
  ): Promise<void> {
    await flaskApi.patch(`/reconciliation/items/${itemId}`, updates);
  },

  // ── Matching Rules ───────────────────────────────────────────────────

  async getMatchingRules(clientId: string): Promise<MatchingRule[]> {
    return flaskApi.get<MatchingRule[]>(`/clients/${clientId}/matching-rules`);
  },

  async upsertMatchingRule(
    clientId: string,
    rule: Partial<MatchingRule> & { name: string }
  ): Promise<MatchingRule> {
    return flaskApi.put<MatchingRule>(`/clients/${clientId}/matching-rules`, rule);
  },

  async deleteMatchingRule(ruleId: string): Promise<void> {
    await flaskApi.del(`/matching-rules/${ruleId}`);
  },

  // ── Risk Alerts ──────────────────────────────────────────────────────

  async getRiskAlerts(clientId: string, options?: { status?: string; startDate?: string; endDate?: string }): Promise<RiskAlert[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.startDate) params.set("start_date", options.startDate);
    if (options?.endDate) params.set("end_date", options.endDate);
    const qs = params.toString();
    return flaskApi.get<RiskAlert[]>(`/clients/${clientId}/risk-alerts${qs ? `?${qs}` : ""}`);
  },

  async createRiskAlert(clientId: string, alert: {
    alert_type: string;
    severity: string;
    title: string;
    description?: string;
    entity_type?: string;
    entity_id?: string;
    amount?: number;
  }): Promise<void> {
    await flaskApi.post(`/clients/${clientId}/risk-alerts`, alert);
  },

  async updateRiskAlert(
    alertId: string,
    updates: { status: string; resolution?: string }
  ): Promise<void> {
    await flaskApi.patch(`/risk-alerts/${alertId}`, updates);
  },

  // ── Transaction Date Range ─────────────────────────────────────────

  async getTransactionDateRange(clientId: string): Promise<{ min_date: string | null; max_date: string | null }> {
    return flaskApi.get<{ min_date: string | null; max_date: string | null }>(`/clients/${clientId}/transactions/date-range`);
  },

  // ── Sync Pipeline ──────────────────────────────────────────────────

  async syncFileData(clientId: string, fileId: string): Promise<any> {
    return flaskApi.post(`/clients/${clientId}/sync`, { file_id: fileId });
  },

  // ── Connections (Integrations) ───────────────────────────────────────

  async getConnections(clientId: string): Promise<any[]> {
    return flaskApi.get<any[]>(`/clients/${clientId}/connections`);
  },

  // ── Invoices ─────────────────────────────────────────────────────────

  async getInvoices(clientId: string, options?: { status?: string; startDate?: string; endDate?: string; source?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.startDate) params.set("start_date", options.startDate);
    if (options?.endDate) params.set("end_date", options.endDate);
    if (options?.source) params.set("source", options.source);
    const qs = params.toString();
    return flaskApi.get<any[]>(`/clients/${clientId}/invoices${qs ? `?${qs}` : ""}`);
  },

  async createInvoice(clientId: string, data: any): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/invoices`, data);
  },

  // ── Bills ────────────────────────────────────────────────────────────

  async getBills(clientId: string, options?: { status?: string; startDate?: string; endDate?: string; source?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.status) params.set("status", options.status);
    if (options?.startDate) params.set("start_date", options.startDate);
    if (options?.endDate) params.set("end_date", options.endDate);
    if (options?.source) params.set("source", options.source);
    const qs = params.toString();
    return flaskApi.get<any[]>(`/clients/${clientId}/bills${qs ? `?${qs}` : ""}`);
  },

  async createBill(clientId: string, data: any): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/bills`, data);
  },

  // ── Vendors & Customers ──────────────────────────────────────────────

  async getVendors(clientId: string, options?: { source?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.source) params.set("source", options.source);
    const qs = params.toString();
    return flaskApi.get<any[]>(`/clients/${clientId}/vendors${qs ? `?${qs}` : ""}`);
  },

  async createVendor(clientId: string, data: {
    name: string;
    email?: string;
    phone?: string;
    trn?: string;
    category?: string;
    payment_terms?: number;
  }): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/vendors`, data);
  },

  async getCustomers(clientId: string, options?: { source?: string }): Promise<any[]> {
    const params = new URLSearchParams();
    if (options?.source) params.set("source", options.source);
    const qs = params.toString();
    return flaskApi.get<any[]>(`/clients/${clientId}/customers${qs ? `?${qs}` : ""}`);
  },

  async createCustomer(clientId: string, data: {
    name: string;
    email?: string;
    phone?: string;
    trn?: string;
    category?: string;
    payment_terms?: number;
  }): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/customers`, data);
  },

  // ── Audit Logs ───────────────────────────────────────────────────────

  async logAudit(orgId: string, data: {
    client_id?: string;
    action: string;
    entity_type?: string;
    entity_id?: string;
    old_values?: any;
    new_values?: any;
  }): Promise<void> {
    await flaskApi.post("/audit-logs", { org_id: orgId, ...data });
  },

  // ── Chart of Accounts ────────────────────────────────────────────────

  async getAccounts(clientId: string): Promise<any[]> {
    return flaskApi.get<any[]>(`/clients/${clientId}/accounts`);
  },

  async createAccount(clientId: string, data: {
    code: string;
    name: string;
    type: string;
    parent_id?: string;
    is_active?: boolean;
  }): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/accounts`, data);
  },

  async updateAccount(accountId: string, updates: {
    name?: string;
    code?: string;
    type?: string;
    is_active?: boolean;
  }): Promise<any> {
    return flaskApi.patch(`/accounts/${accountId}`, updates);
  },

  async deleteAccount(accountId: string): Promise<void> {
    await flaskApi.del(`/accounts/${accountId}`);
  },

  async importAccountTemplate(clientId: string, template: string, accounts: any[]): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/accounts/import-template`, { template, accounts });
  },

  // ── Control Settings ─────────────────────────────────────────────────

  async detectAnomalies(clientId: string): Promise<any> {
    return flaskApi.post<any>(`/clients/${clientId}/risk-alerts/detect-anomalies`);
  },

  async getControlSetting(clientId: string, key: string): Promise<any> {
    const result = await flaskApi.get<any>(`/clients/${clientId}/settings/${key}`);
    return result?.setting_value ?? null;
  },

  async setControlSetting(clientId: string, key: string, value: any): Promise<void> {
    await flaskApi.put(`/clients/${clientId}/settings/${key}`, { setting_value: value });
  },
};
