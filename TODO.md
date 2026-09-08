# TODO — Conectar Supabase (Storage + Postgres)

> Para quien tenga permisos de administrador en el proyecto Supabase `kuiotuomibomlkxrnifc`.
> Este documento se puede seguir de arriba abajo **sin abrir ningún archivo `.ts`**.

## 1. Qué existe ya y qué falta

La app funciona completa en local con caché en disco (`.ad-factory-cache/`). La capa de
persistencia está detrás de una sola interfaz (`Store`) con tres drivers:

| Driver | Se activa con | Estado |
| --- | --- | --- |
| `fs` | `STORE_DRIVER=fs` (default) | Funciona. Es lo que se usa hoy en local. |
| `memory` | automático en Vercel si no hay Supabase | Funciona, pero las capas se pierden entre invocaciones. |
| `supabase` | `STORE_DRIVER=supabase` + llaves | **Código completo en `src/lib/store/supabase.ts`, sin probar** porque no hay llaves. |

Lo que falta es **infraestructura**, no código: crear 2 buckets, 3 tablas, poner 4 variables
de entorno y correr un script de migración. No se espera ningún cambio en el front.

## 2. Buckets de Storage

Dashboard → Storage → New bucket. Crear dos:

| Bucket | Público | Tamaño máx. por archivo | MIME permitidos | Ruta de los objetos |
| --- | --- | --- | --- | --- |
| `layers` | **No** (privado) | 20 MB | `image/png, image/jpeg, image/webp` | `<hash>.png` (o `.jpg` / `.webp`) |
| `renders` | **Sí** (lectura pública) | 20 MB | `image/png` | `<shortId>/<utm_content>.png` |

`layers` es privado porque la app nunca enlaza el bucket directamente: las capas se sirven por
`/api/asset/<hash>` (mismo origen, requisito del export). `renders` es público porque el driver
devuelve la URL pública del PNG para que se pueda compartir el enlace.

Los PNG de protagonista a 2K con canal alfa pesan entre 2 y 8 MB; por eso el límite de 20 MB.

Equivalente por SQL (si se prefiere a los clics):

```sql
insert into storage.buckets (id, name, public) values ('layers', 'layers', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('renders', 'renders', true) on conflict (id) do nothing;
```

La escritura la hace **sólo el servidor** con la secret key (que salta RLS), así que no hacen
falta políticas de Storage para `anon`/`authenticated`.

## 3. Tablas

Dashboard → SQL Editor → New query. Pegar y ejecutar completo:

```sql
-- Capas de imagen generadas (protagonistas y fondos). El hash es sha256(model+prompt+attrs)
-- y coincide con el nombre del archivo en el bucket `layers`.
create table if not exists public.assets (
  hash            text primary key,
  kind            text not null check (kind in ('protagonista', 'fondo')),
  slug            text not null,
  attrs           jsonb not null default '{}'::jsonb,
  prompt          text not null,
  model           text not null,
  model_version   text,
  prediction_id   text,
  storage_path    text not null,
  width           integer not null,
  height          integer not null,
  has_alpha       boolean not null default false,
  mime            text not null,
  created_at      timestamptz not null default now()
);
create index if not exists assets_kind_idx on public.assets (kind);
create index if not exists assets_slug_idx on public.assets (slug);
create index if not exists assets_created_at_idx on public.assets (created_at desc);

-- Piezas armadas: el CreativeSpec completo + la UTM que se generó para ella.
create table if not exists public.creatives (
  id            text primary key,
  short_id      text not null,
  format        text not null check (format in ('1x1', '4x5', '9x16', '16x9')),
  producto      text not null,
  pais          text not null default 'co',
  spec          jsonb not null,
  utm           jsonb not null,
  render_path   text,
  created_at    timestamptz not null default now()
);
create index if not exists creatives_short_id_idx on public.creatives (short_id);
create index if not exists creatives_created_at_idx on public.creatives (created_at desc);

-- Log de predicciones de Replicate: para saber cuánto se gastó y en qué.
-- (La tabla se crea desde ya; el pipeline aún no escribe en ella — ver sección 7.)
create table if not exists public.generations (
  id             bigint generated always as identity primary key,
  prediction_id  text not null unique,
  model          text not null,
  status         text not null,
  input          jsonb,
  output         jsonb,
  asset_hash     text references public.assets (hash) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists generations_status_idx on public.generations (status);

-- RLS: habilitado. En v1 sólo escribe y lee el servidor con la secret key (que salta RLS),
-- así que NO se crean políticas para anon/authenticated. Ver sección 6 para abrirlo después.
alter table public.assets enable row level security;
alter table public.creatives enable row level security;
alter table public.generations enable row level security;
```

