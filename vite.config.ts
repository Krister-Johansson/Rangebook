import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // Pre-bundle the chat client up front. Found late, Vite re-optimizes and the
  // page can load two copies of React ("Invalid hook call") until a reload.
  optimizeDeps: { include: ['@tanstack/ai-react'] },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
