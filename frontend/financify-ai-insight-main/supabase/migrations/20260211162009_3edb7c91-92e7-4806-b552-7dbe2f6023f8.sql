
-- Change bills.source_file_id FK from ON DELETE SET NULL to ON DELETE CASCADE
ALTER TABLE public.bills DROP CONSTRAINT IF EXISTS bills_source_file_id_fkey;
ALTER TABLE public.bills ADD CONSTRAINT bills_source_file_id_fkey
  FOREIGN KEY (source_file_id) REFERENCES public.uploaded_files(id) ON DELETE CASCADE;

-- Change invoices.source_file_id FK from ON DELETE SET NULL to ON DELETE CASCADE
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_source_file_id_fkey;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_source_file_id_fkey
  FOREIGN KEY (source_file_id) REFERENCES public.uploaded_files(id) ON DELETE CASCADE;
