import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Set VITE_BASE=/NOTHING/ when deploying to GitHub Pages under a sub-path.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: { manualChunks: { three: ['three'], mediapipe: ['@mediapipe/tasks-vision'], motion: ['framer-motion'] } },
    },
  },
  server: { port: 5173 },
});
