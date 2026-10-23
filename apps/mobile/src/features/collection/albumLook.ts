import type { CollectionState } from '@fm/shared';

export type AlbumSummary = CollectionState['albums'][number];

/** Small stable string hash (FNV-1a), so colours and tilts never change between renders. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

export interface AlbumColors {
  /** Main cover colour. */
  base: string;
  /** Lighter top of the cover gradient. */
  light: string;
  /** Darker bottom of the cover / the spine. */
  dark: string;
  /** Very dark shade for the spine binding. */
  deep: string;
}

/** Each album gets its own cover colour, derived from its slug. */
export function albumColors(slug: string): AlbumColors {
  const h = hashString(slug);
  const hue = h % 360;
  const sat = 62 + ((h >>> 9) % 18);
  return {
    base: hslToHex(hue, sat, 46),
    light: hslToHex(hue, sat, 58),
    dark: hslToHex(hue, sat, 32),
    deep: hslToHex(hue, sat, 20),
  };
}

/** A small, stable "stuck on by hand" tilt in degrees (-3..3) for a sticker. */
export function stickerTilt(id: string): number {
  return ((hashString(id) % 61) - 30) / 10;
}

function shelfRank(a: AlbumSummary): number {
  const full = a.owned >= a.total && a.total > 0;
  if (full && !a.claimed) return 0; // reward waiting
  if (a.owned > 0 && !full) return 1; // in progress
  if (a.owned === 0) return 2; // not started
  return 3; // complete and claimed
}

/** Reward waiting first, then in progress (most-complete first), then not started, then finished. */
export function sortAlbums(albums: readonly AlbumSummary[]): AlbumSummary[] {
  return albums
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const r = shelfRank(x.a) - shelfRank(y.a);
      if (r !== 0) return r;
      if (shelfRank(x.a) === 1) {
        const p = y.a.owned / Math.max(1, y.a.total) - x.a.owned / Math.max(1, x.a.total);
        if (p !== 0) return p;
      }
      return x.i - y.i;
    })
    .map((x) => x.a);
}

/** Cover art: the album's last (usually rarest) sticker. */
export function coverKey(slug: string): string {
  return `${slug}_12`;
}
