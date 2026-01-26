-- Add storage location for products

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS storage_location text;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO constraint_name
  FROM information_schema.table_constraints tc
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'products'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name = 'products_storage_location_check';

  IF constraint_name IS NULL THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_storage_location_check
      CHECK (storage_location IS NULL OR (storage_location = ANY (ARRAY['Mesmerized SRLS'::text, 'Robe di Robertaebasta'::text])));
  END IF;
END $$;
