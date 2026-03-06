import { Point, PlayerState } from './Player';
import { 
  GRID_SIZE, CELL_SIZE, WORLD_WIDTH, WORLD_HEIGHT, 
  PLAYER_SPEED, TICK_RATE, COLORS, BOT_NAMES, PLAYER_COLORS, Direction 
} from './Constants';
import { captureEnclosedAreas } from './Utils';

interface GameCallbacks {
  onGameOver: (score: number) => void;
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
  
  private lastTime: number = 0;
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  
  private camera = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  constructor(canvas: HTMLCanvasElement, playerName: string, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
    this.callbacks = callbacks;
    
    this.initGame(playerName);
    this.setupInputs();
  }

  private initGame(playerName: string) {
    // Generate map of who owns what cell for quick lookup
    this.players.clear();
    
    // Spawn local player
    const startX = Math.floor(Math.random() * (WORLD_WIDTH - 800)) + 400;
    const startY = Math.floor(Math.random() * (WORLD_HEIGHT - 800)) + 400;
    
    const localPlayer = new PlayerState(this.localPlayerId, playerName, PLAYER_COLORS[0], startX, startY);
    this.players.set(this.localPlayerId, localPlayer);
    
    // Spawn bots
    const botCount = 0;
    for (let i = 0; i < botCount; i++) {
      const botId = `bot_${i}`;
      const bx = Math.floor(Math.random() * (WORLD_WIDTH - 400)) + 200;
      const by = Math.floor(Math.random() * (WORLD_HEIGHT - 400)) + 200;
      const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)] + Math.floor(Math.random() * 99);
      const bot = new PlayerState(botId, botName, PLAYER_COLORS[(i + 1) % PLAYER_COLORS.length], bx, by, true);
      this.players.set(botId, bot);
    }
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public start() {
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
    
    // Bot logic interval
    setInterval(() => {
      if (!this.isRunning) return;
      this.players.forEach(p => {
        if (p.isBot && !p.isDead) this.updateBotLogic(p);
      });
    }, 500);
  }

  public stop() {
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  public setPlayerDirection(dir: Direction) {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isDead) return;
    
    // Prevent 180 degree turns
    if (
      (dir === 'UP' && p.direction === 'DOWN') ||
      (dir === 'DOWN' && p.direction === 'UP') ||
      (dir === 'LEFT' && p.direction === 'RIGHT') ||
      (dir === 'RIGHT' && p.direction === 'LEFT')
    ) {
      return;
    }
    
    p.nextDirection = dir;
  }

  private setupInputs() {
    window.addEventListener('keydown', (e) => {
      switch(e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          this.setPlayerDirection('UP'); break;
        case 'ArrowDown':
        case 's':
        case 'S':
          this.setPlayerDirection('DOWN'); break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          this.setPlayerDirection('LEFT'); break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          this.setPlayerDirection('RIGHT'); break;
      }
    });
  }

  private updateBotLogic(bot: PlayerState) {
    // Very simple bot logic for mockup: random turns occasionally
    if (Math.random() < 0.3) {
      const dirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      // Filter out 180 turn
      const validDirs = dirs.filter(d => {
        if (d === 'UP' && bot.direction === 'DOWN') return false;
        if (d === 'DOWN' && bot.direction === 'UP') return false;
        if (d === 'LEFT' && bot.direction === 'RIGHT') return false;
        if (d === 'RIGHT' && bot.direction === 'LEFT') return false;
        return true;
      });
      bot.nextDirection = validDirs[Math.floor(Math.random() * validDirs.length)];
    }
  }

  private loop = (time: number) => {
    if (!this.isRunning) return;
    
    const deltaTime = (time - this.lastTime) / 1000; // in seconds
    this.lastTime = time;
    
    this.update(deltaTime);
    this.draw();
    
    this.animationFrameId = requestAnimationFrame(this.loop);
  }

  private getCellAt(x: number, y: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(y / CELL_SIZE)
    };
  }

  private update(dt: number) {
    const moveDist = PLAYER_SPEED * dt;
    const allTerritory = new Map<string, string>(); // 'x,y' -> playerId
    
    // Build global territory map for collisions
    this.players.forEach((p, pid) => {
      if (p.isDead) return;
      p.territory.forEach(cell => allTerritory.set(cell, pid));
    });

    this.players.forEach((p, pid) => {
      if (p.isDead) return;

      const oldCell = this.getCellAt(p.x, p.y);
      
      // Update direction immediately
      p.direction = p.nextDirection;

      // Move player
      const moveDist = PLAYER_SPEED * dt;
      switch (p.direction) {
        case 'UP': p.y -= moveDist; break;
        case 'DOWN': p.y += moveDist; break;
        case 'LEFT': p.x -= moveDist; break;
        case 'RIGHT': p.x += moveDist; break;
      }

      // Bounds checking (allow moving across the whole world)
      if (p.x < 0) p.x = 0;
      if (p.x > WORLD_WIDTH) p.x = WORLD_WIDTH;
      if (p.y < 0) p.y = 0;
      if (p.y > WORLD_HEIGHT) p.y = WORLD_HEIGHT;

      const newCell = this.getCellAt(p.x, p.y);
      const cellKey = `${newCell.x},${newCell.y}`;

      // Check if moved to a new cell
      if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
        
        // 1. Check self-collision (hitting own trail)
        if (p.trailSet.has(cellKey)) {
          this.killPlayer(pid);
          return;
        }

        // 2. Are we outside our territory?
        if (!p.territory.has(cellKey)) {
          // Add to trail
          p.trail.push({...newCell});
          p.trailSet.add(cellKey);
          
          // Check collision with other trails
          this.players.forEach((otherP, otherPid) => {
            if (otherPid !== pid && !otherP.isDead && otherP.trailSet.has(cellKey)) {
              this.killPlayer(otherPid); // We hit their trail, they die
            }
          });
          
        } else {
          // We are inside our territory
          if (p.trail.length > 0) {
            // We just closed a loop!
            // Add trail to territory
            p.trail.forEach(t => {
              const k = `${t.x},${t.y}`;
              p.territory.add(k);
              
              // Steal from others
              this.players.forEach((otherP, otherPid) => {
                if (otherPid !== pid) otherP.territory.delete(k);
              });
            });
            
            // Calculate enclosed area
            const captured = captureEnclosedAreas(p.territory);
            captured.forEach(k => {
              p.territory.add(k);
              // Steal from others
              this.players.forEach((otherP, otherPid) => {
                if (otherPid !== pid) otherP.territory.delete(k);
              });
            });
            
            p.trail = [];
            p.trailSet.clear();
            p.updateScore();
            
            if (pid === this.localPlayerId) {
              this.callbacks.onScoreUpdate(p.score);
            }
          }
        }
      }
    });

    // Update leaderboard occasionally
    if (Math.random() < 0.1) {
      const sorted = Array.from(this.players.values())
        .filter(p => !p.isDead)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Number(p.score.toFixed(1)), color: p.color }));
      this.callbacks.onLeaderboardUpdate(sorted);
    }
    
    // Update camera to follow local player
    const lp = this.players.get(this.localPlayerId);
    if (lp && !lp.isDead) {
      // Direct camera follow for better precision in IO games
      this.camera.x = lp.x;
      this.camera.y = lp.y;
    }
  }

  private killPlayer(pid: string) {
    const p = this.players.get(pid);
    if (!p) return;
    p.isDead = true;
    
    // Distribute territory (for now, just vanishes in mockup)
    p.territory.clear();
    p.trail = [];
    p.trailSet.clear();
    
    if (pid === this.localPlayerId) {
      this.callbacks.onGameOver(p.score);
    }
  }

  private draw() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.save();
    // Center camera on screen
    this.ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);

    // Draw grid bounds
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    
    // Draw grid lines
    const startGridX = Math.max(0, Math.floor((this.camera.x - this.width / 2) / CELL_SIZE));
    const endGridX = Math.min(GRID_SIZE, Math.ceil((this.camera.x + this.width / 2) / CELL_SIZE));
    const startGridY = Math.max(0, Math.floor((this.camera.y - this.height / 2) / CELL_SIZE));
    const endGridY = Math.min(GRID_SIZE, Math.ceil((this.camera.y + this.height / 2) / CELL_SIZE));
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    for (let x = startGridX; x <= endGridX; x++) {
      this.ctx.moveTo(x * CELL_SIZE, 0);
      this.ctx.lineTo(x * CELL_SIZE, WORLD_HEIGHT);
    }
    for (let y = startGridY; y <= endGridY; y++) {
      this.ctx.moveTo(0, y * CELL_SIZE);
      this.ctx.lineTo(WORLD_WIDTH, y * CELL_SIZE);
    }
    this.ctx.stroke();

    // Render players (territory, trails, then mowers)
    
    // 1. Territories
    this.players.forEach(p => {
      if (p.isDead) return;
      this.ctx.fillStyle = p.color + '66'; // 40% opacity
      p.territory.forEach(cellKey => {
        const [x, y] = cellKey.split(',').map(Number);
        // Only draw if visible
        if (x >= startGridX - 1 && x <= endGridX + 1 && y >= startGridY - 1 && y <= endGridY + 1) {
           // Overlap slightly to prevent gaps
           this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE + 1, CELL_SIZE + 1);
        }
      });
    });

    // 2. Trails
    this.players.forEach(p => {
      if (p.isDead || p.trail.length === 0) return;
      this.ctx.fillStyle = p.color + 'AA'; // 66% opacity
      p.trail.forEach(t => {
        if (t.x >= startGridX - 1 && t.x <= endGridX + 1 && t.y >= startGridY - 1 && t.y <= endGridY + 1) {
           this.ctx.fillRect(t.x * CELL_SIZE + 4, t.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        }
      });
      
      // Draw line from last trail block to current position
      const last = p.trail[p.trail.length - 1];
      this.ctx.beginPath();
      this.ctx.strokeStyle = p.color + 'AA';
      this.ctx.lineWidth = CELL_SIZE - 8;
      this.ctx.lineCap = 'square';
      this.ctx.moveTo(last.x * CELL_SIZE + CELL_SIZE/2, last.y * CELL_SIZE + CELL_SIZE/2);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    });

    // 3. Mowers (Players)
    this.players.forEach((p, pid) => {
      if (p.isDead) return;
      
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      
      // Rotate based on direction
      switch(p.direction) {
        case 'UP': this.ctx.rotate(0); break;
        case 'RIGHT': this.ctx.rotate(Math.PI / 2); break;
        case 'DOWN': this.ctx.rotate(Math.PI); break;
        case 'LEFT': this.ctx.rotate(-Math.PI / 2); break;
      }
      
      // Draw Mower Body
      this.ctx.fillStyle = p.color;
      // Main deck
      this.ctx.fillRect(-12, -10, 24, 24);
      
      // Engine block
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(-8, -4, 16, 12);
      
      // Handles
      this.ctx.strokeStyle = '#222';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(-10, 14);
      this.ctx.lineTo(-10, 22);
      this.ctx.lineTo(10, 22);
      this.ctx.lineTo(10, 14);
      this.ctx.stroke();

      // Blade cover
      this.ctx.fillStyle = '#ddd';
      this.ctx.beginPath();
      this.ctx.arc(0, -8, 14, Math.PI, 0);
      this.ctx.fill();

      // If local player, draw an arrow indicating direction
      if (pid === this.localPlayerId) {
         this.ctx.fillStyle = '#fff';
         this.ctx.beginPath();
         this.ctx.moveTo(0, -18);
         this.ctx.lineTo(-6, -10);
         this.ctx.lineTo(6, -10);
         this.ctx.fill();
      }

      this.ctx.restore();
      
      // Draw Name tag
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 14px Nunito, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.name, p.x, p.y - 25);
    });

    this.ctx.restore();
  }
}