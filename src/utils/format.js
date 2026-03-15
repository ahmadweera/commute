/**
 * Shared formatters for duration and distance (Directions API shape).
 */

/**
 * Format duration in seconds as "X min" or "X hr Y min".
 * @param {number} valueSeconds - Duration in seconds
 * @returns {string}
 */
export function formatDuration(valueSeconds) {
  if (valueSeconds == null || Number.isNaN(valueSeconds)) return '—'
  const mins = Math.round(valueSeconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

/**
 * Format a Directions API duration object.
 * @param {{ value?: number } | null} duration - e.g. leg.duration
 * @returns {string}
 */
export function formatDurationFromObj(duration) {
  if (duration?.value == null) return '—'
  return formatDuration(duration.value)
}

/**
 * Short form for step-by-step display: "Xh Ym".
 * @param {number} valueSeconds - Duration in seconds
 * @returns {string}
 */
export function formatDurationShort(valueSeconds) {
  if (valueSeconds == null || Number.isNaN(valueSeconds)) return ''
  const mins = Math.round(valueSeconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * Format a Directions API distance object (uses .text when present).
 * @param {{ text?: string, value?: number } | null} distance - e.g. leg.distance
 * @returns {string}
 */
export function formatDistance(distance) {
  if (!distance) return '—'
  return distance.text ?? '—'
}
