import { test, expect } from '@playwright/test'

test.describe('发送文件页面', () => {
  test('应显示页面标题和上传区域', async ({ page }) => {
    await page.goto('/')

    // 标题和描述
    await expect(page.locator('h1')).toHaveText('File Share')
    await expect(page.locator('.subtitle')).toContainText('安全、匿名、即时的文件传输')

    // 文件/文本 tab
    await expect(page.locator('.tab-btn').first()).toHaveText('文件')
    await expect(page.locator('.tab-btn').last()).toHaveText('文本')

    // 上传区域应可见
    await expect(page.locator('.drop-zone')).toBeVisible()
    await expect(page.locator('.drop-text')).toContainText('点击选择文件或拖拽到此处')
  })

  test('切换到文本模式应显示文本输入区域', async ({ page }) => {
    await page.goto('/')

    // 点击文本 tab
    await page.locator('.tab-btn', { hasText: '文本' }).click()

    // 文本输入区域应可见
    await expect(page.locator('.text-input')).toBeVisible()
    await expect(page.locator('.btn-send-text')).toBeVisible()
  })

  test('导航栏切换应正常工作', async ({ page }) => {
    await page.goto('/')

    // 点击接收链接
    await page.click('a[href="/receive"]')
    await expect(page.locator('h1')).toHaveText('接收')

    // 点击发送链接返回
    await page.click('a[href="/"]')
    await expect(page.locator('h1')).toHaveText('File Share')
  })
})
