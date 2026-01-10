-- Aggiunge la colonna production_cost_by_account alla tabella sales
-- Questo script può essere eseguito direttamente nella console SQL di Supabase

-- Aggiungi il campo production_cost_by_account se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'sales' 
      AND column_name = 'production_cost_by_account'
  ) THEN
    ALTER TABLE public.sales 
    ADD COLUMN production_cost_by_account jsonb DEFAULT '[]'::jsonb;
    
    RAISE NOTICE 'Colonna production_cost_by_account aggiunta con successo alla tabella sales.';
  ELSE
    RAISE NOTICE 'La colonna production_cost_by_account esiste già nella tabella sales.';
  END IF;
END $$;

-- Verifica che la colonna sia stata creata
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'sales'
  AND column_name = 'production_cost_by_account';
