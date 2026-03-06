// Constants for the game grid and rendering
export const GRID_SIZE = 100; // 100x100 grid
export const CELL_SIZE = 30; // 30px per cell
export const WORLD_WIDTH = GRID_SIZE * CELL_SIZE;
export const WORLD_HEIGHT = GRID_SIZE * CELL_SIZE;

export const PLAYER_SPEED = 200; // pixels per second
export const TICK_RATE = 1000 / 60; // 60 fps
export const BOT_COUNT = 5; // Reduced from default 7

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const COLORS = {
  bg: '#e5f6e5',
  grid: '#bbf7d0',
  trailAlpha: 0.5,
};

// Bot names for the mockup
export const BOT_NAMES = [
  'LawnMaster', 'GrassKicker', 'BladeRunner', 'MowMoney', 
  'TurfTerminator', 'WeedWhacker', 'SnipSnap', 'GreenThumb'
];

export const PLAYER_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
];