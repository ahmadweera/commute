<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Enter a location' },
  disabled: { type: Boolean, default: false },
  google: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'place-select'])

const containerRef = ref(null)
let autocompleteEl = null

const selectedPlace = ref(null)

function createAutocompleteElement(google) {
  if (!containerRef.value || !google?.maps?.places?.PlaceAutocompleteElement) return

  const ontarioBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(41.6, -95), // SW: Lake Erie / Manitoba border
    new google.maps.LatLng(56.8, -74)  // NE: Hudson Bay / Quebec border
  )

  autocompleteEl = new google.maps.places.PlaceAutocompleteElement({
    placeholder: props.placeholder,
    locationRestriction: ontarioBounds,
    includedRegionCodes: ['ca'],
  })

  autocompleteEl.id = 'place-autocomplete-input'
  autocompleteEl.addEventListener('gmp-select', async (event) => {
    const placePrediction = event.placePrediction
    if (!placePrediction) return

    const place = placePrediction.toPlace()
    await place.fetchFields({
      fields: ['id', 'formattedAddress', 'location'],
    })

    if (!place.location) return

    selectedPlace.value = {
      placeId: place.id,
      location: place.location,
      formattedAddress: place.formattedAddress || '',
    }
    const addr = place.formattedAddress || ''
    emit('update:modelValue', addr)
    emit('place-select', selectedPlace.value)
    if (autocompleteEl) autocompleteEl.value = addr
  })

  containerRef.value.innerHTML = ''
  containerRef.value.appendChild(autocompleteEl)
}

function clear() {
  selectedPlace.value = null
  emit('update:modelValue', '')
  emit('place-select', null)
  if (autocompleteEl) autocompleteEl.value = ''
}

watch(
  () => [props.google, containerRef.value],
  ([g, el]) => {
    if (g && el) {
      createAutocompleteElement(g)
    }
  },
  { immediate: true }
)

watch(
  () => props.placeholder,
  (p) => {
    if (autocompleteEl) autocompleteEl.placeholder = p
  }
)

watch(
  () => props.modelValue,
  (v) => {
    if (autocompleteEl && autocompleteEl.value !== v) {
      autocompleteEl.value = v ?? ''
    }
  }
)

onBeforeUnmount(() => {
  if (autocompleteEl && containerRef.value?.contains(autocompleteEl)) {
    containerRef.value.removeChild(autocompleteEl)
  }
  autocompleteEl = null
})

defineExpose({
  selectedPlace,
  clear,
})
</script>

<template>
  <div class="relative">
    <div
      ref="containerRef"
      class="place-autocomplete-wrapper"
    />
    <button
      v-if="modelValue"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 z-10 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      aria-label="Clear"
      @click="clear"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.place-autocomplete-wrapper :deep(gmp-place-autocomplete) {
  --border: 1px solid rgb(209 213 219);
  --border-radius: 0.25rem;
  --font-size: 0.75rem;
  --padding: 0.375rem 2rem 0.375rem 0.5rem;
  width: 100%;
}
</style>
