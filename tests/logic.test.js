import { describe, it, expect, vi } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { arrayBufferToBase64, base64ToArrayBuffer, pickClosest, removeObject } from '../src/utils/sceneLogic.js'

//base64 round-trip corrupted saved IFC/GLB data.
// Verifies encode -> decode returns identical bytes (incl. empty buffer).
describe('Issue #10: base64 round-trip', () => {
  it('編碼再解碼後資料不應該改變', () => {
    const original = new Uint8Array([0, 1, 128, 255, 64]).buffer
    const restored = base64ToArrayBuffer(arrayBufferToBase64(original))
    expect(new Uint8Array(restored)).toEqual(new Uint8Array(original))
  })

  it('空資料也應該正常處理', () => {
    const original = new Uint8Array([]).buffer
    const restored = base64ToArrayBuffer(arrayBufferToBase64(original))
    expect(new Uint8Array(restored)).toEqual(new Uint8Array(original))
  })
})

// Additional tests for pickClosest and removeObject functions
describe('Issue #5: IFC/GLB 重疊選取', () => {
  it('IFC 比較近時應選 IFC', () => {
    expect(pickClosest({ id: 'ifc_1', distance: 5 }, { id: 'glb_1', distance: 10 })).toBe('ifc_1')
  })

  it('GLB 比較近時應選 GLB（舊 bug：IFC 有結果就直接 return）', () => {
    expect(pickClosest({ id: 'ifc_1', distance: 10 }, { id: 'glb_1', distance: 5 })).toBe('glb_1')
  })

  it('只有 IFC 有結果時選 IFC', () => {
    expect(pickClosest({ id: 'ifc_1', distance: 5 }, null)).toBe('ifc_1')
  })

  it('都沒有結果時回傳 null', () => {
    expect(pickClosest(null, null)).toBeNull()
  })
})

// Additional tests for removeObject function
describe('Issue #9: IFC 刪除邏輯', () => {
  it('IFC 物件應呼叫 disposeModel，不能呼叫 scene.remove', () => {
    const frags = { disposeModel: vi.fn() }
    const scene = { remove: vi.fn() }
    const obj = { type: 'ifc', model: { modelId: 'test.ifc' }, mesh: {} }

    removeObject(obj, scene, frags)

    expect(frags.disposeModel).toHaveBeenCalledWith('test.ifc')
    expect(scene.remove).not.toHaveBeenCalled()
  })

  it('GLB 物件應呼叫 scene.remove，不能呼叫 disposeModel', () => {
    const frags = { disposeModel: vi.fn() }
    const scene = { remove: vi.fn() }
    const obj = { type: 'glb', mesh: {} }

    removeObject(obj, scene, frags)

    expect(scene.remove).toHaveBeenCalledWith(obj.mesh)
    expect(frags.disposeModel).not.toHaveBeenCalled()
  })
})


// Additional test to ensure worker.mjs exists in public directory
describe('Issue #2: public/worker.mjs 必須存在', () => {
  it('worker.mjs 應該在 public/ 目錄下', () => {
    const workerPath = resolve(process.cwd(), 'public/worker.mjs')
    expect(existsSync(workerPath)).toBe(true)
  })
})


// Additional tests for edge cases
describe('Additional logic edge cases', () => {
   
  it('pickClosest prefers IFC when distances are equal', () => {
    expect(pickClosest({ id: 'ifc', distance: 5 }, { id: 'glb', distance: 5 })).toBe('ifc')
  })

  it('removeObject treats ifc without model as non-ifc and calls scene.remove', () => {
    const frags = { disposeModel: vi.fn() }
    const scene = { remove: vi.fn() }
    const obj = { type: 'ifc', model: null, mesh: {} }

    removeObject(obj, scene, frags)

    expect(scene.remove).toHaveBeenCalledWith(obj.mesh)
    expect(frags.disposeModel).not.toHaveBeenCalled()
  })

  it('arrayBuffer/base64 round-trip works for odd-length buffers', () => {
    const original = new Uint8Array([10, 20, 30]).buffer
    const restored = base64ToArrayBuffer(arrayBufferToBase64(original))
    expect(new Uint8Array(restored)).toEqual(new Uint8Array(original))
  })
})