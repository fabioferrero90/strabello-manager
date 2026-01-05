-- Script per configurare i bucket di storage per le immagini
-- Eseguire questo script nella SQL Editor di Supabase

-- Crea il bucket per le foto dei modelli (se non esiste già)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'model-photos',
  'model-photos',
  true, -- bucket pubblico per permettere l'accesso alle immagini
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Crea il bucket per le foto dei materiali (se non esiste già)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'material-photos',
  'material-photos',
  true, -- bucket pubblico per permettere l'accesso alle immagini
  5242880, -- 5MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy per permettere agli utenti autenticati di caricare immagini dei modelli
CREATE POLICY "Users can upload model photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'model-photos');

-- Policy per permettere agli utenti autenticati di aggiornare le immagini dei modelli
CREATE POLICY "Users can update model photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'model-photos');

-- Policy per permettere agli utenti autenticati di eliminare immagini dei modelli
CREATE POLICY "Users can delete model photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'model-photos');

-- Policy per permettere la lettura pubblica delle immagini dei modelli
CREATE POLICY "Public can view model photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'model-photos');

-- Policy per permettere agli utenti autenticati di caricare immagini dei materiali
CREATE POLICY "Users can upload material photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'material-photos');

-- Policy per permettere agli utenti autenticati di aggiornare le immagini dei materiali
CREATE POLICY "Users can update material photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'material-photos');

-- Policy per permettere agli utenti autenticati di eliminare immagini dei materiali
CREATE POLICY "Users can delete material photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'material-photos');

-- Policy per permettere la lettura pubblica delle immagini dei materiali
CREATE POLICY "Public can view material photos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'material-photos');

