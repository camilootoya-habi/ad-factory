# ad-factory

Proyecto de Habi sobre **Next.js 16** (App Router) + **Supabase** + **Vercel**.

## Stack

| Pieza | Detalle |
| --- | --- |
| Framework | Next.js 16 (App Router, `src/`, TypeScript, Tailwind v4) |
| Base de datos / Auth | Supabase (`@supabase/ssr`) |
| Hosting | Vercel — deploy automático en cada push |

## Desarrollo local

```bash
cp .env.example .env.local   # y llenar con los valores del proyecto Supabase
npm install
npm run dev
```

La home (`/`) muestra un chequeo de conectividad contra el Data API de Supabase.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_…`) |

Ambas son públicas por diseño: viajan al browser. La `service_role` / secret key
**nunca** va en una variable `NEXT_PUBLIC_`.

## Clientes de Supabase

| Archivo | Cuándo usarlo |
| --- | --- |
| `src/lib/supabase/client.ts` | Client Components (`"use client"`) |
| `src/lib/supabase/server.ts` | Server Components, Server Actions, Route Handlers |
| `src/proxy.ts` | Refresca la sesión en cada request (Next 16 renombró `middleware` → `proxy`) |

## Deploy

Cada push a `main` dispara un deploy de producción en Vercel; cada push a otra
rama o PR genera un preview deployment.
