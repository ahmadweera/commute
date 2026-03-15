<script setup>
import { ref, computed, onMounted } from 'vue'
import PlaceAutocomplete from './components/PlaceAutocomplete.vue'
import { encodePath } from './utils/polyline.js'
import { hasOnSiteParking, isGoStationFallback, isGoStationWithStreetParking, INJECT_STATIONS_BY_REGION } from './utils/goStations.js'
import CommuteResults from './components/CommuteResults.vue'
import RouteMap from './components/RouteMap.vue'
import { useGoogleMaps } from './composables/useGoogleMaps.js'

const { load, isLoaded, error: loadError, google } = useGoogleMaps()

const originInput = ref('')
const destinationInput = ref('')
const originPlace = ref(null)
const destinationPlace = ref(null)

const drivingResult = ref(null)
const transitResult = ref(null)
const comboResult = ref(null)
const comboUnavailableReason = ref(null)
const loading = ref(false)
const directionsError = ref(null)
const selectedRoute = ref(null)
const detailsExpanded = ref(false)

const timeMode = ref('depart')
const travelTimeInput = ref('')
const showAdvancedOptions = ref(false)

const avoidTolls = ref(true)
const avoidHighways = ref(false)
const avoidFerries = ref(false)
const trafficModel = ref('best_guess')
const transitRoutingPreference = ref(null)

const comboLessDriving = ref(false)
const comboNoLocalTransit = ref(false)
const lastDrivingDepartureTime = ref(null)
const comboOnlyGoStation = ref(false)
const comboAllowStreetParking = ref(false)

function getTravelTimeDate() {
  if (!showAdvancedOptions.value) return defaultTravelTime()
  if (travelTimeInput.value) {
    const d = new Date(travelTimeInput.value)
    if (isNaN(d.getTime())) return defaultTravelTime()
    if (d.getTime() < Date.now()) return new Date()
    return d
  }
  return defaultTravelTime()
}

function isTimeCustomized() {
  return showAdvancedOptions.value && travelTimeInput.value
}

const hasResults = computed(() => drivingResult.value || transitResult.value || comboResult.value)

const frozenActiveCriteria = ref(null)
const lastCalculatedInputs = ref(null)

function snapshotInputs() {
  const o = originPlace.value?.location
  const d = destinationPlace.value?.location
  return {
    originLat: o?.lat?.() ?? null,
    originLng: o?.lng?.() ?? null,
    destLat: d?.lat?.() ?? null,
    destLng: d?.lng?.() ?? null,
    avoidTolls: avoidTolls.value,
    avoidHighways: avoidHighways.value,
    avoidFerries: avoidFerries.value,
    trafficModel: trafficModel.value,
    transitRoutingPreference: transitRoutingPreference.value,
    timeMode: timeMode.value,
    showAdvancedOptions: showAdvancedOptions.value,
    travelTimeInput: travelTimeInput.value,
    comboOnlyGoStation: comboOnlyGoStation.value,
    comboLessDriving: comboLessDriving.value,
    comboNoLocalTransit: comboNoLocalTransit.value,
    comboAllowStreetParking: comboAllowStreetParking.value,
  }
}

function inputsMatchSnapshot(snap) {
  if (!snap) return false
  const cur = snapshotInputs()
  return (
    cur.originLat === snap.originLat &&
    cur.originLng === snap.originLng &&
    cur.destLat === snap.destLat &&
    cur.destLng === snap.destLng &&
    cur.avoidTolls === snap.avoidTolls &&
    cur.avoidHighways === snap.avoidHighways &&
    cur.avoidFerries === snap.avoidFerries &&
    cur.trafficModel === snap.trafficModel &&
    cur.transitRoutingPreference === snap.transitRoutingPreference &&
    cur.timeMode === snap.timeMode &&
    cur.showAdvancedOptions === snap.showAdvancedOptions &&
    cur.travelTimeInput === snap.travelTimeInput &&
    cur.comboOnlyGoStation === snap.comboOnlyGoStation &&
    cur.comboLessDriving === snap.comboLessDriving &&
    cur.comboNoLocalTransit === snap.comboNoLocalTransit &&
    cur.comboAllowStreetParking === snap.comboAllowStreetParking
  )
}

const showRefreshButton = computed(
  () => hasResults.value && lastCalculatedInputs.value && !inputsMatchSnapshot(lastCalculatedInputs.value)
)

