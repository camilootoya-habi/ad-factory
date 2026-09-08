#!/usr/bin/env node
/**
 * Migra la caché local (.ad-factory-cache/) a Supabase: capas → bucket `layers` + tabla
 * `assets`; renders → bucket `renders`; creativos → tabla `creatives`. Idempotente: todo
 * es upsert, correrlo dos veces no duplica nada.
 *
 * Uso:
 *   node scripts/migrate-cache-to-supabase.mjs [--dry-run] [--dir <ruta>] [--only layers|renders|creatives]
 *
 * Env (se leen de process.env o, si faltan, de .env.local / .env en el cwd):
 *   NEXT_PUBLIC_SUPABASE_URL   URL del proyecto
 *   SUPABASE_SECRET_KEY        secret key (server-only). Nunca se imprime.
 *
 * El DDL de tablas y buckets está en src/lib/store/supabase.ts y en TODO.md.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------ argumentos ------------------------------ */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const dirArg = valueOf("--dir");
const only = valueOf("--only");

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
}

if (only && !["layers", "renders", "creatives"].includes(only)) {
  console.error(`--only debe ser layers | renders | creatives (recibí "${only}")`);
  process.exit(1);
}

/* --------------------------------- env ---------------------------------- */

async function loadDotEnv(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[m[1]] === undefined) process.env[m[1]] = value;
    }
  } catch {
    /* archivo opcional */
  }
}

await loadDotEnv(path.join(process.cwd(), ".env.local"));
await loadDotEnv(path.join(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error(
    [
      "Faltan variables para hablar con Supabase:",
      !url ? "  - NEXT_PUBLIC_SUPABASE_URL" : null,
      !secretKey ? "  - SUPABASE_SECRET_KEY (server-only, nunca NEXT_PUBLIC_)" : null,
      "",
      "Ponlas en .env.local (o expórtalas en la shell) y vuelve a correr.",
      "Detalle de dónde salen: TODO.md, sección Variables de entorno.",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  process.exit(1);
}

/* ------------------------------- helpers -------------------------------- */

const LAYERS_BUCKET = "layers";
const RENDERS_BUCKET = "renders";

const EXT_TO_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };
const MIME_TO_EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

const mimeFor = (name) => EXT_TO_MIME[path.extname(name).slice(1).toLowerCase()] ?? "image/png";
const extFor = (mime) => MIME_TO_EXT[mime] ?? "png";

async function readdirSafe(dir) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === "ENOENT") return [];
    throw err;
  }
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

const stats = { layers: ok(), renders: ok(), creatives: ok() };
function ok() {
  return { done: 0, failed: 0, skipped: 0 };
}

function tick(bucket, label, detail = "") {
  stats[bucket].done++;
  console.log(`  ✓ ${label}${detail ? `  ${detail}` : ""}`);
}
function cross(bucket, label, err) {
  stats[bucket].failed++;
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  console.log(`  ✗ ${label}  →  ${msg}`);
}
function skip(bucket, label, why) {
  stats[bucket].skipped++;
  console.log(`  · ${label}  (${why})`);
}

/* ------------------------------- cliente -------------------------------- */

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function upload(bucket, storagePath, bytes, contentType, cacheControl) {
  if (dryRun) return;
  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType,
    upsert: true,
    cacheControl,
  });
  if (error) throw new Error(`storage.${bucket}/${storagePath}: ${error.message}`);
}

async function upsertRow(table, row, onConflict) {
  if (dryRun) return;
  const { error } = await supabase.from(table).upsert(row, { onConflict });
  if (error) throw new Error(`tabla ${table}: ${error.message}`);
}

/* -------------------------------- capas --------------------------------- */

