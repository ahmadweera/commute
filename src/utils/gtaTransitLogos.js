/**
 * GTA (Greater Toronto Area) transit agency logos.
 * Maps agency names (partial match, case-insensitive) to logo paths.
 * Uses icons from public/icons/. Uses BASE_URL for correct paths on GitHub Pages.
 */
const base = typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : '/'

export const GTA_TRANSIT_LOGOS = {
  'GO Transit': `${base}icons/GO_Transit_logo.svg`,
  'GO': `${base}icons/GO_Transit_logo.svg`,

  'Toronto Transit Commission': `${base}icons/Logo_of_the_Toronto_Transit_Commission.svg`,
  'TTC': `${base}icons/Logo_of_the_Toronto_Transit_Commission.svg`,

  'Hamilton Street Railway': `${base}icons/Hamilton_Street_Railway_(logo).png`,
  'HSR': `${base}icons/Hamilton_Street_Railway_(logo).png`,

  'MiWay': `${base}icons/MiWay_Logo.svg`,
  'Mississauga Transit': `${base}icons/MiWay_Logo.svg`,

  'Brampton Transit': `${base}icons/Brampton_Transit.svg`,
  'Brampton': `${base}icons/Brampton_Transit.svg`,

  'Durham Region Transit': `${base}icons/Durham_Region_Transit_logo.png`,
  'DRT': `${base}icons/Durham_Region_Transit_logo.png`,

  'York Region Transit': `${base}icons/York_Region_Transit_logo.svg`,
  'YRT': `${base}icons/York_Region_Transit_logo.svg`,
  'Viva': `${base}icons/Viva_blue_logo.svg`,

  'Oakville Transit': `${base}icons/Oakville_Transit_logo.svg`,
  'Oakville': `${base}icons/Oakville_Transit_logo.svg`,

  'Burlington Transit': `${base}icons/Burlington_Transit.svg`,
  'Burlington': `${base}icons/Burlington_Transit.svg`,

  'UP Express': `${base}icons/UP_Express_New_Logo_(black).svg`,
  'Union Pearson': `${base}icons/UP_Express_New_Logo_(black).svg`,
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
