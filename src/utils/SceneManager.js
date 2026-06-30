import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getFragments } from './ifcLoader.js'

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas
    this.objects = new Map() // id -> { mesh, type, name }
    this.selectedObject = null
    this.onSelect = null
    this.onDeselect = null
    this._glbCounter = 0

    this._initRenderer()
    this._initScene()
    this._initCamera()
    this._initLights()
    this._initControls()
    this._initRaycaster()
    this._initHighlight()
    this._startLoop()
    this._bindResize()
    this._bindKeyboard()
  }

  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.2
  }

  _initScene() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0f1117)
    this.scene.fog = new THREE.FogExp2(0x0f1117, 0.002)

    // Grid
    const grid = new THREE.GridHelper(200, 80, 0x1e2235, 0x1a1d27)
    grid.position.y = -0.01
    this.scene.add(grid)
  }

  _initCamera() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 5000)
    this.camera.position.set(20, 15, 30)
    this.camera.lookAt(0, 0, 0)
  }

  _initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0)
    sun.position.set(40, 80, 40)
    sun.castShadow = true
    sun.shadow.mapSize.setScalar(2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -100
    sun.shadow.camera.right = 100
    sun.shadow.camera.top = 100
    sun.shadow.camera.bottom = -100
    this.scene.add(sun)

    const fill = new THREE.DirectionalLight(0xc8d8ff, 0.5)
    fill.position.set(-30, 20, -20)
    this.scene.add(fill)
  }

  _initControls() {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbitControls.enableDamping = true
    this.orbitControls.dampingFactor = 0.08
    this.orbitControls.minDistance = 0.5
    this.orbitControls.maxDistance = 2000
    this.orbitControls.maxPolarAngle = Math.PI / 2 + 0.2

    this.transformControls = new TransformControls(this.camera, this.renderer.domElement)
    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value
    })
    const tcHelper = this.transformControls.getHelper()
    this.scene.add(tcHelper)
    this._transformMode = 'translate'
  }

  _initRaycaster() {
    this.raycaster = new THREE.Raycaster()
    this.raycaster.params.InstancedMesh = { threshold: 0 }
    this.raycaster.params.Mesh.threshold = 0
    this.mouse = new THREE.Vector2()
    this._isDraggingTransform = false

    this.transformControls.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value
      if (e.value) {
        this._isDraggingTransform = true
      } else {
        setTimeout(() => { this._isDraggingTransform = false }, 50)
        const frags = getFragments()
        frags.update(true)
      }
    })
    this.transformControls.addEventListener('objectChange', () => {
      if (this._updateScheduled) return
      this._updateScheduled = true
      requestAnimationFrame(() => {
        const frags = getFragments()
        frags.update(true)
        this._updateScheduled = false
      })
    })

    this.renderer.domElement.addEventListener('click', (e) => {
      if (this._isDraggingTransform) return
      this._handleClick(e)
    })
  }

  _initHighlight() {
    this._originalMaterials = new Map()
    this._highlightMaterial = new THREE.MeshStandardMaterial({
      color: 0x4f8ef7,
      emissive: 0x1a3a7a,
      emissiveIntensity: 0.4,
      metalness: 0.1,
      roughness: 0.4,
      transparent: true,
      opacity: 0.85
    })
  }

  //keep runing
  _startLoop() {
    const animate = () => {
      this._animId = requestAnimationFrame(animate)
      this.orbitControls.update()
      this.renderer.render(this.scene, this.camera)
    }
    animate()
  }
 
  //listener : on bind resize
  _bindResize() {
    this._resizeObs = new ResizeObserver(() => this._onResize())
    this._resizeObs.observe(this.canvas.parentElement)
  }

  //dynamic resize canvas by bund size
  _onResize() {
    const w = this.canvas.clientWidth
    const h = this.canvas.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }


  _bindKeyboard() {
    this._onKey = (e) => {
      if (e.target.tagName === 'INPUT') return
      switch (e.key) {
        case 'w': case 'W': this.setTransformMode('translate'); break
        case 'e': case 'E': this.setTransformMode('rotate'); break
        case 'r': case 'R': this.setTransformMode('scale'); break
        case 'Escape': this.deselect(); break
        case 'Delete': case 'Backspace':
          if (this.selectedObject) {
            const id = this._getIdByMesh(this.selectedObject)
            if (id) this.removeObject(id)
          }
          break
      }
    }
    /*
    keydown: press
    keyup: release
    */
    //when keydown, do this._onKey and parameter is e for keyboard reaction
    window.addEventListener('keydown', this._onKey)
  }


  async _handleClick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.mouse, this.camera)

    let bestId = null
    let bestDist = Infinity

    // IFC 用自己的 raycast
    for (const [id, obj] of this.objects.entries()) {
      if (obj.type === 'ifc' && obj.model) {
        const result = await obj.model.raycast({
          mouse: new THREE.Vector2(e.clientX, e.clientY),
          dom: this.renderer.domElement,
          camera: this.camera
        })
        if (result && result.distance < bestDist) {
          bestDist = result.distance
          bestId = id
        }
      }
    }

    // GLB 用 Three.js 原生 raycaster，只收 GLB 的 mesh
    const allMeshes = []
    for (const [id, obj] of this.objects.entries()) {
      if (obj.type !== 'glb') continue
      obj.mesh.traverse(c => {
        if (c && c.type === 'Mesh') allMeshes.push(c)
      })
    }

    let hits = []
    try { hits = this.raycaster.intersectObjects(allMeshes, false) } catch (e) { hits = [] }

    if (hits.length > 0 && hits[0].distance < bestDist) {
      let target = hits[0].object
      let found = null
      while (target) {
        const id = this._getIdByMesh(target)
        if (id) { found = id; break }
        target = target.parent
      }
      if (found) {
        bestId = found
        bestDist = hits[0].distance
      }
    }

    if (bestId) this.selectById(bestId)
    else this.deselect()
  }
  _getIdByMesh(mesh) {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.mesh === mesh) return id
    }
    return null
  }

  selectById(id) {
    this.deselect()
    const obj = this.objects.get(id)
    if (!obj) return
    this.selectedObject = obj.mesh

    //selection all mesh
    obj.mesh.traverse(c => {
      if (c.isMesh) {
        //save origin
        this._originalMaterials.set(c.uuid, c.material)
        //change to Highlight
        c.material = this._highlightMaterial
      }
    })
    console.log('selectById:', id, obj.mesh)
    //transformControls follow  obj.mesh 
    this.transformControls.attach(obj.mesh)
    if (this.onSelect) this.onSelect(id, obj)
  }

  deselect() {
    if (!this.selectedObject) return
    // Restore materials
    this.selectedObject.traverse(c => {
      if (c.isMesh && this._originalMaterials.has(c.uuid)) {
        c.material = this._originalMaterials.get(c.uuid)
        this._originalMaterials.delete(c.uuid)
      }
    })
    this.transformControls.detach()
    this.selectedObject = null
    if (this.onDeselect) this.onDeselect()
  }

  setTransformMode(mode) {
    this._transformMode = mode
    this.transformControls.setMode(mode)
  }

  // === IFC ===
  addIFCModel({ object, model }, filename) {
      const id = `ifc_${Date.now()}`
      model.useCamera(this.camera)
      this.scene.add(object)
      this.objects.set(id, { mesh: object, model, type: 'ifc', name: filename })
      return id
  }

  // === GLB ===
  async loadGLB(file) {
    //not suppose async/await
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const loader = new GLTFLoader()
      //gltf callback
      loader.load(url, (gltf) => {
        URL.revokeObjectURL(url)
        const model = gltf.scene
        const id = `glb_${++this._glbCounter}_${Date.now()}`
        model.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true
            c.receiveShadow = true
          }
        })
        // Auto-center
        const box = new THREE.Box3().setFromObject(model)
        const center = box.getCenter(new THREE.Vector3())
        model.position.sub(center)
        model.position.y = 0

        this.scene.add(model)
        this.objects.set(id, { mesh: model, type: 'glb', name: file.name })
        resolve(id)
      }, undefined, reject)
    })
  }

  removeObject(id) {
    const obj = this.objects.get(id)
    if (!obj) return
    if (this.selectedObject === obj.mesh) this.deselect()

    if (obj.type === 'ifc' && obj.model) {
      const frags = getFragments()
      frags.disposeModel(obj.model.modelId)
    } else {
      this.scene.remove(obj.mesh)
      obj.mesh.traverse(c => {
        if (c.isMesh) {
          c.geometry?.dispose()
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose())
          else c.material?.dispose()
        }
      })
    }

    this.objects.delete(id)
  }

  // === Camera fit ===
  //auto adjust camera for view all object
  fitToScene() {
    const meshes = [...this.objects.values()].map(o => o.mesh)
    if (meshes.length === 0) return
    //3d bbox
    const box = new THREE.Box3()
    meshes.forEach(m => box.expandByObject(m))
    //box contain all mesh
    if (box.isEmpty()) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    let dist = maxDim / (2 * Math.tan(fov / 2))
    dist *= 1.8

    this.orbitControls.target.copy(center)
    this.camera.position.set(
      center.x + dist * 0.6,
      center.y + dist * 0.5,
      center.z + dist * 0.8
    )
    this.camera.lookAt(center)
    this.orbitControls.update()
  }

  // === Save / Load ===
  //output: .json
  exportProject() {
    const data = { version: 1, objects: [] }
    for (const [id, obj] of this.objects.entries()) {
      if (obj.type === 'ifc') continue // IFC geometry can't be serialized easily; skip transforms for now
      const m = obj.mesh
      data.objects.push({
        id,
        type: obj.type,
        name: obj.name,
        position: m.position.toArray(),
        rotation: [m.rotation.x, m.rotation.y, m.rotation.z, m.rotation.order],
        scale: m.scale.toArray()
      })
    }
    return data
  }

  exportProjectFull() {
    const data = { version: 1, objects: [] }
    for (const [id, obj] of this.objects.entries()) {
      const m = obj.mesh
      data.objects.push({
        id,
        type: obj.type,
        name: obj.name,
        position: m.position.toArray(),
        rotation: [m.rotation.x, m.rotation.y, m.rotation.z, m.rotation.order],
        scale: m.scale.toArray()
      })
    }
    return data
  }

  //load project
  applyProjectTransforms(data) {
    if (!data?.objects) return
    for (const saved of data.objects) {
      const obj = [...this.objects.values()].find(o => o.name === saved.name && o.type === saved.type)
      if (!obj) continue
      obj.mesh.position.fromArray(saved.position)
      obj.mesh.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2], saved.rotation[3])
      obj.mesh.scale.fromArray(saved.scale)
    }
  }

  //clear all resource
  destroy() {
    cancelAnimationFrame(this._animId)
    this._resizeObs?.disconnect()
    window.removeEventListener('keydown', this._onKey)
    this.renderer.dispose()
    this.orbitControls.dispose()
    this.transformControls.dispose()
  }
}









