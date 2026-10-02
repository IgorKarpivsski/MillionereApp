/**
 * Color tokens — "floodlit sticker album".
 *
 * Every hue has one job. Don't use a color for decoration:
 *   pitch  = go / correct / primary action
 *   gold   = coins, prizes, the ladder
 *   flare  = streaks, wrong answers, urgency
 *   sky    = gems (premium currency)
 *   night  = surfaces
 */
export const palette = {
  night950: '#0F0B33',
  night900: '#1B1452',
  night800: '#251C6B',
  night700: '#30258A',
  night600: '#4334B0',
  night300: '#9C93D9',
  chalk: '#F7F4FF',
  chalkDim: '#C9C3EE',
  white: '#FFFFFF',

  pitch: '#1FCB7F',
  pitchDeep: '#0E8F57',
  gold: '#FFC93C',
  goldDeep: '#C98A00',
  flare: '#FF5D5D',
  flareDeep: '#C42E3A',
  sky: '#4FD8FF',
  skyDeep: '#1A93BE',
  violet: '#A877FF',
  violetDeep: '#6E3FD0',
} as const;

export const colors = {
  bg: palette.night900,
  bgDeep: palette.night950,
  surface: palette.night800,
  surfaceRaised: palette.night700,
  border: palette.night600,

  text: palette.chalk,
  textMuted: palette.chalkDim,
  textOnBright: palette.night950,

  primary: palette.pitch,
  primaryLip: palette.pitchDeep,
  prize: palette.gold,
  prizeLip: palette.goldDeep,
  danger: palette.flare,
  dangerLip: palette.flareDeep,
  gem: palette.sky,
  gemLip: palette.skyDeep,

  success: palette.pitch,
  error: palette.flare,
  focus: palette.sky,

  sticker: palette.white,
  overlay: 'rgba(15, 11, 51, 0.72)',
} as const;

export const rarityColors = {
  common: { fill: '#8E8AB8', lip: '#5F5B8A', label: 'רגיל' },
  uncommon: { fill: palette.pitch, lip: palette.pitchDeep, label: 'לא שכיח' },
  rare: { fill: palette.sky, lip: palette.skyDeep, label: 'נדיר' },
  epic: { fill: palette.violet, lip: palette.violetDeep, label: 'אפי' },
  legendary: { fill: palette.gold, lip: palette.goldDeep, label: 'אגדי' },
  iconic: { fill: palette.flare, lip: palette.flareDeep, label: 'אייקוני' },
} as const;

export type ColorToken = keyof typeof colors;
export type RarityKey = keyof typeof rarityColors;
