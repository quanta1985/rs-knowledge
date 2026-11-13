# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**GIS and Remote Sensing Knowledge** (app name, `siteTitle` in `ui.ts`, same in vi and en): a bilingual (vi/en) interactive satellite, remote-sensing and GIS handbook for teaching, with Viet Nam examples on real data. Author/owner: Trần Anh Quân (HUMG). Astro 7 + MDX + React islands, static output deployed twice: GitHub Pages `https://quanta1985.github.io/rs-knowledge/` (default `base: '/rs-knowledge'`) and the author's homepage `http://remosat.usth.edu.vn/~quanta/rs-knowledge/` (see "Deploy to the homepage"). `astro.config.mjs` reads `SITE_URL` / `SITE_BASE` env vars to switch.

## Commands

```bash
npm run dev                                   # dev server, http://localhost:4321/rs-knowledge/
npm run build                                 # astro build + pagefind index (search only works after build)
npm run preview                               # serve dist/ (Astro allows ONE preview per project)
npm test                                      # node:test on src/lib/*.test.ts (Node 24 strips TS types natively)
node --test --test-name-pattern="otsu" src/lib/*.test.ts   # single test
npx -y -p typescript@5.9.3 tsc --noEmit -p .  # type check (typescript is not a dependency; only missing node:* types in tests are expected)
BUILD_ID=x npx astro build                    # parallel build into dist-x/ with its own cache (dist-*/ is gitignored)

# data (chNN in file names = slug id, NOT the display chapter number; see Architecture)
python -I scripts/data/export_hanoi_s2.py --list | --date YYYY-MM-DD   # rebuild Hanoi cube (needs GEE auth)
python -I scripts/data/export_angiang_ndvi.py                          # rebuild An Giang NDVI series
python -I scripts/data/export_resolution.py [landsat modis250 modis500]  # ch04-resolution products on the same frame
python -I scripts/data/export_revisit.py                               # ch04-resolution usable images per month
python -I scripts/data/export_s1.py [hanoi angiang]                    # ch11-sar Sentinel-1
python -I scripts/data/export_chNN_*.py                                # other remote-sensing chapters' GEE exports
python -I scripts/data/export_{gnss_constellations,signals,bus_data,constellations}.py   # Part A: CelesTrak snapshots (+ itur / pymsis)

# numbers quoted in prose, recomputed with the figure code
node scripts/chNN_numbers.ts                  # ch02, ch05, ch11, ch12 (ch09/ch10: scripts/data/export_chNN_numbers.ts)
node scripts/{launch,bus,signals,constellation,gnss}_numbers.ts      # Part A chapters 3–7

# labs (run WITHOUT -I, see gotchas); --run executes the notebook cells
cd scripts && python build_lab_chNN.py [--run]                       # remote-sensing labs (+ labs/chNN_*.js GEE script)
cd scripts && python build_lab_{launch,bus,signals,constellations,gnss}.py [--run]   # Part A labs (Python only)
```

GEE project: `claudev1-503808`. Push to `main` deploys via `.github/workflows/deploy.yml` (runs `npm test`, then `withastro/action`).

### Deploy to the homepage (second copy)

The user's homepage `http://remosat.usth.edu.vn/~quanta/` (static HTML in `/home/quanta/public_html` on `quanta@14.231.137.16`, key `~/.ssh/id_ed25519_quanta`) hosts a copy at `rs-knowledge/`, linked from a card on `teaching.html` ("Teaching material") and as the first card on `software.html` (thumbnails `img/software/rs-knowledge{,-2x}.webp`, 480×360 / 960×720). To update it:

```bash
SITE_URL=http://remosat.usth.edu.vn SITE_BASE=/~quanta/rs-knowledge BUILD_ID=home npx astro build && npx pagefind --site dist-home
tar -C dist-home -czf - . | ssh -i ~/.ssh/id_ed25519_quanta quanta@14.231.137.16 'set -e; cd /home/quanta/public_html; rm -rf rs-knowledge.new; mkdir rs-knowledge.new; tar -C rs-knowledge.new -xzf - --no-same-owner; find rs-knowledge.new -type d -exec chmod 755 {} +; find rs-knowledge.new -type f -exec chmod 644 {} +; mv rs-knowledge rs-knowledge.old; mv rs-knowledge.new rs-knowledge; rm -rf rs-knowledge.old'
```

