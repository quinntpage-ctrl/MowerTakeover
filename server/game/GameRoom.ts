import { WebSocket } from 'ws';
import { PlayerState, Point } from '../../shared/game/Player';
import {
  GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT,
  PLAYER_SPEED, TICK_RATE, FIREBALL_SPEED, FIREBALL_LIFETIME,
  FIREBALL_HIT_RADIUS, COLLECTIBLE_PICKUP_RADIUS, EXPLOSION_RADIUS,
  INVINCIBILITY_DURATION, INVINCIBILITY_RESPAWN_DELAY,
  BOT_NAMES, PLAYER_COLORS, Direction, TrailType
} from '../../shared/game/Constants';
import { captureEnclosedAreas } from '../../shared/game/Utils';
import type {
  PlayerData, FireballData, CollectibleData, LeaderboardEntry,
  ServerMessage, ClientMessage, GameStateSnapshot
} from '../../shared/game/Protocol';

interface Fireball {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
  life: number;
}

interface Collectible {
  id: string;
  x: number;
  y: number;
  type: 'fireball' | 'invincibility';
}

interface ConnectedPlayer {
  ws: WebSocket;
  playerId: string;
}

export class GameRoom {
  private players: Map<string, PlayerState> = new Map();
  private connections: Map<string, ConnectedPlayer> = new Map();
  private fireballs: Fireball[] = [];
  private collectibles: Map<string, Collectible> = new Map();
  private invincibilityRespawnCooldown: number = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private lastTickTime: number = 0;

  constructor() {
    this.spawnBots(3);
    this.spawnCollectibles(15, 'fireball');
    this.spawnCollectibles(1, 'invincibility');
  }

