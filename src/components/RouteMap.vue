<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  directionsResult: { type: Object, default: null },
  origin: { type: Object, default: null },
  destination: { type: Object, default: null },
  google: { type: Object, default: null },
})

const mapContainerRef = ref(null)
let map = null
let directionsRenderer = null

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

function updateDirections() {
  if (!directionsRenderer) return

  if (props.directionsResult) {
    directionsRenderer.setDirections(props.directionsResult)
    fitBoundsToRoute(props.directionsResult)
  } else {
    directionsRenderer.setDirections({ routes: [] })
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
  () => [props.directionsResult, props.origin, props.destination],
  () => updateDirections(),
  { deep: true }
)
</script>

<template>
  <div ref="mapContainerRef" class="h-40 w-full rounded border border-gray-200 bg-gray-100 sm:h-48" />
</template>
