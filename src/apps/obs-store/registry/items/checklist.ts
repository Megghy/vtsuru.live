import { ListChecks } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const checklistComponent: ObsComponentDefinition = {
  id: 'checklist',
  name: '直播话题与待办清单 (Stream Checklist)',
  shortDescription: '实时展示今日直播流程、杂谈话题或游戏 Boss 清单，支持状态高亮与完成进度同步',
  description:
    '专为主播规划直播节奏打造的实时待办与话题清单挂件。支持在控制台快速增删排序、三态切换（待进行 / 进行中 / 已完成）以及一键推进下一项，内置杂谈、歌回、游戏挑战预设模板，状态毫秒级同步至 OBS 画面。',
  category: 'utility',
  status: 'ready',
  tags: ['待办清单', '直播话题', '歌回流程', '进度条', '实时同步'],
  icon: ListChecks,
  obsPath: '/obs-store/checklist',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=checklist',
  defaultResolution: { width: 360, height: 380, label: '标准清单 (360×380 px)' },
  supportedResolutions: [
    { width: 360, height: 380, label: '标准尺寸 (360×380 px)' },
    { width: 420, height: 480, label: '多条目展开 (420×480 px)' },
    { width: 320, height: 260, label: '紧凑挂件 (320×260 px)' },
  ],
  features: [
    '支持待进行、当前进行中、已完成三态一键切换与单选聚焦高亮',
    '支持回车快捷添加、上下排序、一键推进下一项与一键全部重置',
    '内置杂谈话题、歌回流程、游戏挑战 3 套常用预设模板',
    '支持隐藏已完成项、最大可见条数智能聚焦与 4 套视觉主题自定义',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/checklist/ChecklistViewer.vue'),
}
