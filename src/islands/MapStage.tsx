import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Map as MlMap, ImageSource, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite bundles the worker separately; MapLibre's default lookup (next to its own module) breaks after bundling.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { Lang } from '../i18n/ui';
import type { Quad } from '../lib/geo';

/** Raster overlay drawn pixel-exact on its corner quad (defaults to the stage's `quad`). */
export type Overlay = { id: string; image: ImageData | HTMLCanvasElement | null; opacity?: number; visible?: boolean; quad?: Quad };
export type Bounds = [[number, number], [number, number]];
export type Marker = { id: string; lon: number; lat: number; label: string; color: string };
type Basemap = 'imagery' | 'map';

// Tile services that need no API key. Attribution is shown in the map corner.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    imagery: { type: 'raster', tiles: [`${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
    labels: { type: 'raster', tiles: [`${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 19 },
    // "map" mode: Esri Light Gray Canvas (keyless, like the imagery). CARTO's basemaps now stamp "API KEY REQUIRED" on every tile.
    gray: { type: 'raster', tiles: [`${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 16,
      attribution: 'Esri, HERE, Garmin, © OpenStreetMap contributors' },
    grayRef: { type: 'raster', tiles: [`${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`], tileSize: 256, maxzoom: 16 },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0b1220' } },
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'gray', type: 'raster', source: 'gray', layout: { visibility: 'none' } },
    { id: 'grayRef', type: 'raster', source: 'grayRef', layout: { visibility: 'none' } },
    { id: 'labels', type: 'raster', source: 'labels', paint: { 'raster-opacity': 0.85 } },
  ],
};

const SOVEREIGN: { lon: number; lat: number; sea?: boolean; name: Record<Lang, string>; short: Record<Lang, string> }[] = [
  { lon: 112.0, lat: 16.5, name: { vi: 'Quần đảo Hoàng Sa (Việt Nam)', en: 'Hoang Sa archipelago (Viet Nam)' }, short: { vi: 'Hoàng Sa (Việt Nam)', en: 'Hoang Sa (Viet Nam)' } },
  { lon: 114.3, lat: 10.0, name: { vi: 'Quần đảo Trường Sa (Việt Nam)', en: 'Truong Sa archipelago (Viet Nam)' }, short: { vi: 'Trường Sa (Việt Nam)', en: 'Truong Sa (Viet Nam)' } },
  { lon: 113.0, lat: 13.5, sea: true, name: { vi: 'Biển Đông', en: 'East Sea' }, short: { vi: 'Biển Đông', en: 'East Sea' } },
];
const SOV_FULL_ZOOM = 4; // below this (world/region views) the full names collide: short names, no sea label

const GESTURE = {
  vi: { 'CooperativeGesturesHandler.WindowsHelpText': 'Giữ Ctrl và cuộn chuột để phóng to/thu nhỏ bản đồ',
        'CooperativeGesturesHandler.MacHelpText': 'Giữ ⌘ và cuộn để phóng to/thu nhỏ bản đồ',
        'CooperativeGesturesHandler.MobileHelpText': 'Dùng hai ngón tay để di chuyển bản đồ' },
  en: {},
};

const TXT = {
  vi: { imagery: 'Ảnh vệ tinh', map: 'Bản đồ', base: 'Bản đồ nền', loading: 'Đang tải bản đồ…', reset: 'Về khung ảnh', fail: 'Không tải được bản đồ' },
  en: { imagery: 'Imagery', map: 'Map', base: 'Basemap', loading: 'Loading map…', reset: 'Back to frame', fail: 'Map failed to load' },
};

type Props = {
  lang: Lang; label: string;
  /** Default overlay frame; also the initial view unless `bounds` is given. */
  quad?: Quad; bounds?: Bounds; overlays?: Overlay[];
  hud?: ReactNode; bar?: ReactNode; markers?: Marker[]; height?: number;
  onHover?: (p: { lon: number; lat: number } | null) => void;
  onClick?: (p: { lon: number; lat: number }) => void;
  /** Escape hatch for vector layers etc.: called once the map is ready with the map and the maplibre module; may return a cleanup. */
  onMap?: (map: MlMap, ml: typeof import('maplibre-gl')) => void | (() => void);
};

