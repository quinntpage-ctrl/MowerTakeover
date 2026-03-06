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
  score: number;
  isBot: boolean;

  constructor(id: string, name: string, color: string, startX: number, startY: number, isBot: boolean = false) {
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
    this.score = 0;
    this.isBot = isBot;
    
    // Use CELL_SIZE constant
    const gridX = Math.floor(startX / CELL_SIZE);
    const gridY = Math.floor(startY / CELL_SIZE);
    
    this.territory.clear();
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
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