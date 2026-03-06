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

  // Perform flood fill from all four edges of the WORLD, not just the bounding box.
  // This ensures that anything not reachable from the world edges is captured.
  for (let x = 0; x < gridWidth; x++) {
    for (let y of [0, gridHeight - 1]) {
      const key = `${x},${y}`;
      if (!territorySet.has(key) && !visited.has(key)) {
        visited.add(key); toExplore.push([x, y]);
      }
    }
  }
  for (let y = 0; y < gridHeight; y++) {
    for (let x of [0, gridWidth - 1]) {
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
      if (nx >= 0 && nx < gridWidth && ny >= 0 && ny < gridHeight) {
        const nKey = `${nx},${ny}`;
        if (!territorySet.has(nKey) && !visited.has(nKey)) {
          visited.add(nKey); toExplore.push([nx, ny]);
        }
      }
    }
  }
  
  // 3. Any cell that is NOT visited and NOT already in territory is captured!
  const newlyCaptured: string[] = [];
  // For the final check, we MUST check the entire grid to ensure
  // that large loops (e.g. around the starting box) are fully captured.
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