import { BellRing } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const alertBoxComponent: ObsComponentDefinition = {
  id: 'alert-box',
  name: '事件播报弹窗 (Alert Box)',
  shortDescription: '上舰、SC、大礼物、积分兑换、弹幕签到与关注实时排队播报，支持自定义模板、动效与合成提示音',
  description:
    '专为主播打造的多事件 OBS 实时播报弹窗组件。支持新上舰/续费、醒目留言 SC、高价礼物过滤、站内积分商城兑换、弹幕签到成功及新增关注 6 类事件独立开关与文案模板自定义，内置队列依次播报、3 种 GPU 入场动效与轻快 Web Audio 提示音。',
  category: 'interactive',
  status: 'ready',
  tags: ['事件播报', 'Alert Box', '上舰提醒', 'SC 弹窗', '积分兑换', '弹幕签到'],
  icon: BellRing,
  obsPath: '/obs-store/alert-box',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=alert-box',
  defaultResolution: { width: 520, height: 220, label: '标准横幅 (520×220 px)' },
  supportedResolutions: [
    { width: 520, height: 220, label: '标准尺寸 (520×220 px)' },
    { width: 640, height: 260, label: '宽幅醒目 (640×260 px)' },
    { width: 420, height: 180, label: '紧凑弹窗 (420×180 px)' },
  ],
  features: [
    '支持上舰、SC、礼物、积分商城兑换、弹幕签到与关注 6 类事件独立配置模板、配色与配图/GIF',
    '礼物支持最低金额阈值过滤，自动屏蔽免费与小额礼物刷屏',
    '内置播放队列与滑入/缩放/弹出 3 种平滑动效，独立 OBS 源无事件时完全透明隐藏',
    '内置 Web Audio 合成提示音与 6 类一键模拟测试按钮，免开播即可完成排版验收',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/alert-box/AlertBoxViewer.vue'),
}
