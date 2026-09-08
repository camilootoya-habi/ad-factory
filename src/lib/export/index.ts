/**
 * Exportación en el browser: el <Creative> ya está a TAMAÑO REAL en px (1080×1080,
 * 1080×1350, 1080×1920 o 1920×1080), así que capturar su nodo raíz a escala 1 produce el
 * PNG final. Mismo componente, mismo tamaño, sin transform: lo que se ve es lo que se descarga.
 *
 * Trampas que este módulo resuelve (y por qué):
 *
 * 1. FUENTES. modern-screenshot serializa el DOM a un SVG con <foreignObject> y lo pinta en
 *    un canvas. Si Montserrat/Inter aún no cargaron, el texto se mide con la fuente de
 *    reemplazo y los px de cada línea cambian. Se espera `document.fonts.ready` y, además,
 *    `document.fonts.load` de los pesos 400/600/700 de las familias reales (next/font las
 *    registra con nombres tipo "__Montserrat_abc123", así que se resuelven desde
 *    getComputedStyle en vez de escribirlas a mano).
 *
 * 2. TAINTING. Un SVG cargado como imagen no puede pedir recursos externos y un canvas con
 *    recursos de otro origen queda "tainted" (toBlob lanza). modern-screenshot incrusta las
 *    <img> como data URLs; aquí se hace antes (fetch mismo origen → blob → FileReader) y se
 *    le entrega por `fetchFn`, así la captura no depende de un segundo round-trip ni del
 *    caché HTTP, y una imagen que no se pueda leer falla con un mensaje claro.
 *
 * 3. TRANSFORM DEL WRAPPER. En el configurador el Creative vive dentro de <CanvasFit>, que
 *    lo reduce con `transform: scale(k)`. La captura NO hereda esa escala: modern-screenshot
 *    clona el nodo raíz y copia sus estilos computados (los transforms de los ancestros no
 *    forman parte del estilo computado del hijo) y el tamaño del lienzo se fija con
 *    `width`/`height` explícitos (offsetWidth/offsetHeight, que tampoco dependen de
 *    transforms), en vez de getBoundingClientRect (que sí saldría escalado). Como red de
 *    seguridad se lee el IHDR del PNG resultante y se verifica que mida exactamente lo esperado.
 */

import JSZip from "jszip";
import { domToBlob } from "modern-screenshot";
import { CREATIVE_PLACEHOLDER_SELECTOR, CREATIVE_READY_SELECTOR } from "@/components/creative/Creative";

export class ExportError extends Error {
  override name = "ExportError";
}

