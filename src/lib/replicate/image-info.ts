/**
 * Lector mínimo de cabeceras de imagen (PNG, JPEG, WebP) sin dependencias. Devuelve
 * MIME real, dimensiones y si el archivo trae canal alfa. Suficiente para la LayerMeta;
 * no decodifica píxeles.
 */

export type SniffedMime = "image/png" | "image/jpeg" | "image/webp";

export type ImageInfo = {
  mime: SniffedMime;
  width: number;
  height: number;
  hasAlpha: boolean;
};

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  return readPng(bytes) ?? readJpeg(bytes) ?? readWebp(bytes);
}

/** Convierte un Content-Type en MIME soportado, o null. Fallback si la cabecera no se pudo leer. */
export function mimeFromContentType(contentType: string | null | undefined): SniffedMime | null {
  const ct = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (ct === "image/png") return "image/png";
  if (ct === "image/jpeg" || ct === "image/jpg") return "image/jpeg";
  if (ct === "image/webp") return "image/webp";
  return null;
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function readPng(b: Uint8Array): ImageInfo | null {
  if (b.length < 33 || !PNG_SIG.every((v, i) => b[i] === v)) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  const colorType = b[25];
  // 4 = gris+alfa, 6 = RGBA. Para 0/2/3 el alfa puede venir en un chunk tRNS antes de IDAT.
  let hasAlpha = colorType === 4 || colorType === 6;
  if (!hasAlpha) {
    let off = 8;
    while (off + 8 <= b.length) {
      const len = u32be(b, off);
      const type = ascii(b, off + 4, 4);
      if (type === "tRNS") {
        hasAlpha = true;
        break;
      }
      if (type === "IDAT" || type === "IEND") break;
      off += 12 + len;
    }
  }
  return { mime: "image/png", width, height, hasAlpha };
}

function readJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < b.length) {
    if (b[off] !== 0xff) {
      off++;
      continue;
    }
    const marker = b[off + 1];
    if (marker === 0xff) {
      off++;
      continue;
    }
    // Marcadores sin payload: SOI, RSTn, TEM.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    // EOI o SOS: ya no habrá SOF.
    if (marker === 0xd9 || marker === 0xda) break;
    const len = u16be(b, off + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      return { mime: "image/jpeg", width: u16be(b, off + 7), height: u16be(b, off + 5), hasAlpha: false };
    }
    off += 2 + len;
  }
  return null;
}

function readWebp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30 || ascii(b, 0, 4) !== "RIFF" || ascii(b, 8, 4) !== "WEBP") return null;
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8 ") {
    // Lossy: tras el frame tag (3) y el start code 9d 01 2a (3) vienen ancho y alto en 14 bits.
    return { mime: "image/webp", width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff, hasAlpha: false };
  }
  if (chunk === "VP8L") {
    const b0 = b[21], b1 = b[22], b2 = b[23], b3 = b[24];
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    return { mime: "image/webp", width, height, hasAlpha: ((b3 >> 4) & 1) === 1 };
  }
  if (chunk === "VP8X") {
    const flags = b[20];
    return { mime: "image/webp", width: 1 + u24le(b, 24), height: 1 + u24le(b, 27), hasAlpha: (flags & 0x10) !== 0 };
  }
  return null;
}
