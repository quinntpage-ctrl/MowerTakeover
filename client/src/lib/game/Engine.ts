import { Point, PlayerState } from './Player';
import { 
  GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, 
  PLAYER_SPEED, TICK_RATE, COLORS, BOT_NAMES, PLAYER_COLORS, Direction 
} from './Constants';
import { captureEnclosedAreas } from './Utils';

interface GameCallbacks {
  onGameOver: (score: number, reason?: string) => void;
  onScoreUpdate: (score: number) => void;
  onLeaderboardUpdate: (board: {name: string, score: number, color: string}[]) => void;
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

  constructor(canvas: HTMLCanvasElement, playerName: string, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
    this.callbacks = callbacks;
    
    this.initGame(playerName);
    this.spawnBots(5);
    this.setupInputs();
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

  private initGame(playerName: string) {
    this.players.clear();
    const centerX = WORLD_WIDTH / 2;
    const centerY = WORLD_HEIGHT / 2;
    
    // Position at exact cell center
    const startX = Math.floor(centerX / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    const startY = Math.floor(centerY / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    
    const localPlayer = new PlayerState(this.localPlayerId, playerName, PLAYER_COLORS[0], startX, startY);
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
      .map(p => ({ name: p.name, score: p.score, color: p.color }))
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
      }
    };
    window.addEventListener('keydown', handleKey);
  }

  private getCellAt(x: number, y: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(y / CELL_SIZE)
    };
  }

  private update(dt: number) {
    this.players.forEach(p => {
      if (p.isDead) return;

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

      // Handle map edge collision for bots (and players)
      if (p.x === 0 || p.x >= WORLD_WIDTH - 0.01 || p.y === 0 || p.y >= WORLD_HEIGHT - 0.01) {
          if (!p.isBot && p.id === this.localPlayerId) {
             this.killPlayer(p.id, 'wall-collision');
             return;
          } else if (p.isBot) {
             // Force bot to turn around if it hits a wall
             if (p.x === 0) p.nextDirection = 'RIGHT';
             else if (p.x >= WORLD_WIDTH - 0.01) p.nextDirection = 'LEFT';
             else if (p.y === 0) p.nextDirection = 'DOWN';
             else if (p.y >= WORLD_HEIGHT - 0.01) p.nextDirection = 'UP';
          }
      }


      const newCell = this.getCellAt(p.x, p.y);
      const cellKey = `${newCell.x},${newCell.y}`;
      const oldCellKey = `${oldCell.x},${oldCell.y}`;

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
            
            // 1. Convert ALL trail segments to territory
            p.trail.forEach(t => p.territory.add(`${t.x},${t.y}`));
            
            // 2. Clear trail immediately to prevent self-collision
            p.trailSet.clear();
            p.trail = [];
            
            // 3. Flood fill to capture internal areas
            const newlyCaptured = captureEnclosedAreas(p.territory);
            
            newlyCaptured.forEach(k => {
              p.territory.add(k);
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });
            
            p.updateScore();
            if (p.id === this.localPlayerId) {
               this.callbacks.onScoreUpdate(p.score);
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

  private killPlayer(pid: string, reason: string = 'unknown') {
    const p = this.players.get(pid);
    if (!p) return;
    
    console.log(`Player ${pid} killed: ${reason}`);

    if (p.isBot) {
        // Respawn the bot instead of permanently killing it
        p.trail = [];
        p.trailSet.clear();
        
        // Pick a new random spot for the bot
        const rx = Math.random() * (WORLD_WIDTH * 0.8) + (WORLD_WIDTH * 0.1);
        const ry = Math.random() * (WORLD_HEIGHT * 0.8) + (WORLD_HEIGHT * 0.1);
        
        p.x = Math.floor(rx / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
        p.y = Math.floor(ry / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
        
        // Re-initialize their territory to a fresh 7x7 square
        p.territory.clear();
        const gridX = Math.floor(p.x / CELL_SIZE);
        const gridY = Math.floor(p.y / CELL_SIZE);
        
        for (let dx = -3; dx <= 3; dx++) {
            for (let dy = -3; dy <= 3; dy++) {
                const nx = gridX + dx;
                const ny = gridY + dy;
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
    } else {
        // Human player logic
        p.isDead = true;
        p.trail = [];
        p.trailSet.clear();
        this.callbacks.onGameOver(p.score, reason);
    }
  }

  private draw() {
    this.ctx.fillStyle = COLORS.bg;
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

    // Draw Grid
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    for (let x = Math.max(0, Math.floor(startX / CELL_SIZE) * CELL_SIZE); x <= Math.min(WORLD_WIDTH, endX); x += CELL_SIZE) {
      this.ctx.moveTo(x, Math.max(0, startY));
      this.ctx.lineTo(x, Math.min(WORLD_HEIGHT, endY));
    }
    for (let y = Math.max(0, Math.floor(startY / CELL_SIZE) * CELL_SIZE); y <= Math.min(WORLD_HEIGHT, endY); y += CELL_SIZE) {
      this.ctx.moveTo(Math.max(0, startX), y);
      this.ctx.lineTo(Math.min(WORLD_WIDTH, endX), y);
    }
    this.ctx.stroke();

    this.players.forEach(p => {
      if (!p.isDead) {
        // 1. Territory
        this.ctx.fillStyle = p.color + '44';
        p.territory.forEach(key => {
          const [cx, cy] = key.split(',').map(Number);
          if (cx * CELL_SIZE >= startX - CELL_SIZE && cx * CELL_SIZE <= endX &&
              cy * CELL_SIZE >= startY - CELL_SIZE && cy * CELL_SIZE <= endY) {
            this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
          }
        });

        // 2. Trail
        this.ctx.fillStyle = p.color + 'AA';
        p.trail.forEach(t => {
          if (t.x * CELL_SIZE >= startX - CELL_SIZE && t.x * CELL_SIZE <= endX &&
              t.y * CELL_SIZE >= startY - CELL_SIZE && t.y * CELL_SIZE <= endY) {
            this.ctx.fillRect(t.x * CELL_SIZE + 4, t.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
          }
        });

        // 3. Mower
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        if (p.direction === 'RIGHT') this.ctx.rotate(Math.PI/2);
        else if (p.direction === 'DOWN') this.ctx.rotate(Math.PI);
        else if (p.direction === 'LEFT') this.ctx.rotate(-Math.PI/2);
        
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(-12, -12, 24, 24);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(-8, -4, 16, 12);
        this.ctx.restore();
        
        // 4. Name
        this.ctx.fillStyle = '#000';
        this.ctx.font = 'bold 12px Nunito';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(p.name, p.x, p.y - 25);
      }
    });

    this.ctx.restore();
  }
}