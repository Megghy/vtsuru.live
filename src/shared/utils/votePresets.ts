import { VoteMultiMode, type VoteTemplateItem } from '@/api/vote'
import { usePersistedStorage } from '@/shared/storage/persist'

export interface VotePreset {
  id?: string
  name: string
  title: string
  options: string[]
  durationSeconds?: number
  multiVoteMode?: VoteMultiMode
}

export const VOTE_QUICK_PRESETS: VotePreset[] = [
  { name: '红蓝 PK', title: '阵营对抗', options: ['红方', '蓝方'], durationSeconds: 60, multiVoteMode: VoteMultiMode.SingleReplace },
  { name: '正反判断', title: '是否赞同', options: ['支持', '反对'], durationSeconds: 60, multiVoteMode: VoteMultiMode.Single },
  { name: '三选一', title: '路线选择', options: ['方案 A', '方案 B', '方案 C'], durationSeconds: 90, multiVoteMode: VoteMultiMode.SingleReplace },
  { name: '四选一', title: '下个环节玩什么', options: ['选项 A', '选项 B', '选项 C', '选项 D'], durationSeconds: 120, multiVoteMode: VoteMultiMode.MultiOncePerOption },
]

/** 本地投票模板缓存（与云端 VoteConfig.templates 自动合并同步，供管理页与中控台共用） */
export function useVoteTemplates() {
  return usePersistedStorage<VoteTemplateItem[]>('DanmakuVoteTemplates', [])
}

export function mergeCloudAndLocalTemplates(
  cloud: readonly VoteTemplateItem[] | undefined,
  local: readonly VotePreset[] | undefined,
): VoteTemplateItem[] {
  const map = new Map<string, VoteTemplateItem>()

  for (const item of cloud ?? []) {
    if (!item.name?.trim() || !item.title?.trim() || !Array.isArray(item.options) || item.options.length < 2) continue
    const id = item.id || `tpl_${item.name.trim()}`
    map.set(item.name.trim(), {
      id,
      name: item.name.trim(),
      title: item.title.trim(),
      options: item.options.map((o) => o.trim()).filter(Boolean),
      durationSeconds: item.durationSeconds ?? 60,
      multiVoteMode: item.multiVoteMode ?? VoteMultiMode.Single,
    })
  }

  for (const item of local ?? []) {
    const name = item.name?.trim()
    const title = item.title?.trim()
    if (!name || !title || !Array.isArray(item.options) || item.options.length < 2) continue
    if (!map.has(name)) {
      map.set(name, {
        id: item.id || `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        title,
        options: item.options.map((o) => o.trim()).filter(Boolean),
        durationSeconds: item.durationSeconds ?? 60,
        multiVoteMode: item.multiVoteMode ?? VoteMultiMode.Single,
      })
    }
  }

  return Array.from(map.values())
}
