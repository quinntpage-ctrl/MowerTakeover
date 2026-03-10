import type { PlayerData, FireballData, CollectibleData, LeaderboardEntry } from '@shared/game/Protocol';
import { GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, Direction, PLAYER_SPEED, TICK_RATE } from '@shared/game/Constants';
import type { Point } from '@shared/game/Player';

interface GameCallbacks {
  onGameOver: (score: number, reason?: string, survivedSeconds?: number) => void;
  onScoreUpdate: (score: number) => void;
  onTakeoversUpdate?: (count: number) => void;
  onInvincibilityUpdate?: (seconds: number) => void;
  onSpeedBoostUpdate?: (seconds: number) => void;
  onLeaderboardUpdate: (board: LeaderboardEntry[]) => void;
  onFireballsUpdate?: (count: number) => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  type?: string;
}

interface ClaimFlash {
  x: number;
  y: number;
  alpha: number;
  color: string;
}

interface TerritoryRenderData {
  keys: Set<string>;
  cells: Point[];
}

interface PlayerSnapshot {
  x: number;
  y: number;
  direction: Direction;
  isDead: boolean;
  receivedAt: number;
}

interface FireballSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  receivedAt: number;
}

type ResolvedPlayerData = Omit<PlayerData, 'territory'> & { territory: string[] };

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  private localPlayerId: string = '';
  private players: ResolvedPlayerData[] = [];
  private fireballs: FireballData[] = [];
  private collectibles: CollectibleData[] = [];

  private territoryRenderCache: Map<string, TerritoryRenderData> = new Map();

  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;

  private camera = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  private particles: Particle[] = [];
  private claimFlashes: ClaimFlash[] = [];
  private logoImage: HTMLImageElement;
  private terrainCanvas: HTMLCanvasElement | null = null;
  private leaderId: string | null = null;
  private showSpeedBoostPointer: boolean = false;

  private displayPositions: Map<string, { x: number; y: number }> = new Map();
  private playerSnapshots: Map<string, PlayerSnapshot> = new Map();
  private fireballDisplayPositions: Map<string, { x: number; y: number }> = new Map();
  private fireballSnapshots: Map<string, FireballSnapshot> = new Map();

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
    this.callbacks = callbacks;

    this.logoImage = new Image();
    this.logoImage.src = '/logo.svg';
  }

  setLocalPlayerId(id: string) {
    this.localPlayerId = id;
  }

  setShowSpeedBoostPointer(show: boolean) {
    this.showSpeedBoostPointer = show;
  }

  applyState(players: PlayerData[], fireballs: FireballData[], collectibles: CollectibleData[]) {
    const snapshotTime = performance.now();
    const resolvedPlayers = this.resolvePlayers(players);
    const incomingPlayers = new Map(players.map(player => [player.id, player]));

    for (const p of resolvedPlayers) {
      const incomingPlayer = incomingPlayers.get(p.id);
      if (Array.isArray(incomingPlayer?.territory) || !this.territoryRenderCache.has(p.id)) {
        const nextTerritory = this.buildTerritoryRenderData(p.territory);
        const prevTerritory = this.territoryRenderCache.get(p.id);

        if (prevTerritory) {
          for (const key of nextTerritory.keys) {
            if (!prevTerritory.keys.has(key)) {
              const [cx, cy] = key.split(',').map(Number);
              this.claimFlashes.push({ x: cx, y: cy, alpha: 1.0, color: p.color });
            }
          }
        }

        this.territoryRenderCache.set(p.id, nextTerritory);
      }

      this.playerSnapshots.set(p.id, {
        x: p.x,
        y: p.y,
        direction: p.direction,
        isDead: p.isDead,
        receivedAt: snapshotTime,
      });

      if (!this.displayPositions.has(p.id)) {
        this.displayPositions.set(p.id, { x: p.x, y: p.y });
      }
    }

    const currentIds = new Set(resolvedPlayers.map(p => p.id));
    this.territoryRenderCache.forEach((_territory, id) => {
      if (!currentIds.has(id)) {
        this.territoryRenderCache.delete(id);
      }
    });
    this.displayPositions.forEach((_position, id) => {
      if (!currentIds.has(id)) {
        this.displayPositions.delete(id);
      }
    });
    this.playerSnapshots.forEach((_snapshot, id) => {
      if (!currentIds.has(id)) {
        this.playerSnapshots.delete(id);
      }
    });

    const currentFireballIds = new Set(fireballs.map(fb => fb.id));
    for (const fb of fireballs) {
      this.fireballSnapshots.set(fb.id, {
        x: fb.x,
        y: fb.y,
        vx: fb.vx,
        vy: fb.vy,
        receivedAt: snapshotTime,
      });

      if (!this.fireballDisplayPositions.has(fb.id)) {
        this.fireballDisplayPositions.set(fb.id, { x: fb.x, y: fb.y });
      }
    }
    this.fireballSnapshots.forEach((_snapshot, id) => {
      if (!currentFireballIds.has(id)) {
        this.fireballSnapshots.delete(id);
      }
    });
    this.fireballDisplayPositions.forEach((_position, id) => {
      if (!currentFireballIds.has(id)) {
        this.fireballDisplayPositions.delete(id);
      }
    });

    this.players = resolvedPlayers;
    this.fireballs = fireballs;
    this.collectibles = collectibles;

    const localP = this.players.find(p => p.id === this.localPlayerId);
    if (localP) {
      this.callbacks.onScoreUpdate(localP.score);
      this.callbacks.onTakeoversUpdate?.(localP.takeovers);
      this.callbacks.onInvincibilityUpdate?.(localP.invincibleTimeLeft);
      this.callbacks.onSpeedBoostUpdate?.(localP.speedBoostTimeLeft);
      this.callbacks.onFireballsUpdate?.(localP.fireballs);
    }

    this.spawnTrailParticles();
  }

  private resolvePlayers(players: PlayerData[]): ResolvedPlayerData[] {
    const previousPlayers = new Map(this.players.map(player => [player.id, player]));
    return players.map(player => {
      const territory = player.territory ?? previousPlayers.get(player.id)?.territory ?? [];
      return {
        ...(previousPlayers.get(player.id) ?? {}),
        ...player,
        territory,
      } as ResolvedPlayerData;
    });
  }

  private buildTerritoryRenderData(territory: string[]): TerritoryRenderData {
    return {
      keys: new Set(territory),
      cells: territory.map(key => this.parseCellKey(key)),
    };
  }

  private parseCellKey(key: string): Point {
    const separator = key.indexOf(',');
    return {
      x: Number(key.slice(0, separator)),
      y: Number(key.slice(separator + 1)),
    };
  }

  private ensureTerrainCanvas() {
    if (this.terrainCanvas) return;

    const canvas = document.createElement('canvas');
    canvas.width = WORLD_WIDTH;
    canvas.height = WORLD_HEIGHT;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    ctx.fillStyle = '#86efac';
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    ctx.fillStyle = '#22c55e';
    for (let x = 0; x < WORLD_WIDTH; x += CELL_SIZE) {
      for (let y = 0; y < WORLD_HEIGHT; y += CELL_SIZE) {
        const seed1 = (x * 13 + y * 37) % 100 / 100;
        const seed2 = (x * 59 + y * 17) % 100 / 100;

        const drawTuft = (sx: number, sy: number) => {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - 3, sy - 8);
          ctx.lineTo(sx + 1, sy - 10);
          ctx.lineTo(sx + 3, sy - 2);
          ctx.fill();
        };

        drawTuft(x + 5 + seed1 * 10, y + 15 + seed2 * 10);
        drawTuft(x + 18 + seed2 * 5, y + 25 + seed1 * 5);
      }
    }

    ctx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_WIDTH; x += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD_HEIGHT; y += CELL_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    this.terrainCanvas = canvas;
  }

  private spawnTrailParticles() {
    for (const p of this.players) {
      if (p.isDead) continue;
      const ip = this.getDisplayPos(p);
      const cellKey = `${Math.floor(ip.x / CELL_SIZE)},${Math.floor(ip.y / CELL_SIZE)}`;
      const terrSet = this.territoryRenderCache.get(p.id)?.keys;
      if (terrSet?.has(cellKey)) continue;

      if (Math.random() > 0.4) continue;

      let vx = 0, vy = 0, px = ip.x, py = ip.y;

      if (p.trailType === 'star') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*30; vy = 30+Math.random()*20; py += 15; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*30; vy = -30-Math.random()*20; py -= 15; }
        else if (p.direction === 'LEFT') { vx = 30+Math.random()*20; vy = (Math.random()-0.5)*30; px += 15; }
        else { vx = -30-Math.random()*20; vy = (Math.random()-0.5)*30; px -= 15; }
        this.particles.push({
          x: px+(Math.random()-0.5)*10, y: py+(Math.random()-0.5)*10,
          vx, vy, life: Math.random()*0.5+0.5, maxLife: 1.0,
          color: '#fef08a', size: Math.random()*4+4,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*2, type: 'star'
        });
      } else if (p.trailType === 'smile') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*10; vy = 10+Math.random()*10; py += 15; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*10; vy = -10-Math.random()*10; py -= 15; }
        else if (p.direction === 'LEFT') { vx = 10+Math.random()*10; vy = (Math.random()-0.5)*10; px += 15; }
        else { vx = -10-Math.random()*10; vy = (Math.random()-0.5)*10; px -= 15; }
        this.particles.push({
          x: px+(Math.random()-0.5)*5, y: py+(Math.random()-0.5)*5,
          vx, vy, life: Math.random()*0.8+0.4, maxLife: 1.2,
          color: '#fbbf24', size: Math.random()*6+8,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*1, type: 'smile'
        });
      } else if (p.trailType === 'money') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*24; vy = 18+Math.random()*16; py += 12; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*24; vy = -18-Math.random()*16; py -= 12; }
        else if (p.direction === 'LEFT') { vx = 18+Math.random()*16; vy = (Math.random()-0.5)*24; px += 12; }
        else { vx = -18-Math.random()*16; vy = (Math.random()-0.5)*24; px -= 12; }
        this.particles.push({
          x: px+(Math.random()-0.5)*10, y: py+(Math.random()-0.5)*10,
          vx, vy, life: Math.random()*0.7+0.45, maxLife: 1.15,
          color: ['#22c55e', '#4ade80', '#86efac'][Math.floor(Math.random()*3)],
          size: Math.random()*4+7,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*3, type: 'money'
        });
      } else if (p.trailType === 'bubble') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*16; vy = 6+Math.random()*10; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*16; vy = -6-Math.random()*10; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 6+Math.random()*10; vy = (Math.random()-0.5)*16; px += 10; }
        else { vx = -6-Math.random()*10; vy = (Math.random()-0.5)*16; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*8, y: py+(Math.random()-0.5)*8,
          vx, vy, life: Math.random()*0.6+0.55, maxLife: 1.15,
          color: ['#67e8f9', '#93c5fd', '#bfdbfe'][Math.floor(Math.random()*3)],
          size: Math.random()*4+6,
          rotation: 0, vRot: 0, type: 'bubble'
        });
      } else if (p.trailType === 'confetti') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*28; vy = 12+Math.random()*18; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*28; vy = -12-Math.random()*18; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 12+Math.random()*18; vy = (Math.random()-0.5)*28; px += 10; }
        else { vx = -12-Math.random()*18; vy = (Math.random()-0.5)*28; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*10, y: py+(Math.random()-0.5)*10,
          vx, vy, life: Math.random()*0.45+0.35, maxLife: 0.8,
          color: ['#f43f5e', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'][Math.floor(Math.random()*5)],
          size: Math.random()*4+4,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*8, type: 'confetti'
        });
      } else if (p.trailType === 'heart') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*16; vy = 12+Math.random()*10; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*16; vy = -12-Math.random()*10; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 12+Math.random()*10; vy = (Math.random()-0.5)*16; px += 10; }
        else { vx = -12-Math.random()*10; vy = (Math.random()-0.5)*16; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*8, y: py+(Math.random()-0.5)*8,
          vx, vy, life: Math.random()*0.55+0.45, maxLife: 1.0,
          color: ['#fb7185', '#f43f5e', '#fda4af'][Math.floor(Math.random()*3)],
          size: Math.random()*3+7,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*1.2, type: 'heart'
        });
      } else if (p.trailType === 'bolt') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*24; vy = 18+Math.random()*18; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*24; vy = -18-Math.random()*18; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 18+Math.random()*18; vy = (Math.random()-0.5)*24; px += 10; }
        else { vx = -18-Math.random()*18; vy = (Math.random()-0.5)*24; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*9, y: py+(Math.random()-0.5)*9,
          vx, vy, life: Math.random()*0.35+0.25, maxLife: 0.6,
          color: ['#facc15', '#fde047', '#fef08a'][Math.floor(Math.random()*3)],
          size: Math.random()*3+6,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*4, type: 'bolt'
        });
      } else if (p.trailType === 'leaf') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*14; vy = 10+Math.random()*12; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*14; vy = -10-Math.random()*12; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 10+Math.random()*12; vy = (Math.random()-0.5)*14; px += 10; }
        else { vx = -10-Math.random()*12; vy = (Math.random()-0.5)*14; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*7, y: py+(Math.random()-0.5)*7,
          vx, vy, life: Math.random()*0.5+0.45, maxLife: 0.95,
          color: ['#22c55e', '#4ade80', '#86efac'][Math.floor(Math.random()*3)],
          size: Math.random()*3+6,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*2.2, type: 'leaf'
        });
      } else if (p.trailType === 'gem') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*16; vy = 14+Math.random()*14; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*16; vy = -14-Math.random()*14; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 14+Math.random()*14; vy = (Math.random()-0.5)*16; px += 10; }
        else { vx = -14-Math.random()*14; vy = (Math.random()-0.5)*16; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*7, y: py+(Math.random()-0.5)*7,
          vx, vy, life: Math.random()*0.55+0.4, maxLife: 0.95,
          color: ['#06b6d4', '#67e8f9', '#a5f3fc'][Math.floor(Math.random()*3)],
          size: Math.random()*3+6,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*2.4, type: 'gem'
        });
      } else if (p.trailType === 'music') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*12; vy = 8+Math.random()*10; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*12; vy = -8-Math.random()*10; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 8+Math.random()*10; vy = (Math.random()-0.5)*12; px += 10; }
        else { vx = -8-Math.random()*10; vy = (Math.random()-0.5)*12; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*6, y: py+(Math.random()-0.5)*6,
          vx, vy, life: Math.random()*0.65+0.4, maxLife: 1.05,
          color: ['#8b5cf6', '#a78bfa', '#c4b5fd'][Math.floor(Math.random()*3)],
          size: Math.random()*3+6,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*1.4, type: 'music'
        });
      } else if (p.trailType === 'snow') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*10; vy = 6+Math.random()*8; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*10; vy = -6-Math.random()*8; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 6+Math.random()*8; vy = (Math.random()-0.5)*10; px += 10; }
        else { vx = -6-Math.random()*8; vy = (Math.random()-0.5)*10; px -= 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*6, y: py+(Math.random()-0.5)*6,
          vx, vy, life: Math.random()*0.7+0.5, maxLife: 1.15,
          color: ['#e2e8f0', '#ffffff', '#bfdbfe'][Math.floor(Math.random()*3)],
          size: Math.random()*2+5,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*1.6, type: 'snow'
        });
      } else {
        if (p.direction === 'UP') { vx = 80+Math.random()*40; vy = (Math.random()-0.5)*40; px += 10; }
        else if (p.direction === 'DOWN') { vx = -80-Math.random()*40; vy = (Math.random()-0.5)*40; px -= 10; }
        else if (p.direction === 'LEFT') { vx = (Math.random()-0.5)*40; vy = -80-Math.random()*40; py -= 10; }
        else { vx = (Math.random()-0.5)*40; vy = 80+Math.random()*40; py += 10; }
        this.particles.push({
          x: px+(Math.random()-0.5)*10, y: py+(Math.random()-0.5)*10,
          vx, vy, life: Math.random()*0.3+0.2, maxLife: 0.5,
          color: '#4ade80', size: Math.random()*3+2,
          rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*15
        });
      }
    }
  }

  applyLeaderboard(board: LeaderboardEntry[]) {
    this.leaderId = board[0]?.id ?? null;
    this.callbacks.onLeaderboardUpdate(board);
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  start() {
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.renderLoop);
  }

  stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private renderLoop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    for (const p of this.players) {
      const dp = this.displayPositions.get(p.id);
      const snapshot = this.playerSnapshots.get(p.id);
      if (dp && snapshot) {
        this.updateDisplayPosition(dp, snapshot, p, dt);
      }
    }

    for (const fb of this.fireballs) {
      const displayPos = this.fireballDisplayPositions.get(fb.id);
      const snapshot = this.fireballSnapshots.get(fb.id);
      if (displayPos && snapshot) {
        this.updateFireballDisplayPosition(displayPos, snapshot, dt);
      }
    }

    const localP = this.players.find(p => p.id === this.localPlayerId);
    if (localP) {
      const dp = this.displayPositions.get(localP.id);
      if (dp) {
        const smoothing = 1 - Math.pow(0.00001, dt);
        this.camera.x += (dp.x - this.camera.x) * smoothing;
        this.camera.y += (dp.y - this.camera.y) * smoothing;
      }
    }

    this.updateEffects(dt);
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  private updateDisplayPosition(dp: { x: number; y: number }, snapshot: PlayerSnapshot, p: ResolvedPlayerData, dt: number) {
    let vx = 0;
    let vy = 0;
    if (!snapshot.isDead) {
      if (snapshot.direction === 'UP') vy = -PLAYER_SPEED;
      else if (snapshot.direction === 'DOWN') vy = PLAYER_SPEED;
      else if (snapshot.direction === 'LEFT') vx = -PLAYER_SPEED;
      else vx = PLAYER_SPEED;
    }

    const elapsedSinceSnapshot = Math.min(Math.max(0, (this.lastTimestamp - snapshot.receivedAt) / 1000), 2 / TICK_RATE);
    const targetX = Math.max(0, Math.min(WORLD_WIDTH - 0.001, snapshot.x + vx * elapsedSinceSnapshot));
    const targetY = Math.max(0, Math.min(WORLD_HEIGHT - 0.001, snapshot.y + vy * elapsedSinceSnapshot));

    const authDx = p.x - dp.x;
    const authDy = p.y - dp.y;

    // Snap on large corrections like respawns or reconnects.
    if (Math.hypot(authDx, authDy) > CELL_SIZE * 1.5) {
      dp.x = p.x;
      dp.y = p.y;
      return;
    }

    if (snapshot.isDead) {
      const correction = 1 - Math.pow(0.001, dt);
      dp.x += authDx * correction;
      dp.y += authDy * correction;
      return;
    }

    dp.x += vx * dt;
    dp.y += vy * dt;

    const dx = targetX - dp.x;
    const dy = targetY - dp.y;
    const correction = 1 - Math.pow(0.0001, dt);

    dp.x += dx * correction;
    dp.y += dy * correction;
  }

  private getDisplayPos(p: ResolvedPlayerData): { x: number; y: number; direction: Direction } {
    const dp = this.displayPositions.get(p.id);
    if (!dp) return { x: p.x, y: p.y, direction: p.direction };
    return { x: dp.x, y: dp.y, direction: p.direction };
  }

  private updateFireballDisplayPosition(
    displayPos: { x: number; y: number },
    snapshot: { x: number; y: number; vx: number; vy: number; receivedAt: number },
    dt: number
  ) {
    const elapsedSinceSnapshot = Math.min(Math.max(0, (this.lastTimestamp - snapshot.receivedAt) / 1000), 2 / TICK_RATE);
    const targetX = Math.max(0, Math.min(WORLD_WIDTH, snapshot.x + snapshot.vx * elapsedSinceSnapshot));
    const targetY = Math.max(0, Math.min(WORLD_HEIGHT, snapshot.y + snapshot.vy * elapsedSinceSnapshot));

    displayPos.x += snapshot.vx * dt;
    displayPos.y += snapshot.vy * dt;

    const dx = targetX - displayPos.x;
    const dy = targetY - displayPos.y;

    if (Math.hypot(dx, dy) > CELL_SIZE) {
      displayPos.x = targetX;
      displayPos.y = targetY;
      return;
    }

    const correction = 1 - Math.pow(0.0001, dt);
    displayPos.x += dx * correction;
    displayPos.y += dy * correction;
  }

  private getDisplayFireballPos(fb: FireballData): { x: number; y: number } {
    const displayPos = this.fireballDisplayPositions.get(fb.id);
    if (!displayPos) return { x: fb.x, y: fb.y };
    return displayPos;
  }

  private buildTrailPath(p: ResolvedPlayerData, ip: { x: number; y: number; direction: Direction }): Path2D | null {
    if (p.trail.length === 0) return null;

    const path = new Path2D();
    const territoryKeys = this.territoryRenderCache.get(p.id)?.keys;
    for (let i = 0; i < p.trail.length; i++) {
      const cell = p.trail[i];
      let tcx = cell.x * CELL_SIZE + CELL_SIZE / 2;
      let tcy = cell.y * CELL_SIZE + CELL_SIZE / 2;

      if (i === p.trail.length - 1) {
        if (ip.direction === 'RIGHT' && tcx > ip.x) tcx = ip.x;
        if (ip.direction === 'LEFT' && tcx < ip.x) tcx = ip.x;
        if (ip.direction === 'DOWN' && tcy > ip.y) tcy = ip.y;
        if (ip.direction === 'UP' && tcy < ip.y) tcy = ip.y;
      }

      if (i === 0) {
        let sx = tcx;
        let sy = tcy;
        if (territoryKeys?.has(`${cell.x - 1},${cell.y}`)) sx -= CELL_SIZE;
        else if (territoryKeys?.has(`${cell.x + 1},${cell.y}`)) sx += CELL_SIZE;
        else if (territoryKeys?.has(`${cell.x},${cell.y - 1}`)) sy -= CELL_SIZE;
        else if (territoryKeys?.has(`${cell.x},${cell.y + 1}`)) sy += CELL_SIZE;
        path.moveTo(sx, sy);
      }

      path.lineTo(tcx, tcy);
    }

    path.lineTo(ip.x, ip.y);
    return path;
  }

  private drawStandardTrail(path: Path2D, color: string) {
    this.ctx.strokeStyle = color + 'AA';
    this.ctx.lineWidth = CELL_SIZE * 0.8;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.setLineDash([]);
    this.ctx.lineDashOffset = 0;
    this.ctx.stroke(path);
  }

  private drawRainbowTrail(path: Path2D) {
    const colors = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#32ade6', '#5856d6', '#ff2d92'];
    const segment = 18;
    const cycle = segment * colors.length;
    const offset = (this.lastTimestamp / 35) % cycle;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    this.ctx.lineWidth = CELL_SIZE * 0.92;
    this.ctx.setLineDash([]);
    this.ctx.lineDashOffset = 0;
    this.ctx.stroke(path);

    for (let i = 0; i < colors.length; i++) {
      this.ctx.strokeStyle = colors[i];
      this.ctx.lineWidth = CELL_SIZE * 0.62;
      this.ctx.setLineDash([segment, cycle - segment]);
      this.ctx.lineDashOffset = -(offset + i * segment);
      this.ctx.stroke(path);
    }

    this.ctx.setLineDash([]);
    this.ctx.lineDashOffset = 0;
  }

  private updateEffects(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.claimFlashes.length - 1; i >= 0; i--) {
      const flash = this.claimFlashes[i];
      flash.alpha -= dt * 2.0;
      if (flash.alpha <= 0) {
        this.claimFlashes.splice(i, 1);
      }
    }
  }

  private getNearestSpeedBoost(localPos: { x: number; y: number }) {
    let nearest: CollectibleData | null = null;
    let nearestDistanceSq = Infinity;

    for (const collectible of this.collectibles) {
      if (collectible.type !== 'speed') continue;
      const dx = collectible.x - localPos.x;
      const dy = collectible.y - localPos.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq < nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearest = collectible;
      }
    }

    return nearest;
  }

  private drawLightningBolt(size: number, fillStyle: string, strokeStyle?: string, lineWidth: number = 0) {
    this.ctx.beginPath();
    this.ctx.moveTo(-size * 0.16, -size * 0.72);
    this.ctx.lineTo(size * 0.22, -size * 0.72);
    this.ctx.lineTo(-size * 0.02, -size * 0.12);
    this.ctx.lineTo(size * 0.26, -size * 0.12);
    this.ctx.lineTo(-size * 0.32, size * 0.72);
    this.ctx.lineTo(-size * 0.08, size * 0.16);
    this.ctx.lineTo(-size * 0.34, size * 0.16);
    this.ctx.closePath();
    this.ctx.fillStyle = fillStyle;
    this.ctx.fill();

    if (strokeStyle && lineWidth > 0) {
      this.ctx.strokeStyle = strokeStyle;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();
    }
  }

  private drawSpeedBoostPointer(localPos: { x: number; y: number }) {
    if (!this.showSpeedBoostPointer) return;

    const nearest = this.getNearestSpeedBoost(localPos);
    if (!nearest) return;

    const screenX = nearest.x - this.camera.x + this.width / 2;
    const screenY = nearest.y - this.camera.y + this.height / 2;
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    const dx = screenX - centerX;
    const dy = screenY - centerY;
    const margin = 54;
    const isVisible =
      screenX >= margin &&
      screenX <= this.width - margin &&
      screenY >= margin &&
      screenY <= this.height - margin;

    this.ctx.save();

    if (isVisible) {
      const pulse = 1 + 0.16 * Math.sin(this.lastTimestamp / 140);
      this.ctx.translate(screenX, screenY);

      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 3;
      this.ctx.shadowColor = 'rgba(250, 204, 21, 0.95)';
      this.ctx.shadowBlur = 18;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
      this.ctx.stroke();

      this.drawLightningBolt(14 * pulse, '#facc15', '#ffffff', 1.5);
      this.ctx.shadowBlur = 0;
    } else {
      const angle = Math.atan2(dy, dx);
      const halfWidth = this.width / 2 - margin;
      const halfHeight = this.height / 2 - margin;
      const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight, 0.0001);
      const pointerX = centerX + dx * scale;
      const pointerY = centerY + dy * scale;

      this.ctx.translate(pointerX, pointerY);
      this.ctx.rotate(angle);

      this.ctx.fillStyle = '#facc15';
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.shadowColor = 'rgba(250, 204, 21, 0.95)';
      this.ctx.shadowBlur = 16;
      this.ctx.beginPath();
      this.ctx.moveTo(18, 0);
      this.ctx.lineTo(-10, -10);
      this.ctx.lineTo(-2, 0);
      this.ctx.lineTo(-10, 10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();

      this.ctx.shadowBlur = 0;
    }

    this.ctx.restore();
  }

  private draw() {
    this.ctx.fillStyle = '#f3f4f6';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ensureTerrainCanvas();

    this.ctx.save();
    this.ctx.translate(
      Math.floor(this.width / 2 - this.camera.x),
      Math.floor(this.height / 2 - this.camera.y)
    );

    const startX = Math.floor((this.camera.x - this.width / 2) / CELL_SIZE) * CELL_SIZE;
    const endX = startX + this.width + CELL_SIZE * 2;
    const startY = Math.floor((this.camera.y - this.height / 2) / CELL_SIZE) * CELL_SIZE;
    const endY = startY + this.height + CELL_SIZE * 2;

    const grassStartX = Math.max(0, startX);
    const grassStartY = Math.max(0, startY);
    const grassEndX = Math.min(WORLD_WIDTH, endX);
    const grassEndY = Math.min(WORLD_HEIGHT, endY);

    if (this.terrainCanvas && grassEndX > grassStartX && grassEndY > grassStartY) {
      const drawWidth = grassEndX - grassStartX;
      const drawHeight = grassEndY - grassStartY;
      this.ctx.drawImage(
        this.terrainCanvas,
        grassStartX,
        grassStartY,
        drawWidth,
        drawHeight,
        grassStartX,
        grassStartY,
        drawWidth,
        drawHeight
      );
    }

    this.ctx.strokeStyle = '#EC098D';
    this.ctx.lineWidth = 6;
    this.ctx.shadowColor = '#EC098D';
    this.ctx.shadowBlur = 15;
    this.ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.ctx.shadowBlur = 0;

    const lp = this.players.find(p => p.id === this.localPlayerId);
    const lpInterp = lp ? this.getDisplayPos(lp) : null;
    if (lp && lpInterp && this.logoImage.complete && this.logoImage.naturalWidth > 0) {
      const drawOuterLogo = (x: number, y: number, rotation: number) => {
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.rotate(rotation);
        const lw = 400;
        const lh = 400 * (90.8 / 513.5);
        this.ctx.drawImage(this.logoImage, -lw / 2, -lh / 2 - 20, lw, lh);
        this.ctx.fillStyle = '#333333';
        this.ctx.font = 'bold 24px "Neue Haas Grotesk", "Inter", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText("Go to mower.com to see what we are all about!", 0, lh / 2 + 20);
        this.ctx.restore();
      };

      const px = Math.max(400, Math.min(WORLD_WIDTH - 400, lpInterp.x));
      const py = Math.max(400, Math.min(WORLD_HEIGHT - 400, lpInterp.y));

      drawOuterLogo(px, -150, 0);
      drawOuterLogo(px, WORLD_HEIGHT + 150, 0);
      drawOuterLogo(-150, py, -Math.PI / 2);
      drawOuterLogo(WORLD_WIDTH + 150, py, Math.PI / 2);
    }

    for (const p of this.players) {
      if (p.isDead && p.deathAlpha <= 0) continue;
      const territory = this.territoryRenderCache.get(p.id);

      this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

      if (territory) {
        for (const cell of territory.cells) {
          const cx = cell.x;
          const cy = cell.y;
          if (cx * CELL_SIZE >= startX - CELL_SIZE && cx * CELL_SIZE <= endX &&
              cy * CELL_SIZE >= startY - CELL_SIZE && cy * CELL_SIZE <= endY) {
            this.ctx.fillStyle = p.color + '66';
            this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            this.ctx.fillStyle = p.color + '33';
            if (cy % 2 === 0) {
              this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
          }
        }
      }
    }

    this.claimFlashes.forEach(flash => {
      if (flash.x * CELL_SIZE >= startX - CELL_SIZE && flash.x * CELL_SIZE <= endX &&
          flash.y * CELL_SIZE >= startY - CELL_SIZE && flash.y * CELL_SIZE <= endY) {
        this.ctx.fillStyle = flash.color;
        this.ctx.globalAlpha = flash.alpha;
        this.ctx.fillRect(flash.x * CELL_SIZE, flash.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    });

    this.ctx.globalAlpha = 1.0;

    this.collectibles.forEach(col => {
      if (col.x >= startX && col.x <= endX && col.y >= startY && col.y <= endY) {
        this.ctx.save();
        this.ctx.translate(col.x, col.y);

        const bobY = Math.sin(this.lastTimestamp / 200) * 4;
        this.ctx.translate(0, bobY);

        if (col.type === 'fireball') {
          this.ctx.shadowColor = '#f97316';
          this.ctx.shadowBlur = 15;

          this.ctx.fillStyle = '#ef4444';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = '#eab308';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 4, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (col.type === 'invincibility') {
          this.ctx.shadowColor = '#38bdf8';
          this.ctx.shadowBlur = 18;

          this.ctx.strokeStyle = '#e0f2fe';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
          this.ctx.stroke();

          this.ctx.fillStyle = '#38bdf8';
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.strokeStyle = '#f8fafc';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.moveTo(0, -7);
          this.ctx.lineTo(0, 7);
          this.ctx.stroke();
        } else {
          const pulse = 1 + 0.12 * Math.sin(this.lastTimestamp / 120);
          this.ctx.shadowColor = '#facc15';
          this.ctx.shadowBlur = 28;

          this.ctx.strokeStyle = 'rgba(255,255,255,0.95)';
          this.ctx.lineWidth = 2.5;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
          this.ctx.stroke();

          this.drawLightningBolt(16 * pulse, '#facc15', '#ffffff', 1.8);
          this.ctx.shadowBlur = 0;
        }

        this.ctx.restore();
      }
    });

    for (const p of this.players) {
      if (p.isDead && p.deathAlpha <= 0) continue;

      const ip = this.getDisplayPos(p);
      this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

      this.ctx.fillStyle = p.color + 'AA';
      if (p.trail.length > 0) {
        const trailPath = this.buildTrailPath(p, ip);
        if (trailPath) {
          if (p.invincibleTimeLeft > 0) this.drawRainbowTrail(trailPath);
          else this.drawStandardTrail(trailPath, p.color);
        }
      }

      this.ctx.save();
      this.ctx.translate(ip.x, ip.y);
      if (ip.direction === 'RIGHT') this.ctx.rotate(Math.PI / 2);
      else if (ip.direction === 'DOWN') this.ctx.rotate(Math.PI);
      else if (ip.direction === 'LEFT') this.ctx.rotate(-Math.PI / 2);

      if (!p.isDead && this.leaderId === p.id) {
        const pulse = 0.72 + 0.28 * Math.sin(this.lastTimestamp / 180);
        this.ctx.strokeStyle = '#fde047';
        this.ctx.lineWidth = 6;
        this.ctx.shadowColor = 'rgba(253, 224, 71, 0.85)';
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.roundRect(-24, -22, 48, 44, 12);
        this.ctx.stroke();

        this.ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.25})`;
        this.ctx.lineWidth = 2;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.roundRect(-28, -26, 56, 52, 16);
        this.ctx.stroke();
      }

      if (p.invincibleTimeLeft > 0) {
        this.ctx.strokeStyle = '#38bdf8';
        this.ctx.lineWidth = 4;
        this.ctx.shadowColor = '#38bdf8';
        this.ctx.shadowBlur = 14;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
      }

      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.roundRect(-14, -12, 28, 24, 4);
      this.ctx.fill();

      this.ctx.fillStyle = '#333';
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.strokeStyle = '#444';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(-10, 12);
      this.ctx.lineTo(-10, 20);
      this.ctx.lineTo(10, 20);
      this.ctx.lineTo(10, 12);
      this.ctx.stroke();

      this.ctx.fillStyle = '#111';
      this.ctx.fillRect(-16, -10, 4, 8);
      this.ctx.fillRect(12, -10, 4, 8);
      this.ctx.fillRect(-16, 2, 4, 8);
      this.ctx.fillRect(12, 2, 4, 8);

      this.ctx.restore();

      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 12px Nunito';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.name, ip.x, ip.y - 25);

      this.ctx.globalAlpha = 1.0;
    }

    this.particles.forEach(p => {
      if (p.x >= startX && p.x <= endX && p.y >= startY && p.y <= endY) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);
        this.ctx.globalAlpha = p.life / p.maxLife;

        if (p.type === 'star') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            this.ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * p.size,
                            -Math.sin((18 + i * 72) * Math.PI / 180) * p.size);
            this.ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * (p.size * 0.5),
                            -Math.sin((54 + i * 72) * Math.PI / 180) * (p.size * 0.5));
          }
          this.ctx.closePath();
          this.ctx.fill();
        } else if (p.type === 'smile') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.fillStyle = '#000';
          this.ctx.beginPath();
          this.ctx.arc(-p.size * 0.3, -p.size * 0.2, p.size * 0.15, 0, Math.PI * 2);
          this.ctx.arc(p.size * 0.3, -p.size * 0.2, p.size * 0.15, 0, Math.PI * 2);
          this.ctx.fill();

          this.ctx.strokeStyle = '#000';
          this.ctx.lineWidth = p.size * 0.1;
          this.ctx.beginPath();
          this.ctx.arc(0, p.size * 0.1, p.size * 0.5, 0.1, Math.PI - 0.1);
          this.ctx.stroke();
        } else if (p.type === 'money') {
          this.ctx.fillStyle = p.color;
          this.ctx.strokeStyle = '#166534';
          this.ctx.lineWidth = 1.5;
          this.ctx.beginPath();
          this.ctx.roundRect(-p.size * 0.75, -p.size * 0.45, p.size * 1.5, p.size * 0.9, 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.strokeStyle = '#14532d';
          this.ctx.lineWidth = 1;
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size * 0.22, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.beginPath();
          this.ctx.moveTo(0, -p.size * 0.18);
          this.ctx.lineTo(0, p.size * 0.18);
          this.ctx.stroke();
        } else if (p.type === 'bubble') {
          this.ctx.fillStyle = `${p.color}55`;
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = Math.max(1.5, p.size * 0.12);
          this.ctx.beginPath();
          this.ctx.arc(0, 0, p.size * 0.55, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.stroke();

          this.ctx.fillStyle = '#ffffffAA';
          this.ctx.beginPath();
          this.ctx.arc(-p.size * 0.18, -p.size * 0.18, p.size * 0.12, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.type === 'confetti') {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size * 0.4, -p.size * 0.22, p.size * 0.8, p.size * 0.44);
        } else if (p.type === 'heart') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.moveTo(0, p.size * 0.55);
          this.ctx.bezierCurveTo(p.size * 0.8, p.size * 0.1, p.size * 0.8, -p.size * 0.45, 0, -p.size * 0.1);
          this.ctx.bezierCurveTo(-p.size * 0.8, -p.size * 0.45, -p.size * 0.8, p.size * 0.1, 0, p.size * 0.55);
          this.ctx.fill();
        } else if (p.type === 'bolt') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.moveTo(-p.size * 0.2, -p.size * 0.6);
          this.ctx.lineTo(p.size * 0.25, -p.size * 0.6);
          this.ctx.lineTo(-p.size * 0.02, -p.size * 0.05);
          this.ctx.lineTo(p.size * 0.32, -p.size * 0.05);
          this.ctx.lineTo(-p.size * 0.3, p.size * 0.65);
          this.ctx.lineTo(-p.size * 0.02, p.size * 0.12);
          this.ctx.lineTo(-p.size * 0.34, p.size * 0.12);
          this.ctx.closePath();
          this.ctx.fill();
        } else if (p.type === 'leaf') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.ellipse(0, 0, p.size * 0.55, p.size * 0.32, Math.PI / 4, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = '#166534';
          this.ctx.lineWidth = Math.max(1, p.size * 0.08);
          this.ctx.beginPath();
          this.ctx.moveTo(-p.size * 0.28, p.size * 0.18);
          this.ctx.lineTo(p.size * 0.3, -p.size * 0.22);
          this.ctx.stroke();
        } else if (p.type === 'gem') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.moveTo(0, -p.size * 0.7);
          this.ctx.lineTo(p.size * 0.55, 0);
          this.ctx.lineTo(0, p.size * 0.7);
          this.ctx.lineTo(-p.size * 0.55, 0);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.strokeStyle = '#0f766e';
          this.ctx.lineWidth = Math.max(1, p.size * 0.08);
          this.ctx.stroke();
        } else if (p.type === 'music') {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(-p.size * 0.18, p.size * 0.2, p.size * 0.22, 0, Math.PI * 2);
          this.ctx.arc(p.size * 0.2, p.size * 0.08, p.size * 0.22, 0, Math.PI * 2);
          this.ctx.fill();
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = Math.max(1.6, p.size * 0.12);
          this.ctx.beginPath();
          this.ctx.moveTo(-p.size * 0.02, p.size * 0.18);
          this.ctx.lineTo(-p.size * 0.02, -p.size * 0.55);
          this.ctx.lineTo(p.size * 0.35, -p.size * 0.42);
          this.ctx.lineTo(p.size * 0.35, p.size * 0.08);
          this.ctx.stroke();
        } else if (p.type === 'snow') {
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = Math.max(1.2, p.size * 0.08);
          for (let i = 0; i < 3; i++) {
            this.ctx.beginPath();
            this.ctx.moveTo(-p.size * 0.55, 0);
            this.ctx.lineTo(p.size * 0.55, 0);
            this.ctx.stroke();
            this.ctx.rotate(Math.PI / 3);
          }
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        this.ctx.restore();
      }
    });

    this.fireballs.forEach(fb => {
      const displayPos = this.getDisplayFireballPos(fb);
      if (displayPos.x >= startX && displayPos.x <= endX && displayPos.y >= startY && displayPos.y <= endY) {
        this.ctx.save();
        this.ctx.translate(displayPos.x, displayPos.y);

        this.ctx.shadowColor = '#f97316';
        this.ctx.shadowBlur = 10;

        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = '#eab308';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 6, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();

        if (Math.random() < 0.5) {
          this.particles.push({
            x: displayPos.x + (Math.random() - 0.5) * 10,
            y: displayPos.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 20,
            vy: -20 - Math.random() * 20,
            life: Math.random() * 0.3 + 0.2,
            maxLife: 0.5,
            color: ['#f97316', '#ef4444', '#eab308'][Math.floor(Math.random() * 3)],
            size: Math.random() * 4 + 2,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 5
          });
        }
      }
    });

    this.ctx.restore();

    if (lpInterp) {
      this.drawSpeedBoostPointer(lpInterp);
    }
  }
}