function buildActiveCriteria() {
  const items = []
  if (hasResults.value) {
    const d = getTravelTimeDate()
    const timeStr = d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    const isDepart = timeMode.value === 'depart'
    const diffMs = Math.abs(d.getTime() - Date.now())
    const withinTwoMin = diffMs <= 2 * 60 * 1000
    const label = isDepart && withinTwoMin ? 'Depart Now' : (isDepart ? `Depart at ${timeStr}` : `Arrive by ${timeStr}`)
    items.push({ label, title: timeStr })
  }
  if (usedLiveTraffic.value) items.push({ label: 'Live traffic', title: 'Driving times use current live traffic' })
  if (avoidTolls.value) items.push('Avoid tolls')
  if (avoidHighways.value) items.push('Avoid highways')
  if (avoidFerries.value) items.push('Avoid ferries')
  if (trafficModel.value === 'pessimistic') items.push('Traffic: pessimistic')
  if (trafficModel.value === 'optimistic') items.push('Traffic: optimistic')
  if (transitRoutingPreference.value === 'FEWER_TRANSFERS') items.push('Transit: fewer transfers')
  if (transitRoutingPreference.value === 'LESS_WALKING') items.push('Transit: less walking')
  if (comboLessDriving.value) items.push('Combo: prefer nearest station')
  if (comboNoLocalTransit.value) items.push('Combo: no local transit')
  if (comboOnlyGoStation.value) items.push('Combo: on-site parking only')
  if (comboAllowStreetParking.value) items.push('Combo: allow street parking')
  return items
}

const activeCriteria = computed(() =>
  hasResults.value && frozenActiveCriteria.value ? frozenActiveCriteria.value : buildActiveCriteria()
)

const usedLiveTraffic = computed(() => {
  if (!drivingResult.value || !lastDrivingDepartureTime.value) return false
  const diffMs = Math.abs(lastDrivingDepartureTime.value.getTime() - Date.now())
  return diffMs < 15 * 60 * 1000
})

function defaultTravelTime() {
  return new Date()
}

function initTravelTimeInput() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  travelTimeInput.value = `${y}-${m}-${day}T${h}:${min}`
}

const canCalculate = computed(() => originPlace.value && destinationPlace.value)

