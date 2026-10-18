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
  server: { port: 5174, strictPort: true, fs: { allow: [".."] } },
  build: { outDir: "dist", emptyOutDir: true },
  test: { environment: "jsdom", include: ["src/**/*.test.{ts,tsx}"], setupFiles: ["src/test/setup.ts"] },
});
