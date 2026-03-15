/**
 * GO stations with on-site park-and-ride lots.
 * Used for combo (drive + transit) mode; stations without parking are excluded.
 */
export const GO_STATIONS_WITH_PARKING = [
  'Aldershot',
  'West Harbour',
  'Burlington',
  'Appleby',
  'Bronte',
  'Oakville',
  'Clarkson',
  'Port Credit',
  'Long Branch',

  'Scarborough',
  'Guildwood',
  'Rouge Hill',
  'Pickering',
  'Ajax',
  'Whitby',
  'Oshawa',

  'Etobicoke North',
  'Malton',
  'Bramalea',
  'Brampton',
  'Mount Pleasant',

  'Kipling',
  'Dixie',
  'Cooksville',
  'Erindale',
  'Streetsville',
  'Meadowvale',
  'Lisgar',

  'Downsview Park',
  'Rutherford',
  'Maple',
  'King City',
  'Aurora',
  'Newmarket',
  'East Gwillimbury',

  'Oriole',
  'Old Cummer',
  'Langstaff',
  'Richmond Hill',
  'Gormley',
  'Bloomington',

  'Agincourt',
  'Milliken',
  'Unionville',
  'Centennial',
  'Markham',
  'Mount Joy',
  'Stouffville',
]

// Sorted by length descending so longer names (e.g. "East Gwillimbury") match before shorter substrings
const SORTED_NAMES = [...GO_STATIONS_WITH_PARKING].sort((a, b) => b.length - a.length)

export function isGoStation(candidate) {
  const name = (candidate.name ?? '').toLowerCase()
  if (name.includes('go')) return true
  const agencies = candidate.line?.agencies ?? []
  return agencies.some((a) => (a?.name ?? '').toLowerCase().includes('go'))
}

/** Stations without park-and-ride (street parking only or no parking). */
const NO_PARKING_STATIONS = [
  'hamilton go centre',
  'hamilton go center',
  'union station',
  'union station bus terminal',
  'union bus terminal',
]
function hasNoParking(candidate) {
  const name = (candidate.name ?? '').toLowerCase()
  return NO_PARKING_STATIONS.some((s) => name.includes(s))
}

/** Street-level bus stops (e.g. "King St. W. @ Pearl St. N.") have no parking. */
function isStreetLevelStop(candidate) {
  const name = (candidate.name ?? '').toLowerCase()
  return name.includes(' @ ')
}

/**
 * Returns true if the candidate station has on-site parking (is in the allowlist).
 * @param {{ name?: string, line?: object }} candidate - Station from transit route
 */
export function hasOnSiteParking(candidate) {
  if (!isGoStation(candidate)) return false
  if (hasNoParking(candidate)) return false
  if (isStreetLevelStop(candidate)) return false
  const name = (candidate.name ?? '').toLowerCase()
  return SORTED_NAMES.some((allowed) => name.includes(allowed.toLowerCase()))
}

/**
 * Fallback when allowlist yields nothing: GO stations that look like real stations
 * (not street-level stops). Excludes Hamilton GO Centre and "X St. @ Y St." patterns.
 */
export function isGoStationFallback(candidate) {
  return isGoStation(candidate) && !hasNoParking(candidate) && !isStreetLevelStop(candidate)
}

/** GO stations with street parking only (e.g. Union, Hamilton GO Centre). */
export function isGoStationWithStreetParking(candidate) {
  return isGoStation(candidate) && hasNoParking(candidate) && !isStreetLevelStop(candidate)
}

/**
 * GO stations to inject when origin is in the area but transit route doesn't include them.
 * E.g. Hamilton->Toronto bus route may only show Union; we inject West Harbour/Aldershot.
 */
export const INJECT_STATIONS_BY_REGION = [
  {
    region: { latMin: 43.15, latMax: 43.4, lngMin: -80.1, lngMax: -79.7 },
    stations: [
      { name: 'West Harbour GO Station', lat: 43.267, lng: -79.866 },
      { name: 'Aldershot GO Station', lat: 43.313, lng: -79.856 },
    ],
  },
]
