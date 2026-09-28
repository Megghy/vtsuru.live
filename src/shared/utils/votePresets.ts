import { usePersistedStorage } from '@/shared/storage/persist'

export interface VotePreset {
  name: string
  title: string
  options: string[]
}

export const VOTE_QUICK_PRESETS: VotePreset[] = [
  { name: '红蓝 PK', title: '阵营对抗', options: ['红方', '蓝方'] },
  { name: '正反判断', title: '是否赞同', options: ['支持', '反对'] },
  { name: '三选一', title: '路线选择', options: ['方案 A', '方案 B', '方案 C'] },
  { name: '四选一', title: '你最喜欢的项目', options: ['选项 A', '选项 B', '选项 C', '选项 D'] },
]

/** 用户自存的投票模板，管理页与中控台共用 */
export function useVoteTemplates() {
  return usePersistedStorage<VotePreset[]>('DanmakuVoteTemplates', [])
}
