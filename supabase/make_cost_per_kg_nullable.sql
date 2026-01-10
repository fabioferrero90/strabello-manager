-- Rende nullable le colonne cost_per_kg e purchased_from nella tabella materials
-- Questo perché ora il costo viene calcolato dalle bobine (spools) e non più dai materiali
-- purchased_from è ora gestito a livello di bobina (spool) invece che a livello di materiale

-- Modifica cost_per_kg per permettere valori NULL
ALTER TABLE public.materials 
ALTER COLUMN cost_per_kg DROP NOT NULL;

-- Modifica purchased_from per permettere valori NULL
ALTER TABLE public.materials 
ALTER COLUMN purchased_from DROP NOT NULL;

-- Verifica che le modifiche siano state applicate
DO $$
DECLARE
  cost_column_nullable boolean;
  purchased_column_nullable boolean;
BEGIN
  -- Verifica cost_per_kg
  SELECT columns.is_nullable INTO cost_column_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materials'
    AND column_name = 'cost_per_kg';
  
  -- Verifica purchased_from
  SELECT columns.is_nullable INTO purchased_column_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'materials'
    AND column_name = 'purchased_from';
  
  IF cost_column_nullable THEN
    RAISE NOTICE 'Colonna cost_per_kg resa nullable con successo.';
  ELSE
    RAISE WARNING 'Attenzione: La colonna cost_per_kg potrebbe ancora essere NOT NULL. Verifica manualmente.';
  END IF;
  
  IF purchased_column_nullable THEN
    RAISE NOTICE 'Colonna purchased_from resa nullable con successo.';
  ELSE
    RAISE WARNING 'Attenzione: La colonna purchased_from potrebbe ancora essere NOT NULL. Verifica manualmente.';
  END IF;
END $$;
