import ClosedCaption24Regular from '@vicons/fluent/es/ClosedCaption24Regular'

import type { ObsComponentDefinition } from '../types'

export const subtitleComponent: ObsComponentDefinition = {
  id: 'subtitle',
  name: '实时语音字幕条 (Subtitle)',
  shortDescription: '直连客户端语音转写，在 OBS 中低延迟透明叠加实时同传字幕条',
  description:
    '配合客户端桌面端实时语音转写能力使用，主播说话瞬间通过平台实时网关低延迟推送到 OBS 透明浏览器源。支持多行滚动、识别中预览、超时自动淡出及字体/描边/对齐自定义。',
  category: 'widget',
  status: 'ready',
  tags: ['实时字幕', '语音转写', 'OBS字幕条', '同传字幕', '低延迟'],
  icon: ClosedCaption24Regular,
  obsPath: '/obs-store/subtitle',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=subtitle',
  defaultResolution: { width: 960, height: 180, label: '横幅字幕条 (960×180 px)' },
  supportedResolutions: [
    { width: 960, height: 180, label: '横幅字幕条 (960×180 px)' },
    { width: 1280, height: 220, label: '高清宽屏 (1280×220 px)' },
    { width: 640, height: 160, label: '小窗紧凑 (640×160 px)' },
  ],
  features: [
    '一键联动客户端语音转写，识别结果毫秒级推送到 OBS',
    '支持显示识别中临时文字（更低延迟）或仅显示定稿句',
    '支持多行字幕、自定义字号/颜色/对齐与无发言超时自动淡出',
  ],
  version: '1.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/subtitle/SubtitleViewer.vue'),
}
