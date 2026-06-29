import * as FRAGS from '@thatopen/fragments'
import * as THREE from 'three'

let fragments = null

function getFragments() {
  if (fragments) return fragments
  /*
  初始化 FragmentsModels 實例 
  activate worker.mjs, worker is subtrhead.
  prepare to  load ifc file and convert to fragments
  */
  fragments = new FRAGS.FragmentsModels('/worker.mjs')
  return fragments
}

export async function loadIFCFile(file, onProgress) {
  if (onProgress) onProgress(10)
  
  // IfcImporter: .ifv -> .frag , use wasm to analyze
  const serializer = new FRAGS.IfcImporter()
  serializer.wasm = {
    absolute: true,
    path: 'https://unpkg.com/web-ifc@0.0.77/'
  }

  if (onProgress) onProgress(20)

  //read file in memory
  const buffer = await file.arrayBuffer()
  //bit to Uint8Array, input of IfcImporter.process() 
  const ifcBytes = new Uint8Array(buffer)

  if (onProgress) onProgress(40)

  const fragmentBytes = await serializer.process({
    bytes: ifcBytes,
    //progressCallback, updata with ifc progress
    progressCallback: (progress) => {
      if (onProgress) onProgress(40 + Math.round(progress * 40))
    }
  })

  //progress: .ifc->.frag

  if (onProgress) onProgress(85)

  //get worker
  const frags = getFragments()
  //frags.load: build model
  const model = await frags.load(fragmentBytes, { modelId: file.name })
  //Render, default: lazy loading, true: update now
  await frags.update(true)
  //FragmentsModels 統一管理所有模型的渲染,NO model.update

  if (onProgress) onProgress(100)

  // 直接回傳 model.object，不 clone
  model.object.name = file.name
  return { object: model.object, model }
}
