
-- RLS policies for documents storage bucket (bucket already exists)
-- Users can upload to their own folder
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload own documents'
  ) THEN
    CREATE POLICY "Users can upload own documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can view own documents'
  ) THEN
    CREATE POLICY "Users can view own documents"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete own documents'
  ) THEN
    CREATE POLICY "Users can delete own documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update own documents'
  ) THEN
    CREATE POLICY "Users can update own documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
