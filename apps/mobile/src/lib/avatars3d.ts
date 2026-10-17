/* eslint-disable @typescript-eslint/no-require-imports */
/** Ready-made 3D profile pictures (AI-illustrated). Stored as avatar_31 … avatar_46. */
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
  /** the computer opponent in random matches */
  bot_sloth: require('../../assets/avatars/bot_sloth.webp'),
};
export const AVATAR_3D_IDS = Object.keys(AVATARS_3D).filter((id) => id !== 'bot_sloth');
