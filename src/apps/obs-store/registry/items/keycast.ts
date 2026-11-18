import KeypadOutline from '@vicons/ionicons5/es/KeypadOutline'

import type { ObsComponentDefinition } from '../types'

export const keycastComponent: ObsComponentDefinition = {
  id: 'keycast',
  name: '键鼠映射与按键投屏 (Keycast)',
  shortDescription:
    '透明 Canvas 键盘鼠标同步高亮（支持 WASD / MOBA / 60% / TKL、热力染色与余晖波纹），并保留按键弹幕流模式',
  description:
    '专为游戏直播、操作教学与音游打字打造的键鼠可视化挂件。基于透明 Canvas 2D 绘制多套键盘布局与联动鼠标，支持按键亮起余晖、点击波纹、高频热力染色、KPS/APM 统计、滚轮与侧键高亮及鼠标移动光轨，同时可随时切换回经典按键弹幕流模式。',
  category: 'input',
  status: 'ready',
  tags: ['键鼠映射', '键盘', '鼠标', '热力图', 'KPS', 'Canvas', '纯前端'],
  icon: KeypadOutline,
  obsPath: '/obs-store/keycast',
  requiresAccount: true,
  managePath: '/manage/obs-store?component=keycast',
  defaultResolution: { width: 460, height: 280, label: 'WASD / MOBA 键鼠映射 (460×280 px)' },
  supportedResolutions: [
    { width: 460, height: 280, label: 'WASD / MOBA 键鼠映射 (460×280 px)' },
    { width: 780, height: 280, label: '60% 机械键盘 + 鼠标 (780×280 px)' },
    { width: 940, height: 320, label: '80% TKL 标准键盘 + 鼠标 (940×320 px)' },
    { width: 500, height: 200, label: '经典按键弹幕流横条 (500×200 px)' },
  ],
  features: [
    '透明 Canvas 2D 绘制键盘鼠标映射，提供 WASD / MOBA / 60% / 80% TKL 四套对齐布局与联动鼠标（含侧键、滚轮与光轨）',
    '支持按键松开余晖渐消、点击扩散波纹、按压高频热力染色与单键敲击计数角标',
    '内置实时 KPS 与 APM 手速统计胶囊，支持整体不透明度与 4 套主题无缝切换',
    '同时保留传统组合按键弹幕流模式，支持画布直接点按测试与游戏操作仿真预览',
  ],
  version: '2.0.0',
  manageComponent: async () => import('@/apps/obs-store/components/keycast/KeycastViewer.vue'),
}
