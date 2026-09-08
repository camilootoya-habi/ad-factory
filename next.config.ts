import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El home del usuario tiene un package-lock.json suelto; sin esto Turbopack lo toma
  // como raíz del workspace y avisa en cada arranque.
  turbopack: { root: __dirname },
};

export default nextConfig;
