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
  await expect(page.getByText(/test\.ifc 載入完成/), { timeout: 20000 }).toBeVisible()
}

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

  test('載入模型後開啟 X 軸裁切，工具列按鈕應顯示啟用狀態', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    // 開啟後，滑桿應該從 disabled 變成可以拖曳
    const slider = page.locator('input[type="range"]').last()
    await expect(slider).toBeEnabled()
  })

  test('拖曳裁切滑桿應更新顯示的位置數值', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    const slider = page.locator('input[type="range"]').last()
    await slider.fill('1')
    await expect(page.locator('text=1.00')).toBeVisible()
  })

  test('翻轉按鈕在該軸未啟用時應為 disabled', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    const flipBtn = page.getByRole('button', { name: /翻轉/ }).first()
    await expect(flipBtn).toBeDisabled()
  })

  test('重置剖面按鈕應該把已開啟的軸關閉', async ({ page }) => {
    await loadGlb(page)
    await page.getByRole('button', { name: /剖面裁切/ }).click()
    await page.getByText('X 軸').click()
    await page.getByRole('button', { name: '重置剖面' }).click()
    await expect(page.getByText('剖面已重置')).toBeVisible()
    const checkbox = page.locator('input[type="checkbox"]').first()
    await expect(checkbox).not.toBeChecked()
  })
})

test.describe('IFC 屬性查詢 (Query Mode)', () => {
  test('開關屬性查詢模式應顯示對應提示', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await expect(page.getByText('屬性查詢模式已開啟，點擊 IFC 元件查看屬性')).toBeVisible()
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    await expect(page.getByText('屬性查詢模式已關閉')).toBeVisible()
  })

  test('查詢模式開啟後點擊 IFC 元件應顯示屬性面板', async ({ page }) => {
    await loadIfc(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()

    const canvas = await page.waitForSelector('canvas')
    const box = await canvas.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)

    await expect(page.getByText(/IFC 元件屬性/)).toBeVisible({ timeout: 10000 })
  })

  test('關閉屬性面板後應該消失', async ({ page }) => {
    await loadIfc(page)
    await page.getByRole('button', { name: /屬性查詢/ }).click()
    const canvas = await page.waitForSelector('canvas')
    const box = await canvas.boundingBox()
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.getByText(/IFC 元件屬性/)).toBeVisible({ timeout: 10000 })

    await page.getByTitle('關閉', { exact: true }).click()
    await expect(page.getByText(/IFC 元件屬性/)).not.toBeVisible()
  })
})

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
    // 選取前，任何 mesh 都不應該顯示顏色選取器
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

test.describe('物件面板寬度調整與持久化', () => {
  test('拖曳面板左側把手應該改變面板寬度', async ({ page }) => {
    await page.goto('/')
    const handle = page.locator('[title="拖曳調整面板寬度"]')
    const box = await handle.boundingBox()
    const initialWidth = await page.evaluate(() => localStorage.getItem('bim-panel-width'))

    await page.mouse.move(box.x + box.width / 2, box.y + 50)
    await page.mouse.down()
    await page.mouse.move(box.x - 100, box.y + 50, { steps: 5 })
    await page.mouse.up()

    const newWidth = await page.evaluate(() => localStorage.getItem('bim-panel-width'))
    expect(newWidth).not.toBe(initialWidth)
  })

  test('重新整理頁面後，面板寬度應保留上次設定值', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.setItem('bim-panel-width', '500'))
    await page.reload()
    await expect(page.locator('[data-testid="object-panel"]')).toHaveCSS('width', '500px')
  })
})

test.describe('IndexedDB 自動存檔 / F5 還原', () => {
  test('載入模型後重新整理頁面，應自動還原上次場景', async ({ page }) => {
    await loadGlb(page)
    // App.jsx 對 autosave 做了 800ms debounce，等待寫入完成再重新整理
    await page.waitForTimeout(1200)
    await page.reload()
    await expect(page.getByText('已還原上次的場景')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })

  test('刪除所有物件後重新整理，不應該再還原任何物件', async ({ page }) => {
    await loadGlb(page)
    await page.waitForTimeout(1200)
    // confirm() 對話框會在點擊當下同步跳出，監聽器必須在點擊「之前」註冊好
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: /全部刪除/ }).click()
    await expect(page.getByText('已刪除所有物件')).toBeVisible()
    await page.waitForTimeout(1200)
    await page.reload()
    await page.waitForTimeout(1000)
    await expect(page.getByText(/物件數：0/)).toBeVisible()
  })
})
