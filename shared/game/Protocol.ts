import type { Direction, TrailType } from './Constants';
import type { Point } from './Player';

export interface PlayerData {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  direction: Direction;
  territory: string[];
  trail: Point[];
  isDead: boolean;
  deathAlpha: number;
  score: number;
  takeovers: number;
  invincibleTimeLeft: number;
  fireballs: number;
  trailType: TrailType;
  isBot: boolean;
}

export interface FireballData {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  life: number;
}

export interface CollectibleData {
  id: string;
  x: number;
  y: number;
  type: 'fireball' | 'invincibility';
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  takeovers: number;
  color: string;
}

export type ClientMessage =
  | { type: 'join'; name: string; color: string; trailType: TrailType }
  | { type: 'direction'; direction: Direction }
  | { type: 'shoot' };

export type ServerMessage =
  | { type: 'welcome'; playerId: string; state: GameStateSnapshot }
  | { type: 'state'; players: PlayerData[]; fireballs: FireballData[]; collectibles: CollectibleData[] }
  | { type: 'leaderboard'; board: LeaderboardEntry[] }
  | { type: 'gameOver'; score: number; reason: string; survivedSeconds: number }
  | { type: 'fireballImpact'; impact: 'land'; x: number; y: number }
  | { type: 'kill'; playerId: string; reason: string };

export interface GameStateSnapshot {
  players: PlayerData[];
  fireballs: FireballData[];
  collectibles: CollectibleData[];
  leaderboard: LeaderboardEntry[];
}
