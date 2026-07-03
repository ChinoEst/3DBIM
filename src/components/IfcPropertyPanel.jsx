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
    width: 440,
    maxWidth: '92vw',
    maxHeight: '80vh',
    background: 'var(--bg-panel)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 700
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
    padding: '4px 16px 16px',
    overflowY: 'auto',
    flex: 1
  },
  section: {
    marginTop: 12
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    marginBottom: 6,
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    fontSize: 12,
    padding: '5px 0',
    borderBottom: '1px solid var(--border)'
  },
  label: {
    color: 'var(--text-muted)',
    flexShrink: 0
  },
  value: {
    color: 'var(--text-primary)',
    fontFamily: 'monospace',
    textAlign: 'right',
    overflowWrap: 'anywhere'
  },
  psetBox: {
    border: '1px solid var(--border)',
    borderRadius: 6,
    marginBottom: 8,
    overflow: 'hidden'
  },
  psetHeader: {
    padding: '6px 10px',
    background: 'var(--bg-surface)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-secondary)'
  },
  psetBody: {
    padding: '2px 10px'
  },
  empty: {
    padding: '24px 0',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: 12
  },
  loading: {
    padding: '24px 0',
    textAlign: 'center',
    color: 'var(--text-secondary)',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10
  },
  spinner: {
    width: 28, height: 28,
    border: '3px solid var(--border)',
    borderTop: '3px solid var(--accent)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite'
  }
}

// 取出 ItemAttribute（{ value, type }）或原始值的顯示字串
function readValue(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'object' && !Array.isArray(v) && 'value' in v) return v.value
  if (typeof v === 'object') return null
  return v
}

// 把 fragments getItemsData() 回傳的原始資料，整理成「基本屬性」+「屬性組 (Pset)」兩塊，方便顯示。
// fragments 的資料結構目前沒有公開穩定的型別文件，這裡用常見欄位（value/type、IsDefinedBy、
// HasProperties、Name/NominalValue）做容錯解析，遇到非預期形狀就略過該欄位，不會整個報錯。
export function flattenItemData(data) {
  const attributes = []
  const psets = []
  if (!data || typeof data !== 'object') return { attributes, psets }

  for (const [key, raw] of Object.entries(data)) {
    if (key.startsWith('_')) continue

    if (Array.isArray(raw)) {
      if (key === 'IsDefinedBy') {
        for (const pset of raw) {
          if (!pset || typeof pset !== 'object') continue
          const psetName = readValue(pset.Name) ?? '(未命名屬性組)'
          const props = []
          const hasProps = pset.HasProperties
          if (Array.isArray(hasProps)) {
            for (const p of hasProps) {
              if (!p || typeof p !== 'object') continue
              const pname = readValue(p.Name)
              const pval = readValue(p.NominalValue) ?? readValue(p.Value)
              if (pname !== null && pname !== undefined) {
                props.push({ name: String(pname), value: pval === null || pval === undefined ? '-' : String(pval) })
              }
            }
          }
          psets.push({ name: String(psetName), props })
        }
      }
      continue
    }

    const value = readValue(raw)
    if (value !== null && value !== undefined && typeof value !== 'object') {
      attributes.push({ key, value: String(value) })
    }
  }

  return { attributes, psets }
}

export default function IfcPropertyPanel({ query, onClose }) {
  if (!query) return null
  const { loading, error, data, objName } = query
  const { attributes, psets } = data ? flattenItemData(data) : { attributes: [], psets: [] }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div style={s.title}>
            <span>🔍</span>
            <span>IFC 元件屬性{objName ? ` · ${objName}` : ''}</span>
          </div>
          <button style={s.closeBtn} onClick={onClose} title="關閉">✕</button>
        </div>

        <div style={s.body}>
          {loading && (
            <div style={s.loading}>
              <div style={s.spinner} />
              <div>查詢屬性中…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {!loading && error && (
            <div style={s.empty}>查詢失敗：{error}</div>
          )}

          {!loading && !error && data && attributes.length === 0 && psets.length === 0 && (
            <div style={s.empty}>此元件沒有可顯示的屬性資料。</div>
          )}

          {!loading && !error && attributes.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>基本屬性</div>
              {attributes.map(({ key, value }) => (
                <div key={key} style={s.row}>
                  <span style={s.label}>{key}</span>
                  <span style={s.value} title={value}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && psets.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>屬性組 (Pset)</div>
              {psets.map((pset, i) => (
                <div key={i} style={s.psetBox}>
                  <div style={s.psetHeader}>{pset.name}</div>
                  <div style={s.psetBody}>
                    {pset.props.length === 0 && (
                      <div style={{ ...s.row, borderBottom: 'none', color: 'var(--text-muted)' }}>（無屬性）</div>
                    )}
                    {pset.props.map((p, j) => (
                      <div key={j} style={{ ...s.row, borderBottom: j === pset.props.length - 1 ? 'none' : '1px solid var(--border)' }}>
                        <span style={s.label}>{p.name}</span>
                        <span style={s.value} title={p.value}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
