<script setup>
import { computed } from 'vue'

const props = defineProps({
  result: { type: Object, default: null },
  mode: { type: String, default: 'driving' },
  comboStationName: { type: String, default: null },
})

const legs = computed(() => {
  if (!props.result?.routes?.[0]?.legs) return []
  return props.result.routes[0].legs
})

const allSteps = computed(() => {
  const steps = []
  legs.value.forEach((leg, legIndex) => {
    const legSteps = leg.steps ?? []
    legSteps.forEach((step, stepIndex) => {
      steps.push({
        step,
        legIndex,
        stepIndex,
        legLabel: legs.value.length > 1 ? (legIndex === 0 ? 'Drive' : 'Transit') : null,
      })
    })
  })
  return steps
})

/** For combo mode: simplified major steps (Drive, Park, Take transit, Exit, Walk/Bus) */
const comboMajorSteps = computed(() => {
  if (props.mode !== 'combo' || !props.result?.routes?.[0]?.legs?.length) return []
  const [driveLeg, transitLeg] = props.result.routes[0].legs
  const stationName = props.comboStationName || 'station'
  const majorSteps = [
    { text: `Drive to ${stationName}` },
    { text: 'Park at Station' },
  ]
  const transitSteps = (transitLeg?.steps ?? []).filter((s) => s.transit || s.transit_details)
  const walkSteps = (transitLeg?.steps ?? []).filter((s) => s.travel_mode === 'WALKING' || (s.instructions && !s.transit && !s.transit_details))
  for (const step of transitSteps) {
    const t = step.transit ?? step.transit_details
    if (!t) continue
    const line = t.line
    const vehicle = line?.vehicle?.name || 'Transit'
    const agencies = line?.agencies ?? []
    const isGo = agencies.some((a) => (a?.name ?? '').toLowerCase().includes('go'))
    const transitLabel = isGo ? `GO ${vehicle}` : (line?.short_name || line?.name || vehicle)
    const to = t.arrival_stop?.name ?? 'destination'
    majorSteps.push({ text: `Take ${transitLabel} to ${to}` })
  }
  if (transitSteps.length > 0) {
    const lastArrival = transitSteps[transitSteps.length - 1]?.transit_details?.arrival_stop?.name ?? transitSteps[transitSteps.length - 1]?.transit?.arrival_stop?.name
    const exitName = lastArrival ? lastArrival.replace(/\s+(GO|Station)$/i, '').trim() || lastArrival : 'station'
    majorSteps.push({ text: `Exit at ${exitName}` })
  }
  if (walkSteps.length > 0) {
    majorSteps.push({ text: 'Walk/Bus to destination' })
  }
  return majorSteps
})

const stepsToShow = computed(() => {
  if (props.mode === 'combo' && comboMajorSteps.value.length > 0) {
    return comboMajorSteps.value.map((s, i) => ({ step: { instructions: s.text }, legIndex: 0, stepIndex: i, legLabel: null }))
  }
  return allSteps.value
})

function stripHtml(html) {
  if (!html) return ''
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

function formatDuration(duration) {
  if (!duration?.value) return ''
  const mins = Math.round(duration.value / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function formatDistance(distance) {
  return distance?.text ?? ''
}

function getTransitInfo(step) {
  const t = step.transit ?? step.transit_details
  if (!t) return null
  const line = t.line
  const lineName = line?.short_name || line?.name || 'Transit'
  const vehicle = line?.vehicle?.name || ''
  const from = t.departure_stop?.name ?? ''
  const to = t.arrival_stop?.name ?? ''
  return { lineName, vehicle, from, to }
}
</script>

<template>
  <div v-if="result && stepsToShow.length" class="mt-2 rounded border border-gray-200 bg-gray-50 p-2">
    <h3 class="mb-1.5 text-[10px] font-semibold text-gray-700">Step-by-step directions</h3>
    <ol class="space-y-1.5">
      <li
        v-for="(item, idx) in stepsToShow"
        :key="`${item.legIndex}-${item.stepIndex}-${idx}`"
        class="flex gap-2"
      >
        <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-medium text-blue-800">
          {{ idx + 1 }}
        </span>
        <div class="min-w-0 flex-1">
          <p v-if="item.legLabel" class="mb-0.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            {{ item.legLabel }}
          </p>
          <p class="text-xs text-gray-900">
            {{ stripHtml(item.step.instructions) }}
          </p>
          <div v-if="getTransitInfo(item.step)" class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-600">
            <span v-if="getTransitInfo(item.step).lineName" class="font-medium">
              {{ getTransitInfo(item.step).lineName }}
            </span>
            <span v-if="getTransitInfo(item.step).from">
              {{ getTransitInfo(item.step).from }} → {{ getTransitInfo(item.step).to }}
            </span>
          </div>
          <div class="mt-1 flex gap-3 text-xs text-gray-500">
            <span v-if="item.step.duration">{{ formatDuration(item.step.duration) }}</span>
            <span v-if="item.step.distance">{{ formatDistance(item.step.distance) }}</span>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>
