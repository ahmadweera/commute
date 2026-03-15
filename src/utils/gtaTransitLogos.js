/**
 * GTA (Greater Toronto Area) transit agency logos.
 * Maps agency names (partial match, case-insensitive) to logo paths.
 * Uses icons from public/icons/.
 */
export const GTA_TRANSIT_LOGOS = {
  'GO Transit': '/icons/GO_Transit_logo.svg',
  'GO': '/icons/GO_Transit_logo.svg',

  'Toronto Transit Commission': '/icons/Logo_of_the_Toronto_Transit_Commission.svg',
  'TTC': '/icons/Logo_of_the_Toronto_Transit_Commission.svg',

  'Hamilton Street Railway': '/icons/Hamilton_Street_Railway_(logo).png',
  'HSR': '/icons/Hamilton_Street_Railway_(logo).png',

  'MiWay': '/icons/MiWay_Logo.svg',
  'Mississauga Transit': '/icons/MiWay_Logo.svg',

  'Brampton Transit': '/icons/Brampton_Transit.svg',
  'Brampton': '/icons/Brampton_Transit.svg',

  'Durham Region Transit': '/icons/Durham_Region_Transit_logo.png',
  'DRT': '/icons/Durham_Region_Transit_logo.png',

  'York Region Transit': '/icons/York_Region_Transit_logo.svg',
  'YRT': '/icons/York_Region_Transit_logo.svg',
  'Viva': '/icons/Viva_blue_logo.svg',

  'Oakville Transit': '/icons/Oakville_Transit_logo.svg',
  'Oakville': '/icons/Oakville_Transit_logo.svg',

  'Burlington Transit': '/icons/Burlington_Transit.svg',
  'Burlington': '/icons/Burlington_Transit.svg',

  'UP Express': '/icons/UP_Express_New_Logo_(black).svg',
  'Union Pearson': '/icons/UP_Express_New_Logo_(black).svg',
}

/**
 * Extract unique GTA transit agency logos from a Directions result.
 * @param {Object} result - DirectionsResult with routes[].legs[].steps
 * @returns {{ name: string, url: string }[]} Unique agency logos (by URL)
 */
export function getGtaAgenciesFromResult(result) {
  const seenNames = new Set()
  const seenUrls = new Set()
  const agencies = []
  const legs = result?.routes?.[0]?.legs ?? []
  for (const leg of legs) {
    for (const step of leg.steps ?? []) {
      const t = step.transit ?? step.transit_details
      const lineAgencies = t?.line?.agencies ?? []
      for (const agency of lineAgencies) {
        const name = agency?.name?.trim()
        if (name && !seenNames.has(name)) {
          seenNames.add(name)
          const url = findLogoForAgency(name)
          if (url && !seenUrls.has(url)) {
            seenUrls.add(url)
            agencies.push({ name, url })
          }
        }
      }
    }
  }
  return agencies
}

/**
 * Find logo URL for an agency name (partial match, prefers longer keys).
 */
export function findLogoForAgency(name) {
  if (!name) return null
  const lower = name.toLowerCase()
  const entries = Object.entries(GTA_TRANSIT_LOGOS).sort((a, b) => b[0].length - a[0].length)
  for (const [key, url] of entries) {
    if (lower.includes(key.toLowerCase())) return url
  }
  return null
}
