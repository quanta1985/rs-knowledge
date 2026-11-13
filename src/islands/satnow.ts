// Chapter 1: the active-satellite snapshot (public/data/ch01-satnow.json), fetched once and shared by its figures.
import { fromRow } from '../lib/constellation';
import type { Sat } from '../lib/gnss';
import { orbitClass, type OrbitClass } from '../lib/overview';

export type Family = 'nav' | 'weather' | 'eo' | 'science' | 'comms' | 'other';
export const FAMILIES: Family[] = ['comms', 'nav', 'eo', 'weather', 'science', 'other'];
export type Obj = Sat & { cls: OrbitClass; fam: Family; starlink: boolean };
export type Snapshot = { t0: number; retrieved: string; objs: Obj[]; named: Record<string, string> };

// Okabe-Ito: fixed data colours, readable on the dark globe and on light cards
export const CLASS_COLOR: Record<OrbitClass, string> = { LEO: '#56B4E9', MEO: '#009E73', GEO: '#E69F00', HEO: '#CC79A7' };
export const FAMILY_COLOR: Record<Family, string> = { comms: '#56B4E9', nav: '#009E73', eo: '#E69F00', weather: '#F0E442', science: '#CC79A7', other: '#9aa4b2' };

export const FAMILY_NAME: Record<'vi' | 'en', Record<Family, string>> = {
  vi: { comms: 'Viễn thông', nav: 'Định vị (GNSS)', eo: 'Quan sát Trái Đất', weather: 'Khí tượng', science: 'Khoa học, trạm vũ trụ', other: 'Chưa xếp nhóm' },
  en: { comms: 'Communications', nav: 'Navigation (GNSS)', eo: 'Earth observation', weather: 'Meteorology', science: 'Science, stations', other: 'Not grouped' },
};

const URL_DATA = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/ch01-satnow.json`;
let cache: Promise<Snapshot> | null = null;

export const loadSnapshot = (): Promise<Snapshot> => (cache ??= fetch(URL_DATA)
  .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
  .then((j) => {
    const t0 = Date.parse(j.t0), sl = new Set<number>(j.starlink);
    const objs = (j.rows as number[][]).map((r) => {
      const s = fromRow(r.slice(0, 8), t0);
      return { ...s, cls: orbitClass(s.n, s.e), fam: j.families[r[8]] as Family, starlink: sl.has(s.norad) };
    });
    return { t0, retrieved: j.provenance.retrieved as string, objs, named: j.named };
  })
  .catch((e) => { cache = null; throw e; }));
