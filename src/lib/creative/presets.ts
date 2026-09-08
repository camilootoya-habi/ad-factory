import type { CreativeSpec, Overlay } from "./types";

/**
 * Los 6 estáticos de referencia, transcritos a CreativeSpec. Son las semillas que prueban
 * que el motor reproduce lo que hoy se hace a mano. Las capas de imagen van como `recipe`
 * (se generan la primera vez y se cachean por hash).
 *
 * Posiciones en % del canvas 1:1; los `layouts` ajustan lo que cambia en otros formatos.
 */

/** Overlay de marca (brand center, cap. 08): primario al 62–88%, más denso abajo-derecha. */
export const BRAND_OVERLAY: Overlay = { color: "purple-700", from: 0.62, to: 0.88, angle: 135 };

const BASE = { pais: "co", origin: "preset", createdAt: "2026-09-07T00:00:00.000Z" } as const;

export const PRESETS: Record<string, CreativeSpec> = {
  /* ---------------------------------------------------------------- */
  /* 1 · Grafiti — MM Sellers                                          */
  /* ---------------------------------------------------------------- */
  "01-grafiti-muro": {
    ...BASE,
    id: "preset-01-grafiti-muro",
    shortId: "ref001",
    presetKey: "01-grafiti-muro",
    name: "Grafiti · Vender más rápido y 100% seguro",
    format: "1x1",
    producto: "mm-sellers",
    fondo: {
      kind: "asset",
      recipe: {
        tipo: "muro",
        estilo: "luminoso",
        desenfoque: "nitido",
        elementos: ["ladrillo-blanco", "cielo-azul-con-nubes", "jardin-con-flores", "adoquines"],
        libre:
          "pared exterior de ladrillo pintado de blanco vista de frente, ocupa el 70% central del encuadre; franja de cielo azul con nubes arriba; jardinera con plantas y flores y piso de adoquines abajo; luz de día suave; la pared está completamente vacía y lisa, sin texto ni dibujos",
      },
    },
    protagonista: {
      recipe: {
        tipo: "arte-tipografico",
        encuadre: "detalle",
        copy: "Con Habi puedes vender una\npropiedad MÁS RÁPIDO\ny 100% SEGURO\nen 1 sola visita.\nTRAMITE GARANTIZADO.",
        sujeto:
          "letras de grafiti estilo aerosol, tipografía bubble redondeada con volumen, relleno degradado de violeta a lila con brillos blancos, contorno morado oscuro, halos suaves de aerosol alrededor; las tres primeras líneas grandes y ligeramente arqueadas, la cuarta en cursiva caligráfica más pequeña, la quinta en mayúsculas condensadas con un subrayado a mano; composición centrada",
        libre: "sobre fondo blanco puro y liso, sin pared, sin sombras proyectadas",
      },
      anchor: "center",
      widthPct: 84,
      offset: [0, 4],
      blend: "multiply",
    },
    logo: { slot: "top-center", heightCu: 104, format: "completo", treatment: "color", marginCu: 150 },
    layouts: {
      "9x16": { protagonista: { anchor: "center", widthPct: 92, offset: [0, 0], blend: "multiply" } },
      "16x9": { protagonista: { anchor: "center", widthPct: 62, offset: [0, 4], blend: "multiply" } },
    },
  },

  /* ---------------------------------------------------------------- */
  /* 2 · Mujer blusa vinotinto — Inmo Sellers                          */
  /* ---------------------------------------------------------------- */
  "02-mujer-encontro-comprador": {
    ...BASE,
    id: "preset-02-mujer-encontro-comprador",
    shortId: "ref002",
    presetKey: "02-mujer-encontro-comprador",
    name: "Mujer · ¡Tu apto encontró comprador!",
    format: "1x1",
    producto: "inmo-sellers",
    fondo: {
      kind: "asset",
      recipe: {
        tipo: "sala",
        estilo: "luminoso",
        desenfoque: "fuerte",
        elementos: ["sofa-claro", "lampara-de-pie", "ventana-grande"],
        libre: "sala de casa moderna muy desenfocada, bokeh amplio, tonos neutros claros",
      },
      blurCu: 2,
      scale: 1.06,
    },
    overlay: { color: "purple-500", from: 0.45, to: 0.72, angle: 135 },
    protagonista: {
      recipe: {
        tipo: "persona",
        genero: "mujer",
        edad: "joven",
        piel: "trigueña",
        pelo: { color: "negro", largo: "largo" },
        expresion: "sonriendo",
        vestuario: { prenda: "blusa asimétrica de un hombro", color: "vinotinto" },
        pose: "manos-en-bolsillos",
        encuadre: "medio-cuerpo",
        libre: "pantalón negro de vestir, aretes dorados pequeños, pelo liso suelto, mira a cámara, cuerpo ligeramente girado hacia la izquierda",
      },
      anchor: "bottom-right",
      widthPct: 82,
      offset: [8, 9],
    },
    titulo: {
      runs: [
        { text: "¡Tu apto.", weight: 700, color: "purple-900" },
        { text: "\nencontró\ncomprador!", weight: 400, color: "purple-700" },
      ],
      size: "display-lg",
      align: "left",
      box: { x: 5.5, y: 16, w: 58 },
      lineHeight: 1.0,
    },
    cta: {
      label: [{ text: "Habi", weight: 700, color: "white" }],
      variant: "badge-gradiente",
      glyph: "none",
      box: { x: -1, y: 57, w: 42, h: 14 },
      size: "display-lg",
    },
    logo: { slot: "bottom-left", heightCu: 108, format: "completo", treatment: "blanco", marginCu: 56 },
    layouts: {
      "9x16": {
        titulo: {
          runs: [
            { text: "¡Tu apto.", weight: 700, color: "purple-900" },
            { text: "\nencontró\ncomprador!", weight: 400, color: "purple-800" },
          ],
          size: "display-xl",
          align: "left",
          box: { x: 6, y: 14, w: 88 },
          lineHeight: 1.0,
        },
        protagonista: {
          recipe: undefined,
          anchor: "bottom-center",
          widthPct: 78,
          offset: [8, 0],
        },
        cta: {
          label: [{ text: "Habi", weight: 700, color: "white" }],
          variant: "badge-gradiente",
          glyph: "none",
          box: { x: -1, y: 44, w: 44, h: 9 },
          size: "display-lg",
        },
      },
      "16x9": {
        titulo: {
          runs: [
            { text: "¡Tu apto.", weight: 700, color: "purple-900" },
            { text: "\nencontró\ncomprador!", weight: 400, color: "purple-800" },
          ],
          size: "display-lg",
          align: "left",
          box: { x: 5, y: 16, w: 40 },
          lineHeight: 1.0,
        },
        protagonista: { recipe: undefined, anchor: "bottom-right", widthPct: 34, offset: [2, 0] },
        cta: {
          label: [{ text: "Habi", weight: 700, color: "white" }],
          variant: "badge-gradiente",
          glyph: "none",
          box: { x: -1, y: 62, w: 26, h: 20 },
          size: "display-lg",
        },
      },
    },
  },

  /* ---------------------------------------------------------------- */
  /* 3 · Casa infografía — Sellers                                     */
  /* ---------------------------------------------------------------- */
  "03-casa-infografia": {
    ...BASE,
    id: "preset-03-casa-infografia",
    shortId: "ref003",
    presetKey: "03-casa-infografia",
    name: "Casa 3D · Si tu casa tiene",
    format: "1x1",
    producto: "sellers",
    fondo: { kind: "gradiente", from: "purple-600", via: "purple-800", to: "purple-950", angle: 225 },
    protagonista: {
      recipe: {
        tipo: "inmueble-3d",
        encuadre: "cuerpo-completo",
        sujeto:
          "casa pequeña de un piso en render 3D, vista de FRENTE a nivel de ojo con un ligero giro de tres cuartos hacia la derecha (no isométrica, no vista desde arriba, el techo apenas se ve), hastial a dos aguas mirando a cámara, techo de láminas metálicas en morado saturado con el alero iluminado por un borde de luz cálida, una ventana corredera grande con marco negro a la izquierda, puerta principal de madera con manija negra a la derecha, paredes de concreto claro con textura sutil, chimenea morada detrás, un par de paneles solares apenas visibles en la vertiente trasera",
        libre: "sobre fondo plano neutro para recorte, sin losa ni suelo visible, sin sombra proyectada, estilo render limpio tipo producto",
      },
      anchor: "bottom-center",
      widthPct: 56,
      offset: [0, -13],
    },
    titulo: {
      runs: [{ text: "Si tu casa tiene:", weight: 700, color: "white" }],
      size: "display-lg",
      align: "center",
      box: { x: 10, y: 21, w: 80 },
    },
    texto: {
      size: "body-sm",
      align: "center",
      box: { x: 0, y: 0, w: 0 },
      color: "white",
      callouts: [
        {
          runs: [
            { text: "Menos de ", weight: 400 },
            { text: "39 años de construido.", weight: 700 },
          ],
          dot: [50.5, 42.5],
          box: { x: 15, y: 33.5, w: 70 },
          align: "center",
        },
        {
          runs: [
            { text: "Un valor comercial", weight: 700 },
            { text: "\nde hasta\n600 millones\nde pesos", weight: 400 },
          ],
          dot: [28.5, 65.5],
          box: { x: 3, y: 55.5, w: 20 },
          align: "right",
        },
        {
          runs: [
            { text: "Ubicada\nen nuestra\n", weight: 400 },
            { text: "zona de\ncobertura.", weight: 700 },
          ],
          dot: [73, 65.5],
          box: { x: 78.5, y: 56, w: 20 },
          align: "left",
        },
      ],
    },
    cta: {
      label: [{ text: "Completa el formulario", weight: 700, color: "purple-800" }],
      variant: "pastilla-blanca",
      glyph: "caret-down",
      box: { x: 17, y: 86.3, w: 66, h: 9 },
      pillColor: "white",
      textColor: "purple-900",
    },
    logo: { slot: "top-center", heightCu: 114, format: "completo", treatment: "colorSobreBlanco", marginCu: 44 },
    legal: "*AplicanTyC",
  },

  /* ---------------------------------------------------------------- */
  /* 4 · Mujer abrigo morado — Sellers                                 */
  /* ---------------------------------------------------------------- */
  "04-mujer-vende-tu-apto": {
    ...BASE,
    id: "preset-04-mujer-vende-tu-apto",
    shortId: "ref004",
    presetKey: "04-mujer-vende-tu-apto",
    name: "Mujer · Vende tu apto",
    format: "1x1",
    producto: "sellers",
    fondo: {
      kind: "asset",
      recipe: {
        tipo: "interior",
        estilo: "luminoso",
        desenfoque: "fuerte",
        elementos: ["ventanas-grandes", "paredes-blancas", "luz-natural"],
        libre: "interior de apartamento moderno muy desenfocado, casi abstracto, blancos y grises cálidos, luz natural entrando por la ventana",
      },
      blurCu: 4,
      scale: 1.06,
    },
    protagonista: {
      recipe: {
        tipo: "persona",
        genero: "mujer",
        edad: "joven",
        piel: "blanca",
        pelo: { color: "castano", largo: "largo" },
        expresion: "mirando-celular",
        vestuario: { prenda: "blazer", color: "morado" },
        pose: "con-celular",
        encuadre: "medio-cuerpo",
        libre: "camiseta lila debajo del blazer, collar fino dorado, aretes de aro, sonríe mirando la pantalla del celular que sostiene con ambas manos a la altura del pecho, pelo ondulado suelto",
      },
      anchor: "bottom-right",
      widthPct: 84,
      offset: [10, 12],
    },
    titulo: {
      runs: [{ text: "Vende\ntu apto", weight: 700, color: "purple-600" }],
      size: "display-xl",
      align: "left",
      box: { x: 7, y: 15, w: 56 },
      lineHeight: 0.98,
    },
    texto: {
      runs: [
        { text: "más rápido", weight: 700, color: "purple-900" },
        { text: " y\nsin estrés junto\ncon expertos.", weight: 400, color: "purple-900" },
      ],
      size: "body-lg",
      align: "left",
      box: { x: 7, y: 44, w: 44 },
      lineHeight: 1.22,
    },
    cta: {
      label: [
        { text: "Recibe una ", weight: 400, color: "white" },
        { text: "oferta gratis", weight: 700, color: "white" },
      ],
      variant: "pastilla-oscura-sobre-lila",
      glyph: "play",
      box: { x: 7, y: 77, w: 86, h: 16 },
      containerColor: "purple-400",
      pillColor: "purple-900",
    },
    logo: { slot: "in-cta", heightCu: 92, format: "completo", treatment: "colorSobreBlanco" },
  },

  /* ---------------------------------------------------------------- */
  /* 5 · Celular en mano — Multiproducto                               */
  /* ---------------------------------------------------------------- */
  "05-celular-compra-o-vende": {
    ...BASE,
    id: "preset-05-celular-compra-o-vende",
    shortId: "ref005",
    presetKey: "05-celular-compra-o-vende",
    name: "Celular · Compra o vende tu apto",
    format: "1x1",
    producto: "multiproducto",
    fondo: { kind: "plano", color: "purple-400" },
    protagonista: {
      recipe: {
        tipo: "objeto",
        encuadre: "mano",
        pose: "con-celular",
        sujeto:
          "mano derecha de una persona joven sosteniendo un smartphone moderno de bordes redondeados, visto de frente, ligeramente inclinado; la pantalla muestra una página web inmobiliaria con una foto de una pareja sonriendo en un sofá arriba, un titular morado 'Compramos tu vivienda en 10 días' y un botón morado; el brazo entra por la esquina inferior derecha",
        libre: "fotografía de producto realista, iluminación suave, sobre fondo plano neutro para recorte",
      },
      anchor: "bottom-right",
      widthPct: 92,
      offset: [34, -3],
    },
    titulo: {
      runs: [{ text: "Compra\no vende\ntu apto", weight: 700, color: "white" }],
      size: "display-xl",
      align: "left",
      box: { x: 6, y: 15, w: 52 },
      lineHeight: 0.98,
    },
    texto: {
      runs: [
        { text: "con confianza", weight: 700, color: "purple-900" },
        { text: "\nen un solo lugar.", weight: 400, color: "purple-900" },
      ],
      size: "body-lg",
      align: "left",
      box: { x: 6, y: 50, w: 46 },
      lineHeight: 1.22,
    },
    cta: {
      label: [
        { text: "Recibe una ", weight: 400, color: "white" },
        { text: "oferta gratis", weight: 700, color: "white" },
      ],
      variant: "pastilla-morada-sobre-blanco",
      glyph: "play",
      box: { x: 6, y: 77, w: 88, h: 16 },
      containerColor: "white",
      pillColor: "purple-700",
    },
    logo: { slot: "in-cta", heightCu: 92, format: "completo", treatment: "color" },
  },

  /* ---------------------------------------------------------------- */
  /* 6 · Interior — Sellers                                            */
  /* ---------------------------------------------------------------- */
  "06-interior-listo-para-vender": {
    ...BASE,
    id: "preset-06-interior-listo-para-vender",
    shortId: "ref006",
    presetKey: "06-interior-listo-para-vender",
    name: "Interior · ¿Listo para vender tu apto?",
    format: "1x1",
    producto: "sellers",
    fondo: {
      kind: "asset",
      recipe: {
        tipo: "interior",
        estilo: "minimal",
        desenfoque: "nitido",
        elementos: ["banco-de-madera-clara", "silla-lila", "jarron-con-ramas-secas", "pared-blanca", "piso-madera-clara"],
        libre:
          "sala minimalista muy luminosa con pared blanca lisa que ocupa la mitad superior del encuadre completamente vacía; abajo un banco bajo de madera clara con un jarrón blanco con ramas secas encima a la izquierda, y una silla de madera clara con cojín lila a la derecha; piso de madera clara; luz natural suave desde la izquierda con sombras tenues de hojas en la pared",
      },
      focal: [50, 60],
    },
    titulo: {
      runs: [{ text: "¿Listo para\nvender tu apto?", weight: 700, color: "purple-500" }],
      size: "display-lg",
      align: "left",
      box: { x: 7, y: 13, w: 88 },
      lineHeight: 1.0,
    },
    texto: {
      runs: [
        { text: "Comprar o vender nunca fue ", weight: 400, color: "purple-900" },
        { text: "tan fácil.", weight: 700, color: "purple-900" },
      ],
      size: "body-lg",
      align: "left",
      box: { x: 7, y: 36, w: 88 },
    },
    cta: {
      label: [
        { text: "Recibe una ", weight: 400, color: "white" },
        { text: "oferta gratis", weight: 700, color: "white" },
      ],
      variant: "pastilla-oscura-sobre-lila",
      glyph: "play",
      box: { x: 7, y: 77, w: 86, h: 16 },
      containerColor: "purple-500",
      pillColor: "purple-900",
    },
    logo: { slot: "in-cta", heightCu: 92, format: "completo", treatment: "colorSobreBlanco" },
  },
};

export const PRESET_KEYS = Object.keys(PRESETS);

export function getPreset(key: string): CreativeSpec | undefined {
  return PRESETS[key];
}
