/**
 * Board Validator for CodeDuel
 * Validates player shape placement against game rules
 */

/**
 * Get grid size for question count
 */
function getGridSize(questionCount) {
  switch (questionCount) {
    case 10: return 5;
    case 20: return 7;
    case 50: return 10;
    default: throw new Error('Invalid question count');
  }
}

/**
 * Validate a player's shape placement
 * @param {Array} placements - Array of { shapeId, cells: [[row, col], ...], rotationIndex }
 * @param {Array} shapes - The generated shapes for this match
 * @param {number} gridSize - Grid dimension
 * @returns {{ valid: boolean, error?: string, board?: number[][] }}
 */
function validatePlacement(placements, shapes, gridSize) {
  // Check all shapes are placed
  if (placements.length !== shapes.length) {
    return { valid: false, error: `Must place all ${shapes.length} shapes. Got ${placements.length}.` };
  }

  // Track which shapes have been placed
  const placedShapeIds = new Set();
  // Track occupied cells
  const occupied = new Set();
  // Build the board
  const board = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));

  for (const placement of placements) {
    const { shapeId, cells } = placement;

    // Check shape exists
    const shape = shapes.find(s => s.id === shapeId);
    if (!shape) {
      return { valid: false, error: `Unknown shape: ${shapeId}` };
    }

    // Check not duplicate
    if (placedShapeIds.has(shapeId)) {
      return { valid: false, error: `Shape ${shapeId} placed more than once` };
    }
    placedShapeIds.add(shapeId);

    // Check correct number of cells
    if (cells.length !== shape.size) {
      return { valid: false, error: `Shape ${shapeId} requires ${shape.size} cells, got ${cells.length}` };
    }

    // Validate the cells form a valid rotation of the shape
    if (!isValidShapeRotation(cells, shape)) {
      return { valid: false, error: `Cells for ${shapeId} don't form a valid rotation of the shape` };
    }

    for (const [r, c] of cells) {
      // Check bounds
      if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
        return { valid: false, error: `Shape ${shapeId} goes outside the grid at [${r},${c}]` };
      }

      // Check overlap
      const key = `${r},${c}`;
      if (occupied.has(key)) {
        return { valid: false, error: `Shape ${shapeId} overlaps at [${r},${c}]` };
      }
      occupied.add(key);
      board[r][c] = 1;
    }
  }

  // Check all shapes placed
  for (const shape of shapes) {
    if (!placedShapeIds.has(shape.id)) {
      return { valid: false, error: `Shape ${shape.id} not placed` };
    }
  }

  return { valid: true, board };
}

/**
 * Check if placed cells form a valid rotation of the shape
 */
function isValidShapeRotation(cells, shape) {
  // Normalize the placed cells
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  const normalized = cells
    .map(([r, c]) => [r - minR, c - minC])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  // Check against all rotations
  for (const rotation of shape.rotations) {
    const sorted = [...rotation].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (JSON.stringify(normalized) === JSON.stringify(sorted)) {
      return true;
    }
  }
  return false;
}

module.exports = { validatePlacement, getGridSize };
