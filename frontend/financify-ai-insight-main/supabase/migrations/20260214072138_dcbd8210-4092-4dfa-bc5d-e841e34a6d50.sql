
-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true);

-- RLS policy: users can upload/manage their own logos
CREATE POLICY "Users upload own logos"
ON storage.objects FOR ALL
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add template settings to user_preferences
ALTER TABLE user_preferences
ADD COLUMN invoice_template text DEFAULT 'classic',
ADD COLUMN invoice_accent_color text DEFAULT '#1F4F2D',
ADD COLUMN invoice_show_tax boolean DEFAULT true,
ADD COLUMN invoice_show_terms boolean DEFAULT true,
ADD COLUMN invoice_show_notes boolean DEFAULT true,
ADD COLUMN invoice_footer_text text DEFAULT NULL;
