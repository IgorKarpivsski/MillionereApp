/**
 * Type scale. Two families, clearly distinct:
 *   display — Secular One: headlines, numbers, prize amounts. One weight.
 *   ui      — Rubik: everything you read or tap.
 * Both are SIL Open Font License (free for commercial apps). See LICENSES/ASSETS.md.
 *
 * Sizes are base sizes; AppText scales them with the OS Dynamic Type setting
 * (capped by maxScale so layouts don't break).
 */
export const fontFamily = {
  display: 'SecularOne_400Regular',
  ui: 'Rubik_400Regular',
  uiMedium: 'Rubik_500Medium',
  uiBold: 'Rubik_700Bold',
  uiBlack: 'Rubik_900Black',
} as const;

export const textStyles = {
  hero: { fontFamily: fontFamily.display, fontSize: 40, lineHeight: 46, maxScale: 1.3 },
  title: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, maxScale: 1.4 },
  heading: { fontFamily: fontFamily.display, fontSize: 21, lineHeight: 27, maxScale: 1.5 },
  body: { fontFamily: fontFamily.ui, fontSize: 16, lineHeight: 24, maxScale: 1.8 },
  bodyStrong: { fontFamily: fontFamily.uiMedium, fontSize: 16, lineHeight: 24, maxScale: 1.8 },
  label: { fontFamily: fontFamily.uiBold, fontSize: 14, lineHeight: 20, maxScale: 1.6 },
  caption: { fontFamily: fontFamily.ui, fontSize: 13, lineHeight: 18, maxScale: 1.6 },
  number: { fontFamily: fontFamily.display, fontSize: 18, lineHeight: 22, maxScale: 1.4 },
  button: { fontFamily: fontFamily.uiBlack, fontSize: 18, lineHeight: 22, maxScale: 1.4 },
} as const;

export type TextVariant = keyof typeof textStyles;
