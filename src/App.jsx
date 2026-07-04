import React, { useRef, useEffect, useState, useCallback } from 'react'
import { SceneManager } from './utils/SceneManager.js'
import { loadIFCFile } from './utils/ifcLoader.js'
import Toolbar from './components/Toolbar.jsx'
import ObjectPanel from './components/ObjectPanel.jsx'
import LoadingOverlay from './components/LoadingOverlay.jsx'
import DropZone from './components/DropZone.jsx'
import SectionPanel from './components/SectionPanel.jsx'
import IfcPropertyPanel from './components/IfcPropertyPanel.jsx'
import { useToast, ToastContainer } from './components/Toast.jsx'
import { saveAutosave, loadAutosave } from './utils/db.js'



/*
useRef: normal variable, useRef(null) = { current: null }
useState: reactive variable, when changed, will trigger re-render

useCallback: memoized function, will not change unless dependencies change
useEffect: side effect, will run after render, can
*/



export default function App() {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const ifcInputRef = useRef(null)
  const glbInputRef = useRef(null)
  const projectInputRef = useRef(null)
  const autosaveTimerRef = useRef(null)


  const [objects, setObjects] = useState(new Map())   //Map:dynamic dict
  const [selectedId, setSelectedId] = useState(null)
  const [meshList, setMeshList] = useState([])
  const [selectedMeshId, setSelectedMeshId] = useState(null)
  const [transformMode, setTransformMode] = useState('translate')
  const [loading, setLoading] = useState(null) // { message, progress }
  const { toasts, toast } = useToast()
  
  // x, y, z -plane sectioning
  const [sectionOpen, setSectionOpen] = useState(false)
  const [sectionState, setSectionState] = useState({
    x: { enabled: false, position: 0, flipped: false },
    y: { enabled: false, position: 0, flipped: false },
    z: { enabled: false, position: 0, flipped: false }
  })
  const [sceneBounds, setSceneBounds] = useState(null)
  const sectionActive = sectionState.x.enabled || sectionState.y.enabled || sectionState.z.enabled

  //ifc attribute query mode
  const [queryMode, setQueryMode] = useState(false)
  const [elementQuery, setElementQuery] = useState(null) // { loading, error, data, objName }

  // right panel with object list and mesh list(ObjectPanel), width is saved in localStorage
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
      //use localStorage to save the width of the right panel, if not found, default to 360
      const saved = Number(localStorage.getItem('bim-panel-width'))
      return saved && saved > 0 ? saved : 360
    } catch {
      return 360
    }
  })

  const handlePanelResize = useCallback((w) => {
    setPanelWidth(w)
    try { localStorage.setItem('bim-panel-width', String(w)) } catch { /* 忽略無法寫入的環境（例如無痕模式） */ }
  }, [])

  // listen for Ctrl+S / Cmd+S to save the project
  useEffect(() => {
    const handler = (e) => {
      //ctrlKey: Windows/Linux, metaKey: Mac
      // e.key === 's' means the key pressed is "s"
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // prevent the browser's default save dialog
        e.preventDefault()
        handleSave()
      }
    }
    //register the event listener for keydown events
    window.addEventListener('keydown', handler)
    //remove the event listener when the component unmounts
    return () => window.removeEventListener('keydown', handler)
  }, [])


  // Listener for selectedId changes, update the mesh list and deselect any selected mesh
  useEffect(() => {
    if (!selectedId || !sceneRef.current) {
      setMeshList([])
      setSelectedMeshId(null)
      return
    }
    setMeshList(sceneRef.current.listMeshes(selectedId))
    setSelectedMeshId(null)
    sceneRef.current.deselectMesh()
  }, [selectedId])

  // select a mesh by its UUID, update the selectedMeshId state
  const handleSelectMesh = (meshUuid) => {
    try {
      if (!selectedId || !sceneRef.current) return
      sceneRef.current.selectMesh(selectedId, meshUuid)
      setSelectedMeshId(meshUuid)
    } catch (err) {
      console.error(err)
    }
  }

  // change mesh color
  const handleMeshColor = (meshUuid, hexColor) => {
    try {
      if (!selectedId || !sceneRef.current) return
      sceneRef.current.setMeshColor(selectedId, meshUuid, hexColor)
      setMeshList(prev => prev.map(m => m.id === meshUuid ? { ...m, color: hexColor } : m))
    } catch (err) {
      console.error(err)
    }
  }

  // IFC loader
  const handleOpenIFC = () => ifcInputRef.current?.click()

  const handleIFCFile = async (file) => {
    setLoading({ message: `載入 ${file.name}…`, progress: 0 })
    try {
      const model = await loadIFCFile(file, (p) => {
        setLoading(prev => prev ? { ...prev, progress: p } : null)
      })
      sceneRef.current.addIFCModel(model, file.name)
      sceneRef.current.fitToScene()
      syncObjects()
      toast(`${file.name} 載入完成`, 'success')
    } catch (err) {
      console.error(err)
      toast(`載入 IFC 失敗：${err.message}`, 'error')
    } finally {
      setLoading(null)
    }
  }

  // glb loader
  const handleOpenGLB = () => glbInputRef.current?.click()

  const handleGLBFile = async (file) => {
    setLoading({ message: `載入 ${file.name}…`, progress: null })
    try {
      await sceneRef.current.loadGLB(file)
      sceneRef.current.fitToScene()
      syncObjects()
      toast(`${file.name} 加入場景`, 'success')
    } catch (err) {
      console.error(err)
      toast(`載入 GLB 失敗：${err.message}`, 'error')
    } finally {
      setLoading(null)
    }
  }


  const handleTransformMode = (mode) => {
    try {
      setTransformMode(mode)
      sceneRef.current?.setTransformMode(mode)
    } catch (err) {
      console.error(err)
    }
  }

  // select obj from the right panel, update the selectedId state
  const handlePanelSelect = (id) => {
    try {
      sceneRef.current?.selectById(id)
      setSelectedId(id)
    } catch (err) {
      console.error(err)
    }
  }

  // select obj from the scene, update the selectedId state
  const handleDelete = () => {
    try {
      if (!selectedId || !sceneRef.current) return
      sceneRef.current.removeObject(selectedId)
      setSelectedId(null)
      syncObjects()
      toast('物件已刪除', 'info')
    } catch (err) {
      console.error(err)
      toast('刪除物件失敗', 'error')
    }
  }



  // project save
  const handleSave = () => {
    try {
      //empty scene, nothing to save
      if (!sceneRef.current) return
      //export the current scene to a JSON object
      const data = sceneRef.current.exportProjectFull()

      /*
      blob: binary large object, a file-like object of immutable, raw data 
      */
      // js object -> JSON string -> Blob -> URL -> download link
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      /*
      URL: a obj for url handling, access to static methods like createObjectURL, revokeObjectURL
      */
      const url = URL.createObjectURL(blob)

      /*
      a: a url tag not shown
      */
      const a = document.createElement('a')
      a.href = url
      // set the download filename with timestamp
      a.download = `bim-project-${Date.now()}.json`
      // click a to  download
      a.click()
      // memory release
      URL.revokeObjectURL(url)
      toast('專案已儲存', 'success')
    } catch (err) {
      console.error(err)
      toast('專案儲存失敗', 'error')
    }
  }

  // load project
  const handleLoadProject = () => projectInputRef.current?.click()

  const handleProjectFile = async (file) => {
    try {
      if (sceneRef.current.objects.size > 0) {
        const wantSave = confirm('是否要先儲存目前場景？')
        if (wantSave) {
          handleSave()
        } else {
          const confirmDiscard = confirm('確定要放棄目前場景並載入新專案嗎？')
          if (!confirmDiscard) return
        }
        // clear the scene before loading new project
        sceneRef.current.clearAll()
      }

      //load the file as text, parse it as JSON, and load it into the scene
      const text = await file.text()
      //parse the text as JSON
      const data = JSON.parse(text)

      if (data.version === 2) {
        setLoading({ message: '還原專案中…', progress: null })
        await sceneRef.current.loadProjectFull(data)
        setLoading(null)
      } else {
        sceneRef.current?.applyProjectTransforms(data)
      }

      sceneRef.current.fitToScene()
      syncObjects()
      toast('專案還原完成', 'success')
    } catch (err) {
      toast(`專案開啟失敗：${err.message}`, 'error')
      setLoading(null)
    }
  }

  // Listener to schedule an autosave after 800ms of inactivity
  const scheduleAutosave = useCallback(() => {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = setTimeout(async () => {
      try {
        if (!sceneRef.current) return
        const data = sceneRef.current.exportProjectFull()
        await saveAutosave(data)
      } catch (err) { console.error('自動儲存失敗', err) }
    }, 800)
  }, [])

  // Sync the objects state with the current scene's objects
  const syncObjects = useCallback(() => {
    if (!sceneRef.current) return
    setObjects(new Map(sceneRef.current.objects))
    scheduleAutosave()
  }, [scheduleAutosave])


  // initialize the scene manager and load any autosaved project on mount
  useEffect(() => {
    if (!canvasRef.current || sceneRef.current) return
    let cancelled = false
    try {
      const sm = new SceneManager(canvasRef.current)
      sm.onSelect = (id) => setSelectedId(id)
      sm.onDeselect = () => setSelectedId(null)
      sm.onElementQuery = (objId, localId) => handleElementQuery(objId, localId)
      sm.onChange = () => scheduleAutosave()
      sceneRef.current = sm

      ;(async () => {
        try {
          const saved = await loadAutosave()
          if (cancelled) return
          if (saved?.objects?.length) {
            setLoading({ message: '還原上次工作階段…', progress: null })
            await sm.loadProjectFull(saved)
            if (cancelled) return
            sm.fitToScene()
            syncObjects()
            toast('已還原上次的場景', 'info')
          }
        } catch (err) {
          if (!cancelled) {
            console.error('還原自動存檔失敗', err)
            toast('還原上次場景失敗', 'error')
          }
        } finally {
          if (!cancelled) setLoading(null)
        }
      })()

      return () => {
        cancelled = true
        sm.destroy()
        sceneRef.current = null
      }
    } catch (err) {
      console.error(err)
    }
  }, [])


  // delete all objects in the scene, with confirmation prompts
  const handleDeleteAll = () => {
    try {
      if (sceneRef.current.objects.size > 0) {
        const wantSave = confirm('是否要先儲存目前場景？')
        if (wantSave) {
          handleSave()
        } else {
          const confirmDiscard = confirm('確定要放棄目前場景並載入新專案嗎？')
          if (!confirmDiscard) return
        }
        sceneRef.current.clearAll()
      }
      setSelectedId(null)
      syncObjects()
      toast('已刪除所有物件', 'info')
    } catch (err) {
      console.error(err)
      toast('刪除所有物件失敗', 'error')
    }
  }

  //  file drop handler, determine file type and call the appropriate handler
  const handleFileDrop = (files) => {
    for (const file of files) {
      try {
        const ext = file.name.split('.').pop().toLowerCase()
        if (ext === 'ifc') handleIFCFile(file)
        else if (ext === 'glb' || ext === 'gltf') handleGLBFile(file)
        else if (ext === 'json') handleProjectFile(file)
        else toast(`不支援的格式：.${ext}`, 'warn')
      } catch (err) {
        console.error(err)
        toast(`處理檔案失敗：${file.name}`, 'error')
      }
    }
  }

  // fit the camera to the scene bounds
  const handleFitView = () => {
    try {
      sceneRef.current?.fitToScene()
    } catch (err) {
      console.error(err)
    }
  }

  // toggle camera mode between fly and orbit, show a toast with the new mode
  const handleCemera = () => {
    const mode = sceneRef.current?.toggleCameraMode()
    toast(`相機模式：${mode === 'fly' ? '自由視角' : '環繞模式'}`, 'info')
  }

  // toggle object visibility, update the scene and sync the objects state
  const handleToggleVisible = (id) => {
    sceneRef.current?.toggleVisible(id)
    syncObjects()
  }

  // set object opacity, update the scene and sync the objects state
  const handleSetOpacity = (id, opacity) => {
    sceneRef.current?.setObjectOpacity(id, opacity)
    syncObjects()
  }

  const handleRename = (id, name) => {
    try {
      sceneRef.current?.renameObject(id, name)
      syncObjects()
    } catch (err) {
      console.error(err)
    }
  }

  // x,y,z plane sectioning handlers
  const handleToggleSection = () => {
    setSectionOpen(open => {
      const next = !open
      if (next) setSceneBounds(sceneRef.current?.getSceneBounds() ?? null)
      return next
    })
  }

  // toggle sectioning for a specific axis, update the scene and section state
  const handleToggleAxis = (axis, enabled) => {
    try {
      sceneRef.current?.setSectionEnabled(axis, enabled)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

// change section position for a specific axis, update the scene and section state
  const handleChangePosition = (axis, position) => {
    try {
      sceneRef.current?.setSectionPosition(axis, position)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

  // toggle section flip for a specific axis, update the scene and section state
  const handleToggleFlip = (axis, flipped) => {
    try {
      sceneRef.current?.setSectionFlip(axis, flipped)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

  // reset sectioning for all axes, update the scene and section state
  const handleResetSection = () => {
    try {
      sceneRef.current?.resetSection()
      setSectionState(sceneRef.current.getSectionState())
      toast('剖面已重置', 'info')
    } catch (err) {
      console.error(err)
    }
  }

  // ifc attribute query mode handlers
  const handleToggleQuery = () => {
    setQueryMode(prev => {
      const next = !prev
      sceneRef.current?.setQueryMode(next)
      toast(next ? '屬性查詢模式已開啟，點擊 IFC 元件查看屬性' : '屬性查詢模式已關閉', 'info')
      return next
    })
  }

  // query element properties by objId and localId, update the elementQuery state
  const handleElementQuery = async (objId, localId) => {
    const objName = sceneRef.current?.objects?.get(objId)?.name
    setElementQuery({ loading: true, error: null, data: null, objName })
    try {
      const data = await sceneRef.current.getElementProperties(objId, localId)
      setElementQuery({ loading: false, error: null, data, objName })
    } catch (err) {
      console.error(err)
      setElementQuery({ loading: false, error: err.message || '查詢失敗', data: null, objName })
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />

      <Toolbar
        transformMode={transformMode}
        onTransformMode={handleTransformMode}
        onOpenIFC={handleOpenIFC}
        onOpenGLB={handleOpenGLB}
        onSave={handleSave}
        onLoad={handleLoadProject}
        onCemera={handleCemera}
        onFitView={handleFitView}
        onDeleteSelected={handleDelete}
        onDeleteAll={handleDeleteAll}
        hasSelection={!!selectedId}
        sectionOpen={sectionOpen}
        sectionActive={sectionActive}
        onToggleSection={handleToggleSection}
        queryMode={queryMode}
        onToggleQuery={handleToggleQuery}
      />

      {sectionOpen && (
        <SectionPanel
          state={sectionState}
          bounds={sceneBounds}
          onClose={() => setSectionOpen(false)}
          onToggleAxis={handleToggleAxis}
          onChangePosition={handleChangePosition}
          onToggleFlip={handleToggleFlip}
          onReset={handleResetSection}
        />
      )}

      {elementQuery && (
        <IfcPropertyPanel query={elementQuery} onClose={() => setElementQuery(null)} />
      )}


      {/* ObjectPanel is a sub component, so all function pass for should be defined with usecallback */}
      <ObjectPanel
        objects={objects}
        selectedId={selectedId}
        onSelect={handlePanelSelect}
        onToggleVisible={handleToggleVisible}
        onSetOpacity={handleSetOpacity}
        onRename={handleRename}
        meshList={meshList}
        selectedMeshId={selectedMeshId}
        onSelectMesh={handleSelectMesh}
        onSetMeshColor={handleMeshColor}
        width={panelWidth}
        onResize={handlePanelResize}
      />

      <DropZone onFileDrop={handleFileDrop} />

      {loading && <LoadingOverlay message={loading.message} progress={loading.progress} />}

      <ToastContainer toasts={toasts} />

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: panelWidth,
        background: 'var(--bg-panel)',
        borderTop: '1px solid var(--border)',
        padding: '5px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
        fontSize: 11, color: 'var(--text-muted)',
        zIndex: 5
      }}>
        <span style={{ color: 'var(--text-secondary)' }}>
          {selectedId
            ? `✦ 已選取：${objects.get(selectedId)?.name ?? selectedId}`
            : '點擊場景中的物件以選取'}
        </span>
        <span>|</span>
        <span>物件數：{objects.size}</span>
        <span>|</span>
        <span style={{ color: 'var(--accent)' }}>
          模式：{transformMode === 'translate' ? '位移' : transformMode === 'rotate' ? '旋轉' : '縮放'}
        </span>
      </div>

      <input ref={ifcInputRef} type="file" accept=".ifc" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleIFCFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={glbInputRef} type="file" accept=".glb,.gltf" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleGLBFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={projectInputRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleProjectFile(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
