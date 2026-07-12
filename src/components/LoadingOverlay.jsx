import React from 'react'

//message for loading....
//there is only one div in root element
export default function LoadingOverlay({ progress, message }) {
  return (
    //root element:
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(15,17,23,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 50, gap: 20
    }}>

      {/* graph of Spin and how it moves */}
      <div style={{
        width: 48, height: 48,
        border: '3px solid var(--border)',
        borderTop: '3px solid var(--accent)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      {/*animation: 'spin 0.8s linear infinite'     function name, time, animation_mode, count  */}

      <div style={{ textAlign: 'center' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>
          {message || '載入中…'}
        </div>

        {/* root element use <> to wrap multiple elements */}
        {progress !== null && progress !== undefined && (
          <>
            <div style={{
              width: 240, height: 4,
              background: 'var(--bg-surface)',
              borderRadius: 2, overflow: 'hidden', margin: '0 auto 8px'
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: 'var(--accent)',
                borderRadius: 2,
                transition: 'width 0.2s'
              }} />
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{progress}%</div>
          </>
        )}
      </div>
      {/* definition animation:spin,  */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
