import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { computeClipPlane, computeDisplayOpacity } from '../src/utils/sceneLogic.js'
import { flattenItemData } from '../src/components/IfcPropertyPanel.jsx'
import { getRange } from '../src/components/SectionPanel.jsx'
import { saveAutosave, loadAutosave, clearAutosave } from '../src/utils/db.js'

// ============================================================
// 剖面裁切 (Section clipping)：computeClipPlane
// ============================================================
describe('剖面裁切: computeClipPlane', () => {
  const xAxis = { x: 1, y: 0, z: 0 }

  it('未翻轉時，normal 應該反向，constant 等於 position（保留座標較小的一側）', () => {
    const { normal, constant } = computeClipPlane(xAxis, 5, false)
    expect(normal).toEqual({ x: -1, y: 0, z: 0 })
    expect(constant).toBe(5)
  })

  it('翻轉時，normal 應維持原方向，constant 應為 -position（保留座標較大的一側）', () => {
    const { normal, constant } = computeClipPlane(xAxis, 5, true)
    expect(normal).toEqual({ x: 1, y: 0, z: 0 })
    expect(constant).toBe(-5)
  })

  it('position 為 null/undefined 時應視為 0', () => {
    const { constant } = computeClipPlane(xAxis, null, false)
    expect(constant).toBe(0)
  })

  it('不同軸的 normal 應該正確反映輸入的 axisNormal', () => {
    const yAxis = { x: 0, y: 1, z: 0 }
    const { normal } = computeClipPlane(yAxis, 2, false)
    expect(normal).toEqual({ x: 0, y: -1, z: 0 })
  })
})

// ============================================================
// 選取變淡: computeDisplayOpacity
// ============================================================
describe('選取變淡: computeDisplayOpacity', () => {
  it('沒有任何物件被選取時，回傳原始 opacity', () => {
    expect(computeDisplayOpacity(0.8, false, false, 0.4)).toBe(0.8)
  })

  it('自己就是被選取的物件時，回傳原始 opacity（不變淡）', () => {
    expect(computeDisplayOpacity(0.8, true, true, 0.4)).toBe(0.8)
  })

  it('有其他物件被選取、自己未被選取時，opacity 應乘上 dimFactor', () => {
    expect(computeDisplayOpacity(0.8, false, true, 0.4)).toBeCloseTo(0.32)
  })

  it('dimFactor 為 0 時，未選取物件應完全變透明（opacity 0）', () => {
    expect(computeDisplayOpacity(1, false, true, 0)).toBe(0)
  })
})

// ============================================================
// IFC 屬性面板: flattenItemData
// ============================================================
describe('IFC 屬性查詢: flattenItemData', () => {
  it('null 或非物件輸入應回傳空陣列，不應該丟出例外', () => {
    expect(flattenItemData(null)).toEqual({ attributes: [], psets: [] })
    expect(flattenItemData(undefined)).toEqual({ attributes: [], psets: [] })
    expect(flattenItemData('not an object')).toEqual({ attributes: [], psets: [] })
  })

  it('應該解析出基本屬性（value 物件與純值都要支援）', () => {
    const data = {
      Name: { value: 'Wall-01', type: 'IfcLabel' },
      GlobalId: 'abc-123'
    }
    const { attributes } = flattenItemData(data)
    expect(attributes).toContainEqual({ key: 'Name', value: 'Wall-01' })
    expect(attributes).toContainEqual({ key: 'GlobalId', value: 'abc-123' })
  })

  it('底線開頭的欄位（例如 _category）應被忽略', () => {
    const data = { _category: 'internal', Name: { value: 'X' } }
    const { attributes } = flattenItemData(data)
    expect(attributes.find(a => a.key === '_category')).toBeUndefined()
  })

  it('應該正確解析 IsDefinedBy 底下的 Pset 與屬性', () => {
    const data = {
      IsDefinedBy: [
        {
          Name: { value: 'Pset_WallCommon' },
          HasProperties: [
            { Name: { value: 'FireRating' }, NominalValue: { value: '2HR' } },
            { Name: { value: 'IsExternal' }, NominalValue: { value: true } }
          ]
        }
      ]
    }
    const { psets } = flattenItemData(data)
    expect(psets).toHaveLength(1)
    expect(psets[0].name).toBe('Pset_WallCommon')
    expect(psets[0].props).toContainEqual({ name: 'FireRating', value: '2HR' })
    expect(psets[0].props).toContainEqual({ name: 'IsExternal', value: 'true' })
  })

  it('沒有名稱的 Pset 應顯示為「(未命名屬性組)」', () => {
    const data = { IsDefinedBy: [{ HasProperties: [] }] }
    const { psets } = flattenItemData(data)
    expect(psets[0].name).toBe('(未命名屬性組)')
  })

  it('HasProperties 缺失或格式錯誤時，props 應為空陣列而不是丟出例外', () => {
    const data = { IsDefinedBy: [{ Name: { value: 'Pset_X' }, HasProperties: null }] }
    const { psets } = flattenItemData(data)
    expect(psets[0].props).toEqual([])
  })
})

