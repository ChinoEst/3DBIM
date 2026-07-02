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


export default function App() {
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)
  const ifcInputRef = useRef(null)
  const glbInputRef = useRef(null)
  const projectInputRef = useRef(null)

  const [objects, setObjects] = useState(new Map())
  const [selectedId, setSelectedId] = useState(null)
  const [meshList, setMeshList] = useState([])
  const [selectedMeshId, setSelectedMeshId] = useState(null)
  const [transformMode, setTransformMode] = useState('translate')
  const [loading, setLoading] = useState(null) // { message, progress }
  const { toasts, toast } = useToast()

  // === 剖面裁切 ===
  const [sectionOpen, setSectionOpen] = useState(false)
  const [sectionState, setSectionState] = useState({
    x: { enabled: false, position: 0, flipped: false },
    y: { enabled: false, position: 0, flipped: false },
    z: { enabled: false, position: 0, flipped: false }
  })
  const [sceneBounds, setSceneBounds] = useState(null)
  const sectionActive = sectionState.x.enabled || sectionState.y.enabled || sectionState.z.enabled

  // === IFC 屬性查詢 ===
  const [queryMode, setQueryMode] = useState(false)
  const [elementQuery, setElementQuery] = useState(null) // { loading, error, data, objName }

  // === 右側物件面板寬度（可拖曳），記住使用者上次調整的寬度 ===
  const [panelWidth, setPanelWidth] = useState(() => {
    try {
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

  
  const syncObjects = useCallback(() => {
    if (!sceneRef.current) return
    //sceneRef.current.objects = SceneManager.object
    setObjects(new Map(sceneRef.current.objects))
    setSceneBounds(sceneRef.current.getSceneBounds())
  }, [])

  // 初始化 Three.js 場景，只在元件第一次掛載時建立一次。
  useEffect(() => {
    if (!canvasRef.current || sceneRef.current) return
    try {
      const sm = new SceneManager(canvasRef.current)
      //sm.on_select = lambda id: set_selected_id(id) in py
      sm.onSelect = (id) => setSelectedId(id)
      sm.onDeselect = () => setSelectedId(null)
      sm.onElementQuery = (objId, localId) => handleElementQuery(objId, localId)
      sceneRef.current = sm
      return () => { sm.destroy(); sceneRef.current = null }
    } catch (err) {
      console.error(err)
    }
  }, [])

  // 監聽 Ctrl/Cmd + S，讓使用者可以快速儲存專案。
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 選取物件切換時，重新抓該物件底下的 mesh 清單，並重置子選取狀態
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

  // === 清單子選取：點選單一 mesh ===
  const handleSelectMesh = (meshUuid) => {
    try {
      if (!selectedId || !sceneRef.current) return
      sceneRef.current.selectMesh(selectedId, meshUuid)
      setSelectedMeshId(meshUuid)
    } catch (err) {
      console.error(err)
    }
  }

  // === 改變單一 mesh 顏色 ===
  const handleMeshColor = (meshUuid, hexColor) => {
    try {
      if (!selectedId || !sceneRef.current) return
      sceneRef.current.setMeshColor(selectedId, meshUuid, hexColor)
      // SceneManager 內部的 material 顏色已經變了，但 meshList state 是切換選取時抓的快照，
      // 不會自動跟著變，所以這裡手動把對應 mesh 的 color 欄位更新掉，color input 才會即時反映新顏色
      setMeshList(prev => prev.map(m => m.id === meshUuid ? { ...m, color: hexColor } : m))
    } catch (err) {
      console.error(err)
    }
  }

  // === IFC 檔案載入 ===
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

  // === GLB / GLTF 模型載入 ===
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

  // === 變換模式切換 ===
  const handleTransformMode = (mode) => {
    try {
      setTransformMode(mode)
      sceneRef.current?.setTransformMode(mode)
    } catch (err) {
      console.error(err)
    }
  }

  // === 從物件面板選取物件 ===
  const handlePanelSelect = (id) => {
    try {
      sceneRef.current?.selectById(id)
      setSelectedId(id)
    } catch (err) {
      console.error(err)
    }
  }

  // === 刪除已選取物件 ===
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



  // === 儲存專案 ===
  const handleSave = () => {
    try {
      if (!sceneRef.current) return
      const data = sceneRef.current.exportProjectFull()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bim-project-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast('專案已儲存', 'success')
    } catch (err) {
      console.error(err)
      toast('專案儲存失敗', 'error')
    }
  }

  // === 載入專案檔 ===
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
        sceneRef.current.clearAll()
      }


      const text = await file.text()
      const data = JSON.parse(text)

      if (data.version === 2) {
        setLoading({ message: '還原專案中…', progress: null })
        await sceneRef.current.loadProjectFull(data)
        setLoading(null)
      } else {
        // 舊版 json，只有座標沒有幾何資料
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

  // === 刪除所有物件 ===
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

  // === 拖曳匯入檔案 ===
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

  // reset cemera view
  const handleFitView = () => {
    try {
      sceneRef.current?.fitToScene()
    } catch (err) {
      console.error(err)
    }
  }

  // cemera move
  const handleCemera = () => {
    const mode = sceneRef.current?.toggleCameraMode()
    toast(`相機模式：${mode === 'fly' ? '自由視角' : '環繞模式'}`, 'info')
  }

  const handleToggleVisible = (id) => {
    sceneRef.current?.toggleVisible(id)
    syncObjects()
  }

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

  // === 剖面裁切 ===
  const handleToggleSection = () => {
    setSectionOpen(open => {
      const next = !open
      if (next) setSceneBounds(sceneRef.current?.getSceneBounds() ?? null)
      return next
    })
  }

  const handleToggleAxis = (axis, enabled) => {
    try {
      sceneRef.current?.setSectionEnabled(axis, enabled)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

  const handleChangePosition = (axis, position) => {
    try {
      sceneRef.current?.setSectionPosition(axis, position)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

  const handleToggleFlip = (axis, flipped) => {
    try {
      sceneRef.current?.setSectionFlip(axis, flipped)
      setSectionState(sceneRef.current.getSectionState())
    } catch (err) {
      console.error(err)
    }
  }

  const handleResetSection = () => {
    try {
      sceneRef.current?.resetSection()
      setSectionState(sceneRef.current.getSectionState())
      toast('剖面已重置', 'info')
    } catch (err) {
      console.error(err)
    }
  }

  // === IFC 屬性查詢 ===
  const handleToggleQuery = () => {
    setQueryMode(prev => {
      const next = !prev
      sceneRef.current?.setQueryMode(next)
      toast(next ? '屬性查詢模式已開啟，點擊 IFC 元件查看屬性' : '屬性查詢模式已關閉', 'info')
      return next
    })
  }

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
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />

      {/* Toolbar */}
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

      {/* 剖面裁切面板 */}
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

      {/* IFC 元件屬性查詢結果 */}
      {elementQuery && (
        <IfcPropertyPanel query={elementQuery} onClose={() => setElementQuery(null)} />
      )}

      {/* Right panel */}
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

      {/* Drop zone */}
      <DropZone onFileDrop={handleFileDrop} />

      {/* Loading */}
      {loading && <LoadingOverlay message={loading.message} progress={loading.progress} />}

      {/* Toasts */}
      <ToastContainer toasts={toasts} />

      {/* Status bar */}
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

      {/* Hidden file inputs */}
      <input ref={ifcInputRef} type="file" accept=".ifc" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleIFCFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={glbInputRef} type="file" accept=".glb,.gltf" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleGLBFile(e.target.files[0]); e.target.value = '' }} />
      <input ref={projectInputRef} type="file" accept=".json" style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) handleProjectFile(e.target.files[0]); e.target.value = '' }} />
    </div>
  )
}
