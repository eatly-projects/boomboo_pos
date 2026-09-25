import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Sengaja diturunkan dari bawaan Vite supaya berkas JavaScript-nya tetap
    // terbaca oleh peramban yang agak lama, termasuk peramban bawaan di dalam
    // aplikasi lain seperti WhatsApp dan Instagram.
    target: ['es2020', 'chrome90', 'edge90', 'firefox90', 'safari15'],
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    port: 5180,
    strictPort: false,
  },
  preview: {
    port: 5180,
  },
});
