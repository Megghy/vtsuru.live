import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'

export type ChecklistItemStatus = 'pending' | 'active' | 'done'

export interface ChecklistItem {
  id: string
  text: string
  status: ChecklistItemStatus
}

export interface ChecklistState {
  title: string
  subtitle: string
  items: ChecklistItem[]
  theme: ObsWidgetTheme
  accentColor: string
  fontFamily: string
  maxVisible: number
  hideCompleted: boolean
  singleActive: boolean
  showProgress: boolean
}

export type ChecklistAction =
  | { type: 'STATUS_CHANGED'; id: string; status: ChecklistItemStatus }
  | { type: 'RESET_ALL' }

export interface ChecklistTemplate {
  id: string
  name: string
  title: string
  subtitle: string
  items: Array<{ text: string; status?: ChecklistItemStatus }>
}

export const CHECKLIST_TEMPLATES: ChecklistTemplate[] = [
  {
    id: 'talk',
    name: '杂谈话题',
    title: '今日杂谈清单',
    subtitle: 'TALK TOPICS',
    items: [
      { text: '开场闲聊与近况分享', status: 'done' },
      { text: '读棉花糖 & 弹幕互动', status: 'active' },
      { text: '本周趣事与热点吐槽', status: 'pending' },
      { text: '下播预告与晚安环节', status: 'pending' },
    ],
  },
  {
    id: 'singing',
    name: '歌回流程',
    title: '今晚歌回安排',
    subtitle: 'SINGING STREAM',
    items: [
      { text: '开嗓热身曲 2 首', status: 'done' },
      { text: '观众点歌自由演唱', status: 'active' },
      { text: '歌单盲抽挑战环节', status: 'pending' },
      { text: '舰长专属加歌', status: 'pending' },
      { text: '压轴安可与合影', status: 'pending' },
    ],
  },
  {
    id: 'gaming',
    name: '游戏挑战',
    title: '今晚通关目标',
    subtitle: 'GAME CHALLENGE',
    items: [
      { text: '整理配装与路线规划', status: 'done' },
      { text: '推进主线章节', status: 'active' },
      { text: '单挑隐藏 Boss（无伤挑战）', status: 'pending' },
      { text: '收集全地图隐藏宝箱', status: 'pending' },
      { text: '通关复盘与惩罚结算', status: 'pending' },
    ],
  },
]

export function createChecklistItemId(): string {
  return `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export const DEFAULT_CHECKLIST_STATE: ChecklistState = {
  title: '今日直播清单',
  subtitle: 'STREAM PLAN',
  items: [
    { id: 'chk_init_1', text: '开场闲聊与近况分享', status: 'done' },
    { id: 'chk_init_2', text: '读棉花糖 & 观众问答', status: 'active' },
    { id: 'chk_init_3', text: '歌回 / 游戏主环节', status: 'pending' },
    { id: 'chk_init_4', text: '舰长感谢与下播预告', status: 'pending' },
  ],
  theme: 'card',
  accentColor: '#38bdf8',
  fontFamily: '',
  maxVisible: 6,
  hideCompleted: false,
  singleActive: true,
  showProgress: true,
}
