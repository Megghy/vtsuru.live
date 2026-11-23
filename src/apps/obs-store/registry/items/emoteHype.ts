import { Flame } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const emoteHypeComponent: ObsComponentDefinition = {
  id: 'emote-hype',
  name: '氛围热度槽与表情喷泉 (Hype Meter & Emote Wall)',
  shortDescription: '弹幕/礼物驱动的实时热度充能槽与 Canvas 2D 抛物线表情喷泉，满槽触发高能脉冲',
  description:
    '集直播间氛围热度槽与零 DOM 负担 Canvas 2D 表情/热词喷泉于一体的高互动组件。自动响应弹幕、自定义热词、表情图、礼物与 SC 充能，热度自然回落，达到 100% 时触发 FEVER 满槽脉冲与粒子爆发。',
  category: 'interactive',
  status: 'ready',
  tags: ['热度槽', '表情喷泉', '弹幕互动', 'FEVER', 'Canvas'],
  icon: Flame,
  obsPath: '/obs-store/emote-hype',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=emote-hype',
  defaultResolution: { width: 540, height: 240, label: '标准组合 (540×240 px)' },
  supportedResolutions: [
    { width: 540, height: 240, label: '标准组合 (540×240 px)' },
    { width: 640, height: 320, label: '宽幅高空喷泉 (640×320 px)' },
    { width: 460, height: 120, label: '紧凑纯热度槽 (460×120 px)' },
  ],
  features: [
    '支持「热度槽 + 喷泉」「仅热度槽」「仅表情喷泉」三种呈现模式',
    '热词命中双倍充能并自动从底部抛物线喷射词条气泡或自定义表情图',
    '满槽 100% 触发 FEVER 炫酷脉冲与粒子爆发，支持自定义衰减与充能速率',
    'Canvas 2D 高帧率物理渲染且零 DOM 负担，支持 4 套视觉主题与自定义字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/emote-hype/EmoteHypeViewer.vue'),
}
