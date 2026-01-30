-- Aggiunge il file 3MF ai modelli
ALTER TABLE public.models
ADD COLUMN IF NOT EXISTS model_3mf_url text;
