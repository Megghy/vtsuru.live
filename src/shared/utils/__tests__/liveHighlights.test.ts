import { describe, expect, it } from 'vitest'

import type { DanmakuModel } from '@/api/client-types'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'

import { buildHighlightCommentText, buildHighlightSrtText, detectAutoHighlights } from '../liveHighlights'

function makeMsg(time: number, msg = '哈哈哈'): DanmakuModel {
  return {
    type: EventDataTypes.Message,
    time,
    msg,
    uName: '观众',
    uId: 1,
    ouId: 'u1',
    uface: '',
    price: 0,
    num: 1,
    guardLevel: GuardLevel.None,
    fansMedalLevel: 0,
    fansMedalName: '',
    fansMedalWearingStatus: false,
  } as unknown as DanmakuModel
}

describe('liveHighlights', () => {
  const start = 1_700_000_000_000

  it('能自动识别高额 SC、上舰以及弹幕密度峰值', () => {
    const danmakus: DanmakuModel[] = [
      // 普通背景弹幕（4 个 30s 桶，每桶 1 条）
      makeMsg(start + 5_000),
      makeMsg(start + 35_000),
      makeMsg(start + 65_000),
      makeMsg(start + 95_000),
      // 第 5 桶密集爆发 10 条弹幕
      ...Array.from({ length: 10 }, (_, idx) => makeMsg(start + 125_000 + idx * 1000, '草')),
      // 高额 SC 与上舰
      {
        ...makeMsg(start + 45_000, '主播牛逼'),
        type: EventDataTypes.SC,
        price: 50,
        uName: '大佬',
      } as unknown as DanmakuModel,
      {
        ...makeMsg(start + 150_000, ''),
        type: EventDataTypes.Guard,
        price: 198,
        uName: '舰长老板',
      } as unknown as DanmakuModel,
    ]

    const highlights = detectAutoHighlights(danmakus, start)
    expect(highlights.some((h) => h.source === 'auto-sc' && h.label.includes('SC ¥50'))).toBe(true)
    expect(highlights.some((h) => h.source === 'auto-peak')).toBe(true)
    expect(highlights.some((h) => h.source === 'auto-guard')).toBe(true)
  })

  it('能正确导出 B 站评论区时间轴文本与 SRT 时间标记', () => {
    const entries = [
      { id: '1', timeMs: start + 75_000, label: '精彩五杀', source: 'manual' as const },
      { id: '2', timeMs: start + 3665_000, label: '歌回高音破音', source: 'shortcut' as const },
    ]

    const comment = buildHighlightCommentText(entries, start)
    expect(comment).toBe('01:15 精彩五杀\n1:01:05 歌回高音破音')

    const srt = buildHighlightSrtText(entries, start, 0, 5)
    expect(srt).toContain('00:01:15,000 --> 00:01:20,000\n精彩五杀')
    expect(srt).toContain('01:01:05,000 --> 01:01:10,000\n歌回高音破音')
  })
})
