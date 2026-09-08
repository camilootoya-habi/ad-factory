import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El home del usuario tiene un package-lock.json suelto; sin esto Turbopack lo toma
  // como raíz del workspace y avisa en cada arranque.
  turbopack: { root: __dirname },
  // El botón flotante de Next dev se colaba en las capturas de /render (batch y export).
  devIndicators: false,
};

export default nextConfig;
