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
    this.setupInputs();
  }

  private initGame(playerName: string) {
    this.players.clear();
    const startX = WORLD_WIDTH / 2;
    const startY = WORLD_HEIGHT / 2;
    
    const localPlayer = new PlayerState(this.localPlayerId, playerName, PLAYER_COLORS[0], startX, startY);
    localPlayer.direction = 'RIGHT';
    localPlayer.nextDirection = 'RIGHT';
    
    // Position exactly in the center of the middle cell
    localPlayer.x = Math.floor(startX / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    localPlayer.y = Math.floor(startY / CELL_SIZE) * CELL_SIZE + CELL_SIZE / 2;
    
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

  private gameLoop = (timestamp: number) => {
    if (!this.isRunning) return;

    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, 0.1);
    this.lastTimestamp = timestamp;

    this.update(dt);
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
    const onKey = (e: KeyboardEvent) => {
      switch(e.key.toLowerCase()) {
        case 'arrowup': case 'w': this.setPlayerDirection('UP'); break;
        case 'arrowdown': case 's': this.setPlayerDirection('DOWN'); break;
        case 'arrowleft': case 'a': this.setPlayerDirection('LEFT'); break;
        case 'arrowright': case 'd': this.setPlayerDirection('RIGHT'); break;
      }
    };
    window.addEventListener('keydown', onKey);
  }

  private getCellAt(x: number, y: number): Point {
    return {
      x: Math.floor(x / CELL_SIZE),
      y: Math.floor(y / CELL_SIZE)
    };
  }

  private update(dt: number) {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isDead) return;

    const oldCell = this.getCellAt(p.x, p.y);
    
    // Immediate direction update
    p.direction = p.nextDirection;

    const moveDist = PLAYER_SPEED * dt;
    if (p.direction === 'UP') p.y -= moveDist;
    else if (p.direction === 'DOWN') p.y += moveDist;
    else if (p.direction === 'LEFT') p.x -= moveDist;
    else if (p.direction === 'RIGHT') p.x += moveDist;

    // Strict world bounds
    p.x = Math.max(0, Math.min(WORLD_WIDTH, p.x));
    p.y = Math.max(0, Math.min(WORLD_HEIGHT, p.y));

    const newCell = this.getCellAt(p.x, p.y);
    const cellKey = `${newCell.x},${newCell.y}`;

    if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
      // Logic for trail and territory
      if (p.territory.has(cellKey)) {
        // Entering territory - finalize capture if we have a trail
        if (p.trail.length > 0) {
          // Add the final point to the territory before calculating enclosure
          p.trail.forEach(t => {
            p.territory.add(`${t.x},${t.y}`);
            p.trailSet.delete(`${t.x},${t.y}`); // Clean up as we go
          });
          
          // Use a fresh set for capture calculation to avoid reference issues
          const captured = captureEnclosedAreas(new Set(p.territory));
          captured.forEach(k => {
            p.territory.add(k);
            this.players.forEach(other => {
              if (other.id !== p.id) other.territory.delete(k);
            });
          });
          
          p.trail = [];
          p.trailSet.clear();
          p.updateScore();
          this.callbacks.onScoreUpdate(p.score);
        }
      } else {
        // Outside territory - check trail collision
        // Grace period: don't kill if hitting the very last cell we just left
        if (p.trailSet.has(cellKey)) {
          const lastPoint = p.trail[p.trail.length - 1];
          // If the collision is with a trail point that isn't the immediate previous one
          if (lastPoint && (lastPoint.x !== newCell.x || lastPoint.y !== newCell.y)) {
             this.killPlayer(p.id);
             return;
          }
        }
        
        // Add to trail
        p.trail.push({...newCell});
        p.trailSet.add(cellKey);
        
        // Check if we hit someone else's trail
        this.players.forEach((otherP, otherPid) => {
          if (otherPid !== p.id && !otherP.isDead && otherP.trailSet.has(cellKey)) {
            this.killPlayer(otherPid);
          }
        });
      }
    }

    // Direct camera lock
    this.camera.x = p.x;
    this.camera.y = p.y;
  }

  private killPlayer(pid: string) {
    const p = this.players.get(pid);
    if (!p) return;
    p.isDead = true;
    this.callbacks.onGameOver(p.score);
  }

  private draw() {
    this.ctx.fillStyle = COLORS.bg;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    this.ctx.save();
    this.ctx.translate(
      Math.floor(this.width / 2 - this.camera.x), 
      Math.floor(this.height / 2 - this.camera.y)
    );

    // Optimized Grid
    this.ctx.strokeStyle = COLORS.grid;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    
    const startX = Math.floor((this.camera.x - this.width/2) / CELL_SIZE) * CELL_SIZE;
    const endX = startX + this.width + CELL_SIZE * 2;
    const startY = Math.floor((this.camera.y - this.height/2) / CELL_SIZE) * CELL_SIZE;
    const endY = startY + this.height + CELL_SIZE * 2;

    for (let x = startX; x <= endX; x += CELL_SIZE) {
      if (x < 0 || x > WORLD_WIDTH) continue;
      this.ctx.moveTo(x, Math.max(0, startY));
      this.ctx.lineTo(x, Math.min(WORLD_HEIGHT, endY));
    }
    for (let y = startY; y <= endY; y += CELL_SIZE) {
      if (y < 0 || y > WORLD_HEIGHT) continue;
      this.ctx.moveTo(Math.max(0, startX), y);
      this.ctx.lineTo(Math.min(WORLD_WIDTH, endX), y);
    }
    this.ctx.stroke();

    const p = this.players.get(this.localPlayerId);
    if (p && !p.isDead) {
      // 1. Territories
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

      // 3. Trail connection line
      if (p.trail.length > 0) {
        const last = p.trail[p.trail.length - 1];
        this.ctx.beginPath();
        this.ctx.strokeStyle = p.color + 'AA';
        this.ctx.lineWidth = CELL_SIZE - 8;
        this.ctx.lineCap = 'round';
        this.ctx.moveTo(last.x * CELL_SIZE + CELL_SIZE/2, last.y * CELL_SIZE + CELL_SIZE/2);
        this.ctx.lineTo(p.x, p.y);
        this.ctx.stroke();
      }

      // 4. Mower
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
    }

    this.ctx.restore();
  }
}