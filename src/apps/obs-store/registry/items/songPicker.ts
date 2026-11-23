import { Music2 } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const songPickerComponent: ObsComponentDefinition = {
  id: 'song-picker',
  name: '曲库展示与盲抽翻牌 (Song Picker)',
  shortDescription: '直连站内主播歌单，支持语种/标签筛选滚屏展示与 3D 盲抽翻牌互动揭晓',
  description:
    '为歌回互动打造的曲库滚屏与盲抽翻牌组件。直接读取主播站内公开歌单，支持按语种与标签划分候选池，在歌单滚动与盲抽翻牌双模式间一键切换；控制端先锁定目标曲目并同步广播，OBS 端呈现滚动减速与 3D 翻牌仪式感，并自动避免短期重复抽中。',
  category: 'interactive',
  status: 'ready',
  tags: ['歌单', '盲抽翻牌', '歌回互动', '曲库展示', '实时同步'],
  icon: Music2,
  obsPath: '/obs-store/song-picker',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=song-picker',
  defaultResolution: { width: 420, height: 340, label: '标准曲库/翻牌 (420×340 px)' },
  supportedResolutions: [
    { width: 420, height: 340, label: '标准尺寸 (420×340 px)' },
    { width: 480, height: 420, label: '大画幅展示 (480×420 px)' },
    { width: 360, height: 280, label: '紧凑挂件 (360×280 px)' },
  ],
  features: [
    '自动读取站内公开歌单，支持跳过已禁用歌曲与内置示例歌单预览',
    '支持按语种与自定义标签快速筛选滚动或盲抽候选池',
    '盲抽模式支持减速滚槽与 3D 翻牌揭晓动效，内置短期防重复记忆',
    '支持自定义滚屏速度、4 套视觉主题、强调色与 Google 字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/song-picker/SongPickerViewer.vue'),
}
