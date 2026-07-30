import { describe, expect, it } from 'vitest'

import { normalizeCustomHtmlProps } from '../customHtmlContract'
import {
  buildCustomHtmlDocument,
  collectCustomHtmlAssetKeys,
  inspectCustomCss,
  inspectCustomHtml,
} from '../customHtmlRuntime'

const file = { id: 7, path: '/api/files/cover.webp', name: 'cover.webp', hash: 'hash' }
const theme = {
  fg: '#18181b',
  fgMuted: '#71717a',
  bg: '#ffffff',
  bgElevated: '#fafafa',
  border: '#e4e4e7',
  primary: '#18a058',
  radius: '6px',
  colorScheme: 'light',
}

describe('customHtmlRuntime', () => {
  it('生成隔离文档并解析受控图片资源', () => {
    const props = normalizeCustomHtmlProps({
      html: '<section class="hero"><img data-vtsuru-asset="cover" alt="封面"></section>',
      css: '.hero{background-image:var(--vtsuru-asset-cover);color:var(--vtsuru-fg)}',
      assets: [{ key: 'cover', file }],
    })
    const result = buildCustomHtmlDocument(props, theme)

    expect(result.issues).toEqual([])
    expect(result.srcdoc).toContain('Content-Security-Policy')
    expect(result.srcdoc).toContain('src="/api/files/cover.webp"')
    expect(result.srcdoc).toContain('--vtsuru-asset-cover:url')
    expect(result.srcdoc).toContain('ResizeObserver')
  })

  it('拒绝脚本、事件属性、内联样式和直接图片地址', () => {
    const issues = inspectCustomHtml(
      '<script>bad()</script><p onclick="bad()" style="color:red">x</p><img src="https://evil.test/x.png">',
      [],
    )
    expect(issues.map((item) => item.message).join('\n')).toContain('<script>')
    expect(issues.map((item) => item.message).join('\n')).toContain('onclick')
    expect(issues.map((item) => item.message).join('\n')).toContain('style')
    expect(issues.map((item) => item.message).join('\n')).toContain('src')
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

  it('从 HTML 和 CSS 收集资源键', () => {
    const keys = collectCustomHtmlAssetKeys(
      '<img data-vtsuru-asset="cover"><img data-vtsuru-asset="avatar">',
      '.x{background:var(--vtsuru-asset-background)}',
    )
    expect([...keys].toSorted()).toEqual(['avatar', 'background', 'cover'])
  })

  it('css 尚未写完时仍保留资源引用', () => {
    const keys = collectCustomHtmlAssetKeys('', '.cover { background: var(--vtsuru-asset-cover)')

    expect([...keys]).toEqual(['cover'])
  })
})
