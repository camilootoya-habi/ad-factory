"use client";

import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

export type ChipTone = "neutral" | "brand" | "ok" | "warn" | "error";

export type ChipProps = {
  children: ReactNode;
  tone?: ChipTone;
  mono?: boolean;
  title?: string;
  onRemove?: () => void;
  className?: string;
};

/* Los semánticos de éxito/aviso/error no están mapeados en @theme: van por variable. */
const TONE_STYLE: Record<ChipTone, CSSProperties> = {
  neutral: { background: "var(--color-surface-secondary)", color: "var(--color-content-secondary)", borderColor: "var(--color-border-subtle)" },
  brand: { background: "var(--color-surface-accent)", color: "var(--brand-primary)", borderColor: "transparent" },
  ok: { background: "var(--color-surface-success)", color: "var(--color-content-success)", borderColor: "transparent" },
  warn: { background: "var(--color-surface-warning)", color: "var(--color-content-warning)", borderColor: "transparent" },
  error: { background: "var(--color-surface-error)", color: "var(--color-content-error)", borderColor: "transparent" },
};

/** Pastilla de 999px, 11px. Con `onRemove` muestra la x. */
export function Chip({ children, tone = "neutral", mono, title, onRemove, className }: ChipProps) {
  return (
    <span
      title={title}
      style={TONE_STYLE[tone]}
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-pill border px-2.5 py-1 text-[11px] font-semibold leading-none",
        mono ? "font-mono font-medium tracking-normal" : "tracking-[0.04em]",
        className,
      )}
    >
      <span className="truncate">{children}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Quitar" className="-mr-1 rounded-pill px-1 leading-none opacity-70 hover:opacity-100">
          ×
        </button>
      )}
    </span>
  );
}
