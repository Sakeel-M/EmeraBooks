
-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'all',
  color TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories"
ON public.categories
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add category columns
ALTER TABLE public.vendors ADD COLUMN category text DEFAULT NULL;
ALTER TABLE public.bills ADD COLUMN category text DEFAULT NULL;
ALTER TABLE public.invoices ADD COLUMN category text DEFAULT NULL;

-- Add company profile columns to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN company_name text DEFAULT NULL,
ADD COLUMN company_email text DEFAULT NULL,
ADD COLUMN company_logo_url text DEFAULT NULL,
ADD COLUMN company_address_line1 text DEFAULT NULL,
ADD COLUMN company_address_line2 text DEFAULT NULL,
ADD COLUMN company_city text DEFAULT NULL,
ADD COLUMN company_state text DEFAULT NULL,
ADD COLUMN company_zip text DEFAULT NULL;
