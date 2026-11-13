// Shared constants for the Chapter 5 (signals) figures and scripts/signals_numbers.ts.
import type { LinkIn } from '../lib/signals.ts';

/** Ground stations. Hà Nội / TP.HCM are city-centre coordinates (no verified public coordinates of a national EO station are used). */
export const STATIONS = {
  hn: { lat: 21.03, lon: 105.85, name: { vi: 'Hà Nội', en: 'Hanoi' } },
  hcm: { lat: 10.78, lon: 106.70, name: { vi: 'TP.HCM', en: 'Ho Chi Minh City' } },
  svalbard: { lat: 78.23, lon: 15.39, name: { vi: 'Svalbard (Na Uy)', en: 'Svalbard (Norway)' } },
};
export type StationKey = keyof typeof STATIONS;

/** Start of the 24-hour window for passes: midnight UTC on the CelesTrak snapshot day (public/data/ch01-missions.json). */
export const T0 = Date.parse('2026-11-04T00:00:00Z');

/**
 * Downlink rate assumed per satellite family for daily data volume (Mbit/s). Sentinel-2: 560 (ESA eoPortal; other secondary
 * sources give 520). Landsat 8/9: 384 (USGS). VNREDSat-1: no public figure, 100 is illustrative.
 */
export const DOWNLINK_MBPS = (name: string): number => (name.startsWith('Sentinel-2') ? 560 : name.startsWith('Landsat') ? 384 : 100);

/** European Data Relay System optical inter-satellite link rate (Mbit/s), Airbus/ESA. */
export const EDRS_MBPS = 1800;

/** Required Eb/N0 references (dB): uncoded QPSK at BER 1e-5, DVB-S2 QPSK 3/4 (ETSI EN 302 307 quasi-error-free), Shannon limit ln 2. */
export const REQ = { qpsk: 9.6, dvbs2: 2.3, shannon: -1.6 } as const;
export type ReqKey = keyof typeof REQ;

/**
 * Illustrative link presets (typical orders of magnitude, NOT the published parameters of a real satellite).
 * Distance comes from altitude + elevation.
 */
export type PresetKey = 'x' | 's' | 'ku' | 'ka';
export const PRESETS: Record<PresetKey, { altKm: number; elDeg: number; link: Omit<LinkIn, 'dKm'> }> = {
  x: { altKm: 786, elDeg: 10, link: { fHz: 8.1e9, ptW: 10, gtDbi: 6, rxDiamM: 5.4, eff: 0.6, tsysK: 200, rateBps: 560e6, rainDb: 0, otherDb: 3, reqEbN0Db: REQ.dvbs2 } },
  s: { altKm: 786, elDeg: 5, link: { fHz: 2.2e9, ptW: 2, gtDbi: 0, rxDiamM: 5.4, eff: 0.6, tsysK: 250, rateBps: 64e3, rainDb: 0, otherDb: 3, reqEbN0Db: REQ.qpsk } },
  ku: { altKm: 35786, elDeg: 51.5, link: { fHz: 12e9, ptW: 100, gtDbi: 32, rxDiamM: 0.6, eff: 0.65, tsysK: 120, rateBps: 40e6, rainDb: 0, otherDb: 1.5, reqEbN0Db: REQ.dvbs2 } },
  ka: { altKm: 35786, elDeg: 51.5, link: { fHz: 20e9, ptW: 50, gtDbi: 45, rxDiamM: 0.75, eff: 0.6, tsysK: 200, rateBps: 100e6, rainDb: 0, otherDb: 1.5, reqEbN0Db: REQ.dvbs2 } },
};
