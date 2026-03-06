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
  
  const visited = new Set<string>();
  const toExplore: [number, number][] = [];
  
  let minX = gridWidth, maxX = 0, minY = gridHeight, maxY = 0;
  territorySet.forEach(k => {
    const [x, y] = k.split(',').map(Number);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });

  const bMinX = Math.max(0, minX - 1);
  const bMaxX = Math.min(gridWidth - 1, maxX + 1);
  const bMinY = Math.max(0, minY - 1);
  const bMaxY = Math.min(gridHeight - 1, maxY + 1);
  
  for (let x = bMinX; x <= bMaxX; x++) {
    for (let y of [bMinY, bMaxY]) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        visited.add(key); toExplore.push([x, y]);
      }
    }
  }
  for (let y = bMinY; y <= bMaxY; y++) {
    for (let x of [bMinX, bMaxX]) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        visited.add(key); toExplore.push([x, y]);
      }
    }
  }
  
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let head = 0;
  while (head < toExplore.length) {
    const [cx, cy] = toExplore[head++];
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx >= bMinX && nx <= bMaxX && ny >= bMinY && ny <= bMaxY) {
        const nKey = `${nx},${ny}`;
        if (!territorySet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey); toExplore.push([nx, ny]);
        }
      }
    }
  }
  
  const newlyCaptured: string[] = [];
  for (let x = bMinX; x <= bMaxX; x++) {
    for (let y = bMinY; y <= bMaxY; y++) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        newlyCaptured.push(key);
      }
    }
  }
  return newlyCaptured;
}