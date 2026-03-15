<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { isGoTransitStep } from '../utils/transitSteps.js'

const props = defineProps({
  directionsResult: { type: Object, default: null },
  mode: { type: String, default: null },
  origin: { type: Object, default: null },
  destination: { type: Object, default: null },
  google: { type: Object, default: null },
})

const mapContainerRef = ref(null)
let map = null
let directionsRenderer = null
let comboPolylines = []
let comboMarkers = []

function initMap() {
  if (!mapContainerRef.value || !props.google?.maps) return

  const defaultCenter = { lat: 37.7749, lng: -122.4194 }
  map = new props.google.maps.Map(mapContainerRef.value, {
    center: defaultCenter,
    zoom: 10,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: true,
    zoomControl: true,
  })

  if (!directionsRenderer) {
    directionsRenderer = new props.google.maps.DirectionsRenderer({
      suppressMarkers: false,
    })
    directionsRenderer.setMap(map)
  }
}

function fitBoundsToRoute(result) {
  if (!result?.routes?.[0]?.bounds || !map) return
  map.fitBounds(result.routes[0].bounds)
}

function toLatLng(p) {
  if (!p || !props.google?.maps) return null
  if (typeof p.lat === 'function') return p
  return new props.google.maps.LatLng(p.lat, p.lng)
}

function getStepPath(step) {
  const path = step.path ?? []
  if (path.length >= 2) return path
  if (step.start_location && step.end_location) return [step.start_location, step.end_location]
  return []
}

function clearComboOverlay() {
  comboPolylines.forEach((p) => p.setMap(null))
  comboPolylines = []
  comboMarkers.forEach((m) => m.setMap(null))
  comboMarkers = []
}

function drawComboSegment(path, color) {
  if (!path || path.length < 2 || !props.google?.maps) return
  const latLngPath = path.map(toLatLng).filter(Boolean)
  if (latLngPath.length < 2) return
  const polyline = new props.google.maps.Polyline({
    path: latLngPath,
    geodesic: true,
    strokeColor: color,
    strokeOpacity: 1,
    strokeWeight: 4,
  })
  polyline.setMap(map)
  comboPolylines.push(polyline)
}

function updateComboOverlay() {
  clearComboOverlay()
  if (props.mode !== 'combo' || !props.directionsResult?.routes?.[0] || !map || !props.google?.maps) return

  const route = props.directionsResult.routes[0]
  const legs = route.legs ?? []

  const DRIVE_COLOR = '#4285F4'
  const GO_TRANSIT_COLOR = '#34A853'
  const WALK_LOCAL_COLOR = '#FBBC04'

  for (const leg of legs) {
    const steps = leg.steps ?? []
    for (const step of steps) {
      const path = getStepPath(step)
      if (path.length < 2) continue

      if (leg === legs[0]) {
        drawComboSegment(path, DRIVE_COLOR)
      } else {
        if (step.transit || step.transit_details) {
          drawComboSegment(path, isGoTransitStep(step) ? GO_TRANSIT_COLOR : WALK_LOCAL_COLOR)
        } else {
          drawComboSegment(path, WALK_LOCAL_COLOR)
        }
      }
    }
  }

  if (props.origin?.location) {
    const originLatLng = toLatLng(props.origin.location)
    if (originLatLng) {
      const m = new props.google.maps.Marker({ position: originLatLng, map, label: 'A' })
      comboMarkers.push(m)
    }
  }
  if (legs[0]?.end_location) {
    const stationLatLng = toLatLng(legs[0].end_location)
    if (stationLatLng) {
      const m = new props.google.maps.Marker({ position: stationLatLng, map, label: 'P' })
      comboMarkers.push(m)
    }
  }
  if (props.destination?.location) {
    const destLatLng = toLatLng(props.destination.location)
    if (destLatLng) {
      const m = new props.google.maps.Marker({ position: destLatLng, map, label: 'B' })
      comboMarkers.push(m)
    }
  }
}

function updateDirections() {
  if (!directionsRenderer) return

  updateComboOverlay()

  if (props.directionsResult) {
    if (props.mode === 'combo') {
      directionsRenderer.setDirections({ routes: [] })
      directionsRenderer.setMap(null)
    } else {
      directionsRenderer.setMap(map)
      directionsRenderer.setDirections(props.directionsResult)
    }
    fitBoundsToRoute(props.directionsResult)
  } else {
    clearComboOverlay()
    directionsRenderer.setDirections({ routes: [] })
    directionsRenderer.setMap(map)
    if (props.origin?.location && props.destination?.location && map) {
      const bounds = new props.google.maps.LatLngBounds()
      bounds.extend(props.origin.location)
      bounds.extend(props.destination.location)
      map.fitBounds(bounds)
      map.setZoom(Math.min(map.getZoom(), 12))
    }
  }
}

onMounted(() => {
  if (props.google) {
    initMap()
    updateDirections()
  }
})

onBeforeUnmount(() => {
  clearComboOverlay()
  if (directionsRenderer) {
    directionsRenderer.setMap(null)
    directionsRenderer = null
  }
  map = null
})

watch(
  () => props.google,
  (g) => {
    if (g && mapContainerRef.value && !map) {
      initMap()
      updateDirections()
    }
  },
  { immediate: true }
)

watch(
  () => [props.directionsResult, props.mode, props.origin, props.destination],
  () => updateDirections(),
  { deep: true }
)
</script>

<template>
  <div ref="mapContainerRef" class="h-40 w-full rounded border border-gray-200 bg-gray-100 sm:h-48" />
</template>
