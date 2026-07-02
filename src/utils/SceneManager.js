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
      // 選取邊框用材質：虛線、橘黃色，跟藍色高亮做出區隔
      this._outlineMaterial = new THREE.LineDashedMaterial({
        color: 0xffaa00,
        dashSize: 0.15,
        gapSize: 0.08
      })
      // 記錄目前場景中所有選取邊框，deselect 時要逐一清除+dispose
      this._selectionOutlines = []

      // 清單「單一 mesh 子選取」用的邊框材質：綠色虛線，跟物件級的橘黃色做出區隔
      this._subOutlineMaterial = new THREE.LineDashedMaterial({
        color: 0x00ff88,
        dashSize: 0.08,
        gapSize: 0.05
      })
      this._subSelectionOutline = null // 目前被清單選取的單一 mesh 邊框
      this._subSelectionOutlineInScene = false // 邊框是掛在 scene(世界座標) 還是掛在 mesh 底下
      this._selectedMeshRef = null // 目前被清單選取的單一 mesh reference
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  // 幫單一 mesh 加上虛線邊框（不影響原本 material）
  _addOutlineTo(mesh) {
    try {
      if (!mesh.geometry) return
      const edges = new THREE.EdgesGeometry(mesh.geometry, 25) // 25 度角閾值，濾掉曲面上太細碎的邊
      const outline = new THREE.LineSegments(edges, this._outlineMaterial)
      outline.computeLineDistances() // 虛線材質一定要算距離，不然會整條顯示成實線
      outline.renderOrder = 999
      mesh.add(outline)
      this._selectionOutlines.push(outline)
    } catch (error) {
      console.error(error)
    }
  }

  // 清除所有選取邊框並釋放 geometry
  _clearOutlines() {
    try {
      for (const outline of this._selectionOutlines) {
        outline.parent?.remove(outline)
        outline.geometry.dispose()
      }
      this._selectionOutlines = []
    } catch (error) {
      console.error(error)
    }
  }

  // === 子清單：單一 mesh 選取與改色 ===

  // 取得指定物件底下所有可選取 mesh 的清單（回傳可序列化資料，給 React 用）
  listMeshes(objectId) {
    try {
      const obj = this.objects.get(objectId)
      if (!obj) return []
      const list = []
      let counter = 0
      obj.mesh.traverse(c => {
        // isMesh 也會抓到 IFC 的 InstancedMesh；這是預期內的，只是改色/邊框會套用到整批 instance
        if (c.isMesh) {
          list.push({ id: c.uuid, name: c.name || `Mesh_${counter++}` })
        }
      })
      return list
    } catch (error) {
      console.error(error)
      return []
    }
  }

  _findMeshByUuid(objectId, meshUuid) {
    try {
      const obj = this.objects.get(objectId)
      if (!obj) return null
      let found = null
      obj.mesh.traverse(c => {
        if (!found && c.isMesh && c.uuid === meshUuid) found = c
      })
      return found
    } catch (error) {
      console.error(error)
      return null
    }
  }

  // 從清單點選單一 mesh：加上綠色邊框標示，跟物件級選取（橘黃邊框）分開，不互相干擾
  selectMesh(objectId, meshUuid) {
    try {
      this.deselectMesh() // 先清掉上一個被清單選取的 mesh
      const mesh = this._findMeshByUuid(objectId, meshUuid)
      if (!mesh || !mesh.geometry) return

      this._selectedMeshRef = mesh

      if (mesh.isInstancedMesh) {
        // IFC 元件通常是 InstancedMesh：同一份 geometry 被多個構件共用，各自用 instance matrix 定位。
        // EdgesGeometry 只能反映單一 local geometry 的形狀，沒辦法對應每個 instance 的實際世界座標，
        // 所以這裡改用「整批 instance 的世界座標包圍盒」畫一個虛線框，涵蓋這個 batch 涉及的範圍。
        // 缺點：不是每個構件各自精準描邊，而且是選取當下算好的，之後移動物件框線不會跟著更新。
        const box = new THREE.Box3().setFromObject(mesh)
        if (box.isEmpty()) return
        const size = box.getSize(new THREE.Vector3())
        const center = box.getCenter(new THREE.Vector3())
        const boxGeo = new THREE.BoxGeometry(size.x, size.y, size.z)
        const edges = new THREE.EdgesGeometry(boxGeo)
        const outline = new THREE.LineSegments(edges, this._subOutlineMaterial)
        outline.position.copy(center)
        outline.computeLineDistances()
        outline.renderOrder = 1000
        // 直接掛在 scene 底下（世界座標），不跟著 mesh 的 local transform 走
        this.scene.add(outline)
        this._subSelectionOutline = outline
        this._subSelectionOutlineInScene = true
      } else {
        const edges = new THREE.EdgesGeometry(mesh.geometry, 25)
        const outline = new THREE.LineSegments(edges, this._subOutlineMaterial)
        outline.computeLineDistances()
        outline.renderOrder = 1000 // 比物件級邊框(999)更高，確保疊在最上層看得到
        mesh.add(outline)
        this._subSelectionOutline = outline
        this._subSelectionOutlineInScene = false
      }
    } catch (error) {
      console.error(error)
    }
  }

  deselectMesh() {
    try {
      if (this._subSelectionOutline) {
        if (this._subSelectionOutlineInScene) {
          this.scene.remove(this._subSelectionOutline)
        } else {
          this._subSelectionOutline.parent?.remove(this._subSelectionOutline)
        }
        this._subSelectionOutline.geometry.dispose()
        this._subSelectionOutline = null
      }
      this._selectedMeshRef = null
    } catch (error) {
      console.error(error)
    }
  }

  // 改變單一 mesh 的顏色。第一次改色時會 clone material，
  // 避免多個 mesh 共用同一份 material 實例時改色互相連坐。
  setMeshColor(objectId, meshUuid, hexColor) {
    try {
      const mesh = this._findMeshByUuid(objectId, meshUuid)
      if (!mesh || !mesh.material) return
      if (!mesh.userData.__ownMaterial) {
        mesh.material = mesh.material.clone()
        mesh.userData.__ownMaterial = true
      }
      mesh.material.color.set(hexColor)
    } catch (error) {
      console.error(error)
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


    if (typeof window !== 'undefined') {
      window.__getObjectTransform = (id) => {
        const obj = this.objects.get(id)
        if (!obj || !obj.mesh) return null
        return {
          position: obj.mesh.position.toArray(),
          rotation: [obj.mesh.rotation.x, obj.mesh.rotation.y, obj.mesh.rotation.z],
          scale: obj.mesh.scale.toArray()
        }
      }
    }
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
      this.deselectMesh() // 換選取物件時，清單子選取狀態也要重置
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
          // 注意：整物件選取只變色，不加邊框；邊框只給清單選取的單一 mesh 用（見 selectMesh）
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
      // 先清掉所有選取邊框，避免殘留在場景裡
      this._clearOutlines()
      this.deselectMesh()
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
      this.deselectMesh()

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