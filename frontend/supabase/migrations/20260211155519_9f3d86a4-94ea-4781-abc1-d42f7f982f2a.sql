
-- Add source_file_id to bills table
ALTER TABLE public.bills ADD COLUMN source_file_id uuid NULL REFERENCES public.uploaded_files(id) ON DELETE SET NULL;

-- Add source_file_id to invoices table
ALTER TABLE public.invoices ADD COLUMN source_file_id uuid NULL REFERENCES public.uploaded_files(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_bills_source_file_id ON public.bills(source_file_id);
CREATE INDEX idx_invoices_source_file_id ON public.invoices(source_file_id);
