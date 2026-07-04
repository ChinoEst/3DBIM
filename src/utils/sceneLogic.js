// Utility functions for scene logic, including array buffer conversion, picking closest object, removing objects, computing clip planes, and computing display opacity.
export function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  //btoa() is a built-in function that encodes a string in base-64. It is not available in Node.js, but it is available in browsers.
  return btoa(binary)
}


// Convert a base64 string to an ArrayBuffer.
export function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

// Pick the closest object based on distance from ifcResult and glbHit.
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

// Remove an object from the scene or dispose of its model if it's an IFC object.
export function removeObject(obj, scene, frags) {
  if (obj.type === 'ifc' && obj.model) {
    frags.disposeModel(obj.model.modelId)
  } else {
    scene.remove(obj.mesh)
  }
}

// === 剖面裁切：計算單一軸裁切平面的 normal/constant ===
// axisNormal 是該軸的單位向量（例如 X 軸為 {x:1,y:0,z:0}），回傳新的 { normal, constant }。
export function computeClipPlane(axisNormal, position, flipped) {
  const pos = position ?? 0
  if (flipped) {
    // 翻轉：保留座標「大於等於」position 的一側 → normal 維持原方向，constant = -position
    return { normal: { ...axisNormal }, constant: -pos }
  }
  // 預設：保留座標「小於等於」position 的一側 → normal 反向，constant = position
  // 用 (-x || 0) 把 -0 正規化成 0，避免 -0 !== 0 造成測試或序列化時的困擾
  return {
    normal: { x: -axisNormal.x || 0, y: -axisNormal.y || 0, z: -axisNormal.z || 0 },
    constant: pos
  }
}

// === 選取時的透明度疊加邏輯 ===
// value: 使用者設定的原始 opacity；isSelected: 這個物件本身是否被選取；
// somethingSelected: 場景中是否「有任何東西」被選取；dimFactor: 未選取物件要疊加的變淡係數。
export function computeDisplayOpacity(value, isSelected, somethingSelected, dimFactor) {
  if (somethingSelected && !isSelected) {
    return value * dimFactor
  }
  return value
}