- Upload into `rs-knowledge.new` and swap (above), so stale hashed assets do not pile up. Check afterwards: `find rs-knowledge -type f | wc -l` equals `find dist-home -type f | wc -l`.
- The two copies do NOT sync: a push updates GitHub Pages only; the homepage copy needs this build + upload. When the user asks to "push", ask or do both.
- The homepage pages are the user's hand-written static site (`css/main.css`, `.cards.fill` / `article.card` with `img.thumb` + `h3 a` + `p` + `p.refs`). Before editing any HTML page there, copy it to `<page>.bak-YYYYMMDD` (the user's own convention). Plain `ssh` prints post-quantum warnings on stderr; filter them out.

### Environment gotchas (Windows)

- Lab generators import `scripts/labkit.py`: run them WITHOUT `-I` (isolated mode drops the script dir from `sys.path`). Data scripts may use `-I`.
- `-I` also ignores `PYTHONIOENCODING`; printing Vietnamese then fails on cp1252 — call `sys.stdout.reconfigure(encoding="utf-8")` or run without `-I`.
- Never leave a helper named like a stdlib module (e.g. `tokenize.py`) in the directory you run Python from: it shadows the stdlib and breaks Playwright.
- `rasterio` here cannot find `proj.db`; do coordinate transforms in Earth Engine (`ee.Geometry...transform`) instead.
- Local Python extras for Part A data/labs: `sgp4`, `itur` (ITU-R rain models), `pymsis` (NRLMSIS density).
- GitHub CLI is not on the bash PATH: use `"/c/Program Files/GitHub CLI/gh.exe"` (logged in as `quanta1985`).
- Git Bash rewrites arguments that start with `/` (e.g. `/vi/`) into Windows paths: prefix the command with `MSYS_NO_PATHCONV=1`.
- Astro 7's default Markdown processor (Sätteri) ignores `remarkPlugins`/`rehypePlugins` unless `@astrojs/markdown-remark` is installed. Transform rendered MDX with component overrides instead (`<Content components={{ h2: H2, h3: H3 }} />`).
- Browser checks: Python Playwright + Chromium are installed; launch Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` for WebGL (maps/globe), and screenshot with `page.screenshot(clip=…, full_page=True)` (element screenshots time out while Cesium animates). Test `http://localhost:4321/rs-knowledge/...` from `npm run preview`; a parallel `dist-x/` must be served by a small static server that strips the `/rs-knowledge` prefix. Islands hydrate `client:visible`, so scroll each figure/quiz into view before asserting. Every globe exposes its Cesium viewer as `document.querySelector('.stage.globe .stage-map').viewer` for camera/frame-rate checks (swiftshader runs ~18 fps; real GPUs are far faster).

### Earth Engine data notes

- Cloud Score+ collection id is `GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED` (link with `.linkCollection(cs, ['cs_cdf'])`).
- `S2_SR_HARMONIZED`: reflectance = DN / 10000 (baseline offset already removed). Landsat C2 L2: DN × 0.0000275 − 0.2. MOD09: × 0.0001.
- Hanoi is very cloudy in late winter–spring: no clear Landsat scene Jan–Apr 2024; MODIS picked by `state_1km` clear ≥ 95 % and SensorZenith ≤ 30°.
- Sentinel-1 over the Hanoi frame: 2024-02-12 relative orbit 128 ASC (same day as the S2 scene); Typhoon Yagi pair 2024-08-31 / 2024-09-12, orbit 91 DESC. Only S1A was operating in 2023–2024 (12-day repeat per orbit). Average σ0 in linear power, then convert to dB.

## Architecture

- **Chapters and numbering**: one MDX file per chapter per language: `src/content/chapters/<lang>/<slug>.mdx` (collection in `src/content.config.ts`; entry id = `<lang>/<slug>`). A chapter is "ready" iff its MDX exists. The roadmap (order, part, ribbon `short` label) is `src/data/chapters.ts`; the display number `n` is the array position. Slugs are stable ids:
  - Part A, satellites & positioning: 1 `ch01-overview`, 2 `ch02-orbits`, 3 `launch`, 4 `satellite-bus`, 5 `signals`, 6 `constellations`, 7 `gnss`.
  - Part B, remote sensing: 8–17 = `ch03-physics` … `ch12-dem`.
  - Part C, applications & reference: 18–21 = `ch13-vietnam` … `ch16-reference`.
  - The `chNN` prefix is historical. The same id prefixes data, quiz, glossary, lab and script file names, so never infer the display number from a file name: look it up in `CHAPTERS` by slug (`LabIndex`, `RefList`, `FormulaTable` and `CaseMap` do).
  - Numbers in prose (`## 8.1`, `Hình 8.2`, "Chương 11", "mục 18.3", `Lab 8`) are written out. Inserting a chapter means renumbering them with a one-off regex over MDX, quiz, glossary, islands, labs and `build_lab_*`. Skip lines citing the source handbook, whose own chapter numbers must not change.
