import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Lang } from '../i18n/ui';

// CesiumJS is loaded from the CDN (6 MB + workers) only when a globe figure scrolls into view.
const CESIUM = 'https://cdn.jsdelivr.net/npm/cesium@1.146.0/Build/Cesium/';
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';

// ponytail: Cesium ships no types without the 150 MB npm package; the globe code is small and visual-tested.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Cs = any;
declare global { interface Window { Cesium?: Cs; CESIUM_BASE_URL?: string } }

let loading: Promise<Cs> | null = null;
const loadCesium = (): Promise<Cs> => (loading ??= new Promise<Cs>((ok, fail) => {
  if (window.Cesium) return ok(window.Cesium);
  window.CESIUM_BASE_URL = CESIUM;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = `${CESIUM}Widgets/widgets.css`;
  document.head.append(css);
  const s = document.createElement('script');
  s.src = `${CESIUM}Cesium.js`; s.async = true;
  s.onload = () => ok(window.Cesium);
  s.onerror = () => { loading = null; fail(new Error('Cesium failed to load')); };
  document.head.append(s);
}));

const TXT = {
  vi: { loading: 'Đang tải quả địa cầu 3D…', fail: 'Không tải được quả địa cầu (cần WebGL và kết nối mạng).', hint: 'Kéo để xoay · cuộn để phóng to' },
  en: { loading: 'Loading 3D globe…', fail: 'Could not load the globe (needs WebGL and a network connection).', hint: 'Drag to rotate · scroll to zoom' },
};

type Props = {
  lang: Lang; label: string; height?: number; hud?: ReactNode; bar?: ReactNode;
  /** Build the scene; return a cleanup. Called again whenever `deps` change. */
  scene: (viewer: Cs, C: Cs) => (() => void) | void;
  deps: unknown[];
  /** Called once after the viewer exists (camera placement). */
  init?: (viewer: Cs, C: Cs) => void;
};

/** Dark stage with a CesiumJS globe (Esri World Imagery, no Ion token), floating HUD and control bar. */
export default function GlobeStage({ lang, label, height = 560, hud, bar, scene, deps, init }: Props) {
  const T = TXT[lang];
  const el = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<Cs>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let v: Cs = null, dead = false, io: IntersectionObserver | null = null;
    loadCesium().then((C) => {
      if (dead || !el.current) return;
      C.Ion.defaultAccessToken = '';
      v = new C.Viewer(el.current, {
        baseLayer: new C.ImageryLayer(new C.UrlTemplateImageryProvider({
          url: `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`, maximumLevel: 18,
          credit: new C.Credit('Imagery © Esri, Maxar, Earthstar Geographics') })),
        animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false, sceneModePicker: false,
        navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
        shouldAnimate: true, requestRenderMode: false,
      });
      v.scene.globe.baseColor = C.Color.fromCssColorString('#1b2a44');
      v.scene.skyAtmosphere.show = true;
      init?.(v, C);
      // stop the render loop while the globe is off-screen (battery, and other WebGL figures on the page)
      io = new IntersectionObserver(([e]) => { if (!v.isDestroyed()) v.useDefaultRenderLoop = e.isIntersecting; });
      io.observe(el.current);
      setViewer(v);
    }).catch(() => !dead && setFailed(true)); // also catches WebGL errors thrown by new Viewer()
    return () => { dead = true; io?.disconnect(); if (v && !v.isDestroyed()) v.destroy(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- viewer is created once

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    return scene(viewer, window.Cesium) ?? undefined;
  }, [viewer, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stage globe" style={{ ['--stage-h' as string]: `${height}px` }}>
      <div ref={el} className="stage-map" role="region" aria-label={label} />
      {!viewer && <p className="stage-status" aria-live="polite">{failed ? T.fail : T.loading}</p>}
      {viewer && <p className="stage-hint" aria-hidden="true">{T.hint}</p>}
      {hud && <div className="hud">{hud}</div>}
      {bar && <div className="stage-bar">{bar}</div>}
    </div>
  );
}
