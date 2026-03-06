import { GRID_SIZE } from './Constants';

export function captureEnclosedAreas(
  territorySet: Set<string>,
  gridWidth: number = GRID_SIZE,
  gridHeight: number = GRID_SIZE
): string[] {
  if (territorySet.size === 0) return [];

  const visited = new Set<string>();
  const toExplore: [number, number][] = [];

  toExplore.push([-1, -1]);
  visited.add(`-1,-1`);

  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let head = 0;

  while (head < toExplore.length) {
    const [cx, cy] = toExplore[head++];

    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy;

      if (nx >= -1 && nx <= gridWidth && ny >= -1 && ny <= gridHeight) {
        const nKey = `${nx},${ny}`;
        if (!visited.has(nKey)) {
          visited.add(nKey);

          if (!territorySet.has(nKey)) {
            toExplore.push([nx, ny]);
          }
        }
      }
    }
  }

  const newlyCaptured: string[] = [];
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
