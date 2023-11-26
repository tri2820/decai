import { defineConfig } from "vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";



const wasmContentTypePlugin = {
    name: "wasm-content-type-plugin",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url.endsWith(".wasm")) {
          res.setHeader("Content-Type", "application/wasm");
        }
        next();
      });
    },
  };
  

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    {
        name: "configure-response-headers",
        configureServer: (server) => {
          server.middlewares.use((_req, res, next) => {
            res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
            res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
            next();
          });
        },
      },
    wasmContentTypePlugin,
    wasm(),
    topLevelAwait()
  ],
  worker: {
    plugins: [
        {
            name: "configure-response-headers",
            configureServer: (server) => {
              server.middlewares.use((_req, res, next) => {
                res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
                res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
                next();
              });
            },
          },
      wasmContentTypePlugin,
      wasm(),
      topLevelAwait()
    ]
  }
});