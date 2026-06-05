import { test, expect } from '@playwright/test'

test('visits the app root url', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('h1')).toHaveText('File Share')
})

test('navigates to receive page', async ({ page }) => {
  await page.goto('/')
  await page.click('a[href="/receive"]')
  await expect(page.locator('h1')).toHaveText('接收文件')
})
