-- Create payables_receivables table
CREATE TABLE public.payables_receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  due_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'settled')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'bank_statement', 'bill', 'invoice')),
  source_id UUID,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payables_receivables ENABLE ROW LEVEL SECURITY;

-- RLS Policy for users to manage their own records
CREATE POLICY "Users manage own payables_receivables"
  ON public.payables_receivables FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_payables_receivables_updated_at
  BEFORE UPDATE ON public.payables_receivables
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();