- **Routes**: `src/pages/[lang]/[slug].astro` (chapter header with mono kicker, objectives, prev/next nav, right-hand TOC), home `[lang]/index.astro`, `glossary`, `search`. `/` meta-refreshes to `/vi/`.
- **Navigation**: `src/components/AppBar.astro` = sticky app bar + Office-style ribbon (tabs Part A/B/C, Reference, View; chapter buttons with mono numbers; ARIA tabs with arrow-key roving focus, script in `Base.astro`). The ribbon scrolls away with the page. A tab click while scrolled pins it (`.ribbon.open` is `position: sticky`, so no layout shift). There is no left sidebar. The right column is the chapter TOC, which highlights the section being read. Depth levels, Present mode and theme live in the View tab.
- **i18n**: UI strings in `src/i18n/ui.ts` (`t(lang, key)`); internal links must go through `url()` so the base path is applied. Astro components get the language from the URL via `langFromUrl(Astro.url)`; React islands receive `lang` as a prop and keep their own `TXT = { vi, en }` objects.
- **Depth levels**: `<Depth level="advanced|ref">` in MDX. CSS on `html[data-depth]` (basic/advanced/ref) hides blocks; Reference mode keeps only `h2` + `.depth-ref` blocks. Presentation mode = `html[data-present]`, arrow keys jump between `h2`s (handled in `src/layouts/Base.astro`).
- **Glossary and quiz**: one glossary file per chapter in `src/data/glossary/<id>.json` (`core.json` holds the ch04/ch06 terms), merged by `src/data/glossary.ts`, which throws on duplicate ids (check all files before adding one). `<Term id="…">` renders a native `popover` (no JS) and throws at build if the id is missing. Quizzes live in `src/data/quiz/<id>.json`, imported by each MDX and rendered by `Quiz.tsx`.
- **Design system** (learned from the source handbook: calm, airy, one signal colour; user asked for "clean, full-width, easy to learn"):
  - Colours: light grey page `--bg`, white cards, teal `--primary` for links, active state and key notes, ochre `--accent` for mono labels and predictions. Dark theme redefines every token.
  - Type: Chakra Petch for h1/h2/figure titles, Be Vietnam Pro body, JetBrains Mono labels (`.mono-label`).
  - Islands must use tokens, never hard-coded dark-theme hex, so figures work in both themes. Chart colours `--chart-1…6`, text `--fg`/`--fg-muted`/`--fg-3`, lines `--border`, instrument tokens `--st-*`. In SVG use `style={{ fill: 'var(--x)' }}`; for canvas read tokens with `getComputedStyle`. Data colours with meaning (class colours, Okabe-Ito, ramps, imagery) stay fixed.
  - Content blocks:
    - `<Figure title="Hình n.k — …">`: grey header, the "Hình n.k" part becomes a mono tag, light body.
    - `<Note kind="key|tip|example|why|warn">`.
    - `<Tiles items={[{t,d}]} sum note />`: soft-colour concept boxes.
    - `<Predict client:visible lang title q options|slider answer tol why />`: "Đoán trước", the reader guesses before reading on.
    - `<LabLinks notebook gee? />`, `<Depth>`, `.worked`.
    - `<Formula label tex where />`: KaTeX rendered at build time (no client JS); `<M tex />` is the inline version. `tex` and `where` MUST be plain attribute strings (`"…"`), never `{…}`, because JS string escapes eat the backslashes. `where` = one symbol per line, `TeX :: description`. The old `<p class="formula">` is legacy.
    - `<Stats items={[{v,u,l}]} />`: 2–4 headline numbers. `<Steps items={[{tag,t,d}]} />`: a numbered sequence (flight timeline, pipeline, mission phases).
    - `<Note kind="myth">` (violet) states a common misconception, then the correction.
    - Inline: `**bold**` for a key term at first use; `<mark>` (ochre) or `<mark class="key">` (teal) for the one sentence per section to remember. Use at most one per section.
    - Class-name collision: `key` is used by the chart legend (`span.key` in `VizUi`), `.note.key` and `mark.key`. Always scope `.key` rules by element or parent; a bare `.key` rule once squeezed every key Note into a flex row.
  - Section numbers in `## 8.1 Title` are styled by the `H2`/`H3` MDX overrides (`SecHeading.astro`).
