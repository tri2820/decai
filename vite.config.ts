import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'


// function fixExternal() {
//     return {
//       name: 'fix-external',
//       setup(build) {
//         const {external} = build.initialOptions;
//         build.onResolve(
//           { filter: /^[\w@][^:]/ },
//           async ({ path: id, importer, kind, resolveDir }) => {
//             if (external && external.includes(id)) {
//               return {
//                 path: id,
//                 external: true,
//               };
//             }
//           }
//         );
//       },
//     };
//   }

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        viteStaticCopy({
          targets: [
            {
              src: 'node_modules/@ezkljs/engine/web/ezkl_bg.wasm',
              dest: 'node_modules/.vite/deps/'
            }
          ]
        })
      ]
    
//   server: {
//     port: 8083,
//   },
//   build: {
//     sourcemap: true,
//     target: ['es2020'],
//   },
//   optimizeDeps: {
//     esbuildOptions: { target: 'esnext' },
//     exclude: ['@ezkljs/engine','json-bigint']
//   },
//   plugins: [
//     fixExternal()
// ]
//     // Needed to enable OPFS
//     {
//       name: 'configure-response-headers',
//       configureServer: (server) => {
//         server.middlewares.use((_req, res, next) => {
//           res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
//           res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
//           next()
//         })
//       },
//     },
//   ],
})