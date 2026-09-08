"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "./cx";

export type ToastKind = "ok" | "error" | "info";

type ToastItem = { id: number; message: string; kind: ToastKind };

export type ToastApi = {
  toast: (message: string, kind?: ToastKind, durationMs?: number) => void;
  /** Convierte cualquier error en un toast legible. */
  error: (err: unknown) => void;
};

/** Duración estándar del brand center. Los errores duran el doble para alcanzar a leerlos. */
export const TOAST_MS = 1600;

const ToastContext = createContext<ToastApi | null>(null);

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Algo salió mal.";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "ok", durationMs?: number) => {
    seq.current += 1;
    const id = seq.current;
    setItems((xs) => [...xs, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((xs) => xs.filter((x) => x.id !== id));
    }, durationMs ?? (kind === "error" ? TOAST_MS * 2 : TOAST_MS));
  }, []);

  const api = useMemo<ToastApi>(() => ({ toast, error: (err) => toast(errorMessage(err), "error") }), [toast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto max-w-[520px] rounded-sm px-4 py-3 text-[13px] font-medium shadow-lg",
              t.kind === "error" ? "bg-content-error text-content-inverse" : "bg-surface-inverse text-content-inverse",
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  return ctx;
}
