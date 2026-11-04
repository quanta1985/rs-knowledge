import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Entry id = "<lang>/<slug>", e.g. "vi/ch06-spectral"
const chapters = defineCollection({
  loader: glob({ base: './src/content/chapters', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    n: z.number(),
    summary: z.string(),
    objectives: z.array(z.string()),
    updated: z.string(),
  }),
});

export const collections = { chapters };
