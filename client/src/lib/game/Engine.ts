import type { PlayerData, FireballData, CollectibleData, LeaderboardEntry } from '@shared/game/Protocol';
import { GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, Direction } from '@shared/game/Constants';
import type { Point } from '@shared/game/Player';

interface GameCallbacks {
  onGameOver: (score: number, reason?: string) => void;
  onScoreUpdate: (score: number) => void;
  onTakeoversUpdate?: (count: number) => void;
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

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;

  private localPlayerId: string = '';
  private players: PlayerData[] = [];
  private fireballs: FireballData[] = [];
  private collectibles: CollectibleData[] = [];

  private prevTerritories: Map<string, Set<string>> = new Map();

  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  private lastTimestamp: number = 0;

  private camera = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  private particles: Particle[] = [];
  private claimFlashes: ClaimFlash[] = [];
  private logoImage: HTMLImageElement;

  private displayPositions: Map<string, { x: number; y: number }> = new Map();

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

  applyState(players: PlayerData[], fireballs: FireballData[], collectibles: CollectibleData[]) {
    for (const p of players) {
      const prevTerrSet = this.prevTerritories.get(p.id);
      const newTerrSet = new Set(p.territory);

      if (prevTerrSet) {
        for (const key of p.territory) {
          if (!prevTerrSet.has(key)) {
            const [cx, cy] = key.split(',').map(Number);
            this.claimFlashes.push({ x: cx, y: cy, alpha: 1.0, color: p.color });
          }
        }
      }

      this.prevTerritories.set(p.id, newTerrSet);

      if (!this.displayPositions.has(p.id)) {
        this.displayPositions.set(p.id, { x: p.x, y: p.y });
      }
    }

    const currentIds = new Set(players.map(p => p.id));
    this.prevTerritories.forEach((_territory, id) => {
      if (!currentIds.has(id)) {
        this.prevTerritories.delete(id);
      }
    });
    this.displayPositions.forEach((_position, id) => {
      if (!currentIds.has(id)) {
        this.displayPositions.delete(id);
      }
    });

    this.players = players;
    this.fireballs = fireballs;
    this.collectibles = collectibles;

    const localP = this.players.find(p => p.id === this.localPlayerId);
    if (localP) {
      this.callbacks.onScoreUpdate(localP.score);
      this.callbacks.onTakeoversUpdate?.(localP.takeovers);
      this.callbacks.onFireballsUpdate?.(localP.fireballs);
    }

    this.spawnTrailParticles();
  }

