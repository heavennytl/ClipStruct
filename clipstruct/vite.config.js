import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import * as fs from 'fs';
import { copyFileSync, mkdirSync, existsSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-static-files',
      closeBundle() {
        // 确保目录存在
        const distPopupDir = resolve(__dirname, 'dist/popup');
        if (!existsSync(distPopupDir)) {
          mkdirSync(distPopupDir, { recursive: true });
        }
        
        // 复制并修改 popup.html
        const popupHtmlContent = fs.readFileSync(resolve(__dirname, 'src/popup/popup.html'), 'utf8');
        const modifiedPopupHtml = popupHtmlContent.replace('src="popup.jsx"', 'src="popup.js"');
        fs.writeFileSync(resolve(__dirname, 'dist/popup/popup.html'), modifiedPopupHtml, 'utf8');

        
        // 复制 manifest.json
        copyFileSync(
          resolve(__dirname, 'public/manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
        
        // 复制图标
        const publicIconsDir = resolve(__dirname, 'public/icons');
        const distIconsDir = resolve(__dirname, 'dist/icons');
        if (!existsSync(distIconsDir)) {
          mkdirSync(distIconsDir, { recursive: true });
        }
        
        const icons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'];
        icons.forEach(icon => {
          const srcIcon = resolve(publicIconsDir, icon);
          const destIcon = resolve(distIconsDir, icon);
          if (existsSync(srcIcon)) {
            copyFileSync(srcIcon, destIcon);
          }
        });
      }
    }
  ],
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