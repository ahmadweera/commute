<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Enter a location' },
  disabled: { type: Boolean, default: false },
  google: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue', 'place-select'])

const inputRef = ref(null)
let autocomplete = null

const selectedPlace = ref(null)

function initAutocomplete(google) {
  if (!inputRef.value || !google?.maps?.places) return

  const ontarioBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(41.6, -95),
    new google.maps.LatLng(56.8, -74)
  )

  autocomplete = new google.maps.places.Autocomplete(inputRef.value, {
    fields: ['place_id', 'geometry', 'formatted_address'],
    componentRestrictions: { country: 'ca' },
    bounds: ontarioBounds,
    strictBounds: true,
  })

  autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace()
    if (!place.geometry?.location) return

    selectedPlace.value = {
      placeId: place.place_id,
      location: place.geometry.location,
      formattedAddress: place.formatted_address,
    }
    emit('update:modelValue', place.formatted_address || '')
    emit('place-select', selectedPlace.value)
  })
}

function clear() {
  selectedPlace.value = null
  if (inputRef.value) inputRef.value.value = ''
  emit('update:modelValue', '')
  emit('place-select', null)
}

watch(
  () => [props.google, inputRef.value],
  ([g, el]) => {
    if (g && el && !autocomplete) {
      initAutocomplete(g)
    }
  },
  { immediate: true }
)

defineExpose({
  selectedPlace,
  clear,
  initAutocomplete,
})
</script>

<template>
  <div class="relative">
    <input
      ref="inputRef"
      type="text"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      class="w-full rounded border border-gray-300 px-3 py-2 pr-8 text-xs text-gray-900 placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      @input="emit('update:modelValue', $event.target.value)"
    />
    <button
      v-if="modelValue"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      aria-label="Clear"
      @click="clear"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