- **Interactive figures**: React islands in `src/islands/`, hydrated with `client:visible`, wrapped in `<Figure title try source>`. All raster figures share ONE download via `loadScene()` in `cube.ts`:
  - `public/data/hanoi-s2/bands.u16z` is gzip'd uint16 BSQ reflectance ×10000 (512×512×10 bands, metadata in `meta.json`, reference spectra in `reference.json`), decompressed with `DecompressionStream`. The `.u16z` extension is deliberate so servers don't add `Content-Encoding`.
  - Other products on the same footprint (`public/data/res-*`, Landsat/MODIS, common band names `red`/`nir`/…) load via `loadProduct(dir)`. Every grid shares the S2 cube's UTM upper-left corner; `toDisplayGrid()` maps them onto the 512×512 @10 m display grid by nearest neighbour. `S2_COMMON` maps common names to S2 bands.
- **Simulated vs real**: figures that derive coarser/fewer-band/fewer-bit data from the S2 cube (aggregation, band subsets, quantisation, linear mixing) must say "simulated" in their `source`; only `res-*` products are real other-sensor data, and their acquisition dates differ from the S2 scene.
- **Map and globe stages** (dark; user requirement: "interactive maps, pro information design like the original app"):
  - `MapStage.tsx` (MapLibre GL 6, lazy-loaded; worker via `?worker&url`):
    - Dark stage with a basemap toggle: Esri World Imagery + Reference labels, or Esri Light Gray Canvas (base + reference). All keyless. Do NOT use CARTO basemaps: they now stamp "API KEY REQUIRED" on every tile.
    - Raster overlays are image sources on a corner quad (`frameQuad(meta)` from `cube.ts`, inverse UTM in `lib/geo.ts`), drawn with nearest resampling.
    - HTML pin markers; floating HUD (`hud`) top-right and control bar (`bar`) bottom.
    - `onMap(map, ml)` is the escape hatch for GeoJSON layers; `bounds` sets the view when there is no raster (default: Viet Nam). Hover maps to a pixel via `lonLatToPixel`.
  - `GlobeStage.tsx` (CesiumJS 1.146.0 from the jsDelivr CDN, not bundled; Esri imagery; no Ion token):
    - `scene(viewer, Cesium)` builds entities and returns a cleanup. The render loop pauses off-screen.
    - Renders at device pixels (capped at 2×) with 4× MSAA, camera inertia and zoom limits (`MIN_H`/`MAX_H`).
    - Wheel zoom is slowed (`zoomFactor 2`, `inertiaZoom 0.5`; the defaults jumped too far per notch). Every globe also gets +/−/reset buttons (`.globe-ctl`); reset flies back to the camera that `init` set.
    - Cesium's `.cesium-viewer-bottom` credit strip must keep `pointer-events: none`; it once covered the canvas and swallowed every drag and wheel event.
    - Large point sets (Starlink) use a `PointPrimitiveCollection` updated on a timer, not entities.
  - Orbit maths: `lib/orbit.ts` (two-body, spherical Earth); `lib/gnss.ts` (GP mean elements, Kepler + J2 node/perigee drift, look angles, DOP), reused by the signals and constellations islands.
  - `VizUi.tsx`: `StatPanel` (HUD key/value rows, tones accent/ok/warn/bad/muted), `Pills`, `Slider`, `Key`.
  - Charts and diagrams without a map use the `.dark-card` layout. The name is historical: it is now a LIGHT card, with the plot left, a `.hud-static` readout box right and `.bar-static` controls below. `--st-*` tokens are light by default and dark only inside `.stage`.
  - On phones, `.dark-card > svg.chart` keeps a 540 px width and scrolls sideways so viewBox text stays readable.
  - Do not use `.viz canvas` for new map figures.
- **Pure math** (testable, no DOM) lives in `src/lib/`, each module with a `.test.ts`:
  - `raster.ts`, `chart.ts`, `sar.ts`, `geo.ts`, `orbit.ts`, …
  - Part A: `launch.ts`, `bus.ts`, `signals.ts`, `constellation.ts`, `gnss.ts`.
  - Canvas helpers are in `src/islands/draw.ts`. Charts are hand-written SVG; `LineChart.tsx` measures its own width so its text stays true-size.
- **Worked examples** (`WorkedExample.astro`) compute from `reference.json` at build time, so numbers in the text and the data cannot drift.

## Conventions that matter