async function migrateLayers(root) {
  const dir = path.join(root, "layers");
  const entries = (await readdirSafe(dir)).filter((e) => e.isFile() && e.name.endsWith(".json"));
  console.log(`\nCapas (${entries.length}) en ${dir}`);

  for (const entry of entries) {
    const label = entry.name;
    try {
      const meta = JSON.parse(await fs.readFile(path.join(dir, entry.name), "utf8"));
      const hash = meta.hash ?? entry.name.replace(/\.json$/, "");
      if (!/^[a-f0-9]{16,64}$/.test(hash)) {
        skip("layers", label, "hash inválido");
        continue;
      }
      const ext = extFor(meta.mime);
      let imageFile = path.join(dir, `${hash}.${ext}`);
      if (!(await exists(imageFile))) {
        // Tolerancia: el meta puede decir png y el archivo ser jpg (o viceversa).
        const alt = ["png", "jpg", "webp"].map((e) => path.join(dir, `${hash}.${e}`));
        const found = [];
        for (const f of alt) if (await exists(f)) found.push(f);
        if (!found.length) {
          skip("layers", label, "sin archivo de imagen");
          continue;
        }
        imageFile = found[0];
      }
      const realExt = path.extname(imageFile).slice(1);
      const mime = EXT_TO_MIME[realExt] ?? meta.mime ?? "image/png";
      const storagePath = `${hash}.${realExt}`;
      const bytes = await fs.readFile(imageFile);

      await upload(LAYERS_BUCKET, storagePath, bytes, mime, "31536000");
      await upsertRow(
        "assets",
        {
          hash,
          kind: meta.kind,
          slug: meta.slug ?? "",
          attrs: meta.attrs ?? {},
          prompt: meta.prompt ?? "",
          model: meta.model ?? "",
          model_version: meta.modelVersion ?? null,
          prediction_id: meta.predictionId ?? null,
          storage_path: storagePath,
          width: meta.width ?? 0,
          height: meta.height ?? 0,
          has_alpha: Boolean(meta.hasAlpha),
          mime,
          created_at: meta.createdAt ?? new Date().toISOString(),
        },
        "hash",
      );
      tick("layers", label, `${meta.kind ?? "?"} · ${(bytes.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      cross("layers", label, err);
    }
  }
}

/* ------------------------------- renders -------------------------------- */

async function migrateRenders(root) {
  const dir = path.join(root, "renders");
  const shortDirs = (await readdirSafe(dir)).filter((e) => e.isDirectory());
  let total = 0;
  const jobs = [];
  for (const sd of shortDirs) {
    const files = (await readdirSafe(path.join(dir, sd.name))).filter((e) => e.isFile() && !e.name.endsWith(".tmp"));
    for (const f of files) jobs.push({ shortId: sd.name, filename: f.name });
    total += files.length;
  }
  console.log(`\nRenders (${total}) en ${dir}`);

  for (const { shortId, filename } of jobs) {
    const label = `${shortId}/${filename}`;
    try {
      const bytes = await fs.readFile(path.join(dir, shortId, filename));
      await upload(RENDERS_BUCKET, label, bytes, mimeFor(filename), "3600");
      tick("renders", label, `${(bytes.length / 1024).toFixed(0)} KB`);
    } catch (err) {
      cross("renders", label, err);
    }
  }
}

/* ------------------------------ creativos ------------------------------- */

async function migrateCreatives(root) {
  const dir = path.join(root, "creatives");
  const entries = (await readdirSafe(dir)).filter((e) => e.isFile() && e.name.endsWith(".json"));
  console.log(`\nCreativos (${entries.length}) en ${dir}`);

  for (const entry of entries) {
    const label = entry.name;
    try {
      const record = JSON.parse(await fs.readFile(path.join(dir, entry.name), "utf8"));
      const spec = record.spec;
      if (!spec || typeof spec !== "object") {
        skip("creatives", label, "sin spec");
        continue;
      }
      const id = spec.id ?? entry.name.replace(/\.json$/, "");
      // Un renderUrl local (/api/renders/...) sigue apuntando al servidor que lo sirva;
      // si el render también se migró, la ruta pública de Supabase es <url>/storage/v1/object/public/renders/<shortId>/<file>.
      let renderPath = record.renderUrl ?? null;
      const local = typeof renderPath === "string" && /^\/api\/renders\/([^/]+)\/([^/]+)$/.exec(renderPath);
      if (local) {
        const publicUrl = supabase.storage
          .from(RENDERS_BUCKET)
          .getPublicUrl(`${decodeURIComponent(local[1])}/${decodeURIComponent(local[2])}`).data.publicUrl;
        renderPath = publicUrl;
      }
      await upsertRow(
        "creatives",
        {
          id,
          short_id: spec.shortId ?? "",
          format: spec.format ?? "1x1",
          producto: spec.producto ?? "",
          pais: spec.pais ?? "co",
          spec,
          utm: record.utm ?? {},
          render_path: renderPath,
          created_at: record.createdAt ?? spec.createdAt ?? new Date().toISOString(),
        },
        "id",
      );
      tick("creatives", label, spec.name ?? "");
    } catch (err) {
      cross("creatives", label, err);
    }
  }
}

/* --------------------------------- main --------------------------------- */

const root = path.resolve(dirArg ?? process.env.AD_FACTORY_CACHE_DIR ?? path.join(process.cwd(), ".ad-factory-cache"));

if (!(await exists(root))) {
  console.error(`No existe la caché local: ${root}\nNada que migrar.`);
  process.exit(1);
}

console.log(`Migrando ${root} → ${new URL(url).host}${dryRun ? "  [dry-run: no se sube nada]" : ""}`);

if (!only || only === "layers") await migrateLayers(root);
if (!only || only === "renders") await migrateRenders(root);
if (!only || only === "creatives") await migrateCreatives(root);

const line = (name, s) => `  ${name.padEnd(10)} ✓ ${s.done}   ✗ ${s.failed}   · ${s.skipped}`;
console.log("\nResumen" + (dryRun ? " (dry-run)" : ""));
console.log(line("capas", stats.layers));
console.log(line("renders", stats.renders));
console.log(line("creativos", stats.creatives));

const failed = stats.layers.failed + stats.renders.failed + stats.creatives.failed;
process.exit(failed ? 1 : 0);
