import { test, expect } from '@playwright/test'

test.describe('管理面板', () => {
  test('应显示登录表单', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.locator('h1')).toHaveText('管理面板')

    // 登录表单
    await expect(page.locator('.password-input')).toBeVisible()
    await expect(page.locator('.password-input')).toHaveAttribute('type', 'password')
    await expect(page.locator('.btn-login')).toBeVisible()
  })

  test('密码为空时登录按钮应禁用', async ({ page }) => {
    await page.goto('/admin')

    await expect(page.locator('.btn-login')).toBeDisabled()
  })

  test('输入密码后登录按钮应启用', async ({ page }) => {
    await page.goto('/admin')

    await page.locator('.password-input').fill('admin123')
    await expect(page.locator('.btn-login')).toBeEnabled()
  })
})
