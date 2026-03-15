import { describe, it, expect } from 'vitest'
import {
  isGoStation,
  hasOnSiteParking,
  isGoStationFallback,
  isGoStationWithStreetParking,
  GO_STATIONS_WITH_PARKING,
} from './goStations.js'

describe('isGoStation', () => {
  it('returns true when name includes go', () => {
    expect(isGoStation({ name: 'Oakville GO Station' })).toBe(true)
  })
  it('returns true when agency is GO', () => {
    expect(isGoStation({ line: { agencies: [{ name: 'GO Transit' }] } })).toBe(true)
  })
  it('returns false otherwise', () => {
    expect(isGoStation({ name: 'Union Station' })).toBe(false)
  })
})

describe('hasOnSiteParking', () => {
  it('returns true for allowlisted GO station', () => {
    expect(hasOnSiteParking({ name: 'Oakville GO', line: { agencies: [{ name: 'GO Transit' }] } })).toBe(true)
  })
  it('returns false for Union Station', () => {
    expect(hasOnSiteParking({ name: 'Union Station', line: { agencies: [{ name: 'GO' }] } })).toBe(false)
  })
  it('returns false for street-level stop', () => {
    expect(hasOnSiteParking({ name: 'King St. W. @ Pearl St. N.', line: { agencies: [{ name: 'GO' }] } })).toBe(false)
  })
})

describe('isGoStationFallback', () => {
  it('returns true for GO station that is not no-parking and not street-level', () => {
    expect(isGoStationFallback({ name: 'Some GO Stop', line: { agencies: [{ name: 'GO' }] } })).toBe(true)
  })
  it('returns false for Union Station', () => {
    expect(isGoStationFallback({ name: 'Union Station', line: { agencies: [{ name: 'GO' }] } })).toBe(false)
  })
})

describe('isGoStationWithStreetParking', () => {
  it('returns true for Union Station', () => {
    expect(isGoStationWithStreetParking({ name: 'Union Station', line: { agencies: [{ name: 'GO' }] } })).toBe(true)
  })
})

describe('GO_STATIONS_WITH_PARKING', () => {
  it('includes expected stations', () => {
    expect(GO_STATIONS_WITH_PARKING).toContain('Oakville')
    expect(GO_STATIONS_WITH_PARKING).toContain('Aldershot')
  })
})
