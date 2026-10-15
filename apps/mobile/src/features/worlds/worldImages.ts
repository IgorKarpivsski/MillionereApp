import type { ImageSourcePropType } from 'react-native';

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
};

/** Tall level-map background behind each world's path, keyed by world slug. */
export const PATH_IMAGES: Record<string, ImageSourcePropType> = {
  geography: require('../../../assets/paths/geography.webp'),
  history: require('../../../assets/paths/history.webp'),
  science: require('../../../assets/paths/science.webp'),
  nature: require('../../../assets/paths/nature.webp'),
  space: require('../../../assets/paths/space.webp'),
  culture: require('../../../assets/paths/culture.webp'),
  screen: require('../../../assets/paths/screen.webp'),
  music: require('../../../assets/paths/music.webp'),
  people: require('../../../assets/paths/people.webp'),
  israel: require('../../../assets/paths/israel.webp'),
  sport: require('../../../assets/paths/sport.webp'),
  food: require('../../../assets/paths/food.webp'),
  football: require('../../../assets/paths/football.webp'),
};

export const CHEST_IMAGE: ImageSourcePropType = require('../../../assets/paths/chest.webp');
