/**
 * Helpers for Directions API transit steps (step.transit / step.transit_details).
 * Single source of truth for "GO step", "Via Rail", "local agency", etc.
 */

/**
 * @param {object} step - Directions step (may have .transit or .transit_details)
 * @returns {object | null} step.transit or step.transit_details
 */
export function getTransitFromStep(step) {
  if (!step) return null
  return step.transit ?? step.transit_details ?? null
}

/**
 * Check if any agency in the step's line matches a predicate.
 * @param {object} step - Directions step
 * @param {(agencyName: string) => boolean} predicate
 * @returns {boolean}
 */
export function stepUsesAgency(step, predicate) {
  const t = getTransitFromStep(step)
  if (!t?.line?.agencies?.length) return false
  return t.line.agencies.some((a) => predicate((a?.name ?? '').trim()))
}

/**
 * @param {object} step - Directions step
 * @returns {boolean}
 */
export function isGoTransitStep(step) {
  return stepUsesAgency(step, (name) => name.toLowerCase().includes('go'))
}

/**
 * @param {object} leg - Directions leg with steps
 * @returns {boolean}
 */
export function transitUsesViaRail(leg) {
  const steps = leg?.steps ?? []
  for (const step of steps) {
    if (stepUsesAgency(step, (name) => name.toLowerCase().includes('via rail'))) return true
  }
  return false
}

const LOCAL_TRANSIT_NAMES = [
  'ttc',
  'toronto transit',
  'hsr',
  'hamilton street',
  'miway',
  'mississauga',
  'brampton',
  'drt',
  'durham region',
  'yrt',
  'york region',
  'viva',
  'oakville',
  'burlington',
]

/**
 * @param {string} name - Agency name
 * @returns {boolean}
 */
export function isLocalTransitAgency(name) {
  const n = (name ?? '').toLowerCase()
  return LOCAL_TRANSIT_NAMES.some((local) => n.includes(local))
}

/**
 * True if the leg uses only GO (or similar) and walking — no TTC, MiWay, etc.
 * @param {object} transitLeg - Directions leg
 * @returns {boolean}
 */
export function transitUsesOnlyGoOrWalk(transitLeg) {
  const steps = transitLeg?.steps ?? []
  for (const step of steps) {
    const t = getTransitFromStep(step)
    if (!t) continue
    const agencies = t.line?.agencies ?? []
    for (const a of agencies) {
      const an = a?.name ?? ''
      if (an && isLocalTransitAgency(an)) return false
    }
  }
  return true
}

/**
 * Index of the last step in the leg that is a GO Transit step.
 * Stops at first local transit agency.
 * @param {object} transitLeg - Directions leg
 * @returns {number} -1 if none
 */
export function getLastGoStepIndex(transitLeg) {
  const steps = transitLeg?.steps ?? []
  let lastGo = -1
  for (let i = 0; i < steps.length; i++) {
    const t = getTransitFromStep(steps[i])
    if (!t) continue
    const agencies = t.line?.agencies ?? []
    const isGo = agencies.some((a) => (a?.name ?? '').toLowerCase().includes('go'))
    if (isGo) lastGo = i
    else if (isLocalTransitAgency(agencies[0]?.name ?? '')) break
  }
  return lastGo
}

/**
 * Extract display info from a transit step for route details.
 * @param {object} step - Directions step
 * @returns {{ lineName: string, vehicle: string, from: string, to: string } | null}
 */
export function getTransitInfo(step) {
  const t = getTransitFromStep(step)
  if (!t) return null
  const line = t.line
  const lineName = line?.short_name || line?.name || 'Transit'
  const vehicle = line?.vehicle?.name || ''
  const from = t.departure_stop?.name ?? ''
  const to = t.arrival_stop?.name ?? ''
  return { lineName, vehicle, from, to }
}
