import { createHash } from 'node:crypto'

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49, 33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41,
  13, 37, 48, 7, 16, 24, 55, 40, 61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36, 20, 34,
  44, 52,
]

const forbidden = /[!'()*]/g

export function mixinKey(source: string) {
  return mixinKeyEncTab
    .map((index) => source[index] ?? '')
    .join('')
    .slice(0, 32)
}

export function signWbi(params: Record<string, string>, imgKey: string, subKey: string, nowSeconds: number) {
  const values: Record<string, string> = { ...params, wts: String(nowSeconds) }
  const query = Object.keys(values)
    .sort()
    .map((key) => [key, values[key].replace(forbidden, '')])
  const encoded = new URLSearchParams(query).toString()
  const rid = createHash('md5')
    .update(encoded + mixinKey(imgKey + subKey))
    .digest('hex')
  return `${encoded}&w_rid=${rid}`
}

export function wbiKeyFromUrl(url: string) {
  const name = url.slice(url.lastIndexOf('/') + 1)
  return name.slice(0, name.lastIndexOf('.'))
}
