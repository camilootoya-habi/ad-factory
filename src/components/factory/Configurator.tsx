"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field } from "@/components/ui/Field";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Range } from "@/components/ui/Range";
import { Section } from "@/components/ui/Section";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Toggle } from "@/components/ui/Toggle";
import { checkLogoHeight } from "@/lib/brand/logo";
import { unitFor } from "@/lib/creative/scale";
import type {
  Color,
  ColorToken,
  CreativeSpec,
  Fondo,
  FondoAttrs,
  Format,
  LogoFormat,
  LogoSlot,
  LogoTreatment,
  Producto,
  ProtagonistaAttrs,
  UtmSource,
} from "@/lib/creative/types";
import { describeAttrs, slugFromAttrs } from "@/lib/utm";
import { BoxFields } from "./BoxFields";
import { SwatchPicker } from "./Swatch";
import {
  ALIGN_OPTIONS,
  ANCHOR_OPTIONS,
  BLEND_OPTIONS,
  CTA_VARIANT_OPTIONS,
  DEFAULT_OVERLAY,
  DESENFOQUE_OPTIONS,
  EDAD_OPTIONS,
  ENCUADRE_OPTIONS,
  EXPRESION_OPTIONS,
  FONDO_ESTILO_OPTIONS,
  FONDO_TIPO_OPTIONS,
  FORMAT_OPTIONS,
  GENERO_OPTIONS,
  GLYPH_OPTIONS,
  LOGO_FORMAT_OPTIONS,
  LOGO_SLOT_OPTIONS,
  LOGO_TREATMENT_OPTIONS,
  MODEL_OPTIONS,
  PELO_COLOR_OPTIONS,
  PELO_LARGO_OPTIONS,
  PIEL_OPTIONS,
  POSE_OPTIONS,
  PRODUCTO_OPTIONS,
  PROT_TIPO_OPTIONS,
  SIZE_OPTIONS,
  SOURCE_OPTIONS,
  defaultProtagonistaRecipe,
  formatRuns,
  parseRuns,
  recolorRuns,
  runsColor,
} from "./spec";
import type { AssetsState } from "./useAssets";

const pctFmt = (v: number) => `${v}%`;
const cuFmt = (v: number) => `${v} cu`;

export type ConfiguratorProps = {
  spec: CreativeSpec;
  onChange: (next: CreativeSpec) => void;
  source: UtmSource;
  onSourceChange: (s: UtmSource) => void;
  model: "quality" | "fast";
  onModelChange: (m: "quality" | "fast") => void;
  showClearSpace: boolean;
  onShowClearSpace: (v: boolean) => void;
  assets: AssetsState;
};

