import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  // Relative asset paths so the build works under the GitHub Pages sub-path.
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": r("./src"),
      // Pipeline, data, telemetry and study wording are imported unchanged from prototype/.
      "@proto": r("../prototype"),
    },
  },
  server: { port: 5173, strictPort: true, fs: { allow: [".."] } },
  preview: { port: 4173, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], testTimeout: 15000, setupFiles: ["../tests/setup/network-guard.js", "src/test/setup.ts"] },
});
