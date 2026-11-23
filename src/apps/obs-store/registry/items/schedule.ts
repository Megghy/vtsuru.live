import { CalendarDays } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const scheduleComponent: ObsComponentDefinition = {
  id: 'schedule',
  name: '直播日程表挂件 (Schedule Overlay)',
  shortDescription: '直连主播本周直播日程，自动高亮今日安排，支持清单、双列卡片与等待页横向 7 日条',
  description:
    '专为主播开播等待页与直播间侧边栏打造的日程表挂件。OBS 浏览器源直接拉取公开周日程并定时刷新，无需后台常驻；自动定位本周与高亮今天，支持紧凑清单、双列卡片、横向 7 日条三种布局与 4 套视觉主题。',
  category: 'widget',
  status: 'ready',
  tags: ['直播日程', '开播预告', '等待页', '自动同步', '今日高亮'],
  icon: CalendarDays,
  obsPath: '/obs-store/schedule',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=schedule',
  defaultResolution: { width: 420, height: 480, label: '竖排清单 / 卡片 (420×480 px)' },
  supportedResolutions: [
    { width: 420, height: 480, label: '竖排清单 / 卡片 (420×480 px)' },
    { width: 960, height: 160, label: '横向 7 日条 (960×160 px)' },
    { width: 360, height: 420, label: '紧凑侧栏 (360×420 px)' },
  ],
  features: [
    '直连站点公开日程 API 并按设定间隔自动刷新，无需保持管理页打开',
    '自动匹配当前周并高亮「今天」的直播安排，支持隐藏空日程日或自定义休息日文案',
    '内置紧凑清单、双列卡片、横向 7 日条三种布局，适配侧边栏与开播等待页',
    '提供悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套主题与自定义强调色/字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/schedule/ScheduleViewer.vue'),
}
