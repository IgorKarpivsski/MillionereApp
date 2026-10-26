/* eslint-disable @typescript-eslint/no-require-imports */
/** Ready-made 3D profile pictures (AI-illustrated), one art style for everyone. Stored as avatar_31 … avatar_70. */
export const AVATARS_3D: Record<string, number> = {
  avatar_31: require('../../assets/avatars/a31.webp'),
  avatar_32: require('../../assets/avatars/a32.webp'),
  avatar_33: require('../../assets/avatars/a33.webp'),
  avatar_34: require('../../assets/avatars/a34.webp'),
  avatar_35: require('../../assets/avatars/a35.webp'),
  avatar_36: require('../../assets/avatars/a36.webp'),
  avatar_37: require('../../assets/avatars/a37.webp'),
  avatar_38: require('../../assets/avatars/a38.webp'),
  avatar_39: require('../../assets/avatars/a39.webp'),
  avatar_40: require('../../assets/avatars/a40.webp'),
  avatar_41: require('../../assets/avatars/a41.webp'),
  avatar_42: require('../../assets/avatars/a42.webp'),
  avatar_43: require('../../assets/avatars/a43.webp'),
  avatar_44: require('../../assets/avatars/a44.webp'),
  avatar_45: require('../../assets/avatars/a45.webp'),
  avatar_46: require('../../assets/avatars/a46.webp'),
  avatar_47: require('../../assets/avatars/a47.webp'),
  avatar_48: require('../../assets/avatars/a48.webp'),
  avatar_49: require('../../assets/avatars/a49.webp'),
  avatar_50: require('../../assets/avatars/a50.webp'),
  avatar_51: require('../../assets/avatars/a51.webp'),
  avatar_52: require('../../assets/avatars/a52.webp'),
  avatar_53: require('../../assets/avatars/a53.webp'),
  avatar_54: require('../../assets/avatars/a54.webp'),
  avatar_55: require('../../assets/avatars/a55.webp'),
  avatar_56: require('../../assets/avatars/a56.webp'),
  avatar_57: require('../../assets/avatars/a57.webp'),
  avatar_58: require('../../assets/avatars/a58.webp'),
  avatar_59: require('../../assets/avatars/a59.webp'),
  avatar_60: require('../../assets/avatars/a60.webp'),
  avatar_61: require('../../assets/avatars/a61.webp'),
  avatar_62: require('../../assets/avatars/a62.webp'),
  avatar_63: require('../../assets/avatars/a63.webp'),
  avatar_64: require('../../assets/avatars/a64.webp'),
  avatar_65: require('../../assets/avatars/a65.webp'),
  avatar_66: require('../../assets/avatars/a66.webp'),
  avatar_67: require('../../assets/avatars/a67.webp'),
  avatar_68: require('../../assets/avatars/a68.webp'),
  avatar_69: require('../../assets/avatars/a69.webp'),
  avatar_70: require('../../assets/avatars/a70.webp'),
  /** the computer opponent in random matches */
  bot_sloth: require('../../assets/avatars/bot_sloth.webp'),
};
export const AVATAR_3D_IDS = Object.keys(AVATARS_3D).filter((id) => id !== 'bot_sloth');

/**
 * The 3D character for any stored avatar id. Older ids (the drawn avatars, or the
 * default 'avatar_01') map to a fixed 3D character, so every face in the app is 3D.
 */
export function avatar3dFor(avatarId: string): string {
  if (AVATARS_3D[avatarId]) return avatarId;
  let h = 0;
  for (let i = 0; i < avatarId.length; i++) h = (Math.imul(h, 31) + avatarId.charCodeAt(i)) | 0;
  return AVATAR_3D_IDS[Math.abs(h) % AVATAR_3D_IDS.length]!;
}
