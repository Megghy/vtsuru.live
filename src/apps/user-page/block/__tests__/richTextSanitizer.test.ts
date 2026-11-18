import { describe, expect, it } from 'vitest'

import { sanitizeForumHtml, sanitizeRichText } from '../richTextSanitizer'

describe('sanitizeRichText', () => {
  it('保留允许的排版内容并规范链接', () => {
    const html = sanitizeRichText('<h2 class="ql-align-center">标题</h2><a href="https://example.com">链接</a>')
    expect(html).toContain('<h2 style="text-align:center">标题</h2>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('移除脚本、事件属性、SVG 和危险协议', () => {
    const html = sanitizeRichText(
      '<script>alert(1)</script><svg><a href="javascript:alert(1)"></a></svg><p onclick="alert(1)">ok</p><a href="jav&#x61;script:alert(1)">bad</a>',
    )
    expect(html).toBe('<p>ok</p><a>bad</a>')
  })

  it('移除危险图片并规范合法图片属性（含 no-referrer）', () => {
    const html = sanitizeRichText(
      '<img src="data:text/html;base64,WA=="><img src="/api/file/1" alt="封面" onerror="alert(1)">',
    )
    expect(html).toBe('<img src="/api/file/1" alt="封面" loading="lazy" decoding="async" referrerpolicy="no-referrer">')
  })

  it('只保留严格允许的内联样式', () => {
    const html = sanitizeRichText(
      '<p style="color:#fff;background-image:url(javascript:alert(1));font-size:999px;line-height:1.5;position:fixed">ok</p>',
    )
    expect(html).toBe('<p style="color:#fff;line-height:1.5">ok</p>')
  })

  it('不会通过编码、反斜杠或协议相对地址绕过 URL 规则', () => {
    const html = sanitizeRichText(
      '<a href="//evil.test">a</a><a href="java\nscript:alert(1)">b</a><a href="\\\\evil.com">c</a><a href="/\\evil.com">d</a><img src="//evil.test/x.png"><img src="\\\\evil.com/x.png">',
    )
    expect(html).toBe('<a>a</a><a>b</a><a>c</a><a>d</a>')
  })
})

describe('sanitizeForumHtml', () => {
  it('拦截论坛 XSS 载荷同时保留安全排版与表格', () => {
    const html = sanitizeForumHtml(
      '<script>alert(1)</script><img src="x" onerror="alert(1)"><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)">x</a><a href="\\\\evil.com">y</a><table><tr><td colspan="2">ok</td></tr></table><img src="https://cdn.example.com/a.png" alt="图">',
    )
    expect(html).not.toContain('<script')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<iframe')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('evil.com')
    expect(html).toContain('<table><tbody><tr><td colspan="2">ok</td></tr></tbody></table>')
    expect(html).toContain('src="https://cdn.example.com/a.png"')
    expect(html).toContain('referrerpolicy="no-referrer"')
  })
})
