"use client";

import { Range } from "@/components/ui/Range";
import type { Box } from "@/lib/creative/types";

const pct = (v: number) => `${v}%`;

/** Editor de una caja en porcentaje del canvas. `withHeight` para el CTA. */
export function BoxFields({
  box,
  onChange,
  withHeight = false,
}: {
  box: Box;
  onChange: (box: Box) => void;
  withHeight?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Range ariaLabel="Posición X" value={box.x} min={-20} max={100} step={0.5} format={pct} onChange={(x) => onChange({ ...box, x })} />
      <Range ariaLabel="Posición Y" value={box.y} min={-10} max={100} step={0.5} format={pct} onChange={(y) => onChange({ ...box, y })} />
      <Range ariaLabel="Ancho" value={box.w} min={10} max={100} step={0.5} format={pct} onChange={(w) => onChange({ ...box, w })} />
      {withHeight && (
        <Range
          ariaLabel="Alto"
          value={box.h ?? 16}
          min={4}
          max={40}
          step={0.5}
          format={pct}
          onChange={(h) => onChange({ ...box, h })}
        />
      )}
    </div>
  );
}