function formatDurationText(valueSeconds) {
  const mins = Math.round(valueSeconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

function onOriginSelect(place) {
  originPlace.value = place
}

function onDestinationSelect(place) {
  destinationPlace.value = place
}

function swapDirections() {
  const oInput = originInput.value
  const oPlace = originPlace.value
  originInput.value = destinationInput.value
  originPlace.value = destinationPlace.value
  destinationInput.value = oInput
  destinationPlace.value = oPlace
}

function resetComboOptions() {
  comboOnlyGoStation.value = false
  comboLessDriving.value = false
  comboNoLocalTransit.value = false
  comboAllowStreetParking.value = false
}

const hasComboOptionsActive = computed(
  () => comboOnlyGoStation.value || comboLessDriving.value || comboNoLocalTransit.value || comboAllowStreetParking.value
)

async function calculate() {
  if (!canCalculate.value || !google.value) return

  loading.value = true
  directionsError.value = null
  drivingResult.value = null
  transitResult.value = null
  comboResult.value = null
  comboUnavailableReason.value = null
  selectedRoute.value = null
  detailsExpanded.value = false
  lastDrivingDepartureTime.value = null

  const origin = originPlace.value.location
  const destination = destinationPlace.value.location
  const travelDate = getTravelTimeDate()

  if (isTimeCustomized() && travelDate < new Date()) {
    directionsError.value = 'Please select a time in the future.'
    loading.value = false
    return
  }

  const requestBase = {
    origin,
    destination,
    avoidTolls: avoidTolls.value,
    avoidHighways: avoidHighways.value,
    avoidFerries: avoidFerries.value,
  }

  const departureForDriving = timeMode.value === 'arrive'
    ? new Date(travelDate.getTime() - 45 * 60 * 1000)
    : travelDate

  const trafficModelMap = {
    best_guess: google.value.maps.TrafficModel?.BEST_GUESS ?? 'bestguess',
    pessimistic: google.value.maps.TrafficModel?.PESSIMISTIC ?? 'pessimistic',
    optimistic: google.value.maps.TrafficModel?.OPTIMISTIC ?? 'optimistic',
  }

  const drivingRequest = {
    ...requestBase,
    travelMode: google.value.maps.TravelMode.DRIVING,
    drivingOptions: {
      departureTime: departureForDriving,
      trafficModel: trafficModelMap[trafficModel.value] ?? google.value.maps.TrafficModel.BEST_GUESS,
    },
  }

  const transitOpts = {
    ...(timeMode.value === 'arrive' ? { arrivalTime: travelDate } : { departureTime: travelDate }),
    ...(transitRoutingPreference.value && { routingPreference: transitRoutingPreference.value }),
  }

  const transitRequest = {
    ...requestBase,
    travelMode: google.value.maps.TravelMode.TRANSIT,
    transitOptions: transitOpts,
    provideRouteAlternatives: true,
  }

  const directionsService = new google.value.maps.DirectionsService()

  function transitUsesViaRail(leg) {
    const steps = leg?.steps ?? []
    for (const step of steps) {
      const t = step.transit ?? step.transit_details
      if (!t) continue
      const agencies = t.line?.agencies ?? []
      for (const a of agencies) {
        const an = (a?.name ?? '').toLowerCase()
        if (an.includes('via rail')) return true
      }
    }
    return false
  }

  try {
    const [drivingSettled, transitSettled] = await Promise.allSettled([
      new Promise((resolve, reject) => {
        directionsService.route(drivingRequest, (result, status) => {
          if (status === google.value.maps.DirectionsStatus.OK) {
            resolve(result)
          } else {
            reject(new Error(status))
          }
        })
      }),
      new Promise((resolve, reject) => {
        directionsService.route(transitRequest, (result, status) => {
          if (status === google.value.maps.DirectionsStatus.OK) {
            resolve(result)
          } else {
            reject(new Error(status))
          }
        })
      }),
    ])

    if (drivingSettled.status === 'fulfilled') {
      const leg = drivingSettled.value?.routes?.[0]?.legs?.[0]
      if (leg) {
        lastDrivingDepartureTime.value = departureForDriving
        drivingResult.value = {
          duration: leg.duration,
          durationInTraffic: leg.duration_in_traffic,
          distance: leg.distance,
          result: drivingSettled.value,
        }
      }
    }

    if (transitSettled.status === 'fulfilled') {
      const routes = transitSettled.value?.routes ?? []
      const nonViaRoute = routes.find((r) => !transitUsesViaRail(r?.legs?.[0]))
      const leg = nonViaRoute?.legs?.[0]
      if (leg) {
        transitResult.value = {
          duration: leg.duration,
          distance: leg.distance,
          result: { routes: [nonViaRoute], geocoded_waypoints: transitSettled.value?.geocoded_waypoints },
        }
      }
    }

    // Drive + Transit combo: maximize fast driving to a GO station, then transit the rest.
    // Evaluates multiple candidate stations, picks the one that maximizes drive distance
    // while avoiding traffic, with GO station preference.
    if (transitSettled.status === 'fulfilled' && transitResult.value) {
      try {
        const candidateStations = []
        const seenCoords = new Set()
        const routes = transitSettled.value?.routes ?? []
        const olat = origin.lat()
        const olng = origin.lng()
        for (const { region, stations } of INJECT_STATIONS_BY_REGION) {
          if (olat >= region.latMin && olat <= region.latMax && olng >= region.lngMin && olng <= region.lngMax) {
            for (const s of stations) {
              const key = `${s.lat},${s.lng}`
              if (!seenCoords.has(key)) {
                seenCoords.add(key)
                candidateStations.push({
                  location: new google.value.maps.LatLng(s.lat, s.lng),
                  name: s.name,
                  line: { agencies: [{ name: 'GO Transit' }] },
                })
              }
            }
          }
        }
        for (const route of routes) {
          const routeLeg = route?.legs?.[0]
          if (transitUsesViaRail(routeLeg)) continue
          const transitSteps = routeLeg?.steps ?? []
          for (const step of transitSteps) {
            const t = step.transit ?? step.transit_details
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

        const LOCAL_TRANSIT_NAMES = ['ttc', 'toronto transit', 'hsr', 'hamilton street', 'miway', 'mississauga', 'brampton', 'drt', 'durham region', 'yrt', 'york region', 'viva', 'oakville', 'burlington']
        function isLocalTransitAgency(name) {
          const n = (name ?? '').toLowerCase()
          return LOCAL_TRANSIT_NAMES.some((local) => n.includes(local))
        }
        function transitUsesOnlyGoOrWalk(transitLeg) {
          const steps = transitLeg?.steps ?? []
          for (const step of steps) {
            const t = step.transit ?? step.transit_details
            if (!t) continue
            const agencies = t.line?.agencies ?? []
            for (const a of agencies) {
              const an = a?.name ?? ''
              if (an && isLocalTransitAgency(an)) return false
            }
          }
          return true
        }

        function getLastGoStepIndex(transitLeg) {
          const steps = transitLeg?.steps ?? []
          let lastGo = -1
          for (let i = 0; i < steps.length; i++) {
            const t = steps[i].transit ?? steps[i].transit_details
            if (!t) continue
            const agencies = t.line?.agencies ?? []
            const isGo = agencies.some((a) => (a?.name ?? '').toLowerCase().includes('go'))
            if (isGo) lastGo = i
            else if (isLocalTransitAgency(agencies[0]?.name ?? '')) break
          }
          return lastGo
        }

        async function buildGoPlusWalkLeg(transitLeg) {
          const lastGoIdx = getLastGoStepIndex(transitLeg)
          if (lastGoIdx < 0) return null
          const steps = transitLeg.steps ?? []
          const lastGoStep = steps[lastGoIdx]
          const t = lastGoStep?.transit ?? lastGoStep?.transit_details
          const exitLocation = t?.arrival_stop?.location ?? lastGoStep?.end_location
          if (!exitLocation) return null
          return new Promise((resolve) => {
            directionsService.route(
              {
                origin: exitLocation,
                destination,
                travelMode: google.value.maps.TravelMode.WALKING,
              },
              (result, status) => {
                if (status !== google.value.maps.DirectionsStatus.OK || !result?.routes?.[0]?.legs?.[0]) {
                  resolve(null)
                  return
                }
                const walkLeg = result.routes[0].legs[0]
                const goSteps = steps.slice(0, lastGoIdx + 1)
                const walkSteps = walkLeg.steps ?? []
                const goDuration = goSteps.reduce((sum, s) => sum + (s.duration?.value ?? 0), 0)
                const walkDuration = walkLeg.duration?.value ?? 0
                const goDistance = goSteps.reduce((sum, s) => sum + (s.distance?.value ?? 0), 0)
                const walkDistance = walkLeg.distance?.value ?? 0
                const mergedSteps = [...goSteps, ...walkSteps]
                const totalDist = goDistance + walkDistance
                const mergedLeg = {
                  ...transitLeg,
                  steps: mergedSteps,
                  duration: { value: goDuration + walkDuration, text: `${Math.round((goDuration + walkDuration) / 60)} min` },
                  distance: { value: totalDist, text: totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${Math.round(totalDist)} m` },
                  end_location: walkLeg.end_location,
                  end_address: walkLeg.end_address,
                }
                resolve(mergedLeg)
              }
            )
          })
        }

        // When comboOnlyGoStation: only on-site park-and-ride. Otherwise fall back to GO stations
        // that look like real stations (exclude street-level stops like "King St. @ Pearl St.").
        const allowStreet = comboOnlyGoStation.value
          ? (c) => hasOnSiteParking(c) || (comboAllowStreetParking.value && isGoStationWithStreetParking(c))
          : (c) => isGoStationFallback(c) || (comboAllowStreetParking.value && isGoStationWithStreetParking(c))
        let stationsWithParking = candidateStations.filter(allowStreet)
        if (stationsWithParking.length === 0) {
          comboUnavailableReason.value = comboOnlyGoStation.value
            ? "No GO stations with parking on this route. Try turning off 'On-site parking only' or enable 'Allow street parking'."
            : 'No GO stations on this transit route.'
        } else {
        const preferLessDriving = comboLessDriving.value
        if (preferLessDriving) {
          stationsWithParking = [...stationsWithParking].sort((a, b) => {
            const da = Math.pow(a.location.lat() - olat, 2) + Math.pow(a.location.lng() - olng, 2)
            const db = Math.pow(b.location.lat() - olat, 2) + Math.pow(b.location.lng() - olng, 2)
            return da - db
          })
        }
        const MAX_CANDIDATES = 8
        const candidatesToEval = stationsWithParking.slice(0, MAX_CANDIDATES)

        const evaluated = await Promise.all(
          candidatesToEval.map(async (station) => {
            const comboTransitOpts = timeMode.value === 'arrive'
              ? { arrivalTime: travelDate }
              : { departureTime: travelDate }

            const [driveSettled, transitSettled] = await Promise.allSettled([
              new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin,
                    destination: station.location,
                    travelMode: google.value.maps.TravelMode.DRIVING,
                    avoidTolls: avoidTolls.value,
                    avoidHighways: avoidHighways.value,
                    avoidFerries: avoidFerries.value,
                    drivingOptions: {
                      departureTime: departureForDriving,
                      trafficModel: trafficModelMap[trafficModel.value] ?? google.value.maps.TrafficModel.BEST_GUESS,
                    },
                  },
                  (result, status) => (status === google.value.maps.DirectionsStatus.OK ? resolve(result) : reject(new Error(status)))
                )
              }),
              new Promise((resolve, reject) => {
                directionsService.route(
                  {
                    origin: station.location,
                    destination,
                    travelMode: google.value.maps.TravelMode.TRANSIT,
                    transitOptions: comboTransitOpts,
                    provideRouteAlternatives: comboNoLocalTransit.value,
                  },
                  (result, status) => (status === google.value.maps.DirectionsStatus.OK ? resolve(result) : reject(new Error(status)))
                )
              }),
            ])
            const driveLeg = driveSettled.status === 'fulfilled' ? driveSettled.value?.routes?.[0]?.legs?.[0] : null
            let transitLeg = transitSettled.status === 'fulfilled' ? transitSettled.value?.routes?.[0]?.legs?.[0] : null
            if (transitLeg && comboNoLocalTransit.value && transitSettled.status === 'fulfilled') {
              const routes = transitSettled.value?.routes ?? []
              for (const route of routes) {
                const leg = route?.legs?.[0]
                if (leg && transitUsesOnlyGoOrWalk(leg)) {
                  transitLeg = leg
                  break
                }
              }
              if (!transitUsesOnlyGoOrWalk(transitLeg) && getLastGoStepIndex(transitLeg) >= 0 && !transitUsesViaRail(transitLeg)) {
                const goWalkLeg = await buildGoPlusWalkLeg(transitLeg)
                if (goWalkLeg) transitLeg = goWalkLeg
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
        const noLocalTransitFiltered = comboNoLocalTransit.value
          ? validCandidates.filter((c) => transitUsesOnlyGoOrWalk(c.transitLeg))
          : validCandidates
        const TRAFFIC_THRESHOLD = 1.35
        const trafficFiltered = noLocalTransitFiltered.filter(
          (c) => (c.driveDurationInTraffic ?? 0) / (c.driveDuration || 1) <= TRAFFIC_THRESHOLD
        )
        const toScore = trafficFiltered.length > 0 ? trafficFiltered : noLocalTransitFiltered
        const scored = [...toScore].sort((a, b) => {
          const distA = a.driveDistance ?? 0
          const distB = b.driveDistance ?? 0
          if (distB !== distA) return preferLessDriving ? distA - distB : distB - distA
          const goA = a.isGo ? 1 : 0
          const goB = b.isGo ? 1 : 0
          if (goB !== goA) return goB - goA
          return (a.totalTime ?? Infinity) - (b.totalTime ?? Infinity)
        })

        const best = scored[0]
        if (!best) {
          comboUnavailableReason.value = comboNoLocalTransit.value
            ? "Could not build a GO+walk combo. Try turning off 'No local transit' to see routes with buses (TTC, MiWay, etc.)."
            : 'Could not find a suitable combo route. Try adjusting traffic or combo options.'
        } else {
          const { driveLeg, transitLeg, station, totalTime } = best
          const totalDistance = driveLeg.distance?.value && transitLeg.distance?.value
            ? { value: driveLeg.distance.value + transitLeg.distance.value, text: `${Math.round((driveLeg.distance.value + transitLeg.distance.value) / 1000)} km` }
            : null
          const bounds = new google.value.maps.LatLngBounds()
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

          comboResult.value = {
            duration: { value: totalTime, text: formatDurationText(totalTime) },
            distance: totalDistance,
            result: { routes: [mergedRoute] },
            stationName: station.name,
          }
        }
        }
      } catch {
        comboUnavailableReason.value = 'Combo calculation failed.'
      }
    } else {
      comboUnavailableReason.value = 'Combo requires a transit route.'
    }

    if (!drivingResult.value && !transitResult.value && !comboResult.value) {
      directionsError.value = 'No routes found between these locations.'
    } else {
      frozenActiveCriteria.value = buildActiveCriteria()
      lastCalculatedInputs.value = snapshotInputs()
      const candidates = [
        drivingResult.value && { mode: 'driving', result: drivingResult.value.result },
        transitResult.value && { mode: 'transit', result: transitResult.value.result },
        comboResult.value && { mode: 'combo', result: comboResult.value.result },
      ].filter(Boolean)
      selectedRoute.value = candidates[0]
    }
  } catch (e) {
    directionsError.value = e?.message || 'Failed to calculate directions.'
  } finally {
    loading.value = false
  }
}

function onSelectRoute({ mode, result }) {
  if (selectedRoute.value?.mode === mode) {
    detailsExpanded.value = !detailsExpanded.value
  } else {
    selectedRoute.value = { mode, result }
    detailsExpanded.value = true
  }
}

onMounted(async () => {
  initTravelTimeInput()
  try {
    await load()
  } catch (e) {
    // loadError is set in composable
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <div class="mx-auto max-w-6xl px-3 py-4 sm:px-4 lg:px-5">
      <header class="mb-4">
        <h1 class="text-lg font-bold tracking-tight text-gray-900 sm:text-xl">
          Commute
        </h1>
        <p class="mt-1 text-xs text-gray-600">
          Compare driving, transit, and drive+transit (GO) routes between two locations.
        </p>
      </header>

      <!-- API key / load error -->
      <div
        v-if="loadError"
        class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-amber-800"
      >
        <p class="text-sm font-medium">Could not load Google Maps</p>
        <p class="mt-0.5 text-xs">{{ loadError.message }}</p>
        <p class="mt-1 text-xs">
          If you just added <code class="rounded bg-amber-100 px-1">.env</code>, restart the dev server
          (<code class="rounded bg-amber-100 px-1">npm run dev</code>).           Ensure Maps JavaScript API, Places API, Places API (New),
          and Directions API (Legacy) are enabled in Google Cloud Console.
        </p>
      </div>

      <div v-else class="space-y-4">
        <!-- Form -->
        <div class="rounded border border-gray-200 bg-white p-4 shadow-sm">
          <div class="space-y-3">
            <div>
              <label for="origin" class="block text-xs font-medium text-gray-700">
                Origin
              </label>
              <div class="mt-1">
                <PlaceAutocomplete
                  id="origin"
                  v-model="originInput"
                  placeholder="Start location"
                  :google="google"
                  @place-select="onOriginSelect"
                />
              </div>
            </div>
            <div class="flex justify-end">
              <button
                type="button"
                title="Swap origin and destination"
                class="rounded p-1 text-gray-400 transition focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                :class="originPlace && destinationPlace ? 'hover:bg-gray-100 hover:text-gray-600' : ''"
                :disabled="!originPlace || !destinationPlace"
                @click="swapDirections"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            </div>
            <div class="!mt-0">
              <label for="destination" class="block text-xs font-medium text-gray-700">
                Destination
              </label>
              <div class="mt-1">
                <PlaceAutocomplete
                  id="destination"
                  v-model="destinationInput"
                  placeholder="End location"
                  :google="google"
                  @place-select="onDestinationSelect"
                />
              </div>
            </div>
            <div v-if="showAdvancedOptions" class="mt-4 space-y-3 rounded border border-gray-200 bg-gray-50 p-3">
              <h3 class="text-xs font-semibold text-gray-700">Advanced options</h3>
              <div class="space-y-3">
                <div>
                  <p class="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Time</p>
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="flex gap-2">
                      <label class="flex cursor-pointer items-center gap-1">
                        <input v-model="timeMode" type="radio" name="timeMode" value="depart" class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span class="text-xs text-gray-700">Depart at</span>
                      </label>
                      <label class="flex cursor-pointer items-center gap-1">
                        <input v-model="timeMode" type="radio" name="timeMode" value="arrive" class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500" />
                        <span class="text-xs text-gray-700">Arrive by</span>
                      </label>
                    </div>
                    <input
                      v-model="travelTimeInput"
                      type="datetime-local"
                      class="rounded border border-gray-300 px-2 py-1 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <p class="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Driving</p>
                  <div class="flex flex-wrap gap-2">
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="avoidTolls" type="checkbox" class="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Avoid tolls</span>
                    </label>
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="avoidHighways" type="checkbox" class="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Avoid highways</span>
                    </label>
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="avoidFerries" type="checkbox" class="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Avoid ferries</span>
                    </label>
                    <div class="flex items-center gap-1">
                      <span class="text-xs text-gray-700">Traffic:</span>
                      <select v-model="trafficModel" class="rounded border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="best_guess">Best guess</option>
                        <option value="pessimistic">Pessimistic</option>
                        <option value="optimistic">Optimistic</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <p class="mb-2.5 text-xs font-medium uppercase tracking-wide text-gray-500">Transit</p>
                  <div class="flex flex-wrap gap-2">
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="transitRoutingPreference" type="radio" name="transitPref" :value="null" class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Default</span>
                    </label>
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="transitRoutingPreference" type="radio" name="transitPref" value="FEWER_TRANSFERS" class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Fewer transfers</span>
                    </label>
                    <label class="flex cursor-pointer items-center gap-1">
                      <input v-model="transitRoutingPreference" type="radio" name="transitPref" value="LESS_WALKING" class="h-3 w-3 border-gray-300 text-blue-600 focus:ring-blue-500" />
                      <span class="text-xs text-gray-700">Less walking</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
            <div class="mt-4 flex items-center gap-2">
              <button
                type="button"
                :title="showAdvancedOptions ? 'Hide advanced options' : 'Advanced options'"
                class="rounded p-1 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                :class="showAdvancedOptions ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'"
                @click="showAdvancedOptions = !showAdvancedOptions"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Combo options -->
        <div class="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <div class="mb-2 flex items-center justify-between">
            <p class="text-xs font-medium text-gray-700">Combo</p>
            <button
              v-if="hasComboOptionsActive"
              type="button"
              class="text-xs text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              @click="resetComboOptions"
            >
              Reset
            </button>
          </div>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              :class="comboOnlyGoStation ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
              @click="comboOnlyGoStation = !comboOnlyGoStation"
            >
              On-site parking only
            </button>
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              :class="comboAllowStreetParking ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
              @click="comboAllowStreetParking = !comboAllowStreetParking"
            >
              Allow street parking
            </button>
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              :class="comboLessDriving ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
              @click="comboLessDriving = !comboLessDriving"
            >
              Prefer nearest station
            </button>
            <button
              type="button"
              class="rounded-full px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              :class="comboNoLocalTransit ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
              @click="comboNoLocalTransit = !comboNoLocalTransit"
            >
              No local transit
            </button>
          </div>
        </div>

        <!-- Active criteria -->
        <div
          v-if="activeCriteria.length > 0"
          class="flex flex-wrap items-center gap-2 rounded border border-gray-200 bg-white px-3 py-2"
        >
          <span class="text-[10px] font-medium text-gray-500">Active:</span>
          <ul class="flex flex-wrap gap-2">
            <li
              v-for="(item, i) in activeCriteria"
              :key="i"
              class="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-700"
              :title="typeof item === 'object' ? item.title : undefined"
            >
              {{ typeof item === 'object' ? item.label : item }}
            </li>
          </ul>
        </div>

        <div v-if="!hasResults || showRefreshButton" class="flex items-center gap-2">
          <button
            type="button"
            :disabled="!canCalculate || loading"
            class="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            @click="calculate"
          >
            <svg
              v-if="hasResults"
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {{ hasResults ? 'Refresh' : 'Calculate' }}
          </button>
        </div>

        <!-- Results -->
        <CommuteResults
          :driving="drivingResult"
          :transit="transitResult"
          :combo="comboResult"
          :combo-unavailable-reason="comboUnavailableReason"
          :loading="loading"
          :error="directionsError"
          :selected-mode="selectedRoute?.mode"
          :show-details="detailsExpanded"
          :used-live-traffic="usedLiveTraffic"
          @select-route="onSelectRoute"
        />

        <!-- Map -->
        <div v-if="selectedRoute?.result" class="rounded border border-gray-200 bg-white p-3 shadow-sm">
          <h2 class="mb-2 text-[10px] font-semibold text-gray-700">Route map</h2>
          <RouteMap
            :directions-result="selectedRoute?.result ?? null"
            :mode="selectedRoute?.mode"
            :origin="originPlace"
            :destination="destinationPlace"
            :google="google"
          />
        </div>
      </div>
    </div>
  </div>
</template>
