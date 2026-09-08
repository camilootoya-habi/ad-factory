"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * La fábrica es una herramienta interactiva y arranca creando ids y fechas (uuid, shortId,
 * createdAt) para la pieza en blanco. Prerenderizarla haría que servidor y cliente
 * generaran valores distintos → mismatch de hidratación. Por eso se carga sólo en el
 * cliente: no hay nada que un crawler necesite ver aquí.
 */
const Factory = dynamic(() => import("@/components/factory/FactoryPage").then((m) => m.FactoryPage), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col gap-8">
      <Skeleton style={{ height: 96, borderRadius: "var(--radius-md)" }} />
      <div className="flex flex-col gap-8 xl:flex-row">
        <Skeleton style={{ height: 640, width: 440, borderRadius: "var(--radius-md)" }} />
        <Skeleton style={{ height: 640, flex: 1, borderRadius: "var(--radius-md)" }} />
      </div>
    </div>
  ),
});

export default function FabricaPage() {
  return <Factory />;
}
