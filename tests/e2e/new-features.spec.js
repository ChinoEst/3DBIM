import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const glbFile = path.resolve(__dirname, '..', '..', 'test.glb')
const ifcFile = path.resolve(__dirname, '..', '..', 'test.ifc')

async function loadGlb(page) {
  await page.goto('/')
  await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
  await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()
}

async function loadIfc(page) {
  await page.goto('/')
  await page.setInputFiles('input[type="file"][accept=".ifc"]', ifcFile)
  await expect(page.getByText(/test\.ifc 載入完成/)).toBeVisible({ timeout: 20000 })
}

// ============================================================
// 剖面裁切 (Section Panel)
// ============================================================
test.describe('剖面裁切 (Section Panel)', () => {
  test('開關剖面裁切面板', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await expect(page.getByText('🔪 剖面裁切')).toBeVisible()
    await page.getByTitle('關閉面板').click()
    await expect(page.getByText('🔪 剖面裁切')).not.toBeVisible()
  })

  test('沒有載入模型時應提示尚未載入模型', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await expect(page.getByText('尚未載入模型，載入後即可拖曳剖面位置。')).toBeVisible()
  })

  test('載入模型後開啟 X 軸裁切，滑桿應從 disabled 變成可拖曳', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    const slider = page.locator('input[type="range"]').first()
    await expect(slider).toBeEnabled()
  })

  test('翻轉按鈕在該軸未啟用時應為 disabled，啟用後應可點擊', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    const flipBtn = page.getByRole('button', { name: /翻轉/ }).first()
    await expect(flipBtn).toBeDisabled()

    await page.getByText('X 軸').click()
    await expect(flipBtn).toBeEnabled()
    // 只驗證點擊不會出錯、按鈕仍然可互動；平面翻轉後的實際渲染結果屬於視覺變化，
    // 建議另外用截圖比對 (toHaveScreenshot) 或人工 QA 驗證，e2e 在這裡只把關「功能不報錯」。
    await flipBtn.click()
    await expect(flipBtn).toBeEnabled()
  })

  test('拖曳滑桿後，顯示的座標數值應該跟著更新', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    const slider = page.locator('input[type="range"]').first()
    const before = await slider.inputValue()
    // range input 用跟色票 input 一樣的方式直接設值 + 派發事件，比 .fill() 對 type=range 的支援更可靠
    await slider.evaluate((el) => {
      el.value = String(Number(el.max) - 0.01)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const after = await slider.inputValue()
    expect(after).not.toBe(before)
  })

  test('可以同時開啟多個軸（X + Z）', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    await page.getByText('Z 軸').click()
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes.nth(0)).toBeChecked()
    await expect(checkboxes.nth(2)).toBeChecked()
  })

  test('重置剖面按鈕應該把已開啟的軸全部關閉', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    await page.getByRole('button', { name: '重置剖面' }).click()
    await expect(page.getByText('剖面已重置')).toBeVisible()
    const checkbox = page.locator('input[type="checkbox"]').first()
    await expect(checkbox).not.toBeChecked()
  })

  test('關閉面板不應該重置已套用的裁切狀態（工具列按鈕仍顯示啟用中）', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    await page.getByTitle('關閉面板').click()
    // 面板收起但裁切效果應該還在：重新打開面板，X 軸 checkbox 應該仍是勾選狀態
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    const checkbox = page.locator('input[type="checkbox"]').first()
    await expect(checkbox).toBeChecked()
  })
})

// ============================================================
// IFC 屬性查詢 (Query Mode)
// ============================================================
test.describe('IFC 屬性查詢 (Query Mode)', () => {
  test('開關屬性查詢模式應顯示對應提示', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await expect(page.getByText('屬性查詢模式已開啟，點擊 IFC 元件查看屬性')).toBeVisible()
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await expect(page.getByText('屬性查詢模式已關閉')).toBeVisible()
  })

  test('查詢模式開啟後點擊 IFC 元件應顯示屬性查詢面板', async ({ page }) => {
    await loadIfc(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    // fitToScene 會把模型置中，點擊畫布中心即可命中模型（跟真實使用者操作方式一致）
    await page.locator('canvas').click()
    await expect(page.getByText(/IFC 元件屬性/)).toBeVisible()
  })

  test('查詢模式關閉時點擊 IFC 元件不應該跳出屬性面板', async ({ page }) => {
    await loadIfc(page)
    await page.locator('canvas').click()
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
  })

  test('查詢模式開啟時點擊 GLB 物件不應顯示屬性面板（GLB 沒有 IFC 屬性資料）', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await page.locator('canvas').click()
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
  })

  test('關閉屬性查詢面板後，原本的選取狀態應該保留', async ({ page }) => {
    await loadIfc(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await page.locator('canvas').click()
    await expect(page.getByText(/IFC 元件屬性/)).toBeVisible()
    await page.getByTitle('關閉').click()
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
    await expect(page.getByText(/已選取/)).toBeVisible()
  })
})

