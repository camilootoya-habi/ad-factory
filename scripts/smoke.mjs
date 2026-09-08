#!/usr/bin/env node
/**
 * Prueba de humo en navegador real (puppeteer-core + Chrome local).
 *
 *   node scripts/smoke.mjs [--base http://localhost:3000] [--keep]
 *
 * Comprueba, contra el servidor que ya esté corriendo:
 *  1. Las 4 rutas de la app cargan sin errores de consola ni excepciones.
 *  2. La fábrica con ?preset=… monta la pieza a tamaño real y queda "ready".
 *  3. El botón "Descargar PNG" produce un archivo, y ese archivo coincide en tamaño de
 *     canvas con el que saca el batch de Chrome (el modo de falla que hay que evitar:
 *     que el preview y el export divergan).
 *  4. La UTM visible describe la pieza y el archivo se llama igual que utm_content.
 *  5. En las 6 piezas el logo respeta el mínimo de 24 px y nada invade su clear space
 *     (salvo el contenedor del CTA cuando el logo va dentro, que es lo esperado).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const argv = process.argv.slice(2);
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : d;
};
const base = flag("base", "http://localhost:3000");
const keep = argv.includes("--keep");
const CHROME = process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PRESET = flag("preset", "03-casa-infografia");

const downloadDir = fs.mkdtempSync(path.join(os.tmpdir(), "ad-factory-smoke-"));
const failures = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures.push(m);
  console.error(`  ✗ ${m}`);
};

/** Ancho/alto de un PNG leyendo la cabecera IHDR. */
function pngSize(file) {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(24);
  fs.readSync(fd, buf, 0, 24, 0);
  fs.closeSync(fd);
  if (buf.toString("ascii", 1, 4) !== "PNG") throw new Error(`${file} no es PNG`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await fetch(`${base}/api/layers`).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
  });
} catch (e) {
  console.error(`No responde ${base} (${e.message}). Levanta el servidor con: npm run dev`);
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1"],
});

/** Abre una ruta y devuelve los errores de consola/página que produjo. */
async function visit(route, { waitFor, timeout = 45_000 } = {}) {
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 1 });
  await page.goto(`${base}${route}`, { waitUntil: "networkidle0", timeout });
  if (waitFor) await page.waitForSelector(waitFor, { timeout });
  return { page, errors };
}

console.log(`→ Prueba de humo contra ${base}\n`);

/* ------------------------------- 1. rutas ------------------------------- */
console.log("1. Rutas de la app");
for (const route of ["/", "/presets", "/biblioteca", "/creativos"]) {
  try {
    const { page, errors } = await visit(route);
    const title = await page.title();
    // Los avisos de recursos externos no cuentan; sólo errores de la app.
    const real = errors.filter((e) => !/favicon|Download the React DevTools/i.test(e));
    if (real.length) fail(`${route}: ${real.length} error(es) de consola → ${real[0].slice(0, 160)}`);
    else ok(`${route} carga sin errores (“${title}”)`);
    await page.close();
  } catch (e) {
    fail(`${route}: ${e.message}`);
  }
}

/* --------------------- 2 y 3. fábrica + export PNG --------------------- */
console.log("\n2. Fábrica con preset y export desde el navegador");
let downloaded = null;
let utmContent = null;
try {
  const { page, errors } = await visit(`/?preset=${PRESET}`, { waitFor: '[data-creative-root][data-creative-ready="true"]' });

  const geom = await page.$eval("[data-creative-root]", (el) => ({
    w: el.offsetWidth,
    h: el.offsetHeight,
    placeholders: el.querySelectorAll("[data-creative-placeholder]").length,
    transform: getComputedStyle(el).transform,
  }));
  if (geom.w === 1080 && geom.h === 1080) ok(`la pieza monta a tamaño real (${geom.w}×${geom.h})`);
  else fail(`la pieza monta a ${geom.w}×${geom.h}, se esperaba 1080×1080`);
  if (geom.placeholders === 0) ok("no hay capas faltantes (sin placeholders)");
  else fail(`${geom.placeholders} capa(s) sin generar en el preview`);
  if (geom.transform === "none" || geom.transform === "matrix(1, 0, 0, 1, 0, 0)") ok("el nodo capturado no hereda el scale del preview");
  else fail(`el nodo capturado lleva transform ${geom.transform}`);

  utmContent = await page.$$eval("button", (btns) => {
    const b = btns.find((x) => x.title === "Copiar utm_content");
    return b ? b.textContent.trim() : null;
  });
  if (utmContent && /^f1x1_/.test(utmContent)) ok(`UTM visible: ${utmContent.slice(0, 72)}…`);
  else fail(`no se encontró la utm_content en la página (${utmContent ?? "null"})`);

  await page.createCDPSession().then((c) =>
    c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir }),
  );

  const clicked = await page.$$eval("button", (btns) => {
    const b = btns.find((x) => x.textContent.trim() === "Descargar PNG");
    if (!b || b.disabled) return false;
    b.click();
    return true;
  });
  if (!clicked) fail("el botón «Descargar PNG» no existe o está deshabilitado");
  else {
    for (let i = 0; i < 60 && !downloaded; i++) {
      await sleep(500);
      const files = fs.readdirSync(downloadDir).filter((f) => f.endsWith(".png"));
      if (files.length) downloaded = path.join(downloadDir, files[0]);
    }
    if (downloaded) {
      const size = pngSize(downloaded);
      const bytes = fs.statSync(downloaded).size;
      ok(`PNG descargado: ${path.basename(downloaded).slice(0, 60)}… (${size.w}×${size.h}, ${(bytes / 1024).toFixed(0)} KB)`);
      if (size.w === 1080 && size.h === 1080) ok("el PNG sale a 1080×1080");
      else fail(`el PNG sale a ${size.w}×${size.h}`);
      if (utmContent && path.basename(downloaded) === `${utmContent}.png`) ok("el archivo se llama igual que utm_content");
      else fail(`el archivo (${path.basename(downloaded).slice(0, 50)}…) no coincide con utm_content`);
    } else {
      fail("no llegó ningún PNG al directorio de descargas");
    }
  }

  const real = errors.filter((e) => !/favicon|React DevTools/i.test(e));
  if (real.length) fail(`fábrica: ${real.length} error(es) de consola → ${real[0].slice(0, 160)}`);
  else ok("la fábrica no produjo errores de consola");

  await page.close();
} catch (e) {
  fail(`fábrica: ${e.message}`);
}

