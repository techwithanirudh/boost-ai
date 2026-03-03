import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = process.env.VITE_API_URL ?? "http://localhost:3000";

export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  envDir: path.resolve(import.meta.dirname, "../../"),
  server: {
    host: true,
    port: 3001,
    allowedHosts: ["rpi5.local"],
    proxy: {
      "/api": {
        target: api,
        changeOrigin: true,
        // biome-ignore lint/performance/useTopLevelRegex: this is more readable for this specific case
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