  start() {
    this.lastTickTime = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);
    console.log(`GameRoom started at ${TICK_RATE} ticks/sec`);
  }

  stop() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  addPlayer(ws: WebSocket, name: string, color: string, trailType: TrailType): string {
    const playerId = `p_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const { x: spawnX, y: spawnY } = this.findSpawnLocation();
    const player = new PlayerState(playerId, name, color, spawnX, spawnY, false, trailType);

    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    player.direction = dir;
    player.nextDirection = dir;

    this.players.set(playerId, player);
    this.connections.set(playerId, { ws, playerId });

    const welcome: ServerMessage = {
      type: 'welcome',
      playerId,
      state: this.getFullSnapshot()
    };
    this.sendToPlayer(playerId, welcome);

    this.updateAllScores();

    return playerId;
  }

  removePlayer(playerId: string) {
    const player = this.players.get(playerId);
    if (player) {
      player.trail = [];
      player.trailSet.clear();
      player.territory.clear();
    }
    this.players.delete(playerId);
    this.connections.delete(playerId);
    this.updateAllScores();
  }

  handleMessage(playerId: string, msg: ClientMessage) {
    const player = this.players.get(playerId);
    if (!player || player.isDead) return;

    switch (msg.type) {
      case 'direction':
        this.setPlayerDirection(player, msg.direction);
        break;
      case 'shoot':
        this.shootFireball(player);
        break;
    }
  }

  private setPlayerDirection(p: PlayerState, dir: Direction) {
    if (
      (dir === 'UP' && p.nextDirection === 'DOWN') ||
      (dir === 'DOWN' && p.nextDirection === 'UP') ||
      (dir === 'LEFT' && p.nextDirection === 'RIGHT') ||
      (dir === 'RIGHT' && p.nextDirection === 'LEFT')
    ) {
      return;
    }
    p.nextDirection = dir;
  }

  private shootFireball(p: PlayerState) {
    if (p.fireballs <= 0) return;
    p.fireballs--;

    let vx = 0, vy = 0;
    if (p.direction === 'UP') vy = -FIREBALL_SPEED;
    else if (p.direction === 'DOWN') vy = FIREBALL_SPEED;
    else if (p.direction === 'LEFT') vx = -FIREBALL_SPEED;
    else if (p.direction === 'RIGHT') vx = FIREBALL_SPEED;

    this.fireballs.push({
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      x: p.x, y: p.y,
      vx, vy,
      ownerId: p.id,
      life: FIREBALL_LIFETIME
    });
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min((now - this.lastTickTime) / 1000, 0.1);
    this.lastTickTime = now;

    this.updateFireballs(dt);
    this.updatePlayers(dt, now);
    this.updateCollectibles(dt);
    this.broadcastState();
    this.broadcastLeaderboard();
  }

  private updateFireballs(dt: number) {
    const hitRadiusSq = FIREBALL_HIT_RADIUS * FIREBALL_HIT_RADIUS;

    for (let i = this.fireballs.length - 1; i >= 0; i--) {
      const fb = this.fireballs[i];
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;
      fb.life -= dt;

      const gridX = Math.floor(fb.x / CELL_SIZE);
      const gridY = Math.floor(fb.y / CELL_SIZE);
      const key = `${gridX},${gridY}`;

      let hitEnemy = false;
      let explode = false;

      this.players.forEach(p => {
        if (p.id !== fb.ownerId && !p.isDead) {
          const dx = p.x - fb.x;
          const dy = p.y - fb.y;
          if (dx * dx + dy * dy < hitRadiusSq) {
            hitEnemy = true;
            if (!this.isPlayerInvincible(p)) {
              explode = true;
              this.killPlayer(p.id, 'hit by a fireball!', fb.ownerId);
            }
          }
        }
      });

      if (!hitEnemy) {
        this.players.forEach(p => {
          if (p.id !== fb.ownerId && p.territory.has(key)) {
            hitEnemy = true;
            explode = true;
          }
        });
      }

      if (hitEnemy) {
        if (explode) {
          for (let dx = -EXPLOSION_RADIUS; dx <= EXPLOSION_RADIUS; dx++) {
            for (let dy = -EXPLOSION_RADIUS; dy <= EXPLOSION_RADIUS; dy++) {
              const nKey = `${gridX + dx},${gridY + dy}`;
              this.players.forEach(p => {
                if (p.id !== fb.ownerId) {
                  p.territory.delete(nKey);
                }
              });
            }
          }
          this.players.forEach(p => {
            if (p.id !== fb.ownerId) p.updateScore();
          });
        }
        fb.life = 0;
      }

      if (fb.life <= 0 || fb.x < 0 || fb.x > WORLD_WIDTH || fb.y < 0 || fb.y > WORLD_HEIGHT) {
        this.fireballs.splice(i, 1);
      }
    }
  }

  private updateCollectibles(dt: number) {
    const fireballCount = Array.from(this.collectibles.values()).filter(col => col.type === 'fireball').length;
    const invincibilityCount = Array.from(this.collectibles.values()).filter(col => col.type === 'invincibility').length;

    if (fireballCount < 10) {
      this.spawnCollectibles(5, 'fireball');
    }

    if (this.invincibilityRespawnCooldown > 0) {
      this.invincibilityRespawnCooldown = Math.max(0, this.invincibilityRespawnCooldown - dt);
    }

    if (invincibilityCount === 0 && this.invincibilityRespawnCooldown <= 0) {
      this.spawnCollectibles(1, 'invincibility');
    }
  }

  private updatePlayers(dt: number, now: number) {
    this.players.forEach(p => {
      if (p.invincibleUntil > 0 && p.invincibleUntil <= now) {
        p.invincibleUntil = 0;
      }

      if (p.isDead) {
        if (p.deathAlpha > 0) {
          p.deathAlpha -= dt * 1.5;
        } else if (p.deathAlpha <= 0 && p.deathAlpha > -3) {
          if (p.deathAlpha > -1) {
            p.trail = [];
            p.trailSet.clear();
            p.territory.clear();
            this.updateAllScores();
          }

          if (p.isBot) {
            this.respawnBot(p);
          } else if (p.deathAlpha > -1) {
            p.deathAlpha = -2;
            const conn = this.connections.get(p.id);
            if (conn) {
              const msg: ServerMessage = { type: 'gameOver', score: p.finalScore, reason: p.deathReason };
              this.sendToPlayer(p.id, msg);
            }
          } else {
            p.deathAlpha = -2;
          }
        }
        return;
      }

      if (p.isBot) {
        this.updateBot(p);
      }

      const oldCell = this.getCellAt(p.x, p.y);
      const moveDist = PLAYER_SPEED * dt;

      const cx = Math.floor(p.x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      const cy = Math.floor(p.y / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;

      const isHorizontal = p.direction === 'LEFT' || p.direction === 'RIGHT';
      const distToCenter = isHorizontal ? Math.abs(p.x - cx) : Math.abs(p.y - cy);

      const movingTowardsCenter =
        (p.direction === 'RIGHT' && p.x <= cx) ||
        (p.direction === 'LEFT' && p.x >= cx) ||
        (p.direction === 'DOWN' && p.y <= cy) ||
        (p.direction === 'UP' && p.y >= cy);

      const passingCenter = movingTowardsCenter && distToCenter <= moveDist;

      if (p.nextDirection !== p.direction && passingCenter) {
        p.x = cx;
        p.y = cy;
        p.direction = p.nextDirection;

        const remainingDist = moveDist - distToCenter;
        if (p.direction === 'UP') p.y -= remainingDist;
        else if (p.direction === 'DOWN') p.y += remainingDist;
        else if (p.direction === 'LEFT') p.x -= remainingDist;
        else if (p.direction === 'RIGHT') p.x += remainingDist;
      } else {
        if (p.direction === 'UP') p.y -= moveDist;
        else if (p.direction === 'DOWN') p.y += moveDist;
        else if (p.direction === 'LEFT') p.x -= moveDist;
        else if (p.direction === 'RIGHT') p.x += moveDist;
      }

      p.x = Math.max(0, Math.min(WORLD_WIDTH - 0.001, p.x));
      p.y = Math.max(0, Math.min(WORLD_HEIGHT - 0.001, p.y));

      if (p.x <= 0 || p.x >= WORLD_WIDTH - 0.01 || p.y <= 0 || p.y >= WORLD_HEIGHT - 0.01) {
        this.killPlayer(p.id, 'wall-collision');
        return;
      }

      const newCell = this.getCellAt(p.x, p.y);
      const cellKey = `${newCell.x},${newCell.y}`;
      const oldCellKey = `${oldCell.x},${oldCell.y}`;

      const pickupRadiusSq = COLLECTIBLE_PICKUP_RADIUS * COLLECTIBLE_PICKUP_RADIUS;
      const toDelete: string[] = [];
      this.collectibles.forEach((col, colId) => {
        const dx = p.x - col.x;
        const dy = p.y - col.y;
        if (dx * dx + dy * dy < pickupRadiusSq) {
          if (col.type === 'fireball') {
            p.fireballs++;
          } else {
            p.invincibleUntil = Math.max(p.invincibleUntil, now) + INVINCIBILITY_DURATION * 1000;
            this.invincibilityRespawnCooldown = INVINCIBILITY_RESPAWN_DELAY;
          }
          toDelete.push(colId);
        }
      });
      toDelete.forEach(id => this.collectibles.delete(id));

      if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
        this.players.forEach((otherP, otherPid) => {
          if (otherPid !== p.id && !otherP.isDead && otherP.trailSet.has(cellKey)) {
            this.killPlayer(otherPid, 'killed-by-other', p.id);
          }
        });

        const isEnteringSafeZone = p.territory.has(cellKey);

        if (isEnteringSafeZone) {
          if (p.trail.length > 0) {
            p.trail.push({ ...newCell });

            p.trail.forEach(t => {
              const k = `${t.x},${t.y}`;
              p.territory.add(k);
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });

            p.trailSet.clear();
            p.trail = [];

            const newlyCaptured = captureEnclosedAreas(p.territory);
            newlyCaptured.forEach(k => {
              p.territory.add(k);
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });

            const toKill: string[] = [];
            this.players.forEach(player => {
              player.updateScore();
              if (player.territory.size === 0 && !player.isDead) {
                toKill.push(player.id);
              }
            });
            toKill.forEach(id => this.killPlayer(id, 'all-territory-lost', p.id));
          }
        } else {
          const isSelfCollision = p.trailSet.has(cellKey);
          const isRecentTrail = p.trail.slice(-3).some(t => t.x === newCell.x && t.y === newCell.y);
          const justLeftSafeZone = p.territory.has(oldCellKey);

          if (isSelfCollision && !isRecentTrail && !justLeftSafeZone) {
            this.killPlayer(p.id, 'self-collision');
            return;
          }

          p.trail.push({ ...newCell });
          p.trailSet.add(cellKey);
        }
      }
    });
  }

  private botPhases: Map<string, { phase: 'expand' | 'return'; step: number; expandDir: Direction; expandLen: number }> = new Map();

  private updateBot(bot: PlayerState) {
    const cx = Math.floor(bot.x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const cy = Math.floor(bot.y / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const isHorizontal = bot.direction === 'LEFT' || bot.direction === 'RIGHT';
    const distToCenter = isHorizontal ? Math.abs(bot.x - cx) : Math.abs(bot.y - cy);

    if (distToCenter > 2) return;

    let state = this.botPhases.get(bot.id);
    if (!state) {
      state = { phase: 'expand', step: 0, expandDir: 'RIGHT', expandLen: 5 + Math.floor(Math.random() * 8) };
      this.botPhases.set(bot.id, state);
    }

    const gridX = Math.floor(bot.x / CELL_SIZE);
    const gridY = Math.floor(bot.y / CELL_SIZE);
    const cellKey = `${gridX},${gridY}`;
    const inSafe = bot.territory.has(cellKey);

    const margin = 5;
    const nearWall = gridX < margin || gridX > GRID_SIZE - margin || gridY < margin || gridY > GRID_SIZE - margin;

    if (bot.trail.length > 25 || nearWall) {
      state.phase = 'return';
    }

    if (state.phase === 'expand') {
      if (inSafe && bot.trail.length === 0) {
        const terrCenter = this.getBotTerritoryCenter(bot);
        const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const opposite: Record<string, string> = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };

        const bestDir = this.pickBestExpandDirection(bot, gridX, gridY);
        state.expandDir = bestDir;
        state.expandLen = 4 + Math.floor(Math.random() * 10);
        state.step = 0;

        bot.nextDirection = state.expandDir;
      } else if (!inSafe) {
        state.step++;

        if (state.step >= state.expandLen) {
          const turnRight: Record<string, Direction> = { 'UP': 'RIGHT', 'RIGHT': 'DOWN', 'DOWN': 'LEFT', 'LEFT': 'UP' };
          const turnLeft: Record<string, Direction> = { 'UP': 'LEFT', 'LEFT': 'DOWN', 'DOWN': 'RIGHT', 'RIGHT': 'UP' };

          const turn = Math.random() < 0.5 ? turnRight : turnLeft;
          bot.nextDirection = turn[bot.direction];
          state.expandLen = 3 + Math.floor(Math.random() * 8);
          state.step = 0;

          if (bot.trail.length > 8 + Math.floor(Math.random() * 10)) {
            state.phase = 'return';
          }
        }
      }
    }

    if (state.phase === 'return') {
      const target = this.findNearestTerritory(bot, gridX, gridY);
      if (target) {
        const dx = target.x - gridX;
        const dy = target.y - gridY;

        const opposite: Record<string, string> = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };

        if (Math.abs(dx) > Math.abs(dy)) {
          const desired: Direction = dx > 0 ? 'RIGHT' : 'LEFT';
          if (desired !== opposite[bot.direction]) {
            bot.nextDirection = desired;
          } else {
            bot.nextDirection = dy >= 0 ? 'DOWN' : 'UP';
          }
        } else {
          const desired: Direction = dy > 0 ? 'DOWN' : 'UP';
          if (desired !== opposite[bot.direction]) {
            bot.nextDirection = desired;
          } else {
            bot.nextDirection = dx >= 0 ? 'RIGHT' : 'LEFT';
          }
        }
      }

      if (inSafe && bot.trail.length === 0) {
        state.phase = 'expand';
        state.step = 0;
        state.expandLen = 4 + Math.floor(Math.random() * 10);
      }
    }
  }

  private pickBestExpandDirection(bot: PlayerState, gridX: number, gridY: number): Direction {
    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const opposite: Record<string, string> = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
    const validDirs = dirs.filter(d => d !== opposite[bot.direction]);

    let bestDir = validDirs[0];
    let bestScore = -Infinity;

    for (const dir of validDirs) {
      let score = 0;
      const ddx = dir === 'RIGHT' ? 1 : dir === 'LEFT' ? -1 : 0;
      const ddy = dir === 'DOWN' ? 1 : dir === 'UP' ? -1 : 0;

      for (let step = 1; step <= 10; step++) {
        const checkX = gridX + ddx * step;
        const checkY = gridY + ddy * step;
        const key = `${checkX},${checkY}`;

        if (checkX < 2 || checkX > GRID_SIZE - 2 || checkY < 2 || checkY > GRID_SIZE - 2) {
          score -= 10;
          break;
        }

        if (!bot.territory.has(key)) {
          score += 2;

          let enemyOwned = false;
          this.players.forEach(p => {
            if (p.id !== bot.id && !p.isDead && p.territory.has(key)) {
              enemyOwned = true;
            }
          });
          if (enemyOwned) score += 3;
        }

        let dangerTrail = false;
        this.players.forEach(p => {
          if (p.id !== bot.id && !p.isDead && p.trailSet.has(key)) {
            dangerTrail = true;
          }
        });
        if (dangerTrail) score -= 5;
      }

      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }

    return bestDir;
  }

  private findNearestTerritory(bot: PlayerState, gridX: number, gridY: number): Point | null {
    let nearest: Point | null = null;
    let nearestDist = Infinity;

    bot.territory.forEach(k => {
      const [tx, ty] = k.split(',').map(Number);
      const dist = Math.abs(tx - gridX) + Math.abs(ty - gridY);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { x: tx, y: ty };
      }
    });

    return nearest;
  }

  private getBotTerritoryCenter(bot: PlayerState): Point {
    let sumX = 0, sumY = 0;
    bot.territory.forEach(k => {
      const [tx, ty] = k.split(',').map(Number);
      sumX += tx;
      sumY += ty;
    });
    if (bot.territory.size === 0) return { x: 0, y: 0 };
    return { x: sumX / bot.territory.size, y: sumY / bot.territory.size };
  }

  private respawnBot(p: PlayerState) {
    p.isDead = false;
    p.deathAlpha = 1.0;
    p.invincibleUntil = 0;

    const { x, y } = this.findSpawnLocation();
    p.x = x;
    p.y = y;

    p.territory.clear();
    const startGridX = Math.floor(p.x / CELL_SIZE);
    const startGridY = Math.floor(p.y / CELL_SIZE);

    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const nx = startGridX + dx;
        const ny = startGridY + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          const key = `${nx},${ny}`;
          p.territory.add(key);
          this.players.forEach(other => {
            if (other.id !== p.id) other.territory.delete(key);
          });
        }
      }
    }
    p.updateScore();

    const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
    const dir = dirs[Math.floor(Math.random() * dirs.length)];
    p.direction = dir;
    p.nextDirection = dir;

    this.updateAllScores();
  }

  private findSpawnLocation(): { x: number; y: number } {
    let attempts = 0;
    const maxAttempts = 50;

    while (attempts < maxAttempts) {
      const rx = Math.random() * (WORLD_WIDTH * 0.8) + (WORLD_WIDTH * 0.1);
      const ry = Math.random() * (WORLD_HEIGHT * 0.8) + (WORLD_HEIGHT * 0.1);
      const gridX = Math.floor(rx / CELL_SIZE);
      const gridY = Math.floor(ry / CELL_SIZE);

      let overlap = false;
      for (let dx = -3; dx <= 3 && !overlap; dx++) {
        for (let dy = -3; dy <= 3 && !overlap; dy++) {
          const key = `${gridX + dx},${gridY + dy}`;
          for (const [, other] of Array.from(this.players.entries())) {
            if (!other.isDead && other.territory.has(key)) {
              overlap = true;
              break;
            }
          }
        }
      }

      if (!overlap) {
        return {
          x: gridX * CELL_SIZE + CELL_SIZE / 2,
          y: gridY * CELL_SIZE + CELL_SIZE / 2
        };
      }
      attempts++;
    }

    const rx = Math.random() * (WORLD_WIDTH * 0.8) + (WORLD_WIDTH * 0.1);
    const ry = Math.random() * (WORLD_HEIGHT * 0.8) + (WORLD_HEIGHT * 0.1);
    const gridX = Math.floor(rx / CELL_SIZE);
    const gridY = Math.floor(ry / CELL_SIZE);
    return {
      x: gridX * CELL_SIZE + CELL_SIZE / 2,
      y: gridY * CELL_SIZE + CELL_SIZE / 2
    };
  }

  private killPlayer(pid: string, reason: string, killerId?: string) {
    const p = this.players.get(pid);
    if (!p || p.isDead) return;
    if (this.isInvincibilityProtected(p, reason)) return;

    if (killerId && killerId !== pid) {
      const killer = this.players.get(killerId);
      if (killer) {
        killer.takeovers++;
      }
    }

    p.updateScore();
    p.finalScore = p.score;
    p.invincibleUntil = 0;
    p.isDead = true;
    p.deathAlpha = 1.0;
    p.deathReason = reason;
    this.updateAllScores();

    this.broadcast({ type: 'kill', playerId: pid, reason });
  }

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const botId = `bot_${i}`;
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const color = PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length];

      const { x, y } = this.findSpawnLocation();
      const bot = new PlayerState(botId, name, color, x, y, true);

      const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      bot.direction = dir;
      bot.nextDirection = dir;

      this.players.set(botId, bot);
    }
  }

  private spawnCollectibles(count: number, type: Collectible['type']) {
    for (let i = 0; i < count; i++) {
      const id = `col_${Math.random().toString(36).substr(2, 9)}`;
      const rx = Math.random() * (WORLD_WIDTH * 0.9) + (WORLD_WIDTH * 0.05);
      const ry = Math.random() * (WORLD_HEIGHT * 0.9) + (WORLD_HEIGHT * 0.05);
      const x = Math.floor(rx / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      const y = Math.floor(ry / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      this.collectibles.set(id, { id, x, y, type });
    }
  }

  private isPlayerInvincible(p: PlayerState, now: number = Date.now()) {
    return p.invincibleUntil > now;
  }

  private isInvincibilityProtected(p: PlayerState, reason: string) {
    if (!this.isPlayerInvincible(p)) return false;
    return reason !== 'all-territory-lost';
  }

  private getCellAt(x: number, y: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(y / CELL_SIZE)
    };
  }

  private updateAllScores() {
    this.players.forEach(p => p.updateScore());
  }

  private getLeaderboard(): LeaderboardEntry[] {
    return Array.from(this.players.values())
      .filter(p => !p.isDead || p.deathAlpha > 0)
      .map(p => ({ id: p.id, name: p.name, score: p.score, takeovers: p.takeovers, color: p.color }))
      .sort((a, b) => (b.score - a.score) || (b.takeovers - a.takeovers));
  }

  private serializePlayer(p: PlayerState): PlayerData {
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      x: p.x,
      y: p.y,
      direction: p.direction,
      territory: Array.from(p.territory),
      trail: p.trail.map(t => ({ x: t.x, y: t.y })),
      isDead: p.isDead,
      deathAlpha: p.deathAlpha,
      score: p.score,
      takeovers: p.takeovers,
      invincibleTimeLeft: Math.max(0, (p.invincibleUntil - Date.now()) / 1000),
      fireballs: p.fireballs,
      trailType: p.trailType,
      isBot: p.isBot
    };
  }

  private serializeFireball(fb: Fireball): FireballData {
    return { id: fb.id, x: fb.x, y: fb.y, vx: fb.vx, vy: fb.vy, ownerId: fb.ownerId, life: fb.life };
  }

  private serializeCollectible(col: Collectible): CollectibleData {
    return { id: col.id, x: col.x, y: col.y, type: col.type };
  }

  private getFullSnapshot(): GameStateSnapshot {
    return {
      players: Array.from(this.players.values()).map(p => this.serializePlayer(p)),
      fireballs: this.fireballs.map(fb => this.serializeFireball(fb)),
      collectibles: Array.from(this.collectibles.values()).map(c => this.serializeCollectible(c)),
      leaderboard: this.getLeaderboard()
    };
  }

  private broadcastState() {
    const msg: ServerMessage = {
      type: 'state',
      players: Array.from(this.players.values()).map(p => this.serializePlayer(p)),
      fireballs: this.fireballs.map(fb => this.serializeFireball(fb)),
      collectibles: Array.from(this.collectibles.values()).map(c => this.serializeCollectible(c))
    };
    this.broadcast(msg);
  }

  private broadcastLeaderboard() {
    const msg: ServerMessage = {
      type: 'leaderboard',
      board: this.getLeaderboard()
    };
    this.broadcast(msg);
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg);
    this.connections.forEach(conn => {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(data);
      }
    });
  }

  private sendToPlayer(playerId: string, msg: ServerMessage) {
    const conn = this.connections.get(playerId);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify(msg));
    }
  }

  getPlayerCount(): number {
    return Array.from(this.players.values()).filter(p => !p.isBot).length;
  }
}
