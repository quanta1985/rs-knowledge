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
python -I scripts/data/export_s1.py [hanoi angiang]                    # Ch.11 Sentinel-1
python -I scripts/data/export_chNN_*.py                                # other chapters' GEE exports (one or more per chapter)
node scripts/chNN_numbers.ts   (ch02, ch05, ch11, ch12; ch09/ch10 live in scripts/data/export_chNN_numbers.ts)
                                                                       # recompute every number quoted in a chapter with the figure code
cd scripts && python build_lab_chNN.py [--run]   # regenerate labs/chNN notebook; --run executes its cells against GEE
```

GEE project: `claudev1-503808`. Push to `main` deploys via `.github/workflows/deploy.yml` (runs `npm test`, then `withastro/action`).

### Environment gotchas (Windows)

- Lab generators import `scripts/labkit.py`: run them WITHOUT `-I` (isolated mode drops the script dir from `sys.path`). Data scripts may use `-I`.
- `-I` also ignores `PYTHONIOENCODING`; printing Vietnamese then fails on cp1252 — call `sys.stdout.reconfigure(encoding="utf-8")` or run without `-I`.
- `rasterio` here cannot find `proj.db`; do coordinate transforms in Earth Engine (`ee.Geometry...transform`) instead.
- GitHub CLI is not on the bash PATH: use `"/c/Program Files/GitHub CLI/gh.exe"` (logged in as `quanta1985`).
- Browser checks: Python Playwright + Chromium are installed; launch Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` for WebGL (maps/globe), and screenshot with `page.screenshot(clip=…, full_page=True)` (element screenshots time out while Cesium animates); run `npx astro preview --port 4321` and test `http://localhost:4321/rs-knowledge/...`. Islands hydrate `client:visible`, so scroll each figure/quiz into view before asserting.

### Earth Engine data notes

- Cloud Score+ collection id is `GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED` (link with `.linkCollection(cs, ['cs_cdf'])`).
- `S2_SR_HARMONIZED`: reflectance = DN / 10000 (baseline offset already removed). Landsat C2 L2: DN × 0.0000275 − 0.2. MOD09: × 0.0001.
- Hanoi is very cloudy in late winter–spring: no clear Landsat scene Jan–Apr 2024; MODIS picked by `state_1km` clear ≥ 95 % and SensorZenith ≤ 30°.
- Sentinel-1 over the Hanoi frame: 2024-02-12 relative orbit 128 ASC (same day as the S2 scene); Typhoon Yagi pair 2024-08-31 / 2024-09-12, orbit 91 DESC. Only S1A was operating in 2023–2024 (12-day repeat per orbit). Average σ0 in linear power, then convert to dB.

## Architecture

