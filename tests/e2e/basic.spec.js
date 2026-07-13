import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const glbFile = path.resolve(__dirname, '..', '..', 'test.glb')
const ifcFile = path.resolve(__dirname, '..', '..', 'test.ifc')
const projectFile = path.resolve(__dirname, '..', '..', 'test.json')

async function dragCanvas(page, offsetX, offsetY) {
  const canvas = await page.waitForSelector('canvas', { timeout: 10000 })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('Canvas not found')
  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + offsetX, startY + offsetY, { steps: 10 })
  await page.mouse.up()
}

test.describe('BIM Viewer UI', () => {
  test('page loads and canvas exists', async ({ page }) => {
    //goto http://localhost:5173/
    await page.goto('/')
    //open
    await expect(page).toHaveTitle(/BIM Viewer/)
    //wait for <canvas> appear
    const canvas = await page.waitForSelector('canvas', { timeout: 10000 })
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    expect(box.width).toBeGreaterThan(0)
  })

  test('toolbar buttons render correctly', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /開啟 IFC/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /加入 GLB/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /位移 Z/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /旋轉 X/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /縮放 C/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /儲存/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /開啟專案/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /重置視角/ })).toBeVisible()
  })

  test('initial status bar and hidden file inputs exist', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('點擊場景中的物件以選取')).toBeVisible()
    await expect(page.getByText(/物件數：0/)).toBeVisible()
    await expect(page.getByText(/模式：位移/)).toBeVisible()
    const ifcInput = page.locator('input[type="file"][accept=".ifc"]')
    const glbInput = page.locator('input[type="file"][accept=".glb,.gltf"]')
    const projectInput = page.locator('input[type="file"][accept=".json"]')
    await expect(ifcInput).toHaveCount(1)
    await expect(glbInput).toHaveCount(1)
    await expect(projectInput).toHaveCount(1)
  })

  test('transform mode buttons update status text', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /旋轉 X/ }).click()
    await expect(page.getByText(/模式：旋轉/)).toBeVisible()
    await page.getByRole('button', { name: /縮放 C/ }).click()
    await expect(page.getByText(/模式：縮放/)).toBeVisible()
    await page.getByRole('button', { name: /位移 Z/ }).click()
    await expect(page.getByText(/模式：位移/)).toBeVisible()
  })

  test('fit view button is clickable after load', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /重置視角/ }).click()
    await expect(page.getByText(/模式：/)).toBeVisible()
  })

  test('load GLB file updates object count and shows toast', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()
    await expect(page.getByText(/物件數：1/)).toBeVisible()
  })

  test('toggle visibility through panel item', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()
    await expect(page.getByText(/物件數：1/)).toBeVisible()

    const item = page.locator('[data-testid="object-item"]', { has: page.locator('span[title="test.glb"]') }).first()
    await item.scrollIntoViewIfNeeded()
    const toggleButton = item.locator('span[title="隱藏"]').first()
    await toggleButton.click()
    await expect(item.locator('span[title="顯示"]')).toBeVisible()
  })

  test('rename object through panel item', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()

    const item = page.locator('[data-testid="object-item"]', { has: page.locator('span[title="test.glb"]') }).first()
    await item.scrollIntoViewIfNeeded()
    await item.locator('span[title="編輯名稱"]').first().click()
    const input = page.locator('input[type="text"]').first()
    await input.fill('renamed.glb')
    await input.press('Enter')

    await expect(page.locator('[data-testid="object-item"]', { has: page.locator('span[title="renamed.glb"]') }).first()).toBeVisible()
  })

  test('adjust opacity slider on panel item', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()

    const item = page.locator('div', { has: page.locator('span[title="test.glb"]') }).first()
    await item.scrollIntoViewIfNeeded()
    const slider = item.locator('input[type="range"]').first()
    await slider.fill('0.5')
    await expect(item.getByText('50%')).toBeVisible()
  })

  test('save button triggers save toast', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /儲存/ }).click()
    await expect(page.getByText('專案已儲存')).toBeVisible()
  })

  test('Ctrl+S triggers save toast after GLB load and object selection', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".glb,.gltf"]', glbFile)
    await expect(page.getByText(/test\.glb 加入場景/)).toBeVisible()
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await page.focus('body')
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyS')
    await page.keyboard.up('Control')
    await expect(page.getByText('專案已儲存')).toBeVisible()
  })

  test('load IFC file and show object count', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".ifc"]', ifcFile)
    await expect(page.getByText(/test\.ifc 載入完成/), { timeout: 20000 }).toBeVisible()
    await expect(page.getByText(/物件數：1/), { timeout: 20000 }).toBeVisible()
    const item = page.locator('[data-testid="object-item"]').first()
    await expect(item).toBeVisible()
  })

  test('load IFC then translate object', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".ifc"]', ifcFile)
    await expect(page.getByText(/test\.ifc 載入完成/), { timeout: 20000 }).toBeVisible()
    await expect(page.getByText(/物件數：1/), { timeout: 20000 }).toBeVisible()

    await page.getByRole('button', { name: /位移 Z/ }).click()
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await dragCanvas(page, 40, 0)
    await expect(page.getByText(/模式：位移/)).toBeVisible()
  })

  test('load IFC then rotate object', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".ifc"]', ifcFile)
    await expect(page.getByText(/test\.ifc 載入完成/), { timeout: 20000 }).toBeVisible()
    await expect(page.getByText(/物件數：1/), { timeout: 20000 }).toBeVisible()

    await page.getByRole('button', { name: /旋轉 X/ }).click()
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await dragCanvas(page, 0, 40)
    await expect(page.getByText(/模式：旋轉/)).toBeVisible()
  })

  test('load IFC then scale object', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".ifc"]', ifcFile)
    await expect(page.getByText(/test\.ifc 載入完成/), { timeout: 20000 }).toBeVisible()
    await expect(page.getByText(/物件數：1/), { timeout: 20000 }).toBeVisible()

    await page.getByRole('button', { name: /縮放 C/ }).click()
    const item = page.locator('[data-testid="object-item"]').first()
    await item.click()
    await dragCanvas(page, 20, 20)
    await expect(page.getByText(/模式：縮放/)).toBeVisible()
  })

  test('load project file via 開啟專案', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[type="file"][accept=".json"]', projectFile)
    await expect(page.getByText(/專案還原完成/), { timeout: 20000 }).toBeVisible()
    await expect(page.getByText(/物件數：2/), { timeout: 20000 }).toBeVisible()
  })
})