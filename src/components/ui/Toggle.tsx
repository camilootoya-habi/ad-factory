"use client";

import { cx } from "./cx";

export type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Oculta el texto y deja sólo el interruptor con aria-label. */
  hideLabel?: boolean;
  disabled?: boolean;
  className?: string;
};

/** Interruptor accesible (role=switch). Activo = morado de marca. */
export function Toggle({ checked, onChange, label, hideLabel, disabled, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={hideLabel ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("inline-flex items-center gap-2 text-[12px] font-medium text-content-secondary", disabled && "cursor-not-allowed opacity-40", className)}
    >
      <span
        aria-hidden
        className={cx(
          "relative inline-block h-[18px] w-[32px] rounded-pill border transition-colors",
          checked ? "border-brand-primary bg-brand-primary" : "border-border-default bg-surface-tertiary",
        )}
      >
        <span
          className={cx(
            "absolute top-[2px] size-[12px] rounded-pill bg-surface-primary transition-[left]",
            checked ? "left-[16px]" : "left-[2px]",
          )}
        />
      </span>
      {!hideLabel && <span>{label}</span>}
    </button>
  );
}
