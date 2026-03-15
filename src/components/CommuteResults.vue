<script setup>
import { computed } from 'vue'
import RouteDetails from './RouteDetails.vue'
import { getGtaAgenciesFromResult } from '../utils/gtaTransitLogos.js'

const props = defineProps({
  driving: {
    type: Object,
    default: null,
  },
  transit: {
    type: Object,
    default: null,
  },
  combo: {
    type: Object,
    default: null,
    // { duration, distance, result, stationName }
  },
  comboUnavailableReason: { type: String, default: null },
  loading: { type: Boolean, default: false },
  error: { type: String, default: null },
  selectedMode: { type: String, default: null },
  showDetails: { type: Boolean, default: false },
  usedLiveTraffic: { type: Boolean, default: false },
})

const emit = defineEmits(['select-route'])

const hasResults = computed(() => props.driving || props.transit || props.combo)
const hasError = computed(() => !!props.error)

const drivingDuration = computed(() => {
  if (!props.driving) return null
  return props.driving.durationInTraffic ?? props.driving.duration
})

const drivingTrafficLevel = computed(() => {
  if (!props.driving?.durationInTraffic || !props.driving?.duration) return 'normal'
  const base = props.driving.duration.value ?? 1
  const traffic = props.driving.durationInTraffic.value ?? base
  const ratio = traffic / base
  if (ratio > 1.35) return 'heavy'
  if (ratio > 1.1) return 'medium'
  return 'normal'
})

const drivingDurationTextClass = computed(() => {
  if (drivingTrafficLevel.value === 'heavy') return 'text-red-600'
  if (drivingTrafficLevel.value === 'medium') return 'text-amber-600'
  return 'text-gray-900'
})

const drivingBaseDuration = computed(() => {
  if (!props.driving?.duration) return null
  if (!props.driving?.durationInTraffic) return null
  const base = props.driving.duration.value
  const traffic = props.driving.durationInTraffic.value
  if (Math.abs(base - traffic) < 60) return null
  return props.driving.duration
})

const transitDuration = computed(() => props.transit?.duration ?? null)
const comboDuration = computed(() => props.combo?.duration ?? null)

const fasterMode = computed(() => {
  const driveMins = drivingDuration.value?.value ?? Infinity
  const transitMins = transitDuration.value?.value ?? Infinity
  const comboMins = comboDuration.value?.value ?? Infinity
  const min = Math.min(driveMins, transitMins, comboMins)
  if (min === Infinity) return null
  if (driveMins === min) return 'driving'
  if (transitMins === min) return 'transit'
  return 'combo'
})

const selectedResult = computed(() => {
  if (props.selectedMode === 'driving') return props.driving?.result
  if (props.selectedMode === 'transit') return props.transit?.result
  if (props.selectedMode === 'combo') return props.combo?.result
  return null
})

const transitAgencies = computed(() => getGtaAgenciesFromResult(props.transit?.result) ?? [])
const comboAgencies = computed(() => getGtaAgenciesFromResult(props.combo?.result) ?? [])

