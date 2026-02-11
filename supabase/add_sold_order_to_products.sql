-- Aggiunge il flag "Prodotto venduto" ai prodotti in coda per assegnare priorità maggiore.
-- I prodotti con is_sold_order = true vengono mostrati per primi quando si ordina per priorità.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_sold_order boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.is_sold_order IS 'Se true, il prodotto in coda è un ordine già venduto e ha priorità maggiore in stampa.';
