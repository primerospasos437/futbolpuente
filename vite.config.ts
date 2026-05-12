import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Cambia en cada `vite build` para que el SW se vuelva a descargar y el cliente tome la versión nueva. */
const appBuildId = process.env.VITE_BUILD_ID ?? new Date().toISOString();

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: true },
    },
  },
});
