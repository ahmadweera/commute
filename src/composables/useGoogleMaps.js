import { ref, shallowRef } from 'vue'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

let optionsSet = false
let googlePromise = null

function ensureOptions() {
  if (optionsSet) return
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY. Copy .env.example to .env and add your Google Maps API key.')
  }
  setOptions({
    key: apiKey,
    v: 'weekly',
    libraries: ['places'],
  })
  optionsSet = true
}

export function useGoogleMaps() {
  const isLoaded = ref(false)
  const error = ref(null)
  const google = shallowRef(null)

  async function load() {
    if (google.value) {
      isLoaded.value = true
      return google.value
    }
    if (error.value) throw error.value

    try {
      if (!googlePromise) {
        ensureOptions()
        googlePromise = Promise.all([
          importLibrary('maps'),
          importLibrary('places'),
        ]).then(() => window.google)
      }
      const g = await googlePromise
      google.value = g
      isLoaded.value = true
      error.value = null
      return g
    } catch (e) {
      error.value = e
      throw e
    }
  }

  return { load, isLoaded, error, google }
}
