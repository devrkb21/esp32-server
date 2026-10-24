// "Match the pattern on the robot's face" pairing step of the setup hotspot.
//
// The robot draws one pattern on its screen and answers GET /pair with four candidates, each with
// its 12x12 bitmap ('X' = lit, '.' = dark), so the app always draws the robot's own table. The
// person taps the one they see; POST /pair {"id"} returns a token that /submit then requires.
// Firmware without the step answers 404 (or {"required":false}): there is nothing to match.

export const PATTERN_SIZE = 12

function validRows(rows) {
  return Array.isArray(rows)
    && rows.length === PATTERN_SIZE
    && rows.every(row => typeof row === 'string' && row.length === PATTERN_SIZE && /^[X.]+$/.test(row))
}

/**
 * Normalize a GET/POST /pair answer.
 * @returns {{ required: boolean, success: boolean, token: string, attemptsLeft: number, lockedMs: number,
 *   options: { id: number, name: string, rows: string[] }[] }}
 */
export function normalizePairState(raw) {
  const data = raw && typeof raw === 'object' ? raw : {}
  const options = (Array.isArray(data.options) ? data.options : [])
    .filter(option => option && Number.isInteger(option.id) && option.id >= 0 && validRows(option.rows))
    .map(option => ({ id: option.id, name: String(option.name || ''), rows: option.rows }))
  return {
    required: data.required !== false,
    success: data.success === true,
    token: typeof data.pair_token === 'string' ? data.pair_token : '',
    attemptsLeft: Number.isFinite(data.attempts_left) ? data.attempts_left : 0,
    lockedMs: Number.isFinite(data.locked_ms) && data.locked_ms > 0 ? data.locked_ms : 0,
    options,
  }
}

/** The lit cells of a pattern as [x, y] pairs, for drawing. */
export function litCells(rows) {
  const cells = []
  if (!validRows(rows))
    return cells
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'X')
        cells.push([x, y])
    }
  })
  return cells
}
