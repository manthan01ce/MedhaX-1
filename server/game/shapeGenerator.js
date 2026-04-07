/**
 * Shape Generator for CodeDuel
 * Generates random multi-cell shapes (line, L, T, zigzag, cross, etc.)
 * Shapes are defined as arrays of [row, col] offsets from origin [0,0]
 */

// Shape templates - each is an array of [row, col] offsets
const SHAPE_TEMPLATES = {
  // Size 2
  line2_h: [[0, 0], [0, 1]],
  line2_v: [[0, 0], [1, 0]],

  // Size 3
  line3_h: [[0, 0], [0, 1], [0, 2]],
  line3_v: [[0, 0], [1, 0], [2, 0]],
  l3_a: [[0, 0], [1, 0], [1, 1]],
  l3_b: [[0, 0], [0, 1], [1, 0]],
  l3_c: [[0, 0], [0, 1], [1, 1]],
  l3_d: [[0, 0], [1, 0], [1, -1]],

  // Size 4
  line4_h: [[0, 0], [0, 1], [0, 2], [0, 3]],
  line4_v: [[0, 0], [1, 0], [2, 0], [3, 0]],
  l4_a: [[0, 0], [1, 0], [2, 0], [2, 1]],
  l4_b: [[0, 0], [1, 0], [2, 0], [2, -1]],
  t4: [[0, 0], [0, 1], [0, 2], [1, 1]],
  s4: [[0, 0], [0, 1], [1, 1], [1, 2]],
  z4: [[0, 1], [0, 2], [1, 0], [1, 1]],
  square4: [[0, 0], [0, 1], [1, 0], [1, 1]],

  // Size 5
  line5_h: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  l5: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1]],
  t5: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1]],
  cross5: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]],
  u5: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2]],
  s5: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2]],
  zigzag5: [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  p5: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0]],

  // Size 6
  line6_h: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
  bigL: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]],
  bigT: [[0, 0], [0, 1], [0, 2], [0, 3], [1, 1], [1, 2]],
  staircase6: [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3]],
  cross6: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1], [3, 1]],
};

/**
 * Rotate a shape 90 degrees clockwise
 */
function rotateShape(cells) {
  return cells.map(([r, c]) => [c, -r]);
}

/**
 * Normalize shape so minimum row/col is 0
 */
function normalizeShape(cells) {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/**
 * Get all 4 rotations of a shape (deduplicated)
 */
function getAllRotations(cells) {
  const rotations = [];
  let current = cells;
  const seen = new Set();
  for (let i = 0; i < 4; i++) {
    const norm = normalizeShape(current);
    const key = JSON.stringify(norm);
    if (!seen.has(key)) {
      seen.add(key);
      rotations.push(norm);
    }
    current = rotateShape(current);
  }
  return rotations;
}

/**
 * Pick random item from array
 */
function randItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Generate a set of shapes for a match
 * @param {number} questionCount - 10, 20, or 50
 * @returns {{ shapes: Array<{ id: string, cells: number[][], rotations: number[][][] }>, totalCells: number }}
 */
function generateShapes(questionCount) {
  let targetCells;
  let shapeSizes;

  switch (questionCount) {
    case 10:
      targetCells = 6;
      // 2 shapes: could be 3+3 or 2+4
      shapeSizes = randItem([[3, 3], [2, 4]]);
      break;
    case 20:
      targetCells = 12;
      // 3 shapes of various sizes
      shapeSizes = randItem([[3, 4, 5], [4, 4, 4], [3, 3, 6], [2, 4, 6]]);
      break;
    case 50:
      targetCells = 30;
      // 5-6 shapes
      shapeSizes = randItem([
        [4, 5, 5, 6, 5, 5],
        [3, 4, 5, 6, 6, 6],
        [5, 5, 5, 5, 5, 5],
        [3, 4, 4, 5, 6, 4, 4],
        [4, 5, 6, 5, 5, 5],
      ]);
      break;
    default:
      throw new Error('Invalid question count');
  }

  const shapes = [];
  const usedTemplates = new Set();

  for (let i = 0; i < shapeSizes.length; i++) {
    const size = shapeSizes[i];
    // Get all templates of this size
    const candidates = Object.entries(SHAPE_TEMPLATES)
      .filter(([name, cells]) => cells.length === size && !usedTemplates.has(name));

    if (candidates.length === 0) {
      // If no unused templates of this exact size, find closest
      const allOfSize = Object.entries(SHAPE_TEMPLATES)
        .filter(([, cells]) => cells.length === size);
      if (allOfSize.length > 0) {
        const [name, cells] = randItem(allOfSize);
        const normalized = normalizeShape(cells);
        const rotations = getAllRotations(cells);
        shapes.push({
          id: `shape_${i}`,
          name,
          cells: normalized,
          size,
          rotations,
        });
        continue;
      }
    }

    const [name, cells] = randItem(candidates.length > 0 ? candidates : Object.entries(SHAPE_TEMPLATES).filter(([, c]) => c.length === size));
    usedTemplates.add(name);
    const normalized = normalizeShape(cells);
    const rotations = getAllRotations(cells);

    shapes.push({
      id: `shape_${i}`,
      name,
      cells: normalized,
      size,
      rotations,
    });
  }

  return {
    shapes,
    totalCells: shapeSizes.reduce((a, b) => a + b, 0),
  };
}

module.exports = { generateShapes, normalizeShape, getAllRotations };
