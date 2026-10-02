/**
 * Motion tokens. Motion answers a player's action (press, reveal, reward);
 * nothing loops in the background. All durations collapse to `instant`
 * when Reduced Motion is on (OS setting or in-app toggle).
 */
export const duration = {
  instant: 0,
  press: 90,
  quick: 160,
  base: 240,
  reveal: 420,
  celebrate: 900,
} as const;

export const spring = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  pop: { damping: 11, stiffness: 260, mass: 0.8 },
  settle: { damping: 20, stiffness: 180, mass: 1 },
} as const;
