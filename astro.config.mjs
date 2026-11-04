import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';

// GitHub Pages project site: https://quanta1985.github.io/rs-knowledge/
export default defineConfig({
  site: 'https://quanta1985.github.io',
  base: '/rs-knowledge',
  trailingSlash: 'always',
  integrations: [mdx(), react()],
});
