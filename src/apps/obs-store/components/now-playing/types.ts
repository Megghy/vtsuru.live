import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type NowPlayingSource = 'music_request' | 'manual'
export type NowPlayingLayout = 'vinyl' | 'bar' | 'lyric'

export interface ParsedLyricLine {
  timeSec: number
  text: string
}

export interface NowPlayingState {
  source: NowPlayingSource
  layout: NowPlayingLayout
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  // 手动模式曲目信息
  title: string
  artist: string
  coverUrl: string
  requester: string
  durationSec: number
  elapsedSec: number
  startedAt: number
  isPlaying: boolean
  loopPlayback: boolean
  lyricsText: string
  // 显示开关
  showRequester: boolean
  showProgress: boolean
  showVisualizer: boolean
}

export type NowPlayingAction = { type: 'PLAY' } | { type: 'PAUSE' } | { type: 'SEEK'; elapsedSec: number }

export const SAMPLE_LYRICS = `[00:00.00] 沉むように溶けてゆくように
[00:05.00] 二人だけの空が広がる夜に
[00:11.00] 「さよなら」だけだった
[00:15.00] その一言で全てが分かった
[00:20.00] 日が沈み出した空と君の姿
[00:26.00] フェンス越しに重なっていた`

export const NOW_PLAYING_PRESETS: Array<{
  label: string
  title: string
  artist: string
  requester: string
  durationSec: number
  lyricsText: string
}> = [
  {
    label: '夜に駆ける',
    title: '夜に駆ける',
    artist: 'YOASOBI',
    requester: '星野观众',
    durationSec: 260,
    lyricsText: SAMPLE_LYRICS,
  },
  {
    label: '晴天',
    title: '晴天',
    artist: '周杰伦',
    requester: '舰长小明',
    durationSec: 269,
    lyricsText: `[00:00.00] 故事的小黄花 从出生那年就飘着
[00:06.00] 童年的荡秋千 随记忆一直晃到现在
[00:13.00] 吹着前奏望着天空 我想起花瓣试着掉落
[00:20.00] 为你翘课的那一天 花落的那一天
[00:27.00] 教室的那一间 我怎么看不见`,
  },
  {
    label: '打上花火',
    title: '打上花火',
    artist: 'DAOKO × 米津玄師',
    requester: '点歌观众',
    durationSec: 290,
    lyricsText: `あの日見渡した渚を 今も思い出すんだ
砂の上に刻んだ言葉 君の後ろ姿
寄りかえす波が 足元をよぎり何かを攫う
夕凪の中 日暮れだけが通り過ぎてゆく
パッと光って咲いた 花火を見ていた`,
  },
]

export const DEFAULT_NOW_PLAYING_STATE: NowPlayingState = {
  source: 'manual',
  layout: 'vinyl',
  theme: 'card',
  accentColor: '#38bdf8',
  fontFamily: '',
  title: '夜に駆ける',
  artist: 'YOASOBI',
  coverUrl: '',
  requester: '星野观众',
  durationSec: 260,
  elapsedSec: 0,
  startedAt: Date.now(),
  isPlaying: true,
  loopPlayback: true,
  lyricsText: SAMPLE_LYRICS,
  showRequester: true,
  showProgress: true,
  showVisualizer: true,
}

const LRC_TIME_RE = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)$/

/**
 * 解析 LRC 时间轴歌词或普通多行文本。
 * 若不含时间戳，则按总时长均匀分配每行时间点。
 */
export function parseLyrics(raw: string, durationSec: number): ParsedLyricLine[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return []

  const timed: ParsedLyricLine[] = []
  const plain: string[] = []

  for (const line of lines) {
    const match = LRC_TIME_RE.exec(line)
    if (match) {
      const minutes = Number(match[1])
      const seconds = Number(match[2])
      const fracRaw = match[3] ?? '0'
      const frac = Number(fracRaw.padEnd(3, '0')) / 1000
      const text = match[4].trim()
      if (text) {
        timed.push({ timeSec: minutes * 60 + seconds + frac, text })
      }
    } else if (!/^\[[a-zA-Z]+:.*\]$/.test(line)) {
      plain.push(line)
    }
  }

  if (timed.length > 0) {
    return timed.toSorted((a, b) => a.timeSec - b.timeSec)
  }

  const safeDuration = Math.max(plain.length * 4, durationSec || plain.length * 4)
  const step = Math.min(8, safeDuration / plain.length)
  return plain.map((text, index) => ({
    timeSec: Number((index * step).toFixed(2)),
    text,
  }))
}

export function computeElapsedSec(state: NowPlayingState, nowMs: number): number {
  const duration = Math.max(1, state.durationSec || 1)
  const deltaSec = state.isPlaying && state.startedAt > 0 ? Math.max(0, (nowMs - state.startedAt) / 1000) : 0
  const raw = Math.max(0, (state.elapsedSec || 0) + deltaSec)
  if (state.loopPlayback) {
    return raw % duration
  }
  return Math.min(duration, raw)
}

export function resolveActiveLyricIndex(lines: ParsedLyricLine[], currentSec: number): number {
  if (!lines.length) return -1
  let active = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timeSec <= currentSec) {
      active = i
    } else {
      break
    }
  }
  return active
}

export function formatTrackTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds))
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
