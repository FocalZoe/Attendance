import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['VITE_'],
  build: {
    rollupOptions: {
      output: {
        // Libraries change far less often than app code, so separate files stay cached across releases
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase';
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
