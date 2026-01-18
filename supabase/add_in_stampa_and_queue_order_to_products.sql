DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'queue_order'
  ) THEN
    ALTER TABLE public.products
      ADD COLUMN queue_order integer;
  END IF;
END $$;

DO $$
DECLARE
  status_constraint_name text;
BEGIN
  SELECT conname INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.products'::regclass
    AND contype = 'c'
    AND conname LIKE 'products_status_check%';

  IF status_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', status_constraint_name);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'products_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_status_check
      CHECK (status = ANY (ARRAY['in_coda'::text, 'in_stampa'::text, 'disponibile'::text, 'venduto'::text]));
  END IF;
END $$;

DO $$
BEGIN
  UPDATE public.products
  SET queue_order = ranked.rn
  FROM (
    SELECT id,
           row_number() OVER (ORDER BY created_at ASC, id ASC) AS rn
    FROM public.products
    WHERE status IN ('in_coda', 'in_stampa')
  ) AS ranked
  WHERE products.id = ranked.id
    AND products.queue_order IS NULL;
END $$;
