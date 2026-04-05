import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/interclasse/',
  build: {
    sourcemap: false, // Desabilita o source map no DevTools
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove todos os console.log()
        drop_debugger: true, // Remove instruções debugger
      },
      mangle: true, // Ofusca os nomes das variáveis e funções
    },
  },
})
