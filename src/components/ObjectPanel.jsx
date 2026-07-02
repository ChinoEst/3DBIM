import React, { useState } from 'react'
import * as THREE from 'three'
import InfoModal from './InfoModal.jsx'

// 直接 traverse 真實的 Three.js mesh reference 算統計資料，不用額外呼叫 SceneManager
function computeStats(id, obj) {
  try {
    let triangles = 0
    let meshCount = 0
    const materialUuids = new Set()

    obj.mesh.traverse((c) => {
      if (!c.isMesh) return
      meshCount++
      const geo = c.geometry
      if (geo) {
        if (geo.index) triangles += geo.index.count / 3
        else if (geo.attributes?.position) triangles += geo.attributes.position.count / 3
      }
      const mats = Array.isArray(c.material) ? c.material : [c.material]
      mats.forEach((m) => { if (m) materialUuids.add(m.uuid) })
    })

    const box = new THREE.Box3().setFromObject(obj.mesh)
    const size = box.isEmpty() ? null : box.getSize(new THREE.Vector3())

    return {
      id,
      type: obj.type,
      name: obj.name,
      fileName: obj.fileName || obj.name,
      meshCount,
      triangleCount: triangles,
      materialCount: materialUuids.size,
      size,
      opacity: obj.opacity ?? 1
    }
  } catch (error) {
    console.error(error)
    return null
  }
}

const s = {
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 360,
    height: '100%',
    background: 'var(--bg-panel)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 5,
    overflow: 'hidden'
  },
  header: {
    padding: '14px 16px 10px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0'
  },
  item: {
    padding: '7px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderLeft: '3px solid transparent'
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  itemActive: {
    background: 'var(--accent-dim)',
    borderLeftColor: 'var(--accent)'
  },
  icon: { fontSize: 14, flexShrink: 0 },
  renameIcon: {
    fontSize: 14,
    flexShrink: 0,
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    transition: 'background 0.1s, color 0.1s'
  },
  infoIcon: {
    fontSize: 11,
    fontWeight: 700,
    flexShrink: 0,
    cursor: 'pointer',
    width: 16,
    height: 16,
    borderRadius: '50%',
    border: '1px solid var(--text-muted)',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.1s, color 0.1s, border-color 0.1s'
  },
  fileName: {
    fontSize: 10,
    color: 'var(--text-muted)',
    padding: '2px 6px',
    borderRadius: 999,
    background: 'var(--bg-surface)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 130,
    flexShrink: 0
  },
  name: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'var(--text-primary)',
    fontSize: 12
  },
  editWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0
  },
  bracket: {
    color: 'var(--text-muted)',
    fontSize: 14,
    flexShrink: 0
  },
  empty: {
    padding: '24px 16px',
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 1.6
  },
  section: {
    padding: '14px 16px 4px',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)'
  },
  infoBox: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    fontSize: 11,
    color: 'var(--text-secondary)',
    lineHeight: 1.8
  },
  keyHint: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0'
  },
  key: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    color: 'var(--text-secondary)',
    fontFamily: 'monospace'
  },
  opacityRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingLeft: 22
  },
  slider: {
    flex: 1,
    accentColor: 'var(--accent)'
  },
  opacityValue: {
    fontSize: 10,
    color: 'var(--text-muted)',
    minWidth: 30,
    textAlign: 'right'
  },
  renameRow: {
    padding: '12px 16px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  renameLabel: {
    fontSize: 10,
    color: 'var(--text-muted)',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase'
  },
  renameInput: {
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '8px 10px',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)'
  },
  meshList: {
    margin: '4px 0 6px 22px',
    paddingLeft: 8,
    borderLeft: '1px solid var(--border)'
  },
  meshItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 11,
    color: 'var(--text-secondary)'
  },
  meshItemActive: {
    background: 'var(--accent-dim)',
    color: 'var(--text-primary)'
  },
  meshName: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  colorInput: {
    width: 22,
    height: 18,
    padding: 0,
    border: '1px solid var(--border)',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'none'
  }
}


