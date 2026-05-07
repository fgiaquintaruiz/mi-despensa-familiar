# User Paths — Import Ticket

Last updated: 2026-05-07 | Coverage target: 95% branch

## State Variables

| Variable | Type | Represents |
|----------|------|-----------|
| `rows` | `ItemRow[]` | Parsed ticket items with selection state |
| `analyzing` | `boolean` | OCR/PDF analysis in progress |
| `analyzingSource` | `'pdf' \| 'photo' \| null` | Which parser is running |
| `importing` | `boolean` | Import to DB in flight |
| `imported` | `number \| null` | Count of items imported; triggers redirect |
| `noDetection` | `boolean` | PDF parsed but found zero items |
| `importError` | `string \| null` | Error from OCR/import/manual submit |
| `showHintSelector` | `boolean` | Hint selector UI visible |
| `selectedHint` | `SupermarketHint \| null` | Supermarket selected in hint UI |
| `manualText` | `string` | Free-form product lines for "Otro" |
| `isCollapsed` | `boolean` | Item list collapsed or expanded |
| `countdown` | `number \| null` | Seconds remaining (3→0) |
| `autoDetected` | `boolean` | Supermarket auto-detected (no hint needed) |
| `detectedStore` | `string \| null` | Supermarket name for display |
| `isEnrichingBrands` | `boolean` | Brand lookup requests in flight |
| `analyzeError` | `string \| null` | Error from OCR/PDF analysis |

---

## Flow 1 — PDF Upload

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 1.1 | PDF selected → `POST /api/analyze-ticket` | `analyzing=true`, "Analizando PDF..." | ✅ happy |
| 1.2 | API returns non-ok | `analyzeError` shown, `analyzing=false` | ❌ error |
| 1.3 | API returns ok but `items.length === 0` | `noDetection=true`, warning shown | ⚠️ edge |
| 1.4 | API returns ok with items | `rows` set, brand enrichment starts | ✅ happy |

## Flow 2 — Image/Camera Upload

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 2.1 | Image selected → `ocr.recognize()` | `analyzing=true`, "Procesando imagen..." | ✅ happy |
| 2.2 | OCR returns error | `importError` shown, `analyzing=false` | ❌ error |
| 2.3 | OCR zero items + no detectedSupermarket | `showHintSelector=true` | ⚠️ edge |
| 2.4a | OCR zero items + detectedSupermarket → retry fails | `showHintSelector=true` | ❌ error |
| 2.4b | OCR zero items + detectedSupermarket → retry succeeds | `rows` set, countdown starts | ✅ happy |
| 2.5a | OCR finds items + supermarket auto-detected | `autoDetected=true`, countdown starts | ✅ happy |
| 2.5b | OCR finds items + no supermarket | `autoDetected=false`, no countdown | ✅ happy |

## Flow 3 — Hint Selector

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 3.1a | User picks Mercadona/Carrefour/Aldi → retry fails | `importError` shown | ❌ error |
| 3.1b | User picks Mercadona/Carrefour/Aldi → retry succeeds | `rows` set, expanded view | ✅ happy |
| 3.2 | User picks "Otro" | `selectedHint='otro'`, manual textarea shown | ⚠️ edge |

## Flow 4 — Manual Text Entry (Otro)

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 4.1a | Empty text submitted | Returns early (button disabled) | ⚠️ guard |
| 4.1b | `POST /api/parse-ticket-text` returns error | `importError` shown | ❌ error |
| 4.1c | API returns zero items | `importError` "No se encontraron productos..." | ❌ error |
| 4.1d | API returns items | `rows` set, expanded view, brand enrichment | ✅ happy |

## Flow 5 — Countdown Auto-Import

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 5.1 | `countdown` 3→1 ticking | Orange banner "Importando en X..." | ⚠️ state |
| 5.2 | `countdown === 0` | `importAll(rows)` fires automatically | ✅ happy |
| 5.3 | User clicks "Cancelar" | Countdown stops, collapsed view stays | ⚠️ edge |
| 5.4 | User clicks "Ver y editar" | Countdown stops, list expands | ✅ happy |

