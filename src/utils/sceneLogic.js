export function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

export function pickClosest(ifcResult, glbHit) {
  let bestId = null
  let bestDist = Infinity
  if (ifcResult && ifcResult.distance < bestDist) {
    bestDist = ifcResult.distance
    bestId = ifcResult.id
  }
  if (glbHit && glbHit.distance < bestDist) {
    bestId = glbHit.id
  }
  return bestId
}

export function removeObject(obj, scene, frags) {
  if (obj.type === 'ifc' && obj.model) {
    frags.disposeModel(obj.model.modelId)
  } else {
    scene.remove(obj.mesh)
  }
}
