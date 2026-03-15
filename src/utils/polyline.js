/**
 * Encode an array of LatLng (or {lat, lng}) into a Google polyline string.
 */
export function encodePath(points) {
  if (!points?.length) return ''
  let result = ''
  let prevLat = 0
  let prevLng = 0
  for (const p of points) {
    const lat = typeof p.lat === 'function' ? p.lat() : p.lat
    const lng = typeof p.lng === 'function' ? p.lng() : p.lng
    result += encodeSigned(lat - prevLat)
    result += encodeSigned(lng - prevLng)
    prevLat = lat
    prevLng = lng
  }
  return result
}

function encodeSigned(n) {
  let s = n << 1
  if (n < 0) s = ~s
  return encodeUnsigned(s)
}

function encodeUnsigned(n) {
  let result = ''
  while (n >= 32) {
    result += String.fromCharCode((32 | (n & 31)) + 63)
    n = n >>> 5
  }
  result += String.fromCharCode(n + 63)
  return result
}
