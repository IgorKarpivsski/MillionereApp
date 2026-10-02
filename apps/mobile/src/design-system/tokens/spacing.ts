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
  control: 18,
  card: 22,
  sheet: 28,
  sticker: 14,
} as const;

/** Depth of the pressable "lip" under sticker buttons and cards. */
export const lip = {
  button: 6,
  card: 5,
  small: 4,
} as const;

/** Minimum touch target (Apple HIG). */
export const hitTarget = 44;

/** Width of the white die-cut border on stickers. */
export const stickerBorder = 3;
