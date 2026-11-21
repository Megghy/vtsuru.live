import { type VoteConfigModel, type VoteOBSDataModel, VoteResultMode } from '@/api/vote'

const duelOptions = ['蓝方：冰霜骑士', '红方：炽热战队']
const scenes = {
  'duel-top': {
    title: '红蓝阵营对抗赛 (顶部长条 HUD)',
    theme: 'duel',
    options: duelOptions,
    counts: [29, 21],
    contributions: [120, 86],
    seconds: 45,
  },
  duel: {
    title: '红蓝阵营对抗赛',
    theme: 'duel',
    options: duelOptions,
    counts: [24, 18],
    contributions: [98, 66],
    seconds: 50,
  },
  standard: {
    title: '下一局挑战什么游戏？',
    theme: 'glass',
    options: ['艾尔登法环', '怪物猎人荒野', '星露谷物语', '杂谈休息'],
    counts: [28, 18, 10, 4],
    contributions: [168, 88, 30, 0],
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
    contributions: [200, 150, 99, 60, 45, 30, 12, 6, 0, 0],
    seconds: 60,
  },
} as const

export type VotePreviewScene = keyof typeof scenes
let previewSessionId = 9999

export function createVotePreviewScene(
  scene: VotePreviewScene,
  position: string,
  config?: Partial<VoteConfigModel>,
): VoteOBSDataModel {
  const preset = scenes[scene]
  const totalVotes = preset.counts.reduce((sum: number, count: number) => sum + count, 0)
  const totalContribution = preset.contributions.reduce((sum: number, amount: number) => sum + amount, 0)
  const resultMode = config?.voteResultMode ?? VoteResultMode.ByCount

  return {
    sessionId: ++previewSessionId,
    title: preset.title,
    isActive: true,
    isPaused: false,
    isUnlimited: false,
    isEnding: false,
    showResults: config?.showResults ?? true,
    resultMode,
    theme: preset.theme,
    roundedCorners: config?.roundedCorners ?? true,
    displayPosition: scene === 'duel-top' ? 'top-center' : scene === 'duel' ? 'center' : position,
    totalVotes,
    totalContribution,
    startTime: Date.now() - 15000,
    endTime: Date.now() + preset.seconds * 1000,
    recentVoterName: '星月旅人',
    recentVoterOption: preset.options[0],
    recentVoteTime: Math.floor(Date.now() / 1000),
    fontFamily: config?.fontFamily ?? '',
    fontScale: config?.fontScale ?? 1,
    borderRadius: config?.roundedCorners === false ? 0 : (config?.borderRadius ?? 20),
    cardOpacity: config?.cardOpacity ?? 0.88,
    backdropBlur: config?.backdropBlur ?? 24,
    accentColor: config?.accentColor ?? '',
    leadingColor: config?.leadingColor ?? '',
    duelLeftColor: config?.duelLeftColor ?? '',
    duelRightColor: config?.duelRightColor ?? '',
    showRecentVoter: config?.showRecentVoter ?? true,
    options: preset.options.map((text, index) => ({
      index: index + 1,
      text,
      count: preset.counts[index],
      contribution: preset.contributions[index],
      percentage:
        resultMode === VoteResultMode.ByContribution && totalContribution > 0
          ? (preset.contributions[index] / totalContribution) * 100
          : (preset.counts[index] / totalVotes) * 100,
    })),
  }
}
