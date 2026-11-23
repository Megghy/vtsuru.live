import { Target } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const goalComponent: ObsComponentDefinition = {
  id: 'goal',
  name: '目标进度与耐久加钟 (Goal / Subathon)',
  shortDescription: '舰长/营收/单品礼物/粉丝/点赞多维度目标进度条、阶段里程碑与自动耐久加钟',
  description:
    '专为主播打造的直播间目标进度条与 Subathon 耐久加钟挂件。支持舰长数、营收金额、指定单品礼物计数、粉丝数与本场点赞多维度追踪，内置阶段里程碑福利预告与自动加钟，提供 4 套主题并跨端实时同步至 OBS。',
  category: 'widget',
  status: 'ready',
  tags: ['目标进度条', '耐久加钟', 'Subathon', '舰长目标', '里程碑', '单品礼物'],
  icon: Target,
  obsPath: '/obs-store/goal',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=goal',
  defaultResolution: { width: 460, height: 170, label: '标准横条 (460×170 px)' },
  supportedResolutions: [
    { width: 460, height: 170, label: '标准尺寸 (460×170 px)' },
    { width: 560, height: 190, label: '宽幅醒目 (560×190 px)' },
    { width: 360, height: 135, label: '紧凑挂件 (360×135 px)' },
  ],
  features: [
    '支持舰长数、营收金额、单品礼物个数、粉丝里程碑、本场点赞等 6 种追踪维度',
    '支持一键同步当前真实总舰长数、最新粉丝数与本场累计点赞基数',
    '内置阶段里程碑刻度与下一阶段解锁福利预告，支持上舰/投喂自动加钟',
    '提供悬浮卡片、极简透明、赛博霓虹、玻璃拟态 4 套视觉主题',
  ],
  version: '1.1.0',
  manageComponent: async () => import('@/apps/obs-store/components/goal/GoalViewer.vue'),
}