  private spawnTrailParticles() {
    for (const p of this.players) {
      if (p.isDead) continue;
      const ip = this.getDisplayPos(p);
      const cellKey = `${Math.floor(ip.x / CELL_SIZE)},${Math.floor(ip.y / CELL_SIZE)}`;
      const terrSet = this.prevTerritories.get(p.id);
      if (terrSet && terrSet.has(cellKey)) continue;

      if (Math.random() > 0.4) continue;

      let vx = 0, vy = 0, px = ip.x, py = ip.y;

      if (p.trailType === 'flame') {
        if (p.direction === 'UP') { vx = (Math.random()-0.5)*20; vy = 40+Math.random()*40; py += 10; }
        else if (p.direction === 'DOWN') { vx = (Math.random()-0.5)*20; vy = -40-Math.random()*40; py -= 10; }
        else if (p.direction === 'LEFT') { vx = 40+Math.random()*40; vy = (Math.random()-0.5)*20; px += 10; }
        else { vx = -40-Math.random()*40; vy = (Math.random()-0.5)*20; px -= 10; }
        const colors = ['#f97316', '#ef4444', '#eab308'];
        this.particles.push({
          x: px+(Math.random()-0.5)*15, y: py+(Math.random()-0.5)*15,
          vx, vy, life: Math.random()*0.4+0.3, maxLife: 0.7,
          color: colors[Math.floor(Math.random()*colors.length)],
          size: Math.random()*6+4, rotation: Math.random()*Math.PI*2, vRot: (Math.random()-0.5)*5
        });
      } else if (p.trailType === 'star') {
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

    const smoothing = 1 - Math.pow(0.00001, dt);
    for (const p of this.players) {
      const dp = this.displayPositions.get(p.id);
      if (dp) {
        dp.x += (p.x - dp.x) * smoothing;
        dp.y += (p.y - dp.y) * smoothing;
      }
    }

    const localP = this.players.find(p => p.id === this.localPlayerId);
    if (localP) {
      const dp = this.displayPositions.get(localP.id);
      if (dp) {
        this.camera.x += (dp.x - this.camera.x) * smoothing;
        this.camera.y += (dp.y - this.camera.y) * smoothing;
      }
    }

    this.updateEffects(dt);
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.renderLoop);
  }

  private getDisplayPos(p: PlayerData): { x: number; y: number; direction: Direction } {
    const dp = this.displayPositions.get(p.id);
    if (!dp) return { x: p.x, y: p.y, direction: p.direction };
    return { x: dp.x, y: dp.y, direction: p.direction };
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

  private draw() {
    this.ctx.fillStyle = '#f3f4f6';
    this.ctx.fillRect(0, 0, this.width, this.height);

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

    if (grassEndX > grassStartX && grassEndY > grassStartY) {
      this.ctx.fillStyle = '#86efac';
      this.ctx.fillRect(grassStartX, grassStartY, grassEndX - grassStartX, grassEndY - grassStartY);

      const claimedCells = new Set<string>();
      for (const p of this.players) {
        if (!p.isDead) {
          for (const key of p.territory) {
            claimedCells.add(key);
          }
        }
      }

      this.ctx.fillStyle = '#22c55e';
      for (let x = Math.max(0, Math.floor(grassStartX / CELL_SIZE) * CELL_SIZE); x < grassEndX; x += CELL_SIZE) {
        for (let y = Math.max(0, Math.floor(grassStartY / CELL_SIZE) * CELL_SIZE); y < grassEndY; y += CELL_SIZE) {
          const key = `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
          if (!claimedCells.has(key)) {
            const seed1 = (x * 13 + y * 37) % 100 / 100;
            const seed2 = (x * 59 + y * 17) % 100 / 100;

            const drawTuft = (sx: number, sy: number) => {
              this.ctx.beginPath();
              this.ctx.moveTo(sx, sy);
              this.ctx.lineTo(sx - 3, sy - 8);
              this.ctx.lineTo(sx + 1, sy - 10);
              this.ctx.lineTo(sx + 3, sy - 2);
              this.ctx.fill();
            };

            drawTuft(x + 5 + seed1 * 10, y + 15 + seed2 * 10);
            drawTuft(x + 18 + seed2 * 5, y + 25 + seed1 * 5);
          }
        }
      }

      this.ctx.strokeStyle = '#4ade80';
      this.ctx.lineWidth = 1;
      for (let x = Math.max(0, Math.floor(grassStartX / CELL_SIZE) * CELL_SIZE); x <= grassEndX; x += CELL_SIZE) {
        for (let y = Math.max(0, Math.floor(grassStartY / CELL_SIZE) * CELL_SIZE); y <= grassEndY; y += CELL_SIZE) {
          const key = `${Math.floor(x / CELL_SIZE)},${Math.floor(y / CELL_SIZE)}`;
          if (!claimedCells.has(key)) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x + CELL_SIZE, y);
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(x, y + CELL_SIZE);
            this.ctx.stroke();
          }
        }
      }
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
      drawOuterLogo(px, WORLD_HEIGHT + 150, Math.PI);
      drawOuterLogo(-150, py, -Math.PI / 2);
      drawOuterLogo(WORLD_WIDTH + 150, py, Math.PI / 2);
    }

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
        }

        this.ctx.restore();
      }
    });

    for (const p of this.players) {
      if (p.isDead && p.deathAlpha <= 0) continue;

      const ip = this.getDisplayPos(p);

      this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

      for (const key of p.territory) {
        const [cx, cy] = key.split(',').map(Number);
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

      this.claimFlashes.forEach(flash => {
        if (flash.x * CELL_SIZE >= startX - CELL_SIZE && flash.x * CELL_SIZE <= endX &&
            flash.y * CELL_SIZE >= startY - CELL_SIZE && flash.y * CELL_SIZE <= endY) {
          this.ctx.fillStyle = flash.color;
          this.ctx.globalAlpha = flash.alpha;
          this.ctx.fillRect(flash.x * CELL_SIZE, flash.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      });

      this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

      this.ctx.fillStyle = p.color + 'AA';
      if (p.trail.length > 0) {
        this.ctx.beginPath();
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
            let sx = tcx, sy = tcy;
            const terrSet = new Set(p.territory);
            if (terrSet.has(`${cell.x - 1},${cell.y}`)) sx -= CELL_SIZE;
            else if (terrSet.has(`${cell.x + 1},${cell.y}`)) sx += CELL_SIZE;
            else if (terrSet.has(`${cell.x},${cell.y - 1}`)) sy -= CELL_SIZE;
            else if (terrSet.has(`${cell.x},${cell.y + 1}`)) sy += CELL_SIZE;
            this.ctx.moveTo(sx, sy);
          }

          this.ctx.lineTo(tcx, tcy);
        }

        this.ctx.lineTo(ip.x, ip.y);
        this.ctx.strokeStyle = p.color + 'AA';
        this.ctx.lineWidth = CELL_SIZE * 0.8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.stroke();
      }

      this.ctx.save();
      this.ctx.translate(ip.x, ip.y);
      if (ip.direction === 'RIGHT') this.ctx.rotate(Math.PI / 2);
      else if (ip.direction === 'DOWN') this.ctx.rotate(Math.PI);
      else if (ip.direction === 'LEFT') this.ctx.rotate(-Math.PI / 2);

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
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        }

        this.ctx.restore();
      }
    });

    this.fireballs.forEach(fb => {
      if (fb.x >= startX && fb.x <= endX && fb.y >= startY && fb.y <= endY) {
        this.ctx.save();
        this.ctx.translate(fb.x, fb.y);

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
            x: fb.x + (Math.random() - 0.5) * 10,
            y: fb.y + (Math.random() - 0.5) * 10,
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
  }
}
