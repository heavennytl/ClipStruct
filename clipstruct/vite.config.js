import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * ClipStruct Vite 构建配置
 * 使用 @crxjs/vite-plugin 专门为 Chrome 扩展优化
 */

// 读取 manifest.json
const manifest = JSON.parse(
  readFileSync(resolve(__dirname, 'public/manifest.json'), 'utf-8')
);

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    outDir: 'dist',
    // 允许较大的 chunk（React 应用需要）
    chunkSizeWarningLimit: 2000
  }
});
