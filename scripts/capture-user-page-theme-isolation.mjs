import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from 'playwright-core'

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const targetUrl = process.argv[2] ?? 'http://127.0.0.1:51001/@Megghy'
const outputDir = process.argv[3] ?? 'F:\\Temp\\vtsuru-user-page-theme-isolation'
const themes = {
  light: { bg: '#ffffff', fg: '#09090b', muted: '#f4f4f5', mutedFg: '#71717a', border: '#d4d4d8' },
  dark: { bg: '#09090b', fg: '#fafafa', muted: '#18181b', mutedFg: '#a1a1aa', border: '#27272a' },
}
const combinations = [
  { outer: 'light', preview: 'dark' },
  { outer: 'dark', preview: 'light' },
]
const blockSelectors = {
  profile: '[data-block-type="profile"]',
  richText: '[data-block-type="richText"]',
  supporter: '[data-block-type="supporter"]',
  schedule: '[data-block-type="streamSchedule"]',
}

await mkdir(outputDir, { recursive: true })
const browser = await chromium.launch({ executablePath: chromePath, headless: true })
const results = []
try {
  for (const combination of combinations) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: combination.outer })
    const page = await context.newPage()
    const pageErrors = []
    const reactiveWarnings = []
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'warning' && message.text().includes('made a reactive object')) reactiveWarnings.push(message.text())
    })
    await page.route('**/api/user-pages/get-user**', async (route) => {
      const response = await route.fetch()
      const payload = await response.json()
      const settings = JSON.parse(payload.data)
      settings.theme = { ...settings.theme, pageThemeMode: combination.preview }
      settings.home.theme = { ...settings.home?.theme, pageThemeMode: combination.preview }
      const blockTheme = { ...settings.home?.block?.theme, pageThemeMode: combination.preview }
      delete blockTheme.textColor
      settings.home.block.theme = blockTheme
      payload.data = JSON.stringify(settings)
      await route.fulfill({ response, json: payload })
    })
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    await page.locator('.viewer-page-content').waitFor({ state: 'visible', timeout: 15_000 })
    await page.waitForTimeout(1_500)
    await page.evaluate((outerTheme) => {
      const root = document.documentElement
      const variables = {
        '--vtsuru-bg': outerTheme.bg,
        '--vtsuru-bg-muted': outerTheme.muted,
        '--vtsuru-bg-elevated': outerTheme.muted,
        '--vtsuru-fg': outerTheme.fg,
        '--vtsuru-fg-muted': outerTheme.mutedFg,
        '--vtsuru-border': outerTheme.border,
        '--n-color': outerTheme.bg,
        '--n-body-color': outerTheme.bg,
        '--n-text-color': outerTheme.fg,
      }
      for (const [key, value] of Object.entries(variables)) root.style.setProperty(key, value)
    }, themes[combination.outer])
    await page.waitForTimeout(500)

    const state = await page.evaluate(() => {
      const read = (selector) => {
        const element = document.querySelector(selector)
        if (!element) return null
        const style = getComputedStyle(element)
        return { color: style.color, background: style.backgroundColor }
      }
      const renderer = document.querySelector('[data-block-id]')?.closest('.page')
      const rendererStyle = renderer ? getComputedStyle(renderer) : null
      return {
        configError: document.body.textContent?.includes('该页面的发布配置无效') ?? false,
        rendererBg: rendererStyle?.getPropertyValue('--vtsuru-bg').trim(),
        rendererFg: rendererStyle?.getPropertyValue('--vtsuru-fg').trim(),
        profile: read('.profile-name'),
        richText: read('.rich-text'),
        supporterHeader: read('.supporter-block .block-header'),
        supporterButton: read('.supporter-block .support-card'),
        scheduleHeader: read('.schedule-header'),
        scheduleInput: read('.calendar-action input'),
      }
    })

    const expected = themes[combination.preview]
    const expectedFg = combination.preview === 'dark' ? 'rgb(250, 250, 250)' : 'rgb(9, 9, 11)'
    const failures = []
    if (state.configError) failures.push('公开页进入配置错误状态')
    if (state.rendererBg !== expected.bg) failures.push(`rendererBg=${state.rendererBg}`)
    if (state.rendererFg !== expected.fg) failures.push(`rendererFg=${state.rendererFg}`)
    if (state.profile?.color !== expectedFg) failures.push(`profile=${state.profile?.color}`)
    if (state.richText?.color !== expectedFg) failures.push(`richText=${state.richText?.color}`)
    if (pageErrors.length) failures.push(...pageErrors)
    if (reactiveWarnings.length) failures.push(...reactiveWarnings)

    const name = `${combination.outer}-manage-${combination.preview}-preview`
    for (const [block, selector] of Object.entries(blockSelectors)) {
      const locator = page.locator(selector).first()
      if (await locator.count()) await locator.screenshot({ path: path.join(outputDir, `${name}-${block}.png`) })
    }
    results.push({ name, ...state, pageErrors, reactiveWarnings, failures })
    await context.close()
  }
} finally {
  await browser.close()
}

console.dir(results, { depth: null })
if (results.some(result => result.failures.length)) process.exitCode = 1
