import { PackageOpen } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const mysteryBoxComponent: ObsComponentDefinition = {
  id: 'mystery-box',
  name: '盲盒拆盒与盈亏统计 (Mystery Box Tracker)',
  shortDescription: '自动捕获直播间盲盒礼物，实时统计总拆盒数、盈亏账单、出货明细与欧皇/非酋榜',
  description:
    '专为直播间盲盒玩法打造的实时盈亏记账挂件。自动识别带盲盒信息的礼物并核算投入成本与开出价值，动态生成欧皇榜、非酋榜与各礼物出货统计，支持模拟拆盒、手动记账与出货闪卡飘字动效。',
  category: 'interactive',
  status: 'ready',
  tags: ['盲盒统计', '盈亏追踪', '欧皇榜', '非酋榜', '礼物互动'],
  icon: PackageOpen,
  obsPath: '/obs-store/mystery-box',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=mystery-box',
  defaultResolution: { width: 380, height: 360, label: '标准完整 (380×360 px)' },
  supportedResolutions: [
    { width: 380, height: 360, label: '标准完整 (380×360 px)' },
    { width: 440, height: 400, label: '宽幅明细 (440×400 px)' },
    { width: 360, height: 180, label: '紧凑账单 (360×180 px)' },
  ],
  features: [
    '自动监听直播间盲盒礼物，精确计算投入成本、开出价值与净盈亏',
    '实时更新个人累计盈亏欧皇榜 / 非酋榜与各礼物出货统计',
    '支持模拟拆一发、手动记一笔与最新出货亮眼闪卡飘字动效',
    '内置完整/紧凑双视图、4 套视觉主题与自定义强调色和字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/mystery-box/MysteryBoxViewer.vue'),
}
