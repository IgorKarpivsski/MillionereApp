/**
 * Color tokens — "האלוף": a stadium at night, read off the scoreboard.
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
  night950: '#06130F', // scoreboard panel
  night900: '#0B2B22', // grass at night (screen background)
  night800: '#0F3428',
  night700: '#133D30', // secondary card
  night600: '#1F4A3C', // panel borders
  night300: '#8FA79B', // dim captions
  chalk: '#F2F5EF', // floodlight white
  chalkDim: '#B8C9C0',
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
  correctFill: '#0F4A33',
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
  cardMuted: '#4E6A5E',

  sticker: palette.chalk,
  overlay: 'rgba(6, 19, 15, 0.78)',
} as const;

export const rarityColors = {
  common: { fill: '#9DB3A8', lip: '#5E7569', label: 'רגיל' },
  uncommon: { fill: palette.pitch, lip: palette.pitchDeep, label: 'לא שכיח' },
  rare: { fill: palette.sky, lip: palette.skyDeep, label: 'נדיר' },
  epic: { fill: palette.violet, lip: palette.violetDeep, label: 'אפי' },
  legendary: { fill: palette.gold, lip: palette.goldDeep, label: 'אגדי' },
  iconic: { fill: palette.flare, lip: palette.flareDeep, label: 'מיתי' },
} as const;

export type ColorToken = keyof typeof colors;
export type RarityKey = keyof typeof rarityColors;
