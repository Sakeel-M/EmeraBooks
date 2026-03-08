-- ============================================================
-- EmeraBooks v2 — Full Rebuild Migration
-- Multi-tenant financial controls platform for accounting firms
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- TIER 0: ORGANIZATION & MULTI-TENANCY
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.organizations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  slug            text UNIQUE NOT NULL,
  logo_url        text,
  default_currency text NOT NULL DEFAULT 'USD',
  fiscal_year_start int NOT NULL DEFAULT 1,
  country         text NOT NULL DEFAULT 'AE',
  vat_rate        numeric(5,2) DEFAULT 5.00,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL,
  role            text NOT NULL DEFAULT 'member'
                    CHECK (role IN ('owner','admin','manager','member','viewer')),
  invited_email   text,
  accepted_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text NOT NULL,
  trade_license   text,
  trn             text,
  currency        text NOT NULL DEFAULT 'AED',
  country         text NOT NULL DEFAULT 'AE',
  industry        text,
  fiscal_year_start int NOT NULL DEFAULT 1,
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','archived','suspended')),
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_active_client (
  user_id         uuid PRIMARY KEY,
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- TIER 1: DATA SOURCES & INTEGRATIONS
-- ══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE public.integration_type AS ENUM (
    'erp','bank_api','bank_upload','pos','crm','inventory','payroll'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.v2_connection_status AS ENUM (
    'connected','disconnected','error','pending','revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.v2_connections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type            public.integration_type NOT NULL,
  provider        text NOT NULL,
  display_name    text NOT NULL,
  status          public.v2_connection_status NOT NULL DEFAULT 'pending',
  credentials     jsonb DEFAULT '{}',
  config          jsonb DEFAULT '{}',
  last_sync_at    timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v2_sync_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id   uuid NOT NULL REFERENCES public.v2_connections(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','completed','failed','partial')),
  records_fetched int DEFAULT 0,
  records_created int DEFAULT 0,
  records_updated int DEFAULT 0,
  error_log       jsonb DEFAULT '[]',
  started_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.v2_bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  connection_id   uuid REFERENCES public.v2_connections(id) ON DELETE SET NULL,
  account_name    text NOT NULL,
  account_number  text,
  bank_name       text NOT NULL,
  bank_code       text,
  currency        text NOT NULL DEFAULT 'AED',
  current_balance numeric(18,2) DEFAULT 0,
  last_statement_date date,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.v2_uploaded_files (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.v2_bank_accounts(id) ON DELETE SET NULL,
  uploaded_by     uuid NOT NULL,
  file_name       text NOT NULL,
  file_hash       text,
  file_size_bytes int,
  bank_name       text,
  currency        text,
  total_rows      int DEFAULT 0,
  period_start    date,
  period_end      date,
  processing_status text NOT NULL DEFAULT 'pending'
                    CHECK (processing_status IN ('pending','processing','completed','failed')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- TIER 2: CORE FINANCIAL DATA
-- ══════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE public.data_source AS ENUM (
    'bank_upload','bank_api','erp','pos','crm','manual','inventory'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.v2_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.v2_bank_accounts(id) ON DELETE SET NULL,
  source          public.data_source NOT NULL,
  source_ref      text,
  connection_id   uuid REFERENCES public.v2_connections(id) ON DELETE SET NULL,
  file_id         uuid REFERENCES public.v2_uploaded_files(id) ON DELETE SET NULL,
  transaction_date date NOT NULL,
  posted_date     date,
  description     text NOT NULL DEFAULT '',
  memo            text,
  amount          numeric(18,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'AED',
  category        text,
  subcategory     text,
  counterparty_name text,
  counterparty_id uuid,
  is_transfer     boolean DEFAULT false,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_txn_client_date ON public.v2_transactions(client_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_v2_txn_client_source ON public.v2_transactions(client_id, source);
CREATE INDEX IF NOT EXISTS idx_v2_txn_counterparty ON public.v2_transactions(client_id, counterparty_name);

CREATE TABLE IF NOT EXISTS public.v2_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code            text NOT NULL,
  name            text NOT NULL,
  type            text NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  parent_id       uuid REFERENCES public.v2_accounts(id),
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, code)
);

CREATE TABLE IF NOT EXISTS public.v2_vendors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  phone           text,
  trn             text,
  category        text,
  payment_terms   int DEFAULT 30,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

CREATE TABLE IF NOT EXISTS public.v2_customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  email           text,
  phone           text,
  trn             text,
  category        text,
  payment_terms   int DEFAULT 30,
  is_active       boolean NOT NULL DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, name)
);

CREATE TABLE IF NOT EXISTS public.v2_bills (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  vendor_id       uuid REFERENCES public.v2_vendors(id) ON DELETE SET NULL,
  source          public.data_source NOT NULL DEFAULT 'manual',
  source_ref      text,
  bill_number     text,
  bill_date       date NOT NULL,
  due_date        date,
  subtotal        numeric(18,2) NOT NULL,
  tax_amount      numeric(18,2) DEFAULT 0,
  total           numeric(18,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'AED',
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('draft','open','partial','paid','overdue','cancelled')),
  category        text,
  account_id      uuid REFERENCES public.v2_accounts(id),
  notes           text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_bills_client_status ON public.v2_bills(client_id, status);

CREATE TABLE IF NOT EXISTS public.v2_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  customer_id     uuid REFERENCES public.v2_customers(id) ON DELETE SET NULL,
  source          public.data_source NOT NULL DEFAULT 'manual',
  source_ref      text,
  invoice_number  text,
  invoice_date    date NOT NULL,
  due_date        date,
  subtotal        numeric(18,2) NOT NULL,
  tax_amount      numeric(18,2) DEFAULT 0,
  total           numeric(18,2) NOT NULL,
  currency        text NOT NULL DEFAULT 'AED',
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  category        text,
  account_id      uuid REFERENCES public.v2_accounts(id),
  notes           text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_invoices_client_status ON public.v2_invoices(client_id, status);

CREATE TABLE IF NOT EXISTS public.v2_payment_allocations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_id  uuid NOT NULL REFERENCES public.v2_transactions(id) ON DELETE CASCADE,
  bill_id         uuid REFERENCES public.v2_bills(id) ON DELETE CASCADE,
  invoice_id      uuid REFERENCES public.v2_invoices(id) ON DELETE CASCADE,
  amount          numeric(18,2) NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (bill_id IS NOT NULL OR invoice_id IS NOT NULL)
);

-- ══════════════════════════════════════════════════════════
-- TIER 3: RECONCILIATION ENGINE
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.v2_reconciliation_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  bank_account_id uuid REFERENCES public.v2_bank_accounts(id),
  recon_type      text NOT NULL DEFAULT 'bank'
                    CHECK (recon_type IN ('bank','payment_settlement','cross_system')),
  source_a        text NOT NULL,
  source_b        text NOT NULL,
  period_start    date NOT NULL,
  period_end      date NOT NULL,
  status          text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress','completed','finalized')),
  statement_ending_balance numeric(18,2),
  ledger_ending_balance    numeric(18,2),
  unreconciled_difference  numeric(18,2) DEFAULT 0,
  match_count     int DEFAULT 0,
  flag_count      int DEFAULT 0,
  match_rate      numeric(5,2) DEFAULT 0,
  finalized_by    uuid,
  finalized_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  CREATE TYPE public.v2_match_status AS ENUM ('matched','flagged','manual_match','excluded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.v2_reconciliation_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.v2_reconciliation_sessions(id) ON DELETE CASCADE,
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  source_a_id     uuid,
  source_a_date   date,
  source_a_desc   text,
  source_a_amount numeric(18,2),
  source_b_id     uuid,
  source_b_date   date,
  source_b_desc   text,
  source_b_amount numeric(18,2),
  status          public.v2_match_status NOT NULL DEFAULT 'flagged',
  match_quality   text CHECK (match_quality IN ('exact','near','manual')),
  flag_type       text CHECK (flag_type IN (
    'missing_in_source_a','missing_in_source_b',
    'amount_mismatch','date_mismatch','duplicate',
    'fee_variance','refund_unmatched'
  )),
  difference      numeric(18,2) DEFAULT 0,
  days_diff       int DEFAULT 0,
  resolution      text,
  resolved_by     uuid,
  resolved_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_recon_items_session ON public.v2_reconciliation_items(session_id, status);

CREATE TABLE IF NOT EXISTS public.v2_matching_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  recon_type      text NOT NULL DEFAULT 'bank',
  priority        int NOT NULL DEFAULT 100,
  is_active       boolean NOT NULL DEFAULT true,
  match_by_amount boolean NOT NULL DEFAULT true,
  match_by_date   boolean NOT NULL DEFAULT true,
  match_by_description boolean NOT NULL DEFAULT false,
  match_sign      boolean NOT NULL DEFAULT true,
  amount_tolerance_type text NOT NULL DEFAULT 'exact'
                    CHECK (amount_tolerance_type IN ('exact','cents','percent','fixed')),
  amount_tolerance_value numeric(10,4) DEFAULT 0,
  date_tolerance_days int NOT NULL DEFAULT 3,
  auto_match      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ══════════════════════════════════════════════════════════
-- TIER 4: RISK MONITORING & AUDIT
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.v2_risk_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  alert_type      text NOT NULL CHECK (alert_type IN (
    'unmatched_transaction','large_transaction','duplicate_payment',
    'overdue_receivable','variance_spike','missing_invoice',
    'fee_anomaly','balance_discrepancy','stale_reconciliation'
  )),
  severity        text NOT NULL DEFAULT 'medium'
                    CHECK (severity IN ('critical','high','medium','low','info')),
  title           text NOT NULL,
  description     text,
  entity_type     text,
  entity_id       uuid,
  amount          numeric(18,2),
  status          text NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','acknowledged','resolved','dismissed')),
  resolved_by     uuid,
  resolved_at     timestamptz,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_alerts_client_status ON public.v2_risk_alerts(client_id, status);

CREATE TABLE IF NOT EXISTS public.v2_variance_baselines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  metric_name     text NOT NULL,
  period_type     text NOT NULL DEFAULT 'monthly',
  baseline_value  numeric(18,2) NOT NULL,
  std_deviation   numeric(18,2),
  sample_count    int DEFAULT 0,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, metric_name, period_type)
);

CREATE TABLE IF NOT EXISTS public.v2_control_settings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  setting_key     text NOT NULL,
  setting_value   jsonb NOT NULL DEFAULT '{}',
  updated_by      uuid,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, setting_key)
);

CREATE TABLE IF NOT EXISTS public.v2_audit_logs (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id       uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  user_id         uuid NOT NULL,
  action          text NOT NULL,
  entity_type     text,
  entity_id       uuid,
  old_values      jsonb,
  new_values      jsonb,
  ip_address      inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_audit_org_time ON public.v2_audit_logs(org_id, created_at DESC);

-- ══════════════════════════════════════════════════════════
-- RLS HELPER FUNCTIONS
-- ══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.user_has_client_access(p_client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    JOIN public.org_members om ON om.org_id = c.org_id
    WHERE c.id = p_client_id
      AND om.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id AND user_id = auth.uid()
  );
$$;

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — TIER 0
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_select" ON public.organizations FOR SELECT USING (public.user_has_org_access(id));
CREATE POLICY "org_insert" ON public.organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "org_update" ON public.organizations FOR UPDATE USING (public.user_has_org_access(id));
CREATE POLICY "org_delete" ON public.organizations FOR DELETE USING (public.user_has_org_access(id));

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_members_select" ON public.org_members FOR SELECT USING (public.user_has_org_access(org_id));
CREATE POLICY "org_members_insert" ON public.org_members FOR INSERT WITH CHECK (user_id = auth.uid() OR public.user_has_org_access(org_id));
CREATE POLICY "org_members_update" ON public.org_members FOR UPDATE USING (public.user_has_org_access(org_id));
CREATE POLICY "org_members_delete" ON public.org_members FOR DELETE USING (public.user_has_org_access(org_id));

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients_select" ON public.clients FOR SELECT USING (public.user_has_org_access(org_id));
CREATE POLICY "clients_insert" ON public.clients FOR INSERT WITH CHECK (public.user_has_org_access(org_id));
CREATE POLICY "clients_update" ON public.clients FOR UPDATE USING (public.user_has_org_access(org_id));
CREATE POLICY "clients_delete" ON public.clients FOR DELETE USING (public.user_has_org_access(org_id));

ALTER TABLE public.user_active_client ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uac_select" ON public.user_active_client FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "uac_insert" ON public.user_active_client FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "uac_update" ON public.user_active_client FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "uac_delete" ON public.user_active_client FOR DELETE USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — TIER 1 (Data Sources)
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.v2_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conn_select" ON public.v2_connections FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "conn_insert" ON public.v2_connections FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "conn_update" ON public.v2_connections FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "conn_delete" ON public.v2_connections FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sync_select" ON public.v2_sync_runs FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "sync_insert" ON public.v2_sync_runs FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "sync_update" ON public.v2_sync_runs FOR UPDATE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ba_select" ON public.v2_bank_accounts FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "ba_insert" ON public.v2_bank_accounts FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "ba_update" ON public.v2_bank_accounts FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "ba_delete" ON public.v2_bank_accounts FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_uploaded_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "uf_select" ON public.v2_uploaded_files FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "uf_insert" ON public.v2_uploaded_files FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "uf_update" ON public.v2_uploaded_files FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "uf_delete" ON public.v2_uploaded_files FOR DELETE USING (public.user_has_client_access(client_id));

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — TIER 2 (Financial Data)
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.v2_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "txn_select" ON public.v2_transactions FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "txn_insert" ON public.v2_transactions FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "txn_update" ON public.v2_transactions FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "txn_delete" ON public.v2_transactions FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acct_select" ON public.v2_accounts FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "acct_insert" ON public.v2_accounts FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "acct_update" ON public.v2_accounts FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "acct_delete" ON public.v2_accounts FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vnd_select" ON public.v2_vendors FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "vnd_insert" ON public.v2_vendors FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "vnd_update" ON public.v2_vendors FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "vnd_delete" ON public.v2_vendors FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_select" ON public.v2_customers FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "cust_insert" ON public.v2_customers FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "cust_update" ON public.v2_customers FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "cust_delete" ON public.v2_customers FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_bills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bill_select" ON public.v2_bills FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "bill_insert" ON public.v2_bills FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "bill_update" ON public.v2_bills FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "bill_delete" ON public.v2_bills FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_select" ON public.v2_invoices FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "inv_insert" ON public.v2_invoices FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "inv_update" ON public.v2_invoices FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "inv_delete" ON public.v2_invoices FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pa_select" ON public.v2_payment_allocations FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "pa_insert" ON public.v2_payment_allocations FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "pa_update" ON public.v2_payment_allocations FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "pa_delete" ON public.v2_payment_allocations FOR DELETE USING (public.user_has_client_access(client_id));

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — TIER 3 (Reconciliation)
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.v2_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_select" ON public.v2_reconciliation_sessions FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "rs_insert" ON public.v2_reconciliation_sessions FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "rs_update" ON public.v2_reconciliation_sessions FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "rs_delete" ON public.v2_reconciliation_sessions FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_reconciliation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ri_select" ON public.v2_reconciliation_items FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "ri_insert" ON public.v2_reconciliation_items FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "ri_update" ON public.v2_reconciliation_items FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "ri_delete" ON public.v2_reconciliation_items FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_matching_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mr_select" ON public.v2_matching_rules FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "mr_insert" ON public.v2_matching_rules FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "mr_update" ON public.v2_matching_rules FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "mr_delete" ON public.v2_matching_rules FOR DELETE USING (public.user_has_client_access(client_id));

-- ══════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY — TIER 4 (Risk & Audit)
-- ══════════════════════════════════════════════════════════

ALTER TABLE public.v2_risk_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ra_select" ON public.v2_risk_alerts FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "ra_insert" ON public.v2_risk_alerts FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "ra_update" ON public.v2_risk_alerts FOR UPDATE USING (public.user_has_client_access(client_id));
CREATE POLICY "ra_delete" ON public.v2_risk_alerts FOR DELETE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_variance_baselines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vb_select" ON public.v2_variance_baselines FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "vb_insert" ON public.v2_variance_baselines FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "vb_update" ON public.v2_variance_baselines FOR UPDATE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_control_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cs_select" ON public.v2_control_settings FOR SELECT USING (public.user_has_client_access(client_id));
CREATE POLICY "cs_insert" ON public.v2_control_settings FOR INSERT WITH CHECK (public.user_has_client_access(client_id));
CREATE POLICY "cs_update" ON public.v2_control_settings FOR UPDATE USING (public.user_has_client_access(client_id));

ALTER TABLE public.v2_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "al_select" ON public.v2_audit_logs FOR SELECT USING (public.user_has_org_access(org_id));
CREATE POLICY "al_insert" ON public.v2_audit_logs FOR INSERT WITH CHECK (public.user_has_org_access(org_id));
