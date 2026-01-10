-- Aggiunge i nuovi tipi di materiale TPU, PC e ASA alla tabella materials
-- Questo script aggiorna il constraint CHECK sulla colonna material_type

-- Rimuovi il vecchio constraint (se esiste con un nome specifico, potrebbe variare)
DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  -- Trova tutti i constraint CHECK sulla tabella materials che riguardano material_type
  FOR constraint_record IN
    SELECT conname, pg_get_constraintdef(oid) AS definition
    FROM pg_constraint
    WHERE conrelid = 'public.materials'::regclass
      AND contype = 'c'
      AND (pg_get_constraintdef(oid) LIKE '%material_type%' 
           OR conname LIKE '%material_type%')
  LOOP
    EXECUTE format('ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    RAISE NOTICE 'Constraint rimosso: % (definizione: %)', constraint_record.conname, constraint_record.definition;
  END LOOP;
  
  -- Prova anche a rimuovere con nomi comuni che PostgreSQL potrebbe generare
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_check;
  ALTER TABLE public.materials DROP CONSTRAINT IF EXISTS materials_material_type_check1;
END $$;

-- Aggiungi il nuovo constraint con tutti i tipi di materiale
ALTER TABLE materials 
ADD CONSTRAINT materials_material_type_check 
CHECK (material_type = ANY (ARRAY['PLA'::text, 'PETG'::text, 'ABS'::text, 'TPU'::text, 'PC'::text, 'ASA'::text]));

-- Verifica che il constraint sia stato applicato correttamente
DO $$
BEGIN
  RAISE NOTICE 'Constraint aggiornato con successo. Tipi di materiale disponibili: PLA, PETG, ABS, TPU, PC, ASA';
END $$;
