import React from 'react'

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 300
  },
  modal: {
    width: 380,
    maxWidth: '90vw',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 700,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  closeBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    fontSize: 16,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 4,
    flexShrink: 0
  },
  body: {
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 12,
    padding: '4px 0',
    borderBottom: '1px solid var(--border)'
  },
  label: {
    color: 'var(--text-muted)'
  },
  value: {
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    textAlign: 'right',
    maxWidth: 200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  note: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.6,
    paddingTop: 4
  }
}

// 把數字轉成比較好讀的格式，例如 12345 -> 12,345
function formatNumber(n) {
  if (n === null || n === undefined) return '-'
  return Math.round(n).toLocaleString()
}

function formatSize(size) {
  if (!size) return '-'
  const fmt = (v) => (Math.round(v * 100) / 100).toFixed(2)
  return `${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)}`
}

export default function InfoModal({ stats, onClose }) {
  if (!stats) return null
  const icon = stats.type === 'ifc' ? '🏗' : '🧊'

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title} title={stats.name}>
            <span>{icon}</span>
            <span>{stats.name}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose} title="關閉">✕</button>
        </div>

        <div style={s.body}>
          <div style={s.row}>
            <span style={s.label}>類型</span>
            <span style={s.value}>{stats.type === 'ifc' ? 'IFC 模型' : 'GLB / GLTF'}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>檔案名稱</span>
            <span style={s.value} title={stats.fileName}>{stats.fileName}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>Mesh 數量</span>
            <span style={s.value}>{formatNumber(stats.meshCount)}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>三角面數（約）</span>
            <span style={s.value}>{formatNumber(stats.triangleCount)}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>材質數量</span>
            <span style={s.value}>{formatNumber(stats.materialCount)}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>尺寸（寬×高×深）</span>
            <span style={s.value}>{formatSize(stats.size)}</span>
          </div>
          <div style={s.row}>
            <span style={s.label}>目前透明度</span>
            <span style={s.value}>{Math.round((stats.opacity ?? 1) * 100)}%</span>
          </div>

          {stats.type === 'ifc' && (
            <div style={s.note}>
              IFC 元件數量、Pset 等更細的屬性資料未包含在這裡，這個面板只統計目前已載入到場景中的幾何資料。
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
