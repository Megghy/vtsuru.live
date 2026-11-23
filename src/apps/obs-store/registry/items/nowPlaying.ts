import { Disc3 } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const nowPlayingComponent: ObsComponentDefinition = {
  id: 'now-playing',
  name: '正在播放音乐与歌词条 (Now Playing)',
  shortDescription: '支持自动联动站内点歌机或手动控制歌词进度，提供黑胶唱片、胶囊横条与大字歌词 3 种展示样式',
  description:
    '为歌回与音乐背景直播打造的实时曲目与歌词展示挂件。支持自动订阅站内点歌机当前播放歌曲（歌名、歌手、封面、点歌观众），亦可在手动模式下控制播放进度并渲染 LRC 时间轴或多行歌词，提供 4 套主题与自定义字体配色。',
  category: 'widget',
  status: 'ready',
  tags: ['正在播放', '歌词条', '黑胶唱片', '点歌机联动', '歌回'],
  icon: Disc3,
  obsPath: '/obs-store/now-playing',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=now-playing',
  defaultResolution: { width: 420, height: 120, label: '黑胶标准 (420×120 px)' },
  supportedResolutions: [
    { width: 420, height: 120, label: '黑胶唱片 (420×120 px)' },
    { width: 520, height: 84, label: '紧凑胶囊横条 (520×84 px)' },
    { width: 460, height: 170, label: '大字滚动歌词卡 (460×170 px)' },
  ],
  features: [
    '支持站内点歌机实时推送联动与手动曲目/歌词控制双数据源模式',
    '内置旋转黑胶唱片、紧凑胶囊横条、大字滚动歌词卡 3 种视觉布局',
    '支持 LRC 时间轴解析与纯文本自动轮播，播放/暂停联动黑胶与音律条动效',
    '提供悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套主题与自定义强调色、字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/now-playing/NowPlayingViewer.vue'),
}
