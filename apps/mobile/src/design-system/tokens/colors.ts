/**
 * Color tokens — "האלוף": a bright trivia game on a deep violet "knowledge night".
 *
 * Every hue has one job. Don't use a color for decoration:
 *   led    = the scoreboard amber: primary action, coins, prizes, the ladder
 *   pitch  = correct answers, goals, "go" states
 *   flare  = wrong answers, streak danger, urgency
 *   sky    = gems (premium currency)
 *   night  = grass-at-night surfaces; `board` is the black LED panel
 *   chalk  = floodlight white (text, the question card)
 *
 * Palette keys keep their old names so every screen picks up the new theme.
 */
export const palette = {
  night950: '#140C33', // deep panel
  night900: '#1E1250', // knowledge-night violet (screen background)
  night800: '#281A63',
  night700: '#322275', // secondary card
  night600: '#45338F', // panel borders
  night300: '#A99CDB', // dim captions
  chalk: '#F7F5FF', // paper white
  chalkDim: '#CFC6F2',
  white: '#FFFFFF',

  pitch: '#3DDC84',
  pitchDeep: '#1E9E5A',
  gold: '#FFB000', // LED amber
  goldDeep: '#B87A00',
  flare: '#FF5A4E',
  flareDeep: '#B8322A',
  sky: '#7FD1FF',
  skyDeep: '#3B95C4',
  violet: '#B49CFF',
  violetDeep: '#7559D6',
} as const;

export const colors = {
  bg: palette.night900,
  bgDeep: palette.night950,
  board: palette.night950,
  surface: palette.night950,
  surfaceRaised: palette.night700,
  border: palette.night600,

  text: palette.chalk,
  textMuted: palette.chalkDim,
  textDim: palette.night300,
  textOnBright: palette.night950,

  /** The LED amber. Primary buttons, coin digits, the active tab. */
  led: palette.gold,
  primary: palette.gold,
  primaryLip: palette.goldDeep,
  prize: palette.gold,
  prizeLip: palette.goldDeep,
  correct: palette.pitch,
  correctFill: '#17533F',
  danger: palette.flare,
  dangerLip: palette.flareDeep,
  gem: palette.sky,
  gemLip: palette.skyDeep,

  success: palette.pitch,
  error: palette.flare,
  focus: palette.sky,

  /** The bright question card ("floodlight"). */
  card: palette.chalk,
  cardText: palette.night950,
  cardMuted: '#6A5F96',

  sticker: palette.chalk,
  overlay: 'rgba(14, 8, 38, 0.8)',
} as const;

export const rarityColors = {
  common: { fill: '#B4ACD6', lip: '#7268A0', label: 'רגיל' },
  uncommon: { fill: palette.pitch, lip: palette.pitchDeep, label: 'לא שכיח' },
  rare: { fill: palette.sky, lip: palette.skyDeep, label: 'נדיר' },
  epic: { fill: palette.violet, lip: palette.violetDeep, label: 'אפי' },
  legendary: { fill: palette.gold, lip: palette.goldDeep, label: 'אגדי' },
  iconic: { fill: palette.flare, lip: palette.flareDeep, label: 'מיתי' },
} as const;

export type ColorToken = keyof typeof colors;
export type RarityKey = keyof typeof rarityColors;
