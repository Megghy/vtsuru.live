import { describe, expect, it } from 'vitest'

import { BLOCK_DEFINITIONS, BLOCK_LIBRARY, createBlockNode, getBlockLabel } from '../registry'
import { BLOCK_TYPES } from '../schema'

describe('block registry', () => {
  it('每个区块都只有一份完整能力定义', () => {
    expect(BLOCK_DEFINITIONS.map((item) => item.type)).toEqual(BLOCK_TYPES)
    BLOCK_DEFINITIONS.forEach((item) => {
      expect(item.label).not.toBe('')
      expect(item.category).not.toBe('')
      expect(item.keywords.length).toBeGreaterThan(0)
      expect(item.editor).toBeDefined()
      expect(item.viewer).toBeDefined()
      expect(item.validate).toBeTypeOf('function')
    })
    expect(BLOCK_LIBRARY).toHaveLength(BLOCK_TYPES.length)
  })

  it('创建区块时深拷贝默认属性', () => {
    const first = createBlockNode('layout', 'first')
    const second = createBlockNode('layout', 'second')
    ;((first.props as any).children as unknown[]).push({ id: 'child' })
    expect((second.props as any).children).toEqual([])
  })

  it('未知区块类型不会中断旧版编辑器渲染', () => {
    expect(getBlockLabel('futureBlock')).toBe('不支持的区块 (futureBlock)')
  })
})
