import type { ReactNode } from "react";
import { cx } from "./cx";

export type FieldProps = {
  label: string;
  hint?: ReactNode;
  /** Algo a la derecha del label (valor actual, acción pequeña). */
  trailing?: ReactNode;
  children: ReactNode;
  className?: string;
};

/** Label editorial de 11px en mayúsculas + control. */
export function Field({ label, hint, trailing, children, className }: FieldProps) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-editorial">{label}</span>
        {trailing && <span className="font-mono text-[11px] text-content-tertiary">{trailing}</span>}
      </div>
      {children}
      {hint && <span className="text-[11px] leading-snug text-content-tertiary">{hint}</span>}
    </div>
  );
}
