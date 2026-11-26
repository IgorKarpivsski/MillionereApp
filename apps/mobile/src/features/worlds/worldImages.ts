import type { ImageSourcePropType } from 'react-native';
import { PATH_SECTIONS } from './pathSections';

/** Illustrated cover for each knowledge world, keyed by the world's icon id. */
export const WORLD_IMAGES: Record<string, ImageSourcePropType> = {
  globe: require('../../../assets/worlds/geography.webp'),
  scroll: require('../../../assets/worlds/history.webp'),
  atom: require('../../../assets/worlds/science.webp'),
  leaf: require('../../../assets/worlds/nature.webp'),
  planet: require('../../../assets/worlds/space.webp'),
  palette: require('../../../assets/worlds/culture.webp'),
  film: require('../../../assets/worlds/screen.webp'),
  note: require('../../../assets/worlds/music.webp'),
  person: require('../../../assets/worlds/people.webp'),
  star: require('../../../assets/worlds/israel.webp'),
  medal: require('../../../assets/worlds/sport.webp'),
  food: require('../../../assets/worlds/food.webp'),
  ball: require('../../../assets/worlds/football.webp'),
  bolt: require('../../../assets/worlds/mix.webp'),
  menorah: require('../../../assets/worlds/hanukkah.webp'),
  chip: require('../../../assets/worlds/tech.webp'),
  gamepad: require('../../../assets/worlds/gaming.webp'),
};

/**
 * Level-map background sections behind each world's path, keyed by world slug, in order from the bottom of the road up.
 * Sections after the first have a transparent top edge, so each one fades into the one below it.
 */
export const PATH_IMAGES: Record<string, ImageSourcePropType[]> = PATH_SECTIONS;

export const CHEST_IMAGE: ImageSourcePropType = require('../../../assets/paths/chest.webp');
