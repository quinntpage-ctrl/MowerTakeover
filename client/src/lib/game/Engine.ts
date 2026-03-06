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
    this.setupInputs();
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
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isDead) return;

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

    const newCell = this.getCellAt(p.x, p.y);
    const cellKey = `${newCell.x},${newCell.y}`;
    const oldCellKey = `${oldCell.x},${oldCell.y}`;

    // Ensure we don't kill the player on the exact frame they step out of their territory
    if (oldCell.x !== newCell.x || oldCell.y !== newCell.y) {
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
          this.callbacks.onScoreUpdate(p.score);
        }
      } else {
        // HOSTILE TERRITORY
        const isSelfCollision = p.trailSet.has(cellKey);
        
        // IMMUNITY: Allow sharp turns by ignoring the last 3 points
        const isRecentTrail = p.trail.slice(-3).some(t => t.x === newCell.x && t.y === newCell.y);

        // Ensure we don't kill the player on the exact frame they step out of their territory
        const oldCellKey = `${oldCell.x},${oldCell.y}`;
        const justLeftSafeZone = p.territory.has(oldCellKey);

        if (isSelfCollision && !isRecentTrail && !justLeftSafeZone) {
          this.killPlayer(p.id, 'self-collision');
          return;
        }
        
        // Check if we hit someone else's trail
        this.players.forEach((otherP, otherPid) => {
          if (otherPid !== p.id && !otherP.isDead && otherP.trailSet.has(cellKey)) {
            this.killPlayer(otherPid, 'killed-by-other');
          }
        });

        // Add current cell to trail
        // To handle crossing into the safezone perfectly, only record non-safezone steps
        p.trail.push({...newCell});
        p.trailSet.add(cellKey);
      }
    }

    // Camera follow
    this.camera.x = p.x;
    this.camera.y = p.y;
  }

  private killPlayer(pid: string, reason: string = 'unknown') {
    const p = this.players.get(pid);
    if (!p) return;
    p.isDead = true;
    p.trail = [];
    p.trailSet.clear();
    console.log(`Player ${pid} killed: ${reason}`);
    this.callbacks.onGameOver(p.score, reason);
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

    const lp = this.players.get(this.localPlayerId);
    if (lp && !lp.isDead) {
      // 1. Territory
      this.ctx.fillStyle = lp.color + '44';
      lp.territory.forEach(key => {
        const [cx, cy] = key.split(',').map(Number);
        if (cx * CELL_SIZE >= startX - CELL_SIZE && cx * CELL_SIZE <= endX &&
            cy * CELL_SIZE >= startY - CELL_SIZE && cy * CELL_SIZE <= endY) {
          this.ctx.fillRect(cx * CELL_SIZE, cy * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      });

      // 2. Trail
      this.ctx.fillStyle = lp.color + 'AA';
      lp.trail.forEach(t => {
        if (t.x * CELL_SIZE >= startX - CELL_SIZE && t.x * CELL_SIZE <= endX &&
            t.y * CELL_SIZE >= startY - CELL_SIZE && t.y * CELL_SIZE <= endY) {
          this.ctx.fillRect(t.x * CELL_SIZE + 4, t.y * CELL_SIZE + 4, CELL_SIZE - 8, CELL_SIZE - 8);
        }
      });

      // 3. Mower
      this.ctx.save();
      this.ctx.translate(lp.x, lp.y);
      if (lp.direction === 'RIGHT') this.ctx.rotate(Math.PI/2);
      else if (lp.direction === 'DOWN') this.ctx.rotate(Math.PI);
      else if (lp.direction === 'LEFT') this.ctx.rotate(-Math.PI/2);
      
      this.ctx.fillStyle = lp.color;
      this.ctx.fillRect(-12, -12, 24, 24);
      this.ctx.fillStyle = '#333';
      this.ctx.fillRect(-8, -4, 16, 12);
      this.ctx.restore();
      
      // 4. Name
      this.ctx.fillStyle = '#000';
      this.ctx.font = 'bold 12px Nunito';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(lp.name, lp.x, lp.y - 25);
    }

    this.ctx.restore();
  }
}