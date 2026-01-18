DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_channels_settings'
      AND column_name = 'promotion_cost_type'
  ) THEN
    ALTER TABLE public.sales_channels_settings
      ADD COLUMN promotion_cost_type text NOT NULL DEFAULT 'fixed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_channels_settings'
      AND column_name = 'promotion_cost_percent'
  ) THEN
    ALTER TABLE public.sales_channels_settings
      ADD COLUMN promotion_cost_percent numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales_channels_settings'
      AND column_name = 'promotion_cost_percent_base'
  ) THEN
    ALTER TABLE public.sales_channels_settings
      ADD COLUMN promotion_cost_percent_base text NOT NULL DEFAULT 'gross';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_channels_settings'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'sales_channels_settings_promotion_cost_type_check'
  ) THEN
    ALTER TABLE public.sales_channels_settings
      ADD CONSTRAINT sales_channels_settings_promotion_cost_type_check
      CHECK (promotion_cost_type = ANY (ARRAY['fixed'::text, 'percent'::text]));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sales_channels_settings'
      AND constraint_type = 'CHECK'
      AND constraint_name = 'sales_channels_settings_promotion_cost_percent_base_check'
  ) THEN
    ALTER TABLE public.sales_channels_settings
      ADD CONSTRAINT sales_channels_settings_promotion_cost_percent_base_check
      CHECK (promotion_cost_percent_base = ANY (ARRAY['gross'::text, 'net'::text]));
  END IF;
END $$;