## Flow 6 — Brand Enrichment

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 6.1 | Brand lookup in flight | `isEnrichingBrands=true`, "Buscando marcas..." | ⚠️ state |
| 6.2 | Brand found | Item updated with brand/productName | ✅ happy |
| 6.3 | Brand lookup fails | Item unchanged, silent failure | ⚠️ edge |

## Flow 7 — Item Selection & Import

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 7.1 | Collapsed view → "Importar todo" | `importAll(rows)` (all items, ignores selected) | ✅ happy |
| 7.2 | Expanded view → toggle checkbox | `selected` flipped on item | ✅ happy |
| 7.3a | "Importar seleccionados" → success | `imported=N`, redirect triggered | ✅ happy |
| 7.3b | "Importar seleccionados" → fails | `importError` shown | ❌ error |
| 7.4 | All items deselected | Button disabled, no action | ⚠️ guard |

## Flow 8 — Post-Import Redirect

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 8.1 | `imported !== null` | `router.push('/?imported=N')`, return null | ✅ happy |

## Flow 9 — Mode CTA Button

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 9.1 | `?mode=photo` or `?mode=pdf` in URL | CTA button rendered | ✅ happy |
| 9.2 | No `mode` param | Button hidden | ⚠️ edge |

## Flow 10 — Debug: OCR Raw Text

| Branch | Trigger | Outcome | Status |
|--------|---------|---------|--------|
| 10.1 | `rawText` exists + zero rows + (hintSelector or error) | `<details>` with OCR dump | ⚠️ debug |

---

## Happy Paths (end-to-end)

| Path | Flows | Description |
|------|-------|-------------|
| **PDF → import** | 1.1 → 1.4 → 7.1 → 8.1 | Upload PDF, get items, import all |
| **Photo → auto-detect → countdown → import** | 2.1 → 2.5a → 5.2 → 7.3a → 8.1 | Photo, supermarket detected, auto-import |
| **Photo → hint → import** | 2.1 → 2.3 → 3.1b → 7.3 → 8.1 | Photo, no detection, pick hint, import |
| **Photo → manual text → import** | 2.1 → 2.3 → 3.2 → 4.1d → 7.3 → 8.1 | Photo fails, type manually, import |
| **Edit items → import selection** | any → 5.4/7.2 → 7.3a → 8.1 | Expand list, toggle items, import selected |

## Error Paths

| Path | Condition | UI |
|------|-----------|---|
| PDF API error | Non-ok response (1.2) | `analyzeError` toast |
| PDF no items | Parsed but empty (1.3) | `noDetection` warning |
| Image OCR error | `ocrError` from recognize (2.2) | `importError` toast |
| Image no items | Zero items, no hint (2.3) | Hint selector |
| Hint retry fails | `retryWithHint()` errors (3.1a) | `importError` toast |
| Manual text error | API error or parse fail (4.1b, 4.1c) | `importError` toast |
| Import DB fails | `importTicketItemsAction()` fails (7.3b) | `importError` toast |

---

## Coverage Status

| Suite | Branch Coverage | Last run |
|-------|----------------|----------|
| Vitest unit (import-ticket.test.tsx) | ~41% | 2026-05-07 |
| Playwright E2E (analyze-ticket.spec.ts) | API only — no component branches | 2026-05-07 |

## TODO — Tests to add (Phase 2)

- [ ] Flow 1.2: PDF API error → analyzeError shown
- [ ] Flow 1.3: PDF returns empty items → noDetection warning
- [ ] Flow 2.2: OCR error → importError shown
- [ ] Flow 2.3: OCR zero items, no hint → showHintSelector
- [ ] Flow 2.4a: OCR zero + hint retry fails → showHintSelector
- [ ] Flow 2.4b: OCR zero + hint retry succeeds → rows + countdown
- [ ] Flow 2.5a: OCR items + autoDetected → countdown starts
- [ ] Flow 3.1a: Hint retry fails → importError
- [ ] Flow 3.1b: Hint retry succeeds → rows set
- [ ] Flow 3.2: "Otro" selected → manual textarea
- [ ] Flow 4.1b/c: Manual text parse errors
- [ ] Flow 4.1d: Manual text parse success → rows
- [ ] Flow 5.3: Cancel countdown
- [ ] Flow 5.4: "Ver y editar" expands list
- [ ] Flow 7.3b: Import DB fails → importError
- [ ] Flow 8.1: imported !== null → redirect
