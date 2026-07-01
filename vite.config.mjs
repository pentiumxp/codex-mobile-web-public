import { defineConfig } from "vite";
import { createShellAssetGraphPlugin } from "./scripts/frontend-shell-asset-graph.mjs";

export default defineConfig({
  clearScreen: false,
  publicDir: false,
  build: {
    outDir: "dist/frontend-shell",
    emptyOutDir: true,
    manifest: true,
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: {
        "vite-shell-entry": "frontend/vite-shell-entry.mjs",
      },
    },
  },
  plugins: [
    createShellAssetGraphPlugin(),
  ],
});
