"use client";

import { useId } from "react";
import { cx } from "./cx";

export type RangeProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  /** Cómo mostrar el valor (por defecto el número tal cual). */
  format?: (value: number) => string;
  /** Marcas visibles en la pista (p. ej. el 80 recomendado del logo). */
  marks?: number[];
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

/** Range nativo con el valor en mono a la derecha; accent en morado de marca. */
export function Range({ value, min, max, step = 1, onChange, format, marks, ariaLabel, disabled, className }: RangeProps) {
  const listId = useId();
  return (
    <div className={cx("flex items-center gap-3", className)}>
      <input
        type="range"
        aria-label={ariaLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        list={marks?.length ? listId : undefined}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        style={{ accentColor: "var(--brand-primary)" }}
      />
      {marks?.length ? (
        <datalist id={listId}>
          {marks.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      ) : null}
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-content-secondary">{format ? format(value) : value}</span>
    </div>
  );
}
