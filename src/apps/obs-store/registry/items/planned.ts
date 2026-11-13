import KeypadOutline from '@vicons/ionicons5/es/KeypadOutline'

import type { ObsComponentDefinition } from '../types'

export const plannedComponents: ObsComponentDefinition[] = [
  {
    id: 'keycast',
    name: '键盘按键投屏 (Keycast)',
    shortDescription: '捕获键盘击键与组合快捷键，以连击动效或虚拟键帽实时投屏展示',
    description:
      '专为游戏操作、编程教学与打字展示设计的键盘可视化挂件。实时呈现单键与组合快捷键触发，支持 APM 敲击速率统计、多种键帽主题与淡出动画效果。',
    category: 'input',
    status: 'planned',
    tags: ['键盘', '按键显示', '快捷键', 'APM统计', '纯前端'],
    icon: KeypadOutline,
    defaultResolution: { width: 500, height: 200, label: '紧凑横条 (500×200 px)' },
    features: [
      '实时捕获键盘击键与组合键（如 Ctrl+Shift+Alt+Key）',
      '支持连击动效、停留时间与平滑淡出过渡',
      '提供极简气泡、机械键盘键帽等多种视觉风格',
      '纯本地渲染，保护隐私，无云端数据传输',
    ],
  },
]
