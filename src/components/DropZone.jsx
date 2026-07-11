import React, { useState, useEffect } from 'react'


// show hidden layer or not
export default function DropZone({ onFileDrop }) {
  const [dragging, setDragging] = useState(false)
  const [dragCount, setDragCount] = useState(0)


   /*
    當拖著檔案在視窗裡移動，經過子元素時瀏覽器會連續觸發：
    dragenter -> dragleave -> dragenter -> dragleave ...
    造成拖曳狀態閃爍，解法是計算 dragenter 與 dragleave 的次數，當次數為 0 時才關閉拖曳狀態。
    */
  useEffect(() => {
    const onDragEnter = (e) => {
      e.preventDefault()
      setDragCount(c => c + 1)  //why not use setDragCount(c + 1) it must get pre c
      setDragging(true)
    }

    const onDragLeave = (e) => {
      e.preventDefault()
      setDragCount(c => {
        const next = c - 1
        if (next <= 0) setDragging(false)
        return next
      })
    }
    const onDragOver = (e) => { e.preventDefault() }
    const onDrop = (e) => {
      e.preventDefault() // prevent browser open file
      setDragging(false) // reset dragging state
      setDragCount(0)  // reset dragCount
      const files = [...e.dataTransfer.files] // first get file and convert FileList to array
      if (files.length > 0) onFileDrop(files) // call parent function
    }

    // link event to function
    window.addEventListener('dragenter', onDragEnter) //拖曳進入
    window.addEventListener('dragleave', onDragLeave) //拖曳離開
    window.addEventListener('dragover', onDragOver) //拖曳中
    window.addEventListener('drop', onDrop) //拖曳放下
    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [onFileDrop])

  if (!dragging) return null 

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(79,142,247,0.08)',
      border: '3px dashed var(--accent)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 12, pointerEvents: 'none',
      backdropFilter: 'blur(2px)'
    }}>
      <div style={{ fontSize: 48 }}>📂</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>拖放檔案至此</div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        支援 .ifc、.glb、.gltf、.json（專案檔）
      </div>
    </div>
  )
}
