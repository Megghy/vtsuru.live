import { describe, expect, it } from 'vitest'
import { sanitizeRichText } from '../richTextSanitizer'

describe('sanitizeRichText', () => {
  it('保留允许的排版内容并规范链接', () => {
    const html = sanitizeRichText('<h2 class="ql-align-center">标题</h2><a href="https://example.com">链接</a>')
    expect(html).toContain('<h2 style="text-align:center">标题</h2>')
    expect(html).toContain('href="https://example.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('移除脚本、事件属性、SVG 和危险协议', () => {
    const html = sanitizeRichText('<script>alert(1)</script><svg><a href="javascript:alert(1)"></a></svg><p onclick="alert(1)">ok</p><a href="jav&#x61;script:alert(1)">bad</a>')
    expect(html).toBe('<p>ok</p><a>bad</a>')
  })

  it('移除危险图片并规范合法图片属性', () => {
    const html = sanitizeRichText('<img src="data:text/html;base64,WA=="><img src="/api/file/1" alt="封面" onerror="alert(1)">')
    expect(html).toBe('<img src="/api/file/1" alt="封面" loading="lazy" decoding="async">')
  })

  it('只保留严格允许的内联样式', () => {
    const html = sanitizeRichText('<p style="color:#fff;background-image:url(javascript:alert(1));font-size:999px;line-height:1.5;position:fixed">ok</p>')
    expect(html).toBe('<p style="color:#fff;line-height:1.5">ok</p>')
  })

  it('不会通过编码或协议相对地址绕过 URL 规则', () => {
    const html = sanitizeRichText('<a href="//evil.test">a</a><a href="java\nscript:alert(1)">b</a><img src="//evil.test/x.png">')
    expect(html).toBe('<a>a</a><a>b</a>')
  })
})