export type ExportPngOptions = {
  /** Multiplicador de píxeles: 1 = tamaño del formato (1080…), 2 = doble densidad. */
  pixelRatio?: number;
  /** Tope de espera para fuentes, imágenes y rasterizado (por defecto 30 s). */
  timeoutMs?: number;
  /** Exporta aunque falten capas de imagen (placeholders). Por defecto se rechaza. */
  allowPlaceholders?: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;
/** Pesos que usa la pieza (AD_SCALE: 400/600/700). */
const FONT_WEIGHTS = [400, 600, 700] as const;

/* ------------------------------------------------------------------ */
/* API pública                                                          */
/* ------------------------------------------------------------------ */

/**
 * Captura el nodo raíz del <Creative> ([data-creative-root]) y devuelve un Blob image/png
 * del tamaño exacto del formato (× pixelRatio). Lanza ExportError con mensaje legible.
 */
export async function exportCreativePng(root: HTMLElement, opts: ExportPngOptions = {}): Promise<Blob> {
  const pixelRatio = opts.pixelRatio ?? 1;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (typeof document === "undefined") throw new ExportError("exportCreativePng sólo corre en el browser.");
  if (!root.isConnected) throw new ExportError("El nodo a exportar no está montado en el documento.");
  if (!Number.isFinite(pixelRatio) || pixelRatio <= 0) throw new ExportError(`pixelRatio inválido: ${pixelRatio}.`);
  if (!opts.allowPlaceholders && root.querySelector(CREATIVE_PLACEHOLDER_SELECTOR)) {
    throw new ExportError("Pieza incompleta: hay capas de imagen sin generar. Genera las capas antes de exportar.");
  }

  // offsetWidth/offsetHeight ignoran el transform del wrapper: es el tamaño real de la pieza.
  const width = root.offsetWidth;
  const height = root.offsetHeight;
  if (!width || !height) throw new ExportError("El nodo a exportar no tiene tamaño (¿está oculto con display:none?).");

  await waitForFonts(root, timeoutMs);
  await waitForImages(root, timeoutMs);
  const inlined = await inlineImageSources(root, timeoutMs);

  let blob: Blob;
  try {
    blob = await withTimeout(
      domToBlob(root, {
        scale: pixelRatio,
        width,
        height,
        type: "image/png",
        backgroundColor: null,
        // La pieza puede llevar saltos de línea (\n en runs); no queremos que los toque.
        features: { removeControlCharacter: false },
        // Data URLs ya leídas; `false` deja que modern-screenshot resuelva lo que no conozcamos.
        fetchFn: async (url) => inlined.get(url) ?? false,
        timeout: timeoutMs,
      }),
      timeoutMs,
      "Tiempo agotado rasterizando la pieza.",
    );
  } catch (err) {
    if (err instanceof ExportError) throw err;
    throw new ExportError(`No se pudo rasterizar la pieza: ${messageOf(err)}`);
  }

  if (!blob || blob.size === 0) throw new ExportError("La captura salió vacía.");

  const size = await pngSize(blob);
  const expected = { w: Math.floor(width * pixelRatio), h: Math.floor(height * pixelRatio) };
  if (!size) throw new ExportError("La captura no es un PNG válido.");
  if (size.w !== expected.w || size.h !== expected.h) {
    throw new ExportError(
      `La captura mide ${size.w}×${size.h} y debía medir ${expected.w}×${expected.h}: el nodo heredó una escala del contenedor.`,
    );
  }

  return blob.type === "image/png" ? blob : new Blob([blob], { type: "image/png" });
}

/** Igual que exportCreativePng pero devuelve data URL (lo que acepta POST /api/renders/<shortId>). */
export async function exportCreativeDataUrl(root: HTMLElement, opts?: ExportPngOptions): Promise<string> {
  return blobToDataUrl(await exportCreativePng(root, opts));
}

/**
 * Espera a que el <Creative> declare data-creative-ready="true" (imágenes y fuentes listas).
 * Útil justo antes de exportar tras cambiar spec/formato/URLs.
 */
export function waitForCreativeReady(root: HTMLElement, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  if (root.matches(CREATIVE_READY_SELECTOR)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new ExportError("Tiempo agotado esperando a que la pieza esté lista (data-creative-ready)."));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      if (root.matches(CREATIVE_READY_SELECTOR)) {
        clearTimeout(timer);
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-creative-ready"] });
  });
}

/** Dispara la descarga de un Blob con el nombre dado (sin navegar). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Se revoca después: algunos navegadores leen el objectURL de forma asíncrona tras el click.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export type ZipItem = { filename: string; blob: Blob };

/** Arma un zip (DEFLATE) con los archivos dados; nombres repetidos reciben sufijo -2, -3… */
export async function zipBlobs(items: ZipItem[]): Promise<Blob> {
  if (items.length === 0) throw new ExportError("No hay archivos para el zip.");
  const zip = new JSZip();
  const used = new Set<string>();
  for (const { filename, blob } of items) {
    zip.file(uniqueName(filename, used), blob, { binary: true });
  }
  return zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

/** Zip + descarga. `zipName` puede venir sin extensión. */
export async function exportZip(items: ZipItem[], zipName: string): Promise<void> {
  const blob = await zipBlobs(items);
  downloadBlob(blob, zipName.toLowerCase().endsWith(".zip") ? zipName : `${zipName}.zip`);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ExportError("No se pudo leer el blob como data URL."));
    reader.readAsDataURL(blob);
  });
}

/* ------------------------------------------------------------------ */
/* Fuentes                                                              */
/* ------------------------------------------------------------------ */

/** Primera familia de una lista CSS: `"__Montserrat_abc", "__Montserrat_Fallback_abc", -apple-system` → __Montserrat_abc */
function firstFamily(list: string): string | null {
  const first = list.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first ? first : null;
}

