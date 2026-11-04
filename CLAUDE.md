# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bilingual (vi/en) interactive remote-sensing handbook for teaching. Astro 7 + MDX + React islands, static output to GitHub Pages at `https://quanta1985.github.io/rs-knowledge/` (`base: '/rs-knowledge'` in `astro.config.mjs`).

## Commands

```bash
npm run dev                                   # dev server, http://localhost:4321/rs-knowledge/
npm run build                                 # astro build + pagefind index (search only works after build)
npm run preview                               # serve dist/
npm test                                      # node:test on src/lib/*.test.ts (Node 24 strips TS types natively)
node --test --test-name-pattern="otsu" src/lib/*.test.ts   # single test
python -I scripts/data/export_hanoi_s2.py --list | --date YYYY-MM-DD   # rebuild Hanoi cube (needs GEE auth)
python -I scripts/data/export_angiang_ndvi.py                          # rebuild An Giang NDVI series
python -I scripts/data/export_resolution.py [landsat modis250 modis500]  # Ch.4 products on the same frame
python -I scripts/data/export_revisit.py                               # Ch.4 usable images per month
python scripts/build_lab_chNN.py [--run]     # regenerate labs/chNN notebook; --run executes its cells against GEE
```

GEE project: `claudev1-503808`. Push to `main` deploys via `.github/workflows/deploy.yml` (runs `npm test`, then `withastro/action`).

## Architecture

- **Content**: one MDX file per chapter per language: `src/content/chapters/<lang>/<slug>.mdx` (collection in `src/content.config.ts`; entry id = `<lang>/<slug>`). A chapter is "ready" iff its MDX exists; the roadmap (titles, numbering, parts) lives in `src/data/chapters.ts`. Routes: `src/pages/[lang]/[slug].astro`, home `[lang]/index.astro`, plus `glossary` and `search`. `/` meta-refreshes to `/vi/`.
- **i18n**: UI strings in `src/i18n/ui.ts` (`t(lang, key)`); internal links must go through `url()` so the base path is applied. Astro components get the language from the URL via `langFromUrl(Astro.url)`; React islands receive `lang` as a prop and keep their own `TXT = { vi, en }` objects.
- **Depth levels**: `<Depth level="advanced|ref">` in MDX. CSS on `html[data-depth]` (basic/advanced/ref) hides blocks; Reference mode keeps only `h2` + `.depth-ref` blocks. Presentation mode = `html[data-present]`, arrow keys jump between `h2`s (handled in `src/layouts/Base.astro`).
- **Glossary**: `src/data/glossary.json`; `<Term id="…">` renders a native `popover` (no JS) and throws at build if the id is missing.
- **Interactive figures**: React islands in `src/islands/`, hydrated with `client:visible`, wrapped in `<Figure title try source>` (`src/components/Figure.astro`). All raster figures share ONE download via `loadScene()` in `cube.ts`: `public/data/hanoi-s2/bands.u16z` is gzip'd uint16 BSQ reflectance ×10000 (512×512×10 bands, metadata in `meta.json`, reference spectra in `reference.json`), decompressed with `DecompressionStream`. The `.u16z` extension is deliberate so servers don't add `Content-Encoding`. Other products on the same footprint (`public/data/res-*`, Landsat/MODIS, common band names `red`/`nir`/…) load via `loadProduct(dir)`; every grid shares the S2 cube's UTM upper-left corner, and `toDisplayGrid()` maps them onto the 512×512 @10 m display grid by nearest neighbour. `S2_COMMON` maps common names to S2 bands.
- **Simulated vs real**: figures that derive coarser/fewer-band/fewer-bit data from the S2 cube (aggregation, band subsets, quantisation, linear mixing) must say "simulated" in their `source`; only `res-*` products are real other-sensor data, and their acquisition dates differ from the S2 scene.
- **Pure math** (testable, no DOM) lives in `src/lib/` (`raster.ts`: normalized difference, percentile stretch, histogram, Otsu, colormaps; `chart.ts`: ticks/scales). Canvas rendering helpers are in `src/islands/draw.ts`; charts are hand-written SVG (`LineChart.tsx`, which measures its own width so text stays true-size).
- **Worked examples** (`WorkedExample.astro`) compute from `reference.json` at build time, so numbers in the text and the data cannot drift.

## Conventions that matter

- Every number quoted in chapter prose must come from the exported data (recompute with the scripts, don't estimate). Interpretations not backed by ground truth are labelled as such in the text.
- Figures: fixed −1…+1 scale for indices, disclose stretch (2–98 %), Okabe-Ito/BrBG/viridis palettes with shape/dash redundancy, data table in `<details>`, provenance in the Figure `source`. Never connect time-series points across gaps > 40 days.
- Imagery attribution "Contains modified Copernicus Sentinel data" must stay in the footer/sources. Chapters adapted from the CC BY 4.0 *Sổ tay Vệ tinh & Viễn thám* (Nguyễn Văn Tín) must credit it inside the chapter.
- New chapter checklist: vi + en MDX, glossary terms, `src/data/quiz/<chNN>.json`, data script under `scripts/data/`, lab notebook generator under `scripts/`.
