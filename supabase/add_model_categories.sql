-- Categorie modelli
CREATE TABLE IF NOT EXISTS model_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Collega la categoria ai modelli
ALTER TABLE models
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES model_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_models_category_id ON models(category_id);
