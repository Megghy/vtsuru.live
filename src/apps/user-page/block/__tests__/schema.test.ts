import { describe, expect, it } from 'vitest'

import { validateBlockPageProject, validateRenderableBlockPageProject } from '../schema'

function project(blocks: unknown[]) {
  return { version: 1, blocks }
}

describe('validateBlockPageProject', () => {
  it('校验所有层级的区块 ID 全局唯一', () => {
    const result = validateBlockPageProject(
      project([
        { id: 'same', type: 'text', props: { text: 'a' } },
        {
          id: 'layout',
          type: 'layout',
          props: { layout: 'column', children: [{ id: 'same', type: 'text', props: { text: 'b' } }] },
        },
      ]),
    )

    expect(result.ok).toBe(false)
    expect(result.ok === false ? result.issues : []).toContainEqual(
      expect.objectContaining({
        blockId: 'same',
        fieldPath: 'id',
        message: 'id "same" 与其他区块重复',
      }),
    )
  })

  it('隐藏节点仍校验类型、ID 和危险 URL', () => {
    const result = validateBlockPageProject(
      project([
        { id: 'embed', type: 'embed', hidden: true, props: { url: 'https://evil.test/video/1' } },
        { id: 'unknown', type: 'not-registered', hidden: true, props: {} },
      ]),
    )

    expect(result.ok).toBe(false)
    const issues = result.ok === false ? result.issues : []
    expect(issues.some((issue) => issue.message.includes('不支持的 embed provider'))).toBe(true)
    expect(issues.some((issue) => issue.message.includes('不支持的 block type'))).toBe(true)
  })

  it('隐藏节点可以省略只在展示时必需的内容', () => {
    const result = validateBlockPageProject(
      project([
        { id: 'heading', type: 'heading', hidden: true, props: { text: '', level: 2 } },
        { id: 'image', type: 'image', hidden: true, props: { alt: '' } },
      ]),
    )

    expect(result).toMatchObject({ ok: true })
  })

  it('公开渲染忽略不会执行的隐藏节点内容错误', () => {
    const result = validateRenderableBlockPageProject(
      project([
        { id: 'hidden-embed', type: 'embed', hidden: true, props: { url: 'http://unfinished' } },
        { id: 'visible-text', type: 'text', props: { text: '正常内容' } },
      ]),
    )

    expect(result).toMatchObject({ ok: true })
  })

  it('图片组使用上传文件时允许 URL 保持为空', () => {
    const result = validateBlockPageProject(
      project([
        {
          id: 'gallery',
          type: 'imageGallery',
          props: {
            layout: 'carousel',
            items: [{ url: '', imageFile: { id: 1, path: 'https://files.example/image.png' } }],
          },
        },
      ]),
    )

    expect(result).toMatchObject({ ok: true })
  })

  it('二维码区块校验样式和内容容量', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'qrcode',
            type: 'qrcode',
            props: {
              content: 'https://vtsuru.suki.club',
              size: 256,
              foreground: '#000000',
              background: '#ffffff',
              level: 'M',
              margin: 8,
            },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-qrcode',
          type: 'qrcode',
          props: { content: 'a'.repeat(1200), foreground: 'black', level: 'H' },
        },
      ]),
    )
    const issues = result.ok === false ? result.issues : []
    expect(issues.map((issue) => issue.message)).toContain('foreground 必须是六位十六进制颜色')
    expect(issues.map((issue) => issue.message)).toContain('content 超出当前纠错等级的容量')
  })

  it('校验区块显示条件', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'scheduled',
            type: 'text',
            visibility: { liveState: 'live', device: 'mobile', startsAt: 1_800_000_000, endsAt: 1_900_000_000 },
            props: { text: '活动内容' },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'invalid-visibility',
          type: 'text',
          visibility: { liveState: 'sometimes', device: 'tablet', startsAt: 200, endsAt: 100 },
          props: { text: '活动内容' },
        },
      ]),
    )
    const fields = result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []
    expect(fields).toEqual(expect.arrayContaining(['visibility.liveState', 'visibility.device', 'visibility.startsAt']))
  })

  it('不校验当前模式不会使用的属性', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'row-videos',
            type: 'videoList',
            props: { source: 'userIndex', layout: 'row', columns: 99, items: [{ url: 'invalid' }] },
          },
          {
            id: 'question-box',
            type: 'feedback',
            props: { embed: true, embedMode: 'questionBox', url: 'invalid', height: 1 },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })
  })

  it('校验功能入口键值和唯一性', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'features',
            type: 'featureNav',
            props: { items: [{ key: 'songList' }, { key: 'forum', hidden: true }] },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-features',
          type: 'featureNav',
          props: { items: [{ key: 'songList' }, { key: 'songList' }, { key: 'unknown' }] },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toEqual(
      expect.arrayContaining(['items[1].key', 'items[2].key']),
    )
  })

  it('校验歌单区块样式和数量', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'songs',
            type: 'songList',
            props: { variant: 'compact', maxItems: 6, showSearch: true, showRequestStatus: true },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-songs',
          type: 'songList',
          props: { variant: 'table', maxItems: 100 },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toEqual(
      expect.arrayContaining(['variant', 'maxItems']),
    )
  })

  it('校验图文卡片及按钮目标', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'cards',
            type: 'cardList',
            props: {
              layout: 'grid',
              columns: 3,
              items: [{ title: '作品', tags: ['Live2D'], primaryAction: { label: '查看', page: 'home' } }],
            },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-cards',
          type: 'cardList',
          props: {
            layout: 'grid',
            columns: 8,
            items: [{ tags: [1], primaryAction: { label: '查看', url: 'http://unsafe.test' } }],
          },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toEqual(
      expect.arrayContaining(['columns', 'items[0].tags', 'items[0].primaryAction.url']),
    )
  })

  it('校验紧凑签到榜展示人数', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'ranking',
            type: 'checkInRanking',
            props: { count: 3, showMonthly: true, showTotal: false },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-ranking',
          type: 'checkInRanking',
          props: { count: 5 },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toContain('count')
  })

  it('校验精选积分商品配置', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'goods',
            type: 'featuredGoods',
            props: { count: 4, selection: 'pinned', showDescription: true, showStock: true },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-goods',
          type: 'featuredGoods',
          props: { count: 8, selection: 'random' },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toEqual(
      expect.arrayContaining(['count', 'selection']),
    )
  })

  it('校验当前视频征集配置', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'collect',
            type: 'videoCollect',
            props: { count: 3, showDescription: true, showProgress: true },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-collect',
          type: 'videoCollect',
          props: { count: 8 },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toContain('count')
  })

  it('校验自动页面目录配置', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'sections',
            type: 'sectionNav',
            props: { layout: 'horizontal', levels: [2, 3], showNumbers: false },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-sections',
          type: 'sectionNav',
          props: { layout: 'grid', levels: [2, 2, 4] },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toEqual(
      expect.arrayContaining(['layout', 'levels']),
    )
  })

  it('校验当前播放区块配置', () => {
    expect(
      validateBlockPageProject(
        project([
          {
            id: 'now-playing',
            type: 'nowPlaying',
            props: { showRequester: true },
          },
        ]),
      ),
    ).toMatchObject({ ok: true })

    const result = validateBlockPageProject(
      project([
        {
          id: 'bad-now-playing',
          type: 'nowPlaying',
          props: { showRequester: 'yes' },
        },
      ]),
    )
    expect(result.ok === false ? result.issues.map((issue) => issue.fieldPath) : []).toContain('showRequester')
  })

  it('每个区块页面最多允许一个可见一级标题', () => {
    const result = validateBlockPageProject(
      project([
        { id: 'title-1', type: 'heading', props: { text: '主标题', level: 1 } },
        { id: 'title-2', type: 'heading', props: { text: '另一个主标题', level: 1 } },
      ]),
    )

    expect(result.ok === false ? result.issues : []).toContainEqual(
      expect.objectContaining({
        blockId: 'title-2',
        fieldPath: 'level',
        message: '一级标题与其他区块重复',
      }),
    )
  })

  it('嵌套过深时返回明确错误', () => {
    let node: unknown = { id: 'leaf', type: 'text', props: { text: '' } }
    for (let depth = 8; depth >= 0; depth--) {
      node = { id: `layout-${depth}`, type: 'layout', props: { layout: 'column', children: [node] } }
    }
    const result = validateBlockPageProject(project([node]))
    expect(result.ok === false && result.issues.some((issue) => issue.message.includes('layout 嵌套过深'))).toBe(true)
  })

  it('无效节点只返回错误而不会导致校验器崩溃', () => {
    expect(validateBlockPageProject(project([null, 1, 'bad']))).toMatchObject({
      ok: false,
      issues: [
        expect.objectContaining({ message: '区块必须是 object' }),
        expect.objectContaining({ message: '区块必须是 object' }),
        expect.objectContaining({ message: '区块必须是 object' }),
      ],
    })
  })
})
