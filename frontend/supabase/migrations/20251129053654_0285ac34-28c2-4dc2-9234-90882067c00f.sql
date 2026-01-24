-- Add user_id column to all main tables
ALTER TABLE uploaded_files ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE analysis_results ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE invoices ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bills ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE customers ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE vendors ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE bank_accounts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE budgets ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE user_preferences ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE documents ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE journal_entries ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE connections ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE inbox_items ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Delete existing test data (not tied to any user)
TRUNCATE uploaded_files, transactions, analysis_results, 
         invoices, invoice_items, bills, bill_items, 
         customers, vendors, budgets, bank_accounts,
         documents, journal_entries, journal_entry_lines,
         accounts, connections, inbox_items CASCADE;

-- Make user_id NOT NULL
ALTER TABLE uploaded_files ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE analysis_results ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE invoices ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE bills ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE customers ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE vendors ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE bank_accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE budgets ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE user_preferences ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE documents ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE journal_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE connections ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE inbox_items ALTER COLUMN user_id SET NOT NULL;

-- Create performance indexes
CREATE INDEX idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_analysis_results_user_id ON analysis_results(user_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_bills_user_id ON bills(user_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_vendors_user_id ON vendors(user_id);
CREATE INDEX idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_accounts_user_id ON accounts(user_id);

-- Drop old permissive policies
DROP POLICY IF EXISTS "Allow all operations on uploaded_files" ON uploaded_files;
DROP POLICY IF EXISTS "Allow public file operations" ON uploaded_files;
DROP POLICY IF EXISTS "Allow all operations on invoices" ON invoices;
DROP POLICY IF EXISTS "Allow all operations on bills" ON bills;
DROP POLICY IF EXISTS "Allow all operations on customers" ON customers;
DROP POLICY IF EXISTS "Allow all operations on vendors" ON vendors;
DROP POLICY IF EXISTS "Allow all operations on bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow all operations on budgets" ON budgets;
DROP POLICY IF EXISTS "Allow public budget operations" ON budgets;
DROP POLICY IF EXISTS "Allow all operations on documents" ON documents;
DROP POLICY IF EXISTS "Allow all operations on journal_entries" ON journal_entries;
DROP POLICY IF EXISTS "Allow all operations on accounts" ON accounts;
DROP POLICY IF EXISTS "Allow all operations on connections" ON connections;
DROP POLICY IF EXISTS "Allow all operations on inbox_items" ON inbox_items;
DROP POLICY IF EXISTS "Allow public transaction operations" ON transactions;
DROP POLICY IF EXISTS "Allow public analysis operations" ON analysis_results;
DROP POLICY IF EXISTS "Allow public preferences operations" ON user_preferences;
DROP POLICY IF EXISTS "Allow all operations on invoice_items" ON invoice_items;
DROP POLICY IF EXISTS "Allow all operations on bill_items" ON bill_items;
DROP POLICY IF EXISTS "Allow all operations on journal_entry_lines" ON journal_entry_lines;

-- Create user-scoped policies for main tables
CREATE POLICY "Users manage own files"
  ON uploaded_files FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own transactions"
  ON transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own analysis"
  ON analysis_results FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own invoices"
  ON invoices FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bills"
  ON bills FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own customers"
  ON customers FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own vendors"
  ON vendors FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own bank accounts"
  ON bank_accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own budgets"
  ON budgets FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own preferences"
  ON user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own documents"
  ON documents FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own journal entries"
  ON journal_entries FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own accounts"
  ON accounts FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own connections"
  ON connections FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users manage own inbox items"
  ON inbox_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for child tables (check parent's user_id)
CREATE POLICY "Users manage invoice items via parent"
  ON invoice_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices 
    WHERE invoices.id = invoice_items.invoice_id 
    AND invoices.user_id = auth.uid()
  ));

CREATE POLICY "Users manage bill items via parent"
  ON bill_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bills 
    WHERE bills.id = bill_items.bill_id 
    AND bills.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM bills 
    WHERE bills.id = bill_items.bill_id 
    AND bills.user_id = auth.uid()
  ));

CREATE POLICY "Users manage journal entry lines via parent"
  ON journal_entry_lines FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE journal_entries.id = journal_entry_lines.journal_entry_id 
    AND journal_entries.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM journal_entries 
    WHERE journal_entries.id = journal_entry_lines.journal_entry_id 
    AND journal_entries.user_id = auth.uid()
  ));