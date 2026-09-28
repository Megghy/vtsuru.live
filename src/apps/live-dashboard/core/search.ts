import type { DashboardEvent } from './types'
import { EVENT_TYPE_KEYWORDS, PAID_TYPES } from './types'

/**
 * 控制台高级搜索：`key:value`、`-` 取反、逗号多值（或）、引号包裹、`price:` 数值比较，
 * 其余文本在全部字段中做不区分大小写的子串匹配；所有条件之间为「与」。
 */

type Field = 'type' | 'uid' | 'username' | 'message' | 'medal' | 'price' | 'note' | 'text'

interface Term {
  field: Field
  negate: boolean
  values: string[]
}

const FIELDS = new Set<string>(['type', 'uid', 'username', 'message', 'medal', 'price', 'note'])

/** 在引号之外按分隔符切分，保留引号原文，供后续 unquote */
function splitOutsideQuotes(input: string, isSeparator: (ch: string) => boolean): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | undefined
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === '\\' && input[i + 1] === quote) {
        current += ch + quote
        i++
        continue
      }
      if (ch === quote) quote = undefined
      current += ch
    } else if (ch === '"' || ch === "'") {
      quote = ch
      current += ch
    } else if (isSeparator(ch)) {
      if (current) parts.push(current)
      current = ''
    } else current += ch
  }
  if (current) parts.push(current)
  return parts
}

function unquote(value: string): string {
  let out = ''
  let quote: string | undefined
  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if (quote && ch === '\\' && value[i + 1] === quote) {
      out += quote
      i++
    } else if (!quote && (ch === '"' || ch === "'")) quote = ch
    else if (ch === quote) quote = undefined
    else out += ch
  }
  return out
}

export function parseSearch(input: string): Term[] {
  return splitOutsideQuotes(input, (ch) => /\s/.test(ch)).flatMap<Term>((token) => {
    const negate = token.length > 1 && token.startsWith('-')
    const body = negate ? token.slice(1) : token
    const colon = body.indexOf(':')
    const key = colon > 0 ? body.slice(0, colon).toLowerCase() : ''
    if (!FIELDS.has(key)) return [{ field: 'text', negate, values: [unquote(body)] }]
    const values = splitOutsideQuotes(body.slice(colon + 1), (ch) => ch === ',').map(unquote).filter(Boolean)
    return values.length ? [{ field: key as Field, negate, values }] : []
  })
}

function matchPrice(price: number, expr: string): boolean {
  const e = expr.replaceAll(' ', '')
  const range = /^(-?\d+(?:\.\d+)?)\.\.(-?\d+(?:\.\d+)?)$/.exec(e)
  if (range) return price >= Number(range[1]) && price <= Number(range[2])
  const cmp = /^(>=|<=|[><=])?(-?\d+(?:\.\d+)?)$/.exec(e)
  if (!cmp) return false
  const target = Number(cmp[2])
  switch (cmp[1]) {
    case '>':
      return price > target
    case '>=':
      return price >= target
    case '<':
      return price < target
    case '<=':
      return price <= target
    default:
      return price === target
  }
}

const includes = (haystack: string | undefined, needle: string) =>
  !!haystack && haystack.toLowerCase().includes(needle.toLowerCase())

function matchValue(event: DashboardEvent, field: Field, value: string, note: string | undefined): boolean {
  switch (field) {
    case 'type':
      return event.type === EVENT_TYPE_KEYWORDS[value.toLowerCase()]
    case 'uid':
      return String(event.uid) === value || event.ouid === value
    case 'username':
      return includes(event.uname, value)
    case 'message':
      return includes(event.msg, value)
    case 'medal':
      return includes(event.medalName, value)
    case 'price':
      return matchPrice(event.price, value)
    case 'note':
      return includes(note, value)
    case 'text':
      return (
        includes(event.uname, value) ||
        includes(event.msg, value) ||
        includes(event.medalName, value) ||
        String(event.uid) === value ||
        includes(note, value)
      )
  }
}

export function createSearchPredicate(
  input: string,
  getNote: (event: DashboardEvent) => string | undefined,
): ((event: DashboardEvent) => boolean) | undefined {
  const terms = parseSearch(input.trim())
  if (!terms.length) return undefined
  return (event) => {
    const note = getNote(event)
    return terms.every((term) => {
      // price 只对付费事件有意义，取反时也排除其他事件
      if (term.field === 'price' && !PAID_TYPES.has(event.type)) return false
      const hit = term.values.some((value) => matchValue(event, term.field, value, note))
      return term.negate ? !hit : hit
    })
  }
}