async function waitForFonts(root: HTMLElement, timeoutMs: number): Promise<void> {
  if (!document.fonts) return;
  await withTimeout(document.fonts.ready, timeoutMs, "Tiempo agotado esperando document.fonts.ready.");

  const cs = getComputedStyle(root);
  const families = new Set<string>();
  // Los tokens del brand center (--font-headings/--font-body) ya resuelven a la familia real de next/font.
  for (const token of ["--font-headings", "--font-body"]) {
    const fam = firstFamily(cs.getPropertyValue(token));
    if (fam) families.add(fam);
  }
  const rootFamily = firstFamily(cs.fontFamily);
  if (rootFamily) families.add(rootFamily);

  // El texto real de la pieza decide qué subsets (latin / latin-ext) hace falta cargar.
  const sample = (root.textContent ?? "").trim() || " ";
  const loads: Promise<unknown>[] = [];
  for (const family of families) {
    for (const weight of FONT_WEIGHTS) {
      const font = `${weight} 16px "${family}"`;
      // check() devuelve false sólo si hay @font-face que casan y aún no cargaron.
      if (!document.fonts.check(font, sample)) {
        loads.push(document.fonts.load(font, sample).catch(() => undefined));
      }
    }
  }
  if (loads.length > 0) {
    await withTimeout(Promise.all(loads), timeoutMs, "Tiempo agotado cargando las fuentes de la pieza.");
  }
}

/* ------------------------------------------------------------------ */
/* Imágenes                                                             */
/* ------------------------------------------------------------------ */

function describeImg(img: HTMLImageElement): string {
  const layer = img.getAttribute("data-layer");
  const src = img.currentSrc || img.src;
  const shown = src.startsWith("data:") ? "data:…" : src;
  return layer ? `${layer} (${shown})` : shown;
}

function waitForImage(img: HTMLImageElement, timeoutMs: number): Promise<void> {
  if (img.complete) {
    if (img.naturalWidth > 0) return Promise.resolve();
    return Promise.reject(new ExportError(`La imagen no cargó: ${describeImg(img)}.`));
  }
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new ExportError(`Tiempo agotado esperando la imagen: ${describeImg(img)}.`));
    }, timeoutMs);
    const onLoad = () => {
      cleanup();
      if (img.naturalWidth > 0) resolve();
      else reject(new ExportError(`La imagen cargó vacía: ${describeImg(img)}.`));
    };
    const onError = () => {
      cleanup();
      reject(new ExportError(`La imagen no cargó: ${describeImg(img)}.`));
    };
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
  });
}

async function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map((img) => waitForImage(img, timeoutMs)));
}

/**
 * Lee cada <img> (mismo origen: /api/asset/<hash>, /brand/*.svg) y la convierte a data URL.
 * La clave es la URL absoluta (`currentSrc || src`), que es la que modern-screenshot pasa a `fetchFn`.
 */
async function inlineImageSources(root: HTMLElement, timeoutMs: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const urls = new Set<string>();
  for (const img of Array.from(root.querySelectorAll("img"))) {
    const src = img.currentSrc || img.src;
    if (src && !src.startsWith("data:")) urls.add(src);
  }
  await Promise.all(
    Array.from(urls).map(async (url) => {
      try {
        const res = await fetch(url, {
          cache: "force-cache",
          credentials: "same-origin",
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        out.set(url, await blobToDataUrl(await res.blob()));
      } catch (err) {
        throw new ExportError(`No se pudo leer la imagen ${url} para incrustarla: ${messageOf(err)}`);
      }
    }),
  );
  return out;
}

/* ------------------------------------------------------------------ */
/* Utilidades                                                           */
/* ------------------------------------------------------------------ */

/** Ancho y alto del IHDR de un PNG (bytes 16–24), o null si no es PNG. */
async function pngSize(blob: Blob): Promise<{ w: number; h: number } | null> {
  const head = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  if (head.length < 24) return null;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  if (!isPng) return null;
  const view = new DataView(head.buffer, head.byteOffset, head.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

function uniqueName(filename: string, used: Set<string>): string {
  if (!used.has(filename)) {
    used.add(filename);
    return filename;
  }
  const dot = filename.lastIndexOf(".");
  const stem = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : "";
  for (let i = 2; ; i++) {
    const candidate = `${stem}-${i}${ext}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ExportError(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
