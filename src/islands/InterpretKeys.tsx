import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MlMap } from 'maplibre-gl';
import type { Lang } from '../i18n/ui';
import { compose, PRESETS, SCENES, useCh08Scene } from './ch08scenes';
import { KEYS } from './ch08keys';
import MapStage from './MapStage';
import { Pills, StatPanel } from './VizUi';

const TXT = {
  vi: { loading: 'Đang tải cảnh…', key: 'Yếu tố giải đoán', scene: 'Cảnh', comp: 'Tổ hợp', ev: 'Số đo 3×3 pixel tại ghim', label: 'Bản đồ minh họa các yếu tố giải đoán ảnh' },
  en: { loading: 'Loading scene…', key: 'Interpretation key', scene: 'Scene', comp: 'Composite', ev: '3×3 pixel measurements at the pin', label: 'Map illustrating the image interpretation keys' },
};

export default function InterpretKeys({ lang }: { lang: Lang }) {
  const T = TXT[lang];
  const [kid, setKid] = useState(KEYS[0].id);
  const k = KEYS.find((x) => x.id === kid)!;
  const { scene, error } = useCh08Scene(k.scene);
  const preset = PRESETS.find((p) => p.id === k.preset)!;
  const ok = scene?.id === k.scene;
  const comp = useMemo(() => (scene && ok ? compose(scene, preset.rgb) : null), [scene, ok, preset]);
  const overlays = useMemo(() => [{ id: 'key', image: comp?.img ?? null }], [comp]);
  const map = useRef<MlMap | null>(null);
  const pin = ok && scene ? scene.lonlat(k.row, k.col) : null;
  const go = (m: MlMap | null) => pin && m?.flyTo({ center: pin, zoom: k.zoom, duration: 900 });
  const markers = useMemo(() => (pin ? [{ id: k.id, lon: pin[0], lat: pin[1], label: k.name[lang], color: '#4fc3cd' }] : []), [pin?.[0], pin?.[1], k, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  // fly when the key changes within the same scene (a new scene remounts the map and jumps in onMap)
  useEffect(() => { go(map.current); }, [kid, ok]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="viz status" role="alert">Error: {error}</p>;
  if (!scene || !ok || !comp) return <p className="viz status" aria-live="polite">{T.loading}</p>;

  const loc = lang === 'vi' ? 'vi-VN' : 'en-US';
  const nf = (v: number) => v.toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const m3 = (b: string) => { let s = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) s += scene.bands[b][(k.row + dr) * scene.w + k.col + dc]; return s / 9; };
  const ndi = (a: string, b: string) => (m3(a) - m3(b)) / (m3(a) + m3(b));

  const hud = (
    <StatPanel title={`${k.name[lang]} · ${SCENES.find((s) => s.id === k.scene)?.name[lang]}`} rows={[
      { k: T.comp, v: preset.name[lang], tone: 'muted' },
      { k: 'NDVI', v: nf(ndi('B8', 'B4')), tone: 'ok' },
      { k: 'MNDWI', v: nf(ndi('B3', 'B11')), tone: 'accent' },
      { k: lang === 'vi' ? 'Độ sáng (B2+B3+B4)/3' : 'Brightness (B2+B3+B4)/3', v: nf((m3('B2') + m3('B3') + m3('B4')) / 3), tone: 'warn' },
    ]}>
      <p style={{ margin: '10px 0 0', font: '0.86rem/1.5 var(--font-body)', color: '#e2e8f0' }}>{k.text[lang]}</p>
      <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.72rem' }}>{T.ev}</p>
    </StatPanel>
  );
  const bar = <Pills label={T.key} value={kid} onChange={(v) => { setKid(v); }} options={KEYS.map((x, i) => ({ v: x.id, label: `${i + 1}. ${x.name[lang]}` }))} />;

  return (
    <MapStage key={scene.date} lang={lang} label={`${T.label}: ${k.name[lang]}`} quad={scene.quad} overlays={overlays} hud={hud} bar={bar} markers={markers} height={660}
      onMap={(m) => { map.current = m; m.jumpTo({ center: pin!, zoom: k.zoom }); return () => { map.current = null; }; }} />
  );
}
