import { describe, expect, it } from 'vitest'
import { validateBlockPageProject, validateRenderableBlockPageProject } from '../schema'

function project(blocks: unknown[]) {
  return { version: 1, blocks }
}

describe('validateBlockPageProject', () => {
  it('校验所有层级的区块 ID 全局唯一', () => {
    const result = validateBlockPageProject(project([
      { id: 'same', type: 'text', props: { text: 'a' } },
      { id: 'layout', type: 'layout', props: { layout: 'column', children: [
        { id: 'same', type: 'text', props: { text: 'b' } },
      ] } },
    ]))

    expect(result.ok).toBe(false)
    expect(result.ok === false ? result.errors : []).toContain('blocks[1].children[0]: id "same" 与 blocks[0] 重复')
  })

  it('隐藏节点仍校验类型、ID 和危险 URL', () => {
    const result = validateBlockPageProject(project([
      { id: 'embed', type: 'embed', hidden: true, props: { url: 'https://evil.test/video/1' } },
      { id: 'unknown', type: 'not-registered', hidden: true, props: {} },
    ]))

    expect(result.ok).toBe(false)
    const errors = result.ok === false ? result.errors : []
    expect(errors.some(error => error.includes('不支持的 embed provider'))).toBe(true)
    expect(errors.some(error => error.includes('不支持的 block type'))).toBe(true)
  })

  it('隐藏节点可以省略只在展示时必需的内容', () => {
    const result = validateBlockPageProject(project([
      { id: 'heading', type: 'heading', hidden: true, props: { text: '', level: 2 } },
      { id: 'image', type: 'image', hidden: true, props: { alt: '' } },
    ]))

    expect(result).toMatchObject({ ok: true })
  })

  it('公开渲染忽略不会执行的隐藏节点内容错误', () => {
    const result = validateRenderableBlockPageProject(project([
      { id: 'hidden-embed', type: 'embed', hidden: true, props: { url: 'http://unfinished' } },
      { id: 'visible-text', type: 'text', props: { text: '正常内容' } },
    ]))

    expect(result).toMatchObject({ ok: true })
  })

  it('图片组使用上传文件时允许 URL 保持为空', () => {
    const result = validateBlockPageProject(project([
      {
        id: 'gallery',
        type: 'imageGallery',
        props: {
          layout: 'carousel',
          items: [{ url: '', imageFile: { id: 1, path: 'https://files.example/image.png' } }],
        },
      },
    ]))

    expect(result).toMatchObject({ ok: true })
  })

  it('每个区块页面最多允许一个可见一级标题', () => {
    const result = validateBlockPageProject(project([
      { id: 'title-1', type: 'heading', props: { text: '主标题', level: 1 } },
      { id: 'title-2', type: 'heading', props: { text: '另一个主标题', level: 1 } },
    ]))

    expect(result.ok === false ? result.errors : []).toContain('blocks[1]: 一级标题与 blocks[0] 重复')
  })

  it('嵌套过深时返回明确错误', () => {
    let node: unknown = { id: 'leaf', type: 'text', props: { text: '' } }
    for (let depth = 8; depth >= 0; depth--) {
      node = { id: `layout-${depth}`, type: 'layout', props: { layout: 'column', children: [node] } }
    }
    const result = validateBlockPageProject(project([node]))
    expect(result.ok === false && result.errors.some(error => error.includes('layout 嵌套过深'))).toBe(true)
  })

  it('无效节点只返回错误而不会导致校验器崩溃', () => {
    expect(validateBlockPageProject(project([null, 1, 'bad']))).toMatchObject({
      ok: false,
      errors: ['blocks[0] 必须是 object', 'blocks[1] 必须是 object', 'blocks[2] 必须是 object'],
    })
  })
})
