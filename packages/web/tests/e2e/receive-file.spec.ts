import { test, expect } from '@playwright/test'

test.describe('接收页面', () => {
  test('应显示页面标题和输入区域', async ({ page }) => {
    await page.goto('/receive')

    await expect(page.locator('h1')).toHaveText('接收')

    // 输入框（不应再有文件/文本 tab 切换）
    const input = page.locator('input[maxlength="6"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('maxlength', '6')
    await expect(input).toHaveAttribute('placeholder', '输入 6 位分享码')

    // 接收按钮
    const button = page.locator('button')
    await expect(button.first()).toBeVisible()
  })

  test('输入 5 位码时接收按钮仍应禁用', async ({ page }) => {
    await page.goto('/receive')

    const input = page.locator('input[maxlength="6"]')
    await input.fill('A3K9M')

    const receiveButton = page.getByRole('button', { name: '接收' })
    await expect(receiveButton).toBeDisabled()
  })

  test('输入 6 位码时接收按钮应启用', async ({ page }) => {
    await page.goto('/receive')

    const input = page.locator('input[maxlength="6"]')
    await input.fill('A3K9M2')

    const receiveButton = page.getByRole('button', { name: '接收' })
    await expect(receiveButton).toBeEnabled()
  })
})
