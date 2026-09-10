# ad-factory

Fábrica de estáticos por capas para Habi. Se configura una combinación (protagonista, fondo,
título, texto, CTA, logo, formato, producto), Replicate genera **sólo las capas que son imagen**,
la pieza se compone con la tipografía y el logo reales de marca, y sale un PNG más una UTM que
describe la pieza rasgo por rasgo.

| Pieza | Detalle |
| --- | --- |
| Framework | Next.js 16 (App Router, `src/`, TypeScript, Tailwind v4 sobre los tokens del Habi Brand Center) |
| Imágenes | Replicate: `google/nano-banana-pro` (generación) + `bria/remove-background` (recortes) |
| Persistencia | Local: caché en `.ad-factory-cache/`. Producción: Supabase Storage + Postgres — ver `TODO.md` |
| Export | El mismo componente `<Creative>` para preview, descarga en el browser y batch en Chrome headless |
| Hosting | Vercel — deploy automático en cada push a `main` |

## Desarrollo local

```bash
cp .env.example .env.local   # poner REPLICATE_API_TOKEN
npm install
npm run dev                  # http://localhost:3000
```

| Ruta | Qué hace |
| --- | --- |
| `/` | **Fábrica**: configurador + preview en vivo, descarga PNG, copia UTM, guarda el creativo |
| `/biblioteca` | Capas ya generadas (protagonistas y fondos), reutilizables por hash |
| `/presets` | Los 6 estáticos de referencia (`docs/referencias/`) como semillas; "Generar capas de los 6" |
| `/creativos` | Registro de piezas armadas con su UTM y su PNG |
| `/render/<id>` | Ruta desnuda que monta sólo la pieza a tamaño real — la captura el batch |

Con `npm run dev` corriendo:

```bash
npm run generate:presets     # genera en Replicate las capas que falten de los 6 presets
npm run generate:presets -- --dry-run   # sólo resuelve hashes, no gasta crédito
npm run render:presets       # los 6 PNG en .renders/, vía Chrome headless
npm run smoke                # prueba de humo en navegador real (rutas + export + batch)
npm run typecheck            # tsc --noEmit
```

`npm run smoke` es la prueba que importa: abre la app en Chrome, exporta un PNG desde el
navegador y verifica que **coincide con el que saca el batch** — la divergencia entre preview
y archivo es el modo de falla que este diseño existe para prevenir.

## Cómo está armado

```
src/lib/creative/     CreativeSpec (tipos), escala tipográfica de anuncio, presets, resolve
src/components/creative/  <Creative> y una capa por slot: fondo, overlay, protagonista, título, texto, CTA, logo
src/lib/brand/        tokens de color en TS y reglas del logo (mínimos, clear space, tratamiento por fondo)
src/lib/replicate/    prompts desde atributos estructurados, cliente REST, pipeline start/poll sin estado en servidor
src/lib/utm.ts        slug por atributos → utm_content; el PNG se llama igual
src/lib/store/        interfaz Store + drivers fs / memory / supabase
src/lib/export/       DOM → PNG en el browser (modern-screenshot), zip
scripts/render.mjs    batch con puppeteer-core + Chrome local
scripts/smoke.mjs     prueba de humo en navegador (rutas, export, paridad con el batch)
scripts/generate-presets.mjs   genera las capas de los presets por las rutas locales
```

Reglas que el código hace cumplir:

- **Un solo renderer.** Preview, descarga y batch usan el mismo `<Creative>` a tamaño real en px.
  Lo que se ve es lo que se descarga.
- **Fondos planos y gradientes son CSS**, no Replicate. Cero costo.
- **Caché por hash** `sha256(model + prompt + attrs)`: pedir dos veces la misma capa no vuelve a
  gastar crédito.
- **UTM derivada de atributos**, no de texto libre:
  `f1x1_prot-mujer-joven-pielblanca-pelocastano-largo-…_fondo-interior-…_tit-vende-tu-apto_cta-recibe-una-oferta-gratis`.
- **Logo por construcción**: tratamiento según lo que hay debajo, mínimo 24 px, clear space
  reservado, sin filtros ni sombras posibles.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `REPLICATE_API_TOKEN` | Obligatoria. Genera las capas. Nunca va en un commit |
| `STORE_DRIVER` | `fs` (default) · `memory` · `supabase` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Sólo con `STORE_DRIVER=supabase`. Ver `TODO.md` |
| `CHROME_PATH` | Opcional, para `scripts/render.mjs` |

## Clientes de Supabase (heredados del scaffold)

`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts` y `src/proxy.ts` siguen ahí para el
login futuro. El driver de persistencia (`src/lib/store/supabase.ts`) usa su propio cliente de
servidor con la secret key.

## Deploy

Cada push a `main` dispara un deploy de producción en Vercel; cada PR genera un preview. En Vercel
sin Supabase el store cae a `memory` (las capas no sobreviven entre invocaciones): para producción
real hay que seguir `TODO.md`.
