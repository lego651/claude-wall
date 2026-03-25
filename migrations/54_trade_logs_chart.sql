-- Add chart columns to trade_logs
ALTER TABLE trade_logs
  ADD COLUMN IF NOT EXISTS chart_url TEXT,
  ADD COLUMN IF NOT EXISTS chart_image_path TEXT;

-- Create private storage bucket for trade chart screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-charts',
  'trade-charts',
  false,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Users may only upload into their own user-id folder
CREATE POLICY "trade_charts_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'trade-charts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users may only read their own files
CREATE POLICY "trade_charts_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'trade-charts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users may only delete their own files
CREATE POLICY "trade_charts_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'trade-charts' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
