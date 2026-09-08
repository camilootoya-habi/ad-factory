import type { ReactNode } from "react";
import { MobileBar, Sidebar } from "@/components/shell/Sidebar";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Shell de la app (sidebar + columna principal). Vive en el grupo (app) para que /render
 * quede fuera: esa ruta monta la pieza desnuda para el batch de Chrome.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex flex-col lg:flex-row min-h-screen w-full">
        <Sidebar />
        <MobileBar />
        <main className="flex-1 min-w-0" style={{ background: "var(--color-surface-primary)" }}>
          <div className="mx-auto w-full max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
