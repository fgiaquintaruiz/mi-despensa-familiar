# Mi Despensa Familiar

App de gestión de inventario familiar — PWA construida con Next.js 15 + Supabase.

## Stack

- **Next.js 15** (App Router, RSC, Turbopack)
- **TypeScript** strict
- **Tailwind CSS v4**
- **Supabase** (Postgres + auth + realtime + storage)
- **Zod** para validación
- **pdf-parse** para tickets Mercadona (Carrefour, Aldi, Eroski pendientes)
- **pnpm**

## Setup

1. Copiar `.env.local.example` a `.env.local` y completar con credenciales de Supabase.
2. `pnpm install`
3. `pnpm dev` → http://localhost:3000

## Estructura

- `src/app/` — rutas (App Router) y API routes
- `src/lib/types.ts` — modelo de datos (Product, ConsumptionLog, Category)
- `src/lib/supabase/` — clientes (browser + server)
- `src/lib/parsers/` — parsers de tickets por supermercado (registry pattern)
- `docs/briefing.md` — briefing técnico completo

## Roadmap

Ver `docs/briefing.md` para el plan completo. MVP:
- [ ] Schema Supabase (products, consumption_logs)
- [ ] Auth por household
- [ ] CRUD inventario UI
- [ ] Registro de consumo
- [ ] Lista de compra calculada
- [ ] Escáner código de barras (BarcodeDetector + Open Food Facts)
- [ ] Importar ticket Mercadona (PDF)
- [ ] PWA install + service worker
- [ ] Parsers Carrefour, Aldi, Eroski
- [ ] (futuro) OCR cloud para tickets de papel

## TODO assets

- `public/icons/icon-192.png` y `icon-512.png` — pendientes (proveer arte)
