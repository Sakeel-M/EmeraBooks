ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_account_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_account_number_key ON public.accounts (user_id, account_number);