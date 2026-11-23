import { Activity } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const liveHudComponent: ObsComponentDefinition = {
  id: 'live-hud',
  name: '直播间状态看板 (Live HUD)',
  shortDescription: '高能在线、点赞、看过、粉丝、总舰长、开播时长与弹幕数一站式状态条，支持定时自动同步真实数据',
  description:
    '专为主播打造的极简直播间实时状态看板。支持按需勾选高能在线、本场点赞、累计看过、粉丝数、总舰长、开播时长与本场弹幕 7 项核心指标，内置每 20 秒自动同步站内与官方统计接口，并提供单行胶囊条、分块指标卡、竖排侧边栏 3 种布局及 4 套主题。',
  category: 'widget',
  status: 'ready',
  tags: ['状态看板', 'Live HUD', '高能在线', '粉丝数', '舰长数', '开播时长'],
  icon: Activity,
  obsPath: '/obs-store/live-hud',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=live-hud',
  defaultResolution: { width: 620, height: 84, label: '单行胶囊条 (620×84 px)' },
  supportedResolutions: [
    { width: 620, height: 84, label: '单行胶囊条 (620×84 px)' },
    { width: 680, height: 110, label: '分块指标卡 (680×110 px)' },
    { width: 240, height: 320, label: '竖排侧边栏 (240×320 px)' },
  ],
  features: [
    '支持高能在线、本场点赞、累计看过、粉丝数、当前总舰长、开播时长与本场弹幕 7 项指标独立开关',
    '内置真实数据自动同步（每 20 秒轮询），开播时长按开播时间本地每秒精准跳动',
    '提供单行胶囊条、分块指标卡、竖排侧边栏 3 种布局与紧凑/标准双密度档位',
    '支持示例数据预览与手动数值编辑，未开播也能轻松完成 OBS 画面排版',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/live-hud/LiveHudViewer.vue'),
}
