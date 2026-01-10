-- Aggiunge i campi spool_id e spool_purchase_account alla tabella sales
-- e aggiorna retroattivamente le vendite esistenti con le informazioni delle bobine

-- 1. Aggiungi i campi se non esistono già
DO $$
BEGIN
  -- Aggiungi spool_id se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'spool_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN spool_id uuid;
    ALTER TABLE sales ADD CONSTRAINT sales_spool_id_fkey 
      FOREIGN KEY (spool_id) REFERENCES spools(id);
  END IF;

  -- Aggiungi spool_purchase_account se non esiste
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'spool_purchase_account'
  ) THEN
    ALTER TABLE sales ADD COLUMN spool_purchase_account text 
      CHECK (spool_purchase_account IS NULL OR (spool_purchase_account = ANY (ARRAY['Fabio'::text, 'Mesmerized SRLS'::text])));
  END IF;
END $$;

-- 2. Aggiorna le vendite esistenti con le informazioni delle bobine dai prodotti
-- Per prodotti non multimateriale: usa spool_id direttamente dal prodotto
UPDATE sales s
SET 
  spool_id = p.spool_id,
  spool_purchase_account = sp.purchase_account
FROM products p
LEFT JOIN spools sp ON p.spool_id = sp.id
WHERE s.product_id = p.id
  AND p.spool_id IS NOT NULL
  AND (s.spool_id IS NULL OR s.spool_purchase_account IS NULL);

-- 3. Per prodotti multimateriale: usa la bobina del primo colore (color1)
-- che è quella usata come material_id principale
UPDATE sales s
SET 
  spool_id = (p.multimaterial_mapping->0->>'spool_id')::uuid,
  spool_purchase_account = sp.purchase_account
FROM products p
LEFT JOIN models m ON p.model_id = m.id
LEFT JOIN spools sp ON (p.multimaterial_mapping->0->>'spool_id')::uuid = sp.id
WHERE s.product_id = p.id
  AND m.is_multimaterial = true
  AND p.multimaterial_mapping IS NOT NULL
  AND p.multimaterial_mapping->0->>'spool_id' IS NOT NULL
  AND (s.spool_id IS NULL OR s.spool_purchase_account IS NULL)
  AND (p.multimaterial_mapping->0->>'spool_id')::uuid IS NOT NULL;

-- 4. Aggiungi il campo production_cost_by_account se non esiste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sales' AND column_name = 'production_cost_by_account'
  ) THEN
    ALTER TABLE sales ADD COLUMN production_cost_by_account jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- 5. Calcola production_cost_by_account retroattivamente per prodotti non multimateriale
UPDATE sales s
SET production_cost_by_account = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'account', sp.purchase_account,
        'cost', ROUND(
          (m.weight_kg * sp.price)::numeric, 
          2
        )
      )
    )
    FROM products p
    JOIN models m ON p.model_id = m.id
    JOIN spools sp ON p.spool_id = sp.id
    WHERE s.product_id = p.id
      AND p.spool_id IS NOT NULL
      AND m.is_multimaterial = false
      AND sp.purchase_account IS NOT NULL
  ),
  '[]'::jsonb
)
WHERE EXISTS (
  SELECT 1 
  FROM products p
  JOIN models m ON p.model_id = m.id
  WHERE s.product_id = p.id
    AND m.is_multimaterial = false
    AND p.spool_id IS NOT NULL
)
AND (s.production_cost_by_account IS NULL OR s.production_cost_by_account = '[]'::jsonb);

-- 6. Calcola production_cost_by_account retroattivamente per prodotti multimateriale
-- Usa i pesi dal modello (color1_weight_g, color2_weight_g, ecc.) basandosi sul campo 'color' nel mapping
UPDATE sales s
SET production_cost_by_account = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'account', account_total.account,
        'cost', ROUND(account_total.total_cost::numeric, 2)
      )
    )
    FROM (
      SELECT 
        sp.purchase_account AS account,
        SUM(
          CASE 
            WHEN CAST(mapping_elem->>'color' AS integer) = 1 THEN (COALESCE(m.color1_weight_g, 0) / 1000.0) * sp.price
            WHEN CAST(mapping_elem->>'color' AS integer) = 2 THEN (COALESCE(m.color2_weight_g, 0) / 1000.0) * sp.price
            WHEN CAST(mapping_elem->>'color' AS integer) = 3 THEN (COALESCE(m.color3_weight_g, 0) / 1000.0) * sp.price
            WHEN CAST(mapping_elem->>'color' AS integer) = 4 THEN (COALESCE(m.color4_weight_g, 0) / 1000.0) * sp.price
            ELSE 0
          END
        ) AS total_cost
      FROM products p
      JOIN models m ON p.model_id = m.id
      CROSS JOIN LATERAL jsonb_array_elements(p.multimaterial_mapping) AS mapping_elem
      JOIN spools sp ON CAST(mapping_elem->>'spool_id' AS uuid) = sp.id
      WHERE s.product_id = p.id
        AND m.is_multimaterial = true
        AND p.multimaterial_mapping IS NOT NULL
        AND mapping_elem->>'spool_id' IS NOT NULL
        AND mapping_elem->>'color' IS NOT NULL
        AND sp.purchase_account IS NOT NULL
      GROUP BY sp.purchase_account
    ) AS account_total
  ),
  '[]'::jsonb
)
WHERE EXISTS (
  SELECT 1 
  FROM products p
  JOIN models m ON p.model_id = m.id
  WHERE s.product_id = p.id
    AND m.is_multimaterial = true
    AND p.multimaterial_mapping IS NOT NULL
)
AND (s.production_cost_by_account IS NULL OR s.production_cost_by_account = '[]'::jsonb);

-- 7. Verifica i risultati
DO $$
DECLARE
  updated_count integer;
  null_count integer;
  with_breakdown integer;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM sales
  WHERE spool_purchase_account IS NOT NULL;
  
  SELECT COUNT(*) INTO null_count
  FROM sales
  WHERE spool_purchase_account IS NULL;
  
  SELECT COUNT(*) INTO with_breakdown
  FROM sales
  WHERE production_cost_by_account IS NOT NULL 
    AND production_cost_by_account != '[]'::jsonb
    AND jsonb_array_length(production_cost_by_account) > 0;
  
  RAISE NOTICE 'Vendite aggiornate con spool_purchase_account: %', updated_count;
  RAISE NOTICE 'Vendite ancora senza spool_purchase_account: %', null_count;
  RAISE NOTICE 'Vendite con production_cost_by_account: %', with_breakdown;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Alcune vendite potrebbero essere state create prima che le bobine fossero associate ai prodotti.';
    RAISE NOTICE 'Per queste vendite, sarà necessario associare manualmente le bobine ai prodotti.';
  END IF;
END $$;