const boundsOf = (q: Quad): Bounds => [
  [Math.min(...q.map((c) => c[0])), Math.min(...q.map((c) => c[1]))],
  [Math.max(...q.map((c) => c[0])), Math.max(...q.map((c) => c[1]))],
];

/**
 * A dark "stage": interactive web map with raster overlays drawn pixel-exact (nearest resampling)
 * on the UTM frame's corner quad, a floating HUD panel (top right) and a control bar (bottom).
 */
export default function MapStage({ lang, label, quad, bounds, overlays = [], hud, bar, markers = [], height = 520, onHover, onClick, onMap }: Props) {
  const view: Bounds = bounds ?? (quad ? boundsOf(quad) : [[102, 7.5], [117.5, 23.6]]); // default: Viet Nam incl. Hoang Sa & Truong Sa
  const T = TXT[lang];
  const el = useRef<HTMLDivElement>(null);
  // keep the frame clear of the floating HUD (right) and control bar (bottom) on wide screens
  const padFor = (c: HTMLElement) => (c.clientWidth > 720
    ? { top: 24, left: 24, right: hud ? Math.min(330, c.clientWidth * 0.46) + 16 : 24, bottom: bar ? 96 : 24 } : 16);
  const map = useRef<MlMap | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [base, setBase] = useState<Basemap>('imagery');
  const cb = useRef({ onHover, onClick });
  cb.current = { onHover, onClick };

  const undoMap = useRef<void | (() => void)>(undefined);
  useEffect(() => {
    let dead = false;
    import('maplibre-gl').then(({ Map, NavigationControl, ScaleControl, AttributionControl, setWorkerUrl }) => {
      if (dead || !el.current) return;
      setWorkerUrl(workerUrl);
      const m = new Map({ container: el.current, style: STYLE, bounds: view, fitBoundsOptions: { padding: padFor(el.current) },
        attributionControl: false, dragRotate: false, pitchWithRotate: false, cooperativeGestures: true, locale: GESTURE[lang] });
      map.current = m; // assign first so cleanup can remove a half-built map
      m.addControl(new NavigationControl({ showCompass: false }), 'top-left');
      m.addControl(new ScaleControl({ unit: 'metric' }), 'top-left');
      m.addControl(new AttributionControl({ compact: true }), 'bottom-right');
      // the style is inline, so overlays can go on as soon as it is parsed (do not wait for basemap tiles)
      const onStyle = () => { if (!dead) setReady(true); };
      if (m.isStyleLoaded()) onStyle(); else m.once('style.load', onStyle);
      m.on('mousemove', (e) => cb.current.onHover?.({ lon: e.lngLat.lng, lat: e.lngLat.lat }));
      m.on('mouseout', () => cb.current.onHover?.(null));
      m.on('click', (e) => cb.current.onClick?.({ lon: e.lngLat.lng, lat: e.lngLat.lat }));
    }).catch(() => !dead && setFailed(true)); // also catches WebGL init errors thrown by new Map()
    return () => {
      dead = true;
      undoMap.current?.(); // custom layers first, while the map still exists
      map.current?.remove(); map.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- the frame (quad) is fixed per figure

  // overlays: add once, then push new pixels (only when the image object changed) / quad / opacity / visibility
  const pushed = useRef(new Map<string, { image: unknown; quad: Quad }>());
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    for (const o of overlays) {
      const sid = `ov-${o.id}`;
      const q = o.quad ?? quad;
      if (!o.image || !q) {
        if (m.getLayer(sid)) m.setLayoutProperty(sid, 'visibility', 'none');
        continue;
      }
      const src = m.getSource(sid) as ImageSource | undefined;
      const last = pushed.current.get(sid);
      if (!src) {
        m.addSource(sid, { type: 'image', coordinates: q } as never); // empty image source, fed below
        (m.getSource(sid) as ImageSource).updateImage({ image: o.image });
        m.addLayer({ id: sid, type: 'raster', source: sid, paint: { 'raster-resampling': 'nearest', 'raster-fade-duration': 0 } }, 'labels');
      } else if (last?.image !== o.image || last?.quad !== q) {
        src.updateImage({ image: o.image, coordinates: q });
      }
      pushed.current.set(sid, { image: o.image, quad: q });
      m.setPaintProperty(sid, 'raster-opacity', o.opacity ?? 1);
      m.setLayoutProperty(sid, 'visibility', o.visible === false ? 'none' : 'visible');
    }
  }, [ready, overlays, quad]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !onMap) return;
    let live = true;
    import('maplibre-gl').then((ml) => { if (live) undoMap.current = onMap(m, ml); });
    return () => { live = false; };
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps -- run once; keep layer updates inside the callback

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    m.setLayoutProperty('imagery', 'visibility', base === 'imagery' ? 'visible' : 'none');
    m.setLayoutProperty('gray', 'visibility', base === 'map' ? 'visible' : 'none');
    m.setLayoutProperty('grayRef', 'visibility', base === 'map' ? 'visible' : 'none');
    m.setLayoutProperty('labels', 'visibility', base === 'imagery' ? 'visible' : 'none');
  }, [ready, base]);

  // Viet Nam's archipelagos and sea names on every map (the raster basemap labels use other names);
  // shown only at small scales, where they are in view anyway.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    let live = true;
    const made: { remove: () => void }[] = [];
    const show = () => {
      const z = m.getZoom();
      made.forEach((x, i) => {
        const el = (x as unknown as { getElement: () => HTMLElement }).getElement(), s = SOVEREIGN[i];
        el.style.display = z >= 9 || (s.sea && z < SOV_FULL_ZOOM) ? 'none' : '';
        el.textContent = (z < SOV_FULL_ZOOM ? s.short : s.name)[lang];
      });
    };
    import('maplibre-gl').then(({ Marker }) => {
      if (!live) return;
      for (const s of SOVEREIGN) {
        const div = document.createElement('div');
        div.className = `map-sov${s.sea ? ' sea' : ''}`;
        div.textContent = s.name[lang];
        made.push(new Marker({ element: div, anchor: 'center' }).setLngLat([s.lon, s.lat]).addTo(m));
      }
      show();
      m.on('zoomend', show);
    });
    return () => { live = false; m.off('zoomend', show); made.forEach((x) => x.remove()); };
  }, [ready, lang]);

  // markers: small HTML elements (dot + label) so labels need no glyph server
  const markerKey = markers.map((k) => `${k.id}:${k.lon}:${k.lat}:${k.label}`).join('|');
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !markers.length) return;
    let live = true;
    const made: { remove: () => void }[] = [];
    import('maplibre-gl').then(({ Marker }) => {
      if (!live) return;
      for (const k of markers) {
        const div = document.createElement('div');
        div.className = 'map-pin';
        div.innerHTML = '<i></i><span></span>';
        (div.firstChild as HTMLElement).style.background = k.color;
        (div.lastChild as HTMLElement).textContent = k.label;
        made.push(new Marker({ element: div, anchor: 'left', offset: [-6, 0] }).setLngLat([k.lon, k.lat]).addTo(m));
      }
    });
    return () => { live = false; made.forEach((x) => x.remove()); };
  }, [ready, markerKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stage" data-base={base} style={{ ['--stage-h' as string]: `${height}px` }}>
      <div ref={el} className="stage-map" role="region" aria-label={label} />
      {!ready && <p className="stage-status" aria-live="polite">{failed ? T.fail : T.loading}</p>}
      <div className="stage-tl">
        <div className="pills" role="group" aria-label={T.base}>
          {(['imagery', 'map'] as Basemap[]).map((b) => <button key={b} type="button" aria-pressed={base === b} onClick={() => setBase(b)}>{T[b]}</button>)}
        </div>
        <button type="button" className="pill-btn" onClick={() => el.current && map.current?.fitBounds(view, { padding: padFor(el.current) })}>{T.reset}</button>
      </div>
      {hud && <div className="hud">{hud}</div>}
      {bar && <div className="stage-bar">{bar}</div>}
    </div>
  );
}
