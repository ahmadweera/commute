import { describe, it, expect } from 'vitest'
import {
  getTransitFromStep,
  stepUsesAgency,
  isGoTransitStep,
  transitUsesViaRail,
  isLocalTransitAgency,
  transitUsesOnlyGoOrWalk,
  getLastGoStepIndex,
  getTransitInfo,
} from './transitSteps.js'

describe('getTransitFromStep', () => {
  it('returns step.transit when present', () => {
    const step = { transit: { line: {} } }
    expect(getTransitFromStep(step)).toBe(step.transit)
  })
  it('returns step.transit_details when transit missing', () => {
    const step = { transit_details: { line: {} } }
    expect(getTransitFromStep(step)).toBe(step.transit_details)
  })
  it('returns null for non-transit step', () => {
    expect(getTransitFromStep({})).toBe(null)
    expect(getTransitFromStep(null)).toBe(null)
  })
})

describe('stepUsesAgency', () => {
  it('returns true when agency name matches predicate', () => {
    const step = {
      transit: { line: { agencies: [{ name: 'GO Transit' }] } },
    }
    expect(stepUsesAgency(step, (name) => name.includes('GO'))).toBe(true)
  })
  it('returns false when no match', () => {
    const step = {
      transit: { line: { agencies: [{ name: 'TTC' }] } },
    }
    expect(stepUsesAgency(step, (name) => name.includes('GO'))).toBe(false)
  })
})

describe('isGoTransitStep', () => {
  it('returns true for GO agency', () => {
    const step = { transit: { line: { agencies: [{ name: 'GO Transit' }] } } }
    expect(isGoTransitStep(step)).toBe(true)
  })
  it('returns false for non-GO', () => {
    const step = { transit: { line: { agencies: [{ name: 'TTC' }] } } }
    expect(isGoTransitStep(step)).toBe(false)
  })
})

describe('transitUsesViaRail', () => {
  it('returns true when leg has Via Rail step', () => {
    const leg = {
      steps: [{ transit: { line: { agencies: [{ name: 'Via Rail' }] } } }],
    }
    expect(transitUsesViaRail(leg)).toBe(true)
  })
  it('returns false when no Via Rail', () => {
    const leg = {
      steps: [{ transit: { line: { agencies: [{ name: 'GO Transit' }] } } }],
    }
    expect(transitUsesViaRail(leg)).toBe(false)
  })
  it('returns false for empty leg', () => {
    expect(transitUsesViaRail({})).toBe(false)
    expect(transitUsesViaRail({ steps: [] })).toBe(false)
  })
})

describe('isLocalTransitAgency', () => {
  it('returns true for known local agencies', () => {
    expect(isLocalTransitAgency('Toronto Transit Commission')).toBe(true)
    expect(isLocalTransitAgency('TTC')).toBe(true)
    expect(isLocalTransitAgency('MiWay')).toBe(true)
  })
  it('returns false for GO', () => {
    expect(isLocalTransitAgency('GO Transit')).toBe(false)
  })
})

describe('transitUsesOnlyGoOrWalk', () => {
  it('returns true when leg has only GO transit', () => {
    const leg = {
      steps: [{ transit: { line: { agencies: [{ name: 'GO Transit' }] } } }],
    }
    expect(transitUsesOnlyGoOrWalk(leg)).toBe(true)
  })
  it('returns false when leg has local transit', () => {
    const leg = {
      steps: [{ transit: { line: { agencies: [{ name: 'TTC' }] } } }],
    }
    expect(transitUsesOnlyGoOrWalk(leg)).toBe(false)
  })
})

describe('getLastGoStepIndex', () => {
  it('returns index of last GO step', () => {
    const leg = {
      steps: [
        { transit: { line: { agencies: [{ name: 'GO Transit' }] } } },
        { transit: { line: { agencies: [{ name: 'TTC' }] } } },
      ],
    }
    expect(getLastGoStepIndex(leg)).toBe(0)
  })
  it('returns -1 when no GO step', () => {
    const leg = { steps: [{ transit: { line: { agencies: [{ name: 'TTC' }] } } }] }
    expect(getLastGoStepIndex(leg)).toBe(-1)
  })
})

describe('getTransitInfo', () => {
  it('returns line and stop info', () => {
    const step = {
      transit: {
        line: { short_name: 'L1', vehicle: { name: 'Train' } },
        departure_stop: { name: 'A' },
        arrival_stop: { name: 'B' },
      },
    }
    expect(getTransitInfo(step)).toEqual({ lineName: 'L1', vehicle: 'Train', from: 'A', to: 'B' })
  })
  it('returns null for non-transit step', () => {
    expect(getTransitInfo({})).toBe(null)
  })
})
