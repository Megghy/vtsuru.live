import { describe, expect, it } from 'vitest'

import { parseEmbedUrl, parseFeedbackEmbedUrl, parseMusicEmbedUrl } from '../embed'

describe('embed adapters', () => {
  it('把 bilibili 与 YouTube 地址转换为固定播放器地址', () => {
    expect(parseEmbedUrl('https://www.bilibili.com/video/BV1xx411c7mD').src).toBe(
      'https://player.bilibili.com/player.html?autoplay=0&bvid=BV1xx411c7mD',
    )
    expect(parseEmbedUrl('https://youtu.be/dQw4w9WgXcQ').src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('拒绝伪造域名、凭据、非 HTTPS 和未知路径', () => {
    expect(() => parseEmbedUrl('https://evilbilibili.com/video/BV1xx411c7mD')).toThrow('不支持的 embed provider')
    expect(() => parseEmbedUrl('https://user:pass@youtu.be/dQw4w9WgXcQ')).toThrow('用户名或密码')
    expect(() => parseEmbedUrl('http://youtu.be/dQw4w9WgXcQ')).toThrow('必须使用 https')
    expect(() => parseEmbedUrl('https://www.youtube.com/redirect?q=https://evil.test')).toThrow('仅支持 YouTube')
  })

  it('只允许登记的反馈表单来源', () => {
    const model = parseFeedbackEmbedUrl('https://docs.google.com/forms/d/e/form-id/viewform')
    expect(model.src).toBe('https://docs.google.com/forms/d/e/form-id/viewform')
    expect(model.sandbox).toContain('allow-forms')
    expect(model.allow).toBe('')
    expect(() => parseFeedbackEmbedUrl('https://example.com/form')).toThrow('不支持的 feedback iframe provider')
    expect(() =>
      parseFeedbackEmbedUrl('https://docs.google.com/forms/d/e/form-id/viewform?redirect=https://evil.test'),
    ).toThrow('不支持查询参数')
  })

  it('音乐地址由 provider 适配器生成且 custom 为严格白名单', () => {
    expect(parseMusicEmbedUrl('spotify', 'https://open.spotify.com/track/abc123').src).toBe(
      'https://open.spotify.com/embed/track/abc123',
    )
    expect(
      parseMusicEmbedUrl('custom', 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F1')
        .provider,
    ).toBe('soundcloud')
    expect(parseMusicEmbedUrl('netease', 'https://music.163.com/outchain/player?type=2&id=123').src).toContain(
      'type=2&id=123',
    )
    expect(() =>
      parseMusicEmbedUrl('custom', 'https://w.soundcloud.com/player/?url=https%3A%2F%2Fevil.test%2Ftrack'),
    ).toThrow('播放内容域名不受支持')
    expect(() =>
      parseMusicEmbedUrl(
        'custom',
        'https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fa&redirect=https%3A%2F%2Fevil.test',
      ),
    ).toThrow('不支持查询参数')
    expect(() => parseMusicEmbedUrl('custom', 'https://example.com/player')).toThrow('不支持的自定义音乐 provider')
  })
})
