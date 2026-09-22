import type { VoteOBSData } from '@/api/api-models'

const duelOptions = ['蓝方：冰霜骑士', '红方：炽热战队']
const scenes = {
  'duel-top': {
    title: '红蓝阵营对抗赛 (顶部长条 HUD)',
    theme: 'duel',
    options: duelOptions,
    counts: [29, 21],
    seconds: 45,
  },
  duel: { title: '红蓝阵营对抗赛', theme: 'duel', options: duelOptions, counts: [24, 18], seconds: 50 },
  standard: {
    title: '下一局挑战什么游戏？',
    theme: 'glass',
    options: ['艾尔登法环', '怪物猎人荒野', '星露谷物语', '杂谈休息'],
    counts: [28, 18, 10, 4],
    seconds: 40,
  },
  leaderboard: {
    title: '点歌大乱斗 (前 6 名进入排期)',
    theme: 'glass',
    options: [
      '恋爱循环',
      '晴天',
      '群青',
      '七里香',
      '残酷天使的行动纲领',
      'lemon',
      '起风了',
      '勾指起誓',
      '夜驱',
      '打上花火',
    ],
    counts: [35, 30, 24, 18, 15, 12, 8, 6, 4, 2],
    seconds: 60,
  },
} as const
export type VotePreviewScene = keyof typeof scenes
let previewSessionId = 9999

export function createVotePreviewScene(scene: VotePreviewScene, position: string): VoteOBSData {
  const preset = scenes[scene]
  const totalVotes = preset.counts.reduce((sum: number, count: number) => sum + count, 0)
  return {
    sessionId: ++previewSessionId,
    title: preset.title,
    isActive: true,
    isEnding: false,
    showResults: true,
    theme: preset.theme,
    roundedCorners: true,
    displayPosition: scene === 'duel-top' ? 'top-center' : scene === 'duel' ? 'center' : position,
    totalVotes,
    startTime: Date.now() - 15000,
    endTime: Date.now() + preset.seconds * 1000,
    options: preset.options.map((text, index) => ({
      index: index + 1,
      text,
      count: preset.counts[index],
      percentage: (preset.counts[index] / totalVotes) * 100,
    })),
  }
}
