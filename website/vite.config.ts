import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const DEFAULT_SITE_URL = 'https://vortex-one-website.vercel.app';

// `static/` (not `public/`) because the repo .gitignore excludes any directory named public.
export default defineConfig(({ mode }) => {
  // Public origin of this site, used for absolute Open Graph image URLs.
  // Override with VITE_SITE_URL when the custom domain changes.
  const siteUrl = (loadEnv(mode, '.', 'VITE_').VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '');

  return {
    plugins: [
      {
        name: 'site-url',
        transformIndexHtml: (html: string) => html.split('%SITE_URL%').join(siteUrl),
      },
      react(),
      tailwindcss(),
    ],
    publicDir: 'static',
    build: { outDir: 'dist' },
  };
});
