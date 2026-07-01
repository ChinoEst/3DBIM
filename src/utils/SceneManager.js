import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getFragments, loadFragmentBytes } from './ifcLoader.js'
import { arrayBufferToBase64, base64ToArrayBuffer } from './sceneLogic.js'

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
    try {
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
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initScene() {
    try {
      this.scene = new THREE.Scene()
      this.scene.background = new THREE.Color(0x0f1117)
      this.scene.fog = new THREE.FogExp2(0x0f1117, 0.002)

      // Grid
      const grid = new THREE.GridHelper(200, 80, 0x1e2235, 0x1a1d27)
      grid.position.y = -0.01
      this.scene.add(grid)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initCamera() {
    try {
      const w = this.canvas.clientWidth
      const h = this.canvas.clientHeight
      this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 5000)
      this.camera.position.set(20, 15, 30)
      this.camera.lookAt(0, 0, 0)
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initLights() {
    try {
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
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initControls() {
    try {
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
      this._cameraMode = 'fly'
      this.orbitControls.enabled = false
      this._flyKeys = { w: false, a: false, s: false, d: false, q: false, e: false }
      this._isRightDragging = false
      this._flySpeed = 10
      this._lookSpeed = 0.0025
      this._euler = new THREE.Euler(0, 0, 0, 'YXZ')
      this._euler.setFromQuaternion(this.camera.quaternion)

      this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())

      this.renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 2 && this._cameraMode === 'fly') {
          this._isRightDragging = true
        }
      })
      window.addEventListener('mouseup', (e) => {
        if (e.button === 2) this._isRightDragging = false
      })
      this.renderer.domElement.addEventListener('mousemove', (e) => {
        if (!this._isRightDragging || this._cameraMode !== 'fly') return
        this._euler.y -= e.movementX * this._lookSpeed
        this._euler.x -= e.movementY * this._lookSpeed
        this._euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._euler.x))
        this.camera.quaternion.setFromEuler(this._euler)
      })
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initRaycaster() {
    try {
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
          //delay for 50ms for Race condition
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
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  _initHighlight() {
    try {
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
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  //keep runing
  _startLoop() {
    try {
      const clock = new THREE.Clock()
      const animate = () => {
        this._animId = requestAnimationFrame(animate)
        const delta = clock.getDelta()

        if (this._cameraMode === 'fly') {
          const moveSpeed = this._flySpeed * delta
          const forward = new THREE.Vector3()
          this.camera.getWorldDirection(forward)
          const right = new THREE.Vector3()
          right.crossVectors(forward, this.camera.up).normalize()

          if (this._flyKeys.w) this.camera.position.addScaledVector(forward, moveSpeed)
          if (this._flyKeys.s) this.camera.position.addScaledVector(forward, -moveSpeed)
          if (this._flyKeys.d) this.camera.position.addScaledVector(right, moveSpeed)
          if (this._flyKeys.a) this.camera.position.addScaledVector(right, -moveSpeed)
          if (this._flyKeys.e) this.camera.position.y += moveSpeed
          if (this._flyKeys.q) this.camera.position.y -= moveSpeed
        } else {
          this.orbitControls.update()
        }

        this.renderer.render(this.scene, this.camera)
      }
      animate()
    } catch (error) {
      console.error(error)
      throw error
    }
  }
 
  //listener : on bind resize
  _bindResize() {
    try {
      this._resizeObs = new ResizeObserver(() => this._onResize())
      this._resizeObs.observe(this.canvas.parentElement)
    } catch (error) {
      console.error(error)
    }
  }

  //dynamic resize canvas by bund size
  _onResize() {
    try {
      const w = this.canvas.clientWidth
      const h = this.canvas.clientHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
    } catch (error) {
      console.error(error)
    }
  }


  _bindKeyboard() {
    this._onKey = (e) => {
      try {
        if (e.target.tagName === 'INPUT') return
        switch (e.key) {
          case 'z': case 'Z': this.setTransformMode('translate'); break
          case 'x': case 'X': this.setTransformMode('rotate'); break
          case 'c': case 'C': this.setTransformMode('scale'); break
          case 'Escape': this.deselect(); break
          case 'Delete': case 'Backspace':
            if (this.selectedObject) {
              const id = this._getIdByMesh(this.selectedObject)
              if (id) this.removeObject(id)
            }
            break
          case 'w': case 'W': this._flyKeys.w = true; break
          case 'a': case 'A': this._flyKeys.a = true; break
          case 's': case 'S': this._flyKeys.s = true; break
          case 'd': case 'D': this._flyKeys.d = true; break
          case 'q': case 'Q': this._flyKeys.q = true; break
          case 'e': case 'E': this._flyKeys.e = true; break
        }
      } catch (error) {
        console.error(error)
      }
    }

    this._onKeyUp = (e) => {
      switch (e.key) {
        case 'w': case 'W': this._flyKeys.w = false; break
        case 'a': case 'A': this._flyKeys.a = false; break
        case 's': case 'S': this._flyKeys.s = false; break
        case 'd': case 'D': this._flyKeys.d = false; break
        case 'q': case 'Q': this._flyKeys.q = false; break
        case 'e': case 'E': this._flyKeys.e = false; break
      }
    }
    /*
    keydown: press
    keyup: release
    */
    //when keydown, do this._onKey and parameter is e for keyboard reaction
    window.addEventListener('keydown', this._onKey)
    window.addEventListener('keyup', this._onKeyUp)
  }


  async _handleClick(e) {
    try {
      const rect = this.renderer.domElement.getBoundingClientRect()
      //mouse coordinate: transfer to canvas; 
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      //line from camera extend to mouse
      this.raycaster.setFromCamera(this.mouse, this.camera)

      let bestId = null
      let bestDist = Infinity

      //IFC doesn't suppose Three.js, use itself
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

      // GLB use raycaster of Three.js，filter mesh from others
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
    } catch (error) {
      console.error(error)
    }
  }

  _getIdByMesh(mesh) {
    for (const [id, obj] of this.objects.entries()) {
      if (obj.mesh === mesh) return id
    }
    return null
  }


  selectById(id) {
    try {
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
      if (this._highlightMaterial) {
        this._highlightMaterial.opacity = obj.opacity ?? 1
        this._highlightMaterial.transparent = (obj.opacity ?? 1) < 1
      }
      //transformControls follow  obj.mesh 
      this.transformControls.attach(obj.mesh)
      if (this.onSelect) this.onSelect(id, obj)
    } catch (error) {
      console.error(error)
    }
  }

  deselect() {
    try {
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
    } catch (error) {
      console.error(error)
    }
  }

  setTransformMode(mode) {
    try {
      this._transformMode = mode
      this.transformControls.setMode(mode)
    } catch (error) {
      console.error(error)
    }
  }


  toggleCameraMode() {
    try {
      if (this._cameraMode === 'orbit') {
        this._cameraMode = 'fly'
        this.orbitControls.enabled = false
        this._euler.setFromQuaternion(this.camera.quaternion)
      } else {
        this._cameraMode = 'orbit'
        this.orbitControls.enabled = true
        this.orbitControls.target.copy(
          this.camera.position.clone().add(
            new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).multiplyScalar(10)
          )
        )
      }
      return this._cameraMode
    } catch (error) {
      console.error(error)
    }
  }


  toggleVisible(id) {
    try {
      const obj = this.objects.get(id)
      if (!obj) return
      obj.mesh.visible = !obj.mesh.visible
    } catch (error) {
      console.error(error)
    }
  }

  _applyOpacityToMaterials(object, value) {
    object.traverse(child => {
      if (!child.material) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach(material => {
        if (!material || typeof material.opacity !== 'number') return
        material.opacity = value
        material.transparent = value < 1
        material.needsUpdate = true
      })
    })
  }

  setObjectOpacity(id, opacity) {
    try {
      const obj = this.objects.get(id)
      if (!obj) return
      const value = Math.min(1, Math.max(0, Number(opacity) ?? 1))
      obj.opacity = value
      this._applyOpacityToMaterials(obj.mesh, value)
      if (this.selectedObject === obj.mesh && this._highlightMaterial) {
        this._highlightMaterial.opacity = value
        this._highlightMaterial.transparent = value < 1
      }
    } catch (error) {
      console.error(error)
    }
  }

  renameObject(id, name) {
    try {
      const obj = this.objects.get(id)
      if (!obj) return
      obj.name = name
    } catch (error) {
      console.error(error)
    }
  }
  
  addIFCModel({ object, model, fragmentBytes }, filename) {
    try {
      const id = `ifc_${Date.now()}`
      model.useCamera(this.camera)
      this.scene.add(object)
      this.objects.set(id, { mesh: object, model, fragmentBytes, type: 'ifc', name: filename, opacity: 1 })
      return id
    } catch (error) {
      console.error(error)
      throw error
    }
}

  // === GLB ===
  async loadGLB(file) {
    try {
      const fileBuffer = await file.arrayBuffer()
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const loader = new GLTFLoader()
        //gltf callback
        loader.load(url, (gltf) => {
          try {
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
            this.objects.set(id, { mesh: model, fileBuffer, type: 'glb', name: file.name, opacity: 1 })
            resolve(id)
          } catch (error) {
            console.error(error)
            reject(error)
          }
        }, undefined, reject)
      })
    } catch (error) {
      console.error(error)
      throw error
    }
  }


  removeObject(id) {
    try {
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
    } catch (error) {
      console.error(error)
    }
  }


  clearAll() {
    try {
      const ids = [...this.objects.keys()]
      for (const id of ids) {
        this.removeObject(id)
      }
    } catch (error) {
      console.error(error)
    }
  }


  // === Camera fit ===
  //auto adjust camera for view all object
  fitToScene() {
    try {
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
    } catch (error) {
      console.error(error)
    }
  }

  // === Save / Load ===
  //output: .json
  exportProjectFull() {
    try {
      const data = { version: 2, objects: [] }
      for (const [id, obj] of this.objects.entries()) {
        const m = obj.mesh
        const entry = {
          id,
          type: obj.type,
          name: obj.name,
          position: m.position.toArray(),
          rotation: [m.rotation.x, m.rotation.y, m.rotation.z, m.rotation.order],
          scale: m.scale.toArray(),
          opacity: obj.opacity ?? 1
        }
        
        if (obj.type === 'ifc' && obj.fragmentBytes) {
          entry.fragmentData = arrayBufferToBase64(obj.fragmentBytes.buffer || obj.fragmentBytes)
        }
        if (obj.type === 'glb' && obj.fileBuffer) {
          entry.fileData = arrayBufferToBase64(obj.fileBuffer)
        }
        
        data.objects.push(entry)
      }
      return data
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  //load project
  async loadProjectFull(data) {
    try {
      if (!data?.objects) return

      for (const saved of data.objects) {
        if (saved.type === 'ifc' && saved.fragmentData) {
          const buffer = base64ToArrayBuffer(saved.fragmentData)
          const result = await loadFragmentBytes(new Uint8Array(buffer), saved.name)
          const id = this.addIFCModel(result, saved.name)
          const obj = this.objects.get(id)
          obj.mesh.position.fromArray(saved.position)
          obj.mesh.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2], saved.rotation[3])
          obj.mesh.scale.fromArray(saved.scale)
          if (saved.opacity !== undefined) this.setObjectOpacity(id, saved.opacity)
        }

        if (saved.type === 'glb' && saved.fileData) {
          const buffer = base64ToArrayBuffer(saved.fileData)
          const blob = new Blob([buffer])
          const file = new File([blob], saved.name)
          const id = await this.loadGLB(file)
          const obj = this.objects.get(id)
          obj.mesh.position.fromArray(saved.position)
          obj.mesh.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2], saved.rotation[3])
          obj.mesh.scale.fromArray(saved.scale)
          if (saved.opacity !== undefined) this.setObjectOpacity(id, saved.opacity)
        }
      }
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  //clear all resource
  destroy() {
    try {
      cancelAnimationFrame(this._animId)
      this._resizeObs?.disconnect()
      window.removeEventListener('keydown', this._onKey)
      this.renderer.dispose()
      this.orbitControls.dispose()
      this.transformControls.dispose()
      window.removeEventListener('keydown', this._onKey)
      window.removeEventListener('keyup', this._onKeyUp)
    } catch (error) {
      console.error(error)
    }
  }
}









