export const GRID_SIZE = 100;
export const CELL_SIZE = 30;
export const WORLD_WIDTH = GRID_SIZE * CELL_SIZE;
export const WORLD_HEIGHT = GRID_SIZE * CELL_SIZE;

export const PLAYER_SPEED = 200;
export const TICK_RATE = 20;
export const FIREBALL_SPEED = 400;
export const FIREBALL_LIFETIME = 3.0;
export const FIREBALL_HIT_RADIUS = 20;
export const COLLECTIBLE_PICKUP_RADIUS = 20;
export const EXPLOSION_RADIUS = 2;
export const INVINCIBILITY_DURATION = 8;
export const INVINCIBILITY_RESPAWN_DELAY = 12;
export const SPEED_BOOST_DURATION = 4;
export const SPEED_BOOST_MULTIPLIER = 1.3;
export const SPEED_BOOST_RESPAWN_DELAY = 6;

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
export type TrailType = 'grass' | 'star' | 'smile' | 'money' | 'bubble' | 'confetti' | 'heart' | 'bolt' | 'leaf' | 'gem' | 'music' | 'snow';
export const TRAIL_TYPES: TrailType[] = ['grass', 'star', 'smile', 'money', 'bubble', 'confetti', 'heart', 'bolt', 'leaf', 'gem', 'music', 'snow'];

export const COLORS = {
  bg: '#94a3b8',
  grid: '#cbd5e1',
  trailAlpha: 0.5,
};

export const BOT_NAMES = [
  'LawnMaster', 'GrassKicker', 'BladeRunner', 'MowMoney',
  'TurfTerminator', 'WeedWhacker', 'SnipSnap', 'GreenThumb'
];

export const PLAYER_COLORS = [
  '#EC098D',
  '#3b82f6',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#6366f1',
  '#ef4444',
  '#10b981',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
  '#8b5cf6',
];
