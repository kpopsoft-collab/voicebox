import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { changelogPlugin } from '../app/plugins/changelog';

const certPath = path.resolve(__dirname, '../certs/cert.pem');
const keyPath = path.resolve(__dirname, '../certs/key.pem');
const hasHttps = fs.existsSync(certPath) && fs.existsSync(keyPath);

export default defineConfig({
  plugins: [react(), tailwindcss(), changelogPlugin(path.resolve(__dirname, '..'))],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../app/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: hasHttps
      ? {
          key: fs.readFileSync(keyPath),
          cert: fs.readFileSync(certPath),
        }
      : undefined,
  },
  build: {
    outDir: 'dist',
  },
});
