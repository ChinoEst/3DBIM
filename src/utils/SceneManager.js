import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { getFragments, loadFragmentBytes } from './ifcLoader.js'
import { arrayBufferToBase64, base64ToArrayBuffer, computeClipPlane, computeDisplayOpacity } from './sceneLogic.js'

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas
    this.objects = new Map() // id -> { mesh, type, name }
    this.selectedObject = null
    this.onSelect = null
    this.onDeselect = null
    this._glbCounter = 0
    this.onChange = null // 物件位移/旋轉/縮放結束時觸發，供外部做自動存檔

    // ifc mesh search 
    this.onElementQuery = null // (objId, localId) => void，查詢模式下點到 IFC 元件時觸發
    this._queryMode = false

    this._initRenderer()
    this._initScene()
    this._initCamera()
    this._initLights()
    this._initControls()
    this._initRaycaster()
    this._initHighlight()
    this._initClipping()
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

      //e.preventDefault() 停止瀏覽器預設行為
      //contextmenu 右鍵選單
      this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault())

      /*
      e.button:
      1:左鍵
      2:右鍵
      3:中鍵
      */
      
      //mousedown按下的瞬間
      this.renderer.domElement.addEventListener('mousedown', (e) => {
        if (e.button === 2 && this._cameraMode === 'fly') {
          this._isRightDragging = true
        }
      })
      //mouseup放開的瞬間
      window.addEventListener('mouseup', (e) => {
        if (e.button === 2) this._isRightDragging = false
      })
      //mousemove移動中的鼠標
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
      //dragging-changed 拖曳開始和結束各處發一次
      this.transformControls.addEventListener('dragging-changed', (e) => {
        //用來記是否為拖曳狀態
        this.orbitControls.enabled = !e.value
        if (e.value) {
          //卡住其他行為，只讓thress的行為通過(位移旋轉縮放)
          this._isDraggingTransform = true
        } else {
          //delay for 50ms for Race condition，防止誤觸避免觸發click
          setTimeout(() => { this._isDraggingTransform = false }, 50)
          const frags = getFragments()
          frags.update(true)
          this.onChange?.() 
        }
      })
      //objectChange mesh 的位置角度有變化就會觸發
      //目的，為了避免移動多次觸發而導致的卡頓，一個處理完，直接除裡當下最新的那一個
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
      // use fade opacity to highlight selected object, instead of outline, because outline is not suitable for dense/smooth GLB meshes
      this._unselectedDimFactor = 0.4 // unselected objects will have their opacity multiplied by this factor when another object is selected


      this._outlineMaterial = new THREE.LineDashedMaterial({
        color: 0xffaa00,
        dashSize: 0.15,
        gapSize: 0.08
      })
      // record all the outline meshes added to the scene, so we can remove them when selection changes
      this._selectionOutlines = []

      // record the currently selected mesh reference, so we can restore the opacity of other meshes when deselecting
      this._selectedMeshRef = null
      // record the original opacity of all meshes in the scene before applying the unselected dim effect, so we can restore them when deselecting
      this._meshDimRestore = null
    } catch (error) {
      console.error(error)
      throw error
    }
  }

  // Section / Clipping planes
  // 三個正交軸各一個裁切平面，每個平面可獨立開關、移動位置、翻轉裁切方向。
  // GLB 物件透過 renderer.clippingPlanes（全域裁切）自動生效；
  // IFC (fragments) 模型另外透過 model.getClippingPlanesEvent 把同一組平面餵給運算 worker。
  _initClipping() {
    try {
      this.renderer.localClippingEnabled = true
      // 預設三個軸的法向量，方便計算裁切平面 geometry
      const axisNormal = {
        x: new THREE.Vector3(1, 0, 0),
        y: new THREE.Vector3(0, 1, 0),
        z: new THREE.Vector3(0, 0, 1)
      }
      this._clipAxisNormal = axisNormal
      // 每個軸的裁切平面狀態：enabled/position/flipped/plane
      this.clipPlanes = {
        x: { enabled: false, position: null, flipped: false, plane: new THREE.Plane(axisNormal.x.clone().negate(), 0) },
        y: { enabled: false, position: null, flipped: false, plane: new THREE.Plane(axisNormal.y.clone().negate(), 0) },
        z: { enabled: false, position: null, flipped: false, plane: new THREE.Plane(axisNormal.z.clone().negate(), 0) }
      }
    } catch (error) {
      console.error(error)
    }
  }

  // Rreturn an array of currently active clipping planes (THREE.Plane) for use in renderer and fragments.
  _activeClippingPlanes() {
    return Object.values(this.clipPlanes)
      .filter(c => c.enabled) //filter out enabled is false
      .map(c => c.plane) // get the THREE.Plane object
  }

  // 根據 enabled/position/flipped 重新計算單一軸的 plane.normal / plane.constant
  _updatePlaneGeometry(axis) {
    const c = this.clipPlanes[axis]
    if (!c) return
    const base = this._clipAxisNormal[axis]
    const { normal, constant } = computeClipPlane(base, c.position, c.flipped)
    c.plane.normal.set(normal.x, normal.y, normal.z)
    c.plane.constant = constant
  }

  // 把目前啟用的裁切平面套用到 renderer（GLB）以及所有 IFC 模型（fragments worker）
  _applyClipping() {
    try {
      //for GLB
      const planes = this._activeClippingPlanes()
      //give the planes to renderer for GLB to clip
      this.renderer.clippingPlanes = planes
      //For IFC
      const frags = getFragments()
      frags.update(true)
    } catch (error) {
      console.error(error)
    }
  }

  // switch on/off a clipping plane along the specified axis, defaiult position is the center of the scene bounds if not set yet
  setSectionEnabled(axis, enabled) {
    try {
      const c = this.clipPlanes[axis]
      if (!c) return
      //!! : convert to boolean
      c.enabled = !!enabled
      if (c.enabled && c.position === null) {
        const bounds = this.getSceneBounds()
        const idx = { x: 0, y: 1, z: 2 }[axis]
        c.position = bounds ? (bounds.min[idx] + bounds.max[idx]) / 2 : 0
      }
      this._updatePlaneGeometry(axis)
      this._applyClipping()
    } catch (error) {
      console.error(error)
    }
  }

  // 設定裁切平面沿該軸的世界座標位置
  setSectionPosition(axis, position) {
    try {
      const c = this.clipPlanes[axis]
      if (!c) return
      c.position = Number(position)
      this._updatePlaneGeometry(axis)
      this._applyClipping()
    } catch (error) {
      console.error(error)
    }
  }

  // 翻轉裁切方向（保留哪一側）
  setSectionFlip(axis, flipped) {
    try {
      const c = this.clipPlanes[axis]
      if (!c) return
      c.flipped = !!flipped
      this._updatePlaneGeometry(axis)
      this._applyClipping()
    } catch (error) {
      console.error(error)
    }
  }

  // 全部重置：關閉所有軸的裁切（不清位置記憶，方便使用者再次開啟時位置還在原地）
  resetSection() {
    try {
      for (const axis of ['x', 'y', 'z']) {
        this.clipPlanes[axis].enabled = false
        this.clipPlanes[axis].flipped = false
      }
      this._applyClipping()
    } catch (error) {
      console.error(error)
      return
    }
  }

  // 給 UI 用的可序列化剖面狀態
  getSectionState() {
    const out = {}
    for (const axis of ['x', 'y', 'z']) {
      const c = this.clipPlanes[axis]
      out[axis] = { enabled: c.enabled, position: c.position ?? 0, flipped: c.flipped }
    }
    return out
  }


  /*
  box3: bbox contain all obj
  */
  getSceneBounds() {
    try {
      const meshes = [...this.objects.values()].map(o => o.mesh)
      if (meshes.length === 0) return null
      const box = new THREE.Box3()
      meshes.forEach(m => box.expandByObject(m))
      if (box.isEmpty()) return null
      return { min: box.min.toArray(), max: box.max.toArray() }
    } catch (error) {
      console.error(error)
      return null
    }
  }

  // IFC arrtibute query: enable/disable query mode, when enabled, clicking on an IFC element will trigger onElementQuery callback
  setQueryMode(enabled) {
    this._queryMode = !!enabled
  }

  // load IFC element (localId) properties, including built-in attributes and Pset (property sets)
  async getElementProperties(objId, localId) {
    try {
      const obj = this.objects.get(objId)
      if (!obj || obj.type !== 'ifc' || !obj.model) return null
      const [data] = await obj.model.getItemsData([localId], {
        attributesDefault: true,
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          DefinesOccurrence: { attributes: false, relations: false }
        }
      })
      return data || null
    } catch (error) {
      console.error(error)
      throw new Error(error?.message || '查詢 IFC 屬性失敗')
    }
  }

  // set the opacity factor for unselected objects when another object is selected, range from 0 to 1, default is 0.4
  setUnselectedDimFactor(factor) {
    try {
      const value = Math.min(1, Math.max(0, Number(factor)))
      if (Number.isNaN(value)) return
      this._unselectedDimFactor = value
      // unselected objects will have their opacity multiplied by this factor when another object is selected
      if (this.selectedObject) {
        const id = this._getIdByMesh(this.selectedObject)
        if (id) this._applyUnselectedDim(id)
      }
    } catch (error) {
      console.error(error)
    }
  }

  /*
  //加虛線
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
  */

  /*
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
    */


  // sublist all meshes under the specified object, return serializable data for React UI

  listMeshes(objectId) {
    try {
      const obj = this.objects.get(objectId)
      if (!obj) return []
      const list = []
      let counter = 0
      obj.mesh.traverse(c => {
        if (c.isMesh) {
          const material = Array.isArray(c.material) ? c.material[0] : c.material
          const color = material?.color ? '#' + material.color.getHexString() : '#ffffff'
          list.push({ id: c.uuid, name: c.name || `Mesh_${counter++}`, color })
        }
      })
      return list
    } catch (error) {
      console.error(error)
      return []
    }
  }

  //search for a mesh by its uuid under the specified object, return the mesh reference or null if not found
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


  selectMesh(objectId, meshUuid) {
    try {
      this.deselectMesh() 
      const mesh = this._findMeshByUuid(objectId, meshUuid)
      if (!mesh || !mesh.geometry) return

      this._selectedMeshRef = mesh
      this._applyMeshUnselectedDim(meshUuid)
    } catch (error) {
      console.error(error)
    }
  }

  deselectMesh() {
    try {
      this._restoreMeshUnselectedDim()
      this._selectedMeshRef = null
    } catch (error) {
      console.error(error)
    }
  }

  // unselected meshes will have their opacity multiplied by this._unselectedDimFactor when another mesh is selected
  _applyMeshUnselectedDim(selectedMeshUuid) {
    try {
      // record all the original opacity of meshes before applying the unselected dim effect, so we can restore them later
      this._meshDimRestore = new Map()
      for (const obj of this.objects.values()) {
        obj.mesh.traverse(c => {
          if (!c.isMesh || c.uuid === selectedMeshUuid || !c.material) return
          const materials = Array.isArray(c.material) ? c.material : [c.material]
          const first = materials[0]
          const current = (first && typeof first.opacity === 'number') ? first.opacity : (obj.opacity ?? 1)
          this._meshDimRestore.set(c.uuid, { mesh: c, opacity: current })
          this._setSingleMeshOpacity(c, current * this._unselectedDimFactor)
        })
      }
    } catch (error) {
      console.error(error)
    }
  }

  
  _restoreMeshUnselectedDim() {
    try {
      if (!this._meshDimRestore) return
      for (const { mesh, opacity } of this._meshDimRestore.values()) {
        this._setSingleMeshOpacity(mesh, opacity)
      }
      this._meshDimRestore = null
    } catch (error) {
      console.error(error)
    }
  }

  // set the opacity of a single mesh, handling both single and array materials
  _setSingleMeshOpacity(mesh, value) {
    if (!mesh.material) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach(material => {
      if (!material || typeof material.opacity !== 'number') return
      //directly change on mesh
      material.opacity = value
      material.transparent = value < 1
      material.needsUpdate = true
    })
  }

  //for shared mesh
  setMeshColor(objectId, meshUuid, hexColor) {
    try {
      const mesh = this._findMeshByUuid(objectId, meshUuid)
      if (!mesh || !mesh.material) return
      //find shared mesh
      if (!mesh.userData.__ownMaterial) {
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(m => m.clone())
          : mesh.material.clone()//clone the material for which chang e color and  avoid changing the color of other meshes that share the same material
        mesh.userData.__ownMaterial = true //now this mesh is unique, we can change it color.
      }

      //set color for all materials of the mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach(material => {
        if (!material || !material.color) return
        material.color.set(hexColor)
        material.needsUpdate = true
      })
    } catch (error) {
      console.error(error)
    }
  }


  getMeshColor(objectId, meshUuid) {
    try {
      const mesh = this._findMeshByUuid(objectId, meshUuid)
      if (!mesh || !mesh.material) return null
      const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (!material || !material.color) return null
      return '#' + material.color.getHexString()
    } catch (error) {
      console.error(error)
      return null
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

          //update cemara move 
          if (this._flyKeys.w) this.camera.position.addScaledVector(forward, moveSpeed)
          if (this._flyKeys.s) this.camera.position.addScaledVector(forward, -moveSpeed)
          if (this._flyKeys.d) this.camera.position.addScaledVector(right, moveSpeed)
          if (this._flyKeys.a) this.camera.position.addScaledVector(right, -moveSpeed)
          if (this._flyKeys.e) this.camera.position.y += moveSpeed
          if (this._flyKeys.q) this.camera.position.y -= moveSpeed
        } else {
          this.orbitControls.update()
        }

        //for update object in canvas
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
      let bestIfcLocalId = null // 命中的 IFC 元件 localId，給屬性查詢用

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
            bestIfcLocalId = result.localId
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
          bestIfcLocalId = null // GLB 物件沒有 IFC localId
        }
      }

      if (bestId) {
        this.selectById(bestId)
        if (this._queryMode && bestIfcLocalId !== null && this.onElementQuery) {
          this.onElementQuery(bestId, bestIfcLocalId)
        }
      }
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
      this.deselectMesh() 
      const obj = this.objects.get(id)
      if (!obj) return
      this.selectedObject = obj.mesh
      this._applyOpacityToMaterials(obj.mesh, obj.opacity ?? 1)
      this._applyUnselectedDim(id)

      console.log('selectById:', id, obj.mesh)
      //transformControls follow  obj.mesh 
      this.transformControls.attach(obj.mesh)
      if (this.onSelect) this.onSelect(id, obj)
    } catch (error) {
      console.error(error)
    }
  }


  _applyUnselectedDim(selectedId) {
    try {
      for (const [id, obj] of this.objects.entries()) {
        if (id === selectedId) continue
        const base = obj.opacity ?? 1
        this._applyOpacityToMaterials(obj.mesh, base * this._unselectedDimFactor)
      }
    } catch (error) {
      console.error(error)
    }
  }


  deselect() {
    try {
      if (!this.selectedObject) return
      //this._clearOutlines()
      this.deselectMesh()
      this.transformControls.detach()
      this.selectedObject = null
      for (const obj of this.objects.values()) {
        this._applyOpacityToMaterials(obj.mesh, obj.opacity ?? 1)
      }
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

      const isSelected = this.selectedObject === obj.mesh
      const somethingSelected = !!this.selectedObject
      const displayValue = computeDisplayOpacity(value, isSelected, somethingSelected, this._unselectedDimFactor)
      this._applyOpacityToMaterials(obj.mesh, displayValue)
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


      //--------------------------------------------------------------------------------------------------------------------------
      //prepare for slice


      //讓model知道camrera的資訊
      model.useCamera(this.camera)
      // 先宣告好，頗面分析時get平面，會被內部套件呼叫
      model.getClippingPlanesEvent = () => this._activeClippingPlanes()

      //--------------------------------------------------------------------------------------------------------------------------


      this.scene.add(object)
      this.objects.set(id, { mesh: object, model, fragmentBytes, type: 'ifc', name: filename, opacity: 1 })
      return id
    } catch (error) {
      console.error(error)
      throw error
    }
}


  async loadGLB(file) {
    try {
      const fileBuffer = await file.arrayBuffer()
      //loadifc用到的 thatopen/fragments本身支援async/await, 但three.js不支援，所以要用Promise包裝
      //when success ,resolve; fail, reject 
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const loader = new GLTFLoader()
        //gltf callback
        loader.load(url, (gltf) => {
          try {
            URL.revokeObjectURL(url)
            const model = gltf.scene
            const id = `glb_${++this._glbCounter}_${Date.now()}`
            //traverse遍例所有的mesh
            model.traverse(c => {
              if (c.isMesh) {
                //陰影屬性
                c.castShadow = true
                //接收別人的陰影
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
        //透過thatopen來刪
        const frags = getFragments()
        frags.disposeModel(obj.model.modelId)
      }
      //glb 
      else {
        //從畫面中消失
        this.scene.remove(obj.mesh)
        obj.mesh.traverse(c => {
          if (c.isMesh) {
            //glb是樹狀結構，先刪掉頂點，在刪掉leaf
            c.geometry?.dispose()
            //一個一個刪掉mesh
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



  //auto adjust camera for view all object
  fitToScene() {
    try {
      const meshes = [...this.objects.values()].map(o => o.mesh)
      if (meshes.length === 0) return
      //3d bbox
      const box = new THREE.Box3()
      //box contain all mesh
      meshes.forEach(m => box.expandByObject(m))
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
          //先載入，再拿到一份ID參考
          const id = this.addIFCModel(result, saved.name)
          const obj = this.objects.get(id)
          obj.mesh.position.fromArray(saved.position)
          obj.mesh.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2], saved.rotation[3])
          obj.mesh.scale.fromArray(saved.scale)
          //_startloop會即時更新
          if (saved.opacity !== undefined) this.setObjectOpacity(id, saved.opacity)
        }

        if (saved.type === 'glb' && saved.fileData) {
          const buffer = base64ToArrayBuffer(saved.fileData)
          //URL只能給file或BLOB，所以要把glb包一層
          const blob = new Blob([buffer])
          const file = new File([blob], saved.name)
          //先載入，再拿到一份ID參考
          const id = await this.loadGLB(file)
          const obj = this.objects.get(id)
          obj.mesh.position.fromArray(saved.position)
          obj.mesh.rotation.set(saved.rotation[0], saved.rotation[1], saved.rotation[2], saved.rotation[3])
          obj.mesh.scale.fromArray(saved.scale)
          //_startloop會即時更新
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