import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationFromObj, formatDurationShort, formatDistance } from './format.js'

describe('formatDuration', () => {
  it('formats minutes under 60', () => {
    expect(formatDuration(0)).toBe('0 min')
    expect(formatDuration(300)).toBe('5 min')
    expect(formatDuration(3540)).toBe('59 min')
  })
  it('formats hours and minutes', () => {
    expect(formatDuration(3600)).toBe('1 hr')
    expect(formatDuration(3660)).toBe('1 hr 1 min')
    expect(formatDuration(7200)).toBe('2 hr')
  })
  it('returns — for invalid input', () => {
    expect(formatDuration(NaN)).toBe('—')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
  })
})

describe('formatDurationFromObj', () => {
  it('uses duration.value', () => {
    expect(formatDurationFromObj({ value: 600 })).toBe('10 min')
    expect(formatDurationFromObj({ value: 3600 })).toBe('1 hr')
  })
  it('returns — for missing or null', () => {
    expect(formatDurationFromObj(null)).toBe('—')
    expect(formatDurationFromObj({})).toBe('—')
  })
})

describe('formatDurationShort', () => {
  it('formats short form', () => {
    expect(formatDurationShort(300)).toBe('5 min')
    expect(formatDurationShort(3600)).toBe('1h')
    expect(formatDurationShort(3660)).toBe('1h 1m')
  })
  it('returns empty string for invalid', () => {
    expect(formatDurationShort(null)).toBe('')
    expect(formatDurationShort(undefined)).toBe('')
  })
})

describe('formatDistance', () => {
  it('uses distance.text', () => {
    expect(formatDistance({ text: '5.2 km' })).toBe('5.2 km')
  })
  it('returns — for null or missing text', () => {
    expect(formatDistance(null)).toBe('—')
    expect(formatDistance({})).toBe('—')
  })
})
