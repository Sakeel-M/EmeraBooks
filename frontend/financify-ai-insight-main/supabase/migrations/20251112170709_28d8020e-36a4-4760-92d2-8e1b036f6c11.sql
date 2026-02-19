-- Allow public access to all tables temporarily (before authentication is added)

-- Uploaded Files policies
DROP POLICY IF EXISTS "Allow all access to uploaded_files" ON uploaded_files;

CREATE POLICY "Allow public file operations" ON uploaded_files
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Transactions policies  
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;

CREATE POLICY "Allow public transaction operations" ON transactions
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Analysis Results policies
DROP POLICY IF EXISTS "Allow all access to analysis_results" ON analysis_results;

CREATE POLICY "Allow public analysis operations" ON analysis_results
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Budgets policies
DROP POLICY IF EXISTS "Allow all access to budgets" ON budgets;

CREATE POLICY "Allow public budget operations" ON budgets
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- User Preferences policies
DROP POLICY IF EXISTS "Allow all access to user_preferences" ON user_preferences;

CREATE POLICY "Allow public preferences operations" ON user_preferences
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);