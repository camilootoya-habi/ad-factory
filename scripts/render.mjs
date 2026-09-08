#!/usr/bin/env node
/**
 * Batch de renders en Chrome headless (puppeteer-core + Chrome local).
 *
 * Abre /render/<id>?format=…&date=… en el servidor Next que ya esté corriendo, espera a que
 * el <Creative> declare data-creative-ready="true" y captura SOLO el nodo de la pieza a
 * tamaño real (viewport = px del formato, deviceScaleFactor 1). Mismo componente que el
 * preview y que la descarga del browser: lo que se ve es lo que sale.
 *
 * Uso:
 *   node scripts/render.mjs [--base http://localhost:3000] [--out .renders]
 *                           [--format 1x1,4x5,9x16,16x9] [--zip nombre.zip]
 *                           [--date YYYY-MM-DD] [--strict] [--timeout 60000]
 *                           [--presets] [--all-creatives] [ids | preset:<key> ...]
 *
 * Sin --format se renderiza el formato propio de cada pieza. --strict convierte las capas
 * faltantes (placeholders) en error. El nombre del PNG es el utm_content que expone la ruta
 * en <meta name="ad-factory:filename">; si no está, `<id>-<formato>.png`.
 *
 * Requiere el servidor arriba: `npm run dev` (o `npm run build && npm start`).
 * Chrome: /Applications/Google Chrome.app/... o la ruta en CHROME_PATH.
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";

/** Espejo de src/lib/creative/scale.ts (el script corre sin TypeScript). */
const FORMATS = {
  "1x1": { w: 1080, h: 1080 },
  "4x5": { w: 1080, h: 1350 },
  "9x16": { w: 1080, h: 1920 },
  "16x9": { w: 1920, h: 1080 },
};

/** Espejo de src/components/creative/Creative.tsx. */
const ROOT_SELECTOR = "[data-creative-root]";
const READY_SELECTOR = '[data-creative-root][data-creative-ready="true"]';
const PLACEHOLDER_SELECTOR = "[data-creative-placeholder]";
const MISSING_SELECTOR = '[data-missing-assets="true"]';
const FILENAME_META = 'meta[name="ad-factory:filename"]';

const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const HELP = `
Uso: node scripts/render.mjs [opciones] [ids | preset:<key> ...]

  --base <url>          Servidor Next (default http://localhost:3000)
  --out <dir>           Carpeta de salida (default .renders)
  --format <lista>      Formatos separados por coma: 1x1,4x5,9x16,16x9 (default: el de cada pieza)
  --zip <nombre.zip>    Además de los PNG, arma un zip en --out
  --date <YYYY-MM-DD>   Fecha de campaña para la UTM (default hoy, UTC)
  --presets             Renderiza los 6 presets semilla
  --all-creatives       Renderiza todos los creativos guardados en el store
  --strict              Falla si una pieza tiene capas de imagen faltantes
  --timeout <ms>        Espera máxima por pieza (default 60000)
  -h, --help            Esta ayuda

Ejemplos:
  npm run render:presets
  node scripts/render.mjs --presets --format 1x1,9x16 --zip presets.zip
  node scripts/render.mjs preset:04-mujer-vende-tu-apto 3f1c…-uuid --format 4x5
`.trim();

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const opts = {
    base: "http://localhost:3000",
    out: ".renders",
    formats: null,
    zip: null,
    date: new Date().toISOString().slice(0, 10),
    presets: false,
    allCreatives: false,
    strict: false,
    timeout: 60_000,
    ids: [],
    help: false,
  };
  const takeValue = (flag, i) => {
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) throw new Error(`Falta el valor de ${flag}.`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--base":
        opts.base = takeValue(a, i++).replace(/\/+$/, "");
        break;
      case "--out":
        opts.out = takeValue(a, i++);
        break;
      case "--format":
        opts.formats = takeValue(a, i++)
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean);
        break;
      case "--zip":
        opts.zip = takeValue(a, i++);
        break;
      case "--date":
        opts.date = takeValue(a, i++);
        break;
      case "--timeout":
        opts.timeout = Number(takeValue(a, i++));
        break;
      case "--presets":
        opts.presets = true;
        break;
      case "--all-creatives":
        opts.allCreatives = true;
        break;
      case "--strict":
        opts.strict = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        if (a.startsWith("--")) throw new Error(`Opción desconocida: ${a}`);
        opts.ids.push(a);
    }
  }
  if (opts.formats) {
    const bad = opts.formats.filter((f) => !(f in FORMATS));
    if (bad.length) throw new Error(`Formato(s) inválido(s): ${bad.join(", ")}. Válidos: ${Object.keys(FORMATS).join(", ")}.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) throw new Error(`--date debe ser YYYY-MM-DD (llegó "${opts.date}").`);
  if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) throw new Error("--timeout debe ser un número de milisegundos > 0.");
  return opts;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

const fmtBytes = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
const fmtSecs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/** Nombre de archivo plano y seguro (sin rutas ni caracteres raros). */
function sanitizeFilename(name, fallback) {
  const base = String(name ?? "")
    .split(/[\\/]/)
    .pop()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const withExt = /\.png$/i.test(base) ? base : `${base}.png`;
  return base ? withExt : fallback;
}

/** Ancho y alto del IHDR de un PNG. */
function pngSize(buf) {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

async function checkServer(base) {
  try {
    const res = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(8000) });
    if (res.status >= 500) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    const why = err instanceof Error ? err.message : String(err);
    throw new Error(
      `El servidor no responde en ${base} (${why}).\n` +
        `Levántalo en otra terminal con:\n    npm run dev\n` +
        `(o en producción: npm run build && npm start) y vuelve a correr este script.\n` +
        `Si corre en otro puerto, pásalo con --base http://localhost:<puerto>.`,
    );
  }
}

