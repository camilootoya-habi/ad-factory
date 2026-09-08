"use client";

import { useState, type ReactNode } from "react";
import { cx } from "./cx";

export type SectionProps = {
  /** Label editorial (p. ej. "02 · Protagonista"). */
  label: string;
  title: string;
  children: ReactNode;
  /** Controles a la derecha del título (un toggle, un chip de estado). */
  aside?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

/** Sección del configurador: label editorial + heading Montserrat + contenido. */
export function Section({ label, title, children, aside, collapsible = false, defaultOpen = true, className }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cx("card p-5", className)}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="label-editorial">{label}</span>
          {collapsible ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="mt-1 flex items-center gap-2 text-left font-headings text-[17px] font-semibold tracking-[-0.01em] text-content-primary"
            >
              <span>{title}</span>
              <span aria-hidden className={cx("text-[11px] text-content-tertiary transition-transform", !open && "-rotate-90")}>
                ▾
              </span>
            </button>
          ) : (
            <h2 className="mt-1 font-headings text-[17px] font-semibold tracking-[-0.01em] text-content-primary">{title}</h2>
          )}
        </div>
        {aside && <div className="flex shrink-0 items-center gap-2 pt-4">{aside}</div>}
      </header>
      {open && <div className="mt-4 flex flex-col gap-4">{children}</div>}
    </section>
  );
}