/* ------------------- 4. reglas del logo en las 6 piezas ------------------- */
console.log("\n4. Reglas del logo: mínimos y clear space");
// Clear space = 1x la altura de la "h" del wordmark; en habi-color.svg (canvas 500) mide 103.
const CLEAR_RATIO = 103 / 500;
const PRESET_KEYS = ["01-grafiti-muro", "02-mujer-encontro-comprador", "03-casa-infografia", "04-mujer-vende-tu-apto", "05-celular-compra-o-vende", "06-interior-listo-para-vender"];
for (const key of PRESET_KEYS) {
  try {
    const { page } = await visit(`/render/preset:${key}`, { waitFor: '[data-creative-root][data-creative-ready="true"]' });
    const r = await page.evaluate((ratio) => {
      const root = document.querySelector("[data-creative-root]");
      const base = root.getBoundingClientRect();
      const rel = (el) => {
        const b = el.getBoundingClientRect();
        return { x: b.left - base.left, y: b.top - base.top, w: b.width, h: b.height };
      };
      const logoEl = root.querySelector('[data-layer="logo"] img') ?? root.querySelector('[data-layer="logo"]');
      if (!logoEl) return { noLogo: true };
      const lg = rel(logoEl);
      const cs = lg.h * ratio;
      // Caja reservada: el dibujo mas el clear space en los 4 lados.
      const box = { x: lg.x - cs, y: lg.y - cs, w: lg.w + cs * 2, h: lg.h + cs * 2 };
      const slot = logoEl.getAttribute("data-slot") ?? "";
      const hits = [];
      for (const layer of ["titulo", "texto", "cta"]) {
        const el = root.querySelector(`[data-layer="${layer}"]`);
        if (!el) continue;
        const b = rel(el);
        const overlaps = b.x < box.x + box.w && b.x + b.w > box.x && b.y < box.y + box.h && b.y + b.h > box.y;
        if (overlaps) hits.push(layer);
      }
      return { logoH: lg.h, clearSpace: cs, hits, slot };
    }, CLEAR_RATIO);
    await page.close();

    if (r.noLogo) {
      fail(`${key}: no se renderizó el logo`);
      continue;
    }
    if (r.logoH >= 24) ok(`${key}: logo de ${Math.round(r.logoH)} px (mínimo 24)`);
    else fail(`${key}: logo de ${Math.round(r.logoH)} px, por debajo del mínimo de 24`);

    // El logo in-cta vive DENTRO del contenedor del CTA: ahí el solape es intencional.
    const inCta = r.slot === "in-cta";
    const invaden = r.hits.filter((h) => !(inCta && h === "cta"));
    if (invaden.length === 0) ok(`${key}: nada invade el clear space (${Math.round(r.clearSpace)} px)`);
    else fail(`${key}: ${invaden.join(", ")} invade(n) el clear space del logo`);
  } catch (e) {
    fail(`${key}: ${e.message}`);
  }
}

/* ------------------ 4. el batch coincide con el navegador ------------------ */
console.log("\n5. El batch de Chrome coincide con la descarga del navegador");
try {
  const outDir = path.join(downloadDir, "batch");
  execFileSync(process.execPath, ["scripts/render.mjs", `preset:${PRESET}`, "--out", outDir, "--base", base], {
    stdio: "pipe",
  });
  const batchFile = fs.readdirSync(outDir).find((f) => f.endsWith(".png"));
  if (!batchFile) throw new Error("el batch no produjo PNG");
  const b = pngSize(path.join(outDir, batchFile));
  ok(`batch: ${batchFile.slice(0, 60)}… (${b.w}×${b.h})`);
  if (downloaded) {
    const d = pngSize(downloaded);
    if (b.w === d.w && b.h === d.h) ok("navegador y batch producen el mismo canvas");
    else fail(`divergen: navegador ${d.w}×${d.h} vs batch ${b.w}×${b.h}`);
    if (path.basename(downloaded) === batchFile) ok("y el mismo nombre de archivo (misma UTM)");
    else fail(`nombres distintos:\n      navegador ${path.basename(downloaded)}\n      batch     ${batchFile}`);
  }
} catch (e) {
  fail(`batch: ${e.message.split("\n")[0]}`);
}

await browser.close();
if (!keep) fs.rmSync(downloadDir, { recursive: true, force: true });
else console.log(`\nArchivos en ${downloadDir}`);

console.log(`\n${failures.length === 0 ? "✓ Prueba de humo en verde" : `✗ ${failures.length} fallo(s)`}`);
process.exit(failures.length ? 1 : 0);
