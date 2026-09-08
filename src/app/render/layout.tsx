import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Render",
  robots: { index: false, follow: false },
};

/**
 * Layout desnudo de /render/[id]: sin shell, sin sidebar, sin fondo. El root layout ya
 * define <html>/<body> con las variables de next/font (Montserrat/Inter) que el <Creative>
 * necesita; aquí sólo se neutraliza el body para que la pieza quede en (0,0) a tamaño real
 * y el fondo sea transparente (Chrome captura el elemento, no el viewport).
 */
export default function RenderLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          min-height: 0 !important;
          display: block !important;
          overflow: hidden !important;
        }
      `}</style>
      {children}
    </>
  );
}
