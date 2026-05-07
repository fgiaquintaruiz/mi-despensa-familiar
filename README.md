# Mi Despensa Familiar

PWA para gestionar el stock del hogar: escaneá productos, registrá consumos, importá tickets de compra y recibí alertas cuando el stock está por agotarse.

---

## Tabla de contenidos

1. [Prerrequisitos](#prerrequisitos)
2. [Tech Stack](#tech-stack)
3. [Setup local de desarrollo](#setup-local-de-desarrollo)
4. [Variables de entorno](#variables-de-entorno)
5. [Supabase setup](#supabase-setup)
6. [Correr tests](#correr-tests)
7. [Deploy a Vercel](#deploy-a-vercel)
8. [Arquitectura](#arquitectura)
9. [Scripts disponibles](#scripts-disponibles)
10. [Roadmap](#roadmap)

---

## Prerrequisitos

| Herramienta | Versión mínima | Notas |
|-------------|---------------|-------|
| Node.js | 20.x LTS | Recomendado via [`nvm`](https://github.com/nvm-sh/nvm) |
| pnpm | 9.x | `npm install -g pnpm` |
| Supabase CLI | latest | `npm install -g supabase` |
| Git | 2.x | — |

---

## Tech Stack

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Next.js | 16.2.4 | Framework principal — App Router, RSC, Server Actions |
| React | 19.2.4 | UI |
| TypeScript | 5.x (strict) | Type safety end-to-end |
| Tailwind CSS | 4.x | Estilos via CSS variables (`@theme`), sin `tailwind.config.js` |
| Supabase | 2.x | Postgres + Auth + RLS |
| @supabase/ssr | 0.10.x | Cliente SSR con cookie-based session |
| Vitest | 4.x | Test runner |
| @testing-library/react | 16.x | Tests de componentes React |
| happy-dom | 20.x | DOM environment para Vitest |
| Tesseract.js | 7.x | OCR de tickets (browser-only, WASM) |
| pdf-parse | 2.x | Extraccion de texto de PDFs (server-side) |
| web-push | 3.x | Web Push Notifications con VAPID |
| Recharts | 3.x | Graficos de estadisticas |
| Zod | 4.x | Validacion de esquemas |

---

## Setup local de desarrollo

### 1. Clonar e instalar dependencias

```bash
git clone https://github.com/<tu-usuario>/mi-despensa-familiar.git
cd mi-despensa-familiar
pnpm install
```

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Abri `.env.local` y completa cada variable. Ver la tabla de [Variables de entorno](#variables-de-entorno) para el detalle.

### 3. Generar claves VAPID

Las notificaciones push requieren un par de claves VAPID. Generatelas una sola vez por proyecto:

```bash
npx web-push generate-vapid-keys
```

Copia `Public Key` en `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PUBLIC_KEY`.  
Copia `Private Key` en `VAPID_PRIVATE_KEY`.

### 4. Linkear el proyecto Supabase y aplicar migraciones

Ver la seccion completa de [Supabase setup](#supabase-setup). En resumen:

```bash
supabase login
supabase link --project-ref <tu-project-ref>
supabase db push
```

### 5. Levantar el servidor de desarrollo

```bash
pnpm dev
```

La app queda disponible en **http://localhost:4000**.

---

## Variables de entorno

Todas las variables van en `.env.local`. Las marcadas como **Si** en la columna Requerida rompen la app si faltan.

| Variable | Requerida | Descripcion | Ejemplo |
|----------|-----------|-------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Si | URL del proyecto Supabase | `https://abcxyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Anon key publica de Supabase | `eyJhbGci...` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Si | VAPID public key (cliente — service worker) | `BEl62iNmVJ...` |
| `NEXT_PUBLIC_APP_URL` | Si | URL base de la app (sin trailing slash) | `http://localhost:4000` |
| `VAPID_PUBLIC_KEY` | Si | VAPID public key (servidor — web-push) | `BEl62iNmVJ...` (mismo valor que el de arriba) |
| `VAPID_PRIVATE_KEY` | Si | VAPID private key — nunca exponerla al cliente | `abc123def...` |
| `VAPID_SUBJECT` | Si | Contacto VAPID — email o URL del sitio | `mailto:vos@ejemplo.com` |

> **Nota sobre VAPID**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PUBLIC_KEY` son el mismo valor — la primera la usa el cliente (service worker para suscribirse), la segunda el servidor (web-push para enviar). Copia la misma clave publica en ambas.

---

## Supabase setup

El proyecto usa **Supabase Cloud** exclusivamente — no hay instancia local. Necesitas tener una cuenta y un proyecto creado en [supabase.com](https://supabase.com).

### 1. Instalar la CLI

```bash
npm install -g supabase
```

### 2. Autenticarse

```bash
supabase login
```

Se abre el browser. Autentica con tu cuenta de Supabase.

### 3. Obtener el Project Reference

En el dashboard de Supabase: **Settings → General → Reference ID**.

O desde la URL del dashboard: `https://supabase.com/dashboard/project/<project-ref>`.

### 4. Linkear el proyecto

```bash
supabase link --project-ref <project-ref>
```

Ingresa la database password cuando la pida.

### 5. Aplicar las migraciones

```bash
supabase db push
```

Esto aplica las 7 migraciones al proyecto remoto en orden:

| Migracion | Descripcion |
|-----------|-------------|
| `0001_initial.sql` | Schema base: `households`, `household_members`, `products`, `consumption_logs` |
| `0002_create_household_fn.sql` | Funcion para crear household al registrar un nuevo usuario |
| `20260501000000_push_subscriptions.sql` | Tabla `push_subscriptions` para Web Push |
| `20260502000000_product_expires_at.sql` | Campo `expires_at` en `products` |
| `20260502000001_price_history.sql` | Tabla `price_history` |
| `20260505000000_budget_tables.sql` | Tablas `budgets`, `shopping_transactions`, `transaction_items` |
| `20260505000001_budget_currency.sql` | Campo `currency` en `budgets` |

### 6. Obtener las keys del proyecto

En el dashboard: **Settings → API**.

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon / public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Correr tests

### Modo watch (desarrollo)

```bash
pnpm test
```

Vitest queda en watch mode: re-corre los tests afectados al guardar.

### Single run (CI)

```bash
pnpm test:run
```

### Con coverage

```bash
pnpm test:run -- --coverage
```

El reporte se genera en `coverage/`. Usa `@vitest/coverage-v8`.

### Archivos excluidos del coverage

| Archivo | Razon |
|---------|-------|
| `src/lib/ocr/use-ocr.ts` | Usa Tesseract.js con WASM — no ejecutable en happy-dom |
| `src/lib/supabase/server.ts` | Requiere contexto RSC de Next.js — no instanciable en Vitest |

### Convencion de tests

Los tests estan colocados junto al archivo fuente (`*.test.ts` / `*.test.tsx`). El setup global vive en `src/test/setup.ts`.

---

## Deploy a Vercel

No hay `vercel.json` — Vercel detecta automaticamente el framework Next.js.

### Opcion A: CLI (recomendado)

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Opcion B: Dashboard

1. Ir a [vercel.com/new](https://vercel.com/new)
2. Importar el repositorio de GitHub
3. Framework Preset: **Next.js** (auto-detectado)
4. Configurar las variables de entorno (ver abajo)
5. Hacer clic en Deploy

### Variables de entorno en Vercel

Configuralas via CLI antes del deploy:

```bash
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add VAPID_PUBLIC_KEY
vercel env add VAPID_PRIVATE_KEY
vercel env add VAPID_SUBJECT
```

O desde el dashboard en **Project → Settings → Environment Variables**.

> **Importante**: `NEXT_PUBLIC_APP_URL` debe apuntar a la URL de produccion de Vercel (ej: `https://mi-despensa.vercel.app`). Se usa para construir la URL del endpoint de notificaciones push en server-side.

---

## Arquitectura

### Estructura de la app (App Router)

```
src/app/
├── (auth)/           # Rutas publicas: login, registro, recuperar contrasena
├── (app)/            # Rutas protegidas (layout con auth guard)
│   ├── page.tsx              # Dashboard: vista general del stock
│   ├── products/             # CRUD de productos
│   ├── scanner/              # Escanear codigos de barras (browser API)
│   ├── shopping-list/        # Lista de compras generada por stock bajo
│   ├── budget/               # Presupuesto mensual y transacciones
│   ├── stats/                # Graficos de consumo (Recharts)
│   └── import-ticket/        # Importar ticket de supermercado (OCR + PDF)
└── api/
    └── push/                 # Endpoints de Web Push Notifications
```

### Autenticacion y RLS con Supabase

- El middleware (`src/lib/supabase/middleware.ts`) refresca la sesion en cada request via `@supabase/ssr`
- Todas las tablas tienen **Row Level Security (RLS) habilitado** en Supabase
- Las politicas RLS filtran por `household_id` automaticamente — un usuario solo ve los datos de su hogar
- Los Server Components usan `createServerClient` (cookies), los Client Components usan `createBrowserClient`

### Parser registry de tickets

Los parsers de tickets estan en `src/lib/parsers/` y siguen un patron de registro. El sistema detecta el supermercado por heuristica en el texto extraido (OCR o PDF) y delega al parser correspondiente:

| Supermercado | Estado |
|-------------|--------|
| Mercadona | Implementado |
| Carrefour | Implementado |
| Aldi | Implementado |
| Eroski | Pendiente |

### PWA

- Manifest: `public/manifest.json`
- Service Worker: `public/sw.js` (gestiona push notifications y cache offline basico)
- Iconos: `public/icons/icon-192.png` y `public/icons/icon-512.png`

---

## Scripts disponibles

| Script | Comando | Descripcion |
|--------|---------|-------------|
| `dev` | `next dev --port 4000` | Servidor de desarrollo en http://localhost:4000 |
| `build` | `next build` | Build de produccion |
| `start` | `next start` | Servidor de produccion (requiere `build` previo) |
| `lint` | `eslint src` | Linting del codigo fuente |
| `typecheck` | `tsc --noEmit` | Verificacion de tipos sin emitir JS |
| `test` | `vitest` | Tests en modo watch |
| `test:run` | `vitest run` | Tests en single run (para CI) |

---

## Roadmap

### Parsers pendientes

- [ ] **Eroski** — parser de ticket no implementado todavia

### OCR

- [ ] **OCR cloud** — reemplazar Tesseract.js (WASM browser-only) por un servicio de OCR cloud para mejorar precision y soporte server-side

### Funcionalidades

- [ ] Compartir hogar con multiples usuarios (invitaciones por email)
- [ ] Exportar historial de consumo a CSV
- [ ] Modo offline completo con sincronizacion en background
