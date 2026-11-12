/* eslint-disable @typescript-eslint/no-require-imports */
import type { ImageSourcePropType } from 'react-native';

/**
 * Art for the sloth's treehouse. Every picture is original, generated for this game
 * (see LICENSES/ASSETS.md). Positions are in percent of the 3:4 room picture.
 */
export const ROOM = require('../../../assets/home/room.webp') as ImageSourcePropType;
export const ROOM_RATIO = 4 / 3; // height / width

export interface Spot {
  src: ImageSourcePropType;
  /** height / width of the picture */
  ratio: number;
  /** center x, bottom y and width, in percent of the room */
  cx: number;
  bottom: number;
  w: number;
  /** squashed flat on the floor (the rug) */
  flat?: number;
  /** drawing order (back to front) */
  z: number;
}

export const SPOTS: Record<string, Spot> = {
  home_lights: { src: require('../../../assets/home/home_lights.webp'), ratio: 0.498, cx: 50, bottom: 17, w: 62, z: 1 },
  home_clock: { src: require('../../../assets/home/home_clock.webp'), ratio: 1.2839, cx: 84, bottom: 38, w: 13, z: 2 },
  home_telescope: { src: require('../../../assets/home/home_telescope.webp'), ratio: 1.3617, cx: 62, bottom: 62, w: 13, z: 3 },
  home_trophies: { src: require('../../../assets/home/home_trophies.webp'), ratio: 1.3838, cx: 16, bottom: 64, w: 25, z: 4 },
  home_bookshelf: { src: require('../../../assets/home/home_bookshelf.webp'), ratio: 1.4105, cx: 83, bottom: 64, w: 24, z: 4 },
  home_hammock: { src: require('../../../assets/home/home_hammock.webp'), ratio: 0.8141, cx: 46, bottom: 66, w: 30, z: 5 },
  home_rug: { src: require('../../../assets/home/home_rug.webp'), ratio: 0.8965, cx: 50, bottom: 95, w: 66, flat: 0.34, z: 0 },
  home_lamp: { src: require('../../../assets/home/home_lamp.webp'), ratio: 1.8057, cx: 93, bottom: 83, w: 13, z: 6 },
  home_armchair: { src: require('../../../assets/home/home_armchair.webp'), ratio: 1.0099, cx: 24, bottom: 86, w: 30, z: 7 },
  home_tv: { src: require('../../../assets/home/home_tv.webp'), ratio: 1.1636, cx: 75, bottom: 87, w: 24, z: 8 },
  home_plant: { src: require('../../../assets/home/home_plant.webp'), ratio: 1.113, cx: 9, bottom: 99, w: 24, z: 10 },
};

/** Where the sloth sits, and its depth (between the tv and the plant). */
export const SLOTH_SPOT = { cx: 50, bottom: 92, w: 32, z: 9 };

export interface HatArt {
  src: ImageSourcePropType;
  ratio: number;
  /** center x and bottom y on the sloth picture (fractions), and width as a fraction of the sloth's width */
  x: number;
  y: number;
  w: number;
}

export const HATS: Record<string, HatArt> = {
  hat_party: { src: require('../../../assets/home/hat_party.webp'), ratio: 1.3763, x: 0.55, y: 0.15, w: 0.36 },
  hat_cap: { src: require('../../../assets/home/hat_cap.webp'), ratio: 0.8958, x: 0.5, y: 0.17, w: 0.62 },
  hat_flowers: { src: require('../../../assets/home/hat_flowers.webp'), ratio: 0.5833, x: 0.5, y: 0.16, w: 0.7 },
  hat_chef: { src: require('../../../assets/home/hat_chef.webp'), ratio: 1.0323, x: 0.5, y: 0.16, w: 0.5 },
  hat_grad: { src: require('../../../assets/home/hat_grad.webp'), ratio: 0.7396, x: 0.5, y: 0.14, w: 0.62 },
  hat_pirate: { src: require('../../../assets/home/hat_pirate.webp'), ratio: 0.9219, x: 0.5, y: 0.17, w: 0.75 },
  hat_wizard: { src: require('../../../assets/home/hat_wizard.webp'), ratio: 1.1261, x: 0.5, y: 0.17, w: 0.6 },
  hat_crown: { src: require('../../../assets/home/hat_crown.webp'), ratio: 0.9375, x: 0.5, y: 0.18, w: 0.55 },
};
