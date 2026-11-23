import { Gift } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const pointShowcaseComponent: ObsComponentDefinition = {
  id: 'point-showcase',
  name: '积分商城与签到榜 (Points & Check-In)',
  shortDescription: '直连积分商城可兑换好礼轮播与弹幕签到排行榜，底部引流引导观众签到互动',
  description:
    '将直播间积分商城与弹幕签到排行榜直接搬进 OBS 画面。支持商品轮播卡片（封面、折扣价、库存/限购标签）、签到连签/积分 Top N 榜单，以及商品与榜单按秒数自动轮播切换，帮助提升直播间签到活跃度与粉丝粘性。',
  category: 'interactive',
  status: 'ready',
  tags: ['积分商城', '签到榜', '轮播挂件', '弹幕互动', '自动同步'],
  icon: Gift,
  obsPath: '/obs-store/point-showcase',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=point-showcase',
  defaultResolution: { width: 380, height: 320, label: '标准卡片 (380×320 px)' },
  supportedResolutions: [
    { width: 380, height: 320, label: '标准卡片 (380×320 px)' },
    { width: 440, height: 360, label: '宽幅展示 (440×360 px)' },
    { width: 320, height: 280, label: '紧凑角落 (320×280 px)' },
  ],
  features: [
    '直连公开积分商品与签到排行接口，OBS 端独立定时刷新无需后台常驻',
    '支持仅商品轮播、仅签到排行榜、商品与榜单自动交替轮播三种模式',
    '自动展示商品封面、限时折扣原价对比、库存/限兑标签及底部签到引流标语',
    '提供悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套视觉主题与自定义配色字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/point-showcase/PointShowcaseViewer.vue'),
}
