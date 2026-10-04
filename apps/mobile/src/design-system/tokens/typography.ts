/**
 * Type scale. Two families, clearly distinct:
 *   ui  — IBM Plex Sans Hebrew: headlines and everything you read or tap.
 *   led — DotGothic16: scoreboard digits (scores, coins, clocks). Digits and
 *         Latin only — never set Hebrew in it.
 * Both are SIL Open Font License (free for commercial apps). See LICENSES/ASSETS.md.
 *
 * Sizes are base sizes; AppText scales them with the OS Dynamic Type setting
 * (capped by maxScale so layouts don't break).
 */
export const fontFamily = {
  display: 'IBMPlexSansHebrew_700Bold',
  ui: 'IBMPlexSansHebrew_400Regular',
  uiMedium: 'IBMPlexSansHebrew_600SemiBold',
  uiBold: 'IBMPlexSansHebrew_700Bold',
  uiBlack: 'IBMPlexSansHebrew_700Bold',
  led: 'DotGothic16_400Regular',
} as const;

export const textStyles = {
  hero: { fontFamily: fontFamily.display, fontSize: 44, lineHeight: 48, maxScale: 1.3 },
  title: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 36, maxScale: 1.4 },
  heading: { fontFamily: fontFamily.display, fontSize: 19, lineHeight: 26, maxScale: 1.5 },
  question: { fontFamily: fontFamily.display, fontSize: 23, lineHeight: 31, maxScale: 1.4 },
  body: { fontFamily: fontFamily.ui, fontSize: 15, lineHeight: 23, maxScale: 1.8 },
  bodyStrong: { fontFamily: fontFamily.uiMedium, fontSize: 15, lineHeight: 23, maxScale: 1.8 },
  label: { fontFamily: fontFamily.uiBold, fontSize: 14, lineHeight: 20, maxScale: 1.6 },
  caption: { fontFamily: fontFamily.ui, fontSize: 12, lineHeight: 17, maxScale: 1.6 },
  button: { fontFamily: fontFamily.uiBold, fontSize: 19, lineHeight: 24, maxScale: 1.4 },
  number: { fontFamily: fontFamily.led, fontSize: 20, lineHeight: 24, maxScale: 1.4 },
  ledS: { fontFamily: fontFamily.led, fontSize: 14, lineHeight: 18, maxScale: 1.4 },
  ledM: { fontFamily: fontFamily.led, fontSize: 26, lineHeight: 30, maxScale: 1.3 },
  ledL: { fontFamily: fontFamily.led, fontSize: 34, lineHeight: 38, maxScale: 1.2 },
  ledXL: { fontFamily: fontFamily.led, fontSize: 48, lineHeight: 52, maxScale: 1.1 },
} as const;

export type TextVariant = keyof typeof textStyles;
