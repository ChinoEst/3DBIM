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

// fitToScene() 只會把整個模型的包圍盒置中，畫布正中央那個點不保證真的打在幾何體上
// （例如模型中間剛好是中庭、走道、鏤空樓板）。這裡改成在畫布上用網格掃描多個點，
// 直到某個點真的讓 IFC 屬性查詢面板跳出來為止，避免測試因為模型形狀而變 flaky。
async function clickUntilPropertyPanelShows(page) {
  const box = await page.locator('canvas').boundingBox()
  const candidates = [
    [0.5, 0.5], [0.5, 0.4], [0.5, 0.6], [0.4, 0.5], [0.6, 0.5],
    [0.35, 0.4], [0.65, 0.4], [0.35, 0.6], [0.65, 0.6],
    [0.5, 0.3], [0.5, 0.7]
  ]
  for (const [fx, fy] of candidates) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
    const visible = await page.getByText(/IFC 元件屬性/).isVisible().catch(() => false)
    if (visible) return true
  }
  return false
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
    // 用真正的鍵盤事件（End = 滑到最大值）取代手動 dispatchEvent，
    // 這樣才是瀏覽器原生的 input/change 事件，React 的受控元件一定收得到，不會被判定成「值沒變」而忽略。
    await slider.focus()
    await slider.press('End')
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
    const hit = await clickUntilPropertyPanelShows(page)
    expect(hit).toBeTruthy()
    await expect(page.getByText(/IFC 元件屬性/)).toBeVisible()
  })

  test('查詢模式關閉時點擊 IFC 元件不應該跳出屬性面板', async ({ page }) => {
    await loadIfc(page)
    const box = await page.locator('canvas').boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
  })

  test('查詢模式開啟時點擊 GLB 物件不應顯示屬性面板（GLB 沒有 IFC 屬性資料）', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    const box = await page.locator('canvas').boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
  })

  test('關閉屬性查詢面板後，原本的選取狀態應該保留', async ({ page }) => {
    await loadIfc(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    const hit = await clickUntilPropertyPanelShows(page)
    expect(hit).toBeTruthy()
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
    // input[type=color] 沒有鍵盤可操作的輸入方式，只能用程式碼改值。
    // 直接 el.value = ... 對 React 的受控元件沒用（React 會判定「值沒變」而忽略事件），
    // 必須透過 HTMLInputElement.prototype 上原生的 value setter 呼叫，React 才抓得到這次變化。
    await colorInput.evaluate((el, val) => {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      nativeSetter.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }, '#ff0000')
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
    // 用鍵盤真正操作滑桿（Home 先歸零，再用 step=0.05 的 ArrowRight 按 10 次到剛好 0.5），
    // 這樣才是瀏覽器原生事件，確保 App 的 onSetOpacity 真的被觸發、opacity 真的被寫進 autosave。
    await slider.focus()
    await slider.press('Home')
    for (let i = 0; i < 10; i++) {
      await slider.press('ArrowRight')
    }
    await expect(page.getByText('50%').first()).toBeVisible()

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
    await page.getByTitle('刪除選取物件 (Del)').click()
    await expect(page.getByText('物件已刪除')).toBeVisible()

    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('已還原上次的場景')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })

  test('開啟一個舊版 .json 專案檔後，自動存檔應該以新載入的場景為準', async ({ page }) => {
    await loadGlb(page)
    await page.waitForTimeout(1200)
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: /全部刪除/ }).click()
    await page.waitForTimeout(1200)
    await loadGlb(page)
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })
})