export default function ObjectPanel({
  objects, selectedId, onSelect, onToggleVisible, onSetOpacity, onRename,
  meshList = [], selectedMeshId, onSelectMesh, onSetMeshColor
}) {
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [infoId, setInfoId] = useState(null)

  //map to dict, filter by type, render list
  const ifcObjs = [...objects.entries()].filter(([, o]) => o.type === 'ifc')
  const glbObjs = [...objects.entries()].filter(([, o]) => o.type === 'glb')

  const commitName = (id) => {
    if (!id) return
    onRename(id, editingName.trim() || objects.get(id)?.name)
    setEditingId(null)
  }

  const renderItem = ([id, obj]) => {
    const isActive = id === selectedId
    const icon = obj.type === 'ifc' ? '🏗' : '🧊'
    const isVisible = obj.mesh.visible !== false
    const opacity = obj.opacity ?? 1
    const isEditing = editingId === id

    return (
      <div
        key={id}
        data-testid="object-item"
        style={{ ...s.item, ...(isActive ? s.itemActive : {}) }}
        onClick={() => onSelect(id)}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-panel-hover)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        <div style={s.itemRow}>
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => commitName(id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName(id)
              if (e.key === 'Escape') setEditingId(null)
            }}
            style={{ ...s.renameInput, width: '100%' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span style={s.icon}>{icon}</span>
            <span style={s.name} title={obj.name}>{obj.name}</span>
            <span style={s.fileName} title={obj.fileName || obj.name}>{obj.fileName || obj.name}</span>
            <span
              style={s.renameIcon}
              title="編輯名稱"
              onClick={(e) => {
                e.stopPropagation()
                setEditingId(id)
                setEditingName(obj.name)
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-panel-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ✏️
            </span>
            <span
              style={s.infoIcon}
              title="檔案資訊"
              onClick={(e) => { e.stopPropagation(); setInfoId(id) }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-panel-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              i
            </span>
            <span
              style={{ ...s.icon, cursor: 'pointer', opacity: isVisible ? 1 : 0.4 }}
              onClick={(e) => { e.stopPropagation(); onToggleVisible(id) }}
              title={isVisible ? '隱藏' : '顯示'}
            >
              {isVisible ? '👁' : '🚫'}
            </span>
          </>
        )}
        </div>
        <div style={s.opacityRow} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => onSetOpacity(id, Number(e.target.value))}
            style={s.slider}
            title={`透明度 ${Math.round(opacity * 100)}%`}
          />
          <span style={s.opacityValue}>{Math.round(opacity * 100)}%</span>
        </div>

        {/* 選中物件底下的 mesh 子清單：點選單一 mesh 加綠色邊框標示，並可單獨改色 */}
        {isActive && meshList.length > 0 && (
          <div style={s.meshList} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            {meshList.map((m) => {
              const isMeshActive = m.id === selectedMeshId
              return (
                <div
                  key={m.id}
                  style={{ ...s.meshItem, ...(isMeshActive ? s.meshItemActive : {}) }}
                  onClick={() => onSelectMesh(m.id)}
                >
                  <span style={s.meshName} title={m.name}>{m.name}</span>
                  {isMeshActive && (
                    <input
                      type="color"
                      value={m.color}
                      title="變更 mesh 的顏色"
                      onChange={(e) => onSetMeshColor(m.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={s.colorInput}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const infoObj = infoId ? objects.get(infoId) : null
  const infoStats = infoObj ? computeStats(infoId, infoObj) : null

  return (
    <>
    <div style={s.panel}>
      <div style={s.header}>📋 場景物件</div>
      <div style={s.list}>
        {objects.size === 0 && (
          <div style={s.empty}>
            尚未載入任何模型<br />
            <span style={{ color: 'var(--accent)' }}>開啟 IFC</span> 或 <span style={{ color: 'var(--accent)' }}>加入 GLB</span> 開始
          </div>
        )}
        {ifcObjs.length > 0 && (
          <>
            <div style={s.section}>IFC 模型</div>
            {ifcObjs.map(renderItem)}
          </>
        )}
        {glbObjs.length > 0 && (
          <>
            <div style={s.section}>GLB 物件</div>
            {glbObjs.map(renderItem)}
          </>
        )}
      </div>
      <div style={s.infoBox}>
        <div style={{ marginBottom: 8, fontWeight: 600, color: 'var(--text-primary)' }}>快捷鍵</div>
        {[
          ['Z', '位移'],
          ['X', '旋轉'],
          ['R', '縮放'],
          ['W', '前進'],
          ['A', '左移'],
          ['S', '後退'],
          ['D', '右移'],
          ['Q', '上升'],
          ['E', '下降'],
          ['Esc', '取消選取'],
          ['Del', '刪除'],
          ['Ctrl+S', '儲存'],
        ].map(([k, v]) => (
          <div key={k} style={s.keyHint}>
            <span>{v}</span>
            <span style={s.key}>{k}</span>
          </div>
        ))}
      </div>
    </div>
    {infoStats && <InfoModal stats={infoStats} onClose={() => setInfoId(null)} />}
    </>
  )
}
