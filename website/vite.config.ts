import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// `static/` (not `public/`) because the repo .gitignore excludes any directory named public.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'static',
  build: { outDir: 'dist' },
});