export function Configurator({
  spec,
  onChange,
  source,
  onSourceChange,
  model,
  onModelChange,
  showClearSpace,
  onShowClearSpace,
  assets,
}: ConfiguratorProps) {
  const patch = (p: Partial<CreativeSpec>) => onChange({ ...spec, ...p });
  const unit = unitFor(spec.format);

  /* --------------------------- protagonista --------------------------- */
  const prot = spec.protagonista;
  const protRecipe = prot?.recipe;
  const protSlot = assets.slots.protagonista;
  const patchProt = (p: Partial<NonNullable<CreativeSpec["protagonista"]>>) => {
    if (!prot) return;
    patch({ protagonista: { ...prot, ...p } });
  };
  const patchRecipe = (p: Partial<ProtagonistaAttrs>) => {
    if (!prot || !protRecipe) return;
    // Cambiar la receta invalida el hash: la capa se vuelve a resolver (y a generar si falta).
    patch({ protagonista: { ...prot, recipe: { ...protRecipe, ...p }, assetHash: undefined } });
  };

  /* ------------------------------- fondo ------------------------------ */
  const fondo = spec.fondo;
  const fondoSlot = assets.slots.fondo;
  const setFondo = (f: Fondo) => patch({ fondo: f });
  const fondoRecipe = fondo.kind === "asset" ? fondo.recipe : undefined;
  const patchFondoRecipe = (p: Partial<FondoAttrs>) => {
    if (fondo.kind !== "asset" || !fondo.recipe) return;
    setFondo({ ...fondo, recipe: { ...fondo.recipe, ...p }, assetHash: undefined });
  };

  /* ------------------------------- logo ------------------------------- */
  const logoCheck = checkLogoHeight(spec.logo.heightCu * unit);

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------------------- PIEZA ---------------------------- */}
      <Section label="01" title="Pieza">
        <div className="flex flex-col gap-4">
          <Field label="Nombre">
            <Input value={spec.name} onChange={(name) => patch({ name })} placeholder="Mujer · Vende tu apto" />
          </Field>
          <Field label="Formato" hint={FORMAT_OPTIONS.find((f) => f.value === spec.format)?.hint}>
            <SegmentedControl
              value={spec.format}
              options={FORMAT_OPTIONS}
              onChange={(format: Format) => patch({ format })}
              ariaLabel="Formato"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Producto">
              <Select value={spec.producto} options={PRODUCTO_OPTIONS} onChange={(v) => v && patch({ producto: v as Producto })} />
            </Field>
            <Field label="País">
              <Select
                value={spec.pais}
                options={[
                  { value: "co", label: "Colombia" },
                  { value: "mx", label: "México (pendiente)", disabled: true },
                ]}
                onChange={() => undefined}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fuente UTM">
              <Select value={source} options={SOURCE_OPTIONS} onChange={(v) => v && onSourceChange(v as UtmSource)} />
            </Field>
            <Field label="Modelo de generación" hint="El hash de la capa incluye el modelo.">
              <Select value={model} options={MODEL_OPTIONS} onChange={(v) => v && onModelChange(v as "quality" | "fast")} />
            </Field>
          </div>
        </div>
      </Section>

      {/* ------------------------ PROTAGONISTA ------------------------ */}
      <Section
        label="02"
        title="Protagonista"
        aside={
          protSlot ? (
            <Chip tone={protSlot.exists ? "ok" : "warn"} title={protSlot.hash}>
              {protSlot.exists ? "en caché" : "falta generar"}
            </Chip>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          <Toggle
            checked={Boolean(prot)}
            label="La pieza tiene protagonista"
            onChange={(on) =>
              patch({
                protagonista: on
                  ? { recipe: defaultProtagonistaRecipe(), anchor: "bottom-right", widthPct: 70, offset: [6, 0] }
                  : undefined,
              })
            }
          />

          {prot && protRecipe && (
            <>
              <Field label="Tipo">
                <Select
                  value={protRecipe.tipo}
                  options={PROT_TIPO_OPTIONS}
                  onChange={(v) => v && patchRecipe({ tipo: v as ProtagonistaAttrs["tipo"] })}
                />
              </Field>

              {protRecipe.tipo === "persona" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Género">
                    <Select value={protRecipe.genero} options={GENERO_OPTIONS} emptyLabel="—" onChange={(genero) => patchRecipe({ genero })} />
                  </Field>
                  <Field label="Edad">
                    <Select value={protRecipe.edad} options={EDAD_OPTIONS} emptyLabel="—" onChange={(edad) => patchRecipe({ edad })} />
                  </Field>
                  <Field label="Piel">
                    <Select value={protRecipe.piel} options={PIEL_OPTIONS} emptyLabel="—" onChange={(piel) => patchRecipe({ piel })} />
                  </Field>
                  <Field label="Expresión">
                    <Select
                      value={protRecipe.expresion}
                      options={EXPRESION_OPTIONS}
                      emptyLabel="—"
                      onChange={(expresion) => patchRecipe({ expresion })}
                    />
                  </Field>
                  <Field label="Pelo · color">
                    <Select
                      value={protRecipe.pelo?.color}
                      options={PELO_COLOR_OPTIONS}
                      emptyLabel="—"
                      onChange={(color) =>
                        patchRecipe({ pelo: color ? { color, largo: protRecipe.pelo?.largo ?? "medio" } : undefined })
                      }
                    />
                  </Field>
                  <Field label="Pelo · largo">
                    <Select
                      value={protRecipe.pelo?.largo}
                      options={PELO_LARGO_OPTIONS}
                      emptyLabel="—"
                      onChange={(largo) =>
                        patchRecipe({ pelo: largo ? { color: protRecipe.pelo?.color ?? "negro", largo } : undefined })
                      }
                    />
                  </Field>
                  <Field label="Pose">
                    <Select value={protRecipe.pose} options={POSE_OPTIONS} emptyLabel="—" onChange={(pose) => patchRecipe({ pose })} />
                  </Field>
                  <Field label="Encuadre">
                    <Select
                      value={protRecipe.encuadre}
                      options={ENCUADRE_OPTIONS}
                      onChange={(v) => v && patchRecipe({ encuadre: v })}
                    />
                  </Field>
                  <Field label="Prenda">
                    <Input
                      value={protRecipe.vestuario?.prenda ?? ""}
                      placeholder="blazer"
                      onChange={(prenda) =>
                        patchRecipe({ vestuario: prenda ? { prenda, color: protRecipe.vestuario?.color ?? "morado" } : undefined })
                      }
                    />
                  </Field>
                  <Field label="Color de la prenda">
                    <Input
                      value={protRecipe.vestuario?.color ?? ""}
                      placeholder="morado"
                      onChange={(color) =>
                        patchRecipe({ vestuario: color ? { prenda: protRecipe.vestuario?.prenda ?? "blazer", color } : undefined })
                      }
                    />
                  </Field>
                </div>
              )}

              {protRecipe.tipo !== "persona" && (
                <Field label="Sujeto" hint="Descripción de lo que hay que generar.">
                  <Textarea
                    value={protRecipe.sujeto ?? ""}
                    rows={4}
                    placeholder="mano sosteniendo un smartphone, visto de frente…"
                    onChange={(sujeto) => patchRecipe({ sujeto })}
                  />
                </Field>
              )}

              {protRecipe.tipo === "arte-tipografico" && (
                <Field label="Copy dentro de la imagen" hint="Cada salto de línea es una línea del arte.">
                  <Textarea value={protRecipe.copy ?? ""} rows={4} onChange={(copy) => patchRecipe({ copy })} />
                </Field>
              )}

              <Field label="Dirección libre" hint="Se envía literal, en español.">
                <Textarea value={protRecipe.libre ?? ""} rows={2} onChange={(libre) => patchRecipe({ libre })} />
              </Field>

              <Field label="Slug de la capa" hint="Es lo que entra en la UTM.">
                <div className="text-[12px] leading-5 break-all" style={{ fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}>
                  {slugFromAttrs("protagonista", protRecipe)}
                </div>
                <p className="mt-1 text-[12px]" style={{ color: "var(--color-content-tertiary)" }}>
                  {describeAttrs("protagonista", protRecipe)}
                </p>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Anclaje">
                  <Select value={prot.anchor} options={ANCHOR_OPTIONS} onChange={(v) => v && patchProt({ anchor: v })} />
                </Field>
                <Field label="Mezcla">
                  <Select value={prot.blend ?? "normal"} options={BLEND_OPTIONS} onChange={(v) => v && patchProt({ blend: v })} />
                </Field>
              </div>
              <Field label="Ancho">
                <Range ariaLabel="Ancho del protagonista" value={prot.widthPct} min={15} max={110} step={1} format={pctFmt} onChange={(widthPct) => patchProt({ widthPct })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desplazamiento X">
                  <Range ariaLabel="Desplazamiento X" value={prot.offset[0]} min={-40} max={40} step={1} format={pctFmt} onChange={(x) => patchProt({ offset: [x, prot.offset[1]] })} />
                </Field>
                <Field label="Desplazamiento Y">
                  <Range ariaLabel="Desplazamiento Y" value={prot.offset[1]} min={-40} max={40} step={1} format={pctFmt} onChange={(y) => patchProt({ offset: [prot.offset[0], y] })} />
                </Field>
              </div>
              <Toggle checked={Boolean(prot.flip)} label="Espejar horizontalmente" onChange={(flip) => patchProt({ flip })} />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  loading={assets.generating}
                  disabled={assets.generating || protSlot?.exists === true}
                  onClick={() => void assets.generateOne("protagonista", { model })}
                >
                  {protSlot?.exists ? "Capa en caché" : "Generar protagonista"}
                </Button>
                <Link href="/biblioteca" className="btn-ghost" style={{ padding: "10px 18px" }}>
                  Elegir de la biblioteca
                </Link>
              </div>
              {assets.progress.protagonista && (
                <p className="text-[12px]" style={{ color: "var(--color-content-secondary)" }}>
                  {assets.progress.protagonista.stage}… {Math.round(assets.progress.protagonista.elapsedMs / 1000)}s
                </p>
              )}
            </>
          )}

          {prot && !protRecipe && (
            <p className="text-[13px]" style={{ color: "var(--color-content-secondary)" }}>
              Capa fija de la biblioteca (<code>{prot.assetHash?.slice(0, 12)}</code>). Cambia la posición abajo o quítala para
              editar atributos.
            </p>
          )}
        </div>
      </Section>

      {/* ------------------------------ FONDO ------------------------------ */}
      <Section
        label="03"
        title="Fondo"
        aside={
          fondoSlot ? (
            <Chip tone={fondoSlot.exists ? "ok" : "warn"} title={fondoSlot.hash}>
              {fondoSlot.exists ? "en caché" : "falta generar"}
            </Chip>
          ) : (
            <Chip>sin costo</Chip>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <SegmentedControl
            value={fondo.kind}
            options={[
              { value: "plano", label: "Plano" },
              { value: "gradiente", label: "Gradiente" },
              { value: "asset", label: "Imagen" },
            ]}
            ariaLabel="Tipo de fondo"
            onChange={(kind) => {
              if (kind === fondo.kind) return;
              if (kind === "plano") setFondo({ kind: "plano", color: "purple-400" });
              else if (kind === "gradiente") setFondo({ kind: "gradiente", from: "purple-600", via: "purple-800", to: "purple-950", angle: 180 });
              else
                setFondo({
                  kind: "asset",
                  recipe: { tipo: "interior", estilo: "luminoso", desenfoque: "fuerte", elementos: [] },
                  blurCu: 3,
                  scale: 1.06,
                });
            }}
          />

          {fondo.kind === "plano" && (
            <Field label="Color">
              <SwatchPicker value={fondo.color} ariaLabel="Color del fondo" onChange={(color) => setFondo({ ...fondo, color })} />
            </Field>
          )}

          {fondo.kind === "gradiente" && (
            <>
              <Field label="Desde">
                <SwatchPicker value={fondo.from} ariaLabel="Color inicial" onChange={(from) => setFondo({ ...fondo, from })} />
              </Field>
              <Field label="Intermedio" hint="Opcional.">
                <SwatchPicker value={fondo.via} ariaLabel="Color intermedio" onChange={(via) => setFondo({ ...fondo, via })} />
              </Field>
              <Field label="Hasta">
                <SwatchPicker value={fondo.to} ariaLabel="Color final" onChange={(to) => setFondo({ ...fondo, to })} />
              </Field>
              <Field label="Ángulo">
                <Range ariaLabel="Ángulo del gradiente" value={fondo.angle} min={0} max={360} step={5} format={(v) => `${v}°`} onChange={(angle) => setFondo({ ...fondo, angle })} />
              </Field>
            </>
          )}

          {fondo.kind === "asset" && fondoRecipe && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo de escena">
                  <Select value={fondoRecipe.tipo} options={FONDO_TIPO_OPTIONS} onChange={(v) => v && patchFondoRecipe({ tipo: v })} />
                </Field>
                <Field label="Estilo">
                  <Select value={fondoRecipe.estilo} options={FONDO_ESTILO_OPTIONS} onChange={(v) => v && patchFondoRecipe({ estilo: v })} />
                </Field>
              </div>
              <Field label="Desenfoque del modelo" hint="Lo pide el prompt; el blur de composición va aparte.">
                <Select value={fondoRecipe.desenfoque} options={DESENFOQUE_OPTIONS} onChange={(v) => v && patchFondoRecipe({ desenfoque: v })} />
              </Field>
              <Field label="Elementos" hint="Separados por coma.">
                <Input
                  value={(fondoRecipe.elementos ?? []).join(", ")}
                  placeholder="sofá claro, ventana grande"
                  onChange={(v) => patchFondoRecipe({ elementos: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
              <Field label="Dirección libre">
                <Textarea value={fondoRecipe.libre ?? ""} rows={2} onChange={(libre) => patchFondoRecipe({ libre })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Blur en composición">
                  <Range ariaLabel="Blur" value={fondo.blurCu ?? 0} min={0} max={20} step={0.5} format={cuFmt} onChange={(blurCu) => setFondo({ ...fondo, blurCu })} />
                </Field>
                <Field label="Zoom" hint="Evita bordes claros al desenfocar.">
                  <Range ariaLabel="Zoom" value={fondo.scale ?? 1} min={1} max={1.3} step={0.01} format={(v) => `${v.toFixed(2)}×`} onChange={(scale) => setFondo({ ...fondo, scale })} />
                </Field>
              </div>
              <Field label="Slug del fondo">
                <div className="text-[12px] leading-5 break-all" style={{ fontFamily: "var(--font-mono)", color: "var(--brand-primary)" }}>
                  {slugFromAttrs("fondo", fondoRecipe)}
                </div>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="brand"
                  loading={assets.generating}
                  disabled={assets.generating || fondoSlot?.exists === true}
                  onClick={() => void assets.generateOne("fondo", { model })}
                >
                  {fondoSlot?.exists ? "Capa en caché" : "Generar fondo"}
                </Button>
                <Link href="/biblioteca" className="btn-ghost" style={{ padding: "10px 18px" }}>
                  Elegir de la biblioteca
                </Link>
              </div>
              {assets.progress.fondo && (
                <p className="text-[12px]" style={{ color: "var(--color-content-secondary)" }}>
                  {assets.progress.fondo.stage}… {Math.round(assets.progress.fondo.elapsedMs / 1000)}s
                </p>
              )}
            </>
          )}

          <hr style={{ borderColor: "var(--color-border-subtle)" }} />
          <Toggle
            checked={Boolean(spec.overlay)}
            label="Overlay morado de marca"
            onChange={(on) => patch({ overlay: on ? { ...DEFAULT_OVERLAY } : undefined })}
          />
          {spec.overlay && (
            <>
              <Field label="Color del overlay">
                <SwatchPicker
                  value={spec.overlay.color}
                  ariaLabel="Color del overlay"
                  onChange={(color) => patch({ overlay: { ...spec.overlay!, color } })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Opacidad inicial">
                  <Range ariaLabel="Opacidad inicial" value={spec.overlay.from} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(from) => patch({ overlay: { ...spec.overlay!, from } })} />
                </Field>
                <Field label="Opacidad final" hint="La regla de marca pide 62–88%.">
                  <Range ariaLabel="Opacidad final" value={spec.overlay.to} min={0} max={1} step={0.01} format={(v) => `${Math.round(v * 100)}%`} onChange={(to) => patch({ overlay: { ...spec.overlay!, to } })} />
                </Field>
              </div>
              <Field label="Ángulo">
                <Range ariaLabel="Ángulo del overlay" value={spec.overlay.angle} min={0} max={360} step={5} format={(v) => `${v}°`} onChange={(angle) => patch({ overlay: { ...spec.overlay!, angle } })} />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* ------------------------------ TÍTULO ------------------------------ */}
      <Section label="04" title="Título">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={Boolean(spec.titulo)}
            label="La pieza tiene título"
            onChange={(on) =>
              patch({
                titulo: on
                  ? { runs: [{ text: "Vende tu apto", weight: 700, color: "white" }], size: "display-lg", align: "left", box: { x: 7, y: 16, w: 70 } }
                  : undefined,
              })
            }
          />
          {spec.titulo && (
            <>
              <Field label="Texto" hint="**doble asterisco** = negrita. Los saltos de línea se respetan.">
                <Textarea
                  value={formatRuns(spec.titulo.runs)}
                  rows={3}
                  onChange={(v) =>
                    patch({ titulo: { ...spec.titulo!, runs: parseRuns(v, { color: runsColor(spec.titulo!.runs, "white") }) } })
                  }
                />
              </Field>
              <Field label="Color">
                <SwatchPicker
                  value={runsColor(spec.titulo.runs, "white")}
                  ariaLabel="Color del título"
                  onChange={(color) => patch({ titulo: { ...spec.titulo!, runs: recolorRuns(spec.titulo!.runs, color), color } })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tamaño">
                  <Select value={spec.titulo.size} options={SIZE_OPTIONS} onChange={(v) => v && patch({ titulo: { ...spec.titulo!, size: v } })} />
                </Field>
                <Field label="Alineación">
                  <Select value={spec.titulo.align} options={ALIGN_OPTIONS} onChange={(v) => v && patch({ titulo: { ...spec.titulo!, align: v } })} />
                </Field>
              </div>
              <Field label="Interlineado">
                <Range ariaLabel="Interlineado" value={spec.titulo.lineHeight ?? 1} min={0.85} max={1.6} step={0.01} format={(v) => v.toFixed(2)} onChange={(lineHeight) => patch({ titulo: { ...spec.titulo!, lineHeight } })} />
              </Field>
              <Field label="Caja">
                <BoxFields box={spec.titulo.box} onChange={(box) => patch({ titulo: { ...spec.titulo!, box } })} />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* ------------------------------- TEXTO ------------------------------ */}
      <Section label="05" title="Texto">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={Boolean(spec.texto)}
            label="La pieza tiene texto de apoyo"
            onChange={(on) =>
              patch({
                texto: on
                  ? { runs: [{ text: "más rápido y sin estrés.", weight: 400, color: "white" }], size: "body-lg", align: "left", box: { x: 7, y: 42, w: 60 } }
                  : undefined,
              })
            }
          />
          {spec.texto && (
            <>
              {spec.texto.callouts?.length ? (
                <p className="text-[12px] rounded-[var(--radius-sm)] p-3" style={{ background: "var(--color-surface-accent)", color: "var(--color-content-secondary)" }}>
                  Esta pieza usa <strong>callouts</strong> (puntos con línea al protagonista). Se conservan del preset; en v1 no
                  se editan desde la UI.
                </p>
              ) : null}
              <Field label="Texto" hint="**negrita**; una línea por bullet si activas bullets.">
                <Textarea
                  value={formatRuns(spec.texto.runs)}
                  rows={3}
                  onChange={(v) => patch({ texto: { ...spec.texto!, runs: parseRuns(v, { color: runsColor(spec.texto!.runs, "white") }) } })}
                />
              </Field>
              <Field label="Bullets" hint="Una línea por viñeta. Vacío = sin bullets.">
                <Textarea
                  value={(spec.texto.bullets ?? []).map((b) => formatRuns(b)).join("\n")}
                  rows={3}
                  onChange={(v) => {
                    const lines = v.split("\n").filter((l) => l.trim());
                    const color = runsColor(spec.texto!.runs, "white");
                    patch({ texto: { ...spec.texto!, bullets: lines.length ? lines.map((l) => parseRuns(l, { color })) : undefined } });
                  }}
                />
              </Field>
              <Field label="Color">
                <SwatchPicker
                  value={runsColor(spec.texto.runs, "white")}
                  ariaLabel="Color del texto"
                  onChange={(color) =>
                    patch({
                      texto: {
                        ...spec.texto!,
                        color,
                        runs: spec.texto!.runs ? recolorRuns(spec.texto!.runs, color) : undefined,
                        bullets: spec.texto!.bullets?.map((b) => recolorRuns(b, color)),
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tamaño">
                  <Select value={spec.texto.size} options={SIZE_OPTIONS} onChange={(v) => v && patch({ texto: { ...spec.texto!, size: v } })} />
                </Field>
                <Field label="Alineación">
                  <Select value={spec.texto.align} options={ALIGN_OPTIONS} onChange={(v) => v && patch({ texto: { ...spec.texto!, align: v } })} />
                </Field>
              </div>
              <Field label="Caja">
                <BoxFields box={spec.texto.box} onChange={(box) => patch({ texto: { ...spec.texto!, box } })} />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* -------------------------------- CTA ------------------------------- */}
      <Section label="06" title="CTA">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={Boolean(spec.cta)}
            label="La pieza tiene CTA"
            onChange={(on) =>
              patch({
                cta: on
                  ? {
                      label: parseRuns("Recibe una **oferta gratis**", { color: "white" }),
                      variant: "pastilla-oscura-sobre-lila",
                      glyph: "play",
                      box: { x: 7, y: 77, w: 86, h: 16 },
                      containerColor: "purple-400",
                      pillColor: "purple-900",
                    }
                  : undefined,
              })
            }
          />
          {spec.cta && (
            <>
              <Field label="Texto" hint="**negrita** para la parte fuerte.">
                <Input
                  value={formatRuns(spec.cta.label)}
                  onChange={(v) => patch({ cta: { ...spec.cta!, label: parseRuns(v, { color: runsColor(spec.cta!.label, "white") }) } })}
                />
              </Field>
              <Field label="Variante">
                <Select value={spec.cta.variant} options={CTA_VARIANT_OPTIONS} onChange={(v) => v && patch({ cta: { ...spec.cta!, variant: v } })} />
              </Field>
              <Field label="Glifo">
                <Select value={spec.cta.glyph ?? "play"} options={GLYPH_OPTIONS} onChange={(v) => v && patch({ cta: { ...spec.cta!, glyph: v } })} />
              </Field>
              <Field label="Color del contenedor">
                <SwatchPicker value={spec.cta.containerColor} ariaLabel="Color del contenedor" onChange={(containerColor) => patch({ cta: { ...spec.cta!, containerColor } })} />
              </Field>
              <Field label="Color de la pastilla">
                <SwatchPicker value={spec.cta.pillColor} ariaLabel="Color de la pastilla" onChange={(pillColor) => patch({ cta: { ...spec.cta!, pillColor } })} />
              </Field>
              <Field label="Color del texto" hint="Sólo en pastilla blanca.">
                <SwatchPicker value={spec.cta.textColor} ariaLabel="Color del texto del CTA" onChange={(textColor) => patch({ cta: { ...spec.cta!, textColor } })} />
              </Field>
              <Field label="Tamaño del texto">
                <Select value={spec.cta.size} options={SIZE_OPTIONS} emptyLabel="Automático" onChange={(size) => patch({ cta: { ...spec.cta!, size } })} />
              </Field>
              <Field label="Caja">
                <BoxFields box={spec.cta.box} withHeight onChange={(box) => patch({ cta: { ...spec.cta!, box } })} />
              </Field>
            </>
          )}
        </div>
      </Section>

      {/* -------------------------------- LOGO ------------------------------- */}
      <Section
        label="07"
        title="Logo"
        aside={<Chip tone={logoCheck.level === "ok" ? "ok" : logoCheck.level === "warn" ? "warn" : "error"}>{logoCheck.level}</Chip>}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posición">
              <Select value={spec.logo.slot} options={LOGO_SLOT_OPTIONS} onChange={(v) => v && patch({ logo: { ...spec.logo, slot: v as LogoSlot } })} />
            </Field>
            <Field label="Formato">
              <Select value={spec.logo.format ?? "completo"} options={LOGO_FORMAT_OPTIONS} onChange={(v) => v && patch({ logo: { ...spec.logo, format: v as LogoFormat } })} />
            </Field>
          </div>
          <Field label="Tratamiento" hint="Automático elige según lo que hay debajo.">
            <Select
              value={spec.logo.treatment ?? "auto"}
              options={LOGO_TREATMENT_OPTIONS}
              onChange={(v) => v && patch({ logo: { ...spec.logo, treatment: v as LogoTreatment | "auto" } })}
            />
          </Field>
          <Field label="Altura" hint={`${Math.round(spec.logo.heightCu * unit)} px reales · mínimo 24 px`}>
            <Range ariaLabel="Altura del logo" value={spec.logo.heightCu} min={24} max={200} step={2} marks={[80]} format={cuFmt} onChange={(heightCu) => patch({ logo: { ...spec.logo, heightCu } })} />
          </Field>
          {spec.logo.slot !== "in-cta" && (
            <Field label="Margen desde el borde">
              <Range ariaLabel="Margen del logo" value={spec.logo.marginCu ?? 48} min={0} max={200} step={4} format={cuFmt} onChange={(marginCu) => patch({ logo: { ...spec.logo, marginCu } })} />
            </Field>
          )}
          <p
            className="text-[12px] leading-5 rounded-[var(--radius-sm)] p-3"
            style={{
              background: logoCheck.level === "ok" ? "var(--color-surface-secondary)" : "var(--color-surface-accent)",
              color: logoCheck.level === "error" ? "var(--color-content-error)" : "var(--color-content-secondary)",
            }}
          >
            {logoCheck.message}
          </p>
          <Toggle checked={showClearSpace} label="Ver el clear space" onChange={onShowClearSpace} />
        </div>
      </Section>

      {/* -------------------------------- LEGAL ------------------------------ */}
      <Section label="08" title="Legal">
        <Field label="Texto legal" hint="Abajo a la derecha, en pequeño.">
          <Input value={spec.legal ?? ""} placeholder="*AplicanTyC" onChange={(v) => patch({ legal: v || undefined })} />
        </Field>
      </Section>
    </div>
  );
}

/** Re-exports para que la página no importe de dos sitios. */
export type { Color, ColorToken };
