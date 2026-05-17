import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import icon from "astro-icon";

export default defineConfig({
  site: "https://jantauberschmidt.github.io",
  integrations: [react(), icon()],
  vite: {
    build: {
      chunkSizeWarningLimit: 1300,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes("node_modules/three/examples/jsm/controls/OrbitControls")) {
              return "three-controls";
            }
            if (id.includes("node_modules/three-globe/")) {
              return "three-globe";
            }
            if (id.includes("node_modules/three/")) {
              return "three-core";
            }
            if (id.includes("node_modules/topojson-client/")) {
              return "topojson";
            }
            if (id.includes("node_modules/world-atlas/")) {
              return "world-atlas";
            }
          },
        },
      },
    },
  },
});
