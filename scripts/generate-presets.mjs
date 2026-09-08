#!/usr/bin/env node
/**
 * Genera (o recupera de caché) las capas de imagen que necesitan los presets, a través de
 * las rutas /api/generate/* del servidor de desarrollo. Gasta crédito de Replicate sólo
 * para las capas que aún no existen (caché por hash).
 *
 *   node scripts/generate-presets.mjs                 # los 6 presets, formato 1x1
 *   node scripts/generate-presets.mjs 02 04           # sólo esos presets
 *   node scripts/generate-presets.mjs --model fast    # nano-banana (barato) en vez de pro
 *   node scripts/generate-presets.mjs --format 9x16   # fondos para otro formato
 *   node scripts/generate-presets.mjs --dry-run       # sólo resuelve hashes, no genera
 *   node scripts/generate-presets.mjs --only fondo    # protagonista | fondo
 *
 * Requiere `npm run dev` corriendo (--base para otra URL).
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// presets.ts es TS puro sin alias: Node 25 lo importa con type-stripping nativo.
const { PRESETS } = await import(path.join(here, "..", "src", "lib", "creative", "presets.ts"));

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const has = (name) => argv.includes(`--${name}`);

const base = flag("base", "http://localhost:3000");
const format = flag("format", "1x1");
const model = flag("model", undefined);
const only = flag("only", undefined);
const dryRun = has("dry-run");
const wanted = argv.filter((a) => /^\d\d$/.test(a));

const keys = Object.keys(PRESETS).filter((k) => wanted.length === 0 || wanted.includes(k.slice(0, 2)));

async function postJson(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = undefined;
  }
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status} en ${url}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(req, label) {
  const t0 = Date.now();
  let state = await postJson(`${base}/api/generate/start`, req);
  let lastStage = "";
  for (;;) {
    if (state.status === "done") {
      const secs = ((Date.now() - t0) / 1000).toFixed(0);
      const cached = secs < 3 ? " (caché)" : "";
      console.log(`  ✓ ${label} → ${state.meta.hash} ${state.meta.width}×${state.meta.height} ${state.meta.mime}${state.meta.hasAlpha ? " alfa" : ""} · ${secs}s${cached}`);
      return state.meta;
    }
    if (state.status === "error") throw new Error(state.message);
    if (state.stage !== lastStage) {
      process.stdout.write(`  … ${label}: ${state.stage} (${state.predictionId})\n`);
      lastStage = state.stage;
    }
    if (Date.now() - t0 > 300_000) throw new Error(`timeout en ${label} (etapa ${state.stage})`);
    await sleep(3000);
    state = await postJson(`${base}/api/generate/poll`, { predictionId: state.predictionId, stage: state.stage, ctx: state.ctx });
  }
}

// Comprueba que el server responda.
try {
  const r = await fetch(`${base}/api/layers`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (e) {
  console.error(`No responde ${base} (${e.message}). Levanta el servidor con: npm run dev`);
  process.exit(1);
}

const jobs = [];
for (const key of keys) {
  const spec = PRESETS[key];
  const layout = spec.layouts?.[format] ?? {};
  const fondo = layout.fondo ?? spec.fondo;
  const prota = layout.protagonista ? { ...spec.protagonista, ...layout.protagonista } : spec.protagonista;
  if (fondo?.kind === "asset" && fondo.recipe && only !== "protagonista") {
    jobs.push({ key, kind: "fondo", attrs: fondo.recipe, model: fondo.model ?? model, format });
  }
  if (prota?.recipe && only !== "fondo") {
    jobs.push({ key, kind: "protagonista", attrs: prota.recipe, model: prota.model ?? model });
  }
}

console.log(`${jobs.length} capas para ${keys.length} presets (formato ${format}${model ? `, modelo ${model}` : ""})`);

const resolved = await postJson(`${base}/api/generate/resolve`, {
  items: jobs.map(({ kind, attrs, model, format }) => ({ kind, attrs, model, format })),
});
jobs.forEach((j, i) => {
  j.resolved = resolved.items[i];
  console.log(`  ${j.resolved.exists ? "✓ en caché" : "· falta   "} ${j.key} ${j.kind} ${j.resolved.hash} [${j.resolved.model}${j.resolved.needsRmbg ? " + rmbg" : ""}]`);
});

if (dryRun) process.exit(0);

const pending = jobs.filter((j) => !j.resolved.exists);
console.log(`\nGenerando ${pending.length} capas…`);
let failed = 0;
for (const j of pending) {
  try {
    await generate({ kind: j.kind, attrs: j.attrs, model: j.model, format: j.format }, `${j.key} ${j.kind}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${j.key} ${j.kind}: ${e.message}`);
  }
}
console.log(`\n${pending.length - failed} generadas · ${failed} fallidas · ${jobs.length - pending.length} ya estaban`);
process.exit(failed ? 1 : 0);
