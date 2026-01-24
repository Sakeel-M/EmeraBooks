-- Create sync_logs table for tracking integration sync operations
CREATE TABLE public.sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES public.connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  sync_type TEXT NOT NULL, -- 'import' or 'export'
  entity_type TEXT NOT NULL, -- 'invoices', 'bills', 'customers', 'vendors', 'transactions'
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed'
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for users to manage their own sync logs
CREATE POLICY "Users manage own sync logs" 
ON public.sync_logs 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX idx_sync_logs_user_id ON public.sync_logs(user_id);
CREATE INDEX idx_sync_logs_connection_id ON public.sync_logs(connection_id);
CREATE INDEX idx_sync_logs_status ON public.sync_logs(status);