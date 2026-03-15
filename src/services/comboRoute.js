/**
 * Drive + Transit combo: drive to a GO station, then take transit.
 * Picks the best station by drive distance (or nearest if preferLessDriving) and traffic.
 */

import { encodePath } from '../utils/polyline.js'
import { formatDuration } from '../utils/format.js'
import {
  transitUsesViaRail,
  transitUsesOnlyGoOrWalk,
  getLastGoStepIndex,
  getTransitFromStep,
} from '../utils/transitSteps.js'
import {
  hasOnSiteParking,
  isGoStationFallback,
  isGoStationWithStreetParking,
  INJECT_STATIONS_BY_REGION,
} from '../utils/goStations.js'
import { runDirectionsRequest } from './directionsService.js'

const TRAFFIC_THRESHOLD = 1.35
const MAX_CANDIDATES = 8

/**
 * Build candidate stations: inject by region + from transit route steps.
 * @param {object} google - window.google
 * @param {object} origin - LatLng
 * @param {object[]} allRoutes - DirectionsResult.routes (non-Via Rail already filtered by caller)
 * @returns {Array<{ location: object, name: string, line: object }>}
 */
function getCandidateStations(google, origin, allRoutes) {
  const candidateStations = []
  const seenCoords = new Set()
  const olat = typeof origin.lat === 'function' ? origin.lat() : origin.lat
  const olng = typeof origin.lng === 'function' ? origin.lng() : origin.lng

  for (const { region, stations } of INJECT_STATIONS_BY_REGION) {
    if (olat >= region.latMin && olat <= region.latMax && olng >= region.lngMin && olng <= region.lngMax) {
      for (const s of stations) {
        const key = `${s.lat},${s.lng}`
        if (!seenCoords.has(key)) {
          seenCoords.add(key)
          candidateStations.push({
            location: new google.maps.LatLng(s.lat, s.lng),
            name: s.name,
            line: { agencies: [{ name: 'GO Transit' }] },
          })
        }
      }
    }
  }

  for (const route of allRoutes ?? []) {
    const routeLeg = route?.legs?.[0]
    if (transitUsesViaRail(routeLeg)) continue
    const transitSteps = routeLeg?.steps ?? []
    for (const step of transitSteps) {
      const t = getTransitFromStep(step)
      if (!t) continue
      for (const stop of [t.departure_stop, t.arrival_stop]) {
        if (!stop) continue
        const loc = stop?.location
        const key = loc ? `${loc.lat()},${loc.lng()}` : null
        if (key && !seenCoords.has(key)) {
          seenCoords.add(key)
          candidateStations.push({ location: loc, name: stop?.name ?? 'transit station', line: t.line })
        }
      }
    }
  }
  return candidateStations
}

/**
 * Build a merged leg: GO steps + walk from last GO stop to destination.
 * @param {object} google - window.google
 * @param {object} directionsService - google.maps.DirectionsService
 * @param {object} transitLeg - Directions leg
 * @param {object} destination - LatLng
 * @returns {Promise<object|null>} Merged leg or null
 */
