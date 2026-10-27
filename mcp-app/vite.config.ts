import path from 'node:path'

import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Bundles the MCP Apps view into one self-contained HTML file that the MCP
// server serves as ui://rangebook/view.html.
export default defineConfig({
  root: import.meta.dirname,
  plugins: [viteSingleFile()],
  resolve: { alias: { '#': path.resolve(import.meta.dirname, '../src') } },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(import.meta.dirname, 'view.html') },
  },
})
