-- Create enum types
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.bill_status AS ENUM ('draft', 'pending', 'paid', 'overdue', 'cancelled');
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE public.inbox_item_status AS ENUM ('pending', 'reviewed', 'approved', 'rejected');
CREATE TYPE public.connection_status AS ENUM ('active', 'inactive', 'error');

-- Customers table
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  balance NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Vendors table
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  balance NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bank accounts table
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_name TEXT NOT NULL,
  account_number TEXT,
  bank_name TEXT NOT NULL,
  account_type TEXT,
  currency TEXT DEFAULT 'USD',
  balance NUMERIC DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Chart of accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  account_type public.account_type NOT NULL,
  parent_account_id UUID REFERENCES public.accounts(id),
  balance NUMERIC DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status public.invoice_status DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Invoice line items
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bills table
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT UNIQUE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  bill_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status public.bill_status DEFAULT 'draft',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bill line items
CREATE TABLE public.bill_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID REFERENCES public.bills(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Journal entries
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT UNIQUE NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Journal entry lines
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE CASCADE NOT NULL,
  account_id UUID REFERENCES public.accounts(id) NOT NULL,
  debit_amount NUMERIC DEFAULT 0,
  credit_amount NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inbox items (notifications/tasks)
CREATE TABLE public.inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT NOT NULL,
  status public.inbox_item_status DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  related_id UUID,
  related_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Documents storage
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  related_id UUID,
  related_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- External connections
CREATE TABLE public.connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_name TEXT NOT NULL,
  connection_type TEXT NOT NULL,
  status public.connection_status DEFAULT 'inactive',
  api_key TEXT,
  config JSONB,
  last_sync TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (allowing all operations for now - will add auth later)
CREATE POLICY "Allow all operations on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on bank_accounts" ON public.bank_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on bill_items" ON public.bill_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on journal_entries" ON public.journal_entries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on journal_entry_lines" ON public.journal_entry_lines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on inbox_items" ON public.inbox_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on documents" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on connections" ON public.connections FOR ALL USING (true) WITH CHECK (true);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_journal_entries_updated_at BEFORE UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inbox_items_updated_at BEFORE UPDATE ON public.inbox_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_connections_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default chart of accounts
INSERT INTO public.accounts (account_number, account_name, account_type, description) VALUES
  ('1000', 'Cash', 'asset', 'Cash and cash equivalents'),
  ('1200', 'Accounts Receivable', 'asset', 'Money owed by customers'),
  ('2000', 'Accounts Payable', 'liability', 'Money owed to vendors'),
  ('3000', 'Owner Equity', 'equity', 'Owner investment'),
  ('4000', 'Revenue', 'revenue', 'Income from sales'),
  ('5000', 'Cost of Goods Sold', 'expense', 'Direct costs'),
  ('6000', 'Operating Expenses', 'expense', 'Business operating costs');