# Strabello Manager

Sistema di gestione magazzino e costi per prodotti stampati in 3D.

## Setup

1. Installa le dipendenze:
```bash
npm install
```

2. Crea un file `.env` nella root del progetto con le tue credenziali Supabase:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Esegui il database setup SQL in Supabase (vedi `supabase/schema.sql`)

4. Avvia il server di sviluppo:
```bash
npm run dev
```

## Funzionalità

- ✅ Autenticazione con email/password
- ✅ Gestione materiali (costo al kg)
- ✅ Gestione modelli (foto, peso, dimensioni)
- ✅ Gestione prodotti (stati: in coda, disponibile, venduto)
- ✅ Report vendite e riepilogo costi
- ✅ Suddivisione profitti 60/40 (produttore/venditore)