- **Content**: one MDX file per chapter per language: `src/content/chapters/<lang>/<slug>.mdx` (collection in `src/content.config.ts`; entry id = `<lang>/<slug>`). A chapter is "ready" iff its MDX exists; the roadmap (titles, numbering, parts) lives in `src/data/chapters.ts`. Routes: `src/pages/[lang]/[slug].astro`, home `[lang]/index.astro`, plus `glossary` and `search`. `/` meta-refreshes to `/vi/`.
- **i18n**: UI strings in `src/i18n/ui.ts` (`t(lang, key)`); internal links must go through `url()` so the base path is applied. Astro components get the language from the URL via `langFromUrl(Astro.url)`; React islands receive `lang` as a prop and keep their own `TXT = { vi, en }` objects.
- **Depth levels**: `<Depth level="advanced|ref">` in MDX. CSS on `html[data-depth]` (basic/advanced/ref) hides blocks; Reference mode keeps only `h2` + `.depth-ref` blocks. Presentation mode = `html[data-present]`, arrow keys jump between `h2`s (handled in `src/layouts/Base.astro`).
- **Glossary**: one file per chapter in `src/data/glossary/*.json` (core.json = Ch.4/6), merged by `src/data/glossary.ts` (throws on duplicate ids). `<Term id="…">` renders a native `popover` (no JS) and throws at build if the id is missing.
- **Interactive figures**: React islands in `src/islands/`, hydrated with `client:visible`, wrapped in `<Figure title try source>` (`src/components/Figure.astro`). All raster figures share ONE download via `loadScene()` in `cube.ts`: `public/data/hanoi-s2/bands.u16z` is gzip'd uint16 BSQ reflectance ×10000 (512×512×10 bands, metadata in `meta.json`, reference spectra in `reference.json`), decompressed with `DecompressionStream`. The `.u16z` extension is deliberate so servers don't add `Content-Encoding`. Other products on the same footprint (`public/data/res-*`, Landsat/MODIS, common band names `red`/`nir`/…) load via `loadProduct(dir)`; every grid shares the S2 cube's UTM upper-left corner, and `toDisplayGrid()` maps them onto the 512×512 @10 m display grid by nearest neighbour. `S2_COMMON` maps common names to S2 bands.
- **Simulated vs real**: figures that derive coarser/fewer-band/fewer-bit data from the S2 cube (aggregation, band subsets, quantisation, linear mixing) must say "simulated" in their `source`; only `res-*` products are real other-sensor data, and their acquisition dates differ from the S2 scene.
- **Map-first figures (user requirement: "interactive maps, pro information design like the original app")**:
  - `MapStage.tsx` (MapLibre GL 6, lazy-loaded; worker via `?worker&url`): dark stage, Esri World Imagery / CARTO basemap toggle, raster overlays as image sources on a corner quad (`frameQuad(meta)` from `cube.ts`, inverse UTM in `lib/geo.ts`) drawn with nearest resampling, HTML pin markers, floating HUD (`hud`) top-right and control bar (`bar`) bottom; `onMap(map, ml)` escape hatch for GeoJSON layers; `bounds` for views without a raster (default: Viet Nam). Hover → pixel via `lonLatToPixel`.
  - `GlobeStage.tsx`: CesiumJS 1.146.0 from jsDelivr CDN (not bundled), Esri imagery, no Ion token; `scene(viewer, Cesium)` builds entities and returns cleanup; render loop pauses off-screen. Orbit math in `lib/orbit.ts` (two-body, spherical Earth).
  - `VizUi.tsx`: `StatPanel` (HUD key/value rows, tones accent/ok/warn/bad/muted), `Pills`, `Slider`, `Key`. Diagrams/charts without a map use the `.dark-card` layout (svg + `.hud-static` + `.bar-static`) so every figure shares the stage look.
  - Stage CSS lives at the end of `global.css` (`.stage`, `.hud`, `.stage-bar`, `.pills`, `.stat-panel`, `.dark-card`, `.map-pin`). Do not use `.viz canvas` for new map figures.
- **Pure math** (testable, no DOM) lives in `src/lib/` (`raster.ts`: normalized difference, percentile stretch, histogram, Otsu, colormaps; `chart.ts`: ticks/scales). Canvas rendering helpers are in `src/islands/draw.ts`; charts are hand-written SVG (`LineChart.tsx`, which measures its own width so text stays true-size).
- **Worked examples** (`WorkedExample.astro`) compute from `reference.json` at build time, so numbers in the text and the data cannot drift.

## Conventions that matter

- Every number quoted in chapter prose must come from the exported data (recompute with the scripts, don't estimate). Interpretations not backed by ground truth are labelled as such in the text.
- Figures: fixed −1…+1 scale for indices, disclose stretch (2–98 %), Okabe-Ito/BrBG/viridis palettes with shape/dash redundancy, data table in `<details>`, provenance in the Figure `source`. Never connect time-series points across gaps > 40 days.
- Imagery attribution "Contains modified Copernicus Sentinel data" must stay in the footer/sources. Chapters adapted from the CC BY 4.0 *Sổ tay Vệ tinh & Viễn thám* (Nguyễn Văn Tín) must credit it inside the chapter.
- New chapter checklist: vi + en MDX, glossary terms, `src/data/quiz/<chNN>.json`, data script under `scripts/data/`, lab notebook generator `scripts/build_lab_chNN.py` (+ `labs/chNN_*.js` GEE script), run `--run` to execute the notebook, Playwright smoke test of every figure, then a `code-reviewer` pass.
- Commits/pushes only when the user asks. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `.gitattributes` forces LF and marks `*.u16z` binary.

## Status (2026-11-04, deployed)

- All 16 chapters complete in vi + en (39 pages, Pagefind indexes 34), 66/66 unit tests, `tsc` clean except missing `node:*` types in test files, mobile (390 px) smoke of all 32 chapter pages: no console errors, no horizontal overflow. Two code-review passes done and fixes applied.
- Every MapStage shows Viet Nam's sovereignty labels (Hoàng Sa, Trường Sa, Biển Đông; `SOVEREIGN` in `MapStage.tsx`, zoom < 9); national views use bounds that include both archipelagos.
- Ch.15 (`LabIndex.astro`) and Ch.16 (`FormulaTable`, `RefList.astro`) read `labs/` and every chapter's references at build time — they stay complete when chapters change.
- Live at https://quanta1985.github.io/rs-knowledge/ (commit `91b7ad8`, Pages via GitHub Actions; the gh token now has the `workflow` scope). Every push to `main` redeploys.
- Not yet verified: the GEE JS scripts `labs/*.js` in the Code Editor.
