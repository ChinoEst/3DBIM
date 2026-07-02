import React from 'react'

const AXES = [
  { key: 'x', label: 'X 軸', color: '#ff6b6b' },
  { key: 'y', label: 'Y 軸', color: '#51cf66' },
  { key: 'z', label: 'Z 軸', color: '#4f8ef7' }
]

const s = {
  panel: {
    position: 'absolute',
    top: 66,
    left: 16,
    width: 260,
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    zIndex: 10,
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderBottom: '1px solid var(--border)',
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--text-primary)'
  },
  closeBtn: {
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 14,
    padding: '2px 6px',
    borderRadius: 4
  },
  body: {
    padding: '10px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14
  },
  axisRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  axisTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  axisLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    flex: 1
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0
  },
  flipBtn: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-secondary)',
    fontSize: 11,
    cursor: 'pointer',
    padding: '2px 6px'
  },
  flipBtnActive: {
    color: 'var(--accent)',
    borderColor: 'var(--accent)'
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 22
  },
  slider: {
    flex: 1,
    accentColor: 'var(--accent)'
  },
  posValue: {
    fontSize: 10,
    color: 'var(--text-muted)',
    minWidth: 44,
    textAlign: 'right',
    fontFamily: 'monospace'
  },
  footer: {
    padding: '10px 14px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  resetBtn: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    cursor: 'pointer'
  },
  empty: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.6
  }
}

// 依場景包圍盒與目前位置算出滑桿的 min/max/step，包圍盒不存在時退回一個安全的預設範圍
function getRange(bounds, axis, position) {
  const idx = { x: 0, y: 1, z: 2 }[axis]
  if (!bounds) {
    const p = position ?? 0
    return { min: p - 10, max: p + 10, step: 0.05 }
  }
  const min = bounds.min[idx]
  const max = bounds.max[idx]
  const span = Math.max(max - min, 0.1)
  // 上下各留一點餘裕，讓使用者可以把平面拖到完全露出/完全遮蔽模型
  const margin = span * 0.15
  return { min: min - margin, max: max + margin, step: span / 200 || 0.01 }
}

export default function SectionPanel({ state, bounds, onClose, onToggleAxis, onChangePosition, onToggleFlip, onReset }) {
  if (!state) return null
  const hasModel = !!bounds

  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span>🔪 剖面裁切</span>
        <button style={s.closeBtn} onClick={onClose} title="關閉面板">✕</button>
      </div>
      <div style={s.body}>
        {!hasModel && <div style={s.empty}>尚未載入模型，載入後即可拖曳剖面位置。</div>}
        {AXES.map(({ key, label, color }) => {
          const axisState = state[key] || { enabled: false, position: 0, flipped: false }
          const range = getRange(bounds, key, axisState.position)
          return (
            <div key={key} style={s.axisRow}>
              <div style={s.axisTop}>
                <label style={s.axisLabel}>
                  <input
                    type="checkbox"
                    checked={axisState.enabled}
                    onChange={(e) => onToggleAxis(key, e.target.checked)}
                  />
                  <span style={{ ...s.dot, background: color }} />
                  {label}
                </label>
                <button
                  style={{ ...s.flipBtn, ...(axisState.flipped ? s.flipBtnActive : {}) }}
                  onClick={() => onToggleFlip(key, !axisState.flipped)}
                  title="翻轉裁切方向"
                  disabled={!axisState.enabled}
                >
                  ⇅ 翻轉
                </button>
              </div>
              <div style={s.sliderRow}>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={axisState.position}
                  disabled={!axisState.enabled}
                  onChange={(e) => onChangePosition(key, Number(e.target.value))}
                  style={s.slider}
                />
                <span style={s.posValue}>{axisState.position.toFixed(2)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <div style={s.footer}>
        <button style={s.resetBtn} onClick={onReset}>重置剖面</button>
      </div>
    </div>
  )
}
