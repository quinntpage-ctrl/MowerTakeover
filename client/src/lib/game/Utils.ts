import { GRID_SIZE } from './Constants';

/**
 * Optimized flood fill to capture enclosed areas.
 * When a player closes a loop by returning to their territory, 
 * we need to find all cells that are enclosed by their territory and trail.
 */
export function captureEnclosedAreas(
  territorySet: Set<string>, 
  gridWidth: number = GRID_SIZE, 
  gridHeight: number = GRID_SIZE
): string[] {
  if (territorySet.size === 0) return [];
  
  // For a reliable capture, we need to know what area is enclosed by the path + existing territory.
  // We'll run a flood fill from a virtual boundary OUTSIDE the grid. 
  // Any cell we reach is NOT enclosed.
  // Everything else inside the grid that is not already territory becomes new territory.
  
  const visited = new Set<string>();
  const toExplore: [number, number][] = [];
  
  // Start flood fill from a single point outside the grid
  toExplore.push([-1, -1]);
  visited.add(`-1,-1`);

  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let head = 0;
  
  while (head < toExplore.length) {
    const [cx, cy] = toExplore[head++];

    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      
      // Allow exploring a 1-cell padding around the grid
      if (nx >= -1 && nx <= gridWidth && ny >= -1 && ny <= gridHeight) {
        const nKey = `${nx},${ny}`;
        if (!visited.has(nKey)) {
          visited.add(nKey);
          
          // Only spread if the cell is not territory
          if (!territorySet.has(nKey)) {
            toExplore.push([nx, ny]);
          }
        }
      }
    }
  }
  
  const newlyCaptured: string[] = [];
  // Any cell WITHIN the grid that wasn't visited by the flood fill 
  // and isn't already territory is now captured!
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      if (!visited.has(key) && !territorySet.has(key)) {
        newlyCaptured.push(key);
      }
    }
  }
  return newlyCaptured;
}