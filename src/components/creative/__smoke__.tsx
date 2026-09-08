/**
 * Humo de tipos: monta los 6 presets en los 4 formatos sin assets (placeholders) y con
 * assets de prueba. No lo exporta el barrel; existe para que `tsc` valide el uso real.
 */
import { PRESETS } from "@/lib/creative/presets";
import { assetHashesOf, resolveSpec } from "@/lib/creative/resolve";
import { FORMAT_KEYS } from "@/lib/creative/scale";
import { CanvasFit } from "./CanvasFit";
import { Creative } from "./Creative";

const TRANSPARENT_PX = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function SmokeGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 16 }}>
      {Object.values(PRESETS).flatMap((spec) =>
        FORMAT_KEYS.map((format) => {
          const resolved = resolveSpec(spec, format);
          const needs = assetHashesOf(resolved);
          return (
            <CanvasFit key={`${spec.id}-${format}`} format={format} maxWidth={320}>
              <Creative
                spec={spec}
                format={format}
                assets={{ fondo: needs.fondo ? TRANSPARENT_PX : undefined }}
                debug={{ clearSpace: true, boxes: true }}
                onReady={() => undefined}
              />
            </CanvasFit>
          );
        }),
      )}
    </div>
  );
}

/** Sin format explícito y sin assets: el caso del configurador recién abierto. */
export function SmokeBare() {
  return Object.values(PRESETS).map((spec) => <Creative key={spec.id} spec={spec} />);
}
