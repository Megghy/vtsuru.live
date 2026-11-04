import { describe, expect, it } from 'vitest'

import { normalizeCustomHtmlProps } from '../customHtmlContract'
import { buildCustomHtmlDocument } from '../customHtmlDocument'
import { collectCustomHtmlAssetKeys, inspectCustomCss, inspectCustomSource } from '../customHtmlRuntime'

const file = { id: 7, path: '/api/files/cover.webp', name: 'cover.webp', hash: 'hash' }
const theme = {
  fg: '#18181b',
  fgMuted: '#71717a',
  bg: '#ffffff',
  bgElevated: '#fafafa',
  border: '#e4e4e7',
  primary: '#18a058',
  primaryReadable: '#166534',
  radius: '6px',
  colorScheme: 'light',
}

describe('customHtmlRuntime', () => {
  it('生成隔离文档并注入 Vue runtime', () => {
    const props = normalizeCustomHtmlProps({
      source: `<template><section class="hero"><img data-vtsuru-asset="cover" alt="封面"></section></template>\n<style>.hero{background-image:var(--vtsuru-asset-cover);color:var(--foreground)}</style>`,
      assets: [{ key: 'cover', file }],
    })
    const result = buildCustomHtmlDocument(props, theme, {
      js: 'Vue.createApp({}).mount("#app")',
      css: '.hero{color:red}',
    })

    expect(result.issues).toEqual([])
    expect(result.srcdoc).toContain('Content-Security-Policy')
    expect(result.srcdoc).toContain('--vtsuru-asset-cover:url')
    expect(result.srcdoc).toContain('ResizeObserver')
    expect(result.srcdoc).toContain("connect-src 'none'")
    expect(result.srcdoc).toContain('Vue.createApp')
    expect(result.srcdoc).toContain('VueUse')
    expect(result.srcdoc).toContain('dayjs')
    expect(result.srcdoc).not.toContain('allow-same-origin')
  })

  it('拒绝 CSS 外部加载和不允许的规则', () => {
    expect(
      inspectCustomCss('@import "https://evil.test/a.css";.x{background:url(https://evil.test/x.png)}').issues.length,
    ).toBeGreaterThan(0)
    expect(
      inspectCustomCss('@font-face{font-family:x;src:url(https://evil.test/x.woff)}').issues.length,
    ).toBeGreaterThan(0)
  })

  it('标记 CSS 中没有绑定的资源键', () => {
    const issues = inspectCustomCss('.x{background:var(--vtsuru-asset-missing)}', [])
    expect(issues.issues.map((item) => item.message)).toContain('找不到资源键：missing')
  })

  it('从 Vue SFC 收集资源键', () => {
    const keys = collectCustomHtmlAssetKeys(
      `<template><img data-vtsuru-asset="cover"><img data-vtsuru-asset="avatar"></template>\n<style>.x{background:var(--vtsuru-asset-background)}</style>\n<script setup>vtsuru.getAssetUrl('banner')</script>`,
    )
    expect([...keys].toSorted()).toEqual(['avatar', 'background', 'banner', 'cover'])
  })

  it('css 尚未写完时仍保留资源引用', () => {
    expect([...collectCustomHtmlAssetKeys('<style>.cover { background: var(--vtsuru-asset-cover)</style>')]).toEqual([
      'cover',
    ])
  })

  it('标记 SFC 中缺失的资源键', () => {
    const issues = inspectCustomSource('<template><img data-vtsuru-asset="missing"></template>', [])
    expect(issues.map((item) => item.message)).toContain('找不到资源键：missing')
  })
})
