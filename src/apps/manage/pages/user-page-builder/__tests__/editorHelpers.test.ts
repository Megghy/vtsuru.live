import { describe, expect, it } from 'vitest'
import { isReactive, reactive } from 'vue'

import { deepCloneJson } from '../editorHelpers'

describe('deepCloneJson', () => {
  it('clones Vue reactive settings into independent plain data', () => {
    const settings = reactive({
      version: 2,
      home: {
        mode: 'block',
        block: { blocks: [{ id: 'heading-1', type: 'heading', props: { text: '标题' } }] },
      },
      pages: {},
    })

    const cloned = deepCloneJson(settings)

    expect(isReactive(cloned)).toBe(false)
    expect(isReactive(cloned.home)).toBe(false)
    expect(cloned).toEqual(settings)

    settings.home.block.blocks[0].props.text = '已修改'
    expect(cloned.home.block.blocks[0].props.text).toBe('标题')
  })
})
