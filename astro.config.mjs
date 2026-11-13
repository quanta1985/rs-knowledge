import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// BUILD_ID=x gives a parallel build its own output and cache dirs (dist-x/, node_modules/.astro-x) so two builds don't collide.
const id = process.env.BUILD_ID;

// GitHub Pages project site: https://quanta1985.github.io/rs-knowledge/
export default defineConfig({
  site: 'https://quanta1985.github.io',
  base: '/rs-knowledge',
  trailingSlash: 'always',
  ...(id ? { outDir: `./dist-${id}`, cacheDir: `./node_modules/.astro-${id}` } : {}),
  integrations: [mdx(), react()],
  vite: { worker: { format: 'es' } }, // MapLibre starts its worker as a module worker
});
