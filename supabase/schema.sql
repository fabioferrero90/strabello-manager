-- Abilita estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella materiali
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand TEXT NOT NULL, -- Brand del materiale
  purchased_from TEXT NOT NULL, -- Acquistato da
  color TEXT NOT NULL, -- Colore del materiale
  color_hex TEXT, -- Codice HEX del colore (es: #FF0000)
  material_type TEXT NOT NULL CHECK (material_type IN ('PLA', 'PETG', 'ABS')), -- Tipo di materiale
  cost_per_kg NUMERIC(10, 2) NOT NULL,
  code TEXT NOT NULL UNIQUE, -- Codice di 4 cifre per il materiale
  status TEXT NOT NULL DEFAULT 'disponibile' CHECK (status IN ('disponibile', 'esaurito')),
  bobina_photo_url TEXT NOT NULL, -- Foto della bobina (obbligatoria)
  print_example_photo_url TEXT, -- Esempio di stampa (facoltativa)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella modelli
CREATE TABLE models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT NOT NULL UNIQUE, -- SKU genitore del modello
  weight_kg NUMERIC(10, 4) NOT NULL,
  dimensions TEXT, -- formato: "Altezza x Larghezza x Profondità cm"
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella prodotti
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
  material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL UNIQUE, -- SKU univoco generato: modello_sku + material_code
  status TEXT NOT NULL CHECK (status IN ('in_coda', 'disponibile', 'venduto')),
  sale_price NUMERIC(10, 2) NOT NULL,
  final_sale_price NUMERIC(10, 2), -- prezzo finale quando venduto (può differire)
  production_cost NUMERIC(10, 2) NOT NULL, -- calcolato: weight * cost_per_kg
  production_extra_costs JSONB DEFAULT '[]'::jsonb, -- Array JSON di costi extra di produzione con note: [{"amount": 2.50, "note": "Accessorio aggiuntivo"}]
  packaging_cost NUMERIC(10, 2) DEFAULT 0,
  administrative_cost NUMERIC(10, 2) DEFAULT 0,
  product_photos TEXT[], -- Array di URL delle foto specifiche del prodotto
  quantity INTEGER NOT NULL DEFAULT 1, -- Quantità disponibile del prodotto
  sales_channel TEXT, -- Canale di vendita: 'Vinted', 'eBay', 'Shopify', 'Negozio Fisico'
  quantity_sold INTEGER, -- Quantità venduta
  vat_regime TEXT, -- Regime IVA applicato alla vendita del prodotto
  extra_costs JSONB DEFAULT '[]'::jsonb, -- Array JSON di costi extra con note: [{"amount": 5.00, "note": "Accessorio incluso"}]
  sold_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella impostazioni canali di vendita
CREATE TABLE sales_channels_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_name TEXT NOT NULL UNIQUE CHECK (channel_name IN ('Vinted', 'eBay', 'Shopify', 'Negozio Fisico')),
  promotion_cost_per_product NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Costo di sponsorizzazione medio per prodotto
  packaging_cost NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Costo di imballaggio
  administrative_base_cost NUMERIC(10, 2) NOT NULL DEFAULT 0, -- Costo amministrativo base
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabella regimi IVA
CREATE TABLE vat_regimes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE, -- Nome del regime IVA (es: "Art.17 (Iva 0%)", "Italia - Slovenia (Iva 22%)")
  vat_rate NUMERIC(5, 2) NOT NULL, -- Percentuale IVA (es: 0, 17, 22, etc.)
  countries TEXT, -- Paesi associati (opzionale, per riferimento)
  country_code TEXT, -- Codice paese ISO a 2 lettere (es: "IT", "DE", "FR")
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per performance
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_model ON products(model_id);
CREATE INDEX idx_products_material ON products(material_id);
CREATE INDEX idx_products_sold_at ON products(sold_at);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_models_sku ON models(sku);
CREATE INDEX idx_materials_code ON materials(code);
CREATE INDEX idx_vat_regimes_name ON vat_regimes(name);

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger per aggiornare updated_at
CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_models_updated_at BEFORE UPDATE ON models
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sales_channels_settings_updated_at BEFORE UPDATE ON sales_channels_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vat_regimes_updated_at BEFORE UPDATE ON vat_regimes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) policies
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE models ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_channels_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE vat_regimes ENABLE ROW LEVEL SECURITY;

-- Policy: tutti gli utenti autenticati possono leggere
CREATE POLICY "Users can read materials" ON materials
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read models" ON models
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can read products" ON products
  FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: tutti gli utenti autenticati possono inserire
CREATE POLICY "Users can insert materials" ON materials
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert models" ON models
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can insert products" ON products
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: tutti gli utenti autenticati possono aggiornare
CREATE POLICY "Users can update materials" ON materials
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update models" ON models
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update products" ON products
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: tutti gli utenti autenticati possono eliminare
CREATE POLICY "Users can delete materials" ON materials
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete models" ON models
  FOR DELETE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete products" ON products
  FOR DELETE USING (auth.role() = 'authenticated');

-- Policy per sales_channels_settings
CREATE POLICY "Users can read sales_channels_settings" ON sales_channels_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert sales_channels_settings" ON sales_channels_settings
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update sales_channels_settings" ON sales_channels_settings
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete sales_channels_settings" ON sales_channels_settings
  FOR DELETE USING (auth.role() = 'authenticated');

-- Policy per vat_regimes
CREATE POLICY "Users can read vat_regimes" ON vat_regimes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert vat_regimes" ON vat_regimes
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update vat_regimes" ON vat_regimes
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can delete vat_regimes" ON vat_regimes
  FOR DELETE USING (auth.role() = 'authenticated');
