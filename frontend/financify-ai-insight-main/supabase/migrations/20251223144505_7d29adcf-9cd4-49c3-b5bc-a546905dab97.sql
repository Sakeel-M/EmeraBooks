-- Create sync_log_records table to store individual synced records
CREATE TABLE public.sync_log_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sync_log_id uuid NOT NULL REFERENCES public.sync_logs(id) ON DELETE CASCADE,
  record_id uuid,
  external_id text,
  record_name text,
  record_data jsonb,
  status text DEFAULT 'success',
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_log_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Users can view sync records via parent sync_log
CREATE POLICY "Users view sync records via parent"
  ON public.sync_log_records FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sync_logs 
    WHERE sync_logs.id = sync_log_records.sync_log_id 
    AND sync_logs.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sync_logs 
    WHERE sync_logs.id = sync_log_records.sync_log_id 
    AND sync_logs.user_id = auth.uid()
  ));

-- Add index for faster lookups
CREATE INDEX idx_sync_log_records_sync_log_id ON public.sync_log_records(sync_log_id);