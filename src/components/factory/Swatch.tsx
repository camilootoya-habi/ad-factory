"use client";

import type { Color, ColorToken } from "@/lib/creative/types";
import { SWATCHES, swatchHex } from "./spec";

/** Selector de color restringido a los tokens de marca: no hay hex sueltos en la UI. */
export function SwatchPicker({
  value,
  onChange,
  ariaLabel,
  tokens = SWATCHES,
}: {
  value: Color | undefined;
  onChange: (token: ColorToken) => void;
  ariaLabel: string;
  tokens?: ColorToken[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={ariaLabel}>
      {tokens.map((token) => {
        const active = value === token;
        return (
          <button
            key={token}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={token}
            title={`${token} · ${swatchHex(token)}`}
            onClick={() => onChange(token)}
            className="w-7 h-7 rounded-[var(--radius-sm)] transition-transform"
            style={{
              background: swatchHex(token),
              border: `1px solid ${active ? "var(--brand-primary)" : "var(--color-border-default)"}`,
              boxShadow: active ? "0 0 0 2px var(--color-surface-accent)" : undefined,
              transform: active ? "scale(1.08)" : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
