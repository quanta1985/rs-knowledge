import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// BUILD_ID=x gives a parallel build its own output and cache dirs (dist-x/, node_modules/.astro-x) so two builds don't collide.
const id = process.env.BUILD_ID;

// Default: GitHub Pages project site https://quanta1985.github.io/rs-knowledge/.
// SITE_URL + SITE_BASE override it for the HUMG homepage copy (see CLAUDE.md, "Deploy to the homepage").
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://quanta1985.github.io',
  base: process.env.SITE_BASE ?? '/rs-knowledge',
  trailingSlash: 'always',
  ...(id ? { outDir: `./dist-${id}`, cacheDir: `./node_modules/.astro-${id}` } : {}),
  integrations: [mdx(), react()],
  vite: { worker: { format: 'es' } }, // MapLibre starts its worker as a module worker
});
