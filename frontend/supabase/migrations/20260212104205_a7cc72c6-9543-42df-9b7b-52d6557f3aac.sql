
-- Reconciliations table
CREATE TABLE public.reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  statement_file_id uuid REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
  statement_ending_balance numeric DEFAULT 0,
  ledger_ending_balance numeric DEFAULT 0,
  unreconciled_difference numeric DEFAULT 0,
  finalized_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.reconciliations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own reconciliations" ON public.reconciliations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reconciliation items table
CREATE TABLE public.reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id uuid NOT NULL REFERENCES public.reconciliations(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  journal_entry_line_id uuid REFERENCES public.journal_entry_lines(id) ON DELETE SET NULL,
  statement_line_description text,
  statement_line_amount numeric NOT NULL DEFAULT 0,
  statement_line_date date,
  match_status text NOT NULL DEFAULT 'unmatched',
  flag_type text,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.reconciliation_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage reconciliation items via parent" ON public.reconciliation_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM reconciliations WHERE reconciliations.id = reconciliation_items.reconciliation_id AND reconciliations.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reconciliations WHERE reconciliations.id = reconciliation_items.reconciliation_id AND reconciliations.user_id = auth.uid())
  );

-- Add updated_at trigger for reconciliations
CREATE TRIGGER update_reconciliations_updated_at
  BEFORE UPDATE ON public.reconciliations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
