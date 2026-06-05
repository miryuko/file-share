import { test, expect } from '@playwright/test'

test.describe('接收文件页面', () => {
  test('应显示页面标题和输入区域', async ({ page }) => {
    await page.goto('/receive')

    await expect(page.locator('h1')).toHaveText('接收')

    // 文件/文本 tab
    await expect(page.locator('.tab-btn').first()).toHaveText('文件')
    await expect(page.locator('.tab-btn').last()).toHaveText('文本')

    // 输入框
    const input = page.locator('.code-input')
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('maxlength', '6')
    await expect(input).toHaveAttribute('placeholder', '输入 6 位分享码')

    // 接收按钮
    await expect(page.locator('.btn-receive')).toBeVisible()
    await expect(page.locator('.btn-receive')).toBeDisabled()
  })

  test('输入 5 位码时接收按钮仍应禁用', async ({ page }) => {
    await page.goto('/receive')

    const input = page.locator('.code-input')
    await input.fill('A3K9M')
    await expect(page.locator('.btn-receive')).toBeDisabled()
  })

  test('输入 6 位码时接收按钮应启用', async ({ page }) => {
    await page.goto('/receive')

    const input = page.locator('.code-input')
    await input.fill('A3K9M2')
    await expect(page.locator('.btn-receive')).toBeEnabled()
  })

  test('切换模式 tab 应正常切换', async ({ page }) => {
    await page.goto('/receive')

    // 默认文件模式
    await expect(page.locator('.tab-btn').first()).toHaveClass(/active/)

    // 切换到文本模式
    await page.locator('.tab-btn', { hasText: '文本' }).click()
    await expect(page.locator('.tab-btn').last()).toHaveClass(/active/)
  })
})
