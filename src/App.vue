<script setup>
import { ref, computed, onMounted } from 'vue'
import PlaceAutocomplete from './components/PlaceAutocomplete.vue'
import CommuteResults from './components/CommuteResults.vue'
import RouteMap from './components/RouteMap.vue'
import { useGoogleMaps } from './composables/useGoogleMaps.js'
import { useCommuteForm } from './composables/useCommuteForm.js'
import { fetchDriving, fetchTransit, messageForStatus } from './services/directionsService.js'
import { buildComboResult } from './services/comboRoute.js'

const { load, error: loadError, google } = useGoogleMaps()

const {
  originInput,
  destinationInput,
  originPlace,
  destinationPlace,
  timeMode,
  travelTimeInput,
  showAdvancedOptions,
  avoidTolls,
  avoidHighways,
  avoidFerries,
  trafficModel,
  transitRoutingPreference,
  comboLessDriving,
  comboNoLocalTransit,
  comboOnlyGoStation,
  comboAllowStreetParking,
  getTravelTimeDate,
  isTimeCustomized,
  canCalculate,
  snapshotInputs,
  inputsMatchSnapshot,
  initTravelTimeInput,
  resetComboOptions,
  hasComboOptionsActive,
  onOriginSelect,
  onDestinationSelect,
  swapDirections,
} = useCommuteForm()

const drivingResult = ref(null)
const transitResult = ref(null)
const comboResult = ref(null)
const comboUnavailableReason = ref(null)
const loading = ref(false)
const directionsError = ref(null)
const selectedRoute = ref(null)
const detailsExpanded = ref(false)
const lastDrivingDepartureTime = ref(null)
const frozenActiveCriteria = ref(null)
const lastCalculatedInputs = ref(null)

const hasResults = computed(() => drivingResult.value || transitResult.value || comboResult.value)

const showRefreshButton = computed(
  () => hasResults.value && lastCalculatedInputs.value && !inputsMatchSnapshot(lastCalculatedInputs.value)
)

const usedLiveTraffic = computed(() => {
  if (!drivingResult.value || !lastDrivingDepartureTime.value) return false
  const diffMs = Math.abs(lastDrivingDepartureTime.value.getTime() - Date.now())
  return diffMs < 15 * 60 * 1000
})

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

  const departureForDriving =
    timeMode.value === 'arrive'
      ? new Date(travelDate.getTime() - 45 * 60 * 1000)
      : travelDate

  const g = google.value

  try {
    const [drivingSettled, transitSettled] = await Promise.allSettled([
      fetchDriving(g, {
        origin,
        destination,
        avoidTolls: avoidTolls.value,
        avoidHighways: avoidHighways.value,
        avoidFerries: avoidFerries.value,
        departureTime: departureForDriving,
        trafficModel: trafficModel.value,
      }),
      fetchTransit(g, {
        origin,
        destination,
        avoidTolls: avoidTolls.value,
        avoidHighways: avoidHighways.value,
        avoidFerries: avoidFerries.value,
        travelDate,
        timeMode: timeMode.value,
        transitRoutingPreference: transitRoutingPreference.value,
      }),
    ])

    if (drivingSettled.status === 'fulfilled' && drivingSettled.value) {
      lastDrivingDepartureTime.value = departureForDriving
      drivingResult.value = drivingSettled.value
    }

    if (transitSettled.status === 'fulfilled' && transitSettled.value) {
      transitResult.value = {
        duration: transitSettled.value.duration,
        distance: transitSettled.value.distance,
        result: transitSettled.value.result,
      }
    }

    if (transitSettled.status === 'fulfilled' && transitResult.value) {
      try {
        const comboOut = await buildComboResult(g, {
          origin,
          destination,
          travelDate,
          timeMode: timeMode.value,
          allTransitRoutes: transitSettled.value.allRoutes ?? [],
          avoidTolls: avoidTolls.value,
          avoidHighways: avoidHighways.value,
          avoidFerries: avoidFerries.value,
          departureForDriving,
          trafficModel: trafficModel.value,
          comboOnlyGoStation: comboOnlyGoStation.value,
          comboAllowStreetParking: comboAllowStreetParking.value,
          comboLessDriving: comboLessDriving.value,
          comboNoLocalTransit: comboNoLocalTransit.value,
        })
        if (comboOut.result) {
          comboResult.value = comboOut.result
        } else {
          comboUnavailableReason.value = comboOut.unavailableReason
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
    directionsError.value = messageForStatus(e?.message) || e?.message || 'Failed to calculate directions.'
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
