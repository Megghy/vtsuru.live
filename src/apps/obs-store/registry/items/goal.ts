import TargetArrow24Regular from '@vicons/fluent/es/TargetArrow24Regular'

import type { ObsComponentDefinition } from '../types'

export const goalComponent: ObsComponentDefinition = {
  id: 'goal',
  name: '目标进度与耐久加钟 (Goal / Subathon)',
  shortDescription: '舰长/营收目标进度条与礼物/SC 自动耐久倒计时，控制台联动跨端实时同步 OBS',
  description:
    '专为主播打造的直播间目标进度条与 Subathon 耐久加钟挂件。支持舰长数、礼物/SC 电池金额目标追踪，支持上舰/投喂自动增加倒计时秒数与手动加减微调，提供 4 套主题并直接通过平台实时同步至 OBS 浏览器源。',
  category: 'widget',
  status: 'ready',
  tags: ['目标进度条', '耐久加钟', 'Subathon', '舰长目标', '实时同步'],
  icon: TargetArrow24Regular,
  obsPath: '/obs-store/goal',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=goal',
  defaultResolution: { width: 440, height: 150, label: '标准横条 (440×150 px)' },
  supportedResolutions: [
    { width: 440, height: 150, label: '标准尺寸 (440×150 px)' },
    { width: 560, height: 180, label: '宽幅醒目 (560×180 px)' },
    { width: 340, height: 120, label: '紧凑挂件 (340×120 px)' },
  ],
  features: [
    '支持纯目标进度条、耐久加钟倒计时及「进度 + 加钟」双显三种模式',
    '控制台可自动订阅直播间上舰/礼物/SC 事件并按比例实时推进目标与加钟',
    '支持手动快捷加减进度、暂停/继续倒计时与快捷 +5m/+10m 微调',
    '提供悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套视觉主题',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/goal/GoalViewer.vue'),
}
