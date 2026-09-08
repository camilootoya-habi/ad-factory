"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui/cx";

/** Navegación única del shell: fuente de verdad para sidebar y barra móvil. */
export const NAV = [
  { href: "/", label: "Fábrica", hint: "Configura y exporta una pieza" },
  { href: "/biblioteca", label: "Biblioteca", hint: "Capas generadas, reutilizables" },
  { href: "/presets", label: "Presets", hint: "Las 6 referencias como semilla" },
  { href: "/creativos", label: "Creativos", hint: "Piezas guardadas con su UTM" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * Sidebar del brand center: 300px, sticky, superficie chrome con hairline a la derecha,
 * link activo con borde izquierdo en el morado de marca. Bajo 980px se oculta y aparece
 * la barra superior (MobileBar).
 */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 w-[300px] sticky top-0 h-screen overflow-y-auto z-30"
      style={{
        background: "var(--sidebar-bg)",
        borderRight: "1px solid var(--sidebar-edge)",
        boxShadow: "var(--shadow-sidebar-edge)",
      }}
    >
      <div className="px-6 pt-9 pb-8 flex flex-col gap-3" style={{ borderBottom: "1px solid var(--sidebar-edge)" }}>
        <div className="flex items-center gap-3">
          <img src="/brand/habi-horizontal-color.svg" alt="Habi" style={{ height: 28, width: "auto" }} />
          <span aria-hidden className="w-px h-6" style={{ background: "var(--color-border-default)" }} />
          <span className="label-editorial">Ad Factory</span>
        </div>
        <p className="text-[13px] leading-5" style={{ color: "var(--color-content-secondary)" }}>
          Estáticos por capas con UTM que describe la pieza.
        </p>
      </div>

      <nav className="flex flex-col py-4" aria-label="Secciones">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cx("flex flex-col gap-0.5 px-6 py-3 transition-colors")}
              style={{
                borderLeft: `2px solid ${active ? "var(--brand-primary)" : "transparent"}`,
                color: active ? "var(--brand-primary)" : "var(--color-content-primary)",
                background: active ? "var(--color-surface-accent)" : undefined,
              }}
            >
              <span className="text-[14px] font-medium">{item.label}</span>
              <span className="text-[12px]" style={{ color: "var(--color-content-tertiary)" }}>
                {item.hint}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto px-6 py-5 text-[11px] leading-4" style={{ color: "var(--color-content-tertiary)", borderTop: "1px solid var(--sidebar-edge)" }}>
        <div>v0.1 · growth@habi.co</div>
        <div className="mt-1">Tokens del Habi Brand Center</div>
      </div>
    </aside>
  );
}

/** Barra superior para pantallas angostas (< 980px). */
export function MobileBar() {
  const pathname = usePathname();
  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center gap-4 px-4 h-14 overflow-x-auto"
      style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--sidebar-edge)" }}
    >
      <img src="/brand/habi-horizontal-color.svg" alt="Habi" style={{ height: 22, width: "auto" }} />
      <nav className="flex items-center gap-1" aria-label="Secciones">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className="px-3 py-1.5 text-[13px] font-medium rounded-[var(--radius-sm)] whitespace-nowrap"
              style={{
                color: active ? "var(--brand-primary)" : "var(--color-content-primary)",
                background: active ? "var(--color-surface-accent)" : undefined,
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
