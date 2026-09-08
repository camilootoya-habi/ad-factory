"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "brand" | "ghost";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  loading?: boolean;
  /** Se muestra como title aunque el botón esté deshabilitado (los disabled no reciben hover). */
  tooltip?: string;
  children?: ReactNode;
};

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  brand: "btn-brand",
  ghost: "btn-ghost",
};

/** Botón sobre las recetas .btn-* de globals.css (superficies planas, mayúsculas, radio 8). */
export function Button({ variant = "ghost", size = "md", loading, tooltip, disabled, className, children, type = "button", ...rest }: ButtonProps) {
  const isDisabled = disabled || loading;
  const btn = (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cx(VARIANT[variant], size === "sm" && "px-3! py-2! text-[11px]! tracking-[0.08em]!", "justify-center whitespace-nowrap", className)}
      {...rest}
    >
      {loading && <span aria-hidden className="inline-block size-2 animate-pulse rounded-pill bg-current" />}
      {children}
    </button>
  );
  if (tooltip && isDisabled) {
    return (
      <span title={tooltip} className="inline-flex cursor-not-allowed">
        {btn}
      </span>
    );
  }
  return tooltip ? <span title={tooltip} className="inline-flex">{btn}</span> : btn;
}
