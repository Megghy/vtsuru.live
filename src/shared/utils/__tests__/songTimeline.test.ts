import { describe, expect, it } from 'vitest'

import { buildSongTimelineText, filterTimelineEntries, formatBiliOffset } from '../songTimeline'

describe('songTimeline', () => {
  it('格式化 1 小时以内与超过 1 小时的偏移时间', () => {
    expect(formatBiliOffset(0)).toBe('00:00')
    expect(formatBiliOffset(252_000)).toBe('04:12')
    expect(formatBiliOffset(3_852_000)).toBe('1:04:12')
    expect(formatBiliOffset(-5000)).toBe('00:00')
  })

  it('按直播开始与结束区间过滤并升序生成 B 站评论时间轴', () => {
    const startAt = 1_700_000_000_000
    const stopAt = startAt + 3_600_000
    const text = buildSongTimelineText(
      [
        { title: '太早的歌', timeMs: startAt - 10_000 },
        { title: '第二首', artist: '歌手B', requester: '观众乙', timeMs: startAt + 920_000 },
        { title: '第一首', requester: '观众甲', timeMs: startAt + 252_000 },
        { title: '下播后的歌', timeMs: stopAt + 1_000 },
      ],
      startAt,
      {
        liveStopAtMs: stopAt,
        includeArtist: true,
        includeRequester: true,
      },
    )

    expect(text).toBe(
      ['04:12 《第一首》 (点歌: 观众甲)', '15:20 《第二首》 - 歌手B (点歌: 观众乙)'].join('\n'),
    )
  })

  it('支持手动秒数偏移微调', () => {
    const startAt = 1_000_000
    const filtered = filterTimelineEntries([{ title: '测试曲', timeMs: startAt + 60_000 }], startAt)
    expect(filtered).toHaveLength(1)
    expect(
      buildSongTimelineText(filtered, startAt, {
        offsetAdjustSec: 15,
      }),
    ).toBe('01:15 《测试曲》')
  })
})
