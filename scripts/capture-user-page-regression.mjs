import path from 'node:path'
import process from 'node:process'

import { chromium } from 'playwright-core'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const targetUrl = process.argv[2] ?? 'http://127.0.0.1:51001/@Megghy/test'
const outputDir = process.argv[3] ?? 'F:\\Temp\\vtsuru-user-page-regression'
const viewports = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 812 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 900 },
  { name: '1440', width: 1440, height: 1000 },
]
const colorSchemes = ['light', 'dark']

const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const results = []
try {
  for (const colorScheme of colorSchemes) {
    for (const viewport of viewports) {
      console.log(`开始检查 ${colorScheme} ${viewport.name}px`)
      const context = await browser.newContext({ viewport, colorScheme })
      const page = await context.newPage()
      const pageErrors = []
      const consoleErrors = []
      page.on('pageerror', (error) => pageErrors.push(error.message))
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text())
      })
      await page.route('**/api/user-pages/get-user**', async (route) => {
        const response = await route.fetch()
        const payload = await response.json()
        const settings = JSON.parse(payload.data)
        settings.theme = { ...settings.theme, pageThemeMode: 'auto' }
        payload.data = JSON.stringify(settings)
        await route.fulfill({ response, json: payload })
      })
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await page.locator('.viewer-page-content').waitFor({ state: 'visible', timeout: 15_000 })
      await page.waitForTimeout(2_000)
      const screenshotPath = path.join(outputDir, `user-page-${colorScheme}-${viewport.name}.png`)
      await page.screenshot({ path: screenshotPath, timeout: 15_000 })
      const layout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        text: document.body.textContent?.slice(0, 120) ?? '',
      }))
      results.push({ viewport: viewport.name, colorScheme, screenshotPath, pageErrors, consoleErrors, ...layout })
      console.log(`完成检查 ${colorScheme} ${viewport.name}px`)
      await context.close()
    }
  }
} finally {
  await browser.close()
}

console.table(
  results.map(({ viewport, colorScheme, scrollWidth, clientWidth, pageErrors, consoleErrors }) => ({
    viewport,
    colorScheme,
    scrollWidth,
    clientWidth,
    pageErrors: pageErrors.length,
    consoleErrors: consoleErrors.length,
  })),
)
for (const result of results) {
  if (result.pageErrors.length || result.consoleErrors.length) {
    console.error(`[${result.colorScheme} ${result.viewport}]`, [...result.pageErrors, ...result.consoleErrors])
  }
  console.log(
    `${result.colorScheme} ${result.viewport}: ${result.screenshotPath} | ${result.text.replaceAll('\n', ' / ')}`,
  )
}

if (results.some((result) => result.scrollWidth > result.clientWidth || result.pageErrors.length)) process.exitCode = 1
