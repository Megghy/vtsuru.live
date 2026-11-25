const collator = new Intl.Collator('zh-CN')

// 23 个拼音首字母基准字（按汉语拼音升序边界）
const PINYIN_BOUNDARIES: ReadonlyArray<readonly [string, string]> = [
  ['阿', 'a'],
  ['芭', 'b'],
  ['擦', 'c'],
  ['搭', 'd'],
  ['蛾', 'e'],
  ['发', 'f'],
  ['噶', 'g'],
  ['哈', 'h'],
  ['击', 'j'],
  ['喀', 'k'],
  ['拉', 'l'],
  ['妈', 'm'],
  ['拿', 'n'],
  ['哦', 'o'],
  ['啪', 'p'],
  ['期', 'q'],
  ['然', 'r'],
  ['撒', 's'],
  ['塌', 't'],
  ['挖', 'w'],
  ['昔', 'x'],
  ['压', 'y'],
  ['匝', 'z'],
]

const charInitialCache = new Map<string, string>()

function getChineseCharInitial(ch: string): string {
  const cached = charInitialCache.get(ch)
  if (cached !== undefined) return cached

  let resolved = ''
  if (collator.compare(ch, PINYIN_BOUNDARIES[0][0]) >= 0) {
    for (let i = PINYIN_BOUNDARIES.length - 1; i >= 0; i--) {
      if (collator.compare(ch, PINYIN_BOUNDARIES[i][0]) >= 0) {
        resolved = PINYIN_BOUNDARIES[i][1]
        break
      }
    }
  }

  charInitialCache.set(ch, resolved)
  return resolved
}

/**
 * 提取字符串的拼音首字母（中文转 a-z，ASCII 字母数字原样保留小写）
 */
export function getPinyinInitials(text: string): string {
  if (!text) return ''
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const code = ch.charCodeAt(0)
    if ((code >= 48 && code <= 57) || (code >= 97 && code <= 122)) {
      out += ch
    } else if (code >= 65 && code <= 90) {
      out += ch.toLowerCase()
    } else if (code >= 0x4e00 && code <= 0x9fff) {
      out += getChineseCharInitial(ch)
    }
  }
  return out
}
