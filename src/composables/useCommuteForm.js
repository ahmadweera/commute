import { ref, computed } from 'vue'

/**
 * Form state and options for the commute calculator.
 * Exposes refs and actions; no results state.
 */
export function useCommuteForm() {
  const originInput = ref('')
  const destinationInput = ref('')
  const originPlace = ref(null)
  const destinationPlace = ref(null)

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
  const comboOnlyGoStation = ref(false)
  const comboAllowStreetParking = ref(false)

  function defaultTravelTime() {
    return new Date()
  }

  function getTravelTimeDate() {
    if (!showAdvancedOptions.value) return defaultTravelTime()
    if (travelTimeInput.value) {
      const d = new Date(travelTimeInput.value)
      if (Number.isNaN(d.getTime())) return defaultTravelTime()
      if (d.getTime() < Date.now()) return new Date()
      return d
    }
    return defaultTravelTime()
  }

  function isTimeCustomized() {
    return showAdvancedOptions.value && !!travelTimeInput.value
  }

  const canCalculate = computed(() => !!originPlace.value && !!destinationPlace.value)

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

  function initTravelTimeInput() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const h = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    travelTimeInput.value = `${y}-${m}-${day}T${h}:${min}`
  }

  function resetComboOptions() {
    comboOnlyGoStation.value = false
    comboLessDriving.value = false
    comboNoLocalTransit.value = false
    comboAllowStreetParking.value = false
  }

  const hasComboOptionsActive = computed(
    () =>
      comboOnlyGoStation.value ||
      comboLessDriving.value ||
      comboNoLocalTransit.value ||
      comboAllowStreetParking.value
  )

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

  return {
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
  }
}
