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
  
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  
  // High-precision timing
  private lastTimestamp: number = 0;
  private accumulator: number = 0;
  private readonly fixedDt: number = 1 / 60; // 60Hz logic
  
  private camera = { x: 0, y: 0 };
  private callbacks: GameCallbacks;

  constructor(canvas: HTMLCanvasElement, playerName: string, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false }); // Optimize performance
    if (!context) throw new Error("Could not get 2d context");
    this.ctx = context;
    this.callbacks = callbacks;
    
    this.initGame(playerName);
    this.setupInputs();
  }

  private initGame(playerName: string) {
    this.players.clear();
    
    // Spawn in the dead center of the world
    const startX = WORLD_WIDTH / 2;
    const startY = WORLD_HEIGHT / 2;
    
    const localPlayer = new PlayerState(this.localPlayerId, playerName, PLAYER_COLORS[0], startX, startY);
    // Force set initial movement direction to ensure they don't sit still
    localPlayer.direction = 'RIGHT';
    localPlayer.nextDirection = 'RIGHT';
    this.players.set(this.localPlayerId, localPlayer);
    
    // Initial camera position
    this.camera.x = startX;
    this.camera.y = startY;

    // No bots for now as requested
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

  private gameLoop = (timestamp: number) => {
    if (!this.isRunning) return;

    let frameTime = (timestamp - this.lastTimestamp) / 1000;
    if (frameTime > 0.25) frameTime = 0.25; // Panic cap
    this.lastTimestamp = timestamp;

    this.accumulator += frameTime;

    while (this.accumulator >= this.fixedDt) {
      this.update(this.fixedDt);
      this.accumulator -= this.fixedDt;
    }

    this.draw();
    this.animationFrameId = requestAnimationFrame(this.gameLoop);
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
    const playersArr = Array.from(this.players.values());
    
    playersArr.forEach(p => {
      if (p.isDead) return;

      const oldPos = { x: p.x, y: p.y };
      const oldCell = this.getCellAt(p.x, p.y);
      
      // Update direction
      p.direction = p.nextDirection;

      // Calculate movement
      const moveDist = PLAYER_SPEED * dt;
      let nextX = p.x;
      let nextY = p.y;

      switch (p.direction) {
        case 'UP': nextY -= moveDist; break;
        case 'DOWN': nextY += moveDist; break;
        case 'LEFT': nextX -= moveDist; break;
        case 'RIGHT': nextX += moveDist; break;
      }

      // Hard world boundaries
      nextX = Math.max(0, Math.min(WORLD_WIDTH, nextX));
      nextY = Math.max(0, Math.min(WORLD_HEIGHT, nextY));

      p.x = nextX;
      p.y = nextY;

      const newCell = this.getCellAt(p.x, p.y);
      const cellKey = `${newCell.x},${newCell.y}`;

      // Logic triggers when we cross into a new cell
      if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
        
        // 1. Check self-collision (hitting own trail)
        // We only check if the trail point is not the one we JUST made
        if (p.trailSet.has(cellKey)) {
          this.killPlayer(p.id);
          return;
        }

        // 2. Are we outside our territory?
        if (!p.territory.has(cellKey)) {
          // Record current cell in trail
          p.trail.push({...newCell});
          p.trailSet.add(cellKey);
          
          // Collision check against others' trails
          this.players.forEach((otherP, otherPid) => {
            if (otherPid !== p.id && !otherP.isDead && otherP.trailSet.has(cellKey)) {
              this.killPlayer(otherPid);
            }
          });
        } else {
          // We are inside our territory - complete capture if trail exists
          if (p.trail.length > 0) {
            p.trail.forEach(t => {
              const k = `${t.x},${t.y}`;
              p.territory.add(k);
              
              // Steal from any potential overlapping territories (mockup multiplayer)
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });
            
            // Apply flood fill to capture enclosed area
            const captured = captureEnclosedAreas(p.territory);
            captured.forEach(k => {
              p.territory.add(k);
              this.players.forEach(other => {
                if (other.id !== p.id) other.territory.delete(k);
              });
            });
            
            p.trail = [];
            p.trailSet.clear();
            p.updateScore();
            
            if (p.id === this.localPlayerId) {
              this.callbacks.onScoreUpdate(p.score);
            }
          }
        }
      }
    });

    // Update camera to strictly follow local player
    const lp = this.players.get(this.localPlayerId);
    if (lp && !lp.isDead) {
      this.camera.x = lp.x;
      this.camera.y = lp.y;
    }

    // Leaderboard refresh logic
    if (Math.random() < 0.05) {
      const sorted = Array.from(this.players.values())
        .filter(p => !p.isDead)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(p => ({ name: p.name, score: Number(p.score.toFixed(1)), color: p.color }));
      this.callbacks.onLeaderboardUpdate(sorted);
    }
  }

  private killPlayer(pid: string) {
    const p = this.players.get(pid);
    if (!p) return;
    p.isDead = true;
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
    // Centering camera
    this.ctx.translate(
      Math.floor(this.width / 2 - this.camera.x), 
      Math.floor(this.height / 2 - this.camera.y)
    );

    // Draw grid background
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    // Optimize: only draw lines around the player
    const startX = Math.max(0, Math.floor((this.camera.x - this.width / 2) / CELL_SIZE) * CELL_SIZE);
    const endX = Math.min(WORLD_WIDTH, Math.ceil((this.camera.x + this.width / 2) / CELL_SIZE) * CELL_SIZE);
    const startY = Math.max(0, Math.floor((this.camera.y - this.height / 2) / CELL_SIZE) * CELL_SIZE);
    const endY = Math.min(WORLD_HEIGHT, Math.ceil((this.camera.y + this.height / 2) / CELL_SIZE) * CELL_SIZE);

    for (let x = startX; x <= endX; x += CELL_SIZE) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += CELL_SIZE) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();

    // 1. Draw territories
    this.players.forEach(p => {
      if (p.isDead) return;
      this.ctx.fillStyle = p.color + '66';
      p.territory.forEach(cellKey => {
        const [x, y] = cellKey.split(',').map(Number);
        // Visibility culling
        if (x * CELL_SIZE >= startX - CELL_SIZE && x * CELL_SIZE <= endX &&
            y * CELL_SIZE >= startY - CELL_SIZE && y * CELL_SIZE <= endY) {
          this.ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      });
    });

    // 2. Draw trails
    this.players.forEach(p => {
      if (p.isDead || p.trail.length === 0) return;
      this.ctx.fillStyle = p.color + 'CC';
      p.trail.forEach(t => {
        this.ctx.fillRect(t.x * CELL_SIZE + 4, t.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
      });
      
      // Draw connection to current position
      const last = p.trail[p.trail.length - 1];
      this.ctx.beginPath();
      this.ctx.strokeStyle = p.color + 'CC';
      this.ctx.lineWidth = CELL_SIZE - 8;
      this.ctx.lineCap = 'square';
      this.ctx.moveTo(last.x * CELL_SIZE + CELL_SIZE/2, last.y * CELL_SIZE + CELL_SIZE/2);
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    });

    // 3. Draw players (mowers)
    this.players.forEach((p, pid) => {
      if (p.isDead) return;
      
      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      
      switch(p.direction) {
        case 'UP': this.ctx.rotate(0); break;
        case 'RIGHT': this.ctx.rotate(Math.PI / 2); break;
        case 'DOWN': this.ctx.rotate(Math.PI); break;
        case 'LEFT': this.ctx.rotate(-Math.PI / 2); break;
      }
      
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(-12, -10, 24, 24); // Body
      
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(-8, -4, 16, 12); // Engine
      
      this.ctx.strokeStyle = '#222';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(-10, 14, 20, 8); // Handles
      
      this.ctx.fillStyle = '#eee';
      this.ctx.beginPath();
      this.ctx.arc(0, -8, 12, Math.PI, 0);
      this.ctx.fill(); // Blade shield

      if (pid === this.localPlayerId) {
        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.moveTo(0, -16);
        this.ctx.lineTo(-5, -8);
        this.ctx.lineTo(5, -8);
        this.ctx.fill(); // Direction arrow
      }

      this.ctx.restore();
      
      // Draw name
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 12px Nunito';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(p.name, p.x, p.y - 25);
    });

    this.ctx.restore();
  }
}