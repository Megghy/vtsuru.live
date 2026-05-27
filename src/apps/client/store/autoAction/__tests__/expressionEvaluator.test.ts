import type { ExecutionContext } from '../types'
import { describe, expect, it } from 'vitest'
import { evaluateTemplateExpressions, extractJsExpressions } from '../expressionEvaluator'

function makeContext(variables: Record<string, any> = {}): ExecutionContext {
  return {
    event: null,
    roomId: 0,
    timestamp: Date.now(),
    variables: {
      user: { name: 'Alice', uid: 123, guardLevel: 0 },
      message: 'hello',
      ...variables,
    },
    getData: () => undefined,
    setData: () => {},
    containsData: () => false,
    removeData: () => {},
    getStorageData: async () => undefined,
    setStorageData: async () => {},
    hasStorageData: async () => false,
    removeStorageData: async () => {},
    clearStorageData: async () => {},
  }
}

describe('evaluateTemplateExpressions', () => {
  it('returns empty string for empty template', () => {
    expect(evaluateTemplateExpressions('', makeContext())).toBe('')
  })

  it('returns empty string for non-string input', () => {
    expect(evaluateTemplateExpressions(null as any, makeContext())).toBe('')
    expect(evaluateTemplateExpressions(undefined as any, makeContext())).toBe('')
  })

  it('replaces simple placeholders', () => {
    const result = evaluateTemplateExpressions('Hello {{user.name}}!', makeContext())
    expect(result).toBe('Hello Alice!')
  })

  it('replaces nested property paths', () => {
    const ctx = makeContext({
      gift: { name: '小心心', count: 5, totalPrice: 0 },
    })
    expect(evaluateTemplateExpressions('感谢 {{gift.name}} x{{gift.count}}', ctx))
      .toBe('感谢 小心心 x5')
  })

  it('keeps unknown placeholders as-is', () => {
    const result = evaluateTemplateExpressions('{{unknown.thing}}', makeContext())
    expect(result).toBe('{{unknown.thing}}')
  })

  it('evaluates simple js expressions with implicit return', () => {
    const ctx = makeContext({ user: { name: 'Bob', uid: 1, guardLevel: 1 } })
    const result = evaluateTemplateExpressions(
      '{{js: user.guardLevel > 0 ? "舰长" : "普通"}}',
      ctx,
    )
    expect(result).toBe('舰长')
  })

  it('evaluates js+ code blocks with explicit return', () => {
    const result = evaluateTemplateExpressions(
      '{{js+: const x = 2 + 3; return x * 2; }}',
      makeContext(),
    )
    expect(result).toBe('10')
  })

  it('catches js expression errors and returns error tag', () => {
    const result = evaluateTemplateExpressions('{{js: foo.bar.baz}}', makeContext())
    expect(result).toContain('[表达式错误:')
  })

  it('catches js+ block errors', () => {
    const result = evaluateTemplateExpressions(
      '{{js+: throw new Error("boom") }}',
      makeContext(),
    )
    expect(result).toContain('[代码块错误:')
    expect(result).toContain('boom')
  })

  it('runtime data functions are accessible inside js blocks', () => {
    const store: Record<string, any> = {}
    const ctx = makeContext()
    ctx.getData = (key: string) => store[key]
    ctx.setData = (key: string, value: any) => { store[key] = value }

    const result = evaluateTemplateExpressions(
      '{{js+: const c = (getData("count") || 0) + 1; setData("count", c); return c; }}',
      ctx,
    )
    expect(result).toBe('1')
    expect(store.count).toBe(1)
  })

  it('mixes simple placeholders with js expressions', () => {
    const ctx = makeContext({ user: { name: 'Carol', uid: 1, guardLevel: 0 } })
    const result = evaluateTemplateExpressions(
      'Hi {{user.name}}, you said: {{js: message.toUpperCase()}}',
      ctx,
    )
    expect(result).toBe('Hi Carol, you said: HELLO')
  })
})

describe('extractJsExpressions', () => {
  it('extracts all js expression occurrences', () => {
    const expressions = extractJsExpressions('{{js: a}} text {{js+: b}} {{js: a}}')
    expect(expressions.length).toBe(3)
  })

  it('returns empty array for templates without js', () => {
    expect(extractJsExpressions('plain {{user.name}}')).toEqual([])
  })
})
