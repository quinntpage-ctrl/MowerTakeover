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
  // We'll perform a flood fill from the edges of the map.
  // Any cell that we cannot reach from the edge (and is not already territory)
  // must be enclosed by the territory!
  
  const visited = new Set<string>();
  const toExplore: [number, number][] = [];
  
  // 1. Add all edge cells to the explore queue if they aren't territory
  for (let x = 0; x < gridWidth; x++) {
    for (let y of [0, gridHeight - 1]) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        visited.add(key);
        toExplore.push([x, y]);
      }
    }
  }
  
  for (let y = 0; y < gridHeight; y++) {
    for (let x of [0, gridWidth - 1]) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        visited.add(key);
        toExplore.push([x, y]);
      }
    }
  }
  
  // 2. Iterative flood fill for all "outside" cells
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  
  let head = 0;
  while (head < toExplore.length) {
    const [cx, cy] = toExplore[head++];
    
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        const nKey = `${nx},${ny}`;
        if (!territorySet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey);
          toExplore.push([nx, ny]);
        }
      }
    }
  }
  
  // 3. Any cell that is NOT visited and NOT already in territory is captured!
  const newlyCaptured: string[] = [];
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        newlyCaptured.push(key);
      }
    }
  }
  
  return newlyCaptured;
}