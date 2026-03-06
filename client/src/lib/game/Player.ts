import { Direction, GRID_SIZE } from './Constants';

export interface Point {
  x: number;
  y: number;
}

export class PlayerState {
  id: string;
  name: string;
  color: string;
  
  // Real pixel coordinates (center of the player)
  x: number;
  y: number;
  
  // Current movement direction
  direction: Direction;
  nextDirection: Direction;
  
  // The cells currently owned by the player
  territory: Set<string>; // Stored as "x,y"
  
  // The cells currently forming the player's trail
  trail: Point[];
  trailSet: Set<string>; // For quick lookup
  
  isDead: boolean;
  score: number;
  isBot: boolean;

  constructor(id: string, name: string, color: string, startX: number, startY: number, isBot: boolean = false) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.x = startX;
    this.y = startY;
    this.direction = 'UP';
    this.nextDirection = 'UP';
    this.territory = new Set();
    this.trail = [];
    this.trailSet = new Set();
    this.isDead = false;
    this.score = 0;
    this.isBot = isBot;
    
    // Initialize start territory (3x3 grid around start position)
    const gridX = Math.floor(startX / 30); // 30 is CELL_SIZE
    const gridY = Math.floor(startY / 30);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nx = gridX + dx;
        const ny = gridY + dy;
        if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
          this.territory.add(`${nx},${ny}`);
        }
      }
    }
    
    this.updateScore();
  }

  updateScore() {
    // Score is percentage of total map
    this.score = (this.territory.size / (GRID_SIZE * GRID_SIZE)) * 100;
  }
}