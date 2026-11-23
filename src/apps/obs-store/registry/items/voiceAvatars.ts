import { Mic } from 'lucide-vue-next'

import type { ObsComponentDefinition } from '../types'

export const voiceAvatarsComponent: ObsComponentDefinition = {
  id: 'voice-avatars',
  name: '极简连麦语音头像 (Voice Reactive Avatars)',
  shortDescription: '支持最多 8 人连麦头像亮灯与弹性跳动，内置本机麦克风 VAD 实时音量检测同步 OBS',
  description:
    '低门槛多人连麦状态灯挂件。支持自由管理最多 8 位成员头像与专属强调色，内置 Web Audio API 实时麦克风语音活动检测（VAD）与点击模拟说话测试，说话时头像发光弹性上跳、静音时自动收拢变暗。',
  category: 'interactive',
  status: 'ready',
  tags: ['连麦头像', '语音亮灯', 'VAD', '麦克风检测', '多人联动'],
  icon: Mic,
  obsPath: '/obs-store/voice-avatars',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=voice-avatars',
  defaultResolution: { width: 560, height: 180, label: '标准横排 (560×180 px)' },
  supportedResolutions: [
    { width: 560, height: 180, label: '标准横排 (560×180 px)' },
    { width: 200, height: 480, label: '侧栏竖排 (200×480 px)' },
    { width: 420, height: 320, label: '多人网格 (420×320 px)' },
  ],
  features: [
    '支持最多 8 位连麦成员槽位，自由定制昵称、头像图片与专属高亮色',
    '内置本机麦克风 Web Audio API 实时 VAD 检测、灵敏度滑杆与音量条预览',
    '说话时触发发光描边、脉冲光环、弹性上跳与昵称底色点亮，支持隐藏静音成员',
    '提供横排/竖排/网格布局、圆形/圆角方形头像、4 套视觉主题与自定义字体',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/voice-avatars/VoiceAvatarsViewer.vue'),
}