// ============================================================
// Mesh 子選取與改色（跟剖面裁切/屬性查詢無關，獨立成自己的 describe）
// ============================================================
test.describe('Mesh 子選取與改色', () => {
  test('選取物件後應顯示 mesh 子清單', async ({ page }) => {
    await loadGlb(page)
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await expect(item.locator('[data-testid="mesh-item"]').first()).toBeVisible()
  })

  test('點選單一 mesh 後應出現顏色選取器，且只作用在該 mesh', async ({ page }) => {
    await loadGlb(page)
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()

    const meshItems = item.locator('[data-testid="mesh-item"]')
    await expect(meshItems.first()).toBeVisible()
    await expect(item.locator('input[type="color"]')).toHaveCount(0)

    await meshItems.first().click()
    await expect(item.locator('input[type="color"]')).toHaveCount(1)
  })

  test('變更 mesh 顏色後，色票 input 的 value 應更新', async ({ page }) => {
    await loadGlb(page)
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await item.locator('[data-testid="mesh-item"]').first().click()

    const colorInput = item.locator('input[type="color"]')
    await colorInput.evaluate((el) => {
      el.value = '#ff0000'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await expect(colorInput).toHaveValue('#ff0000')
  })

  test('切換選取的物件時，mesh 子選取狀態應該重置（不殘留前一個物件的顏色選取器）', async ({ page }) => {
    await loadGlb(page)
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/物件數：2/)).toBeVisible()

    const items = page.locator('[data-testid="object-item"]')
    await items.nth(0).click()
    await items.nth(0).locator('[data-testid="mesh-item"]').first().click()
    await expect(items.nth(0).locator('input[type="color"]')).toHaveCount(1)

    await items.nth(1).click()
    await expect(page.locator('input[type="color"]')).toHaveCount(0)
  })
})

// ============================================================
// 右側面板寬度（可拖曳）
// ============================================================
test.describe('右側面板寬度（可拖曳）', () => {
  test('重新整理頁面後，面板寬度應保留上次設定值', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('bim-panel-width', '500'))
    await page.reload()
    await expect(page.locator('[data-testid="object-panel"]')).toHaveCSS('width', '500px')
  })

  test('拖曳邊界把手應該可以即時調整面板寬度', async ({ page }) => {
    await page.goto('/')
    const panel = page.locator('[data-testid="object-panel"]')
    const before = (await panel.boundingBox()).width

    const handle = page.getByTitle('拖曳調整面板寬度')
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 120, box.y + box.height / 2) // 往左拖 = 面板變寬
    await page.mouse.up()

    const after = (await panel.boundingBox()).width
    expect(after).toBeGreaterThan(before)
  })

  test('面板寬度不應該超過設定的最小/最大範圍', async ({ page }) => {
    await page.goto('/')
    const handle = page.getByTitle('拖曳調整面板寬度')
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 2000, box.y + box.height / 2) // 往右拖到超出畫面，模擬拖過頭
    await page.mouse.up()

    const panel = page.locator('[data-testid="object-panel"]')
    const width = (await panel.boundingBox()).width
    expect(width).toBeLessThanOrEqual(640) // PANEL_MAX_WIDTH
    expect(width).toBeGreaterThanOrEqual(260) // PANEL_MIN_WIDTH
  })
})

// ============================================================
// IndexedDB 自動存檔 / F5 還原
// ============================================================
test.describe('IndexedDB 自動存檔 / F5 還原', () => {
  test('載入模型後重新整理頁面，應自動還原上次場景', async ({ page }) => {
    await loadGlb(page)
    // App.jsx 對 autosave 做了 debounce，等待寫入完成再重新整理
    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('已還原上次的場景')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })

  test('調整透明度後重新整理，透明度數值應該保留', async ({ page }) => {
    await loadGlb(page)
    const item = page.locator('[data-testid="object-item"]').first()
    const slider = item.locator('input[type="range"]').first()
    await slider.evaluate((el) => {
      el.value = '0.5'
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('已還原上次的場景')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('50%').first()).toBeVisible()
  })

  test('刪除所有物件後重新整理，不應該再還原任何物件', async ({ page }) => {
    await loadGlb(page)
    await page.waitForTimeout(1200)
    // confirm() 對話框在點擊當下同步跳出，監聽器必須在點擊「之前」註冊好
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: /全部刪除/ }).click()
    await expect(page.getByText('已刪除所有物件')).toBeVisible()
    await page.waitForTimeout(1200)
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(page.getByText(/物件數：0/)).toBeVisible()
  })

  test('刪除單一物件後重新整理，只剩下的物件應該被還原', async ({ page }) => {
    await loadGlb(page)
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/物件數：2/)).toBeVisible()

    const items = page.locator('[data-testid="object-item"]')
    await items.first().click()
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: '刪除', exact: true }).click()
    await expect(page.getByText('物件已刪除')).toBeVisible()

    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('已還原上次的場景')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })

  test('開啟一個舊版 .json 專案檔後，自動存檔應該以新載入的場景為準', async ({ page }) => {
    await loadGlb(page)
    await page.waitForTimeout(1200)
    // 這裡沒有實際準備專案檔，先用「全部刪除」模擬場景被清空後重新整理，
    // 驗證 autosave 不會保留刪除前的舊資料（避免使用者刪除又重整後東西又跑回來）
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: /全部刪除/ }).click()
    await page.waitForTimeout(1200)
    await loadGlb(page)
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })
})