- Every number quoted in chapter prose must come from the exported data or a `*_numbers.ts` script (don't estimate). Facts about missions and launches need a cited source; drop what cannot be verified. Interpretations not backed by ground truth, and illustrative presets, are labelled as such.
- Figures: fixed −1…+1 scale for indices, disclose stretch (2–98 %), Okabe-Ito/BrBG/viridis palettes with shape/dash redundancy, data table in `<details>`, provenance (incl. snapshot date) in the Figure `source`. Never connect time-series points across gaps > 40 days.
- Sovereignty: every MapStage shows Viet Nam's labels (`SOVEREIGN` in `MapStage.tsx`). Full names show at zoom 4–9. Below zoom 4 the labels shorten to "Hoàng Sa (Việt Nam)" / "Trường Sa (Việt Nam)" and the sea label is hidden. National views use bounds that include both archipelagos, and globes that label places include Hoàng Sa / Trường Sa.
- Imagery attribution "Contains modified Copernicus Sentinel data" must stay in the footer/sources. Footer (`Base.astro`): line 1 = "© 2026 Trần Anh Quân · quantrananh.humg@gmail.com (mailto) · Trang chủ của tác giả / Author's homepage" linking to `http://remosat.usth.edu.vn/~quanta/`; line 2 = `t('footer')` (imagery attribution only) · Glossary. The CC BY 4.0 source handbook that parts of Part A were developed from is credited in exactly ONE place, the note under `<RefList />` in `ch16-reference.mdx` (vi + en); the user asked for no other mention (no chapter intros, reference-list entries, figure sources or footer text). That single credit is what keeps the site within CC BY 4.0: do not remove it.
- New chapter checklist:
  1. Add the chapter to `CHAPTERS` and write the vi + en MDX.
  2. Add `src/data/quiz/<id>.json` and `src/data/glossary/<id>.json` (unique ids).
  3. Write the data script under `scripts/data/` and a numbers script.
  4. Write the lab generator `scripts/build_lab_<id>.py`. The lab stem must start with the slug's first token so `LabIndex` finds it. Add a `labs/<stem>.js` GEE script only when the chapter uses Earth Engine. Run it with `--run`.
  5. Give 2–3 `<Predict>` and a key `<Note>` per section.
  6. Run a Playwright check of every figure: vi/en, light/dark, 1600 and 390 px.
  7. Finish with a `code-reviewer` pass.
- Commits/pushes only when the user asks. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `.gitattributes` forces LF and marks `*.u16z` binary.

## Status (2026-11-13: deployed)

- Live on both hosts, last commit `9e64137` (GitHub Pages redeploys on every push to `main`; the homepage copy was uploaded from the same commit).
- 21 chapters in vi + en (49 pages). 161/161 unit tests; type check clean. Part A chapters 1–7 cover every section of the source handbook (2–3× longer, a hero stage figure at the top of each chapter, ~50 new islands). Part B/C got an emphasis pass (Formula/Note/Stats/Steps), no new facts.
- Site-wide smoke: 21 chapters × vi/en × 1440/390 px. No console errors, no horizontal overflow, no figure stuck loading.
- Code review of the new Part A islands: the one HIGH (ConstellationGlobe empty-median crash) and the MEDIUM items are fixed. Not fixed (minor): GnssTrilat/GnssSkyDop sliders lack aria-valuenow/min/max.
- Branding: satellite logo in `AppBar.astro` and `public/favicon.svg` (same SVG paths). Home hero: the Sentinel-1 inset sits top-left (`.hero-shot .inset { top }`); anchoring it to the bottom covered the caption.
- Known gaps:
  - Lab notebooks were not updated for the new Part A sections (they still run).
  - Not verified against a primary source: Sentinel-2 X-band rate (560 Mbit/s per eoPortal; no ESA mission document found), SMAD efficiencies/coating α/ε/Isp ranges (textbook typical values), FCC 2022 document title, the GPS SPS PS 2020 PDF (gone from gps.gov), Cục Tần số vô tuyến điện's parent ministry. DVB-S2 thresholds ARE verified (ETSI EN 302 307-1 Table 13).
  - `ch01-satnow.json` Starlink subset was patched once by hand after a CelesTrak 403; `export_ch01_satnow.py` is fixed but not re-run (re-running changes the numbers quoted in Chapter 1: re-run `scripts/ch01_numbers.ts` and update the prose).
  - On 390 px phones three formulas (ch09-classification, ch12-dem Horn/slope) scroll 10–31 px inside their card.
  - The GEE JS scripts `labs/*.js` in the Code Editor; globe frame rates (Starlink 11k, SatNow 17k points) on a real GPU.
  - The home page of the author's site (`index.html` "Recent maps and apps" mosaic, 4 tiles) does not list the app; adding it means replacing a tile, which the user has not decided.