async function fetchManifest(base) {
  const res = await fetch(`${base}/render/manifest`, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`GET /render/manifest respondió ${res.status}.`);
  return res.json();
}

async function resolveChrome() {
  const chromePath = process.env.CHROME_PATH || DEFAULT_CHROME;
  try {
    await access(chromePath);
  } catch {
    throw new Error(`No encuentro Chrome en "${chromePath}". Instálalo o apunta CHROME_PATH al binario.`);
  }
  return chromePath;
}

/* ------------------------------------------------------------------ */
/* Render de una pieza                                                  */
/* ------------------------------------------------------------------ */

/**
 * Renderiza `id` en `format` (o el propio de la pieza si es null) y devuelve
 * { filename, buffer, format, missing, placeholders, warnings }.
 */
async function renderOne(page, opts, id, format) {
  const warnings = [];
  const qs = new URLSearchParams({ date: opts.date });
  if (format) qs.set("format", format);
  // encodeURIComponent codifica ":" pero es legal en un path; se deja legible.
  const url = `${opts.base}/render/${encodeURIComponent(id).replace(/%3A/gi, ":")}?${qs}`;

  // Con formato conocido el viewport se fija antes de navegar; si no, se lee del root.
  const size = format ? FORMATS[format] : { w: 1920, h: 1920 };
  await page.setViewport({ width: size.w, height: size.h, deviceScaleFactor: 1 });

  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: opts.timeout });
  const status = response?.status() ?? 0;
  if (status === 404) throw new Error(`no existe (${url} → 404)`);
  if (status >= 400) throw new Error(`el servidor respondió ${status} en ${url}`);

  await page.waitForSelector(READY_SELECTOR, { timeout: opts.timeout });

  const actualFormat = await page.$eval(ROOT_SELECTOR, (el) => el.getAttribute("data-format"));
  if (!format) {
    if (!(actualFormat in FORMATS)) throw new Error(`la pieza declara un formato desconocido: ${actualFormat}`);
    format = actualFormat;
    const s = FORMATS[format];
    await page.setViewport({ width: s.w, height: s.h, deviceScaleFactor: 1 });
  } else if (actualFormat !== format) {
    warnings.push(`la página renderizó ${actualFormat} y se pidió ${format}`);
  }

  // Dos frames para que el layout se asiente tras el último cambio de viewport.
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));

  const missing = (await page.$(MISSING_SELECTOR)) !== null;
  const placeholders = (await page.$$(PLACEHOLDER_SELECTOR)).length;
  if (missing || placeholders > 0) {
    warnings.push(`capas de imagen faltantes (${placeholders} placeholder${placeholders === 1 ? "" : "s"}): genera las capas antes del render final`);
  }

  let filename = await page.$eval(FILENAME_META, (el) => el.getAttribute("content")).catch(() => null);
  const fallback = sanitizeFilename(`${id.replace(/^preset:/, "")}-${format}`, `render-${format}.png`);
  if (!filename) warnings.push("la ruta no expuso ad-factory:filename; se usa el nombre por defecto");
  filename = sanitizeFilename(filename, fallback);

  const root = await page.$(ROOT_SELECTOR);
  if (!root) throw new Error("no se encontró [data-creative-root]");
  const buffer = Buffer.from(await root.screenshot({ type: "png", omitBackground: false }));

  const expected = FORMATS[format];
  const got = pngSize(buffer);
  if (!got) throw new Error("la captura no es un PNG válido");
  if (got.w !== expected.w || got.h !== expected.h) {
    warnings.push(`la captura mide ${got.w}×${got.h}; se esperaba ${expected.w}×${expected.h}`);
  }

  return { filename, buffer, format, missing, placeholders, warnings };
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(HELP);
    return 0;
  }
  if (!opts.presets && !opts.allCreatives && opts.ids.length === 0) {
    console.error("Nada que renderizar: pasa ids, --presets o --all-creatives.\n");
    console.error(HELP);
    return 2;
  }

  await checkServer(opts.base);
  const chromePath = await resolveChrome();

  // Objetivos: ids explícitos + presets + creativos del store, sin repetir.
  const targets = new Map();
  for (const id of opts.ids) targets.set(id, { id, label: id });
  if (opts.presets || opts.allCreatives) {
    const manifest = await fetchManifest(opts.base);
    if (opts.presets) for (const p of manifest.presets) targets.set(p.id, { id: p.id, label: `${p.key} · ${p.name}` });
    if (opts.allCreatives) {
      if (manifest.creatives.length === 0) console.warn("⚠ No hay creativos guardados en el store.");
      for (const c of manifest.creatives) targets.set(c.id, { id: c.id, label: `${c.shortId} · ${c.name}` });
    }
  }

  const formats = opts.formats ?? [null];
  const jobs = [];
  for (const t of targets.values()) for (const f of formats) jobs.push({ ...t, format: f });

  const outDir = path.resolve(process.cwd(), opts.out);
  await mkdir(outDir, { recursive: true });

  console.log(`→ ${jobs.length} render(s) · servidor ${opts.base} · salida ${outDir} · fecha UTM ${opts.date}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--hide-scrollbars", "--force-device-scale-factor=1", "--font-render-hinting=none", "--disable-lcd-text"],
    defaultViewport: { width: 1080, height: 1080, deviceScaleFactor: 1 },
  });

  const results = { ok: 0, warned: 0, failed: 0 };
  const rendered = [];
  const startedAll = Date.now();
  try {
    const page = await browser.newPage();
    for (const job of jobs) {
      const started = Date.now();
      const tag = `${job.label}${job.format ? ` · ${job.format}` : ""}`;
      try {
        const r = await renderOne(page, opts, job.id, job.format);
        const fatalMissing = opts.strict && (r.missing || r.placeholders > 0);
        if (fatalMissing) throw new Error(`capas faltantes con --strict (${r.placeholders} placeholder(s))`);
        const file = path.join(outDir, r.filename);
        await writeFile(file, r.buffer);
        rendered.push({ filename: r.filename, buffer: r.buffer });
        const mark = r.warnings.length ? "⚠" : "✓";
        if (r.warnings.length) results.warned++;
        else results.ok++;
        console.log(`${mark} ${r.filename} (${fmtBytes(r.buffer.length)}, ${r.format}, ${fmtSecs(Date.now() - started)}) — ${tag}`);
        for (const w of r.warnings) console.log(`    · ${w}`);
      } catch (err) {
        results.failed++;
        const why = err instanceof Error ? err.message : String(err);
        console.error(`✗ ${tag}: ${why} (${fmtSecs(Date.now() - started)})`);
      }
    }
  } finally {
    await browser.close();
  }

  if (opts.zip && rendered.length > 0) {
    const zip = new JSZip();
    const used = new Set();
    for (const { filename, buffer } of rendered) {
      let name = filename;
      for (let i = 2; used.has(name); i++) name = filename.replace(/\.png$/i, `-${i}.png`);
      used.add(name);
      zip.file(name, buffer, { binary: true });
    }
    const zipName = /\.zip$/i.test(opts.zip) ? opts.zip : `${opts.zip}.zip`;
    const zipPath = path.join(outDir, path.basename(zipName));
    const bytes = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await writeFile(zipPath, bytes);
    console.log(`📦 ${zipPath} (${fmtBytes(bytes.length)}, ${rendered.length} archivo(s))`);
  }

  const total = results.ok + results.warned + results.failed;
  console.log(
    `\n${results.failed === 0 ? "✓" : "✗"} ${total} render(s) en ${fmtSecs(Date.now() - startedAll)}: ` +
      `${results.ok} ok · ${results.warned} con avisos · ${results.failed} fallido(s)`,
  );
  return results.failed > 0 ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
