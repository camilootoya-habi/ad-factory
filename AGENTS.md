<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Flujo de trabajo en este repo

Trabajamos varias personas en paralelo. Nunca commitear directo sobre `main`.

Para cada cambio:

1. `git checkout main && git pull` — **antes** de crear la rama, no después.
2. Crear la rama desde ese `main` actualizado.
3. Al terminar, hacer merge de la rama a `main`.

Ramificar desde un `main` viejo genera conflictos y arrastra trabajo ajeno al diff.

# Notas de este stack

- **Next.js 16 renombró `middleware` a `proxy`.** El archivo es `src/proxy.ts` y
  exporta `proxy()`. `middleware.ts` todavía funciona pero está deprecado.
- **Las `NEXT_PUBLIC_*` en Vercel deben ser tipo `Config`, no `Secret`.** Vercel
  no expone las variables sensibles al build, y Next.js necesita las
  `NEXT_PUBLIC_*` en build time para inyectarlas en el bundle. Guardarlas como
  sensibles las deja en `undefined` y `proxy.ts` lanza en cada request → 500 en
  todo el sitio. Son valores públicos por diseño, así que `Config` es lo
  correcto. La `service_role` / secret key nunca va con prefijo `NEXT_PUBLIC_`.
