import { Direction, GRID_SIZE, CELL_SIZE } from './Constants';

export interface Point {
  x: number;
  y: number;
}

export class PlayerState {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  direction: Direction;
  nextDirection: Direction;
  territory: Set<string>; 
  trail: Point[];
  trailSet: Set<string>; 
  isDead: boolean;
  deathAlpha: number;
  deathReason: string;
  score: number;
  isBot: boolean;
  trailType: "grass" | "flame" | "star" | "smile";
  rank: number;

  constructor(id: string, name: string, color: string, startX: number, startY: number, isBot: boolean = false, trailType: "grass" | "flame" | "star" | "smile" = "grass") {
    this.id = id;
    this.name = name;
    this.color = color;
    this.x = startX;
    this.y = startY;
    this.direction = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.territory = new Set();
    this.trail = [];
    this.trailSet = new Set();
    this.isDead = false;
    this.deathAlpha = 1.0;
    this.deathReason = '';
    this.score = 0;
    this.isBot = isBot;
    this.trailType = trailType;
    this.rank = 0;
    
    // Use CELL_SIZE constant
    const gridX = Math.floor(startX / CELL_SIZE);
    const gridY = Math.floor(startY / CELL_SIZE);
    
    this.territory.clear();
    // Start with a 7x7 zone to ensure it's large enough to safely turn around in
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
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
    this.score = (this.territory.size / (GRID_SIZE * GRID_SIZE)) * 100;
  }
}