Verificación rápida (misma consola):

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('assets', 'creatives', 'generations');
-- deben salir las 3
```

## 4. Variables de entorno

Dashboard → Project Settings → API. Copiar:

| Variable | Dónde ponerla | Valor |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` y Vercel | `https://kuiotuomibomlkxrnifc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` y Vercel | la `sb_publishable_…` |
| `SUPABASE_SECRET_KEY` | `.env.local` y Vercel (**nunca** con prefijo `NEXT_PUBLIC_`) | la `sb_secret_…` (o `service_role` en proyectos viejos) |
| `STORE_DRIVER` | `.env.local` y Vercel | `supabase` |
| `REPLICATE_API_TOKEN` | `.env.local` y Vercel | el `r8_…` del equipo (ya lo usa la app en local) |

En Vercel: proyecto `ad-factory-x17t` → Settings → Environment Variables → marcar Production
y Preview. Después de guardar, **Redeploy** (las envs no se aplican al deploy anterior).

## 5. Orden de activación y prueba

Cada paso dice qué comando correr y qué debe pasar.

1. **Buckets** (sección 2) → en Storage se ven `layers` (privado, candado cerrado) y `renders` (público).
2. **DDL** (sección 3) → la consulta de verificación devuelve 3 filas.
3. **Envs en `.env.local`** (sección 4) con `STORE_DRIVER=supabase`.
4. **Migrar la caché local** (sube lo que ya se generó en esta máquina; idempotente):
   ```bash
   cd ~/ad-factory
   node scripts/migrate-cache-to-supabase.mjs --dry-run   # lista qué subiría, no sube nada
   node scripts/migrate-cache-to-supabase.mjs             # sube capas, renders y creativos
   ```
   Debe terminar con un resumen tipo `✓ 14 capas · ✓ 6 renders · ✓ 6 creativos · 0 errores`.
   En Storage → `layers` aparecen archivos `<hash>.png`; en Table Editor → `assets` hay una fila por archivo.
5. **Arrancar la app**:
   ```bash
   npm run dev
   ```
   La consola **no** debe mostrar el aviso "Vercel sin Supabase". Si sale
   `STORE_DRIVER=supabase pero faltan llaves`, falta alguna variable del paso 3.
6. **Generar una capa nueva**: en `/` → Protagonista → cambiar cualquier atributo → "Generar
   protagonista". Al terminar, en Storage → `layers` hay un archivo nuevo y en `assets` una fila
   nueva con ese `hash`. Recargar `/biblioteca`: la capa aparece con su thumbnail servido desde
   `/api/asset/<hash>` (la ruta hace proxy del bucket; el front no cambia).
7. **Exportar un creativo**: en `/` → "Guardar creativo". En Storage → `renders/<shortId>/` está
   el PNG con el nombre de la UTM; en `creatives` hay la fila con `render_path`.
8. **Envs en Vercel** (sección 4) → Redeploy → repetir 6 y 7 contra la URL de producción.

Si algo falla en 6 o 7, el error de la API viene en el JSON de respuesta
(`{ "error": "…" }`) y en los logs del servidor; el driver de Supabase propaga el mensaje
original de `supabase-js`.

## 6. Cómo abrir el acceso después (no es parte de v1)

Cuando se agregue login con Supabase Auth restringido a `@habi.co`:

```sql
-- Lectura para usuarios autenticados del dominio.
create policy "habi lee assets" on public.assets for select
  to authenticated using (auth.jwt() ->> 'email' like '%@habi.co');
create policy "habi lee creatives" on public.creatives for select
  to authenticated using (auth.jwt() ->> 'email' like '%@habi.co');
```

La escritura sigue siendo del servidor. `src/proxy.ts` ya refresca la sesión en cada request,
así que el login es agregar la pantalla y una comprobación en las rutas `/api/generate/*`.

## 7. Pendiente fuera de v1

- Login `@habi.co` (sección 6) — hoy la app es abierta y cada generación gasta crédito de Replicate.
- TuHabi / México: los SVG ya están en `public/brand/` en el brand center; falta la entrada en el
  mapa de logos (`src/lib/brand/logo.ts`) y `pais: 'mx'` en los tipos.
- Borrar renders desde la UI (hoy sólo se borran capas).
- Registrar cada predicción en `generations` (la tabla existe; el pipeline aún no escribe ahí).