async function buildGoPlusWalkLeg(google, directionsService, transitLeg, destination) {
  const lastGoIdx = getLastGoStepIndex(transitLeg)
  if (lastGoIdx < 0) return null
  const steps = transitLeg.steps ?? []
  const lastGoStep = steps[lastGoIdx]
  const t = getTransitFromStep(lastGoStep)
  const exitLocation = t?.arrival_stop?.location ?? lastGoStep?.end_location
  if (!exitLocation) return null

  const result = await runDirectionsRequest(
    directionsService,
    {
      origin: exitLocation,
      destination,
      travelMode: google.maps.TravelMode.WALKING,
    },
    google
  )
  const walkLeg = result?.routes?.[0]?.legs?.[0]
  if (!walkLeg) return null

  const goSteps = steps.slice(0, lastGoIdx + 1)
  const walkSteps = walkLeg.steps ?? []
  const goDuration = goSteps.reduce((sum, s) => sum + (s.duration?.value ?? 0), 0)
  const walkDuration = walkLeg.duration?.value ?? 0
  const goDistance = goSteps.reduce((sum, s) => sum + (s.distance?.value ?? 0), 0)
  const walkDistance = walkLeg.distance?.value ?? 0
  const totalDist = goDistance + walkDistance
  return {
    ...transitLeg,
    steps: [...goSteps, ...walkSteps],
    duration: {
      value: goDuration + walkDuration,
      text: `${Math.round((goDuration + walkDuration) / 60)} min`,
    },
    distance: {
      value: totalDist,
      text: totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${Math.round(totalDist)} m`,
    },
    end_location: walkLeg.end_location,
    end_address: walkLeg.end_address,
  }
}

/**
 * Compute best drive+transit combo from origin to destination using transit routes for candidates.
 *
 * @param {object} google - window.google
 * @param {object} params
 * @param {object} params.origin - LatLng
 * @param {object} params.destination - LatLng
 * @param {Date} params.travelDate
 * @param {string} params.timeMode - 'depart' | 'arrive'
 * @param {object[]} params.allTransitRoutes - from fetchTransit (all routes, for candidate extraction)
 * @param {boolean} params.avoidTolls
 * @param {boolean} params.avoidHighways
 * @param {boolean} params.avoidFerries
 * @param {Date} params.departureForDriving - for traffic
 * @param {string} params.trafficModel - best_guess | pessimistic | optimistic
 * @param {boolean} params.comboOnlyGoStation - on-site parking only
 * @param {boolean} params.comboAllowStreetParking
 * @param {boolean} params.comboLessDriving - prefer nearest station
 * @param {boolean} params.comboNoLocalTransit - prefer GO+walk only
 * @returns {Promise<{ result: { duration: object, distance: object, result: object, stationName: string } } | { unavailableReason: string }>}
 */
export async function buildComboResult(google, params) {
  const {
    origin,
    destination,
    travelDate,
    timeMode,
    allTransitRoutes,
    avoidTolls,
    avoidHighways,
    avoidFerries,
    departureForDriving,
    trafficModel,
    comboOnlyGoStation,
    comboAllowStreetParking,
    comboLessDriving,
    comboNoLocalTransit,
  } = params

  const trafficModelMap = {
    best_guess: google.maps.TrafficModel?.BEST_GUESS ?? 'bestguess',
    pessimistic: google.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic',
    optimistic: google.maps.TrafficModel?.OPTIMISTIC ?? 'optimistic',
  }

  const candidateStations = getCandidateStations(google, origin, allTransitRoutes)
  const allowStreet = comboOnlyGoStation
    ? (c) => hasOnSiteParking(c) || (comboAllowStreetParking && isGoStationWithStreetParking(c))
    : (c) => isGoStationFallback(c) || (comboAllowStreetParking && isGoStationWithStreetParking(c))
  let stationsWithParking = candidateStations.filter(allowStreet)

  if (stationsWithParking.length === 0) {
    return {
      unavailableReason: comboOnlyGoStation
        ? "No GO stations with parking on this route. Try turning off 'On-site parking only' or enable 'Allow street parking'."
        : 'No GO stations on this transit route.',
    }
  }

  const olat = typeof origin.lat === 'function' ? origin.lat() : origin.lat
  const olng = typeof origin.lng === 'function' ? origin.lng() : origin.lng
  if (comboLessDriving) {
    stationsWithParking = [...stationsWithParking].sort((a, b) => {
      const da = Math.pow(a.location.lat() - olat, 2) + Math.pow(a.location.lng() - olng, 2)
      const db = Math.pow(b.location.lat() - olat, 2) + Math.pow(b.location.lng() - olng, 2)
      return da - db
    })
  }

  const candidatesToEval = stationsWithParking.slice(0, MAX_CANDIDATES)
  const directionsService = new google.maps.DirectionsService()
  const comboTransitOpts =
    timeMode === 'arrive' ? { arrivalTime: travelDate } : { departureTime: travelDate }

  const evaluated = await Promise.all(
    candidatesToEval.map(async (station) => {
      const [driveSettled, transitSettled] = await Promise.allSettled([
        runDirectionsRequest(
          directionsService,
          {
            origin,
            destination: station.location,
            travelMode: google.maps.TravelMode.DRIVING,
            avoidTolls,
            avoidHighways,
            avoidFerries,
            drivingOptions: {
              departureTime: departureForDriving,
              trafficModel: trafficModelMap[trafficModel] ?? google.maps.TrafficModel.BEST_GUESS,
            },
          },
          google
        ),
        runDirectionsRequest(
          directionsService,
          {
            origin: station.location,
            destination,
            travelMode: google.maps.TravelMode.TRANSIT,
            transitOptions: comboTransitOpts,
            provideRouteAlternatives: comboNoLocalTransit,
          },
          google
        ),
      ])
      const driveResult = driveSettled.status === 'fulfilled' ? driveSettled.value : null
      const transitResult = transitSettled.status === 'fulfilled' ? transitSettled.value : null
      const driveLeg = driveResult?.routes?.[0]?.legs?.[0] ?? null
      let transitLeg = transitResult?.routes?.[0]?.legs?.[0] ?? null

      if (transitLeg && comboNoLocalTransit && transitResult?.routes) {
        for (const route of transitResult.routes) {
          const leg = route?.legs?.[0]
          if (leg && transitUsesOnlyGoOrWalk(leg)) {
            transitLeg = leg
            break
          }
        }
        if (
          !transitUsesOnlyGoOrWalk(transitLeg) &&
          getLastGoStepIndex(transitLeg) >= 0 &&
          !transitUsesViaRail(transitLeg)
        ) {
          transitLeg = await buildGoPlusWalkLeg(google, directionsService, transitLeg, destination)
        }
      }

      if (!driveLeg || !transitLeg || transitUsesViaRail(transitLeg)) return null
      const driveDuration = driveLeg.duration?.value ?? 0
      const driveDurationInTraffic = driveLeg.duration_in_traffic?.value ?? driveDuration
      const driveDistance = driveLeg.distance?.value ?? 0
      const transitDuration = transitLeg.duration?.value ?? 0
      const totalTime = driveDurationInTraffic + transitDuration
      return {
        station,
        driveLeg,
        transitLeg,
        driveDuration,
        driveDurationInTraffic,
        driveDistance,
        transitDuration,
        totalTime,
        isGo: true,
      }
    })
  )

  const validCandidates = evaluated.filter(Boolean)
  const noLocalTransitFiltered = comboNoLocalTransit
    ? validCandidates.filter((c) => transitUsesOnlyGoOrWalk(c.transitLeg))
    : validCandidates
  const trafficFiltered = noLocalTransitFiltered.filter(
    (c) => (c.driveDurationInTraffic ?? 0) / (c.driveDuration || 1) <= TRAFFIC_THRESHOLD
  )
  const toScore = trafficFiltered.length > 0 ? trafficFiltered : noLocalTransitFiltered
  const scored = [...toScore].sort((a, b) => {
    const distA = a.driveDistance ?? 0
    const distB = b.driveDistance ?? 0
    if (distB !== distA) return comboLessDriving ? distA - distB : distB - distA
    const goA = a.isGo ? 1 : 0
    const goB = b.isGo ? 1 : 0
    if (goB !== goA) return goB - goA
    return (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity)
  })

  const best = scored[0]
  if (!best) {
    return {
      unavailableReason: comboNoLocalTransit
        ? "Could not build a GO+walk combo. Try turning off 'No local transit' to see routes with buses (TTC, MiWay, etc.)."
        : 'Could not find a suitable combo route. Try adjusting traffic or combo options.',
    }
  }

  const { driveLeg, transitLeg, station, totalTime } = best
  const totalDistance =
    driveLeg.distance?.value != null && transitLeg.distance?.value != null
      ? {
          value: driveLeg.distance.value + transitLeg.distance.value,
          text: `${Math.round((driveLeg.distance.value + transitLeg.distance.value) / 1000)} km`,
        }
      : null
  const bounds = new google.maps.LatLngBounds()
  bounds.extend(driveLeg.start_location)
  bounds.extend(driveLeg.end_location)
  bounds.extend(transitLeg.start_location)
  bounds.extend(transitLeg.end_location)
  const overviewPath = []
  for (const leg of [driveLeg, transitLeg]) {
    for (const step of leg.steps ?? []) {
      const path = step.path ?? (step.start_location && step.end_location ? [step.start_location, step.end_location] : [])
      overviewPath.push(...path)
    }
  }
  const mergedRoute = {
    bounds,
    legs: [driveLeg, transitLeg],
    overview_path: overviewPath,
    overview_polyline: encodePath(overviewPath),
    copyrights: '',
    summary: 'Drive + Transit',
    warnings: [],
    waypoint_order: [],
  }
  return {
    result: {
      duration: { value: totalTime, text: formatDuration(totalTime) },
      distance: totalDistance,
      result: { routes: [mergedRoute] },
      stationName: station.name,
    },
  }
}