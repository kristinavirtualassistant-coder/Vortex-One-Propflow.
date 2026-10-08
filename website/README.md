# Vortex One marketing website

Standalone marketing site for Vortex One. It is separate from the application in the repo root: its own `package.json`, build and deploy. Vite, React 19, TypeScript and Tailwind CSS 4.

## What it contains

- Home page with interactive demos on fictional data: property and owner intelligence, lead scoring, pipeline, a scripted dialer simulation and a time calculator.
- Legal pages at `/legal/:slug`: privacy, terms, ai-disclosure, communications-policy, acceptable-use, cookies, data-sources, refunds. Content lives in `src/content/legal.ts`.
- No forms and no backend. "Start free", "Sign in" and the live demo all link to the application (`APP_URL`).

## Run

```bash
cd website
npm install
npm run dev          # http://localhost:5173
npm run build        # typecheck + production build into website/dist
npm run preview      # serve the build on http://localhost:4173
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `VITE_APP_URL` | `https://vortexone-propflow.vercel.app` | Where sign in, sign up and the live demo live |
| `VITE_SITE_URL` | `https://vortex-one-website.vercel.app` | This site's public origin, used for the absolute Open Graph image URL (`og-image.jpg`). Set it when the domain changes |

Legal entity, contact email, year and "last updated" date are in `src/config.ts`.

## Deploy

It is a static single-page app: publish `website/dist` with a rewrite of every path to `/index.html`. Configs are included for Vercel (`vercel.json`) and Cloudflare Pages or Netlify (`static/_redirects`). Set the project root to `website/`, build command `npm run build`, output `dist`. Static assets live in `static/` rather than `public/` because the repo `.gitignore` excludes directories named `public`.

## Keep the site honest

The site must describe what the product does today. As of this version the dialer is simulated (no telephony), agents are rule-based, there is no email or SMS sending, no call recording and no paid billing. If any of that changes, update these in the same change:

- `src/components/Sections.tsx` (feature status badges, pricing, trust section)
- `src/components/Demos.tsx` (dialer simulation copy)
- `src/content/legal.ts` (privacy, AI disclosure, communications policy, refunds, and add a call recording notice if recording ships)

The legal text is a draft and should be reviewed by counsel before launch.

## Before launch

- Confirm `APP_URL` is the production app URL.
- Logo assets are in `static/`. `logo-horizontal-sm.webp` is the horizontal "VORTEX ONE" logo cut out on a transparent background; it is used in the white top bar (`Nav` in `src/components/Layout.tsx`) and must stay on a light background because the wordmark is dark navy. `logo-mark.webp` is the circular emblem cut out on a transparent background (hero), `logo-lockup.webp` is its full lockup on white, plus `favicon.png`, `apple-touch-icon.png` and the share image use that emblem. The emblem and the horizontal logo are different marks, so decide which one is the brand mark and make them match. If you have vector or transparent masters, swap them in for a crisper result.
- Social sharing: Open Graph and Twitter tags are in `index.html`, and the 1200×630 share image is `static/og-image.jpg`. Because this is a single-page app, every route shares the same tags and image, and `og:url` and canonical are omitted on purpose. Per-page titles would need prerendering. After deploying, refresh cached previews with the platform debuggers (Facebook Sharing Debugger, LinkedIn Post Inspector).
- Optional: deep links such as `?signup` or `?demo` need support in the app's landing page.