function formatDuration(duration) {
  if (!duration) return '—'
  const value = duration.value ?? 0
  const mins = Math.round(value / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} hr ${m} min` : `${h} hr`
}

function formatDistance(distance) {
  if (!distance) return '—'
  const text = distance.text
  return text || '—'
}

function selectRoute(mode) {
  const result = mode === 'driving' ? props.driving?.result : mode === 'transit' ? props.transit?.result : props.combo?.result
  if (result) emit('select-route', { mode, result })
}
</script>

<template>
  <div class="space-y-3">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center gap-1.5 rounded border border-gray-200 bg-gray-50 py-5">
      <svg class="h-4 w-4 animate-spin text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
      <span class="text-xs text-gray-600">Calculating…</span>
    </div>

    <!-- Error -->
    <div v-else-if="hasError" class="rounded border border-red-200 bg-red-50 px-2 py-2 text-xs text-red-700">
      <p class="font-medium">Something went wrong</p>
      <p class="mt-1 text-sm">{{ error }}</p>
    </div>

    <!-- Results -->
    <div v-else-if="hasResults" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <!-- Driving card -->
      <button
        type="button"
        class="flex min-w-[160px] flex-col items-start rounded border-2 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        :class="[
          driving
            ? selectedMode === 'driving'
              ? 'border-blue-400 ring-1 ring-blue-100'
              : 'border-gray-200'
            : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60',
        ]"
        :disabled="!driving"
        @click="driving && selectRoute('driving')"
      >
        <div class="flex w-full items-center justify-between">
          <span class="flex items-center gap-1 text-xs font-semibold text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            Driving
          </span>
          <div class="flex items-center gap-1">
            <span v-if="usedLiveTraffic" class="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-medium text-emerald-800" title="Driving times use current live traffic">Live traffic</span>
            <span v-if="driving && fasterMode === 'driving'" class="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-800">Faster</span>
          </div>
        </div>
        <p class="mt-1 text-xl font-bold" :class="drivingDurationTextClass">{{ formatDuration(drivingDuration) }}</p>
        <p v-if="drivingBaseDuration" class="mt-0.5 text-[10px] text-gray-500">Typically {{ formatDuration(drivingBaseDuration) }} without traffic</p>
        <p class="mt-1 text-xs text-gray-500">{{ formatDistance(driving?.distance) }}</p>
        <p v-if="!driving" class="mt-1 text-xs text-gray-400">No route found</p>
      </button>

      <!-- Transit card -->
      <button
        type="button"
        class="flex min-w-[160px] flex-col items-start rounded border-2 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        :class="[
          transit
            ? selectedMode === 'transit'
              ? 'border-blue-400 ring-1 ring-blue-100'
              : 'border-gray-200'
            : 'cursor-not-allowed border-gray-100 bg-gray-50 opacity-60',
        ]"
        :disabled="!transit"
        @click="transit && selectRoute('transit')"
      >
        <div class="flex w-full items-center justify-between">
          <span class="flex items-center gap-1 text-xs font-semibold text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Transit
          </span>
          <span v-if="transit && fasterMode === 'transit'" class="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-800">Faster</span>
        </div>
        <p class="mt-1 text-xl font-bold text-gray-900">{{ formatDuration(transitDuration) }}</p>
        <p class="mt-1 text-xs text-gray-500">{{ formatDistance(transit?.distance) }}</p>
        <div v-if="transit && transitAgencies.length" class="mt-1 flex flex-wrap gap-1">
          <img
            v-for="agency in transitAgencies"
            :key="agency.name"
            :src="agency.url"
            :alt="agency.name"
            class="h-5 w-5 rounded object-contain"
            loading="lazy"
          />
        </div>
        <p v-if="!transit" class="mt-1 text-xs text-gray-400">No transit route found</p>
      </button>

      <!-- Combo card (always shown when we have results) -->
      <div
        class="flex min-w-[160px] flex-col items-start rounded border-2 p-4 text-left"
        :class="[
          combo
            ? 'cursor-pointer bg-white transition hover:border-blue-300 hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2'
            : 'cursor-default border-gray-100 bg-gray-50 opacity-75',
          combo && selectedMode === 'combo' ? 'border-blue-400 ring-1 ring-blue-100' : combo ? 'border-gray-200' : '',
        ]"
        @click="combo && selectRoute('combo')"
      >
        <div class="flex w-full items-center justify-between">
          <span class="flex items-center gap-1 text-xs font-semibold text-gray-900">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span class="hidden sm:inline">+</span>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Combo
          </span>
          <span v-if="combo && fasterMode === 'combo'" class="rounded bg-green-100 px-1 py-0.5 text-[10px] font-medium text-green-800">Faster</span>
        </div>
        <template v-if="combo">
          <p class="mt-1 text-xl font-bold text-gray-900">{{ formatDuration(comboDuration) }}</p>
          <p class="mt-1 text-xs text-gray-500">{{ formatDistance(combo?.distance) }}</p>
          <p v-if="combo?.stationName" class="mt-1 text-xs text-gray-600">Park at {{ combo.stationName }}</p>
          <div v-if="comboAgencies.length" class="mt-1 flex flex-wrap gap-1">
            <img
              v-for="agency in comboAgencies"
              :key="agency.name"
              :src="agency.url"
              :alt="agency.name"
              class="h-5 w-5 rounded object-contain"
              loading="lazy"
            />
          </div>
        </template>
        <p v-else class="mt-1 text-xs text-gray-500" :title="comboUnavailableReason">
          {{ comboUnavailableReason || 'No combo route' }}
        </p>
      </div>
    </div>

    <!-- Route details (only when user clicks a card) -->
    <RouteDetails
      v-if="showDetails && selectedResult"
      :result="selectedResult"
      :mode="selectedMode"
      :combo-station-name="selectedMode === 'combo' ? combo?.stationName : null"
    />
  </div>
</template>
