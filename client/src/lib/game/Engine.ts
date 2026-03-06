import { Point, PlayerState } from './Player';
import { 
  GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, 
  PLAYER_SPEED, TICK_RATE, COLORS, BOT_NAMES, PLAYER_COLORS, Direction 
} from './Constants';
import { captureEnclosedAreas } from './Utils';

interface GameCallbacks {
  onGameOver: (score: number, reason?: string) => void;
  onScoreUpdate: (score: number) => void;
  onLeaderboardUpdate: (board: {id: string, name: string, score: number, color: string}[]) => void;
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
}

interface ClaimFlash {
  x: number;
  y: number;
  alpha: number;
  color: string;
}

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
  type: 'fireball';
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number = 0;
  private height: number = 0;
  
  private players: Map<string, PlayerState> = new Map();
  private localPlayerId: string = 'player1';
  
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  
  private lastTimestamp: number = 0;
  private camera = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  private particles: Particle[] = [];
  private claimFlashes: ClaimFlash[] = [];
  
  private collectibles: Map<string, Collectible> = new Map();
  private activeFireballs: Fireball[] = [];

  private trailType: "grass" | "flame" | "star" | "smile" = "grass";
  private logoImage: HTMLImageElement;

  constructor(canvas: HTMLCanvasElement, playerName: string, playerColor: string = PLAYER_COLORS[0], trailType: "grass" | "flame" | "star" | "smile" = "grass", callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
    this.callbacks = callbacks;
    this.trailType = trailType;
    
    // Load Mower logo
    this.logoImage = new Image();
    this.logoImage.src = '/logo.svg';

    this.initGame(playerName, playerColor);
    this.spawnBots(5);
    this.setupInputs();
    // Spawn some initial collectibles
    this.spawnCollectibles(15);
  }

  private spawnCollectibles(count: number) {
      for (let i = 0; i < count; i++) {
          const id = `col_${Math.random().toString(36).substr(2, 9)}`;
          // Position at exact cell center, avoiding edges
          const rx = Math.random() * (WORLD_WIDTH * 0.9) + (WORLD_WIDTH * 0.05);
          const ry = Math.random() * (WORLD_HEIGHT * 0.9) + (WORLD_HEIGHT * 0.05);
          
          const x = Math.floor(rx / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
          const y = Math.floor(ry / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
          
          this.collectibles.set(id, { id, x, y, type: 'fireball' });
      }
  }

  private spawnBots(count: number) {
    for (let i = 0; i < count; i++) {
      const botId = `bot_${i}`;
      const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
      const color = PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length]; // skip index 0
      
      // Random position far from center and each other
      const rx = Math.random() * (WORLD_WIDTH * 0.8) + (WORLD_WIDTH * 0.1);
      const ry = Math.random() * (WORLD_HEIGHT * 0.8) + (WORLD_HEIGHT * 0.1);
      
      const startX = Math.floor(rx / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      const startY = Math.floor(ry / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      
      const bot = new PlayerState(botId, name, color, startX, startY, true);
      
      const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      const dir = dirs[Math.floor(Math.random() * dirs.length)];
      bot.direction = dir;
      bot.nextDirection = dir;
      
      this.players.set(botId, bot);
    }
  }

  private initGame(playerName: string, playerColor: string = PLAYER_COLORS[0]) {
    this.players.clear();
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    
    // Position at exact cell center
    const startX = Math.floor(centerX / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const startY = Math.floor(centerY / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    
    const localPlayer = new PlayerState(this.localPlayerId, playerName, playerColor, startX, startY, false, this.trailType);
    localPlayer.direction = 'RIGHT';
    localPlayer.nextDirection = 'RIGHT';
    
    this.players.set(this.localPlayerId, localPlayer);
    this.camera.x = localPlayer.x;
    this.camera.y = localPlayer.y;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public start() {
    this.isRunning = true;
    this.lastTimestamp = performance.now();
    requestAnimationFrame(this.gameLoop);
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private updateLeaderboard() {
    const board = Array.from(this.players.values())
      .map(p => ({ id: p.id, name: p.name, score: p.score, color: p.color }))
      .sort((a, b) => b.score - a.score);
      // Send all players, UI can slice or show all

    this.callbacks.onLeaderboardUpdate(board);
  }

  private gameLoop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.updateLeaderboard();
    this.draw();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  }

  public setPlayerDirection(dir: Direction) {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isDead) return;
    
    // Prevent 180 degree turns against the currently buffered input
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

  private setupInputs() {
    const handleKey = (e: KeyboardEvent) => {
      switch(e.key.toLowerCase()) {
        case 'arrowup': case 'w': this.setPlayerDirection('UP'); break;
        case 'arrowdown': case 's': this.setPlayerDirection('DOWN'); break;
        case 'arrowleft': case 'a': this.setPlayerDirection('LEFT'); break;
        case 'arrowright': case 'd': this.setPlayerDirection('RIGHT'); break;
        case ' ': 
        case 'enter':
            this.shootFireball(); 
            break;
      }
    };
    window.addEventListener('keydown', handleKey);
  }

  private shootFireball() {
      const p = this.players.get(this.localPlayerId);
      if (!p || p.isDead || p.fireballs <= 0) return;
      
      p.fireballs--;
      if (this.callbacks.onFireballsUpdate) {
          this.callbacks.onFireballsUpdate(p.fireballs);
      }
      
      const speed = 400; // pixels per second
      let vx = 0;
      let vy = 0;
      
      if (p.direction === 'UP') vy = -speed;
      else if (p.direction === 'DOWN') vy = speed;
      else if (p.direction === 'LEFT') vx = -speed;
      else if (p.direction === 'RIGHT') vx = speed;
      
      this.activeFireballs.push({
          id: `fb_${Date.now()}`,
          x: p.x,
          y: p.y,
          vx: vx,
          vy: vy,
          ownerId: p.id,
          life: 3.0 // lives for 3 seconds
      });
  }

  private getCellAt(x: number, y: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(y / CELL_SIZE)
    };
  }

  private update(dt: number) {
    // Update particles
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

    // Update claim flashes
    for (let i = this.claimFlashes.length - 1; i >= 0; i--) {
      const flash = this.claimFlashes[i];
      flash.alpha -= dt * 2.0; // Flash lasts half a second
      if (flash.alpha <= 0) {
        this.claimFlashes.splice(i, 1);
      }
    }

    // Update active fireballs
    for (let i = this.activeFireballs.length - 1; i >= 0; i--) {
        const fb = this.activeFireballs[i];
        fb.x += fb.vx * dt;
        fb.y += fb.vy * dt;
        fb.life -= dt;
        
        // Burn territory
        const gridX = Math.floor(fb.x / CELL_SIZE);
        const gridY = Math.floor(fb.y / CELL_SIZE);
        const key = `${gridX},${gridY}`;
        
        let hitEnemy = false;
        this.players.forEach(p => {
           if (p.id !== fb.ownerId && p.territory.has(key)) {
               hitEnemy = true;
           }
        });
        
        if (hitEnemy) {
            const radius = 2; // 5x5 area explosion
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dy = -radius; dy <= radius; dy++) {
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    const nKey = `${nx},${ny}`;
                    
                    let cellBurned = false;
                    this.players.forEach(p => {
                        if (p.id !== fb.ownerId && p.territory.has(nKey)) {
                            p.territory.delete(nKey);
                            cellBurned = true;
                        }
                    });
                    
                    if (cellBurned) {
                        // Show burnt ground flash
                        this.claimFlashes.push({
                            x: nx,
                            y: ny,
                            alpha: 1.0,
                            color: '#1f2937' // burnt ash color
                        });
                        
                        // Fire explosion particles for the burned cell
                        for(let k=0; k<3; k++) {
                            this.particles.push({
                                x: nx * CELL_SIZE + CELL_SIZE/2 + (Math.random()-0.5)*CELL_SIZE,
                                y: ny * CELL_SIZE + CELL_SIZE/2 + (Math.random()-0.5)*CELL_SIZE,
                                vx: (Math.random() - 0.5) * 100,
                                vy: (Math.random() - 0.5) * 100 - 30, // drift up
                                life: 0.5 + Math.random() * 0.5,
                                maxLife: 1.0,
                                color: Math.random() > 0.5 ? '#ef4444' : '#f97316',
                                size: 3 + Math.random() * 4,
                                type: 'flame'
                            });
                        }
                    }
                }
            }
            
            this.players.forEach(p => {
                if (p.id !== fb.ownerId) p.updateScore();
            });
            
            fb.life = 0; // Destroy the fireball on impact
        }
        
        if (fb.life <= 0 || fb.x < 0 || fb.x > WORLD_WIDTH || fb.y < 0 || fb.y > WORLD_HEIGHT) {
            this.activeFireballs.splice(i, 1);
        }
    }

    this.players.forEach(p => {
      if (p.isDead) {
         if (p.deathAlpha > 0) {
             p.deathAlpha -= dt * 1.5; // Fade out over ~0.66 seconds
         } else if (p.deathAlpha <= 0 && p.deathAlpha > -3) {
             // Clear their remnants once fully faded
             if (p.deathAlpha > -1) {
                p.trail = [];
                p.trailSet.clear();
                p.territory.clear();
                this.players.forEach(player => player.updateScore());
             }

             if (p.isBot) {
                this.respawnBot(p);
             } else if (p.id === this.localPlayerId && p.deathAlpha > -1) {
                // Ensure we only call Game Over once by setting it to a low negative number
                p.deathAlpha = -2;
                this.callbacks.onGameOver(p.score, p.deathReason);
             } else {
                p.deathAlpha = -2;
             }
         }
         return;
      }

      // Handle bot logic
      if (p.isBot) {
        this.updateBot(p);
      }

      const oldCell = this.getCellAt(p.x, p.y);
      
      const moveDist = PLAYER_SPEED * dt;

      // Strict Splix.io style movement:
      // Move along current axis. We only change direction if we are near the center of a cell.
      const cx = Math.floor(p.x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      const cy = Math.floor(p.y / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      
      // Are we passing through the center of a cell this frame?
      const isHorizontal = p.direction === 'LEFT' || p.direction === 'RIGHT';
      const distToCenter = isHorizontal ? Math.abs(p.x - cx) : Math.abs(p.y - cy);
      
      // Only allow turning if we are moving towards the center, and the distance to center is less than our move distance
      // We also need to check if we are moving the correct direction relative to the center
      const movingTowardsCenter = 
        (p.direction === 'RIGHT' && p.x <= cx) ||
        (p.direction === 'LEFT' && p.x >= cx) ||
        (p.direction === 'DOWN' && p.y <= cy) ||
        (p.direction === 'UP' && p.y >= cy);

      const passingCenter = movingTowardsCenter && distToCenter <= moveDist;

      if (p.nextDirection !== p.direction && passingCenter) {
        // Snap to center and turn
        p.x = cx;
        p.y = cy;
        p.direction = p.nextDirection;
        
        // Move remaining distance in new direction
        const remainingDist = moveDist - distToCenter;
        if (p.direction === 'UP') p.y -= remainingDist;
        else if (p.direction === 'DOWN') p.y += remainingDist;
        else if (p.direction === 'LEFT') p.x -= remainingDist;
        else if (p.direction === 'RIGHT') p.x += remainingDist;
      } else {
        // Normal movement
        if (p.direction === 'UP') p.y -= moveDist;
        else if (p.direction === 'DOWN') p.y += moveDist;
        else if (p.direction === 'LEFT') p.x -= moveDist;
        else if (p.direction === 'RIGHT') p.x += moveDist;
      }

      // Strict bounds
      p.x = Math.max(0, Math.min(WORLD_WIDTH - 0.001, p.x));
      p.y = Math.max(0, Math.min(WORLD_HEIGHT - 0.001, p.y));

      // Handle map edge collision for everyone
      if (p.x <= 0 || p.x >= WORLD_WIDTH - 0.01 || p.y <= 0 || p.y >= WORLD_HEIGHT - 0.01) {
          this.killPlayer(p.id, 'wall-collision');
          return;
      }

      const newCell = this.getCellAt(p.x, p.y);
      const cellKey = `${newCell.x},${newCell.y}`;
      const oldCellKey = `${oldCell.x},${oldCell.y}`;

      // Pick up collectibles
      this.collectibles.forEach((col, colId) => {
         const dx = p.x - col.x;
         const dy = p.y - col.y;
         const distSq = dx*dx + dy*dy;
         
         if (distSq < 400) { // 20px radius
             if (col.type === 'fireball') {
                 p.fireballs++;
                 
                 // Update HUD for local player
                 if (p.id === this.localPlayerId && this.callbacks.onFireballsUpdate) {
                     this.callbacks.onFireballsUpdate(p.fireballs);
                 }
             }
             this.collectibles.delete(colId);
             
             // Flash effect
             this.claimFlashes.push({
                 x: Math.floor(col.x / CELL_SIZE),
                 y: Math.floor(col.y / CELL_SIZE),
                 alpha: 1.0,
                 color: '#f97316'
             });
         }
      });

      // Ensure we don't kill the player on the exact frame they step out of their territory
      if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
        
        // Check if we hit someone else's trail (works even if we are in our own safe zone)
        this.players.forEach((otherP, otherPid) => {
          if (otherPid !== p.id && !otherP.isDead && otherP.trailSet.has(cellKey)) {
            this.killPlayer(otherPid, 'killed-by-other');
          }
        });

        const isEnteringSafeZone = p.territory.has(cellKey);
        
        if (isEnteringSafeZone) {
          if (p.trail.length > 0) {
            // Add the final cell to explicitly close the geometry
            p.trail.push({...newCell});
            
            // 1. Convert ALL trail segments to territory and steal from others
            p.trail.forEach(t => {
              const k = `${t.x},${t.y}`;
              p.territory.add(k);
              this.claimFlashes.push({
                 x: t.x,
                 y: t.y,
                 alpha: 1.0,
                 color: p.color
              });
              
              // Add grass clipping particles where they mowed
              for (let i = 0; i < 3; i++) {
                this.particles.push({
                   x: t.x * CELL_SIZE + Math.random() * CELL_SIZE,
                   y: t.y * CELL_SIZE + Math.random() * CELL_SIZE,
                   vx: (Math.random() - 0.5) * 100,
                   vy: (Math.random() - 0.5) * 100 - 50, // slight upward bias
                   life: Math.random() * 0.5 + 0.5,
                   maxLife: 1.0,
                   color: '#4ade80', // grass color
                   size: Math.random() * 4 + 2,
                   rotation: Math.random() * Math.PI * 2,
                   vRot: (Math.random() - 0.5) * 10
                });
              }

              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });
            
            // 2. Clear trail immediately to prevent self-collision
            p.trailSet.clear();
            p.trail = [];
            
            // 3. Flood fill to capture internal areas
            const newlyCaptured = captureEnclosedAreas(p.territory);
            
            newlyCaptured.forEach(k => {
              p.territory.add(k);
              const [cx, cy] = k.split(',').map(Number);
              this.claimFlashes.push({
                 x: cx,
                 y: cy,
                 alpha: 1.0,
                 color: p.color
              });
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });
            
            // Update scores for ALL players since territory might have been stolen
            const toKill: string[] = [];
            this.players.forEach(player => {
                player.updateScore();
                if (player.territory.size === 0 && !player.isDead) {
                    toKill.push(player.id);
                }
            });
            toKill.forEach(id => this.killPlayer(id, 'all-territory-lost'));
            
            // Update the local player's HUD score
            const localP = this.players.get(this.localPlayerId);
            if (localP) {
               this.callbacks.onScoreUpdate(localP.score);
            }
          }
        } else {
          // HOSTILE TERRITORY
          const isSelfCollision = p.trailSet.has(cellKey);
          
          // IMMUNITY: Allow sharp turns by ignoring the last 3 points
          const isRecentTrail = p.trail.slice(-3).some(t => t.x === newCell.x && t.y === newCell.y);

          // Ensure we don't kill the player on the exact frame they step out of their territory
          const justLeftSafeZone = p.territory.has(oldCellKey);

          if (isSelfCollision && !isRecentTrail && !justLeftSafeZone) {
            this.killPlayer(p.id, 'self-collision');
            return;
          }

          // Add current cell to trail
          // To handle crossing into the safezone perfectly, only record non-safezone steps
          p.trail.push({...newCell});
          p.trailSet.add(cellKey);
        }
      }
      
      // Continuous grass cutting animation while mowing
      if (!p.territory.has(cellKey)) {
          // Spawn more particles but give them a directional velocity based on mower direction
          if (Math.random() < 0.4) {
              let vx = 0;
              let vy = 0;
              let px = p.x;
              let py = p.y;
              
              // Shoot clippings out of the right side of the mower deck
              if (p.trailType === "flame") {
                  if (p.direction === 'UP') {
                      vx = (Math.random() - 0.5) * 20;
                      vy = 40 + Math.random() * 40;
                      py += 10;
                  } else if (p.direction === 'DOWN') {
                      vx = (Math.random() - 0.5) * 20;
                      vy = -40 - Math.random() * 40;
                      py -= 10;
                  } else if (p.direction === 'LEFT') {
                      vx = 40 + Math.random() * 40;
                      vy = (Math.random() - 0.5) * 20;
                      px += 10;
                  } else if (p.direction === 'RIGHT') {
                      vx = -40 - Math.random() * 40;
                      vy = (Math.random() - 0.5) * 20;
                      px -= 10;
                  }
                  
                  // Flame colors
                  const colors = ['#f97316', '#ef4444', '#eab308'];
                  const flameColor = colors[Math.floor(Math.random() * colors.length)];

                  this.particles.push({
                     x: px + (Math.random() - 0.5) * 15,
                     y: py + (Math.random() - 0.5) * 15,
                     vx: vx,
                     vy: vy,
                     life: Math.random() * 0.4 + 0.3,
                     maxLife: 0.7,
                     color: flameColor,
                     size: Math.random() * 6 + 4,
                     rotation: Math.random() * Math.PI * 2,
                     vRot: (Math.random() - 0.5) * 5
                  });
              } else if (p.trailType === "star") {
                  // Stars shoot out behind the mower
                  if (p.direction === 'UP') {
                      vx = (Math.random() - 0.5) * 30;
                      vy = 30 + Math.random() * 20;
                      py += 15;
                  } else if (p.direction === 'DOWN') {
                      vx = (Math.random() - 0.5) * 30;
                      vy = -30 - Math.random() * 20;
                      py -= 15;
                  } else if (p.direction === 'LEFT') {
                      vx = 30 + Math.random() * 20;
                      vy = (Math.random() - 0.5) * 30;
                      px += 15;
                  } else if (p.direction === 'RIGHT') {
                      vx = -30 - Math.random() * 20;
                      vy = (Math.random() - 0.5) * 30;
                      px -= 15;
                  }
                  
                  this.particles.push({
                     x: px + (Math.random() - 0.5) * 10,
                     y: py + (Math.random() - 0.5) * 10,
                     vx: vx,
                     vy: vy,
                     life: Math.random() * 0.5 + 0.5,
                     maxLife: 1.0,
                     color: '#fef08a', // Yellow star color
                     size: Math.random() * 4 + 4,
                     rotation: Math.random() * Math.PI * 2,
                     vRot: (Math.random() - 0.5) * 2,
                     type: 'star'
                  } as Particle & {type: string});
              } else if (p.trailType === "smile") {
                  // Smileys drop behind
                  if (p.direction === 'UP') {
                      vx = (Math.random() - 0.5) * 10;
                      vy = 10 + Math.random() * 10;
                      py += 15;
                  } else if (p.direction === 'DOWN') {
                      vx = (Math.random() - 0.5) * 10;
                      vy = -10 - Math.random() * 10;
                      py -= 15;
                  } else if (p.direction === 'LEFT') {
                      vx = 10 + Math.random() * 10;
                      vy = (Math.random() - 0.5) * 10;
                      px += 15;
                  } else if (p.direction === 'RIGHT') {
                      vx = -10 - Math.random() * 10;
                      vy = (Math.random() - 0.5) * 10;
                      px -= 15;
                  }
                  
                  this.particles.push({
                     x: px + (Math.random() - 0.5) * 5,
                     y: py + (Math.random() - 0.5) * 5,
                     vx: vx,
                     vy: vy,
                     life: Math.random() * 0.8 + 0.4,
                     maxLife: 1.2,
                     color: '#fbbf24', // Yellow face
                     size: Math.random() * 6 + 8, // larger for face
                     rotation: Math.random() * Math.PI * 2,
                     vRot: (Math.random() - 0.5) * 1,
                     type: 'smile'
                  } as Particle & {type: string});
              } else {
                  if (p.direction === 'UP') {
                      vx = 80 + Math.random() * 40;
                      vy = (Math.random() - 0.5) * 40;
                      px += 10;
                  } else if (p.direction === 'DOWN') {
                      vx = -80 - Math.random() * 40;
                      vy = (Math.random() - 0.5) * 40;
                      px -= 10;
                  } else if (p.direction === 'LEFT') {
                      vx = (Math.random() - 0.5) * 40;
                      vy = -80 - Math.random() * 40;
                      py -= 10;
                  } else if (p.direction === 'RIGHT') {
                      vx = (Math.random() - 0.5) * 40;
                      vy = 80 + Math.random() * 40;
                      py += 10;
                  }
    
                  this.particles.push({
                     x: px + (Math.random() - 0.5) * 10,
                     y: py + (Math.random() - 0.5) * 10,
                     vx: vx,
                     vy: vy,
                     life: Math.random() * 0.3 + 0.2,
                     maxLife: 0.5,
                     color: '#4ade80', // bright grass color
                     size: Math.random() * 3 + 2,
                     rotation: Math.random() * Math.PI * 2,
                     vRot: (Math.random() - 0.5) * 15
                  });
              }
          }
      }
    });

    const lp = this.players.get(this.localPlayerId);
    if (lp) {
      this.camera.x = lp.x;
      this.camera.y = lp.y;
    }
  }

  private updateBot(bot: PlayerState) {
    // Simple bot logic: 
    // Randomly change direction occasionally, but ensure they return to base if trail gets long
    
    // 5% chance per frame to consider a turn if they are near the center of a cell
    if (Math.random() < 0.05) {
      const cx = Math.floor(bot.x / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      const cy = Math.floor(bot.y / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
      
      const isHorizontal = bot.direction === 'LEFT' || bot.direction === 'RIGHT';
      const distToCenter = isHorizontal ? Math.abs(bot.x - cx) : Math.abs(bot.y - cy);
      
      if (distToCenter < 2) {
        // Too far from home? Turn back
        if (bot.trail.length > 15) {
           // Find a path back to territory
           // Just try to move back towards the center of their territory for simplicity
           let targetX = 0;
           let targetY = 0;
           bot.territory.forEach(k => {
               const [tx, ty] = k.split(',').map(Number);
               targetX += tx;
               targetY += ty;
           });
           if (bot.territory.size > 0) {
               targetX = (targetX / bot.territory.size) * CELL_SIZE;
               targetY = (targetY / bot.territory.size) * CELL_SIZE;
               
               if (Math.abs(bot.x - targetX) > Math.abs(bot.y - targetY)) {
                   bot.nextDirection = bot.x > targetX ? 'LEFT' : 'RIGHT';
               } else {
                   bot.nextDirection = bot.y > targetY ? 'UP' : 'DOWN';
               }
           }
        } else {
           // Random turn
           const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
           // Prevent 180s
           const opposite = {
               'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT'
           };
           const validDirs = dirs.filter(d => d !== opposite[bot.direction]);
           bot.nextDirection = validDirs[Math.floor(Math.random() * validDirs.length)];
        }
      }
    }
  }

  private respawnBot(p: PlayerState) {
        p.isDead = false;
        p.deathAlpha = 1.0;
        
        let spawnFound = false;
        let rx = 0;
        let ry = 0;
        let gridX = 0;
        let gridY = 0;
        let attempts = 0;
        const maxAttempts = 50;

        // Try to find a spawn location that doesn't overlap any player's territory
        while (!spawnFound && attempts < maxAttempts) {
            rx = Math.random() * (WORLD_WIDTH * 0.8) + (WORLD_WIDTH * 0.1);
            ry = Math.random() * (WORLD_HEIGHT * 0.8) + (WORLD_HEIGHT * 0.1);
            
            gridX = Math.floor(rx / CELL_SIZE);
            gridY = Math.floor(ry / CELL_SIZE);
            
            let overlap = false;
            // Check a 7x7 area around the potential spawn
            for (let dx = -3; dx <= 3; dx++) {
                for (let dy = -3; dy <= 3; dy++) {
                    const nx = gridX + dx;
                    const ny = gridY + dy;
                    const key = `${nx},${ny}`;
                    
                    // See if any active player owns this cell
                    for (const [id, other] of Array.from(this.players.entries())) {
                        if (!other.isDead && other.territory.has(key)) {
                            overlap = true;
                            break;
                        }
                    }
                    if (overlap) break;
                }
                if (overlap) break;
            }
            
            if (!overlap) {
                spawnFound = true;
            }
            attempts++;
        }

        // If we couldn't find a clean spot after max attempts (map is very full), 
        // just use the last random spot we generated.
        
        p.x = gridX * CELL_SIZE + CELL_SIZE / 2;
        p.y = gridY * CELL_SIZE + CELL_SIZE / 2;
        
        // Re-initialize their territory to a fresh 7x7 square
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
                    // Ensure we clear this new spawn area from any other players
                    this.players.forEach(other => {
                        if (other.id !== p.id) {
                            other.territory.delete(key);
                        }
                    });
                }
            }
        }
        p.updateScore();
        
        // Give them a new random direction
        const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        p.direction = dir;
        p.nextDirection = dir;
        
        // Update all scores because clearing/respawning territory might have changed totals
        this.players.forEach(player => player.updateScore());
  }

  private killPlayer(pid: string, reason: string = 'unknown') {
    const p = this.players.get(pid);
    if (!p || p.isDead) return;
    
    console.log(`Player ${pid} killed: ${reason}`);

    p.isDead = true;
    p.deathAlpha = 1.0;
    p.deathReason = reason;
    // We don't clear territory/trail here anymore so they can fade out visually.
    // They will be cleared when deathAlpha reaches 0.
    p.updateScore();
    this.players.forEach(player => player.updateScore());
  }

  private draw() {
    this.ctx.fillStyle = '#f3f4f6'; // very light grey outside
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.save();
    this.ctx.translate(
      Math.floor(this.width / 2 - this.camera.x), 
      Math.floor(this.height / 2 - this.camera.y)
    );

    // Visible bounds for rendering optimization
    const startX = Math.floor((this.camera.x - this.width/2) / CELL_SIZE) * CELL_SIZE;
    const endX = startX + this.width + CELL_SIZE * 2;
    const startY = Math.floor((this.camera.y - this.height/2) / CELL_SIZE) * CELL_SIZE;
    const endY = startY + this.height + CELL_SIZE * 2;

    const grassStartX = Math.max(0, startX);
    const grassStartY = Math.max(0, startY);
    const grassEndX = Math.min(WORLD_WIDTH, endX);
    const grassEndY = Math.min(WORLD_HEIGHT, endY);

    if (grassEndX > grassStartX && grassEndY > grassStartY) {
        // Draw Grid (unmowed grass texture base)
        this.ctx.fillStyle = '#86efac'; // Light green for unmowed grass
        this.ctx.fillRect(grassStartX, grassStartY, grassEndX - grassStartX, grassEndY - grassStartY);

        // Draw "high grass" texture
        this.ctx.fillStyle = '#22c55e'; // darker green for grass blades
        for (let x = Math.max(0, Math.floor(grassStartX / CELL_SIZE) * CELL_SIZE); x < grassEndX; x += CELL_SIZE) {
            for (let y = Math.max(0, Math.floor(grassStartY / CELL_SIZE) * CELL_SIZE); y < grassEndY; y += CELL_SIZE) {
                const gridX = Math.floor(x / CELL_SIZE);
                const gridY = Math.floor(y / CELL_SIZE);
                const key = `${gridX},${gridY}`;
                
                let isClaimed = false;
                for (const p of Array.from(this.players.values())) {
                    if (!p.isDead && p.territory.has(key)) {
                        isClaimed = true;
                        break;
                    }
                }

                if (!isClaimed) {
                    // Pseudo-random but consistent tufts
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

        // Draw Grid lines only on unclaimed territory
        this.ctx.strokeStyle = '#4ade80'; // lighter green grid to not overpower texture
        this.ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = Math.max(0, Math.floor(grassStartX / CELL_SIZE) * CELL_SIZE); x <= grassEndX; x += CELL_SIZE) {
            for (let y = Math.max(0, Math.floor(grassStartY / CELL_SIZE) * CELL_SIZE); y <= grassEndY; y += CELL_SIZE) {
                const gridX = Math.floor(x / CELL_SIZE);
                const gridY = Math.floor(y / CELL_SIZE);
                const key = `${gridX},${gridY}`;
                
                let isClaimed = false;
                for (const p of Array.from(this.players.values())) {
                    if (!p.isDead && p.territory.has(key)) {
                        isClaimed = true;
                        break;
                    }
                }

                if (!isClaimed) {
                    // Draw top and left borders for this cell to form the grid
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

    // Draw the deadly pink border
    this.ctx.strokeStyle = '#EC098D';
    this.ctx.lineWidth = 6;
    this.ctx.shadowColor = '#EC098D';
    this.ctx.shadowBlur = 15;
    this.ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    this.ctx.shadowBlur = 0; // reset

    // Warning Logo on Outside of Border
    const lp = this.players.get(this.localPlayerId);
    if (lp && this.logoImage.complete && this.logoImage.naturalWidth > 0) {
        const drawOuterLogo = (x: number, y: number, rotation: number) => {
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(rotation);
            const lw = 400;
            const lh = 400 * (90.8 / 513.5); 
            
            this.ctx.drawImage(this.logoImage, -lw/2, -lh/2 - 20, lw, lh);
            
            this.ctx.fillStyle = '#333333'; // dark text for readability on light grey
            this.ctx.font = 'bold 24px "Neue Haas Grotesk", "Inter", sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("Go to mower.com to see what we are all about!", 0, lh/2 + 20);
            
            this.ctx.restore();
        };

        const px = Math.max(400, Math.min(WORLD_WIDTH - 400, lp.x));
        const py = Math.max(400, Math.min(WORLD_HEIGHT - 400, lp.y));

        drawOuterLogo(px, -150, 0); // Top
        drawOuterLogo(px, WORLD_HEIGHT + 150, Math.PI); // Bottom
        drawOuterLogo(-150, py, -Math.PI / 2); // Left
        drawOuterLogo(WORLD_WIDTH + 150, py, Math.PI / 2); // Right
    }

    // Draw Collectibles
    this.collectibles.forEach(col => {
      if (col.x >= startX && col.x <= endX && col.y >= startY && col.y <= endY) {
         this.ctx.save();
         this.ctx.translate(col.x, col.y);
         
         // Bobbing animation based on timestamp
         const bobY = Math.sin(this.lastTimestamp / 200) * 4;
         this.ctx.translate(0, bobY);
         
         if (col.type === 'fireball') {
             // Glowing fireball powerup
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

    this.players.forEach(p => {
      if (p.isDead && p.deathAlpha <= 0) return;

      this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

        // 1. Territory (Mowed grass)
        p.territory.forEach(key => {
          const [cx, cy] = key.split(',').map(Number);
          if (cx * CELL_SIZE >= startX - CELL_SIZE && cx * CELL_SIZE <= endX &&
              cy * CELL_SIZE >= startY - CELL_SIZE && cy * CELL_SIZE <= endY) {
            
            // Draw mowed background - lighter to contrast with high grass
            this.ctx.fillStyle = p.color + '66'; // slightly more solid to cover the base green
            this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            
            // Draw subtle stripe pattern for mowed look (like alternating cut directions)
            this.ctx.fillStyle = p.color + '33';
            if (cy % 2 === 0) {
               this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
          }
        });

        // 1.5 Claim Flashes (Exciting "mowing completed" visual)
        this.claimFlashes.forEach(flash => {
          if (flash.x * CELL_SIZE >= startX - CELL_SIZE && flash.x * CELL_SIZE <= endX &&
              flash.y * CELL_SIZE >= startY - CELL_SIZE && flash.y * CELL_SIZE <= endY) {
            this.ctx.fillStyle = flash.color;
            this.ctx.globalAlpha = flash.alpha;
            this.ctx.fillRect(flash.x * CELL_SIZE, flash.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        });
        
        // Reset global alpha after drawing flashes
        this.ctx.globalAlpha = p.isDead ? Math.max(0, p.deathAlpha) : 1.0;

        // 2. Trail (Mowing in progress)
        this.ctx.fillStyle = p.color + 'AA';
        if (p.trail.length > 0) {
          this.ctx.beginPath();
          
          for (let i = 0; i < p.trail.length; i++) {
              const cell = p.trail[i];
              let cx = cell.x * CELL_SIZE + CELL_SIZE/2;
              let cy = cell.y * CELL_SIZE + CELL_SIZE/2;
              
              // Prevent the trail from flicking ahead of the mower in the current cell
              if (i === p.trail.length - 1) {
                  if (p.direction === 'RIGHT' && cx > p.x) cx = p.x;
                  if (p.direction === 'LEFT' && cx < p.x) cx = p.x;
                  if (p.direction === 'DOWN' && cy > p.y) cy = p.y;
                  if (p.direction === 'UP' && cy < p.y) cy = p.y;
              }
              
              if (i === 0) {
                  // Connect visually to the safe zone we just exited from
                  let startX = cx;
                  let startY = cy;
                  if (p.territory.has(`${cell.x-1},${cell.y}`)) startX -= CELL_SIZE;
                  else if (p.territory.has(`${cell.x+1},${cell.y}`)) startX += CELL_SIZE;
                  else if (p.territory.has(`${cell.x},${cell.y-1}`)) startY -= CELL_SIZE;
                  else if (p.territory.has(`${cell.x},${cell.y+1}`)) startY += CELL_SIZE;
                  this.ctx.moveTo(startX, startY);
              }
              
              this.ctx.lineTo(cx, cy);
          }
          
          // Connect perfectly to the mower's current center to eliminate visual gaps
          this.ctx.lineTo(p.x, p.y);
          
          this.ctx.strokeStyle = p.color + 'AA';
          this.ctx.lineWidth = CELL_SIZE * 0.8; // slightly thinner than full cell
          this.ctx.lineCap = 'round';
          this.ctx.lineJoin = 'round';
          this.ctx.stroke();
        }

        // 3. Mower Sprite
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        if (p.direction === 'RIGHT') this.ctx.rotate(Math.PI/2);
        else if (p.direction === 'DOWN') this.ctx.rotate(Math.PI);
        else if (p.direction === 'LEFT') this.ctx.rotate(-Math.PI/2);
        
        // Mower Body (deck) normal
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.roundRect(-14, -12, 28, 24, 4);
        this.ctx.fill();
        
        // Mower engine/center
        this.ctx.fillStyle = '#333';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 8, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Handle/Bars
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(-10, 12);
        this.ctx.lineTo(-10, 20);
        this.ctx.lineTo(10, 20);
        this.ctx.lineTo(10, 12);
        this.ctx.stroke();
        
        // Wheels
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(-16, -10, 4, 8); // front left
        this.ctx.fillRect(12, -10, 4, 8);  // front right
        this.ctx.fillRect(-16, 2, 4, 8);   // back left
        this.ctx.fillRect(12, 2, 4, 8);    // back right

        this.ctx.restore();
        
        // 4. Name
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 12px Nunito';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(p.name, p.x, p.y - 25);
      
      this.ctx.globalAlpha = 1.0;
    });

    // 5. Draw Particles (Grass Clippings, Flames, Stars, etc.)
    this.particles.forEach(p => {
        if (p.x >= startX && p.x <= endX && p.y >= startY && p.y <= endY) {
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.rotation);
            this.ctx.globalAlpha = p.life / p.maxLife;
            
            const pAny = p as any;
            
            if (pAny.type === 'star') {
                // Draw a 5-point star
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
            } else if (pAny.type === 'smile') {
                // Draw a smiley face
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, p.size, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Eyes
                this.ctx.fillStyle = '#000';
                this.ctx.beginPath();
                this.ctx.arc(-p.size*0.3, -p.size*0.2, p.size*0.15, 0, Math.PI * 2);
                this.ctx.arc(p.size*0.3, -p.size*0.2, p.size*0.15, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Smile
                this.ctx.strokeStyle = '#000';
                this.ctx.lineWidth = p.size*0.1;
                this.ctx.beginPath();
                this.ctx.arc(0, p.size*0.1, p.size*0.5, 0.1, Math.PI - 0.1);
                this.ctx.stroke();
            } else {
                // Default square particle (grass/flame)
                this.ctx.fillStyle = p.color;
                this.ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
            }
            
            this.ctx.restore();
        }
    });

    // Draw active fireballs
    this.activeFireballs.forEach(fb => {
      if (fb.x >= startX && fb.x <= endX && fb.y >= startY && fb.y <= endY) {
         this.ctx.save();
         this.ctx.translate(fb.x, fb.y);
         
         // Glowing effect
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
         
         // Add flame particles
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