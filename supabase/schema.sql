-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accessories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accessories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.accessory_pieces (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  accessory_id uuid NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  remaining_qty integer NOT NULL DEFAULT 0,
  purchase_account text NOT NULL CHECK (purchase_account = ANY (ARRAY['Fabio'::text, 'Mesmerized SRLS'::text])),
  purchased_from text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT accessory_pieces_pkey PRIMARY KEY (id),
  CONSTRAINT accessory_pieces_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id)
);
CREATE TABLE public.logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL,
  user_email text NOT NULL,
  action_type text NOT NULL CHECK (action_type = ANY (ARRAY['aggiunta_materiale'::text, 'modifica_materiale'::text, 'eliminazione_materiale'::text, 'aggiunta_modello'::text, 'modifica_modello'::text, 'eliminazione_modello'::text, 'aggiunta_prodotto'::text, 'modifica_prodotto'::text, 'eliminazione_prodotto'::text, 'aggiunta_accessorio'::text, 'modifica_accessorio'::text, 'eliminazione_accessorio'::text])),
  entity_type text NOT NULL CHECK (entity_type = ANY (ARRAY['materiale'::text, 'modello'::text, 'prodotto'::text, 'accessorio'::text])),
  entity_id uuid NOT NULL,
  entity_name text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id),
  CONSTRAINT logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.materials (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  cost_per_kg numeric,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  bobina_photo_url text,
  print_example_photo_url text,
  code text UNIQUE,
  status text NOT NULL DEFAULT 'disponibile'::text CHECK (status = ANY (ARRAY['disponibile'::text, 'esaurito'::text])),
  brand text NOT NULL,
  purchased_from text,
  color text NOT NULL,
  material_type text NOT NULL CHECK (material_type = ANY (ARRAY['PLA'::text, 'PETG'::text, 'ABS'::text, 'TPU'::text, 'PC'::text, 'ASA'::text])),
  color_hex text,
  CONSTRAINT materials_pkey PRIMARY KEY (id)
);
CREATE TABLE public.model_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT model_categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.models (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  weight_kg numeric NOT NULL,
  dimensions text,
  photo_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sku text UNIQUE,
  is_multimaterial boolean DEFAULT false,
  color1_weight_g numeric,
  color2_weight_g numeric,
  color3_weight_g numeric,
  color4_weight_g numeric,
  model_3mf_url text,
  category_id uuid,
  CONSTRAINT models_pkey PRIMARY KEY (id),
  CONSTRAINT models_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.model_categories(id)
);
CREATE TABLE public.product_accessories (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  accessory_id uuid NOT NULL,
  quantity_used integer NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  purchase_account text NOT NULL CHECK (purchase_account = ANY (ARRAY['Fabio'::text, 'Mesmerized SRLS'::text])),
  created_at timestamp with time zone DEFAULT now(),
  accessory_piece_id uuid,
  CONSTRAINT product_accessories_pkey PRIMARY KEY (id),
  CONSTRAINT product_accessories_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_accessories_accessory_id_fkey FOREIGN KEY (accessory_id) REFERENCES public.accessories(id),
  CONSTRAINT product_accessories_accessory_piece_id_fkey FOREIGN KEY (accessory_piece_id) REFERENCES public.accessory_pieces(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  model_id uuid NOT NULL,
  material_id uuid NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['in_coda'::text, 'in_stampa'::text, 'disponibile'::text, 'venduto'::text])),
  sale_price numeric NOT NULL,
  final_sale_price numeric,
  production_cost numeric NOT NULL,
  packaging_cost numeric DEFAULT 0,
  administrative_cost numeric DEFAULT 0,
  sold_at timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  sku text,
  product_photos ARRAY DEFAULT '{}'::text[],
  quantity integer NOT NULL DEFAULT 1,
  sales_channel text CHECK (sales_channel IS NULL OR (sales_channel = ANY (ARRAY['Vinted'::text, 'eBay'::text, 'Shopify'::text, 'Negozio Fisico'::text]))),
  quantity_sold integer,
  vat_regime text,
  extra_costs jsonb DEFAULT '[]'::jsonb,
  production_extra_costs jsonb DEFAULT '[]'::jsonb,
  multimaterial_mapping jsonb,
  spool_id uuid,
  queue_order integer,
  storage_location text CHECK (storage_location IS NULL OR (storage_location = ANY (ARRAY['Mesmerized SRLS'::text, 'Robe di Robertaebasta'::text]))),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id),
  CONSTRAINT products_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT products_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id),
  CONSTRAINT products_spool_id_fkey FOREIGN KEY (spool_id) REFERENCES public.spools(id)
);
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL,
  sku text NOT NULL,
  model_id uuid,
  model_name text,
  model_sku text,
  material_id uuid,
  material_brand text,
  material_type text,
  material_color text,
  material_color_hex text,
  quantity_sold integer NOT NULL DEFAULT 1,
  sale_price numeric NOT NULL,
  sales_channel text NOT NULL CHECK (sales_channel = ANY (ARRAY['Vinted'::text, 'eBay'::text, 'Shopify'::text, 'Negozio Fisico'::text])),
  vat_regime text,
  vat_rate numeric,
  production_cost_base numeric NOT NULL,
  production_extra_costs jsonb DEFAULT '[]'::jsonb,
  total_production_cost numeric NOT NULL,
  packaging_cost numeric NOT NULL DEFAULT 0,
  administrative_cost numeric NOT NULL DEFAULT 0,
  promotion_cost numeric NOT NULL DEFAULT 0,
  extra_costs jsonb DEFAULT '[]'::jsonb,
  total_costs numeric NOT NULL,
  revenue numeric NOT NULL,
  profit numeric NOT NULL,
  sold_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  vat_amount numeric DEFAULT 0,
  spool_id uuid,
  spool_purchase_account text CHECK (spool_purchase_account IS NULL OR (spool_purchase_account = ANY (ARRAY['Fabio'::text, 'Mesmerized SRLS'::text]))),
  production_cost_by_account jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT sales_model_id_fkey FOREIGN KEY (model_id) REFERENCES public.models(id),
  CONSTRAINT sales_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id),
  CONSTRAINT sales_spool_id_fkey FOREIGN KEY (spool_id) REFERENCES public.spools(id)
);
CREATE TABLE public.sales_channels_settings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  channel_name text NOT NULL UNIQUE CHECK (channel_name = ANY (ARRAY['Vinted'::text, 'eBay'::text, 'Shopify'::text, 'Negozio Fisico'::text])),
  promotion_cost_per_product numeric NOT NULL DEFAULT 0,
  packaging_cost numeric NOT NULL DEFAULT 0,
  administrative_base_cost numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  promotion_cost_type text NOT NULL DEFAULT 'fixed'::text CHECK (promotion_cost_type = ANY (ARRAY['fixed'::text, 'percent'::text])),
  promotion_cost_percent numeric NOT NULL DEFAULT 0,
  promotion_cost_percent_base text NOT NULL DEFAULT 'gross'::text CHECK (promotion_cost_percent_base = ANY (ARRAY['gross'::text, 'net'::text])),
  CONSTRAINT sales_channels_settings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.spools (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  material_id uuid NOT NULL,
  remaining_grams numeric NOT NULL DEFAULT 1000.00,
  purchase_account text NOT NULL CHECK (purchase_account = ANY (ARRAY['Fabio'::text, 'Mesmerized SRLS'::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  price numeric NOT NULL,
  purchased_from text NOT NULL,
  CONSTRAINT spools_pkey PRIMARY KEY (id),
  CONSTRAINT spools_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id)
);
CREATE TABLE public.vat_regimes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  vat_rate numeric NOT NULL,
  countries text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  country_code text,
  CONSTRAINT vat_regimes_pkey PRIMARY KEY (id)
);