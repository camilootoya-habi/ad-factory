# Supabase (Storage + Postgres) — aplicado

> Proyecto Supabase `kuiotuomibomlkxrnifc`. Las secciones 2, 3 y 4 **ya están aplicadas**
> (2026-09-10); quedan como referencia de qué existe y para poder recrearlo. Lo que falta
> está en la sección 5 (probar en producción) y en la 7 (fuera de v1).

## 1. Estado

Producción corre con Supabase. La capa de persistencia está detrás de una sola interfaz
(`Store`) con tres drivers:

| Driver | Se activa con | Estado |
| --- | --- | --- |
| `fs` | `STORE_DRIVER=fs` (default local) | Funciona. Es lo que se usa en esta máquina. |
| `memory` | automático en Vercel si no hay Supabase | Funciona, pero las capas se pierden entre invocaciones. Es lo que usan los **Preview**. |
| `supabase` | `STORE_DRIVER=supabase` + llaves | **Activo en Production.** Buckets y tablas creados; falta la prueba end-to-end de la sección 5. |

| Entorno | Driver | Por qué |
| --- | --- | --- |
| Local (esta máquina) | `fs` | No hay `SUPABASE_SECRET_KEY` en `.env.local` — ver sección 4 |
| Vercel Preview | `memory` (fallback) | `STORE_DRIVER` no está puesto en Preview y ahí tampoco hay secret key |
| Vercel Production | `supabase` | `STORE_DRIVER=supabase` + `SUPABASE_SECRET_KEY` |

## 2. Buckets de Storage — ✅ creados

Creados vía SQL con los límites y MIME de la tabla:

| Bucket | Público | Tamaño máx. por archivo | MIME permitidos | Ruta de los objetos |
| --- | --- | --- | --- | --- |
| `layers` | **No** (privado) | 20 MB | `image/png, image/jpeg, image/webp` | `<hash>.png` (o `.jpg` / `.webp`) |
| `renders` | **Sí** (lectura pública) | 20 MB | `image/png` | `<shortId>/<utm_content>.png` |

`layers` es privado porque la app nunca enlaza el bucket directamente: las capas se sirven por
`/api/asset/<hash>` (mismo origen, requisito del export). `renders` es público porque el driver
devuelve la URL pública del PNG para que se pueda compartir el enlace.

Los PNG de protagonista a 2K con canal alfa pesan entre 2 y 8 MB; por eso el límite de 20 MB.

SQL aplicado (migración `ad_factory_storage_buckets`, idempotente):

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('layers', 'layers', false, 20971520, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('renders', 'renders', true, 20971520, array['image/png'])
on conflict (id) do nothing;
```

La escritura la hace **sólo el servidor** con la secret key (que salta RLS), así que no hacen
falta políticas de Storage para `anon`/`authenticated`.

## 3. Tablas — ✅ creadas

Aplicado como migración `ad_factory_core_tables`. Queda aquí completo para poder recrearlo:

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
-- Postgres no indexa las FK por su cuenta: sin este índice el `on delete set null`
-- de assets.hash obliga a un seq scan de generations.
create index if not exists generations_asset_hash_idx on public.generations (asset_hash);

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

## 4. Variables de entorno — ✅ puestas en Vercel

Proyecto de Vercel: `marketing-habi/ad-factory` (`prj_ewUQA1amabioZLVjIym5OmdwDsfr`).
Estado real hoy:

| Variable | Vercel | Tipo | `.env.local` |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development | Config | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development | Config | ✅ |
| `SUPABASE_SECRET_KEY` | Production | Secret | ❌ (ver abajo) |
| `STORE_DRIVER` (`supabase`) | Production | Config | ❌ — local corre en `fs` |
| `REPLICATE_API_TOKEN` | Production, Preview, Development | Secret | ✅ |

Las `NEXT_PUBLIC_*` son tipo **Config** a propósito: Vercel no expone las Secret al build y
Next las necesita en build time. `SUPABASE_SECRET_KEY` y `REPLICATE_API_TOKEN` sólo se leen en
runtime (rutas `/api/*` y `/render/*`, todas dinámicas), así que Secret es correcto y no rompe
el build — verificado con `STORE_DRIVER=supabase npm run build` sin secret key en el entorno.

`SUPABASE_SECRET_KEY` la creó la integración de Supabase↔Vercel y **sólo existe en
Production**. Vercel no permite leer el valor de una Secret (`vercel env pull` escribe
`[SENSITIVE]`), así que no está en `.env.local` ni en Preview. Consecuencia buscada:

- **Local** corre con `STORE_DRIVER=fs`. Para probar el driver de Supabase en local hay que
  copiar la `sb_secret_…` del dashboard (Project Settings → API keys) a `.env.local` y poner
  `STORE_DRIVER=supabase`.
- **Preview** no tiene `STORE_DRIVER`, así que cae al fallback `memory` y funciona. Para que
  los Preview también escriban en Supabase: agregar `SUPABASE_SECRET_KEY` y
  `STORE_DRIVER=supabase` al target Preview.

Cuando se cambie una env hay que **redeploy**: las envs no se aplican al deploy anterior.

## 5. Prueba end-to-end

1. **Buckets** (sección 2) → ✅ `layers` privado y `renders` público, con límite de 20 MB.
2. **DDL** (sección 3) → ✅ la consulta de verificación devuelve las 3 tablas.
3. **Envs** (sección 4) → ✅ en Vercel Production.
4. **Migrar la caché local** — **no aplica en esta máquina**: no existe `.ad-factory-cache/`,
   así que no hay nada que subir. En una máquina que sí tenga caché (y con la secret key en
   `.env.local`), el script es idempotente:
   ```bash
   node scripts/migrate-cache-to-supabase.mjs --dry-run   # lista qué subiría, no sube nada
   node scripts/migrate-cache-to-supabase.mjs             # sube capas, renders y creativos
   ```
   Termina con un resumen tipo `✓ 14 capas · ✓ 6 renders · ✓ 6 creativos · 0 errores`.
5. **Pendiente — generar una capa en producción**: en `/` → Protagonista → cambiar cualquier
   atributo → "Generar protagonista". Al terminar, en Storage → `layers` hay un archivo nuevo y
   en `assets` una fila nueva con ese `hash`. Recargar `/biblioteca`: la capa aparece con su
   thumbnail servido desde `/api/asset/<hash>` (la ruta hace proxy del bucket privado).
6. **Pendiente — exportar un creativo en producción**: en `/` → "Guardar creativo". En Storage →
   `renders/<shortId>/` está el PNG con el nombre de la UTM; en `creatives` hay la fila con
   `render_path`.

Los pasos 5 y 6 gastan crédito de Replicate, así que se hacen a mano y una sola vez.

Si algo falla en 5 o 6, el error de la API viene en el JSON de respuesta
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
