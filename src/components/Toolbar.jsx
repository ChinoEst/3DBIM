import React from 'react'

const styles = {
  toolbar: {
    position: 'absolute',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '6px 10px',
    boxShadow: 'var(--shadow)',
    zIndex: 10,
    userSelect: 'none'
  },
  divider: {
    width: 1,
    height: 24,
    background: 'var(--border)',
    margin: '0 4px'
  },
  btn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    transition: 'all 0.15s',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap'
  },
  btnActive: {
    background: 'var(--accent-dim)',
    color: 'var(--accent)'
  },
  btnDanger: {
    color: 'var(--danger)'
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#fff',
    fontWeight: 600
  },
  label: {
    color: 'var(--text-muted)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    padding: '0 4px'
  }
}


//React function 開頭必須大寫, return JSX (<div>...</div>)
function ToolBtn({ label, icon, active, onClick, variant, title }) {
  const s = {
    ...styles.btn,
    ...(active ? styles.btnActive : {}),
    ...(variant === 'danger' ? styles.btnDanger : {}),
    ...(variant === 'primary' ? styles.btnPrimary : {})
  }
  return (
    <button style={s} onClick={onClick} title={title}>
      <span>{icon}</span>
      {label && <span>{label}</span>}
    </button>
  )
}

export default function Toolbar({
  transformMode,
  onTransformMode,
  onOpenIFC,
  onOpenGLB,
  onSave,
  onLoad,
  onCemera,
  onFitView,
  onDeleteSelected,
  onDeleteAll,
  hasSelection
}) {
  return (
    <div style={styles.toolbar}>
      <span style={styles.label}>載入</span>
      <ToolBtn icon="📂" label="開啟 IFC" onClick={onOpenIFC} title="載入 IFC 檔案" />
      <ToolBtn icon="🧊" label="加入 GLB" onClick={onOpenGLB} title="加入 GLB/GLTF 模型" />

      <div style={styles.divider} />
      <span style={styles.label}>操作</span>

      <ToolBtn
        icon="✥" label="位移 W"
        active={transformMode === 'translate'}
        onClick={() => onTransformMode('translate')}
        title="位移 (W)"
      />
      <ToolBtn
        icon="↻" label="旋轉 E"
        active={transformMode === 'rotate'}
        onClick={() => onTransformMode('rotate')}
        title="旋轉 (E)"
      />
      <ToolBtn
        icon="⊡" label="縮放 R"
        active={transformMode === 'scale'}
        onClick={() => onTransformMode('scale')}
        title="縮放 (R)"
      />
      
      {hasSelection && (
        <>
          <div style={styles.divider} />
          <ToolBtn icon="🗑" label="刪除" onClick={onDeleteSelected} variant="danger" title="刪除選取物件 (Del)" />
        </>
      )}

      <ToolBtn icon="🗑" label="全部刪除" onClick={onDeleteAll} variant="danger" title="刪除所有物件" />

      <div style={styles.divider} />
      <span style={styles.label}>專案</span>
      <ToolBtn icon="💾" label="儲存" onClick={onSave} title="儲存專案 (Ctrl+S)" />
      <ToolBtn icon="📁" label="開啟專案" onClick={onLoad} title="開啟專案檔" />
      <ToolBtn icon="⊙" label="重置視角" onClick={onFitView} title="重置相機視角" />
    </div>
  )
}
