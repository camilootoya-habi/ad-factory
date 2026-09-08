"use client";

import { cx } from "./cx";

export type SegmentOption<T extends string> = { value: T; label: string; hint?: string; disabled?: boolean };

export type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "md" | "sm";
  className?: string;
  disabled?: boolean;
};

/** Grupo de opciones excluyentes (formato, variante). Plano; el activo va en tinta inversa. */
export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel, size = "md", className, disabled }: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cx("inline-flex max-w-full flex-wrap gap-0.5 rounded-sm border border-border-subtle bg-surface-secondary p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.hint}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-kbd font-semibold tracking-[0.04em] transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]",
              active ? "bg-surface-inverse text-content-inverse" : "text-content-secondary hover:text-content-primary",
              (disabled || o.disabled) && "cursor-not-allowed opacity-40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
