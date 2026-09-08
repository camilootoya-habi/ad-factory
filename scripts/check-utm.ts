/**
 * Verificación del módulo UTM sobre los 6 presets semilla.
 * Correr: cd ad-factory && node scripts/check-utm.ts   (Node ≥ 23 hace type-stripping nativo)
 */
// Node ESM exige la extensión .ts; tsconfig no tiene allowImportingTsExtensions (TS5097).
// @ts-expect-error extensión .ts requerida en runtime
import { buildUtm, describeAttrs, parseUtmContent, slugFromAttrs, slugify } from "../src/lib/utm.ts";
// @ts-expect-error extensión .ts requerida en runtime
import { PRESETS } from "../src/lib/creative/presets.ts";

const DATE = new Date("2026-09-07T12:00:00Z");
let failures = 0;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.error(`  FAIL: ${msg}`);
  }
}

assert(slugify("¿Listo para vender tu apto?") === "listo-para-vender-tu-apto", "slugify básico");
assert(slugify("Piel trigueña, ñandú ü") === "piel-triguena-nandu-u", "slugify ñ y diéresis");

for (const [key, spec] of Object.entries(PRESETS)) {
  const utm = buildUtm(spec, { date: DATE });
  console.log(`\n${key}`);
  console.log(`  campaign: ${utm.campaign}`);
  console.log(`  content (${utm.content.length}): ${utm.content}`);
  console.log(`  url: ${utm.url}`);
  if (spec.protagonista?.recipe) console.log(`  prot: ${describeAttrs("protagonista", spec.protagonista.recipe)}`);
  if (spec.fondo.kind === "asset" && spec.fondo.recipe) console.log(`  fondo: ${describeAttrs("fondo", spec.fondo.recipe)}`);

  assert(/^[a-z0-9_-]+$/.test(utm.content), `${key}: content sólo [a-z0-9_-] (sin tildes ni mayúsculas)`);
  assert(!utm.content.includes("--"), `${key}: content sin '--'`);
  assert(utm.content.length <= 200, `${key}: content ≤ 200 (${utm.content.length})`);
  assert(utm.campaign === `${spec.producto}-co-2609`, `${key}: campaign = ${utm.campaign}`);
  assert(utm.term === spec.shortId && utm.url.includes(`utm_term=${spec.shortId}`), `${key}: term en la URL`);
  assert(utm.filename === `${utm.content}.png`, `${key}: filename = content.png`);
  assert(utm.url.startsWith("https://www.habi.co/"), `${key}: url sobre habi.co`);
  const parsed = parseUtmContent(utm.content);
  assert(parsed.format === spec.format && parsed.fondo !== undefined && parsed.cta !== undefined, `${key}: parseUtmContent`);
  const layerSlugs = [parsed.prot, parsed.fondo].filter((s): s is string => typeof s === "string");
  for (const s of layerSlugs) assert(s.length <= 90, `${key}: slug de capa ≤ 90 (${s.length})`);
}

// Slug de la persona del preset 04 (mujer abrigo morado con celular).
const p4 = PRESETS["04-mujer-vende-tu-apto"].protagonista?.recipe;
assert(p4 !== undefined, "preset 04 tiene receta de protagonista");
if (p4) {
  const slug = slugFromAttrs("protagonista", p4);
  console.log(`\nslug persona 04 (${slug.length}): ${slug}`);
  for (const t of ["mujer", "joven", "pielblanca", "pelocastano", "blazermorado"]) {
    assert(slug.includes(t), `slug 04 contiene '${t}'`);
  }
}

// Determinismo: dos llamadas iguales producen la misma UTM.
const a = buildUtm(PRESETS["02-mujer-encontro-comprador"], { date: DATE });
const b = buildUtm(PRESETS["02-mujer-encontro-comprador"], { date: DATE });
assert(JSON.stringify(a) === JSON.stringify(b), "buildUtm determinístico");

console.log(failures ? `\n${failures} fallo(s)` : "\nOK: todas las verificaciones pasaron");
process.exit(failures ? 1 : 0);
