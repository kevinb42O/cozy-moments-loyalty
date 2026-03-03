import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const outDir = path.resolve(__dirname, 'dist/business');
  return {
    plugins: [
      {
        name: 'rewrite-root-to-business',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/' || req.url === '/index.html') {
              req.url = '/business/index.html';
            }
            next();
          });
        },
        // After build: promote business/index.html to dist/business/index.html
        closeBundle() {
          const nested = path.join(outDir, 'business', 'index.html');
          const target = path.join(outDir, 'index.html');
          if (fs.existsSync(nested) && !fs.existsSync(target)) {
            fs.copyFileSync(nested, target);
          }
        },
      },
      react(),
      tailwindcss(),
      basicSsl(),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    root: path.resolve(__dirname),
    publicDir: path.resolve(__dirname, 'business/public'),
    cacheDir: path.resolve(__dirname, '.vite-cache/business'),
    build: {
      outDir: path.resolve(__dirname, 'dist/business'),
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'business/index.html'),
        },
      },
    },
    server: {
      port: 3001,
      host: '0.0.0.0',
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