// ============================================================
// 剖面滑桿範圍: getRange
// ============================================================
describe('剖面裁切面板: getRange', () => {
  it('沒有場景包圍盒時，應以目前 position 為中心給一個安全的預設範圍', () => {
    const range = getRange(null, 'x', 3)
    expect(range.min).toBe(-7)
    expect(range.max).toBe(13)
  })

  it('有包圍盒時，應該依包圍盒範圍加上邊界 margin', () => {
    const bounds = { min: [0, 0, 0], max: [10, 20, 30] }
    const range = getRange(bounds, 'x', 5)
    const span = 10
    const margin = span * 0.15
    expect(range.min).toBeCloseTo(0 - margin)
    expect(range.max).toBeCloseTo(10 + margin)
  })

  it('包圍盒在該軸上沒有厚度（min === max）時，不應該產生 0 或負的 step', () => {
    const bounds = { min: [5, 0, 0], max: [5, 20, 30] }
    const range = getRange(bounds, 'x', 5)
    expect(range.step).toBeGreaterThan(0)
  })

  it('沒有包圍盒且 position 為 null/undefined 時，應退回以 0 為中心的預設範圍', () => {
    const range = getRange(null, 'x', null)
    expect(range.min).toBe(-10)
    expect(range.max).toBe(10)
  })

  it('Y 軸應該讀取包圍盒的第 2 個維度（index 1），不能跟 X/Z 混淆', () => {
    const bounds = { min: [0, 100, 0], max: [10, 120, 30] }
    const range = getRange(bounds, 'y', 110)
    const span = 20
    const margin = span * 0.15
    expect(range.min).toBeCloseTo(100 - margin)
    expect(range.max).toBeCloseTo(120 + margin)
  })

  it('Z 軸應該讀取包圍盒的第 3 個維度（index 2），不能跟 X/Y 混淆', () => {
    const bounds = { min: [0, 0, -5], max: [10, 20, 55] }
    const range = getRange(bounds, 'z', 0)
    const span = 60
    const margin = span * 0.15
    expect(range.min).toBeCloseTo(-5 - margin)
    expect(range.max).toBeCloseTo(55 + margin)
  })
})

// ============================================================
// IndexedDB 自動存檔: saveAutosave / loadAutosave / clearAutosave
// ============================================================
describe('IndexedDB 自動存檔 (db.js)', () => {
  beforeEach(async () => {
    await clearAutosave()
  })

  it('尚未存過檔時，loadAutosave 應回傳 null', async () => {
    const result = await loadAutosave()
    expect(result).toBeNull()
  })

  it('save 後 load 應該拿回一樣的資料', async () => {
    const data = { version: 2, objects: [{ id: 'glb_1', type: 'glb', name: 'a.glb' }] }
    await saveAutosave(data)
    const result = await loadAutosave()
    expect(result).toEqual(data)
  })

  it('save 兩次應該覆蓋掉前一次的資料（不是累加）', async () => {
    await saveAutosave({ version: 2, objects: [{ id: 'a' }] })
    await saveAutosave({ version: 2, objects: [{ id: 'b' }] })
    const result = await loadAutosave()
    expect(result.objects).toEqual([{ id: 'b' }])
  })

  it('clearAutosave 後 loadAutosave 應該回到 null', async () => {
    await saveAutosave({ version: 2, objects: [] })
    await clearAutosave()
    const result = await loadAutosave()
    expect(result).toBeNull()
  })
})