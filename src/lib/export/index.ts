/**
 * Exportación en el browser: DOM → PNG con modern-screenshot, el mismo nodo que se ve en
 * el preview. Tres trampas que aquí se resuelven a propósito:
 *
 * 1. Fuentes: si se captura antes de que Montserrat/Inter estén cargadas, el PNG sale con
 *    la fuente de reemplazo y otros px. Se espera document.fonts.ready y a los pesos usados.
 * 2. Tainting: las <img> deben ser mismo origen (/api/asset/<hash>) o data:. Antes de
 *    capturar se convierten a data: URL para que el rasterizado no dependa de la red ni
 *    de CORS; al terminar se restauran.
 * 3. Escala: el root del <Creative> ya está a tamaño real; el wrapper de CanvasFit lleva
 *    transform: scale(). Se captura el root con width/height explícitos y scale 1: el
 *    transform del padre no afecta al nodo capturado porque modern-screenshot clona el nodo
 *    y lo rasteriza en su propio contexto.
 */

import JSZip from "jszip";
import { domToBlob } from "modern-screenshot";

export type ExportOptions = {
  /** 1 = tamaño real (el root ya mide 1080×… px). */
  pixelRatio?: number;
  /** Rechaza la captura si hay capas de imagen sin generar (placeholders). Default true. */
  rejectPlaceholders?: boolean;
};

const PLACEHOLDER_SELECTOR = "[data-creative-placeholder]";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Espera a que las fuentes de marca (con los pesos que usa la pieza) estén disponibles. */
async function waitForFonts(root: HTMLElement): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;

  // Familias reales detrás de las variables: next/font genera nombres como "__Montserrat_abc123".
  const families = new Set<string>();
  const weights = new Set<string>();
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const cs = getComputedStyle(el);
    if (el.textContent?.trim()) {
      families.add(cs.fontFamily.split(",")[0].trim().replace(/^["']|["']$/g, ""));
      weights.add(cs.fontWeight || "400");
    }
  });

  const pending: Promise<unknown>[] = [];
  for (const family of families) {
    for (const weight of weights) {
      const spec = `${weight} 16px "${family}"`;
      if (!document.fonts.check(spec)) pending.push(document.fonts.load(spec).catch(() => undefined));
    }
  }
  if (pending.length) await Promise.all(pending);
}

/** Espera a que todas las <img> del root hayan terminado de cargar. */
async function waitForImages(root: HTMLElement, timeoutMs = 15_000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const started = Date.now();
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve, reject) => {
          if (img.complete && img.naturalWidth > 0) return resolve();
          const done = () => {
            cleanup();
            resolve();
          };
          const fail = () => {
            cleanup();
            reject(new Error(`No cargó la imagen ${img.src.slice(0, 80)}…`));
          };
          const cleanup = () => {
            img.removeEventListener("load", done);
            img.removeEventListener("error", fail);
          };
          img.addEventListener("load", done);
          img.addEventListener("error", fail);
          const tick = () => {
            if (Date.now() - started > timeoutMs) return fail();
            if (img.complete && img.naturalWidth > 0) return done();
            setTimeout(tick, 100);
          };
          tick();
        }),
    ),
  );
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("No se pudo leer el blob."));
    fr.readAsDataURL(blob);
  });
}

/** Convierte las <img> mismo-origen a data: URL. Devuelve una función que restaura los src. */
async function inlineImages(root: HTMLElement): Promise<() => void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const originals = new Map<HTMLImageElement, string>();
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      const res = await fetch(src, { cache: "force-cache" });
      if (!res.ok) throw new Error(`No se pudo leer ${src} (${res.status}).`);
      const dataUrl = await blobToDataUrl(await res.blob());
      originals.set(img, src);
      img.setAttribute("src", dataUrl);
      await new Promise<void>((r) => {
        if (img.complete) return r();
        img.addEventListener("load", () => r(), { once: true });
        img.addEventListener("error", () => r(), { once: true });
      });
    }),
  );
  return () => {
    originals.forEach((src, img) => img.setAttribute("src", src));
  };
}

/**
 * Captura el nodo [data-creative-root] tal cual se ve y devuelve un PNG.
 * Lanza Error legible si faltan capas, no cargan imágenes o la captura falla.
 */
export async function exportCreativePng(root: HTMLElement, opts: ExportOptions = {}): Promise<Blob> {
  const { pixelRatio = 1, rejectPlaceholders = true } = opts;
  if (!root.matches("[data-creative-root]")) {
    throw new Error("El nodo a exportar debe ser el root de la pieza ([data-creative-root]), no el wrapper escalado.");
  }
  if (rejectPlaceholders && root.querySelector(PLACEHOLDER_SELECTOR)) {
    throw new Error("La pieza tiene capas sin generar. Genera o elige las capas de imagen antes de exportar.");
  }

  await waitForImages(root);
  await waitForFonts(root);
  const restore = await inlineImages(root);
  // Un frame para que el navegador pinte los data: URL antes de clonar.
  await sleep(50);

  try {
    const width = root.offsetWidth;
    const height = root.offsetHeight;
    const blob = await domToBlob(root, {
      scale: pixelRatio,
      width,
      height,
      type: "image/png",
      backgroundColor: null,
      // Las <img> ya son data: URL; las fuentes vienen de /_next/static (mismo origen).
      fetch: { requestInit: { cache: "force-cache" } },
      style: { transform: "none", margin: "0" },
    });
    if (!blob) throw new Error("La captura devolvió vacío.");
    return blob;
  } finally {
    restore();
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ZipItem = { filename: string; blob: Blob };

export async function exportZip(items: ZipItem[], zipName: string): Promise<void> {
  const zip = new JSZip();
  for (const it of items) zip.file(it.filename, it.blob);
  const out = await zip.generateAsync({ type: "blob", compression: "STORE" });
  downloadBlob(out, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}
