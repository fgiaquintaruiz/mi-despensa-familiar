# Mi Despensa Familiar — Briefing técnico

**What**: PWA de gestión de inventario familiar (4 personas, niñas 7 y 3 años con pañales). Prototipo en React JSX single-file con `window.storage` (API de Claude artifacts). A migrar a app web real instalable.

**Why**: el usuario quiere reemplazar el prototipo por una app productiva — usable diariamente por la familia, instalable en móvil, con sync entre dispositivos.

**Where (a crear)**: `C:\Users\FGIAQUINTA\IdeaProjects\mi-despensa-familiar`

## Funcionalidades

1. **Inventario CRUD**: nombre, marca, categoría, unidad, stock actual, stock mínimo, precio €, código de barras. 6 categorías con emoji: 🍞 Despensa · 🧴 Higiene · 👶 Bebé/Niñas · 🧹 Limpieza · 🥛 Frescos · 💊 Farmacia. Barra visual de stock, alerta si stock ≤ mínimo, estimación de días restantes según consumo real.
2. **Registro de consumo**: log `{id, productId, qty, date, type?}`. `type:"restock"` distingue compras de consumo. Permite calcular avg diario por producto.
3. **Lista de compra inteligente**: para N días (default 30). Si hay historial: `ceil(avg_diario × días) - stockActual`. Sin historial: si stock ≤ min, comprar `minStock × 2 - stockActual`. Agrupa por categoría, total estimado, share via Web Share API o clipboard (texto plano para WhatsApp).
4. **Escáner código de barras**: `BarcodeDetector` API nativa (Chrome Android, algunos Safari). Formatos EAN-13/8, UPC-A/E, Code-128. Fallback input manual. Lookup en Open Food Facts (`world.openfoodfacts.org/api/v0/product/{code}.json`). Firefox/Safari iOS necesitan fallback `zxing-js`.
5. **Escáner tickets con IA**: foto/PDF → Claude Sonnet via `/v1/messages` con vision. Compatible Mercadona, Carrefour, Lidl, Alcampo, El Corte Inglés. Pantalla de revisión, dedup por nombre (update vs create). API key NUNCA en frontend → endpoint backend `POST /api/analyze-ticket`.
6. **Sync multi-dispositivo**: claves `despensa-v3-productos`, `despensa-v3-logs`. Auto-sync 20s + manual. Indicador con punto verde.

## Modelo de datos

```ts
interface Product {
  id: string; name: string; brand: string; category: string;
  unit: string; currentStock: number; minStock: number;
  price: number; barcode: string;
}
interface ConsumptionLog {
  id: string; productId: string; qty: number;
  date: string; type?: "restock";
}
```

## Stack del prototipo (a reemplazar)

- React 18 + hooks · CSS-in-JS inline · Nunito (Google Fonts)
- `window.storage` (Claude artifacts) → reemplazar por backend real
- APIs externas: Open Food Facts (gratis, ~100 req/min, cachear) · Anthropic vision (requiere key) · `BarcodeDetector` · `getUserMedia` · `navigator.share`/`clipboard`

## Migraciones críticas a producción

- **Storage**: Opción A Firebase/Supabase (Firestore o Postgres + auth por household + realtime listeners + reglas) · Opción B backend propio con API REST + WS/SSE + JWT por household
- **API key Anthropic**: backend endpoint `/api/analyze-ticket` con env `ANTHROPIC_API_KEY`. NUNCA en frontend.
- **PWA**: manifest.json (theme `#FF6B35`, bg `#FFF9F5`, display standalone) + service worker para offline básico

## Prompt OCR ticket (exacto)

"Eres un asistente que analiza tickets de compra españoles (Mercadona, Carrefour, Lidl, Alcampo, El Corte Inglés, etc). Extrae TODOS los productos del ticket. Para cada producto devuelve un JSON array con objetos que tengan EXACTAMENTE estas claves: name (limpio, sin abreviaturas), qty (número), unit (unidad/kg/litro/paquete/bote/caja/etc), price (decimal), category (una de: 🍞 Despensa · 🧴 Higiene · 👶 Bebé/Niñas · 🧹 Limpieza · 🥛 Frescos · 💊 Farmacia). Responde SOLO con el array JSON sin texto, sin markdown, sin backticks."

## Algoritmo categoría (fallback local)

keywords: pañal/toallita/bebe/baby/dodot → 👶 · deterg/lejia/limpiad/ariel/fairy → 🧹 · gel/champu/jabon/pasta dent/desodor → 🧴 · leche/yogur/queso/huevo/mantequilla → 🥛 · medic/ibuprofeno/paracetamol → 💊 · default → 🍞

## UX/diseño (decidido)

- Color principal `#FF6B35` → gradiente `#F7931E`
- Fondo `linear-gradient(160deg, #FFF9F5, #FFF0E6)`
- Nunito 400/600/700/800/900
- Stock bajo: borde `#FFB8A0`, número `#FF3B30`
- Días restantes: verde >14d · naranja 5-14d · rojo <5d
- Radius 14-20px tarjetas / 20-30px botones · sombra `0 2px 14px rgba(0,0,0,.06)`
- Max-width 480px, centrado en desktop

## Flujo principal

1. Primera vez: ejemplos precargados → escanear ticket Mercadona → IA detecta 20 productos → confirmar → inventario lleno en 30s
2. Diario: ver bajos → tap producto → registrar uso (1 unidad)
3. Pre-compra: tab Compra → lista calculada → ajustar días → share WhatsApp pareja
4. Post-compra: escanear ticket → stock actualizado

## Env vars producción

`ANTHROPIC_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_APP_URL`

## Notas implementación (gotchas)

- `BarcodeDetector` no en Firefox ni Safari iOS → `zxing-js` como fallback
- Tickets Mercadona PDF tienen texto seleccionable → parsear sin vision (ahorro)
- Open Food Facts rate limit ~100 req/min → cache local
- `type:"restock"` en logs → NO contar como consumo en avg
- Logs restock con `qty` negativo (revisar en producción)

## Extensiones futuras

- Push notifs stock bajo · planificador menú · histórico gasto + gráficas · multi-hogar · integración super (Mercadona/Carrefour) · voz ("gasté un paquete de leche") · lista compartida realtime con tachado

## Decisiones de stack (aprobadas por usuario)

- **Frontend**: Next.js 15 (App Router, RSC, Turbopack)
- **Backend/DB**: Supabase (Postgres + auth + realtime + storage)
- **Primer importer de tickets**: Mercadona PDF (texto seleccionable, sin necesidad de OCR/IA)
- **Parsers futuros**: Carrefour, Aldi, Eroski
- **Pattern**: registry de parsers extensible (`src/lib/parsers/`)

## Learned

- Conflicto crítico: el usuario NO quiere gastar en Anthropic API ("20 euros me duró una tarde"). El feature de OCR de tickets depende de Claude Vision. Hay que evaluar alternativas locales: `tesseract.js` (OCR en browser) + parser de texto · parsing de PDF de Mercadona (texto seleccionable) · OCR cloud con free-tier · skip ticket-OCR feature inicialmente
- Decisiones pendientes: auth (multi-household vs single) · existencia/ubicación del prototipo JSX original
