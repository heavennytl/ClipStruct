import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/content.jsx'),
        background: resolve(__dirname, 'src/background/background.js'),
        popup: resolve(__dirname, 'src/popup/popup.jsx')
      },
      output: {
        entryFileNames: '[name]/[name].js',
        chunkFileNames: 'common/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: false
  }
});