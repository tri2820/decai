import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/@ezkljs/engine/web/ezkl_bg.wasm",
          dest: "node_modules/.vite/deps/",
        },
      ],
    }),
  ],
});
