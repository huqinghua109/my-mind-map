import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'

const nm = fileURLToPath(new URL('./node_modules', import.meta.url))
const alias = (name) => path.join(nm, name)

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'simple-mind-map': fileURLToPath(new URL('../simple-mind-map', import.meta.url)),
      '@svgdotjs/svg.js': alias('@svgdotjs/svg.js'),
      'pdf-lib': alias('pdf-lib'),
      'quill': alias('quill'),
      'katex': alias('katex'),
      'jszip': alias('jszip'),
      'uuid': alias('uuid'),
      'quill-delta': alias('quill-delta'),
      'deepmerge': fileURLToPath(new URL('../simple-mind-map/node_modules/deepmerge', import.meta.url)),
      'xml-js': alias('xml-js'),
      'mdast-util-from-markdown': alias('mdast-util-from-markdown'),
      'parchment': alias('parchment'),
      'eventemitter3': alias('eventemitter3'),
      'yjs': alias('yjs'),
      'y-webrtc': alias('y-webrtc'),
      'y-websocket': alias('y-websocket'),
      'lib0': alias('lib0')
    }
  },
  server: {
    port: 5173,
    fs: { allow: [path.resolve('.'), path.resolve('../simple-mind-map')] },
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/static': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true, changeOrigin: true }
    }
  },
  optimizeDeps: {
    include: ['katex', 'quill', 'jszip', 'pdf-lib', '@svgdotjs/svg.js', 'eventemitter3', 'deepmerge']
  },
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000
  }
})
