import type { CSSProperties } from "react";
import { cx } from "./cx";

/** Bloque de carga: superficie terciaria con pulso. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cx("animate-pulse rounded-sm bg-surface-tertiary", className)} style={style} />;
}
