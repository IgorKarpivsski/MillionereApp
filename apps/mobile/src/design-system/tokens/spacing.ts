/** 4-pt spacing grid. */
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Radius by hierarchy, not one value everywhere. */
export const radius = {
  chip: 999,
  control: 14,
  card: 18,
  sheet: 24,
  sticker: 12,
  board: 14,
} as const;

/** Depth of the pressable "lip" under buttons. Panels are flat (scoreboard style). */
export const lip = {
  button: 4,
  card: 0,
  small: 3,
} as const;

/** Minimum touch target (Apple HIG). */
export const hitTarget = 44;

/** Border width of featured panels and stickers. */
export const stickerBorder = 3;
