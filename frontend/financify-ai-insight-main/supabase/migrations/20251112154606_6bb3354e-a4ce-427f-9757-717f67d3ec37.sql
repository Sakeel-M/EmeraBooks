-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  file_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  country TEXT,
  bank_code TEXT,
  total_transactions INTEGER NOT NULL DEFAULT 0
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE NOT NULL,
  transaction_date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create analysis_results table
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ai_analysis JSONB NOT NULL,
  basic_statistics JSONB NOT NULL,
  data_overview JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  budget_amount DECIMAL NOT NULL,
  currency TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preferred_currency TEXT DEFAULT 'USD',
  theme TEXT DEFAULT 'light',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_file_id ON public.transactions(file_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category);
CREATE INDEX IF NOT EXISTS idx_analysis_file_id ON public.analysis_results(file_id);

-- Enable Row Level Security
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for public access (no auth required for now)
CREATE POLICY "Allow all access to uploaded_files" ON public.uploaded_files FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to analysis_results" ON public.analysis_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to budgets" ON public.budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to user_preferences" ON public.user_preferences FOR ALL USING (true) WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();