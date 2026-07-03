import React, { useState, useCallback, useRef } from 'react'


//use for message 
export function useToast() {
  const [toasts, setToasts] = useState([])
  const counter = useRef(0)

  // only build at first time;
  const toast = useCallback((message, type = 'info', duration = 3000) => {
    // unique id
    const id = ++counter.current  
    //add new element to toast list, toast.append({ id, message, type }) in python, t is origin element in toasts
    setToasts(t => [...t, { id, message, type }]) 
    // remove after 3000ms
    //[x for x in t if x['id'] != id] in py
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duration) 
    /*
     Why functional updates (t => ...) instead of directly using `toasts`:
     * If multiple toasts are triggered in quick succession, each setTimeout captures the `toasts` value from its own closure at creation time.
     * When timeouts fire around the same time, using a stale closured value could cause updates to overwrite each other, dropping or leaving toasts incorrectly. 
     * Functional updates always receive the latest state from React at execution time, avoiding this race condition.
     */
  }, [])

  return { toasts, toast }
}


//typeColors and typeIcons just a table, not add or remove
const typeColors = {
  info: 'var(--accent)',   //blue
  success: 'var(--success)',  // green
  error: 'var(--danger)',  //red
  warn: 'var(--highlight)' //yellow
}

const typeIcons = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warn: '⚠️'
}


export function ToastContainer({ toasts }) {
  // toasts.map(t => ...)  => for t in toasts: in python
  return (
    <div style={{   //style={{ }}
      position: 'absolute', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 200, pointerEvents: 'none', alignItems: 'center'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: 'var(--bg-panel)',
          border: `1px solid ${typeColors[t.type] || typeColors.info}`,  // ||= deafault value
          borderRadius: 'var(--radius)',
          padding: '10px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: 'var(--shadow)',
          animation: 'fadeIn 0.2s ease',
          maxWidth: 400
        }}>
          <span>{typeIcons[t.type]}</span>
          <span style={{ color: 'var(--text-primary)', fontSize: 13 }}>{t.message}</span>
        </div>
      ))}
      
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  )
}
