/**
 * Directions API: driving and transit. Wraps Google DirectionsService in Promises
 * and normalizes responses. Via Rail routes are filtered out of transit.
 *
 * @param {object} google - window.google (Maps API)
 */

import { transitUsesViaRail } from '../utils/transitSteps.js'

/**
 * Run a Directions request and return a Promise.
 * @param {object} service - google.maps.DirectionsService
 * @param {object} request - DirectionsRequest
 * @param {object} google - window.google for status constants
 * @returns {Promise<object>} DirectionsResult
 */
export function runDirectionsRequest(service, request, google) {
  return new Promise((resolve, reject) => {
    service.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK) {
        resolve(result)
      } else {
        reject(new Error(status))
      }
    })
  })
}

function route(service, request, google) {
  return runDirectionsRequest(service, request, google)
}

/**
 * User-friendly message for Directions status.
 * @param {string} status - e.g. ZERO_RESULTS, OVER_QUERY_LIMIT
 * @returns {string}
 */
export function messageForStatus(status) {
  const msg = status?.replace(/_/g, ' ').toLowerCase() || 'unknown error'
  if (status === 'ZERO_RESULTS') return 'No routes found between these locations.'
  if (status === 'OVER_QUERY_LIMIT') return 'Too many requests. Please try again later.'
  if (status === 'REQUEST_DENIED') return 'Directions request was denied.'
  return `Directions: ${msg}.`
}

/**
 * Fetch driving route with optional traffic model.
 *
 * @param {object} google - window.google
 * @param {object} options
 * @param {object} options.origin - LatLng
 * @param {object} options.destination - LatLng
 * @param {boolean} options.avoidTolls
 * @param {boolean} options.avoidHighways
 * @param {boolean} options.avoidFerries
 * @param {Date} options.departureTime - used for traffic
 * @param {string} options.trafficModel - best_guess | pessimistic | optimistic
 * @returns {Promise<{ duration: object, durationInTraffic: object, distance: object, result: object } | null>}
 */
export async function fetchDriving(google, options) {
  const {
    origin,
    destination,
    avoidTolls = true,
    avoidHighways = false,
    avoidFerries = false,
    departureTime = new Date(),
    trafficModel = 'best_guess',
  } = options

  const trafficModelMap = {
    best_guess: google.maps.TrafficModel?.BEST_GUESS ?? 'bestguess',
    pessimistic: google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic',
    optimistic: google.maps.TrafficModel?.OPTIMISTIC ?? 'optimistic',
  }

  const request = {
    origin,
    destination,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    travelMode: google.maps.TravelMode.DRIVING,
    drivingOptions: {
      departureTime,
      trafficModel: trafficModelMap[trafficModel] ?? google.maps.TrafficModel.BEST_GUESS,
    },
  }

  const service = new google.maps.DirectionsService()
  const result = await route(service, request, google)
  const leg = result?.routes?.[0]?.legs?.[0]
  if (!leg) return null
  return {
    duration: leg.duration,
    durationInTraffic: leg.duration_in_traffic,
    distance: leg.distance,
    result,
  }
}

/**
 * Fetch transit route. Excludes Via Rail; returns first non-Via Rail route.
 * Also returns all routes for combo candidate station extraction.
 *
 * @param {object} google - window.google
 * @param {object} options
 * @param {object} options.origin - LatLng
 * @param {object} options.destination - LatLng
 * @param {boolean} options.avoidTolls
 * @param {boolean} options.avoidHighways
 * @param {boolean} options.avoidFerries
 * @param {Date} options.travelDate
 * @param {string} options.timeMode - 'depart' | 'arrive'
 * @param {string|null} options.transitRoutingPreference - FEWER_TRANSFERS | LESS_WALKING | null
 * @returns {Promise<{ duration: object, distance: object, result: object, allRoutes: object[] } | null>}
 */
export async function fetchTransit(google, options) {
  const {
    origin,
    destination,
    avoidTolls = true,
    avoidHighways = false,
    avoidFerries = false,
    travelDate = new Date(),
    timeMode = 'depart',
    transitRoutingPreference = null,
  } = options

  const transitOpts = {
    ...(timeMode === 'arrive' ? { arrivalTime: travelDate } : { departureTime: travelDate }),
    ...(transitRoutingPreference && { routingPreference: transitRoutingPreference }),
  }

  const request = {
    origin,
    destination,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    travelMode: google.maps.TravelMode.TRANSIT,
    transitOptions: transitOpts,
    provideRouteAlternatives: true,
  }

  const service = new google.maps.DirectionsService()
  const result = await route(service, request, google)
  const routes = result?.routes ?? []
  const nonViaRoute = routes.find((r) => !transitUsesViaRail(r?.legs?.[0]))
  const leg = nonViaRoute?.legs?.[0]
  if (!leg) return null
  return {
    duration: leg.duration,
    distance: leg.distance,
    result: { routes: [nonViaRoute], geocoded_waypoints: result?.geocoded_waypoints },
    allRoutes: routes,
  }
}
